import { publicAsset } from '../assets';
import type { PoseTransform, ProductDefinitionInput } from '../schema';
import geometry from './smart-desk.geometry.json';

/** Touch screen sizes and the hinge angles solved by `scripts/generate-smart-desk.mjs`. */
const touchSizes = geometry.touchScreenSizes;
const touchPivots = touchSizes.map((size) => `TouchScreenPivot_${size.inches}`);
const touchParts = touchSizes.map((size) => `touch-${size.inches}`);
const screenParts = [...touchParts, 'monitor-4k', 'side-monitors'];
/** Rotates every size's pivot by the same angle; only the selected size is visible. */
const touchTilt = (degrees: number): PoseTransform[] => [
  { nodes: touchPivots, rotation: [degrees, 0, 0] },
];

/**
 * Smart desk with embedded touch screen, mounted 4K display and sit/stand frame.
 * The placeholder model comes from `scripts/generate-smart-desk.mjs`; the real
 * Blender model must keep the same node names and nesting (see docs/ARCHITECTURE.md).
 */
export const smartDesk: ProductDefinitionInput = {
  id: 'smart-desk',
  name: 'Smart Desk',
  description:
    'A workstation with an embedded touch screen on a drafting hinge, a desk-mounted 4K display and an optional sit/stand frame.',
  model: { src: publicAsset('models/smart-desk.glb') },
  basePrice: 1290,
  currency: 'EUR',

  parts: [
    { id: 'top', label: 'Desk top', nodes: ['Top'], group: 'Surface' },
    { id: 'legs-loop', label: 'Loop legs', nodes: ['Leg_A_Left', 'Leg_A_Right'], group: 'Base' },
    {
      id: 'legs-aframe',
      label: 'A-frame legs',
      nodes: ['Leg_B_Left', 'Leg_B_Right'],
      group: 'Base',
    },
    {
      id: 'legs-sitstand',
      label: 'Sit/stand columns',
      // Outer columns stand on the floor; `Leg_C_Lift` (inner columns + beam) rises with the top.
      nodes: ['Leg_C_Left', 'Leg_C_Right', 'Leg_C_Lift'],
      group: 'Base',
    },
    { id: 'drawer', label: 'Drawer', nodes: ['Drawer'], group: 'Storage', optional: true },
    {
      id: 'cable-tray',
      label: 'Cable tray',
      nodes: ['CableTray'],
      group: 'Storage',
      optional: true,
    },
    {
      id: 'keyboard-tray',
      label: 'Keyboard tray',
      nodes: ['KeyboardTray'],
      group: 'Storage',
      optional: true,
    },
    {
      id: 'touch-screen',
      label: 'Touch screen',
      nodes: ['TouchScreens'],
      group: 'Displays',
      optional: true,
    },
    ...touchSizes.map((size) => ({
      id: `touch-${size.inches}`,
      label: `${size.inches}" touch panel`,
      nodes: [`TouchScreenPivot_${size.inches}`, `TouchScreenRecess_${size.inches}`],
      group: 'Displays',
      partOf: 'touch-screen',
      screens: [
        {
          node: `TouchScreen_${size.inches}_Panel`,
          widthPx: 1920,
          heightPx: 1080,
          kind: 'touch' as const,
          content: { layout: 'sidebar-main' as const },
        },
      ],
    })),
    {
      id: 'monitor-4k',
      label: '4K screen',
      nodes: ['MonitorMount'],
      group: 'Displays',
      optional: true,
      screens: [{ node: 'Monitor4K_Panel', widthPx: 3840, heightPx: 2160 }],
    },
    {
      id: 'side-monitors',
      label: 'Side monitors',
      nodes: ['SideMonitorLeft', 'SideMonitorRight'],
      group: 'Displays',
      optional: true,
      // Portrait panels stack their panes; no layout group targets them.
      screens: [
        {
          node: 'SideMonitorLeft_Panel',
          widthPx: 1440,
          heightPx: 2560,
          content: { layout: 'stack' },
        },
        {
          node: 'SideMonitorRight_Panel',
          widthPx: 1440,
          heightPx: 2560,
          content: { layout: 'stack' },
        },
      ],
    },
  ],

  optionGroups: [
    {
      id: 'width',
      type: 'dimension',
      label: 'Width',
      axis: 'x',
      unit: 'cm',
      targets: ['top', 'cable-tray'],
      defaultOptionId: 'w140',
      options: [
        { id: 'w120', label: '120', value: 120, scale: 120 / 140, priceDelta: -60 },
        { id: 'w140', label: '140', value: 140, scale: 1 },
        { id: 'w160', label: '160', value: 160, scale: 160 / 140, priceDelta: 90 },
      ],
    },
    {
      id: 'top-finish',
      type: 'material',
      label: 'Top finish',
      targets: ['top'],
      defaultOptionId: 'oak',
      options: [
        { id: 'oak', label: 'Natural oak', material: { color: '#d1ad80', roughness: 0.6 } },
        {
          id: 'walnut',
          label: 'Walnut',
          material: { color: '#5b3b2a', roughness: 0.55 },
          priceDelta: 120,
        },
        { id: 'white', label: 'Matte white', material: { color: '#f2f1ec', roughness: 0.7 } },
        { id: 'black', label: 'Matte black', material: { color: '#1c1c1e', roughness: 0.75 } },
      ],
    },
    {
      id: 'leg-style',
      type: 'variant',
      label: 'Leg style',
      defaultOptionId: 'loop',
      options: [
        { id: 'loop', label: 'Loop', parts: ['legs-loop'] },
        { id: 'aframe', label: 'A-frame', parts: ['legs-aframe'], priceDelta: 80 },
        { id: 'sitstand', label: 'Sit/stand', parts: ['legs-sitstand'], priceDelta: 490 },
      ],
    },
    {
      id: 'desk-height',
      type: 'pose',
      label: 'Desk height',
      description: 'Preview the electric lift in either position.',
      requires: [{ groupId: 'leg-style', optionIds: ['sitstand'] }],
      defaultOptionId: 'sitting',
      options: [
        { id: 'sitting', label: 'Sitting', transforms: [] },
        {
          id: 'standing',
          label: 'Standing',
          transforms: [{ nodes: ['TopAssembly'], position: [0, 0.35, 0] }],
        },
      ],
    },
    {
      id: 'frame-finish',
      type: 'material',
      label: 'Frame finish',
      targets: ['legs-loop', 'legs-aframe', 'legs-sitstand', 'cable-tray'],
      defaultOptionId: 'graphite',
      options: [
        {
          id: 'graphite',
          label: 'Graphite',
          material: { color: '#1f1f22', roughness: 0.45, metalness: 0.8 },
        },
        {
          id: 'silver',
          label: 'Brushed silver',
          material: { color: '#c7c9cc', roughness: 0.35, metalness: 0.9 },
          priceDelta: 40,
        },
        {
          id: 'brass',
          label: 'Brass',
          material: { color: '#b08d57', roughness: 0.3, metalness: 1 },
          priceDelta: 140,
        },
      ],
    },
    {
      id: 'touch-screen',
      type: 'toggle',
      label: 'Touch screen',
      description:
        'A touch display set flush into the top, hinged along the front edge like a drafting table.',
      part: 'touch-screen',
      defaultOptionId: 'without',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 890 },
      ],
    },
    {
      id: 'touch-size',
      type: 'variant',
      label: 'Touch screen size',
      requires: [{ groupId: 'touch-screen', optionIds: ['with'] }],
      defaultOptionId: 'in27',
      options: touchSizes.map((size, index) => ({
        id: `in${size.inches}`,
        label: `${size.inches}"`,
        parts: [`touch-${size.inches}`],
        priceDelta: [-150, 0, 260][index] ?? 0,
      })),
    },
    {
      id: 'touch-tilt',
      type: 'pose',
      label: 'Touch screen tilt',
      description: 'Raises the far edge; the drafting position stops where the 4K screen begins.',
      requires: [{ groupId: 'touch-screen', optionIds: ['with'] }],
      defaultOptionId: 'flat',
      options: [
        { id: 'flat', label: 'Flat', transforms: [] },
        { id: 'tilt15', label: '15°', transforms: touchTilt(15) },
        { id: 'tilt30', label: '30°', transforms: touchTilt(30) },
        {
          id: 'drafting',
          label: 'Drafting (meets 4K screen)',
          // Each size needs its own angle for the far edge to land under the 4K screen.
          transforms: touchSizes.map((size): PoseTransform => ({
            nodes: [`TouchScreenPivot_${size.inches}`],
            rotation: [size.draftingAngleDeg, 0, 0],
          })),
        },
      ],
    },
    {
      id: 'monitor-4k',
      type: 'toggle',
      label: '4K screen',
      description: 'A 43-inch 4K display on a rear-edge arm mount, centred at eye level.',
      part: 'monitor-4k',
      defaultOptionId: 'without',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 1190 },
      ],
    },
    {
      id: 'side-monitors',
      type: 'toggle',
      label: 'Side monitors',
      description: 'Two portrait displays attached to the sides of the 4K screen.',
      part: 'side-monitors',
      requires: [{ groupId: 'monitor-4k', optionIds: ['with'] }],
      defaultOptionId: 'without',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 640 },
      ],
    },
    {
      id: 'os',
      type: 'screen',
      label: 'Operating system',
      description: 'Desktop style shown on every screen.',
      targets: screenParts,
      defaultOptionId: 'mac',
      options: [
        { id: 'mac', label: 'Mac-style', content: { os: 'mac' } },
        { id: 'windows', label: 'Windows-style', content: { os: 'windows' } },
        { id: 'linux', label: 'Linux-style', content: { os: 'linux' } },
        { id: 'chromeos', label: 'ChromeOS-style', content: { os: 'chromeos' } },
      ],
    },
    {
      id: 'workflow',
      type: 'screen',
      label: 'Workflow',
      description: 'Fills the screens with the apps of a typical day.',
      targets: screenParts,
      defaultOptionId: 'design',
      options: [
        { id: 'design', label: 'Design', content: { workflow: 'design' } },
        { id: 'trading', label: 'Trading', content: { workflow: 'trading' } },
        { id: 'coding', label: 'Coding', content: { workflow: 'coding' } },
        { id: 'video', label: 'Video editing', content: { workflow: 'video' } },
        { id: 'writing', label: 'Writing / research', content: { workflow: 'writing' } },
      ],
    },
    {
      id: 'layout-4k',
      type: 'screen',
      label: '4K screen layout',
      targets: ['monitor-4k'],
      requires: [{ groupId: 'monitor-4k', optionIds: ['with'] }],
      defaultOptionId: 'two-up',
      options: [
        { id: 'single', label: 'Single', content: { layout: 'single' } },
        { id: 'two-up', label: '2-up', content: { layout: 'two-up' } },
        { id: 'three-column', label: '3 columns', content: { layout: 'three-column' } },
        { id: 'grid-2x2', label: '2×2 grid', content: { layout: 'grid-2x2' } },
        { id: 'sidebar-main', label: 'Sidebar + main', content: { layout: 'sidebar-main' } },
        { id: 'pip', label: 'Picture-in-picture', content: { layout: 'pip' } },
      ],
    },
    {
      id: 'layout-touch',
      type: 'screen',
      label: 'Touch screen layout',
      targets: touchParts,
      requires: [{ groupId: 'touch-screen', optionIds: ['with'] }],
      defaultOptionId: 'sidebar-main',
      options: [
        { id: 'single', label: 'Single', content: { layout: 'single' } },
        { id: 'two-up', label: '2-up', content: { layout: 'two-up' } },
        { id: 'sidebar-main', label: 'Sidebar + main', content: { layout: 'sidebar-main' } },
      ],
    },
    {
      id: 'keyboard-tray',
      type: 'toggle',
      label: 'Keyboard tray',
      description: 'Slides out from under the front edge of the top.',
      part: 'keyboard-tray',
      defaultOptionId: 'without',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 120 },
      ],
    },
    {
      id: 'drawer',
      type: 'toggle',
      label: 'Drawer',
      description: 'A slim drawer mounted under the right side of the top.',
      part: 'drawer',
      defaultOptionId: 'with',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 150 },
      ],
    },
    {
      id: 'cable-tray',
      type: 'toggle',
      label: 'Cable tray',
      part: 'cable-tray',
      defaultOptionId: 'without',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 49 },
      ],
    },
  ],
};
