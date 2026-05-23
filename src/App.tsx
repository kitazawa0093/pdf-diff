import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { CommissionFooter } from "./components/CommissionFooter";
import { DownloadPromo } from "./components/DownloadPromo";
import { WebAppLink } from "./components/WebAppLink";
import { HomeScreen } from "./components/HomeScreen";
import { PdfPageViewer } from "./components/PdfPageViewer";
import {
  compareDocuments,
  DEFAULT_MATCH_THRESHOLD,
} from "./lib/pageAlign";
import { extractAllPages } from "./lib/pdfExtract";
import {
  imageOnlyCompareMessage,
  isImageOnlyPdf,
} from "./lib/pdfImageDetect";
import {
  cloneArrayBuffer,
  loadPdfFromArrayBuffer,
  readFileAsArrayBuffer,
} from "./lib/loadPdf";
import {
  searchAlignedRows,
  searchHighlightsForPage,
  searchPreviewPages,
  type PageSearchHit,
} from "./lib/pdfSearch";
import { downloadDiffCsv } from "./lib/exportCsv";
import {
  addBookmark,
  deleteSession,
  findBookmark,
  getSession,
  listBookmarksForSession,
  listSessions,
  removeBookmark,
  summaryFromCompare,
  upsertSession,
  type SessionListItem,
  type StoredBookmark,
} from "./lib/storage";
import { isProActive, tryUnlockPro } from "./lib/license";
import {
  BOOTH_STORE_URL,
  effectivePreviewMaxNav,
  FREE_PAGE_LIMIT,
  proRequiredMessage,
  workspaceNeedsPro,
} from "./lib/tier";
import type { CompareResult, PageText } from "./lib/types";

const DEFAULT_ZOOM = 1.2;
const DEFAULT_MATCH_PERCENT = Math.round(DEFAULT_MATCH_THRESHOLD * 100);
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;

type AppScreen = "home" | "compare";

export default function App() {
  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);
  const pagesCacheRef = useRef<{ pagesA: PageText[]; pagesB: PageText[] } | null>(
    null,
  );
  const buffersRef = useRef<{
    pdfA?: ArrayBuffer;
    pdfB?: ArrayBuffer;
  } | null>(null);
  const pagesTextRef = useRef<{ A?: PageText[]; B?: PageText[] }>({});
  const sessionIdRef = useRef<string | null>(null);

  const [docA, setDocA] = useState<PDFDocumentProxy | null>(null);
  const [docB, setDocB] = useState<PDFDocumentProxy | null>(null);
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [navIndex, setNavIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [matchThresholdPercent, setMatchThresholdPercent] =
    useState(DEFAULT_MATCH_PERCENT);
  const [thresholdInput, setThresholdInput] = useState(
    String(DEFAULT_MATCH_PERCENT),
  );
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [bookmarks, setBookmarks] = useState<StoredBookmark[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [screen, setScreen] = useState<AppScreen>("home");
  const [textIndexVersion, setTextIndexVersion] = useState(0);
  const [indexingText, setIndexingText] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [imageOnlyA, setImageOnlyA] = useState(false);
  const [imageOnlyB, setImageOnlyB] = useState(false);
  const [isPro, setIsPro] = useState(() => isProActive());

  const hasPreview = Boolean(docA || docB);
  const imageOnlyMessage = imageOnlyCompareMessage(imageOnlyA, imageOnlyB);
  const compareBlockedByImage = imageOnlyA || imageOnlyB;
  const needsPro = workspaceNeedsPro(docA, docB, isPro);
  const proMessage = proRequiredMessage(docA, docB, isPro);
  const compareBlockedByTier = needsPro;

  const extractCap = useCallback(
    (doc: PDFDocumentProxy | null) => {
      if (!doc || isPro || doc.numPages <= FREE_PAGE_LIMIT) return undefined;
      return FREE_PAGE_LIMIT;
    },
    [isPro],
  );

  const indexPagesForSearch = useCallback(
    async (da: PDFDocumentProxy | null, db: PDFDocumentProxy | null) => {
      setIndexingText(true);
      try {
        pagesTextRef.current.A = da
          ? await extractAllPages(da, extractCap(da))
          : undefined;
        pagesTextRef.current.B = db
          ? await extractAllPages(db, extractCap(db))
          : undefined;
        setTextIndexVersion((v) => v + 1);
      } finally {
        setIndexingText(false);
      }
    },
    [extractCap],
  );

  const syncTextIndexFromCache = useCallback(
    async (da: PDFDocumentProxy | null, db: PDFDocumentProxy | null) => {
      const cache = pagesCacheRef.current;
      if (!cache) {
        await indexPagesForSearch(da, db);
        return;
      }
      pagesTextRef.current.A = cache.pagesA;
      pagesTextRef.current.B = cache.pagesB;
      setTextIndexVersion((v) => v + 1);
    },
    [indexPagesForSearch],
  );

  const refreshSessions = useCallback(async () => {
    setSessions(await listSessions());
  }, []);

  const refreshBookmarks = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) {
      setBookmarks([]);
      return;
    }
    setBookmarks(await listBookmarksForSession(sid));
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    void refreshBookmarks();
  }, [refreshBookmarks, compare]);

  const bookmarkedRowIds = useMemo(
    () => new Set(bookmarks.map((b) => b.rowId)),
    [bookmarks],
  );

  const isCurrentBookmarked = compare
    ? bookmarkedRowIds.has(navIndex)
    : false;

  const maxNav = useMemo(() => {
    if (compare) return compare.rows.length;
    return effectivePreviewMaxNav(docA, docB, isPro);
  }, [compare, docA, docB, isPro]);

  useEffect(() => {
    setNavIndex((i) => Math.min(i, maxNav));
  }, [maxNav]);

  const searchHits = useMemo((): PageSearchHit[] => {
    if (!searchQuery.trim()) return [];
    const pagesA = pagesTextRef.current.A ?? [];
    const pagesB = pagesTextRef.current.B ?? [];
    if (pagesA.length === 0 && pagesB.length === 0) return [];

    if (compare) {
      return searchAlignedRows({
        query: searchQuery,
        rows: compare.rows.map((r) => ({
          id: r.id,
          label: r.label,
          pageA: r.pageA,
          pageB: r.pageB,
        })),
        pagesA,
        pagesB,
      });
    }

    return searchPreviewPages({
      query: searchQuery,
      maxNav,
      pagesA,
      pagesB,
      hasA: Boolean(docA),
      hasB: Boolean(docB),
    });
  }, [
    searchQuery,
    compare,
    textIndexVersion,
    maxNav,
    docA,
    docB,
  ]);

  const searchHitNavIds = useMemo(
    () => new Set(searchHits.map((h) => h.navId)),
    [searchHits],
  );

  const currentRow = compare?.rows[navIndex - 1] ?? null;
  const pageDiff = currentRow?.diff ?? null;

  const viewPageA = compare ? (currentRow?.pageA ?? null) : navIndex;
  const viewPageB = compare ? (currentRow?.pageB ?? null) : navIndex;

  const searchHighlightsA = useMemo(() => {
    if (!searchQuery.trim() || viewPageA == null) return [];
    const page = pagesTextRef.current.A?.find((p) => p.pageNumber === viewPageA);
    return searchHighlightsForPage(page, searchQuery);
  }, [searchQuery, viewPageA, textIndexVersion]);

  const searchHighlightsB = useMemo(() => {
    if (!searchQuery.trim() || viewPageB == null) return [];
    const page = pagesTextRef.current.B?.find((p) => p.pageNumber === viewPageB);
    return searchHighlightsForPage(page, searchQuery);
  }, [searchQuery, viewPageB, textIndexVersion]);

  const mergedHighlightsA = useMemo(
    () => [...(pageDiff?.highlightsA ?? []), ...searchHighlightsA],
    [pageDiff, searchHighlightsA],
  );

  const mergedHighlightsB = useMemo(
    () => [...(pageDiff?.highlightsB ?? []), ...searchHighlightsB],
    [pageDiff, searchHighlightsB],
  );

  const navLabel = useMemo(() => {
    if (!hasPreview) return "";
    if (compare && currentRow) {
      return `${navIndex} / ${maxNav}（${currentRow.label}）`;
    }
    const parts: string[] = [];
    if (docA) parts.push(`A: ${navIndex}/${docA.numPages}`);
    if (docB) parts.push(`B: ${navIndex}/${docB.numPages}`);
    return `${navIndex} / ${maxNav}（${parts.join(" · ")}）`;
  }, [hasPreview, compare, currentRow, navIndex, maxNav, docA, docB]);

  const goPrev = useCallback(() => {
    setNavIndex((i) => Math.max(1, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setNavIndex((i) => Math.min(maxNav, i + 1));
  }, [maxNav]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10));
  }, []);

  const zoomReset = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

  const openBoothStore = useCallback(() => {
    if (BOOTH_STORE_URL) {
      window.open(BOOTH_STORE_URL, "_blank", "noopener,noreferrer");
    } else {
      setError(
        "BOOTH の URL が未設定です（ビルド時に VITE_BOOTH_URL を指定してください）。",
      );
    }
  }, []);

  const enterProPassword = useCallback(async () => {
    const pwd = window.prompt(
      "Pro 版パスワードを入力してください（BOOTH 購入後のメールに記載）",
    );
    if (pwd == null) return;
    setError(null);
    const result = tryUnlockPro(pwd);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setIsPro(true);
    setCompare(null);
    pagesCacheRef.current = null;
    if (docA || docB) {
      await indexPagesForSearch(docA, docB);
    }
  }, [docA, docB, indexPagesForSearch]);

  const exportCsv = useCallback(() => {
    if (!compare) return;
    const baseA = nameA.split("（")[0] || "A.pdf";
    const baseB = nameB.split("（")[0] || "B.pdf";
    downloadDiffCsv(compare, baseA, baseB);
  }, [compare, nameA, nameB]);

  const resetWorkspace = useCallback(() => {
    sessionIdRef.current = null;
    buffersRef.current = null;
    pagesTextRef.current = {};
    pagesCacheRef.current = null;
    setSearchQuery("");
    setDocA(null);
    setDocB(null);
    setNameA("");
    setNameB("");
    setCompare(null);
    setNavIndex(1);
    setMatchThresholdPercent(DEFAULT_MATCH_PERCENT);
    setThresholdInput(String(DEFAULT_MATCH_PERCENT));
    setZoom(DEFAULT_ZOOM);
    setBookmarks([]);
    setImageOnlyA(false);
    setImageOnlyB(false);
  }, []);

  const startNewImport = useCallback(() => {
    setError(null);
    resetWorkspace();
    setScreen("compare");
  }, [resetWorkspace]);

  const goHome = useCallback(() => {
    setError(null);
    setScreen("home");
    void refreshSessions();
  }, [refreshSessions]);

  const persistSession = useCallback(
    async (
      pdfA: ArrayBuffer,
      pdfB: ArrayBuffer,
      fileNameA: string,
      fileNameB: string,
      compareResult: CompareResult | null,
    ) => {
      try {
        const id = await upsertSession({
          id: sessionIdRef.current ?? undefined,
          fileNameA,
          fileNameB,
          pdfA,
          pdfB,
          matchThresholdPercent,
          compareSummary: compareResult ? summaryFromCompare(compareResult) : null,
        });
        sessionIdRef.current = id;
        await refreshSessions();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`履歴の保存に失敗しました: ${msg}`);
        throw e;
      }
    },
    [matchThresholdPercent, refreshSessions],
  );

  const toggleBookmark = useCallback(async () => {
    if (!compare || !currentRow) return;
    const sid = sessionIdRef.current;
    if (!sid) {
      setError("しおりは取り込み履歴に保存された比較でのみ使えます。");
      return;
    }
    try {
      const existing = await findBookmark(sid, navIndex);
      if (existing) {
        await removeBookmark(existing.id);
      } else {
        await addBookmark({
          sessionId: sid,
          rowId: navIndex,
          rowLabel: currentRow.label,
        });
      }
      await refreshBookmarks();
    } catch (e) {
      setError(
        `しおりの更新に失敗しました: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [compare, currentRow, navIndex, refreshBookmarks]);

  const restoreSession = useCallback(
    async (sessionId: string) => {
      setRestoringId(sessionId);
      setLoading(true);
      setError(null);
      try {
        const stored = await getSession(sessionId);
        if (!stored) {
          setError("履歴が見つかりません。");
          return;
        }
        buffersRef.current = {
          pdfA: cloneArrayBuffer(stored.pdfA),
          pdfB: cloneArrayBuffer(stored.pdfB),
        };
        const [docNewA, docNewB] = await Promise.all([
          loadPdfFromArrayBuffer(stored.pdfA),
          loadPdfFromArrayBuffer(stored.pdfB),
        ]);
        const [imgA, imgB] = await Promise.all([
          isImageOnlyPdf(docNewA),
          isImageOnlyPdf(docNewB),
        ]);
        sessionIdRef.current = stored.id;
        setDocA(docNewA);
        setDocB(docNewB);
        setImageOnlyA(imgA);
        setImageOnlyB(imgB);
        setNameA(`${stored.fileNameA}（${docNewA.numPages} ページ）`);
        setNameB(`${stored.fileNameB}（${docNewB.numPages} ページ）`);
        setMatchThresholdPercent(stored.matchThresholdPercent);
        setThresholdInput(String(stored.matchThresholdPercent));
        setCompare(null);
        pagesCacheRef.current = null;
        setNavIndex(1);

        const sessionNeedsPro = workspaceNeedsPro(docNewA, docNewB, isPro);
        if (!imgA && !imgB && !sessionNeedsPro) {
          const [pagesA, pagesB] = await Promise.all([
            extractAllPages(docNewA),
            extractAllPages(docNewB),
          ]);
          pagesCacheRef.current = { pagesA, pagesB };
          const result = compareDocuments(
            pagesA,
            pagesB,
            stored.matchThresholdPercent / 100,
          );
          setCompare(result);
          await upsertSession({
            id: stored.id,
            fileNameA: stored.fileNameA,
            fileNameB: stored.fileNameB,
            pdfA: stored.pdfA,
            pdfB: stored.pdfB,
            matchThresholdPercent: stored.matchThresholdPercent,
            compareSummary: summaryFromCompare(result),
          });
          await syncTextIndexFromCache(docNewA, docNewB);
        } else {
          pagesTextRef.current = {};
          setTextIndexVersion((v) => v + 1);
        }
        await refreshSessions();
        await refreshBookmarks();
        setScreen("compare");
      } catch (e) {
        setError(
          `履歴の復元に失敗しました: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        setLoading(false);
        setRestoringId(null);
      }
    },
    [refreshSessions, refreshBookmarks, syncTextIndexFromCache, isPro],
  );

  const removeSession = useCallback(
    async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm("この取り込み履歴を削除しますか？")) return;
      try {
        await deleteSession(sessionId);
        if (sessionIdRef.current === sessionId) {
          sessionIdRef.current = null;
          setBookmarks([]);
        }
        await refreshSessions();
        await refreshBookmarks();
      } catch (err) {
        setError(
          `履歴の削除に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [refreshSessions, refreshBookmarks],
  );

  const loadFile = useCallback(async (file: File, side: "A" | "B") => {
    setError(null);
    setLoading(true);
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const stored = cloneArrayBuffer(buffer);
      const doc = await loadPdfFromArrayBuffer(stored);
      let nextA = docA;
      let nextB = docB;
      let fileA = nameA.split("（")[0] || "";
      let fileB = nameB.split("（")[0] || "";
      if (side === "A") {
        nextA = doc;
        fileA = file.name;
        setDocA(doc);
        setNameA(`${file.name}（${doc.numPages} ページ）`);
      } else {
        nextB = doc;
        fileB = file.name;
        setDocB(doc);
        setNameB(`${file.name}（${doc.numPages} ページ）`);
      }
      const prev = buffersRef.current;
      const pdfA = side === "A" ? stored : prev?.pdfA;
      const pdfB = side === "B" ? stored : prev?.pdfB;
      if (pdfA && pdfB) {
        buffersRef.current = { pdfA, pdfB };
        if (nextA && nextB) {
          await persistSession(pdfA, pdfB, fileA, fileB, null);
        }
      } else if (pdfA || pdfB) {
        buffersRef.current = { pdfA, pdfB };
      } else {
        buffersRef.current = null;
      }
      const imageOnly = await isImageOnlyPdf(doc);
      if (side === "A") {
        setImageOnlyA(imageOnly);
      } else {
        setImageOnlyB(imageOnly);
      }
      setCompare(null);
      pagesCacheRef.current = null;
      setNavIndex(1);
      if (!imageOnly) {
        void indexPagesForSearch(nextA, nextB);
      }
    } catch (e) {
      setError(
        `PDF の読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setLoading(false);
    }
  }, [docA, docB, nameA, nameB, persistSession, indexPagesForSearch]);

  const onFileChange = useCallback(
    (side: "A" | "B") => async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await loadFile(file, side);
      e.target.value = "";
    },
    [loadFile],
  );

  const clampPercent = (n: number) => Math.min(100, Math.max(0, n));

  const applyCompare = useCallback(
    (pagesA: PageText[], pagesB: PageText[], percent: number): CompareResult => {
      const pct = clampPercent(percent);
      setMatchThresholdPercent(pct);
      setThresholdInput(String(pct));
      const result = compareDocuments(pagesA, pagesB, pct / 100);
      setCompare(result);
      setNavIndex(1);
      return result;
    },
    [],
  );

  const commitThreshold = useCallback(() => {
    const parsed = Number.parseInt(thresholdInput, 10);
    if (Number.isNaN(parsed)) {
      setThresholdInput(String(matchThresholdPercent));
      return;
    }
    const cache = pagesCacheRef.current;
    if (cache && !compareBlockedByImage && !compareBlockedByTier) {
      const result = applyCompare(cache.pagesA, cache.pagesB, parsed);
      const bufs = buffersRef.current;
      if (bufs?.pdfA && bufs?.pdfB && sessionIdRef.current) {
        void persistSession(
          bufs.pdfA,
          bufs.pdfB,
          nameA.split("（")[0] || "A.pdf",
          nameB.split("（")[0] || "B.pdf",
          result,
        );
      }
    } else {
      const pct = clampPercent(parsed);
      setMatchThresholdPercent(pct);
      setThresholdInput(String(pct));
    }
  }, [
    thresholdInput,
    matchThresholdPercent,
    applyCompare,
    nameA,
    nameB,
    persistSession,
    compareBlockedByImage,
    compareBlockedByTier,
  ]);

  const runCompare = useCallback(async () => {
    if (!docA || !docB) {
      setError("PDF A と PDF B の両方を読み込んでください。");
      return;
    }
    if (compareBlockedByImage) {
      setError(imageOnlyMessage);
      return;
    }
    if (compareBlockedByTier) {
      setError(proMessage);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [pagesA, pagesB] = await Promise.all([
        extractAllPages(docA),
        extractAllPages(docB),
      ]);
      pagesCacheRef.current = { pagesA, pagesB };
      pagesTextRef.current.A = pagesA;
      pagesTextRef.current.B = pagesB;
      setTextIndexVersion((v) => v + 1);

      const result = applyCompare(pagesA, pagesB, matchThresholdPercent);
      const bufs = buffersRef.current;
      if (!bufs?.pdfA || !bufs?.pdfB) {
        setError("PDF データが無いため保存できません。A/B を再度読み込んでください。");
        return;
      }
      await persistSession(
        bufs.pdfA,
        bufs.pdfB,
        nameA.split("（")[0] || "A.pdf",
        nameB.split("（")[0] || "B.pdf",
        result,
      );
      await refreshBookmarks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [
    docA,
    docB,
    matchThresholdPercent,
    applyCompare,
    nameA,
    nameB,
    persistSession,
    refreshBookmarks,
    compareBlockedByImage,
    imageOnlyMessage,
    compareBlockedByTier,
    proMessage,
  ]);

  if (screen === "home") {
    return (
      <div className="app app-home">
        {loading && <div className="loading-banner">処理中…</div>}
        {error && <div className="error-banner">{error}</div>}
        <HomeScreen
          sessions={sessions}
          loading={loading}
          restoringId={restoringId}
          onNewImport={startNewImport}
          onOpenSession={(id) => void restoreSession(id)}
          onDeleteSession={(id, e) => void removeSession(id, e)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="toolbar">
        <button type="button" className="toolbar-back" onClick={goHome} title="履歴一覧へ">
          ← 一覧
        </button>
        <h1>PDF Diff</h1>
        <WebAppLink />
        <div className="toolbar-actions">
          <input
            ref={inputARef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={onFileChange("A")}
          />
          <input
            ref={inputBRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={onFileChange("B")}
          />
          {!isPro && (
            <>
              <button
                type="button"
                className="toolbar-upgrade"
                onClick={openBoothStore}
                title="BOOTH で Pro 版を購入"
              >
                Pro版を購入
              </button>
              <button
                type="button"
                className="toolbar-upgrade-secondary"
                onClick={() => void enterProPassword()}
                title="購入後に届く Pro 版パスワードを入力"
              >
                Pro版パスワード
              </button>
            </>
          )}
          {isPro && (
            <span className="toolbar-pro-badge" title="Pro 版（全ページ）">
              Pro
            </span>
          )}
          <button
            type="button"
            onClick={() => inputARef.current?.click()}
            disabled={loading}
          >
            PDF A（旧）
          </button>
          <button
            type="button"
            onClick={() => inputBRef.current?.click()}
            disabled={loading}
          >
            PDF B（新）
          </button>
          {docA && docB && (
            <label
              className="toolbar-threshold"
              title="A の各ページについて、未使用の B のうち一致率が最も高いページとペア。この値未満ならその A は未ペア（B に無し扱い）"
            >
              <span>一致率</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                onBlur={commitThreshold}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
              />
              <span>%</span>
            </label>
          )}
          <button
            type="button"
            className="primary"
            onClick={runCompare}
            disabled={
              loading ||
              !docA ||
              !docB ||
              compareBlockedByImage ||
              compareBlockedByTier
            }
            title={
              compareBlockedByImage
                ? (imageOnlyMessage ?? undefined)
                : compareBlockedByTier
                  ? (proMessage ?? undefined)
                  : undefined
            }
          >
            比較
          </button>
          {hasPreview && (
            <div className="toolbar-page-nav">
              <button
                type="button"
                onClick={goPrev}
                disabled={navIndex <= 1}
                title="前のページ"
              >
                ◀
              </button>
              <span className="toolbar-page-label">{navLabel}</span>
              <button
                type="button"
                onClick={goNext}
                disabled={navIndex >= maxNav}
                title="次のページ"
              >
                ▶
              </button>
            </div>
          )}
          {hasPreview && (
            <div className="toolbar-zoom">
              <button type="button" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} title="縮小">
                −
              </button>
              <button type="button" onClick={zoomReset} title="倍率リセット">
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} title="拡大">
                ＋
              </button>
            </div>
          )}
          {compare && (
            <button
              type="button"
              className={isCurrentBookmarked ? "bookmark-active" : ""}
              onClick={() => void toggleBookmark()}
              disabled={!sessionIdRef.current}
              title={
                sessionIdRef.current
                  ? isCurrentBookmarked
                    ? "しおりを外す"
                    : "しおりに追加"
                  : "比較後に履歴へ保存されると使えます"
              }
            >
              {isCurrentBookmarked ? "★ しおり済" : "☆ しおり"}
            </button>
          )}
          {compare && (
            <button type="button" onClick={exportCsv} title="差分を CSV で保存">
              CSV出力
            </button>
          )}
        </div>
        <div className="file-names">
          <span>{nameA || "A: 未選択"}</span>
          <span>{nameB || "B: 未選択"}</span>
        </div>
      </header>

      {loading && <div className="loading-banner">処理中…</div>}
      {imageOnlyMessage && (
        <div className="warn-banner" role="status">
          {imageOnlyMessage}
        </div>
      )}
      {proMessage && (
        <div className="pro-banner" role="status">
          {proMessage}
          {!isPro && (
            <span className="pro-banner-actions">
              <button type="button" onClick={openBoothStore}>
                Pro版を購入
              </button>
              <button type="button" onClick={() => void enterProPassword()}>
                Pro版パスワード
              </button>
            </span>
          )}
        </div>
      )}
      {error && <div className="error-banner">{error}</div>}

      {compare && (
        <div className="summary">
          差分 {compare.totalChanges} 文字 / ページ A:{compare.pageCountA} 枚 B:
          {compare.pageCountB} 枚 → 表示 {compare.rows.length} 組（一致率{" "}
          {matchThresholdPercent}% 以上で A 基準ペア）
        </div>
      )}

      <div className="main">
        <aside className="sidebar">
          {hasPreview && (
            <section className="sidebar-section sidebar-search">
              <h3>検索</h3>
              <input
                type="search"
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="文字列（全角半角・大小無視）"
                disabled={indexingText}
              />
              {indexingText && (
                <p className="hint">テキストを索引しています…</p>
              )}
              {searchQuery.trim() && !indexingText && searchHits.length === 0 && (
                <p className="hint">該当するページはありません。</p>
              )}
              {searchHits.length > 0 && (
                <ul className="search-hit-list">
                  {searchHits.map((hit) => (
                    <li key={hit.navId}>
                      <button
                        type="button"
                        className={navIndex === hit.navId ? "active" : ""}
                        onClick={() => setNavIndex(hit.navId)}
                      >
                        <span className="page-list-label">{hit.label}</span>
                        <span className="search-hit-counts">
                          {hit.countA > 0 && `A ${hit.countA}`}
                          {hit.countA > 0 && hit.countB > 0 && " · "}
                          {hit.countB > 0 && `B ${hit.countB}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <h2>ページ</h2>
          {compare ? (
            <ul className="page-list">
              {compare.rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={
                      navIndex === row.id
                        ? "active"
                        : searchHitNavIds.has(row.id)
                          ? "has-search-hit"
                          : ""
                    }
                    onClick={() => setNavIndex(row.id)}
                  >
                    <span className="page-list-label">
                      {bookmarkedRowIds.has(row.id) && (
                        <span className="page-bookmark-mark" title="しおり">
                          ★{" "}
                        </span>
                      )}
                      {row.label}
                    </span>
                    <span
                      className={
                        row.diff.changeCount > 0 || row.kind !== "match"
                          ? "has-diff"
                          : ""
                      }
                    >
                      {row.kind === "insert"
                        ? "追加"
                        : row.kind === "delete"
                          ? "削除"
                          : row.diff.changeCount > 0
                            ? `${row.diff.changeCount} 文字`
                            : "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : hasPreview ? (
            <ul className="page-list">
              {Array.from({ length: maxNav }, (_, i) => i + 1).map((pageNum) => (
                <li key={pageNum}>
                  <button
                    type="button"
                    className={
                      navIndex === pageNum
                        ? "active"
                        : searchHitNavIds.has(pageNum)
                          ? "has-search-hit"
                          : ""
                    }
                    onClick={() => setNavIndex(pageNum)}
                  >
                    <span className="page-list-label">
                      {docA && `A: ${pageNum}/${docA.numPages}`}
                      {docA && docB && " · "}
                      {docB && `B: ${pageNum}/${docB.numPages}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">2つの PDF を読み込むとプレビューが表示されます。</p>
          )}

          {bookmarks.length > 0 && (
            <section className="sidebar-section">
              <h3>しおり</h3>
              <ul className="bookmark-list">
                {bookmarks.map((bm) => (
                  <li key={bm.id}>
                    <button
                      type="button"
                      className={navIndex === bm.rowId ? "active" : ""}
                      onClick={() => setNavIndex(bm.rowId)}
                    >
                      <span>{bm.rowLabel}</span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="しおりを削除"
                      onClick={() => void removeBookmark(bm.id).then(refreshBookmarks)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <section className="viewers">
          {hasPreview ? (
            <>
              <div className="viewer-row">
                {docA && viewPageA != null && viewPageA <= docA.numPages ? (
                  <PdfPageViewer
                    doc={docA}
                    pageNumber={viewPageA}
                    scale={zoom}
                    highlights={mergedHighlightsA}
                    label="A（旧）"
                  />
                ) : (
                  <div className="page-missing">A: このページはありません</div>
                )}
                {docB && viewPageB != null && viewPageB <= docB.numPages ? (
                  <PdfPageViewer
                    doc={docB}
                    pageNumber={viewPageB}
                    scale={zoom}
                    highlights={mergedHighlightsB}
                    label="B（新）"
                  />
                ) : (
                  <div className="page-missing">B: このページはありません</div>
                )}
              </div>
              {(compare || searchQuery.trim()) && (
                <p className="legend">
                  {compare && (
                    <>
                      <span className="swatch delete" /> 削除（A）{" "}
                      <span className="swatch insert" /> 追加（B）{" "}
                    </>
                  )}
                  {searchQuery.trim() && (
                    <>
                      <span className="swatch search" /> 検索
                    </>
                  )}
                </p>
              )}
            </>
          ) : (
            <div className="placeholder">PDF を選択してください</div>
          )}
        </section>
      </div>
      <DownloadPromo />
      <CommissionFooter />
    </div>
  );
}
