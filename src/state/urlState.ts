/**
 * Query-string encoding of a configuration so it can be shared as a link:
 * `?product=<id>&c=<group>:<option>,<group>:<option>`
 */
import type { Selections } from './derive';

const PRODUCT_PARAM = 'product';
const CONFIG_PARAM = 'c';

export function encodeConfigSearch(productId: string, selections: Selections): string {
  const params = new URLSearchParams();
  params.set(PRODUCT_PARAM, productId);
  const pairs = Object.entries(selections).map(([groupId, optionId]) => `${groupId}:${optionId}`);
  if (pairs.length > 0) params.set(CONFIG_PARAM, pairs.join(','));
  return `?${params.toString()}`;
}

export function decodeConfigSearch(search: string): {
  productId: string | null;
  selections: Selections;
} {
  const params = new URLSearchParams(search);
  const selections: Record<string, string> = {};
  for (const pair of (params.get(CONFIG_PARAM) ?? '').split(',')) {
    const [groupId, optionId] = pair.split(':');
    if (groupId && optionId) selections[groupId] = optionId;
  }
  return { productId: params.get(PRODUCT_PARAM), selections };
}
