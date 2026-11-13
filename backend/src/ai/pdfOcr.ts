import "./pdfGlobals";
import { createCanvas } from "@napi-rs/canvas";
import Tesseract from "tesseract.js";
import { env } from "../config/env";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.js";

const MAX_PAGES = 10;
const RENDER_SCALE = 2.0;

// pdfjs calls this to rasterize embedded images; back it with @napi-rs/canvas
// so it never tries to require the native `canvas` package.
const canvasFactory = {
  create(width: number, height: number) {
    const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
    return { canvas, context: canvas.getContext("2d") };
  },
  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = Math.ceil(width);
    canvasAndContext.canvas.height = Math.ceil(height);
  },
  destroy(canvasAndContext: any) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  },
};

/** Rasterizes a (scanned) PDF to PNGs and OCRs each page. Returns concatenated text. */
export async function ocrPdfBuffer(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const doc = await getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    canvasFactory,
  }).promise;

  const pages = Math.min(doc.numPages || 1, MAX_PAGES);
  let out = "";

  for (let i = 1; i <= pages; i++) {
    try {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx as any, viewport }).promise;
      const png = canvas.toBuffer("image/png");
      const ocr = await Tesseract.recognize(png, env.ocrLanguages, { errorHandler: () => {} });
      if (ocr.data.text) out += ocr.data.text + "\n";
    } catch {
      // Skip unreadable pages; keep whatever text we already have.
    }
  }

  try { await doc.destroy?.(); } catch {}
  return out.trim();
}
