/** 検索用: NFKC（全角半角統一）+ 英字は小文字化 */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

export interface NormalizedTextIndex {
  normalized: string;
  /** normalized の各コードユニット → 元テキストの文字インデックス */
  indexMap: number[];
}

export function buildNormalizedTextIndex(text: string): NormalizedTextIndex {
  const chars = [...text];
  const indexMap: number[] = [];
  let normalized = "";

  for (let i = 0; i < chars.length; i++) {
    const part = normalizeForSearch(chars[i]!);
    for (let j = 0; j < part.length; j++) {
      indexMap.push(i);
      normalized += part[j];
    }
  }

  return { normalized, indexMap };
}
