import { Center, useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { Object3D, Vector3 } from 'three';
import { useProduct, useResolvedConfiguration } from '@/state/configuratorStore';
import type { MaterialPreset, ProductDefinition } from '@/products/schema';
import { PartAppearance } from './PartAppearance';

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;

interface PartNode {
  node: Object3D;
  /** Scale as authored in the glTF; dimension scaling multiplies onto it. */
  baseScale: Vector3;
}

/** Resolves every part's node names once; Blender node names survive the glTF export unchanged. */
function resolvePartNodes(scene: Object3D, product: ProductDefinition) {
  const nodes = new Map<string, PartNode>();
  for (const name of product.parts.flatMap((part) => part.nodes)) {
    const node = scene.getObjectByName(name);
    if (node) nodes.set(name, { node, baseScale: node.scale.clone() });
    else console.warn(`[configurator] node "${name}" not found in ${product.model.src}`);
  }
  return nodes;
}

/** Loads the product glTF and applies the resolved configuration to its nodes. */
export function ProductModel() {
  const product = useProduct();
  const { scene } = useGLTF(product.model.src);
  const config = useResolvedConfiguration();
  const invalidate = useThree((state) => state.invalidate);

  const partNodes = useMemo(() => resolvePartNodes(scene, product), [scene, product]);

  // Visibility and scale are cheap property writes, so they live in one effect.
  useEffect(() => {
    for (const [name, { node, baseScale }] of partNodes) {
      node.visible = !config.hiddenNodes.has(name);
      node.scale.copy(baseScale);
      const scale = config.nodeScales.get(name);
      if (scale) {
        const axis = AXIS_INDEX[scale.axis];
        node.scale.setComponent(axis, baseScale.getComponent(axis) * scale.scale);
      }
    }
    invalidate();
  }, [partNodes, config.hiddenNodes, config.nodeScales, invalidate]);

  const materialTargets: { name: string; node: Object3D; preset: MaterialPreset }[] = [];
  for (const [name, preset] of config.materialAssignments) {
    const part = partNodes.get(name);
    if (part) materialTargets.push({ name, node: part.node, preset });
  }

  // Centred once on mount (hidden alternatives are included in the bounds), so
  // toggling parts never shifts the model under the camera. drei's `top` aligns the
  // bounding box's bottom face to y = 0, i.e. the model stands on the floor.
  return (
    <Center top>
      <group
        scale={product.model.scale}
        position={product.model.position}
        rotation={product.model.rotation}
      >
        <primitive object={scene} />
        {materialTargets.map(({ name, node, preset }) => (
          <PartAppearance key={name} node={node} preset={preset} />
        ))}
      </group>
    </Center>
  );
}
