/**
 * Composes a screen's content onto a canvas: desktop chrome + windows for displays, a
 * touch shell for touch screens, plus the variants the spatial workspace needs (single
 * pane cards, the dark backdrop and the touch control surface).
 */
import type { ScreenContent, ScreenDefinition } from '@/products/schema';
import { drawApp, type AppId } from './apps';
import { circle, clipTo, fillRound, rect, seeded, type Rect } from './draw';
import { layoutPanes, type Pane } from './layouts';
import { drawBars, drawWallpaper, drawWindowChrome, osStyles, workArea } from './os';
import { palette } from './palette';
import { workflows } from './workflows';

/** What one screen renders; equal specs produce identical pixels. */
export interface ScreenSpec {
  widthPx: number;
  heightPx: number;
  kind: ScreenDefinition['kind'];
  content: ScreenContent;
}

export const specKey = (spec: ScreenSpec) => JSON.stringify(spec);

const specCache = new Map<string, ScreenSpec>();

/**
 * Returns one shared object per distinct spec so React effects and memos keyed on the
 * spec only re-run when the content actually changes, not on every store update.
 */
export function internSpec(spec: ScreenSpec): ScreenSpec {
  const key = specKey(spec);
  const cached = specCache.get(key);
  if (cached) return cached;
  specCache.set(key, spec);
  return spec;
}

/** Longest texture side; the declared pixel size only sets the aspect ratio. */
const MAX_TEXTURE_SIDE = 1920;

export function textureSize(spec: Pick<ScreenSpec, 'widthPx' | 'heightPx'>): {
  w: number;
  h: number;
} {
  const scale = Math.min(1, MAX_TEXTURE_SIDE / Math.max(spec.widthPx, spec.heightPx));
  return { w: Math.round(spec.widthPx * scale), h: Math.round(spec.heightPx * scale) };
}

/** Scale unit: 1 at 1080 px on the short side. Touch UIs draw larger. */
function unitFor(w: number, h: number, kind: ScreenSpec['kind']) {
  return (Math.min(w, h) / 1080) * (kind === 'touch' ? 1.5 : 1);
}

/** Panes of a spec in normalised screen coordinates (work area already applied). */
export function screenPanes(spec: ScreenSpec): Pane[] {
  const { w, h } = textureSize(spec);
  const u = unitFor(w, h, spec.kind);
  const area = spec.kind === 'touch' ? touchArea(w, h, u) : workArea(w, h, spec.content.os, u);
  return layoutPanes(spec.content.layout, spec.kind === 'touch' ? 0.02 : 0.014).map((pane) => ({
    ...pane,
    x: (area.x + pane.x * area.w) / w,
    y: (area.y + pane.y * area.h) / h,
    w: (pane.w * area.w) / w,
    h: (pane.h * area.h) / h,
  }));
}

export interface PaneContent {
  pane: Pane;
  app: AppId;
}

/** Each pane with its app: the main pane gets the workflow's first app, the others follow. */
export function assignApps(spec: ScreenSpec): PaneContent[] {
  const workflow = workflows[spec.content.workflow];
  const list = spec.kind === 'touch' ? workflow.touchApps : workflow.apps;
  const first = list[0];
  if (first === undefined) throw new Error(`workflow "${spec.content.workflow}" has no apps`);
  let next = 1;
  return screenPanes(spec).map((pane) => {
    if (pane.role === 'main') return { pane, app: first };
    const app = list[next % list.length] ?? first;
    next += 1;
    return { pane, app };
  });
}

function touchArea(w: number, h: number, u: number): Rect {
  return rect(20 * u, 34 * u, w - 40 * u, h - 34 * u - 40 * u);
}

function context(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

const paneRect = (pane: Pane, w: number, h: number): Rect =>
  rect(pane.x * w, pane.y * h, pane.w * w, pane.h * h);

/** Light touch shell: status strip, rounded panels, home pill. */
function drawTouchShell(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: ScreenSpec,
  u: number,
) {
  drawWallpaper(ctx, w, h, spec.content.os);
  ctx.fillStyle = 'rgba(244, 244, 246, 0.82)';
  ctx.fillRect(0, 0, w, h);
  fillRound(ctx, rect(20 * u, 12 * u, 60 * u, 10 * u), 5 * u, palette.text);
  for (let i = 0; i < 3; i += 1)
    circle(ctx, w - (28 + i * 22) * u, 17 * u, 5 * u, palette.textMuted);
  fillRound(ctx, rect(w / 2 - 60 * u, h - 22 * u, 120 * u, 8 * u), 4 * u, palette.textMuted);
}

/** Rounded touch panels, light on the flat touch shell or dark on the control surface. */
function drawTouchPanes(
  ctx: CanvasRenderingContext2D,
  contents: readonly PaneContent[],
  w: number,
  h: number,
  u: number,
  dark: boolean,
) {
  contents.forEach(({ pane, app }, i) => {
    const r = paneRect(pane, w, h);
    ctx.save();
    ctx.shadowColor = dark ? 'rgba(143, 179, 234, 0.35)' : 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = (dark ? 30 : 20) * u;
    fillRound(ctx, r, 22 * u, dark ? palette.darkPanel : palette.window);
    ctx.restore();
    clipTo(ctx, r, 22 * u);
    drawApp({ ctx, u, rand: seeded(i + 1), dark }, app, r);
    ctx.restore();
  });
}

/** Renders the whole screen for the flat (non-spatial) view. */
export function renderScreen(canvas: HTMLCanvasElement, spec: ScreenSpec) {
  const { w, h } = textureSize(spec);
  const ctx = context(canvas, w, h);
  const u = unitFor(w, h, spec.kind);
  const contents = assignApps(spec);

  if (spec.kind === 'touch') {
    drawTouchShell(ctx, w, h, spec, u);
    drawTouchPanes(ctx, contents, w, h, u, false);
    return;
  }

  const os = spec.content.os;
  drawWallpaper(ctx, w, h, os);
  contents.forEach(({ pane, app }, i) => {
    const r = paneRect(pane, w, h);
    const content = drawWindowChrome(ctx, r, os, u, false);
    clipTo(ctx, r, osStyles[os].windowRadius * u);
    drawApp({ ctx, u, rand: seeded(i + 1), dark: false }, app, content);
    ctx.restore();
  });
  drawBars(ctx, w, h, os, u);
}

/** Renders one pane as a free-floating card (rounded, transparent outside) for the 3D view. */
export function renderPaneCard(
  canvas: HTMLCanvasElement,
  spec: ScreenSpec,
  paneIndex: number,
  w: number,
  h: number,
) {
  const ctx = context(canvas, w, h);
  ctx.clearRect(0, 0, w, h);
  const full = textureSize(spec);
  const u = unitFor(full.w, full.h, spec.kind);
  const app = assignApps(spec)[paneIndex]?.app;
  if (app === undefined) return;
  const r = rect(0, 0, w, h);
  clipTo(ctx, r, osStyles[spec.content.os].windowRadius * u);
  const content = drawWindowChrome(ctx, r, spec.content.os, u, true);
  drawApp({ ctx, u, rand: seeded(paneIndex + 1), dark: true }, app, content);
  ctx.restore();
}

/** Dark spatial background that replaces the desktop while panes float in front of it. */
export function renderSpatialBackdrop(canvas: HTMLCanvasElement, w: number, h: number) {
  const ctx = context(canvas, w, h);
  const u = Math.min(w, h) / 1080;
  const base = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, Math.max(w, h) * 0.75);
  base.addColorStop(0, '#1c2030');
  base.addColorStop(1, '#0b0c11');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(143, 179, 234, 0.16)';
  const step = 48 * u;
  for (let y = step / 2; y < h; y += step)
    for (let x = step / 2; x < w; x += step) ctx.fillRect(x - u, y - u, 2 * u, 2 * u);
  const horizon = ctx.createLinearGradient(0, h * 0.7, 0, h);
  horizon.addColorStop(0, 'rgba(143, 179, 234, 0)');
  horizon.addColorStop(1, 'rgba(143, 179, 234, 0.22)');
  ctx.fillStyle = horizon;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
}

/** The touch screen as a dark control surface for the spatial workspace. */
export function renderControlSurface(canvas: HTMLCanvasElement, spec: ScreenSpec) {
  const { w, h } = textureSize(spec);
  const ctx = context(canvas, w, h);
  const u = unitFor(w, h, 'touch');
  renderSpatialBackdrop(canvas, w, h);
  fillRound(ctx, rect(20 * u, 12 * u, 60 * u, 10 * u), 5 * u, palette.darkText);
  for (let i = 0; i < 3; i += 1) circle(ctx, w - (28 + i * 22) * u, 17 * u, 5 * u, palette.glow);
  drawTouchPanes(ctx, assignApps({ ...spec, kind: 'touch' }), w, h, u, true);
}
