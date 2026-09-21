/**
 * Abstract desktop chrome per OS style: wallpaper gradient, where the bar lives (dock,
 * taskbar, top panel or shelf) and how windows look. Deliberately generic so nothing here
 * copies a real operating system's assets.
 */
import type { OsId } from '@/products/schema';
import { circle, fillRound, inset, rect, roundRectPath, type Rect } from './draw';
import { palette, tokenColors } from './palette';

export interface OsStyle {
  wallpaper: [string, string, string];
  bar: 'dock-bottom' | 'taskbar-bottom' | 'panel-top' | 'shelf-bottom';
  /** Space the bars take at the top and bottom edges, in unit px. */
  bars: { top: number; bottom: number };
  /** Window corner radius in unit px. */
  windowRadius: number;
  /** Title bar height in unit px. */
  titleHeight: number;
  controls: 'left' | 'right';
  controlShape: 'circle' | 'square';
}

export const osStyles: Record<OsId, OsStyle> = {
  mac: {
    wallpaper: ['#5d7fbf', '#9fb3d8', '#e7cfd4'],
    bar: 'dock-bottom',
    bars: { top: 26, bottom: 76 },
    windowRadius: 12,
    titleHeight: 34,
    controls: 'left',
    controlShape: 'circle',
  },
  windows: {
    wallpaper: ['#24508f', '#4b84c6', '#8dbde6'],
    bar: 'taskbar-bottom',
    bars: { top: 0, bottom: 48 },
    windowRadius: 8,
    titleHeight: 32,
    controls: 'right',
    controlShape: 'square',
  },
  linux: {
    wallpaper: ['#33364f', '#6a5a91', '#c9748f'],
    bar: 'panel-top',
    bars: { top: 32, bottom: 0 },
    windowRadius: 10,
    titleHeight: 36,
    controls: 'right',
    controlShape: 'circle',
  },
  chromeos: {
    wallpaper: ['#2f8a80', '#7cc2b4', '#ecdca6'],
    bar: 'shelf-bottom',
    bars: { top: 0, bottom: 50 },
    windowRadius: 14,
    titleHeight: 32,
    controls: 'right',
    controlShape: 'square',
  },
};

export function drawWallpaper(ctx: CanvasRenderingContext2D, w: number, h: number, os: OsId) {
  const [a, b, c] = osStyles[os].wallpaper;
  const gradient = ctx.createLinearGradient(0, h, w, 0);
  gradient.addColorStop(0, a);
  gradient.addColorStop(0.55, b);
  gradient.addColorStop(1, c);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(
    w * 0.7,
    h * 0.3,
    0,
    w * 0.7,
    h * 0.3,
    Math.max(w, h) * 0.6,
  );
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

/** The area windows may occupy: the screen minus bars and a margin. */
export function workArea(w: number, h: number, os: OsId, u: number): Rect {
  const { bars } = osStyles[os];
  const margin = 18 * u;
  return rect(
    margin,
    bars.top * u + margin,
    w - 2 * margin,
    h - (bars.top + bars.bottom) * u - 2 * margin,
  );
}

function iconRow(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  count: number,
  gap: number,
  radius: number,
) {
  const size = r.h;
  const total = count * size + (count - 1) * gap;
  let x = r.x + (r.w - total) / 2;
  for (let i = 0; i < count; i += 1) {
    fillRound(
      ctx,
      rect(x, r.y, size, size),
      radius,
      tokenColors[i % tokenColors.length] ?? palette.accent,
    );
    x += size + gap;
  }
}

/** Dock / taskbar / panel / shelf, drawn over the windows. */
export function drawBars(ctx: CanvasRenderingContext2D, w: number, h: number, os: OsId, u: number) {
  const style = osStyles[os];
  const light = 'rgba(255, 255, 255, 0.72)';
  const dark = 'rgba(18, 19, 28, 0.86)';
  switch (style.bar) {
    case 'dock-bottom': {
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, w, 26 * u);
      fillRound(ctx, rect(14 * u, 8 * u, 40 * u, 10 * u), 5 * u, palette.text);
      for (let i = 0; i < 4; i += 1)
        fillRound(ctx, rect((66 + i * 58) * u, 8 * u, 44 * u, 10 * u), 5 * u, palette.textMuted);
      for (let i = 0; i < 3; i += 1)
        circle(ctx, w - (22 + i * 26) * u, 13 * u, 5 * u, palette.textMuted);
      const dockW = Math.min(w * 0.46, 7 * 52 * u + 6 * 12 * u + 28 * u);
      const dock = rect((w - dockW) / 2, h - 70 * u, dockW, 62 * u);
      fillRound(ctx, dock, 16 * u, light);
      iconRow(ctx, inset(dock, 14 * u, 8 * u), 7, 12 * u, 11 * u);
      break;
    }
    case 'taskbar-bottom': {
      ctx.fillStyle = light;
      ctx.fillRect(0, h - 48 * u, w, 48 * u);
      iconRow(ctx, rect(w * 0.3, h - 38 * u, w * 0.4, 28 * u), 6, 16 * u, 6 * u);
      fillRound(ctx, rect(w - 150 * u, h - 34 * u, 100 * u, 20 * u), 6 * u, 'rgba(0,0,0,0.12)');
      break;
    }
    case 'panel-top': {
      ctx.fillStyle = dark;
      ctx.fillRect(0, 0, w, 32 * u);
      fillRound(ctx, rect(14 * u, 9 * u, 72 * u, 14 * u), 7 * u, 'rgba(255,255,255,0.75)');
      fillRound(ctx, rect(w / 2 - 40 * u, 9 * u, 80 * u, 14 * u), 7 * u, 'rgba(255,255,255,0.75)');
      for (let i = 0; i < 4; i += 1)
        circle(ctx, w - (20 + i * 22) * u, 16 * u, 5 * u, 'rgba(255,255,255,0.65)');
      break;
    }
    case 'shelf-bottom': {
      ctx.fillStyle = light;
      ctx.fillRect(0, h - 50 * u, w, 50 * u);
      circle(ctx, 30 * u, h - 25 * u, 14 * u, palette.text);
      circle(ctx, 30 * u, h - 25 * u, 6 * u, light);
      iconRow(ctx, rect(60 * u, h - 39 * u, 6 * 40 * u, 28 * u), 6, 12 * u, 8 * u);
      fillRound(ctx, rect(w - 120 * u, h - 36 * u, 100 * u, 22 * u), 11 * u, 'rgba(0,0,0,0.12)');
      break;
    }
  }
}

/**
 * Draws a window frame with shadow, title bar and controls; returns the content rect.
 * `dark` styles the frame for the spatial workspace cards.
 */
export function drawWindowChrome(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  os: OsId,
  u: number,
  dark: boolean,
): Rect {
  const style = osStyles[os];
  const radius = style.windowRadius * u;
  const title = style.titleHeight * u;

  ctx.save();
  ctx.shadowColor = dark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = 28 * u;
  ctx.shadowOffsetY = 10 * u;
  fillRound(ctx, r, radius, dark ? palette.darkPanel : palette.window);
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, r, radius);
  ctx.clip();
  ctx.fillStyle = dark ? palette.darkRaised : palette.chrome;
  ctx.fillRect(r.x, r.y, r.w, title);
  ctx.restore();

  const controlColor = dark ? palette.darkTextMuted : '#b9b9c0';
  const cy = r.y + title / 2;
  for (let i = 0; i < 3; i += 1) {
    const x = style.controls === 'left' ? r.x + (18 + i * 20) * u : r.x + r.w - (18 + i * 20) * u;
    if (style.controlShape === 'circle') circle(ctx, x, cy, 6 * u, controlColor);
    else fillRound(ctx, rect(x - 5 * u, cy - 5 * u, 10 * u, 10 * u), 2 * u, controlColor);
  }
  const titleW = Math.min(r.w * 0.3, 180 * u);
  fillRound(
    ctx,
    rect(r.x + (r.w - titleW) / 2, cy - 5 * u, titleW, 10 * u),
    5 * u,
    dark ? palette.darkLine : '#c9c9cf',
  );

  return rect(r.x, r.y + title, r.w, r.h - title);
}

/** Clips to the window's rounded shape; the caller restores. */
export function clipWindow(ctx: CanvasRenderingContext2D, r: Rect, os: OsId, u: number) {
  ctx.save();
  roundRectPath(ctx, r, osStyles[os].windowRadius * u);
  ctx.clip();
}
