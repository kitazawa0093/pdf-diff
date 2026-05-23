import type { PDFDocumentProxy } from "pdfjs-dist";

/** 無料版で比較・プレビューできる最大ページ数 */
export const FREE_PAGE_LIMIT = 3;

import { getBoothStoreUrl } from "./distribution";

export const BOOTH_STORE_URL = getBoothStoreUrl();

export function docExceedsFreeLimit(doc: PDFDocumentProxy): boolean {
  return doc.numPages > FREE_PAGE_LIMIT;
}

export function workspaceNeedsPro(
  docA: PDFDocumentProxy | null,
  docB: PDFDocumentProxy | null,
  isPro: boolean,
): boolean {
  if (isPro) return false;
  return Boolean(
    (docA && docExceedsFreeLimit(docA)) || (docB && docExceedsFreeLimit(docB)),
  );
}

export function proRequiredMessage(
  docA: PDFDocumentProxy | null,
  docB: PDFDocumentProxy | null,
  isPro: boolean,
): string | null {
  if (isPro || !workspaceNeedsPro(docA, docB, isPro)) return null;
  const parts: string[] = [];
  if (docA && docExceedsFreeLimit(docA)) {
    parts.push(`PDF A（旧）は ${docA.numPages} ページ`);
  }
  if (docB && docExceedsFreeLimit(docB)) {
    parts.push(`PDF B（新）は ${docB.numPages} ページ`);
  }
  const who = parts.join("、");
  return `${who}です。無料版は ${FREE_PAGE_LIMIT} ページまでです。Pro版（パスワード入力）で全ページを比較できます。`;
}

/** 無料制限時のナビ・プレビュー上限 */
export function effectivePreviewMaxNav(
  docA: PDFDocumentProxy | null,
  docB: PDFDocumentProxy | null,
  isPro: boolean,
): number {
  const a = docA?.numPages ?? 0;
  const b = docB?.numPages ?? 0;
  const natural = Math.max(a, b, 1);
  if (isPro || !workspaceNeedsPro(docA, docB, isPro)) return natural;
  return Math.min(natural, FREE_PAGE_LIMIT);
}
