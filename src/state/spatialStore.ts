import { create } from 'zustand';

/**
 * View state for the screen-content transition: whether the flat desktops have lifted
 * into the 3D workspace. Kept out of the configurator store because it is not part of
 * the product configuration and is not shared through the URL.
 */
interface SpatialState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

export const useSpatialStore = create<SpatialState>()((set) => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
  toggle: () => set((state) => ({ enabled: !state.enabled })),
}));
