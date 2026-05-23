import { diffChars } from "diff";
import type { AlignedPageRow, CompareResult, PageText } from "./types";
import { diffPagePair } from "./diffPages";

export const DEFAULT_MATCH_THRESHOLD = 0.82;

/** 0〜1 の類似度（請求書ページの対応付け用） */
export function pageSimilarity(textA: string, textB: string): number {
  if (textA === textB) return 1;
  if (!textA || !textB) return 0;

  const parts = diffChars(textA, textB);
  let equal = 0;
  for (const p of parts) {
    if (!p.added && !p.removed) equal += p.value.length;
  }
  return (2 * equal) / (textA.length + textB.length);
}

function formatLabel(pageA: number | null, pageB: number | null): string {
  if (pageA != null && pageB != null) return `A p.${pageA} ↔ B p.${pageB}`;
  if (pageA != null) return `A p.${pageA}（Bに無し）`;
  return `B p.${pageB}（Aに無し）`;
}

/**
 * A の 1 ページ目から順に、まだ使っていない B のうち一致率が最も高いページとペアにする。
 * 最良でも一致率が閾値未満ならその A は未ペア（削除側）。残った B は追加側。
 */
export function alignAndComparePages(
  pagesA: PageText[],
  pagesB: PageText[],
  matchThreshold = DEFAULT_MATCH_THRESHOLD,
): AlignedPageRow[] {
  const threshold = Math.min(1, Math.max(0, matchThreshold));
  const usedB = new Set<number>();
  const pairs: { iA: number; iB: number }[] = [];

  for (let iA = 0; iA < pagesA.length; iA++) {
    let bestI = -1;
    let bestSim = -1;
    for (let iB = 0; iB < pagesB.length; iB++) {
      if (usedB.has(iB)) continue;
      const sim = pageSimilarity(pagesA[iA]!.text, pagesB[iB]!.text);
      if (sim > bestSim) {
        bestSim = sim;
        bestI = iB;
      }
    }
    if (bestI >= 0 && bestSim >= threshold) {
      usedB.add(bestI);
      pairs.push({ iA, iB: bestI });
    }
  }

  const pairedA = new Set(pairs.map((p) => p.iA));
  const unmatchedA = pagesA.map((_, i) => i).filter((i) => !pairedA.has(i));
  const unmatchedB = pagesB.map((_, i) => i).filter((i) => !usedB.has(i));

  const rows: AlignedPageRow[] = [];
  let id = 0;

  for (const { iA, iB } of pairs) {
    id++;
    const pageA = pagesA[iA]!;
    const pageB = pagesB[iB]!;
    const diff = diffPagePair(pageA, pageB);
    const kind: AlignedPageRow["kind"] =
      diff.changeCount > 0 ? "change" : "match";
    rows.push({
      id,
      pageA: pageA.pageNumber,
      pageB: pageB.pageNumber,
      kind,
      diff: {
        ...diff,
        pageA: pageA.pageNumber,
        pageB: pageB.pageNumber,
        kind,
      },
      label: formatLabel(pageA.pageNumber, pageB.pageNumber),
    });
  }

  for (const iA of unmatchedA) {
    id++;
    const pageA = pagesA[iA]!;
    const diff = diffPagePair(pageA, null);
    rows.push({
      id,
      pageA: pageA.pageNumber,
      pageB: null,
      kind: "delete",
      diff: {
        ...diff,
        pageA: pageA.pageNumber,
        pageB: null,
        kind: "delete",
      },
      label: formatLabel(pageA.pageNumber, null),
    });
  }

  for (const iB of unmatchedB) {
    id++;
    const pageB = pagesB[iB]!;
    const diff = diffPagePair(null, pageB);
    rows.push({
      id,
      pageA: null,
      pageB: pageB.pageNumber,
      kind: "insert",
      diff: {
        ...diff,
        pageA: null,
        pageB: pageB.pageNumber,
        kind: "insert",
      },
      label: formatLabel(null, pageB.pageNumber),
    });
  }

  return rows;
}

export function compareDocuments(
  pagesA: PageText[],
  pagesB: PageText[],
  matchThreshold = DEFAULT_MATCH_THRESHOLD,
): CompareResult {
  const rows = alignAndComparePages(pagesA, pagesB, matchThreshold);
  const totalChanges = rows.reduce((n, r) => n + r.diff.changeCount, 0);

  return {
    pageCountA: pagesA.length,
    pageCountB: pagesB.length,
    rows,
    totalChanges,
  };
}
