import { publicAsset } from '../assets';
import type { ProductDefinitionInput } from '../schema';

/**
 * A set of companion devices sold together on a desk mat. Every device is a
 * toggle; the bundle colour is applied to the device bodies only, so screens,
 * the card and the mat keep their own materials.
 * Placeholder model: `scripts/generate-device-bundle.mjs`.
 */
export const deviceBundle: ProductDefinitionInput = {
  id: 'device-bundle',
  name: 'Device Bundle',
  description:
    'Pick the companion devices that ship with the desk: laptop, gamepad-style phone, stylus, card and earbuds, in one matching finish.',
  model: { src: publicAsset('models/device-bundle.glb') },
  basePrice: 149,
  currency: 'EUR',

  parts: [
    { id: 'mat', label: 'Desk mat', nodes: ['Mat'] },
    { id: 'laptop', label: 'Laptop', nodes: ['Laptop'], optional: true },
    { id: 'phone', label: 'Gamepad phone', nodes: ['GamepadPhone'], optional: true },
    { id: 'stylus', label: 'Stylus', nodes: ['Stylus'], optional: true },
    { id: 'card', label: 'Payment card', nodes: ['CreditCard'], optional: true },
    { id: 'earbuds', label: 'Earbuds case', nodes: ['EarbudsCase'], optional: true },
    {
      id: 'bodies',
      label: 'Device bodies',
      nodes: [
        'Laptop_Base',
        'Laptop_Lid',
        'Phone_Body',
        'Phone_GripLeft',
        'Phone_GripRight',
        'Stylus_Body',
        'EarbudsCase_Body',
      ],
    },
  ],

  optionGroups: [
    {
      id: 'finish',
      type: 'material',
      label: 'Bundle finish',
      targets: ['bodies'],
      defaultOptionId: 'graphite',
      options: [
        {
          id: 'graphite',
          label: 'Graphite',
          material: { color: '#2a2a2e', roughness: 0.4, metalness: 0.6 },
        },
        {
          id: 'silver',
          label: 'Silver',
          material: { color: '#d3d4d6', roughness: 0.3, metalness: 0.8 },
        },
        {
          id: 'white',
          label: 'Ceramic white',
          material: { color: '#f3f1ec', roughness: 0.35, metalness: 0.1 },
          priceDelta: 60,
        },
      ],
    },
    {
      id: 'laptop',
      type: 'toggle',
      label: 'Laptop',
      description: '14-inch laptop, shown open.',
      part: 'laptop',
      defaultOptionId: 'with',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 1499 },
      ],
    },
    {
      id: 'phone',
      type: 'toggle',
      label: 'Gamepad phone',
      description: 'Phone with built-in controller grips.',
      part: 'phone',
      defaultOptionId: 'with',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 899 },
      ],
    },
    {
      id: 'stylus',
      type: 'toggle',
      label: 'Stylus',
      part: 'stylus',
      defaultOptionId: 'with',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 129 },
      ],
    },
    {
      id: 'card',
      type: 'toggle',
      label: 'Payment card',
      description: 'Metal payment card linked to the bundle account.',
      part: 'card',
      defaultOptionId: 'without',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 49 },
      ],
    },
    {
      id: 'earbuds',
      type: 'toggle',
      label: 'Earbuds',
      part: 'earbuds',
      defaultOptionId: 'without',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 199 },
      ],
    },
  ],
};
