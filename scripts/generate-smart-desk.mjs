/**
 * Generates `public/models/smart-desk.glb`, the placeholder smart desk, and
 * `src/products/definitions/smart-desk.geometry.json` with the hinge angles the
 * definition needs to line the touch screen up with the 4K screen.
 *
 * Everything that must rise with the desk top lives under `TopAssembly`, so a single
 * pose offset on that node lifts the top, screens, drawer and trays together:
 *
 *   TopAssembly
 *     Top, Drawer, CableTray, KeyboardTray
 *     TouchScreens > TouchScreenRecess_<size>, TouchScreenPivot_<size> > TouchScreen_<size>
 *     MonitorMount > MonitorMount_Arm > Monitor4K > SideMonitorLeft, SideMonitorRight
 *     Leg_C_Lift (telescoping inner columns + beam of the sit/stand frame)
 *   Leg_A_*, Leg_B_*, Leg_C_* (fixed leg variants)
 *
 * Usage: `npm run generate:models`
 */
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GltfBuilder, quat } from './gltf-builder.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = resolve(ROOT, 'public/models/smart-desk.glb');
const GEOMETRY_PATH = resolve(ROOT, 'src/products/definitions/smart-desk.geometry.json');

const b = new GltfBuilder('SmartDesk');

const materials = {
  top: b.material('Top', [0.82, 0.68, 0.5], { roughness: 0.6, metalness: 0 }),
  frame: b.material('Frame', [0.12, 0.12, 0.13], { roughness: 0.45, metalness: 0.8 }),
  drawer: b.material('Drawer', [0.9, 0.9, 0.88], { roughness: 0.5, metalness: 0 }),
  tray: b.material('Tray', [0.2, 0.2, 0.21], { roughness: 0.5, metalness: 0.6 }),
  bezel: b.material('Bezel', [0.05, 0.05, 0.055], { roughness: 0.35, metalness: 0.2 }),
  screen: b.material('Screen', [0.01, 0.012, 0.02], {
    roughness: 0.12,
    metalness: 0,
    emissive: [0.05, 0.09, 0.15],
  }),
};

// Dimensions in metres. Floor is y = 0, desk top surface at 0.76 m.
const TOP = { w: 1.4, h: 0.04, d: 0.7, y: 0.74 };
const TOP_SURFACE = TOP.y + TOP.h / 2;
const TOP_UNDERSIDE = TOP.y - TOP.h / 2;
const LEG_X = 0.55; // legs sit inside the 120 cm top so the narrowest width still covers them
const LEG_H = TOP_UNDERSIDE;
const RAD = (deg) => (deg * Math.PI) / 180;

const top = b.node('Top', {
  position: [0, TOP.y, 0],
  mesh: b.box('TopMesh', [TOP.w, TOP.h, TOP.d], materials.top, 0.008),
});

const drawer = b.node('Drawer', {
  position: [0.4, TOP_UNDERSIDE - 0.06, 0.1],
  mesh: b.box('DrawerMesh', [0.34, 0.12, 0.36], materials.drawer, 0.006),
});

const cableTray = b.node('CableTray', {
  position: [0, TOP_UNDERSIDE - 0.05, -0.26],
  mesh: b.box('CableTrayMesh', [0.9, 0.08, 0.14], materials.tray),
});

// Keyboard tray: two slide rails under the top, the tray itself pulled out past the front edge.
const rail = b.box('KeyboardTray_RailMesh', [0.02, 0.03, 0.3], materials.tray);
const keyboardTray = b.node('KeyboardTray', {
  position: [0, TOP_UNDERSIDE, 0],
  children: [
    b.node('KeyboardTray_RailLeft', { position: [-0.31, -0.015, 0.2], mesh: rail }),
    b.node('KeyboardTray_RailRight', { position: [0.31, -0.015, 0.2], mesh: rail }),
    b.node('KeyboardTray_Board', {
      position: [0, -0.04, 0.32],
      mesh: b.box('KeyboardTray_BoardMesh', [0.6, 0.02, 0.3], materials.drawer, 0.006),
    }),
  ],
});

// 4K screen on a rear-edge mount: a clamp and post at the back of the top, an arm that
// reaches forward to the back of the display. Side monitors hang off the 4K screen and are
// angled 15 degrees towards the user around their inner edge. Positions are relative to the
// desk top surface (`MonitorMount` sits on it).
const MON = { w: 0.96, h: 0.54, t: 0.03, bottomY: 0.26, frontZ: -0.15 };
const MOUNT = { z: -0.33, postRadius: 0.02 };
const SIDE = { w: 0.28, h: 0.5, t: 0.03, yaw: 15 };

// Touch screen sizes (16:9 diagonals). Each panel lies flush in the top with its hinge along
// the FRONT edge; tilting raises the far edge like a drafting table. The steepest preset is
// solved per size so the far edge stops just under the bottom edge of the 4K screen:
//   far edge at tilt θ = (D·sinθ, hingeZ − D·cosθ)  →  θ = asin(targetY / D), hingeZ = targetZ + D·cosθ
const TOUCH = { bodyH: 0.012, panelInset: 0.015, gap: 0.006, hingeRadius: 0.006 };
const TOUCH_TARGET = { y: MON.bottomY - TOUCH.gap, z: MON.frontZ + TOUCH.gap };
const TOUCH_SIZES = [24, 27, 32].map((inches) => {
  const diagonal = inches * 0.0254;
  const depth = diagonal * (9 / Math.sqrt(16 * 16 + 9 * 9));
  const width = depth * (16 / 9);
  const draftingAngle = (Math.asin(TOUCH_TARGET.y / depth) * 180) / Math.PI;
  const hingeZ = TOUCH_TARGET.z + depth * Math.cos(RAD(draftingAngle));
  return { inches, width, depth, draftingAngle, hingeZ };
});

/** One touch screen size: a recess in the top plus a pivot on the front edge carrying the screen. */
function touchScreen({ inches, width, depth, hingeZ }) {
  const name = `TouchScreen_${inches}`;
  const recessMargin = 0.008;
  return [
    b.node(`TouchScreenRecess_${inches}`, {
      position: [0, TOP_SURFACE + 0.0005, hingeZ - depth / 2],
      mesh: b.box(
        `${name}_RecessMesh`,
        [width + 2 * recessMargin, 0.001, depth + 2 * recessMargin],
        materials.tray,
      ),
    }),
    b.node(`TouchScreenPivot_${inches}`, {
      // Hinge line: top of the screen body, along the front edge, 1.5 mm above the top surface.
      position: [0, TOP_SURFACE + 0.0015, hingeZ],
      children: [
        b.node(`${name}_Hinge`, {
          rotation: quat([0, 0, 1], 90),
          mesh: b.cylinder(
            `${name}_HingeMesh`,
            { radiusTop: TOUCH.hingeRadius, height: width + 0.02 },
            materials.frame,
            24,
          ),
        }),
        b.node(name, {
          position: [0, -TOUCH.bodyH / 2, -depth / 2],
          mesh: b.box(`${name}_BodyMesh`, [width, TOUCH.bodyH, depth], materials.bezel, 0.003),
          children: [
            b.node(`${name}_Panel`, {
              position: [0, TOUCH.bodyH / 2 + 0.0005, 0],
              mesh: b.box(
                `${name}_PanelMesh`,
                [width - TOUCH.panelInset, 0.001, depth - TOUCH.panelInset],
                materials.screen,
              ),
            }),
          ],
        }),
      ],
    }),
  ];
}
const touchScreens = b.node('TouchScreens', { children: TOUCH_SIZES.flatMap(touchScreen) });

function display(name, { w, h, t }) {
  return {
    mesh: b.box(`${name}_BodyMesh`, [w, h, t], materials.bezel, 0.006),
    children: [
      b.node(`${name}_Panel`, {
        position: [0, 0, t / 2 + 0.0005],
        mesh: b.box(`${name}_PanelMesh`, [w - 0.03, h - 0.03, 0.001], materials.screen),
      }),
    ],
  };
}
function sideMonitor(side) {
  const sign = side === 'Left' ? -1 : 1;
  return b.node(`SideMonitor${side}`, {
    position: [sign * (MON.w / 2 + 0.005), 0, 0],
    rotation: quat([0, 1, 0], sign * SIDE.yaw),
    children: [
      b.node(`SideMonitor${side}_Display`, {
        position: [sign * (SIDE.w / 2), 0, 0],
        ...display(`SideMonitor${side}`, SIDE),
      }),
    ],
  });
}
const monCentreY = MON.bottomY + MON.h / 2;
const monCentreZ = MON.frontZ - MON.t / 2;
const monitor4K = b.node('Monitor4K', {
  // Relative to `MonitorMount`, which sits on the top surface at the rear edge.
  position: [0, monCentreY, monCentreZ - MOUNT.z],
  ...display('Monitor4K', MON),
});
monitor4K.addChild(sideMonitor('Left'));
monitor4K.addChild(sideMonitor('Right'));
const armLength = monCentreZ - MON.t / 2 - MOUNT.z;
const monitorMount = b.node('MonitorMount', {
  position: [0, TOP_SURFACE, MOUNT.z],
  children: [
    b.node('MonitorMount_Base', {
      position: [0, 0.006, 0],
      mesh: b.box('MonitorMount_BaseMesh', [0.16, 0.012, 0.05], materials.frame, 0.004),
    }),
    b.node('MonitorMount_Post', {
      position: [0, monCentreY / 2, 0],
      mesh: b.cylinder(
        'MonitorMount_PostMesh',
        { radiusTop: MOUNT.postRadius, height: monCentreY },
        materials.frame,
      ),
    }),
    b.node('MonitorMount_Arm', {
      position: [0, monCentreY, armLength / 2],
      mesh: b.box('MonitorMount_ArmMesh', [0.04, 0.03, armLength], materials.frame, 0.004),
    }),
    monitor4K,
  ],
});

/** Style A: straight "loop" legs, two posts joined by a floor rail. */
function loopLeg(name, x) {
  const post = b.box(`${name}_Post`, [0.05, LEG_H, 0.05], materials.frame);
  return b.node(name, {
    position: [x, 0, 0],
    children: [
      b.node(`${name}_PostFront`, { position: [0, LEG_H / 2, 0.28], mesh: post }),
      b.node(`${name}_PostBack`, { position: [0, LEG_H / 2, -0.28], mesh: post }),
      b.node(`${name}_Rail`, {
        position: [0, 0.025, 0],
        mesh: b.box(`${name}_RailMesh`, [0.05, 0.05, 0.61], materials.frame),
      }),
    ],
  });
}

/** Style B: A-frame legs, two angled posts joined by a cross bar. */
function aFrameLeg(name, x) {
  const tilt = 14;
  const postLength = LEG_H / Math.cos(RAD(tilt));
  const post = b.box(`${name}_Post`, [0.05, postLength, 0.05], materials.frame);
  const spread = (LEG_H / 2) * Math.tan(RAD(tilt));
  // Cross bar spans exactly between the two angled posts at its height.
  const barY = 0.3;
  const barLength = 2 * (spread + (LEG_H / 2 - barY) * Math.tan(RAD(tilt)));
  return b.node(name, {
    position: [x, 0, 0],
    children: [
      b.node(`${name}_PostFront`, {
        position: [0, LEG_H / 2, spread],
        rotation: quat([1, 0, 0], -tilt),
        mesh: post,
      }),
      b.node(`${name}_PostBack`, {
        position: [0, LEG_H / 2, -spread],
        rotation: quat([1, 0, 0], tilt),
        mesh: post,
      }),
      b.node(`${name}_Bar`, {
        position: [0, barY, 0],
        mesh: b.box(`${name}_BarMesh`, [0.05, 0.04, barLength], materials.frame),
      }),
    ],
  });
}

/** Style C: sit/stand column. The outer column stands on the floor ... */
const LIFT = { outerH: 0.5, innerH: 0.62, innerBottom: 0.1 };
function liftLeg(name, x) {
  return b.node(name, {
    position: [x, 0, 0],
    children: [
      b.node(`${name}_Foot`, {
        position: [0, 0.015, 0],
        mesh: b.box(`${name}_FootMesh`, [0.08, 0.03, 0.62], materials.frame, 0.006),
      }),
      b.node(`${name}_Outer`, {
        position: [0, 0.03 + LIFT.outerH / 2, 0],
        mesh: b.box(`${name}_OuterMesh`, [0.09, LIFT.outerH, 0.09], materials.frame, 0.006),
      }),
    ],
  });
}
/** ... and the inner columns hang from the top assembly, so they telescope out when it rises. */
const inner = b.box('Leg_C_InnerMesh', [0.06, LIFT.innerH, 0.06], materials.frame);
const lift = b.node('Leg_C_Lift', {
  children: [
    b.node('Leg_C_InnerLeft', {
      position: [-LEG_X, LIFT.innerBottom + LIFT.innerH / 2, 0],
      mesh: inner,
    }),
    b.node('Leg_C_InnerRight', {
      position: [LEG_X, LIFT.innerBottom + LIFT.innerH / 2, 0],
      mesh: inner,
    }),
    b.node('Leg_C_Beam', {
      position: [0, TOP_UNDERSIDE - 0.025, -0.13],
      mesh: b.box('Leg_C_BeamMesh', [2 * LEG_X + 0.06, 0.05, 0.06], materials.frame),
    }),
  ],
});

b.add(
  b.node('TopAssembly', {
    children: [top, drawer, cableTray, keyboardTray, touchScreens, monitorMount, lift],
  }),
  loopLeg('Leg_A_Left', -LEG_X),
  loopLeg('Leg_A_Right', LEG_X),
  aFrameLeg('Leg_B_Left', -LEG_X),
  aFrameLeg('Leg_B_Right', LEG_X),
  liftLeg('Leg_C_Left', -LEG_X),
  liftLeg('Leg_C_Right', LEG_X),
);

await b.write(OUT_PATH);

// The definition reads the solved angles so a regenerated model never drifts from its presets.
const geometry = {
  touchScreenSizes: TOUCH_SIZES.map(({ inches, width, depth, draftingAngle, hingeZ }) => ({
    inches,
    widthM: Number(width.toFixed(3)),
    depthM: Number(depth.toFixed(3)),
    hingeZ: Number(hingeZ.toFixed(3)),
    draftingAngleDeg: Number(draftingAngle.toFixed(1)),
  })),
};
await writeFile(GEOMETRY_PATH, `${JSON.stringify(geometry, null, 2)}\n`);
console.log(`Wrote ${GEOMETRY_PATH}`);
for (const size of geometry.touchScreenSizes) {
  const rear = (size.hingeZ - size.depthM).toFixed(3);
  console.log(
    `  ${size.inches}": hinge z=${size.hingeZ}, flat rear edge z=${rear}, drafting ${size.draftingAngleDeg}°`,
  );
}
