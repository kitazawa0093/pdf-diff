import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfjs, pdfDocumentInit } from "./pdfSetup";

/** pdf.js が worker へ転送すると元の ArrayBuffer が detach されるため、保存用に別コピーが必要 */
export function cloneArrayBuffer(buffer: ArrayBuffer): ArrayBuffer {
  return buffer.slice(0);
}

export async function loadPdfFromArrayBuffer(
  buffer: ArrayBuffer,
): Promise<PDFDocumentProxy> {
  // worker 転送で buffer が detach されないよう、表示用はコピーだけ渡す
  const data = new Uint8Array(cloneArrayBuffer(buffer));
  const loadingTask = pdfjs.getDocument({
    data,
    ...pdfDocumentInit,
  });
  return loadingTask.promise;
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}
