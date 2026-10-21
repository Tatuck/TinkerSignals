import { expectCodec } from '@/engine/dsp/bitstream';
import { BitReader } from '@/engine/dsp/bits';
import { makeImage, makePlane } from '@/engine/dsp/image';
import { defineBlock, type Image } from '@/engine/types';
import { levelToPixel } from '../_shared/image-pcm';

export default defineBlock({
  id: 'image-pcm-decoder',
  category: 'imagen',
  family: 'image-pcm',
  familyRole: 'decoder',
  icon: '🔢',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'image' } },
  params: {},
  process({ inputs }) {
    const b = inputs.in;
    expectCodec(b, 'image-pcm', 'El decodificador PCM de imagen');
    const bits = Number(b.header.bits);
    const sizes = b.header.planes as [number, number][];
    const r = new BitReader(b.bytes, b.bitLength);
    const planes = sizes.map(([w, h]) => {
      const p = makePlane(w, h);
      for (let i = 0; i < w * h; i++) p.data[i] = levelToPixel(r.read(bits), bits);
      return p;
    });
    return { outputs: { out: makeImage(planes, b.header.color as Image['color']) } };
  },
});
