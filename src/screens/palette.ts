/**
 * Neutral palette for the in-screen mockups. Everything drawn on a screen uses these
 * colours so the mockups read as one system and never resemble a real product's UI.
 */
export const palette = {
  window: '#f7f7f5',
  chrome: '#ebebe8',
  border: 'rgba(0, 0, 0, 0.09)',
  text: '#2a2a30',
  textMuted: '#9a9aa2',
  line: '#d6d6db',
  lineSoft: '#e7e7eb',
  accent: '#4d72a8',
  accentSoft: '#dde6f2',
  green: '#4f9d6e',
  red: '#c9605a',
  amber: '#d3a24a',
  violet: '#7c6bb0',
  teal: '#3f9a9a',
  /** Dark variants for the spatial workspace and the touch control surface. */
  dark: '#12131a',
  darkPanel: '#1c1e27',
  darkRaised: '#262935',
  darkLine: '#343847',
  darkText: '#d5d7e0',
  darkTextMuted: '#7d818f',
  glow: '#8fb3ea',
} as const;

/** Token colours used for abstract code lines and tags. */
export const tokenColors = [
  palette.accent,
  palette.violet,
  palette.green,
  palette.amber,
  palette.teal,
] as const;
