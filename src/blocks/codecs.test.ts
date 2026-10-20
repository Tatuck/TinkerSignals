import { describe, expect, it } from 'vitest';
import { averageSpectrumDb } from '@/engine/dsp/fft';
import { Engine } from '@/engine/evaluator';
import { snr } from '@/engine/dsp/metrics';
import type { Bitstream, Graph, Signal } from '@/engine/types';
import { createRegistry } from './index';
import { huffmanDecode, huffmanEncode } from './_shared/huffman';
import { BitWriter } from '@/engine/dsp/bits';

const registry = createRegistry();

/** Monta una cadena lineal generador → bloques… y devuelve el motor ya ejecutado. */
function chain(
  blocks: { type: string; params?: Record<string, number | string | boolean> }[],
  gen = {},
) {
  const nodes: Graph['nodes'] = [
    {
      id: 'g',
      type: 'generator',
      params: { waveform: 'vowel', frequency: 140, duration: 1, ...gen },
    },
    ...blocks.map((b, i) => ({ id: `b${i}`, type: b.type, params: b.params ?? {} })),
  ];
  const edges: Graph['edges'] = blocks.map((_, i) => {
    const src = i === 0 ? 'g' : `b${i - 1}`;
    const srcPort = Object.keys(registry.get(nodes[i].type)!.outputs)[0];
    return { id: `e${i}`, source: src, sourcePort: srcPort, target: `b${i}`, targetPort: 'in' };
  });
  const engine = new Engine(registry);
  const result = engine.run({ nodes, edges });
  const last = `b${blocks.length - 1}`;
  const lastPort = Object.keys(registry.get(blocks[blocks.length - 1].type)!.outputs)[0];
  return {
    result,
    input: engine.getValue('g', 'out') as Signal,
    output: engine.getValue(last, lastPort),
    metric: (node: string, key: string) =>
      result.nodes[node].metrics.find((m) => m.key === key)?.value,
  };
}

describe('PCM', () => {
  it('ley μ de 8 bits da SNR de calidad telefónica', () => {
    const c = chain([
      { type: 'pcm-encoder', params: { bits: 8, law: 'mu' } },
      { type: 'pcm-decoder' },
    ]);
    expect(c.result.nodes.b1.status).toBe('ok');
    expect(snr(c.input.samples, (c.output as Signal).samples)).toBeGreaterThan(30);
    expect(c.metric('b0', 'bitrate')).toBe(8 * 16000);
  });

  it('con señal débil, ley μ supera a la lineal', () => {
    const run = (law: string) => {
      const c = chain(
        [{ type: 'pcm-encoder', params: { bits: 6, law } }, { type: 'pcm-decoder' }],
        { amplitude: 0.05 },
      );
      return snr(c.input.samples, (c.output as Signal).samples);
    };
    expect(run('mu')).toBeGreaterThan(run('linear') + 10);
  });
});

describe('DPCM', () => {
  it('a igualdad de bits mejora la SNR de PCM en una vocal', () => {
    const d = chain([
      { type: 'dpcm-encoder', params: { bits: 4, order: 4 } },
      { type: 'dpcm-decoder' },
    ]);
    const p = chain([
      { type: 'pcm-encoder', params: { bits: 4, law: 'linear' } },
      { type: 'pcm-decoder' },
    ]);
    const sd = snr(d.input.samples, (d.output as Signal).samples);
    const sp = snr(p.input.samples, (p.output as Signal).samples);
    expect(sd).toBeGreaterThan(sp + 6);
    expect(d.metric('b0', 'predGain')).toBeGreaterThan(6);
  });

  it('el decodificador reproduce exactamente la reconstrucción del codificador', () => {
    const d = chain([
      { type: 'dpcm-encoder', params: { bits: 5, order: 3 } },
      { type: 'dpcm-decoder' },
    ]);
    expect(snr(d.input.samples, (d.output as Signal).samples)).toBeCloseTo(
      d.metric('b0', 'snrExpected')!,
      3,
    );
  });
});

describe('ADPCM', () => {
  it('codifica a 4 bits por muestra con SNR razonable', () => {
    const c = chain([{ type: 'adpcm-encoder' }, { type: 'adpcm-decoder' }]);
    expect(c.metric('b0', 'bitrate')).toBe(64000);
    expect(snr(c.input.samples, (c.output as Signal).samples)).toBeGreaterThan(15);
  });
});

describe('Huffman', () => {
  it('ida y vuelta sin pérdidas, incluida la cola de bits sueltos', () => {
    const w = new BitWriter();
    for (let i = 0; i < 5000; i++) w.write(Math.floor(Math.abs(Math.sin(i * 0.37)) * 7), 3);
    w.write(1, 2); // cola que no completa un símbolo
    const { bytes, bitLength } = w.finish();
    const enc = huffmanEncode(bytes, bitLength, 3).writer.finish();
    const dec = huffmanDecode(enc.bytes, enc.bitLength).finish();
    expect(dec.bitLength).toBe(bitLength);
    expect([...dec.bytes]).toEqual([...bytes]);
  });

  it('PCM → Huffman → Huffman⁻¹ → PCM⁻¹ da la misma señal que sin Huffman', () => {
    const a = chain([{ type: 'pcm-encoder', params: { bits: 8 } }, { type: 'pcm-decoder' }]);
    const b = chain([
      { type: 'pcm-encoder', params: { bits: 8 } },
      { type: 'huffman-encoder' },
      { type: 'huffman-decoder' },
      { type: 'pcm-decoder' },
    ]);
    expect([...(b.output as Signal).samples]).toEqual([...(a.output as Signal).samples]);
    const avg = b.metric('b1', 'avgLength')!;
    expect(avg).toBeGreaterThanOrEqual(b.metric('b1', 'entropy')!);
    expect(avg).toBeLessThan(b.metric('b1', 'entropy')! + 1);
  });
});

describe('Canal', () => {
  it('la BER real se acerca a la pedida', () => {
    const c = chain([
      { type: 'pcm-encoder', params: { bits: 16 } },
      { type: 'bit-errors', params: { ber: 0.01 } },
    ]);
    expect(c.metric('b1', 'berReal')).toBeGreaterThan(0.008);
    expect(c.metric('b1', 'berReal')).toBeLessThan(0.012);
    expect((c.output as Bitstream).bitLength).toBe(16 * 16000);
  });

  it('un decodificador Huffman no revienta con bits corruptos', () => {
    const c = chain([
      { type: 'pcm-encoder', params: { bits: 8 } },
      { type: 'huffman-encoder' },
      { type: 'bit-errors', params: { ber: 0.01 } },
      { type: 'huffman-decoder' },
      { type: 'pcm-decoder' },
    ]);
    expect(c.result.nodes.b4.status).toBe('ok');
  });
});

describe('Transformada', () => {
  it('con todos los coeficientes y muchos bits es casi transparente', () => {
    const c = chain([
      { type: 'transform-codec', params: { keep: 100, bits: 16, blockSize: '64' } },
    ]);
    expect(c.metric('b0', 'snr')).toBeGreaterThan(60);
  });

  it('el retardo es el tamaño del bloque entre fs', () => {
    const c = chain([{ type: 'transform-codec', params: { blockSize: '512' } }]);
    expect(c.result.nodes.b0.ownLatencyMs).toBeCloseTo((512 / 16000) * 1000);
  });
});

describe('Remuestreo', () => {
  it('sin antialiasing el barrido se dobla por debajo de la nueva fs/2', () => {
    const energyAbove = (antialias: boolean) => {
      // Tono de 3 kHz bajado a 4 kHz de muestreo: sin filtro aparece un alias en 1 kHz.
      const c = chain([{ type: 'resampler', params: { sampleRate: '4000', antialias } }], {
        waveform: 'sine',
        frequency: 3000,
      });
      const spec = averageSpectrumDb((c.output as Signal).samples, 256);
      return Math.max(...spec);
    };
    expect(energyAbove(false)).toBeGreaterThan(energyAbove(true) + 20);
  });
});

describe('Voz', () => {
  const voice = { sampleRate: '8000', frequency: 120 };

  it('el vocoder LPC baja a pocos kbps y conserva la envolvente', () => {
    const c = chain([{ type: 'lpc-encoder' }, { type: 'lpc-decoder' }], voice);
    expect(c.result.nodes.b1.status).toBe('ok');
    expect(c.metric('b0', 'bitrate')).toBeLessThan(4000);
    expect(c.result.nodes.b0.ownLatencyMs).toBeGreaterThan(20);
  });

  it('CELP: el decodificador reproduce la síntesis del codificador', () => {
    const c = chain(
      [{ type: 'celp-encoder', params: { codebookSize: '64' } }, { type: 'celp-decoder' }],
      voice,
    );
    expect(c.result.nodes.b1.status).toBe('ok');
    expect(snr(c.input.samples, (c.output as Signal).samples)).toBeCloseTo(
      c.metric('b0', 'snr')!,
      3,
    );
  });

  it('CELP: un codebook mayor no empeora y el libro adaptativo ayuda', () => {
    const s = (params: Record<string, string | boolean>) =>
      chain([{ type: 'celp-encoder', params }], voice).metric('b0', 'snrSeg')!;
    expect(s({ codebookSize: '256' })).toBeGreaterThanOrEqual(s({ codebookSize: '16' }) - 0.5);
    expect(s({ codebookSize: '64' })).toBeGreaterThan(s({ codebookSize: '64', adaptive: false }));
  });
});
