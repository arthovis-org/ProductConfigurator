import { Center, useBounds, useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Euler, MathUtils, Quaternion, type Object3D, type Vector3 } from 'three';
import { useProduct, useResolvedConfiguration } from '@/state/configuratorStore';
import type { ResolvedConfiguration } from '@/state/derive';
import type { MaterialPreset, ProductDefinition } from '@/products/schema';
import { internSpec } from '@/screens/renderScreen';
import { measurePanel } from './panelFrame';
import { PartAppearance } from './PartAppearance';
import { ScreenSurface } from './ScreenSurface';
import { SpatialWorkspace, type VisibleScreen } from './SpatialWorkspace';

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;

interface ConfigurableNode {
  node: Object3D;
  /** Transform as authored in the glTF; scale and pose offsets are applied on top of it. */
  baseScale: Vector3;
  basePosition: Vector3;
  baseQuaternion: Quaternion;
}

/** Every node name a definition refers to: part nodes, screen panels and pose targets. */
function referencedNodeNames(product: ProductDefinition): Set<string> {
  const names = new Set(product.parts.flatMap((part) => part.nodes));
  for (const part of product.parts) for (const screen of part.screens) names.add(screen.node);
  for (const group of product.optionGroups) {
    if (group.type !== 'pose') continue;
    for (const option of group.options)
      for (const transform of option.transforms)
        for (const name of transform.nodes) names.add(name);
  }
  return names;
}

/**
 * Resolves every referenced node once. `getObjectByName` searches the whole
 * hierarchy, so nested nodes (a screen under a mount under the top assembly)
 * work the same as root-level ones, and hiding a parent hides its children.
 */
function resolveNodes(scene: Object3D, product: ProductDefinition) {
  const nodes = new Map<string, ConfigurableNode>();
  for (const name of referencedNodeNames(product)) {
    const node = scene.getObjectByName(name);
    if (node) {
      nodes.set(name, {
        node,
        baseScale: node.scale.clone(),
        basePosition: node.position.clone(),
        baseQuaternion: node.quaternion.clone(),
      });
    } else console.warn(`[configurator] node "${name}" not found in ${product.model.src}`);
  }
  return nodes;
}

/** A node is off the model when it or any ancestor is hidden. */
function isHidden(node: Object3D, hiddenNodes: ReadonlySet<string>): boolean {
  for (let current: Object3D | null = node; current; current = current.parent)
    if (hiddenNodes.has(current.name)) return true;
  return false;
}

/** Screens whose panel is on the model, with their content and panel geometry. */
function visibleScreens(
  nodes: ReadonlyMap<string, ConfigurableNode>,
  config: Pick<ResolvedConfiguration, 'screens' | 'hiddenNodes'>,
): VisibleScreen[] {
  const result: VisibleScreen[] = [];
  for (const [name, resolved] of config.screens) {
    const target = nodes.get(name);
    if (!target || isHidden(target.node, config.hiddenNodes)) continue;
    const frame = measurePanel(target.node);
    if (!frame) continue;
    const { widthPx, heightPx, kind } = resolved.screen;
    const spec = internSpec({ widthPx, heightPx, kind, content: resolved.content });
    result.push({ node: target.node, spec, frame });
  }
  return result;
}

/** Loads the product glTF and applies the resolved configuration to its nodes. */
export function ProductModel() {
  const product = useProduct();
  const { scene } = useGLTF(product.model.src);
  const config = useResolvedConfiguration();
  const invalidate = useThree((state) => state.invalidate);
  const bounds = useBounds();

  const nodes = useMemo(() => resolveNodes(scene, product), [scene, product]);

  // The camera is framed once per product and re-framed when a pose moves geometry
  // (a raised desk top), but never when a part is merely shown or hidden, so toggling
  // an accessory does not shift the model under the camera.
  const poseKey = JSON.stringify([...config.nodePoses]);
  useEffect(() => {
    bounds.refresh().clip().fit();
  }, [bounds, product.id, poseKey]);

  // Visibility, scale and pose are cheap property writes, so they live in one effect.
  useEffect(() => {
    const poseEuler = new Euler();
    const poseRotation = new Quaternion();
    for (const [name, { node, baseScale, basePosition, baseQuaternion }] of nodes) {
      node.visible = !config.hiddenNodes.has(name);

      node.scale.copy(baseScale);
      const scale = config.nodeScales.get(name);
      if (scale) {
        const axis = AXIS_INDEX[scale.axis];
        node.scale.setComponent(axis, baseScale.getComponent(axis) * scale.scale);
      }

      node.position.copy(basePosition);
      node.quaternion.copy(baseQuaternion);
      const pose = config.nodePoses.get(name);
      if (pose) {
        const [rx, ry, rz] = pose.rotation;
        poseEuler.set(MathUtils.degToRad(rx), MathUtils.degToRad(ry), MathUtils.degToRad(rz));
        node.quaternion.multiply(poseRotation.setFromEuler(poseEuler));
        node.position.x += pose.position[0];
        node.position.y += pose.position[1];
        node.position.z += pose.position[2];
      }
    }
    invalidate();
  }, [nodes, config.hiddenNodes, config.nodeScales, config.nodePoses, invalidate]);

  const screens = useMemo(
    () => visibleScreens(nodes, { screens: config.screens, hiddenNodes: config.hiddenNodes }),
    [nodes, config.screens, config.hiddenNodes],
  );

  const materialTargets: { name: string; node: Object3D; preset: MaterialPreset }[] = [];
  for (const [name, preset] of config.materialAssignments) {
    const target = nodes.get(name);
    if (target) materialTargets.push({ name, node: target.node, preset });
  }

  // Centred once per product (hidden alternatives are included in the bounds).
  // drei's `top` aligns the bounding box's bottom face to y = 0, i.e. the model
  // stands on the floor.
  return (
    <Center top cacheKey={product.id}>
      <group
        scale={product.model.scale}
        position={product.model.position}
        rotation={product.model.rotation}
      >
        <primitive object={scene} />
        {materialTargets.map(({ name, node, preset }) => (
          <PartAppearance key={name} node={node} preset={preset} />
        ))}
        {screens.map(({ node, spec }) => (
          <ScreenSurface key={node.uuid} node={node} spec={spec} />
        ))}
        <SpatialWorkspace screens={screens} />
      </group>
    </Center>
  );
}
