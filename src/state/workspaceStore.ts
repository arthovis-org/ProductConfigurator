/**
 * State for workspace mode: live websites on the product's screens. Kept apart from the
 * configurator store because it is a demo, never priced and never part of a shared link.
 */
import { create } from 'zustand';
import { getProduct } from '@/catalog';
import type { ProductDefinition, Workspace, WorkspaceWindow } from '@/catalog/schema';
import { useConfiguratorStore } from './configuratorStore';

export interface WindowDrag {
  windowId: string;
  title: string;
  /** Pointer position in viewport pixels. */
  x: number;
  y: number;
  /** Screen under the pointer, where the window would land. */
  over: string | null;
}

/** Finds the screen under a viewport position; provided by the viewer while it is mounted. */
export type ScreenPicker = (clientX: number, clientY: number) => string | null;

interface WorkspaceState {
  productId: string | null;
  /** Workspace mode is on: the camera sits in front of the screens and sites are live. */
  active: boolean;
  /** The camera is back under the orbit controls (false from entering until the exit move ends). */
  cameraFree: boolean;
  workspaceId: string | null;
  /** Screen each window was put on; windows follow their screen's visibility. */
  placement: Readonly<Record<string, string>>;
  /** Screen the camera zooms to, or null for the overview of all screens. */
  focus: string | null;
  drag: WindowDrag | null;
  pickScreen: ScreenPicker | null;

  resetFor: (product: ProductDefinition) => void;
  enter: (workspaceId?: string) => void;
  exit: () => void;
  select: (workspaceId: string) => void;
  resetWindows: () => void;
  moveWindow: (windowId: string, screenId: string) => void;
  setFocus: (screenId: string | null) => void;
  setCameraFree: (free: boolean) => void;
  setPicker: (picker: ScreenPicker | null) => void;
  startDrag: (window: WorkspaceWindow, x: number, y: number) => void;
  updateDrag: (x: number, y: number) => void;
  /** Ends a drag, moving the window if it was dropped on another screen. */
  endDrag: () => void;
}

function currentProduct(state: Pick<WorkspaceState, 'productId'>) {
  return getProduct(state.productId);
}

export function workspaceById(
  product: ProductDefinition,
  id: string | null,
): Workspace | undefined {
  return product.workspaces.find((w) => w.id === id) ?? product.workspaces[0];
}

function initialPlacement(workspace: Workspace | undefined): Record<string, string> {
  return Object.fromEntries((workspace?.windows ?? []).map((w) => [w.id, w.screen]));
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  productId: null,
  active: false,
  cameraFree: true,
  workspaceId: null,
  placement: {},
  focus: null,
  drag: null,
  pickScreen: null,

  resetFor: (product) => {
    if (get().productId === product.id) return;
    const workspace = product.workspaces[0];
    set({
      productId: product.id,
      active: false,
      cameraFree: true,
      workspaceId: workspace?.id ?? null,
      placement: initialPlacement(workspace),
      focus: null,
      drag: null,
    });
  },

  enter: (workspaceId) => {
    const workspace = workspaceById(currentProduct(get()), workspaceId ?? get().workspaceId);
    if (!workspace) return;
    const switching = workspace.id !== get().workspaceId;
    set({
      active: true,
      cameraFree: false,
      workspaceId: workspace.id,
      focus: null,
      ...(switching && { placement: initialPlacement(workspace) }),
    });
  },

  exit: () => set({ active: false, focus: null, drag: null }),

  select: (workspaceId) => {
    const workspace = workspaceById(currentProduct(get()), workspaceId);
    if (!workspace) return;
    set({ workspaceId: workspace.id, placement: initialPlacement(workspace), focus: null });
  },

  resetWindows: () => {
    const workspace = workspaceById(currentProduct(get()), get().workspaceId);
    set({ placement: initialPlacement(workspace), focus: null });
  },

  moveWindow: (windowId, screenId) =>
    set((state) => ({ placement: { ...state.placement, [windowId]: screenId } })),

  setFocus: (focus) => set({ focus }),
  setCameraFree: (cameraFree) => set({ cameraFree }),
  setPicker: (pickScreen) => set({ pickScreen }),

  startDrag: (window, x, y) =>
    set({ drag: { windowId: window.id, title: window.title, x, y, over: null } }),

  updateDrag: (x, y) => {
    const { drag, pickScreen } = get();
    if (!drag) return;
    set({ drag: { ...drag, x, y, over: pickScreen?.(x, y) ?? null } });
  },

  endDrag: () => {
    const { drag } = get();
    if (!drag) return;
    set((state) => ({
      drag: null,
      ...(drag.over && { placement: { ...state.placement, [drag.windowId]: drag.over } }),
    }));
  },
}));

/**
 * Windows per screen for the current placement. A window whose screen is hidden (its monitor
 * switched off) moves to the primary screen until its own screen is back.
 */
export function layoutWindows(
  workspace: Workspace | undefined,
  placement: Readonly<Record<string, string>>,
  visibleScreens: readonly string[],
  primaryScreen: string | undefined,
): Map<string, WorkspaceWindow[]> {
  const layout = new Map<string, WorkspaceWindow[]>();
  for (const window of workspace?.windows ?? []) {
    const wanted = placement[window.id] ?? window.screen;
    const screen = visibleScreens.includes(wanted) ? wanted : primaryScreen;
    if (!screen) continue;
    layout.set(screen, [...(layout.get(screen) ?? []), window]);
  }
  return layout;
}

// Follow the configurator's product: reset on every switch.
const syncProduct = () => {
  useWorkspaceStore.getState().resetFor(getProduct(useConfiguratorStore.getState().productId));
};
syncProduct();
useConfiguratorStore.subscribe(syncProduct);
