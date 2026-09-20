/**
 * Product registry. Every definition is validated at import time so a broken
 * definition fails loudly on startup instead of rendering a half-working UI.
 *
 * To add a product: create `definitions/<id>.ts` and add it to `definitionInputs`.
 */
import { placeholderDesk } from './definitions/placeholder-desk';
import { parseProductDefinition, type ProductDefinition } from './schema';

const definitionInputs = [placeholderDesk];

export const products: Readonly<Record<string, ProductDefinition>> = Object.fromEntries(
  definitionInputs.map((input) => {
    const product = parseProductDefinition(input);
    return [product.id, product];
  }),
);

export const productList: readonly ProductDefinition[] = Object.values(products);

export function getProduct(productId: string | null | undefined): ProductDefinition {
  const fallback = productList[0];
  if (!fallback) throw new Error('No products are registered.');
  return (productId ? products[productId] : undefined) ?? fallback;
}
