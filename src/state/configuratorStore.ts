import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import { getProduct } from '@/products';
import type { ProductDefinition } from '@/products/schema';
import {
  defaultSelections,
  resolveConfiguration,
  sanitizeSelections,
  type ResolvedConfiguration,
  type Selections,
} from './derive';
import { decodeConfigSearch, encodeConfigSearch } from './urlState';

interface ConfiguratorState {
  productId: string;
  selections: Selections;

  /** Switches product and resets selections to that product's defaults. */
  selectProduct: (productId: string) => void;
  selectOption: (groupId: string, optionId: string) => void;
  resetToDefaults: () => void;
  /** Query string (`?product=…&c=…`) describing the current configuration. */
  serialize: () => string;
  /** Restores a configuration from a query string; unknown values fall back to defaults. */
  hydrate: (search: string) => void;
}

const initialProduct = getProduct(null);

export const useConfiguratorStore = create<ConfiguratorState>()((set, get) => ({
  productId: initialProduct.id,
  selections: defaultSelections(initialProduct),

  selectProduct: (productId) => {
    const product = getProduct(productId);
    set({ productId: product.id, selections: defaultSelections(product) });
  },

  selectOption: (groupId, optionId) => {
    const product = getProduct(get().productId);
    set((state) => ({
      selections: sanitizeSelections(product, { ...state.selections, [groupId]: optionId }),
    }));
  },

  resetToDefaults: () => {
    set({ selections: defaultSelections(getProduct(get().productId)) });
  },

  serialize: () => {
    const { productId, selections } = get();
    return encodeConfigSearch(productId, selections);
  },

  hydrate: (search) => {
    const decoded = decodeConfigSearch(search);
    const product = getProduct(decoded.productId);
    set({ productId: product.id, selections: sanitizeSelections(product, decoded.selections) });
  },
}));

export function useProduct(): ProductDefinition {
  return useConfiguratorStore((state) => getProduct(state.productId));
}

export function useSelections(): Selections {
  return useConfiguratorStore(useShallow((state) => state.selections));
}

/** Memoised resolution of the current selections into node-level instructions. */
export function useResolvedConfiguration(): ResolvedConfiguration {
  const product = useProduct();
  const selections = useSelections();
  return useMemo(() => resolveConfiguration(product, selections), [product, selections]);
}
