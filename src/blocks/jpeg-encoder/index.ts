import { makeBitstream } from '@/engine/dsp/bitstream';
import { expectPixels, planeToRgba, SUBSAMPLING } from '@/engine/dsp/image';
import { defineBlock } from '@/engine/types';
import { jpegEncode } from '../_shared/jpeg';

export default defineBlock({
  id: 'jpeg-encoder',
  category: 'imagen',
  family: 'jpeg',
  familyRole: 'encoder',
  icon: '🗜️',
  inputs: { in: { type: 'image' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    quality: { type: 'number', default: 75, min: 1, max: 100, step: 1 },
    subsampling: {
      type: 'select',
      default: '4:2:0',
      options: Object.keys(SUBSAMPLING) as (keyof typeof SUBSAMPLING)[],
    },
  },
  process({ inputs, params }) {
    const img = inputs.in;
    expectPixels(img, 'El codificador JPEG');
    const { writer, stats } = jpegEncode(img, params.quality, params.subsampling);
    const channels = img.color === 'gray' ? 1 : 3;
    const pixels = img.width * img.height;
    const out = makeBitstream(
      writer,
      { codec: 'jpeg', sampleRate: 0, numSamples: 0, unit: { name: 'píxel', count: pixels } },
      pixels * channels * 8,
    );
    const total = out.bitLength;
    const max = Math.max(1, ...stats.nonZero.data);
    return {
      outputs: { out },
      metrics: [
        { key: 'bpp', value: total / pixels, unit: 'bits', highlight: true },
        { key: 'compression', value: out.referenceBits / total, unit: '×', highlight: true },
        { key: 'size', value: total / 8 / 1024, unit: 'KB' },
        { key: 'zeros', value: 100 * stats.zeroRatio, unit: '%' },
        { key: 'dcShare', value: (100 * stats.dcBits) / total, unit: '%' },
        { key: 'acShare', value: (100 * stats.acBits) / total, unit: '%' },
        ...(stats.componentBits.length > 1
          ? [
              {
                key: 'chromaShare',
                value: (100 * (stats.componentBits[1] + stats.componentBits[2])) / total,
                unit: '%',
              },
            ]
          : []),
      ],
      plots: [
        {
          kind: 'image',
          title: 'detail',
          ...planeToRgba(
            { ...stats.nonZero, data: stats.nonZero.data.map((v) => (255 * v) / max) },
            128,
          ),
        },
      ],
    };
  },
});
