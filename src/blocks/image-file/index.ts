import { BlockWaiting } from '@/engine/errors';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'image-file',
  category: 'imagen',
  icon: '📷',
  inputs: {},
  outputs: { out: { type: 'image' } },
  params: {
    image: { type: 'image', default: null },
  },
  process({ params, getExternal }) {
    if (!params.image) throw new BlockWaiting('Todavía no hay imagen: carga un archivo');
    const img = getExternal(params.image);
    if (img?.kind !== 'image')
      throw new BlockWaiting('La imagen ya no está disponible; vuelve a cargarla');
    return {
      outputs: { out: img },
      metrics: [
        { key: 'pixels', value: img.width * img.height, highlight: true },
        {
          key: 'rawSize',
          value: (img.width * img.height * img.planes.length) / 1024,
          unit: 'KB',
          highlight: true,
        },
      ],
    };
  },
});
