import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { type Box3, Matrix3, Vector3, type Object3D } from 'three';
import type { Motion, ProductDefinition } from '@/catalog/schema';
import { useMotionStore } from '@/state/motionStore';
import {
  authoredPosition,
  collectMeshes,
  meshBounds,
  matrixRelativeTo,
  modelBounds,
  modelTransform,
  type PartBoundaries,
} from './nodeUtils';

const AXIS_VECTOR = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };
/**
 * Longest time step per frame. The render loop sleeps while nothing changes, so the first
 * frame after a pause reports a long delta; capping it avoids a jump. The cap is generous
 * so slow devices still move at the configured speed.
 */
const MAX_FRAME_SECONDS = 0.1;

interface MovedNode {
  node: Object3D;
  /** Share of the motion this node moves by in the scene (Lift50 -> 0.5). */
  factor: number;
  /** Factor relative to the nearest moved ancestor, which already carries the rest. */
  localFactor: number;
}

export interface ResolvedMotion {
  motion: Motion;
  modelledValue: number;
  speed: number;
  nodes: MovedNode[];
}

type NodeIndex = ReadonlyMap<string, Object3D>;

function partNodes(product: ProductDefinition, index: NodeIndex, partIds: readonly string[]) {
  const names = product.parts.filter((p) => partIds.includes(p.id)).flatMap((p) => p.nodes);
  return names.flatMap((name) => index.get(name) ?? []);
}

const FOOTPRINT_AXES = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] } as const;

/**
 * The height the model was exported at: the upper surface of the widest mesh under the
 * reference part (for a desk, the top; not the monitor standing on it), above the lowest
 * point of the model (the floor), in units. Other parts nested below are skipped.
 */
function measureModelledValue(
  motion: Motion,
  product: ProductDefinition,
  scene: Object3D,
  index: NodeIndex,
  boundaries: PartBoundaries,
) {
  const axis = motion.axis;
  const [a, b] = FOOTPRINT_AXES[axis];
  const floor = modelBounds(scene, product.model).min[axis];
  const transform = modelTransform(product.model);
  const size = new Vector3();
  let widest = { area: 0, top: -Infinity };
  for (const root of partNodes(product, index, [motion.referencePart ?? ''])) {
    for (const mesh of collectMeshes(root, boundaries)) {
      const box = meshBounds(mesh, scene, transform);
      box.getSize(size);
      const area = size[a] * size[b];
      if (area > widest.area) widest = { area, top: box.max[axis] };
    }
  }
  if (!Number.isFinite(widest.top)) {
    console.warn(`[configurator] ${motion.id}: the reference object has no geometry`);
    return motion.initial ?? motion.min;
  }
  // Round away float noise so a desk modelled at 72 cm reads as exactly 72.
  return Math.round(((widest.top - floor) / motion.metresPerUnit) * 10) / 10;
}

function resolveMotions(
  scene: Object3D,
  index: NodeIndex,
  product: ProductDefinition,
  boundaries: PartBoundaries,
): ResolvedMotion[] {
  // Put every moved node back where the glTF has it, so measurements see the authored pose.
  for (const motion of product.motions) {
    for (const move of motion.moves) {
      for (const node of partNodes(product, index, move.parts)) {
        node.position.copy(authoredPosition(node));
      }
    }
  }

  return product.motions.map((motion) => {
    const factors = new Map<Object3D, number>();
    for (const move of motion.moves) {
      for (const node of partNodes(product, index, move.parts)) factors.set(node, move.factor);
    }
    const nodes = [...factors].map(([node, factor]) => {
      let ancestorFactor = 0;
      for (let parent = node.parent; parent && parent !== scene; parent = parent.parent) {
        const found = factors.get(parent);
        if (found !== undefined) {
          ancestorFactor = found;
          break;
        }
      }
      return { node, factor, localFactor: factor - ancestorFactor };
    });
    return {
      motion,
      modelledValue:
        motion.modelledValue ?? measureModelledValue(motion, product, scene, index, boundaries),
      speed: motion.speed ?? (motion.max - motion.min) / 3,
      nodes,
    };
  });
}

/**
 * Grows `box` (the model's authored bounds) to everything the motions can reach, so the
 * camera can frame a desk at full height without refitting while it moves.
 */
export function motionEnvelope(box: Box3, motions: readonly ResolvedMotion[], modelScale: number) {
  const envelope = box.clone();
  for (const { motion, modelledValue, nodes } of motions) {
    const factor = Math.max(0, ...nodes.map((n) => n.factor));
    const reach = (value: number) =>
      (value - modelledValue) * motion.metresPerUnit * modelScale * factor;
    envelope.max[motion.axis] += Math.max(0, reach(motion.max));
    envelope.min[motion.axis] += Math.min(0, reach(motion.min));
  }
  return envelope;
}

const parentBasis = new Matrix3();
const localDirection = new Vector3();

/**
 * Drives the product's motions: poses the moved nodes for the current values and animates
 * them towards the targets in the motion store at a constant, motor-like speed. Returns the
 * resolved motions (for camera framing).
 */
export function useMotions(
  scene: Object3D,
  index: NodeIndex,
  product: ProductDefinition,
  boundaries: PartBoundaries,
) {
  const invalidate = useThree((state) => state.invalidate);
  const motions = useMemo(
    () => resolveMotions(scene, index, product, boundaries),
    [scene, index, product, boundaries],
  );
  const current = useRef(new Map<string, number>());

  const applyPose = useMemo(() => {
    return () => {
      // Sum per node, so several motions may move the same node.
      const offsets = new Map<Object3D, Vector3>();
      for (const { motion, modelledValue, nodes } of motions) {
        const value = current.current.get(motion.id) ?? modelledValue;
        const distance = (value - modelledValue) * motion.metresPerUnit;
        for (const { node, localFactor } of nodes) {
          // The offset is along the scene axis; express it in the parent's frame, which may
          // be rotated or scaled in the export.
          const parent = node.parent;
          localDirection.copy(AXIS_VECTOR[motion.axis]);
          if (parent && parent !== scene) {
            parentBasis.setFromMatrix4(matrixRelativeTo(parent, scene)).invert();
            localDirection.applyMatrix3(parentBasis);
          }
          const offset = offsets.get(node) ?? new Vector3();
          offsets.set(node, offset.addScaledVector(localDirection, distance * localFactor));
        }
      }
      for (const [node, offset] of offsets) node.position.copy(authoredPosition(node)).add(offset);
      invalidate();
    };
  }, [motions, scene, invalidate]);

  // A new product (or a remount) starts from wherever the store says the motion is; the
  // first time, from `initial`, or else the height the model was exported at.
  useEffect(() => {
    const store = useMotionStore.getState();
    current.current = new Map(
      motions.map(({ motion, modelledValue }) => {
        const clamp = (v: number) => Math.min(motion.max, Math.max(motion.min, v));
        const value = store.current[motion.id] ?? clamp(motion.initial ?? modelledValue);
        store.start(motion.id, value);
        return [motion.id, value];
      }),
    );
    applyPose();
  }, [motions, applyPose]);

  // Wake the demand-driven render loop whenever a target changes.
  useEffect(
    () =>
      useMotionStore.subscribe((state, previous) => {
        if (state.targets !== previous.targets) invalidate();
      }),
    [invalidate],
  );

  useFrame((_, delta) => {
    if (motions.length === 0) return;
    const { targets, setCurrent } = useMotionStore.getState();
    const step = Math.min(delta, MAX_FRAME_SECONDS);
    let changed = false;
    for (const { motion, speed, modelledValue } of motions) {
      const value = current.current.get(motion.id) ?? modelledValue;
      const target = targets[motion.id] ?? value;
      if (value === target) continue;
      const next =
        Math.abs(target - value) <= speed * step
          ? target
          : value + Math.sign(target - value) * speed * step;
      current.current.set(motion.id, next);
      setCurrent(motion.id, next);
      changed = true;
    }
    // Posing invalidates, which keeps frames coming until every motion has arrived.
    if (changed) applyPose();
  });

  return motions;
}
