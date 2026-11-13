import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

const g = globalThis as any;
g.DOMMatrix = g.DOMMatrix ?? DOMMatrix;
g.ImageData = g.ImageData ?? ImageData;
g.Path2D = g.Path2D ?? Path2D;
