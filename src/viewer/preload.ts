import { useGLTF } from '@react-three/drei';
import type { ProductDefinition } from '@/products/schema';

/** Starts downloading a product's model before the viewer mounts. */
export function preloadProductModel(product: ProductDefinition) {
  useGLTF.preload(product.model.src);
}
