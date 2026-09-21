import type { WorkflowId } from '@/products/schema';
import type { AppId } from './apps';

export interface Workflow {
  /** Apps in priority order: the main pane gets the first, other panes the rest in turn. */
  apps: readonly AppId[];
  /** Touch-friendly counterparts for `kind: 'touch'` screens and the control surface. */
  touchApps: readonly AppId[];
}

export const workflows: Record<WorkflowId, Workflow> = {
  design: {
    apps: ['artboard', 'layers', 'inspector', 'references', 'chat'],
    touchApps: ['touch-wheel', 'touch-palette', 'touch-sliders'],
  },
  trading: {
    apps: ['candles', 'watchlist', 'orderbook', 'news', 'chat'],
    touchApps: ['touch-keypad', 'touch-tiles', 'touch-sliders'],
  },
  coding: {
    apps: ['editor', 'terminal', 'files', 'preview', 'chat'],
    touchApps: ['touch-shortcuts', 'touch-tiles', 'touch-sliders'],
  },
  video: {
    apps: ['monitor', 'timeline', 'scopes', 'files', 'chat'],
    touchApps: ['touch-scrubber', 'touch-transport', 'touch-wheel'],
  },
  writing: {
    apps: ['document', 'outline', 'references', 'preview', 'chat'],
    touchApps: ['touch-tiles', 'touch-sliders', 'touch-palette'],
  },
};
