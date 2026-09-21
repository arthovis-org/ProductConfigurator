import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Color, MeshStandardMaterial, type Object3D } from 'three';
import { renderScreen, type ScreenSpec } from '@/screens/renderScreen';
import { createCanvasTexture } from './canvasTexture';
import { swapMaterials } from './nodeUtils';

interface ScreenSurfaceProps {
  /** The panel node; every mesh under it gets the screen material. */
  node: Object3D;
  /** Interned spec (see `internSpec`) so the texture is only redrawn when content changes. */
  spec: ScreenSpec;
}

/**
 * Draws a screen's content to an offscreen canvas and shows it on the panel as a lit
 * display: the canvas is both the colour map and the emissive map, so the picture stays
 * readable regardless of the studio lighting.
 */
export function ScreenSurface({ node, spec }: ScreenSurfaceProps) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const texture = createCanvasTexture(
      (canvas) => renderScreen(canvas, spec),
      gl.capabilities.getMaxAnisotropy(),
    );
    const material = new MeshStandardMaterial({
      map: texture,
      emissive: new Color('#ffffff'),
      emissiveMap: texture,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0,
    });
    // Every mesh shares the one material; `restore` disposes it once per mesh, which is safe.
    const restore = swapMaterials(node, () => material);
    invalidate();

    return () => {
      restore();
      texture.dispose();
      invalidate();
    };
  }, [node, spec, gl, invalidate]);

  return null;
}
