import { Util } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { CharBox, PageText, PdfRect } from "./types";
import { charWidthsForString, getFontAscentRatio } from "./textMeasure";

/** 抽出時の基準スケール（表示時に掛け合わせる） */
export const EXTRACT_SCALE = 1;

const Y_TOLERANCE = 3;
const DESCENT_RATIO = 0.12;

type PdfTextStyle = {
  fontFamily: string;
  vertical?: boolean;
  fontSubstitution?: string;
};

function sortReadingOrder(chars: CharBox[]): CharBox[] {
  return [...chars].sort((a, b) => {
    const yDiff = a.rect.y - b.rect.y;
    if (Math.abs(yDiff) > Y_TOLERANCE) return yDiff;
    return a.rect.x - b.rect.x;
  });
}

function itemToCharBoxes(
  str: string,
  x: number,
  y: number,
  height: number,
  charWidths: number[],
  startIndex: number,
): CharBox[] {
  const chars = [...str];
  let cursorX = x;
  const boxes: CharBox[] = [];

  for (let i = 0; i < chars.length; i++) {
    const w = charWidths[i] ?? 0;
    boxes.push({
      char: chars[i]!,
      index: startIndex + i,
      rect: { x: cursorX, y, width: w, height },
    });
    cursorX += w;
  }

  return boxes;
}

interface ItemGeom {
  str: string;
  x: number;
  y: number;
  lineKey: number;
  advanceWidth: number;
  fontHeight: number;
  fontAscent: number;
  fontDescent: number;
  fontFamily: string;
  startIndex: number;
  vertical: boolean;
}

function lineKeyFromY(y: number): number {
  return Math.round(y / Y_TOLERANCE);
}

/**
 * 同一行の次のテキスト開始位置までで幅を補正（表組み PDF でズレやすい部分）
 */
function refineAdvanceWidths(geoms: ItemGeom[]): void {
  const byLine = new Map<number, ItemGeom[]>();
  for (const g of geoms) {
    if (g.vertical) continue;
    const list = byLine.get(g.lineKey) ?? [];
    list.push(g);
    byLine.set(g.lineKey, list);
  }

  for (const line of byLine.values()) {
    line.sort((a, b) => a.x - b.x);
    for (let i = 0; i < line.length - 1; i++) {
      const cur = line[i]!;
      const next = line[i + 1]!;
      const gap = next.x - cur.x;
      if (gap <= 0) continue;
      const maxReasonable = Math.max(cur.advanceWidth * 1.25, cur.fontHeight * 0.5);
      if (gap <= maxReasonable) {
        cur.advanceWidth = gap;
      }
    }
  }
}

function resolveFontFamily(style: PdfTextStyle | undefined): string {
  if (!style) return "sans-serif";
  const sub = (style as { fontSubstitution?: string }).fontSubstitution;
  return sub || style.fontFamily || "sans-serif";
}

function extractItemGeom(
  item: {
    str: string;
    transform: number[];
    width: number;
    height: number;
    fontName: string;
  },
  viewportTransform: number[],
  styles: Record<string, PdfTextStyle>,
  startIndex: number,
): ItemGeom {
  const tx = Util.transform(viewportTransform, item.transform);
  const style = styles[item.fontName];
  const vertical = Boolean(style?.vertical);
  const fontHeight = Math.hypot(tx[2], tx[3]) || 12;
  const fontFamily = resolveFontFamily(style);
  const ascentRatio = getFontAscentRatio(fontFamily);
  const fontAscent = fontHeight * ascentRatio;
  const fontDescent = fontHeight * DESCENT_RATIO;

  const angle = Math.atan2(tx[1], tx[0]);
  let x = tx[4];
  let y = tx[5] - fontAscent;
  if (Math.abs(angle) > 0.01) {
    x = tx[4] + fontAscent * Math.sin(angle);
    y = tx[5] - fontAscent * Math.cos(angle);
  }

  const advanceWidth = Math.max(vertical ? item.height : item.width, 0);

  return {
    str: item.str,
    x,
    y,
    lineKey: lineKeyFromY(y),
    advanceWidth,
    fontHeight,
    fontAscent,
    fontDescent,
    fontFamily,
    startIndex,
    vertical,
  };
}

function geomToCharBoxes(geom: ItemGeom): CharBox[] {
  const height = geom.fontAscent + geom.fontDescent;
  const charWidths = charWidthsForString(
    geom.str,
    geom.advanceWidth,
    geom.fontHeight,
    geom.fontFamily,
  );
  return itemToCharBoxes(
    geom.str,
    geom.x,
    geom.y,
    height,
    charWidths,
    geom.startIndex,
  );
}

/**
 * pdf.js TextLayer と同様に viewport 座標（左上原点）で bbox を取る。
 */
export async function extractPageText(
  doc: PDFDocumentProxy,
  pageNumber: number,
): Promise<PageText> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: EXTRACT_SCALE });
  const textContent = await page.getTextContent();

  const geoms: ItemGeom[] = [];
  let index = 0;

  for (const item of textContent.items) {
    if (!("str" in item) || !item.str) continue;
    geoms.push(
      extractItemGeom(
        item,
        viewport.transform,
        textContent.styles as Record<string, PdfTextStyle>,
        index,
      ),
    );
    index += item.str.length;
  }

  refineAdvanceWidths(geoms);

  const raw: CharBox[] = [];
  for (const geom of geoms) {
    raw.push(...geomToCharBoxes(geom));
  }

  const chars = sortReadingOrder(raw).map((c, i) => ({ ...c, index: i }));
  const text = chars.map((c) => c.char).join("");

  return { pageNumber, chars, text };
}

export async function extractAllPages(
  doc: PDFDocumentProxy,
  maxPages?: number,
): Promise<PageText[]> {
  const end = Math.min(
    doc.numPages,
    maxPages != null ? Math.max(1, maxPages) : doc.numPages,
  );
  const pages: PageText[] = [];
  for (let i = 1; i <= end; i++) {
    pages.push(await extractPageText(doc, i));
  }
  return pages;
}

export function unionRects(rects: PdfRect[]): PdfRect | null {
  if (rects.length === 0) return null;
  const xs = rects.map((r) => r.x);
  const ys = rects.map((r) => r.y);
  const rights = rects.map((r) => r.x + r.width);
  const bottoms = rects.map((r) => r.y + r.height);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const right = Math.max(...rights);
  const bottom = Math.max(...bottoms);
  return { x, y, width: right - x, height: bottom - y };
}
