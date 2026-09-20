/**
 * Generates `public/models/placeholder-desk.glb`: a simple desk built from boxes.
 *
 * Every configurable part is its own named node so that a product definition
 * can reference it (see src/products/definitions/placeholder-desk.ts).
 * Materials are named too, mirroring what a Blender export produces.
 *
 * Usage: `npm run generate:placeholder`
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { BoxGeometry, Quaternion, Vector3 } from 'three';

const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/models/placeholder-desk.glb',
);

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('PlaceholderDesk');

/** @param {string} name @param {[number, number, number]} rgb */
function material(name, rgb, { roughness, metalness }) {
  return doc
    .createMaterial(name)
    .setBaseColorFactor([...rgb, 1])
    .setRoughnessFactor(roughness)
    .setMetallicFactor(metalness);
}

const materials = {
  top: material('Top', [0.82, 0.68, 0.5], { roughness: 0.6, metalness: 0 }),
  frame: material('Frame', [0.12, 0.12, 0.13], { roughness: 0.45, metalness: 0.8 }),
  drawer: material('Drawer', [0.9, 0.9, 0.88], { roughness: 0.5, metalness: 0 }),
  tray: material('Tray', [0.2, 0.2, 0.21], { roughness: 0.5, metalness: 0.6 }),
};

/** Builds a glTF mesh from a Three.js BoxGeometry so we don't hand-write vertex data. */
function boxMesh(name, [w, h, d], mat) {
  const geometry = new BoxGeometry(w, h, d);
  const accessor = (attr, type) =>
    doc
      .createAccessor()
      .setType(type)
      .setArray(geometry.getAttribute(attr).array)
      .setBuffer(buffer);
  const indices = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Uint16Array(geometry.getIndex().array))
    .setBuffer(buffer);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', accessor('position', 'VEC3'))
    .setAttribute('NORMAL', accessor('normal', 'VEC3'))
    .setAttribute('TEXCOORD_0', accessor('uv', 'VEC2'))
    .setIndices(indices)
    .setMaterial(mat);
  return doc.createMesh(name).addPrimitive(primitive);
}

/**
 * @param {string} name
 * @param {object} opts
 * @param {[number, number, number]} [opts.position]
 * @param {[number, number, number, number]} [opts.rotation] quaternion
 * @param {import('@gltf-transform/core').Mesh} [opts.mesh]
 */
function node(name, { position = [0, 0, 0], rotation, mesh } = {}) {
  const n = doc.createNode(name).setTranslation(position);
  if (rotation) n.setRotation(rotation);
  if (mesh) n.setMesh(mesh);
  return n;
}

const quat = (axis, degrees) =>
  new Quaternion().setFromAxisAngle(new Vector3(...axis), (degrees * Math.PI) / 180).toArray();

// Dimensions in metres. Floor is y = 0, desk top surface at ~0.75 m.
const TOP = { w: 1.4, h: 0.04, d: 0.7, y: 0.74 };
const LEG_X = 0.55; // legs sit inside the 120 cm top so the narrowest width still covers them
const LEG_H = TOP.y - TOP.h / 2;

scene.addChild(
  node('Top', {
    position: [0, TOP.y, 0],
    mesh: boxMesh('TopMesh', [TOP.w, TOP.h, TOP.d], materials.top),
  }),
);

/** Style A: straight "loop" legs, two posts joined by a floor rail. */
function loopLeg(name, x) {
  const leg = node(name, { position: [x, 0, 0] });
  const post = boxMesh(`${name}_Post`, [0.05, LEG_H, 0.05], materials.frame);
  leg.addChild(node(`${name}_PostFront`, { position: [0, LEG_H / 2, 0.28], mesh: post }));
  leg.addChild(node(`${name}_PostBack`, { position: [0, LEG_H / 2, -0.28], mesh: post }));
  leg.addChild(
    node(`${name}_Rail`, {
      position: [0, 0.025, 0],
      mesh: boxMesh(`${name}_RailMesh`, [0.05, 0.05, 0.61], materials.frame),
    }),
  );
  return leg;
}

/** Style B: A-frame legs, two angled posts joined by a cross bar. */
function aFrameLeg(name, x) {
  const leg = node(name, { position: [x, 0, 0] });
  const tilt = 14;
  const postLength = LEG_H / Math.cos((tilt * Math.PI) / 180);
  const post = boxMesh(`${name}_Post`, [0.05, postLength, 0.05], materials.frame);
  const spread = (LEG_H / 2) * Math.tan((tilt * Math.PI) / 180);
  leg.addChild(
    node(`${name}_PostFront`, {
      position: [0, LEG_H / 2, spread],
      rotation: quat([1, 0, 0], -tilt),
      mesh: post,
    }),
  );
  leg.addChild(
    node(`${name}_PostBack`, {
      position: [0, LEG_H / 2, -spread],
      rotation: quat([1, 0, 0], tilt),
      mesh: post,
    }),
  );
  // Cross bar spans exactly between the two angled posts at its height.
  const barY = 0.3;
  const barLength = 2 * (spread + (LEG_H / 2 - barY) * Math.tan((tilt * Math.PI) / 180));
  leg.addChild(
    node(`${name}_Bar`, {
      position: [0, barY, 0],
      mesh: boxMesh(`${name}_BarMesh`, [0.05, 0.04, barLength], materials.frame),
    }),
  );
  return leg;
}

scene.addChild(loopLeg('Leg_A_Left', -LEG_X));
scene.addChild(loopLeg('Leg_A_Right', LEG_X));
scene.addChild(aFrameLeg('Leg_B_Left', -LEG_X));
scene.addChild(aFrameLeg('Leg_B_Right', LEG_X));

scene.addChild(
  node('Drawer', {
    position: [0.22, TOP.y - TOP.h / 2 - 0.06, 0.05],
    mesh: boxMesh('DrawerMesh', [0.5, 0.12, 0.45], materials.drawer),
  }),
);
scene.addChild(
  node('CableTray', {
    position: [0, TOP.y - TOP.h / 2 - 0.05, -0.26],
    mesh: boxMesh('CableTrayMesh', [0.9, 0.08, 0.14], materials.tray),
  }),
);

await mkdir(dirname(OUT_PATH), { recursive: true });
const glb = await new NodeIO().writeBinary(doc);
await writeFile(OUT_PATH, glb);
console.log(`Wrote ${OUT_PATH} (${(glb.byteLength / 1024).toFixed(1)} kB)`);
