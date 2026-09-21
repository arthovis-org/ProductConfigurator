/** Small canvas helpers shared by the screen renderers. All sizes are in canvas pixels. */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  /** Scale unit: 1 at 1080 px on the short side, so strokes stay proportional per screen. */
  u: number;
  /** Deterministic pseudo-random numbers in [0, 1), seeded per pane. */
  rand: () => number;
  /** Draw on dark surfaces (spatial cards, control surface). */
  dark: boolean;
}

/** Linear congruential generator; the same seed always yields the same mockup. */
export function seeded(seed: number): () => number {
  let state = (seed * 1103515245 + 12345) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export function inset(r: Rect, dx: number, dy = dx): Rect {
  return { x: r.x + dx, y: r.y + dy, w: Math.max(0, r.w - 2 * dx), h: Math.max(0, r.h - 2 * dy) };
}

/** Splits a rect into `n` rows (or columns) separated by `gap`. */
export function splitRows(r: Rect, n: number, gap: number): Rect[] {
  const h = (r.h - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => rect(r.x, r.y + i * (h + gap), r.w, h));
}
export function splitCols(r: Rect, n: number, gap: number): Rect[] {
  const w = (r.w - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => rect(r.x + i * (w + gap), r.y, w, r.h));
}

/** Takes `size` from the top (or left) of a rect; returns [taken, rest]. */
export function takeTop(r: Rect, size: number, gap = 0): [Rect, Rect] {
  return [rect(r.x, r.y, r.w, size), rect(r.x, r.y + size + gap, r.w, r.h - size - gap)];
}
export function takeLeft(r: Rect, size: number, gap = 0): [Rect, Rect] {
  return [rect(r.x, r.y, size, r.h), rect(r.x + size + gap, r.y, r.w - size - gap, r.h)];
}

export function roundRectPath(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  const rad = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
}

export type Paint = string | CanvasGradient;

export function fill(ctx: CanvasRenderingContext2D, r: Rect, paint: Paint) {
  ctx.fillStyle = paint;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

export function fillRound(ctx: CanvasRenderingContext2D, r: Rect, radius: number, fill: Paint) {
  roundRectPath(ctx, r, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeRound(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  radius: number,
  stroke: string,
  width: number,
) {
  roundRectPath(ctx, r, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: Paint,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

interface TextBarsOptions {
  /** Bar height in px. */
  size: number;
  /** Vertical distance between bar tops in px. */
  step: number;
  color: string;
  /** Width range as a fraction of the rect width. */
  minWidth?: number;
  maxWidth?: number;
  /** Indent every bar by this many px times a random 0–3 (code-like). */
  indentStep?: number;
  /** Insert a blank line roughly this often (0 disables). */
  paragraphEvery?: number;
  maxLines?: number;
}

/** Rows of rounded bars that stand in for text; keeps the mockups free of real copy. */
export function textBars(d: DrawContext, r: Rect, options: TextBarsOptions) {
  const {
    size,
    step,
    color,
    minWidth = 0.45,
    maxWidth = 1,
    indentStep = 0,
    paragraphEvery = 0,
    maxLines = Infinity,
  } = options;
  let y = r.y;
  let lines = 0;
  let sinceBreak = 0;
  while (y + size <= r.y + r.h && lines < maxLines) {
    if (paragraphEvery > 0 && sinceBreak >= paragraphEvery && d.rand() < 0.5) {
      sinceBreak = 0;
      y += step;
      continue;
    }
    const indent = indentStep * Math.floor(d.rand() * 4);
    const width = Math.max(size, (minWidth + d.rand() * (maxWidth - minWidth)) * r.w - indent);
    fillRound(d.ctx, rect(r.x + indent, y, width, size), size / 2, color);
    y += step;
    lines += 1;
    sinceBreak += 1;
  }
}

/** Clips subsequent drawing to `r`; call `ctx.restore()` afterwards. */
export function clipTo(ctx: CanvasRenderingContext2D, r: Rect, radius = 0) {
  ctx.save();
  roundRectPath(ctx, r, radius);
  ctx.clip();
}
