import type { PDFDocumentProxy } from "pdfjs-dist";

/** この文字数未満（空白除く）なら画像中心 PDF とみなす */
export const MIN_EXTRACTABLE_TEXT_CHARS = 1;

export async function isImageOnlyPdf(doc: PDFDocumentProxy): Promise<boolean> {
  let total = 0;
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      if (!("str" in item) || !item.str) continue;
      total += item.str.replace(/\s/g, "").length;
      if (total >= MIN_EXTRACTABLE_TEXT_CHARS) return false;
    }
  }
  return true;
}

export function imageOnlyCompareMessage(
  imageOnlyA: boolean,
  imageOnlyB: boolean,
): string | null {
  if (!imageOnlyA && !imageOnlyB) return null;
  if (imageOnlyA && imageOnlyB) {
    return "PDF A・B は画像データのため比較できません。テキストが埋め込まれた PDF をご利用ください。";
  }
  if (imageOnlyA) {
    return "PDF A（旧）は画像データのため比較できません。テキストが埋め込まれた PDF をご利用ください。";
  }
  return "PDF B（新）は画像データのため比較できません。テキストが埋め込まれた PDF をご利用ください。";
}
