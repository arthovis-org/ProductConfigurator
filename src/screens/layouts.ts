import type { LayoutId } from '@/products/schema';
import { rect, type Rect } from './draw';

export interface Pane extends Rect {
  /** Main panes get the workflow's primary app; pip panes are drawn last, on top. */
  role: 'main' | 'secondary' | 'pip';
}

/**
 * Pane rectangles for a layout in normalised screen coordinates (0–1 of the work area).
 * `gap` is the spacing between panes as a fraction of the work area's width.
 */
export function layoutPanes(layout: LayoutId, gap = 0.014): Pane[] {
  const g = gap;
  const half = (1 - g) / 2;
  const third = (1 - 2 * g) / 3;
  switch (layout) {
    case 'single':
      return [{ ...rect(0, 0, 1, 1), role: 'main' }];
    case 'two-up':
      return [
        { ...rect(0, 0, half, 1), role: 'main' },
        { ...rect(half + g, 0, half, 1), role: 'secondary' },
      ];
    case 'three-column':
      return [
        { ...rect(0, 0, third, 1), role: 'secondary' },
        { ...rect(third + g, 0, third, 1), role: 'main' },
        { ...rect(2 * (third + g), 0, third, 1), role: 'secondary' },
      ];
    case 'grid-2x2':
      return [
        { ...rect(0, 0, half, half), role: 'main' },
        { ...rect(half + g, 0, half, half), role: 'secondary' },
        { ...rect(0, half + g, half, half), role: 'secondary' },
        { ...rect(half + g, half + g, half, half), role: 'secondary' },
      ];
    case 'sidebar-main': {
      const side = 0.27;
      return [
        { ...rect(0, 0, side, 1), role: 'secondary' },
        { ...rect(side + g, 0, 1 - side - g, 1), role: 'main' },
      ];
    }
    case 'pip': {
      const size = 0.3;
      return [
        { ...rect(0, 0, 1, 1), role: 'main' },
        { ...rect(1 - size - 0.03, 1 - size - 0.04, size, size), role: 'pip' },
      ];
    }
    case 'stack': {
      const row = (1 - 2 * g) / 3;
      return [
        { ...rect(0, 0, 1, row), role: 'main' },
        { ...rect(0, row + g, 1, row), role: 'secondary' },
        { ...rect(0, 2 * (row + g), 1, row), role: 'secondary' },
      ];
    }
  }
}
