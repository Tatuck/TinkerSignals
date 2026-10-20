import { toFrames } from '@/engine/dsp/frames';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: 'framer',
  category: 'piezas',
  icon: '✂️',
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'frames' } },
  params: {
    size: { type: 'select', default: '256', options: ['16', '32', '64', '128', '256', '384', '512', '1024'] },
    overlap: { type: 'select', default: '0', options: ['0', '50'] },
    window: { type: 'select', default: 'rect', options: ['rect', 'hann', 'hamming', 'sine'] },
    /** Tamaño y avance exactos en muestras (0 = usar los de arriba). Los fija un circuito interior. */
    exactSize: { type: 'number', default: 0, min: 0, max: 1e6, step: 1, hidden: true },
    exactHop: { type: 'number', default: 0, min: 0, max: 1e6, step: 1, hidden: true },
  },
  process({ inputs, params }) {
    const size = params.exactSize || Number(params.size);
    const hop = params.exactHop || (params.overlap === '50' ? size / 2 : size);
    const out = toFrames(inputs.in, size, hop, params.window);
    return {
      outputs: { out },
      metrics: [
        { key: 'frames', value: out.data.length, highlight: true },
        { key: 'frameMs', value: (1000 * size) / inputs.in.sampleRate, unit: 'ms', highlight: true },
      ],
      latencyMs: (1000 * size) / inputs.in.sampleRate,
    };
  },
});
