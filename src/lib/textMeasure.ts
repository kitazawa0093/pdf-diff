let measureCtx: CanvasRenderingContext2D | null = null;

const ascentCache = new Map<string, number>();

function getCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const canvas = document.createElement("canvas");
    measureCtx = canvas.getContext("2d")!;
  }
  return measureCtx;
}

/** pdf.js TextLayer と同様にフォントごとの ascent 比率を求める */
export function getFontAscentRatio(fontFamily: string): number {
  const cached = ascentCache.get(fontFamily);
  if (cached !== undefined) return cached;

  const ctx = getCtx();
  const size = 30;
  ctx.font = `${size}px ${fontFamily}`;
  const metrics = ctx.measureText("");
  let ascent = metrics.fontBoundingBoxAscent;
  let descent = Math.abs(metrics.fontBoundingBoxDescent);
  if (ascent) {
    const ratio = ascent / (ascent + descent);
    ascentCache.set(fontFamily, ratio);
    return ratio;
  }

  ascentCache.set(fontFamily, 0.8);
  return 0.8;
}

export function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
): number {
  if (!text) return 0;
  const ctx = getCtx();
  ctx.font = `${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

/** 全角・半角などの見かけ幅（CJK 請求書向け） */
function charWidthWeight(ch: string, fontSize: number, fontFamily: string): number {
  if (ch === "\u3000") return fontSize;
  if (ch === " ") return fontSize * 0.28;
  const cp = ch.codePointAt(0) ?? 0;
  if (
    (cp >= 0x3000 && cp <= 0x9fff) ||
    (cp >= 0xff00 && cp <= 0xffef) ||
    (cp >= 0x3400 && cp <= 0x4dbf)
  ) {
    return fontSize;
  }
  const ctx = getCtx();
  ctx.font = `${fontSize}px ${fontFamily}`;
  const w = ctx.measureText(ch).width;
  return w > 0 ? w : fontSize * 0.5;
}

/** 合計が totalWidth になるよう、文字ごとの幅を配分する */
export function charWidthsForString(
  text: string,
  totalWidth: number,
  fontSize: number,
  fontFamily: string,
): number[] {
  const chars = [...text];
  if (chars.length === 0) return [];
  if (chars.length === 1) return [Math.max(totalWidth, 0)];

  const raw = chars.map((ch) => charWidthWeight(ch, fontSize, fontFamily));
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const even = totalWidth / chars.length;
    return chars.map(() => even);
  }

  const scale = totalWidth / sum;
  return raw.map((w) => w * scale);
}
