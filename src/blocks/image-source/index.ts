import { defineBlock } from '@/engine/types';
import { TEST_IMAGES, testImage } from '../_shared/test-images';

export default defineBlock({
  id: 'image-source',
  category: 'imagen',
  icon: '🖼️',
  inputs: {},
  outputs: { out: { type: 'image' } },
  params: {
    image: { type: 'select', default: 'paisaje', options: TEST_IMAGES },
    size: {
      type: 'select',
      default: '128',
      options: ['64', '128', '256'],
      visibleIf: {
        param: 'image',
        equals: TEST_IMAGES.filter((n) => !n.startsWith('ejercicio')),
      },
    },
    color: {
      type: 'boolean',
      default: true,
      visibleIf: {
        param: 'image',
        equals: TEST_IMAGES.filter((n) => !n.startsWith('ejercicio')),
      },
    },
  },
  process({ params }) {
    const img = testImage(params.image, Number(params.size), params.color);
    const channels = img.planes.length;
    return {
      outputs: { out: img },
      metrics: [
        { key: 'pixels', value: img.width * img.height, highlight: true },
        // Sin comprimir: 8 bits por píxel y canal.
        {
          key: 'rawSize',
          value: (img.width * img.height * channels) / 1024,
          unit: 'KB',
          highlight: true,
        },
      ],
    };
  },
});
