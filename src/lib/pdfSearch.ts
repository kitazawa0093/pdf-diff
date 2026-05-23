import { unionRects } from "./pdfExtract";
import { buildNormalizedTextIndex, normalizeForSearch } from "./textNormalize";
import type { CharBox, HighlightRect, PageText } from "./types";

export interface PageSearchHit {
  /** ナビ用 id（比較行 id またはプレビュー時のページ番号） */
  navId: number;
  label: string;
  countA: number;
  countB: number;
}

export interface SearchRange {
  start: number;
  end: number;
}

function findRangesInPage(page: PageText, normalizedQuery: string): SearchRange[] {
  if (!normalizedQuery) return [];

  const { normalized, indexMap } = buildNormalizedTextIndex(page.text);
  const ranges: SearchRange[] = [];
  let from = 0;

  while (from <= normalized.length - normalizedQuery.length) {
    const at = normalized.indexOf(normalizedQuery, from);
    if (at < 0) break;

    const normEnd = at + normalizedQuery.length;
    const start = indexMap[at] ?? 0;
    const end = (indexMap[normEnd - 1] ?? start) + 1;
    ranges.push({ start, end });
    from = at + 1;
  }

  return ranges;
}

export function countMatchesInPage(
  page: PageText | null | undefined,
  query: string,
): number {
  if (!page || !query.trim()) return 0;
  const nq = normalizeForSearch(query.trim());
  return findRangesInPage(page, nq).length;
}

export function searchHighlightsForPage(
  page: PageText | null | undefined,
  query: string,
): HighlightRect[] {
  if (!page || !query.trim()) return [];
  const nq = normalizeForSearch(query.trim());
  const ranges = findRangesInPage(page, nq);
  const highlights: HighlightRect[] = [];

  for (const { start, end } of ranges) {
    const boxes = page.chars.slice(start, end);
    let group: CharBox[] = [];

    const flush = () => {
      const rect = unionRects(group.map((c) => c.rect));
      if (rect) highlights.push({ rect, kind: "search" });
      group = [];
    };

    for (let i = 0; i < boxes.length; i++) {
      const cur = boxes[i]!;
      if (group.length === 0) {
        group.push(cur);
        continue;
      }
      const prev = group[group.length - 1]!;
      const hGap = cur.rect.x - (prev.rect.x + prev.rect.width);
      const gap =
        hGap > Math.max(4, prev.rect.height * 0.15) ||
        Math.abs(cur.rect.y - prev.rect.y) > prev.rect.height * 0.5;
      if (gap) {
        flush();
        group.push(cur);
      } else {
        group.push(cur);
      }
    }
    flush();
  }

  return highlights;
}

export function searchAlignedRows(input: {
  query: string;
  rows: { id: number; label: string; pageA: number | null; pageB: number | null }[];
  pagesA: PageText[];
  pagesB: PageText[];
}): PageSearchHit[] {
  const q = input.query.trim();
  if (!q) return [];

  const hits: PageSearchHit[] = [];
  for (const row of input.rows) {
    const pageA = row.pageA
      ? input.pagesA.find((p) => p.pageNumber === row.pageA)
      : undefined;
    const pageB = row.pageB
      ? input.pagesB.find((p) => p.pageNumber === row.pageB)
      : undefined;
    const countA = countMatchesInPage(pageA, q);
    const countB = countMatchesInPage(pageB, q);
    if (countA > 0 || countB > 0) {
      hits.push({
        navId: row.id,
        label: row.label,
        countA,
        countB,
      });
    }
  }
  return hits;
}

export function searchPreviewPages(input: {
  query: string;
  maxNav: number;
  pagesA: PageText[];
  pagesB: PageText[];
  hasA: boolean;
  hasB: boolean;
}): PageSearchHit[] {
  const q = input.query.trim();
  if (!q) return [];

  const hits: PageSearchHit[] = [];
  for (let navId = 1; navId <= input.maxNav; navId++) {
    const pageA = input.hasA ? input.pagesA.find((p) => p.pageNumber === navId) : undefined;
    const pageB = input.hasB ? input.pagesB.find((p) => p.pageNumber === navId) : undefined;
    const countA = countMatchesInPage(pageA, q);
    const countB = countMatchesInPage(pageB, q);
    if (countA > 0 || countB > 0) {
      const parts: string[] = [];
      if (input.hasA) parts.push(`A p.${navId}`);
      if (input.hasB) parts.push(`B p.${navId}`);
      hits.push({
        navId,
        label: parts.join(" · "),
        countA,
        countB,
      });
    }
  }
  return hits;
}
