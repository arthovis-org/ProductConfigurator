import { CanvasTexture, SRGBColorSpace } from 'three';

/** Draws into a fresh canvas and wraps it as an sRGB, anisotropically filtered texture. */
export function createCanvasTexture(draw: (canvas: HTMLCanvasElement) => void, anisotropy: number) {
  const canvas = document.createElement('canvas');
  draw(canvas);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}
