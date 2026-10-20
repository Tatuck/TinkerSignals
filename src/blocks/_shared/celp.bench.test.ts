import { it } from 'vitest';
import { segmentalSnr, snr } from '@/engine/dsp/metrics';
import { celpConfig, celpEncode } from '@/blocks/_shared/celp';
import { SYNTH_SOUNDS } from '@/blocks/sound-library/synth';

/** Banco de pruebas de CELP: tiempo y calidad en varias configuraciones. */
it.runIf(process.env.BENCH)('bench', () => {
  const lines: string[] = [];
  for (const [fs, cb] of [[8000, 256], [8000, 1024], [16000, 256], [16000, 1024]] as const) {
    const s = SYNTH_SOUNDS.syllables;
    let x = s.make(16000);
    if (fs === 8000) x = x.filter((_, i) => i % 2 === 0);
    // 10 s de audio repitiendo la frase.
    const long = new Float32Array(fs * 10);
    for (let i = 0; i < long.length; i++) long[i] = x[i % x.length];
    const cfg = celpConfig(fs, { frameMs: 30, subframes: 4, order: 10, codebookSize: cb, gamma: 0.85, adaptive: true });
    const t0 = performance.now();
    const enc = celpEncode(long, cfg);
    const ms = performance.now() - t0;
    lines.push(`${fs} Hz, cb ${cb}: ${ms.toFixed(0)} ms, SNR ${snr(long, enc.reconstructed).toFixed(3)}, SNRseg ${segmentalSnr(long, enc.reconstructed).toFixed(3)}`);
  }
  throw new Error('\n' + lines.join('\n'));
}, 300000);
