import { makeBitstream } from '@/engine/dsp/bitstream';
import { BitWriter } from '@/engine/dsp/bits';
import { expectPixels, imageMse, psnrFromMse, toRgba } from '@/engine/dsp/image';
import { defineBlock } from '@/engine/types';
import { pixelToLevel, levelsToImage } from '../_shared/image-pcm';

export default defineBlock({
  id: 'image-pcm-encoder',
  category: 'imagen',
  family: 'image-pcm',
  familyRole: 'encoder',
  icon: '🔢',
  inputs: { in: { type: 'image' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    bits: { type: 'number', default: 8, min: 1, max: 8, step: 1, unit: 'bits' },
  },
  process({ inputs, params }) {
    const img = inputs.in;
    expectPixels(img, 'El PCM de imagen');
    const b = params.bits;
    const w = new BitWriter();
    const levels = img.planes.map((p) => {
      const l = Int32Array.from(p.data, (v) => pixelToLevel(v, b));
      for (const v of l) w.write(v, b);
      return l;
    });
    const pixels = img.width * img.height;
    const samples = img.planes.reduce((a, p) => a + p.data.length, 0);
    const out = makeBitstream(
      w,
      {
        codec: 'image-pcm',
        sampleRate: 0,
        numSamples: 0,
        unit: { name: 'píxel', count: pixels },
        symbolBits: b,
        bits: b,
        color: img.color,
        planes: img.planes.map((p) => [p.width, p.height]),
      },
      samples * 8,
    );
    const rebuilt = levelsToImage(img, levels, b);
    return {
      outputs: { out },
      metrics: [
        { key: 'levels', value: 2 ** b, highlight: true },
        { key: 'size', value: out.bitLength / 8 / 1024, unit: 'KB', highlight: true },
        { key: 'psnr', value: psnrFromMse(imageMse(img, rebuilt)), unit: 'dB' },
      ],
      plots: [{ kind: 'image', title: 'preview', ...toRgba(rebuilt, 160) }],
    };
  },
});
