import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  Color,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import type { MaterialPreset } from '@/products/schema';
import { collectMeshes } from './nodeUtils';

interface PartAppearanceProps {
  node: Object3D;
  preset: MaterialPreset;
}

type TextureMaps = NonNullable<MaterialPreset['textureMaps']>;
type LoadedTextures = Partial<Record<keyof TextureMaps, Texture>>;

const NO_TEXTURES: LoadedTextures = {};

/**
 * Applies a material preset to every mesh under `node`.
 *
 * Materials in a glTF are often shared between meshes, so each mesh gets its own
 * clone with the preset applied; the original is restored (and the clone disposed)
 * when the preset changes or the part unmounts.
 */
export function PartAppearance({ node, preset }: PartAppearanceProps) {
  const mapCount = Object.keys(preset.textureMaps ?? {}).length;
  return mapCount > 0 ? (
    <TexturedAppearance node={node} preset={preset} />
  ) : (
    <AppearanceEffect node={node} preset={preset} textures={NO_TEXTURES} />
  );
}

function TexturedAppearance({ node, preset }: PartAppearanceProps) {
  const urls = useMemo(() => {
    const entries: [string, string][] = [];
    for (const [key, url] of Object.entries(preset.textureMaps ?? {})) {
      if (url) entries.push([key, url]);
    }
    return Object.fromEntries(entries);
  }, [preset.textureMaps]);
  const textures = useTexture(urls, (loaded) => {
    // Colour textures are authored in sRGB; data maps (normal/roughness) stay linear.
    const colorMap = (loaded as LoadedTextures).map;
    if (colorMap) colorMap.colorSpace = SRGBColorSpace;
  }) as LoadedTextures;
  return <AppearanceEffect node={node} preset={preset} textures={textures} />;
}

function AppearanceEffect({
  node,
  preset,
  textures,
}: PartAppearanceProps & { textures: LoadedTextures }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const applyPreset = (material: Material): MeshStandardMaterial => {
      const clone =
        material instanceof MeshStandardMaterial ? material.clone() : new MeshStandardMaterial();
      clone.color = new Color(preset.color);
      clone.roughness = preset.roughness;
      clone.metalness = preset.metalness;
      clone.map = textures.map ?? null;
      clone.normalMap = textures.normalMap ?? null;
      clone.roughnessMap = textures.roughnessMap ?? null;
      clone.metalnessMap = textures.metalnessMap ?? null;
      clone.needsUpdate = true;
      return clone;
    };

    const swapped = collectMeshes(node).map((mesh) => {
      const original = mesh.material;
      const clones = Array.isArray(original) ? original.map(applyPreset) : [applyPreset(original)];
      mesh.material = Array.isArray(original) ? clones : (clones[0] ?? original);
      return { mesh, original, clones };
    });
    invalidate();

    return () => {
      for (const { mesh, original, clones } of swapped) {
        mesh.material = original;
        for (const clone of clones) clone.dispose();
      }
      invalidate();
    };
  }, [node, preset, textures, invalidate]);

  return null;
}
