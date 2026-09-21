/**
 * Abstract app mockups drawn on canvas: windows full of panels, bars, charts and timelines
 * that suggest a workflow without reproducing any real application's interface.
 */
import {
  circle,
  clipTo,
  fill,
  fillRound,
  inset,
  line,
  rect,
  splitCols,
  splitRows,
  strokeRound,
  takeLeft,
  takeTop,
  textBars,
  type DrawContext,
  type Rect,
} from './draw';
import { palette, tokenColors } from './palette';

export type AppId =
  | 'editor'
  | 'terminal'
  | 'files'
  | 'preview'
  | 'artboard'
  | 'layers'
  | 'inspector'
  | 'candles'
  | 'orderbook'
  | 'watchlist'
  | 'news'
  | 'timeline'
  | 'monitor'
  | 'scopes'
  | 'document'
  | 'outline'
  | 'references'
  | 'chat'
  | 'touch-tiles'
  | 'touch-sliders'
  | 'touch-wheel'
  | 'touch-scrubber'
  | 'touch-keypad'
  | 'touch-transport'
  | 'touch-shortcuts'
  | 'touch-palette';

/** Surface colours for light windows vs. dark cards / control surfaces. */
function tones(dark: boolean) {
  return dark
    ? {
        bg: palette.darkPanel,
        panel: palette.darkRaised,
        raised: '#2f3342',
        line: palette.darkLine,
        text: palette.darkText,
        muted: palette.darkTextMuted,
        soft: '#3a3f50',
      }
    : {
        bg: palette.window,
        panel: '#ffffff',
        raised: palette.chrome,
        line: palette.line,
        text: palette.text,
        muted: palette.textMuted,
        soft: palette.lineSoft,
      };
}

const pick = <T>(items: readonly T[], rand: () => number): T => {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error('pick() needs a non-empty list');
  return item;
};

function tabStrip(d: DrawContext, r: Rect, count: number) {
  const t = tones(d.dark);
  const { ctx, u } = d;
  fill(ctx, r, t.raised);
  let x = r.x + 10 * u;
  for (let i = 0; i < count; i += 1) {
    const w = (70 + d.rand() * 40) * u;
    fillRound(ctx, rect(x, r.y + 6 * u, w, r.h - 6 * u), 6 * u, i === 0 ? t.bg : 'transparent');
    fillRound(ctx, rect(x + 12 * u, r.y + r.h / 2 - 2 * u, w - 24 * u, 7 * u), 3 * u, t.soft);
    x += w + 6 * u;
  }
}

function codeLines(d: DrawContext, r: Rect) {
  const { ctx, u } = d;
  const t = tones(d.dark);
  const step = 20 * u;
  const size = 8 * u;
  let y = r.y + 10 * u;
  let lineNo = 0;
  while (y + size < r.y + r.h) {
    fillRound(ctx, rect(r.x, y, 16 * u, size), size / 2, t.soft);
    const indent = 34 * u + Math.floor(d.rand() * 4) * 22 * u;
    let x = r.x + indent;
    const tokens = 1 + Math.floor(d.rand() * 4);
    for (let i = 0; i < tokens && x < r.x + r.w - 30 * u; i += 1) {
      const w = (24 + d.rand() * 70) * u;
      const color = d.rand() < 0.45 ? t.line : pick(tokenColors, d.rand);
      fillRound(ctx, rect(x, y, Math.min(w, r.x + r.w - x - 8 * u), size), size / 2, color);
      x += w + 8 * u;
    }
    if (lineNo % 7 === 6) y += step * 0.6;
    y += step;
    lineNo += 1;
  }
}

function sparkline(d: DrawContext, r: Rect, color: string, points = 24) {
  const { ctx } = d;
  ctx.beginPath();
  let v = 0.5;
  for (let i = 0; i < points; i += 1) {
    v = Math.min(0.95, Math.max(0.05, v + (d.rand() - 0.5) * 0.25));
    const x = r.x + (i / (points - 1)) * r.w;
    const y = r.y + r.h - v * r.h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, d.u * 2);
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function gradientBlock(d: DrawContext, r: Rect, radius: number, from: string, to: string) {
  const g = d.ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  fillRound(d.ctx, r, radius, g);
}

/** Large round control with a ring, used by the touch apps. */
function bigButton(d: DrawContext, cx: number, cy: number, radius: number, color: string) {
  const t = tones(d.dark);
  circle(d.ctx, cx, cy, radius, t.panel);
  d.ctx.beginPath();
  d.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  d.ctx.strokeStyle = t.line;
  d.ctx.lineWidth = 2 * d.u;
  d.ctx.stroke();
  circle(d.ctx, cx, cy, radius * 0.38, color);
}

function slider(d: DrawContext, r: Rect, value: number, color: string) {
  const t = tones(d.dark);
  const track = rect(r.x, r.y + r.h / 2 - r.h * 0.18, r.w, r.h * 0.36);
  fillRound(d.ctx, track, track.h / 2, t.soft);
  fillRound(d.ctx, { ...track, w: track.w * value }, track.h / 2, color);
  circle(d.ctx, r.x + r.w * value, r.y + r.h / 2, r.h * 0.5, t.panel);
  d.ctx.beginPath();
  d.ctx.arc(r.x + r.w * value, r.y + r.h / 2, r.h * 0.5, 0, Math.PI * 2);
  d.ctx.strokeStyle = t.line;
  d.ctx.lineWidth = 2 * d.u;
  d.ctx.stroke();
}

function hueRing(d: DrawContext, cx: number, cy: number, outer: number, inner: number) {
  const { ctx } = d;
  const segments = 48;
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1.02) / segments) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, a0, a1);
    ctx.arc(cx, cy, inner, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = `hsl(${(i / segments) * 360} 62% 58%)`;
    ctx.fill();
  }
}

type AppDrawer = (d: DrawContext, r: Rect) => void;

export const apps: Record<AppId, AppDrawer> = {
  editor(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const [tabs, body] = takeTop(r, 34 * u);
    tabStrip(d, tabs, 3);
    const [tree, code] = takeLeft(body, Math.min(body.w * 0.24, 220 * u));
    fill(ctx, tree, t.raised);
    textBars(d, inset(tree, 14 * u), {
      size: 7 * u,
      step: 20 * u,
      color: t.line,
      minWidth: 0.35,
      maxWidth: 0.8,
      indentStep: 14 * u,
    });
    codeLines(d, inset(code, 14 * u, 4 * u));
  },

  terminal(d, r) {
    const { ctx, u } = d;
    fill(ctx, r, '#171922');
    const step = 20 * u;
    let y = r.y + 14 * u;
    while (y + 8 * u < r.y + r.h - 14 * u) {
      const prompt = d.rand() < 0.35;
      if (prompt) fillRound(ctx, rect(r.x + 14 * u, y, 22 * u, 8 * u), 4 * u, palette.green);
      const x = r.x + (prompt ? 44 : 14) * u;
      fillRound(
        ctx,
        rect(x, y, (0.2 + d.rand() * 0.5) * r.w, 8 * u),
        4 * u,
        prompt ? '#d0d3de' : '#6b7084',
      );
      y += step;
    }
    fillRound(ctx, rect(r.x + 14 * u, y, 10 * u, 14 * u), 2 * u, '#d0d3de');
  },

  files(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const [head, body] = takeTop(r, 40 * u);
    fill(ctx, head, t.raised);
    fillRound(ctx, rect(head.x + 14 * u, head.y + 12 * u, head.w * 0.5, 16 * u), 8 * u, t.bg);
    let y = body.y + 12 * u;
    while (y + 16 * u < body.y + body.h) {
      const depth = Math.floor(d.rand() * 3);
      const x = body.x + 16 * u + depth * 20 * u;
      fillRound(ctx, rect(x, y, 14 * u, 12 * u), 3 * u, depth === 0 ? palette.accent : t.soft);
      fillRound(
        ctx,
        rect(x + 24 * u, y + 2 * u, (0.25 + d.rand() * 0.4) * body.w, 8 * u),
        4 * u,
        t.line,
      );
      y += 24 * u;
    }
  },

  preview(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const [bar, page] = takeTop(r, 40 * u);
    fill(ctx, bar, t.raised);
    fillRound(ctx, rect(bar.x + 60 * u, bar.y + 10 * u, bar.w - 120 * u, 20 * u), 10 * u, t.bg);
    const content = inset(page, Math.min(page.w * 0.1, 60 * u), 24 * u);
    const [hero, rest] = takeTop(content, content.h * 0.32, 24 * u);
    gradientBlock(d, hero, 10 * u, palette.accentSoft, palette.accent);
    const [cards, text] = takeTop(rest, rest.h * 0.3, 24 * u);
    for (const card of splitCols(cards, 3, 16 * u)) {
      fillRound(ctx, card, 8 * u, t.panel);
      strokeRound(ctx, card, 8 * u, t.line, u);
      textBars(d, inset(card, 12 * u), { size: 7 * u, step: 16 * u, color: t.soft, maxLines: 3 });
    }
    textBars(d, text, { size: 8 * u, step: 18 * u, color: t.soft, paragraphEvery: 4 });
  },

  artboard(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    fill(ctx, r, d.dark ? '#171922' : '#dfe0e5');
    const [ruler, rest] = takeTop(r, 16 * u);
    fill(ctx, ruler, t.raised);
    for (let x = ruler.x; x < ruler.x + ruler.w; x += 24 * u)
      line(ctx, x, ruler.y + 8 * u, x, ruler.y + 16 * u, t.muted, u);
    const [tools, canvas] = takeLeft(rest, 40 * u);
    fill(ctx, tools, t.raised);
    for (let i = 0; i < 8; i += 1)
      fillRound(
        ctx,
        rect(tools.x + 11 * u, tools.y + (12 + i * 30) * u, 18 * u, 18 * u),
        4 * u,
        i === 1 ? palette.accent : t.soft,
      );
    const board = inset(canvas, canvas.w * 0.12, canvas.h * 0.12);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 20 * u;
    fillRound(ctx, board, 2 * u, '#ffffff');
    ctx.restore();
    const shapes = 4 + Math.floor(d.rand() * 3);
    for (let i = 0; i < shapes; i += 1) {
      const w = (0.15 + d.rand() * 0.3) * board.w;
      const h = (0.12 + d.rand() * 0.3) * board.h;
      const x = board.x + d.rand() * (board.w - w);
      const y = board.y + d.rand() * (board.h - h);
      const color = pick(tokenColors, d.rand);
      if (d.rand() < 0.3) circle(ctx, x + h / 2, y + h / 2, h / 2, color);
      else fillRound(ctx, rect(x, y, w, h), 8 * u, color);
    }
    textBars(d, inset(rect(board.x, board.y + board.h * 0.7, board.w, board.h * 0.3), 20 * u), {
      size: 6 * u,
      step: 14 * u,
      color: '#cfd0d6',
      maxLines: 3,
    });
    strokeRound(ctx, inset(board, board.w * 0.3, board.h * 0.3), 0, palette.accent, 1.5 * u);
  },

  layers(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const [head, body] = takeTop(r, 34 * u);
    fill(ctx, head, t.raised);
    fillRound(ctx, rect(head.x + 12 * u, head.y + 13 * u, 60 * u, 8 * u), 4 * u, t.muted);
    let y = body.y + 10 * u;
    while (y + 18 * u < body.y + body.h) {
      const depth = Math.floor(d.rand() * 3);
      const x = body.x + 14 * u + depth * 18 * u;
      fillRound(ctx, rect(x, y, 16 * u, 16 * u), 3 * u, pick(tokenColors, d.rand));
      fillRound(
        ctx,
        rect(x + 26 * u, y + 4 * u, (0.3 + d.rand() * 0.35) * body.w, 8 * u),
        4 * u,
        t.line,
      );
      circle(ctx, body.x + body.w - 18 * u, y + 8 * u, 4 * u, t.soft);
      y += 26 * u;
    }
  },

  inspector(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const content = inset(r, 14 * u, 12 * u);
    let y = content.y;
    const rowH = 28 * u;
    for (let i = 0; i < 12 && y + rowH < content.y + content.h; i += 1) {
      const kind = i % 4;
      fillRound(ctx, rect(content.x, y + 8 * u, content.w * 0.32, 8 * u), 4 * u, t.muted);
      const fieldX = content.x + content.w * 0.4;
      const fieldW = content.w * 0.6;
      if (kind === 3) {
        slider(d, rect(fieldX, y + 4 * u, fieldW, 16 * u), 0.2 + d.rand() * 0.6, palette.accent);
      } else if (kind === 2) {
        fillRound(ctx, rect(fieldX, y + 3 * u, 18 * u, 18 * u), 4 * u, pick(tokenColors, d.rand));
        fillRound(ctx, rect(fieldX + 26 * u, y + 3 * u, fieldW - 26 * u, 18 * u), 4 * u, t.panel);
        strokeRound(
          ctx,
          rect(fieldX + 26 * u, y + 3 * u, fieldW - 26 * u, 18 * u),
          4 * u,
          t.line,
          u,
        );
      } else {
        for (const field of splitCols(rect(fieldX, y + 3 * u, fieldW, 18 * u), 2, 8 * u)) {
          fillRound(ctx, field, 4 * u, t.panel);
          strokeRound(ctx, field, 4 * u, t.line, u);
          fillRound(
            ctx,
            rect(field.x + 8 * u, field.y + 5 * u, field.w * 0.4, 8 * u),
            4 * u,
            t.soft,
          );
        }
      }
      y += rowH + (kind === 3 ? 10 * u : 0);
    }
  },

  candles(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const [head, body] = takeTop(r, 36 * u);
    fill(ctx, head, t.raised);
    fillRound(ctx, rect(head.x + 14 * u, head.y + 14 * u, 60 * u, 8 * u), 4 * u, t.text);
    fillRound(ctx, rect(head.x + 86 * u, head.y + 14 * u, 40 * u, 8 * u), 4 * u, palette.green);
    const [chart, volume] = takeTop(inset(body, 16 * u, 14 * u), body.h * 0.62, 12 * u);
    const [plot, axis] = takeLeft(chart, chart.w - 44 * u, 8 * u);
    for (let i = 0; i <= 5; i += 1) {
      const y = plot.y + (i / 5) * plot.h;
      line(ctx, plot.x, y, plot.x + plot.w, y, t.soft, u);
      fillRound(ctx, rect(axis.x, y - 3 * u, axis.w, 6 * u), 3 * u, t.soft);
    }
    const n = Math.max(12, Math.floor(plot.w / (12 * u)));
    const cw = plot.w / n;
    let price = 0.5;
    for (let i = 0; i < n; i += 1) {
      const open = price;
      const close = Math.min(0.95, Math.max(0.05, price + (d.rand() - 0.48) * 0.12));
      const hi = Math.max(open, close) + d.rand() * 0.04;
      const lo = Math.min(open, close) - d.rand() * 0.04;
      const color = close >= open ? palette.green : palette.red;
      const x = plot.x + i * cw + cw / 2;
      const yOf = (v: number) => plot.y + plot.h - v * plot.h;
      line(ctx, x, yOf(hi), x, yOf(lo), color, u);
      ctx.fillStyle = color;
      ctx.fillRect(
        x - cw * 0.32,
        yOf(Math.max(open, close)),
        cw * 0.64,
        Math.max(u, Math.abs(yOf(open) - yOf(close))),
      );
      ctx.fillStyle = close >= open ? 'rgba(79,157,110,0.45)' : 'rgba(201,96,90,0.45)';
      const vh = (0.2 + d.rand() * 0.8) * volume.h;
      ctx.fillRect(x - cw * 0.32, volume.y + volume.h - vh, cw * 0.64, vh);
      price = close;
    }
    sparkline(d, plot, palette.amber, n);
  },

  orderbook(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const [head, body] = takeTop(r, 34 * u);
    fill(ctx, head, t.raised);
    for (const col of splitCols(inset(head, 14 * u, 13 * u), 3, 10 * u))
      fillRound(ctx, { ...col, w: col.w * 0.5 }, 4 * u, t.muted);
    const rows = inset(body, 14 * u, 10 * u);
    const rowH = 20 * u;
    const count = Math.floor(rows.h / rowH);
    const mid = Math.floor(count / 2);
    for (let i = 0; i < count; i += 1) {
      const y = rows.y + i * rowH;
      const ask = i < mid;
      const depth =
        (ask ? (mid - i) / mid : (i - mid + 1) / (count - mid)) * (0.4 + d.rand() * 0.6);
      ctx.fillStyle = ask ? 'rgba(201,96,90,0.16)' : 'rgba(79,157,110,0.16)';
      ctx.fillRect(rows.x + rows.w * (1 - depth), y + 2 * u, rows.w * depth, rowH - 4 * u);
      fillRound(
        ctx,
        rect(rows.x, y + 6 * u, 46 * u, 8 * u),
        4 * u,
        ask ? palette.red : palette.green,
      );
      fillRound(ctx, rect(rows.x + rows.w * 0.4, y + 6 * u, 40 * u, 8 * u), 4 * u, t.line);
      fillRound(ctx, rect(rows.x + rows.w * 0.75, y + 6 * u, 40 * u, 8 * u), 4 * u, t.soft);
      if (i === mid) line(ctx, rows.x, y, rows.x + rows.w, y, t.line, u);
    }
  },

  watchlist(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const rows = inset(r, 14 * u, 10 * u);
    const rowH = 40 * u;
    for (let y = rows.y; y + rowH < rows.y + rows.h; y += rowH) {
      const up = d.rand() < 0.55;
      fillRound(ctx, rect(rows.x, y + 10 * u, 44 * u, 9 * u), 4 * u, t.text);
      fillRound(ctx, rect(rows.x, y + 24 * u, 30 * u, 6 * u), 3 * u, t.soft);
      sparkline(
        d,
        rect(rows.x + rows.w * 0.3, y + 8 * u, rows.w * 0.32, rowH - 16 * u),
        up ? palette.green : palette.red,
        18,
      );
      fillRound(ctx, rect(rows.x + rows.w * 0.7, y + 10 * u, rows.w * 0.12, 9 * u), 4 * u, t.line);
      fillRound(
        ctx,
        rect(rows.x + rows.w - 52 * u, y + 9 * u, 52 * u, 18 * u),
        9 * u,
        up ? 'rgba(79,157,110,0.2)' : 'rgba(201,96,90,0.2)',
      );
      fillRound(
        ctx,
        rect(rows.x + rows.w - 42 * u, y + 15 * u, 32 * u, 6 * u),
        3 * u,
        up ? palette.green : palette.red,
      );
      line(ctx, rows.x, y + rowH, rows.x + rows.w, y + rowH, t.soft, u);
    }
  },

  news(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const list = inset(r, 14 * u, 12 * u);
    const cardH = 84 * u;
    for (let y = list.y; y + cardH < list.y + list.h; y += cardH + 10 * u) {
      const card = rect(list.x, y, list.w, cardH);
      fillRound(ctx, card, 8 * u, t.panel);
      strokeRound(ctx, card, 8 * u, t.line, u);
      fillRound(
        ctx,
        rect(card.x + 14 * u, card.y + 14 * u, 50 * u, 6 * u),
        3 * u,
        pick(tokenColors, d.rand),
      );
      fillRound(
        ctx,
        rect(card.x + 14 * u, card.y + 28 * u, card.w * (0.5 + d.rand() * 0.4), 10 * u),
        5 * u,
        t.text,
      );
      textBars(d, rect(card.x + 14 * u, card.y + 46 * u, card.w - 28 * u, 30 * u), {
        size: 6 * u,
        step: 14 * u,
        color: t.soft,
        maxLines: 2,
      });
    }
  },

  timeline(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const [ruler, tracksArea] = takeTop(r, 26 * u);
    fill(ctx, ruler, t.raised);
    for (let x = ruler.x + 60 * u; x < ruler.x + ruler.w; x += 40 * u)
      line(ctx, x, ruler.y + 14 * u, x, ruler.y + 26 * u, t.muted, u);
    const [labels, lanes] = takeLeft(inset(tracksArea, 0, 10 * u), 60 * u);
    const tracks = splitRows(lanes, 5, 8 * u);
    tracks.forEach((track, i) => {
      fill(ctx, track, t.raised);
      fillRound(
        ctx,
        rect(labels.x + 10 * u, track.y + track.h / 2 - 4 * u, 36 * u, 8 * u),
        4 * u,
        t.muted,
      );
      let x = track.x + d.rand() * 40 * u;
      const color = i < 2 ? palette.accent : i < 4 ? palette.violet : palette.green;
      while (x < track.x + track.w) {
        const w = (60 + d.rand() * 160) * u;
        const clip = rect(x, track.y + 3 * u, Math.min(w, track.x + track.w - x), track.h - 6 * u);
        fillRound(ctx, clip, 4 * u, color);
        if (i >= 4) sparkline(d, inset(clip, 4 * u), 'rgba(255,255,255,0.6)', 16);
        x += w + (6 + d.rand() * 40) * u;
      }
    });
    const playhead = lanes.x + lanes.w * 0.38;
    line(ctx, playhead, r.y, playhead, r.y + r.h, palette.red, 2 * u);
  },

  monitor(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    fill(ctx, r, '#0c0d12');
    const [frameArea, controls] = takeTop(r, r.h - 44 * u);
    const frameH = Math.min(frameArea.h - 20 * u, ((frameArea.w - 20 * u) * 9) / 16);
    const frame = rect(
      frameArea.x + (frameArea.w - (frameH * 16) / 9) / 2,
      frameArea.y + (frameArea.h - frameH) / 2,
      (frameH * 16) / 9,
      frameH,
    );
    const sky = ctx.createLinearGradient(0, frame.y, 0, frame.y + frame.h);
    sky.addColorStop(0, '#2c3d6b');
    sky.addColorStop(0.6, '#c9788a');
    sky.addColorStop(1, '#3b3140');
    fill(ctx, frame, sky);
    circle(ctx, frame.x + frame.w * 0.68, frame.y + frame.h * 0.55, frame.h * 0.09, '#f3d6a0');
    ctx.fillStyle = '#1e1a26';
    ctx.beginPath();
    ctx.moveTo(frame.x, frame.y + frame.h);
    for (let i = 0; i <= 8; i += 1)
      ctx.lineTo(frame.x + (i / 8) * frame.w, frame.y + frame.h * (0.72 + d.rand() * 0.12));
    ctx.lineTo(frame.x + frame.w, frame.y + frame.h);
    ctx.closePath();
    ctx.fill();
    fillRound(
      ctx,
      rect(controls.x + 60 * u, controls.y + 18 * u, controls.w - 120 * u, 6 * u),
      3 * u,
      t.line,
    );
    fillRound(
      ctx,
      rect(controls.x + 60 * u, controls.y + 18 * u, (controls.w - 120 * u) * 0.38, 6 * u),
      3 * u,
      palette.accent,
    );
    ctx.fillStyle = '#e6e7ee';
    ctx.beginPath();
    ctx.moveTo(controls.x + 24 * u, controls.y + 12 * u);
    ctx.lineTo(controls.x + 40 * u, controls.y + 21 * u);
    ctx.lineTo(controls.x + 24 * u, controls.y + 30 * u);
    ctx.closePath();
    ctx.fill();
  },

  scopes(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const content = inset(r, 16 * u);
    const [wheels, histo] = takeTop(content, content.h * 0.55, 16 * u);
    for (const cell of splitCols(wheels, 3, 16 * u)) {
      const radius = Math.min(cell.w, cell.h) * 0.4;
      const cx = cell.x + cell.w / 2;
      const cy = cell.y + cell.h / 2;
      hueRing(d, cx, cy, radius, radius * 0.86);
      const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.86);
      inner.addColorStop(0, d.dark ? '#3a3f50' : '#ffffff');
      inner.addColorStop(1, d.dark ? '#22252f' : '#dcdde4');
      circle(ctx, cx, cy, radius * 0.86, inner);
      circle(ctx, cx + (d.rand() - 0.5) * radius, cy + (d.rand() - 0.5) * radius, 5 * u, t.text);
    }
    fillRound(ctx, histo, 6 * u, d.dark ? '#141620' : '#1c1e27');
    const bars = Math.floor(histo.w / (6 * u));
    for (let i = 0; i < bars; i += 1) {
      const h = (0.15 + Math.sin((i / bars) * Math.PI) * 0.6 + d.rand() * 0.2) * (histo.h - 12 * u);
      ctx.fillStyle =
        ['rgba(201,96,90,0.7)', 'rgba(79,157,110,0.7)', 'rgba(77,114,168,0.7)'][i % 3] ?? '#fff';
      ctx.fillRect(histo.x + 6 * u + i * 6 * u, histo.y + histo.h - 6 * u - h, 4 * u, h);
    }
  },

  document(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    fill(ctx, r, d.dark ? palette.dark : '#e9e9ec');
    const pageW = Math.min(r.w - 40 * u, 620 * u);
    const page = rect(r.x + (r.w - pageW) / 2, r.y + 20 * u, pageW, r.h);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 16 * u;
    fillRound(ctx, page, 2 * u, t.panel);
    ctx.restore();
    const text = inset(page, 56 * u, 48 * u);
    fillRound(ctx, rect(text.x, text.y, text.w * 0.55, 16 * u), 6 * u, t.text);
    textBars(d, rect(text.x, text.y + 40 * u, text.w, text.h - 40 * u), {
      size: 7 * u,
      step: 17 * u,
      color: t.soft,
      minWidth: 0.7,
      paragraphEvery: 5,
    });
  },

  outline(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const list = inset(r, 18 * u, 16 * u);
    let y = list.y;
    while (y + 12 * u < list.y + list.h) {
      const depth = Math.floor(d.rand() * 3);
      const x = list.x + depth * 22 * u;
      circle(
        ctx,
        x + 4 * u,
        y + 5 * u,
        depth === 0 ? 4 * u : 2.5 * u,
        depth === 0 ? palette.accent : t.muted,
      );
      fillRound(
        ctx,
        rect(x + 16 * u, y, (0.3 + d.rand() * 0.5) * (list.w - x + list.x), 9 * u),
        4 * u,
        depth === 0 ? t.text : t.line,
      );
      y += 26 * u;
    }
  },

  references(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const grid = inset(r, 14 * u);
    const cols = grid.w > grid.h ? 3 : 2;
    const rows = Math.max(1, Math.round(grid.h / (grid.w / cols)));
    for (const row of splitRows(grid, rows, 12 * u))
      for (const card of splitCols(row, cols, 12 * u)) {
        fillRound(ctx, card, 8 * u, t.panel);
        strokeRound(ctx, card, 8 * u, t.line, u);
        const [image, caption] = takeTop(inset(card, 8 * u), card.h * 0.6, 8 * u);
        const a = pick(tokenColors, d.rand);
        gradientBlock(d, image, 6 * u, a, d.dark ? palette.darkRaised : palette.accentSoft);
        textBars(d, caption, { size: 6 * u, step: 12 * u, color: t.soft, maxLines: 2 });
      }
  },

  chat(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const [thread, composer] = takeTop(r, r.h - 48 * u);
    let y = thread.y + 16 * u;
    const bubbleW = Math.min(thread.w * 0.62, 320 * u);
    while (y + 40 * u < thread.y + thread.h) {
      const mine = d.rand() < 0.4;
      const h = (34 + Math.floor(d.rand() * 3) * 14) * u;
      const bubble = rect(
        mine ? thread.x + thread.w - bubbleW - 14 * u : thread.x + 14 * u,
        y,
        bubbleW,
        h,
      );
      fillRound(ctx, bubble, 12 * u, mine ? palette.accent : t.raised);
      textBars(d, inset(bubble, 12 * u, 10 * u), {
        size: 6 * u,
        step: 14 * u,
        color: mine ? 'rgba(255,255,255,0.7)' : t.line,
      });
      y += h + 10 * u;
    }
    const field = inset(composer, 14 * u, 10 * u);
    fillRound(ctx, field, field.h / 2, t.panel);
    strokeRound(ctx, field, field.h / 2, t.line, u);
    circle(
      ctx,
      field.x + field.w - field.h / 2,
      field.y + field.h / 2,
      field.h * 0.34,
      palette.accent,
    );
  },

  'touch-tiles'(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const grid = inset(r, 10 * u);
    const cols = grid.w > grid.h * 1.2 ? 3 : 2;
    const rows = Math.max(2, Math.round(grid.h / (grid.w / cols)));
    let i = 0;
    for (const row of splitRows(grid, rows, 14 * u))
      for (const tile of splitCols(row, cols, 14 * u)) {
        const color = tokenColors[i % tokenColors.length] ?? palette.accent;
        fillRound(ctx, tile, 18 * u, t.panel);
        strokeRound(ctx, tile, 18 * u, t.line, u);
        const size = Math.min(tile.w, tile.h) * 0.3;
        fillRound(ctx, rect(tile.x + 18 * u, tile.y + 18 * u, size, size), size * 0.3, color);
        fillRound(
          ctx,
          rect(tile.x + 18 * u, tile.y + tile.h - 28 * u, tile.w * 0.5, 10 * u),
          5 * u,
          t.line,
        );
        i += 1;
      }
  },

  'touch-sliders'(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const rows = splitRows(inset(r, 24 * u, 20 * u), 4, 16 * u);
    rows.forEach((row, i) => {
      fillRound(ctx, rect(row.x, row.y, row.w * 0.3, 10 * u), 5 * u, t.muted);
      slider(
        d,
        rect(row.x, row.y + 18 * u, row.w, Math.min(row.h - 18 * u, 40 * u)),
        0.2 + d.rand() * 0.6,
        tokenColors[i % tokenColors.length] ?? palette.accent,
      );
    });
  },

  'touch-wheel'(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const [wheelArea, controls] = takeTop(r, r.h * 0.68);
    const radius = Math.min(wheelArea.w, wheelArea.h) * 0.42;
    const cx = wheelArea.x + wheelArea.w / 2;
    const cy = wheelArea.y + wheelArea.h / 2;
    hueRing(d, cx, cy, radius, radius * 0.8);
    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.78);
    inner.addColorStop(0, '#ffffff');
    inner.addColorStop(1, 'hsl(210 60% 60%)');
    circle(ctx, cx, cy, radius * 0.78, inner);
    circle(ctx, cx + radius * 0.3, cy - radius * 0.2, 12 * u, t.panel);
    circle(ctx, cx + radius * 0.3, cy - radius * 0.2, 8 * u, t.text);
    for (const row of splitRows(inset(controls, 24 * u, 10 * u), 2, 10 * u))
      slider(d, row, 0.3 + d.rand() * 0.5, palette.accent);
  },

  'touch-scrubber'(d, r) {
    const { u } = d;
    const t = tones(d.dark);
    const content = inset(r, 20 * u, 16 * u);
    const [strip, rest] = takeTop(content, content.h * 0.42, 18 * u);
    const thumbs = Math.max(4, Math.floor(strip.w / (90 * u)));
    for (const thumb of splitCols(strip, thumbs, 6 * u))
      gradientBlock(
        d,
        thumb,
        6 * u,
        `hsl(${200 + d.rand() * 80} 40% ${30 + d.rand() * 20}%)`,
        '#1e1a26',
      );
    const [track, transport] = takeTop(rest, 44 * u, 16 * u);
    slider(d, track, 0.38, palette.red);
    const centers = [0.3, 0.42, 0.5, 0.58, 0.7];
    centers.forEach((c, i) =>
      bigButton(
        d,
        transport.x + transport.w * c,
        transport.y + transport.h / 2,
        i === 2 ? Math.min(transport.h * 0.48, 36 * u) : Math.min(transport.h * 0.34, 26 * u),
        i === 2 ? palette.accent : t.muted,
      ),
    );
  },

  'touch-keypad'(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const content = inset(r, 16 * u);
    const [display, rest] = takeTop(content, 44 * u, 12 * u);
    fillRound(ctx, display, 10 * u, t.panel);
    strokeRound(ctx, display, 10 * u, t.line, u);
    fillRound(
      ctx,
      rect(display.x + display.w - 110 * u, display.y + 16 * u, 94 * u, 12 * u),
      6 * u,
      t.text,
    );
    const [keys, actions] = takeTop(rest, rest.h - 60 * u, 12 * u);
    for (const row of splitRows(keys, 4, 10 * u))
      for (const key of splitCols(row, 3, 10 * u)) {
        fillRound(ctx, key, 12 * u, t.panel);
        strokeRound(ctx, key, 12 * u, t.line, u);
        fillRound(
          ctx,
          rect(key.x + key.w / 2 - 6 * u, key.y + key.h / 2 - 6 * u, 12 * u, 12 * u),
          3 * u,
          t.muted,
        );
      }
    const [buy, sell] = splitCols(actions, 2, 12 * u);
    if (buy) fillRound(ctx, buy, 14 * u, palette.green);
    if (sell) fillRound(ctx, sell, 14 * u, palette.red);
  },

  'touch-transport'(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const content = inset(r, 20 * u);
    const [jog, buttons] = takeTop(content, content.h * 0.62, 16 * u);
    const radius = Math.min(jog.w, jog.h) * 0.42;
    const cx = jog.x + jog.w / 2;
    const cy = jog.y + jog.h / 2;
    circle(ctx, cx, cy, radius, t.panel);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = t.line;
    ctx.lineWidth = 3 * u;
    ctx.stroke();
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      line(
        ctx,
        cx + Math.cos(a) * radius * 0.82,
        cy + Math.sin(a) * radius * 0.82,
        cx + Math.cos(a) * radius * 0.92,
        cy + Math.sin(a) * radius * 0.92,
        t.muted,
        2 * u,
      );
    }
    circle(ctx, cx, cy, radius * 0.3, palette.accent);
    [0.2, 0.4, 0.6, 0.8].forEach((c, i) =>
      bigButton(
        d,
        buttons.x + buttons.w * c,
        buttons.y + buttons.h / 2,
        Math.min(buttons.h * 0.4, 30 * u),
        i === 1 ? palette.red : t.muted,
      ),
    );
  },

  'touch-shortcuts'(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const content = inset(r, 12 * u);
    const [grid, strip] = takeTop(content, content.h * 0.72, 12 * u);
    let i = 0;
    for (const row of splitRows(grid, 2, 12 * u))
      for (const tile of splitCols(row, 4, 12 * u)) {
        const color = tokenColors[i % tokenColors.length] ?? palette.accent;
        fillRound(ctx, tile, 14 * u, t.panel);
        strokeRound(ctx, tile, 14 * u, t.line, u);
        fillRound(ctx, rect(tile.x, tile.y + tile.h - 8 * u, tile.w, 8 * u), 4 * u, color);
        fillRound(ctx, rect(tile.x + 14 * u, tile.y + 14 * u, tile.w * 0.45, 9 * u), 4 * u, t.line);
        i += 1;
      }
    fillRound(ctx, strip, 10 * u, '#171922');
    fillRound(
      ctx,
      rect(strip.x + 14 * u, strip.y + strip.h / 2 - 4 * u, 20 * u, 8 * u),
      4 * u,
      palette.green,
    );
    fillRound(
      ctx,
      rect(strip.x + 42 * u, strip.y + strip.h / 2 - 4 * u, strip.w * 0.4, 8 * u),
      4 * u,
      '#d0d3de',
    );
  },

  'touch-palette'(d, r) {
    const { ctx, u } = d;
    const t = tones(d.dark);
    const content = inset(r, 18 * u);
    const [swatches, sliders] = takeTop(content, content.h * 0.62, 16 * u);
    const cols = 5;
    const rows = 3;
    let i = 0;
    for (const row of splitRows(swatches, rows, 12 * u))
      for (const cell of splitCols(row, cols, 12 * u)) {
        const radius = Math.min(cell.w, cell.h) / 2;
        circle(
          ctx,
          cell.x + cell.w / 2,
          cell.y + cell.h / 2,
          radius,
          `hsl(${(i / (cols * rows)) * 340} 55% ${45 + (i % rows) * 12}%)`,
        );
        i += 1;
      }
    for (const row of splitRows(sliders, 2, 10 * u)) slider(d, row, 0.25 + d.rand() * 0.5, t.muted);
  },
};

/** Draws the clipped app into `r`. */
export function drawApp(d: DrawContext, id: AppId, r: Rect) {
  clipTo(d.ctx, r);
  const t = tones(d.dark);
  fill(d.ctx, r, t.bg);
  apps[id](d, r);
  d.ctx.restore();
}
