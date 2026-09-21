import type { Material, Mesh, Object3D } from 'three';

function isMesh(object: Object3D): object is Mesh {
  return (object as Partial<Mesh>).isMesh === true;
}

/**
 * Replaces the material of every mesh under `root` with `replace(original)` and returns a
 * function that restores the originals and disposes the replacements. Multi-material meshes
 * get one replacement per slot.
 */
export function swapMaterials(root: Object3D, replace: (material: Material) => Material) {
  const swapped = collectMeshes(root).map((mesh) => {
    const original = mesh.material;
    const replacements = Array.isArray(original) ? original.map(replace) : [replace(original)];
    mesh.material = Array.isArray(original) ? replacements : (replacements[0] ?? original);
    return { mesh, original, replacements };
  });
  return () => {
    for (const { mesh, original, replacements } of swapped) {
      mesh.material = original;
      for (const material of replacements) material.dispose();
    }
  };
}

/** Collects every mesh at or below `root`, in traversal order. */
export function collectMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if (isMesh(object)) meshes.push(object);
  });
  return meshes;
}
