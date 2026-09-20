/**
 * Small helper around @gltf-transform/core for building placeholder models out of
 * Three.js geometries. Every part is a named node with a named material, mirroring
 * what a Blender export produces, so definitions written against these files keep
 * working when the real models replace them.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { BoxGeometry, CylinderGeometry, Quaternion, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Quaternion (as `[x, y, z, w]`) for a rotation of `degrees` around `axis`. */
export const quat = (axis, degrees) =>
  new Quaternion().setFromAxisAngle(new Vector3(...axis), (degrees * Math.PI) / 180).toArray();

export class GltfBuilder {
  constructor(sceneName) {
    this.doc = new Document();
    this.buffer = this.doc.createBuffer();
    this.scene = this.doc.createScene(sceneName);
  }

  /**
   * @param {string} name
   * @param {[number, number, number]} rgb linear base colour
   * @param {{ roughness: number; metalness: number; emissive?: [number, number, number] }} props
   */
  material(name, rgb, { roughness, metalness, emissive }) {
    const mat = this.doc
      .createMaterial(name)
      .setBaseColorFactor([...rgb, 1])
      .setRoughnessFactor(roughness)
      .setMetallicFactor(metalness);
    if (emissive) mat.setEmissiveFactor(emissive);
    return mat;
  }

  /** Builds a glTF mesh from any Three.js BufferGeometry (non-indexed ones are indexed first). */
  mesh(name, input, material) {
    const geometry = input.getIndex() ? input : mergeVertices(input);
    const accessor = (attr, type) =>
      this.doc
        .createAccessor()
        .setType(type)
        .setArray(geometry.getAttribute(attr).array)
        .setBuffer(this.buffer);
    const index = geometry.getIndex().array;
    const indices = this.doc
      .createAccessor()
      .setType('SCALAR')
      .setArray(index.length > 65535 ? new Uint32Array(index) : new Uint16Array(index))
      .setBuffer(this.buffer);
    const primitive = this.doc
      .createPrimitive()
      .setAttribute('POSITION', accessor('position', 'VEC3'))
      .setAttribute('NORMAL', accessor('normal', 'VEC3'))
      .setAttribute('TEXCOORD_0', accessor('uv', 'VEC2'))
      .setIndices(indices)
      .setMaterial(material);
    return this.doc.createMesh(name).addPrimitive(primitive);
  }

  /** Box mesh; a `radius` > 0 rounds the edges. */
  box(name, [w, h, d], material, radius = 0) {
    const geometry =
      radius > 0 ? new RoundedBoxGeometry(w, h, d, 4, radius) : new BoxGeometry(w, h, d);
    return this.mesh(name, geometry, material);
  }

  /** Cylinder (or cone when the radii differ) along the local Y axis. */
  cylinder(name, { radiusTop, radiusBottom = radiusTop, height }, material, segments = 32) {
    return this.mesh(
      name,
      new CylinderGeometry(radiusTop, radiusBottom, height, segments),
      material,
    );
  }

  /**
   * @param {string} name
   * @param {object} [opts]
   * @param {[number, number, number]} [opts.position]
   * @param {[number, number, number, number]} [opts.rotation] quaternion
   * @param {import('@gltf-transform/core').Mesh} [opts.mesh]
   * @param {import('@gltf-transform/core').Node[]} [opts.children]
   */
  node(name, { position = [0, 0, 0], rotation, mesh, children = [] } = {}) {
    const n = this.doc.createNode(name).setTranslation(position);
    if (rotation) n.setRotation(rotation);
    if (mesh) n.setMesh(mesh);
    for (const child of children) n.addChild(child);
    return n;
  }

  add(...nodes) {
    for (const n of nodes) this.scene.addChild(n);
  }

  async write(outPath) {
    await mkdir(dirname(outPath), { recursive: true });
    const glb = await new NodeIO().writeBinary(this.doc);
    await writeFile(outPath, glb);
    console.log(`Wrote ${outPath} (${(glb.byteLength / 1024).toFixed(1)} kB)`);
  }
}
