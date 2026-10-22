import { it } from 'vitest';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { Engine } from '@/engine/evaluator';
import { encodeWav } from '@/engine/dsp/wav';
import { makeSignal } from '@/engine/dsp/signal';
import { snr } from '@/engine/dsp/metrics';
import type { Graph, Signal } from '@/engine/types';
import { createRegistry } from '@/blocks/index';

/**
 * Audios del vídeo, hechos con el motor de verdad: la misma voz de la
 * biblioteca pasada por LPC, por un canal con errores y por una red IP con pérdidas.
 */
const SOUNDS = new URL('../../public/sounds/', import.meta.url);
const OUT = new URL('../public/audio/', import.meta.url);

function readWav(file: string): Signal {
  const b = readFileSync(new URL(file, SOUNDS));
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const rate = v.getUint32(24, true);
  let o = 12;
  while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + v.getUint32(o + 4, true);
  const n = v.getUint32(o + 4, true) / 2;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = v.getInt16(o + 8 + i * 2, true) / 32768;
  return makeSignal(x, rate);
}

function run(blocks: { type: string; params?: Graph['nodes'][number]['params'] }[]) {
  const registry = createRegistry();
  const engine = new Engine(registry);
  engine.setAsset('lib:voz-femenina', readWav('voz-femenina.wav'));
  const nodes: Graph['nodes'] = [
    { id: 'src', type: 'sound-library', params: { sound: 'voz-femenina' } },
    ...blocks.map((b, i) => ({ id: `b${i}`, type: b.type, params: b.params ?? {} })),
  ];
  const edges: Graph['edges'] = blocks.map((_, i) => ({
    id: `e${i}`,
    source: i === 0 ? 'src' : `b${i - 1}`,
    sourcePort: Object.keys(registry.get(nodes[i].type)!.outputs)[0],
    target: `b${i}`,
    targetPort: 'in',
  }));
  const result = engine.run({ nodes, edges });
  const metrics = Object.fromEntries(
    Object.entries(result.nodes).map(([id, r]) => [
      id,
      Object.fromEntries(r.metrics.map((m) => [m.key, m.value])),
    ]),
  );
  const last = `b${blocks.length - 1}`;
  const out = engine.getValue(last, 'out') as Signal;
  return { out, input: engine.getValue('src', 'out') as Signal, metrics };
}

it.runIf(process.env.VIDEO)('audios del vídeo', () => {
  const save = (name: string, s: Signal) => writeFileSync(new URL(name, OUT), encodeWav(s));

  const lpc = run([{ type: 'lpc-encoder' }, { type: 'lpc-decoder' }]);
  save('original.wav', lpc.input);
  save('lpc.wav', lpc.out);
  console.log('LPC', lpc.metrics.b0);

  for (const ber of [0.00001, 0.001, 0.01]) {
    const c = run([
      { type: 'pcm-encoder', params: { bits: 8, law: 'mu' } },
      { type: 'bit-errors', params: { ber } },
      { type: 'pcm-decoder' },
    ]);
    save(`canal-${ber}.wav`, c.out);
    console.log('BER', ber, 'SNR', snr(c.input.samples, c.out.samples).toFixed(1), c.metrics.b0);
  }

  for (const lossPct of [1, 20]) {
    const v = run([
      { type: 'pcm-encoder', params: { bits: 8, law: 'a' } },
      { type: 'packetizer' },
      { type: 'ip-network', params: { lossPct, jitterMs: 20 } },
      { type: 'jitter-buffer' },
      { type: 'depacketizer' },
      { type: 'pcm-decoder' },
    ]);
    save(`voip-${lossPct}.wav`, v.out);
    console.log('VoIP', lossPct, snr(v.input.samples, v.out.samples).toFixed(1));
  }

  copyFileSync(new URL('piano-bach.wav', SOUNDS), new URL('piano-bach.wav', OUT));
});
