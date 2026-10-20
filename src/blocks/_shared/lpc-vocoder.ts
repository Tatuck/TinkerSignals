import { BitReader, BitWriter } from '@/engine/dsp/bits';
import {
  SynthesisFilter,
  detectPitch,
  frameAt,
  lpcFrame,
  reflectionToLpc,
  residualRms,
} from '@/engine/dsp/voice';
import { seededRandom } from './random';

/**
 * Vocoder LPC (modelo fuente-filtro, como LPC-10 y `lpcana.m`/`lpcsyn.m`).
 * Por cada trama se envía:
 *   [sonora: 1][periodo: pitchBits][ganancia: 6][k_1…k_p: kBits cada uno]
 * Los coeficientes de reflexión se cuantizan en el dominio arcoseno, que
 * reparte mejor los niveles cerca de ±1 y garantiza un filtro estable.
 */
export interface LpcConfig {
  frameLen: number;
  order: number;
  kBits: number;
  minLag: number;
  pitchBits: number;
}

const GAIN_BITS = 6;
const GAIN_MIN_DB = -80;
const GAIN_STEP_DB = 80 / (2 ** GAIN_BITS - 1);

export function lpcConfig(fs: number, frameMs: number, order: number, kBits: number): LpcConfig {
  const minLag = Math.floor(fs / 400);
  const maxLag = Math.ceil(fs / 60);
  return {
    frameLen: Math.max(32, Math.round((frameMs / 1000) * fs)),
    order,
    kBits,
    minLag,
    pitchBits: Math.ceil(Math.log2(maxLag - minLag + 1)),
  };
}

export const bitsPerFrame = (c: LpcConfig) => 1 + c.pitchBits + GAIN_BITS + c.order * c.kBits;

const quantK = (k: number, bits: number) => {
  const L = 2 ** bits;
  const t = (Math.asin(Math.max(-0.9999, Math.min(0.9999, k))) / Math.PI + 0.5) * L;
  return Math.min(L - 1, Math.max(0, Math.floor(t)));
};
const dequantK = (q: number, bits: number) => Math.sin(((q + 0.5) / 2 ** bits - 0.5) * Math.PI);

export interface LpcFrameInfo {
  voiced: boolean;
  lag: number;
  gain: number;
  a: Float64Array;
}

export function lpcEncode(x: Float32Array, fs: number, c: LpcConfig) {
  const w = new BitWriter();
  const frames: LpcFrameInfo[] = [];
  // La ventana de análisis es 1,5 tramas centrada: necesita media trama de "futuro".
  const win = Math.round(c.frameLen * 1.5);
  const look = Math.round((win - c.frameLen) / 2);
  for (let start = 0; start < x.length; start += c.frameLen) {
    const analysis = frameAt(x, start - look, win);
    const { k } = lpcFrame(analysis, c.order);
    const qk = Array.from(k, (v) => quantK(v, c.kBits));
    const a = reflectionToLpc(qk.map((q) => dequantK(q, c.kBits)));
    const gain = residualRms(x, start, Math.min(c.frameLen, x.length - start), a);
    const p = detectPitch(frameAt(x, start - look, win), fs);
    const lagQ = p.voiced ? Math.min(2 ** c.pitchBits - 1, Math.max(0, p.lag - c.minLag)) : 0;
    const gq = Math.round(
      Math.max(0, (20 * Math.log10(gain + 1e-12) - GAIN_MIN_DB) / GAIN_STEP_DB),
    );

    w.write(p.voiced ? 1 : 0, 1);
    w.write(lagQ, c.pitchBits);
    w.write(Math.min(2 ** GAIN_BITS - 1, gq), GAIN_BITS);
    qk.forEach((q) => w.write(q, c.kBits));
    frames.push({ voiced: p.voiced, lag: lagQ + c.minLag, gain, a });
  }
  return { writer: w, frames, lookaheadSamples: look };
}

/** Síntesis: tren de pulsos (sonora) o ruido (sorda) → ganancia → filtro 1/A(z). */
export function lpcDecode(bytes: Uint8Array, bitLength: number, n: number, c: LpcConfig) {
  const r = new BitReader(bytes, bitLength);
  const y = new Float32Array(n);
  const excitation = new Float32Array(n);
  const filter = new SynthesisFilter(c.order);
  const rand = seededRandom(7);
  let sinceLastPulse = 0;

  for (let start = 0; start < n; start += c.frameLen) {
    const voiced = r.read(1) === 1;
    const lag = r.read(c.pitchBits) + c.minLag;
    const gain = Math.pow(10, (r.read(GAIN_BITS) * GAIN_STEP_DB + GAIN_MIN_DB) / 20);
    const a = reflectionToLpc(
      Array.from({ length: c.order }, () => dequantK(r.read(c.kBits), c.kBits)),
    );
    for (let i = start; i < Math.min(n, start + c.frameLen); i++) {
      let e: number;
      if (voiced) {
        // Pulsos de amplitud √periodo: potencia media 1, como el ruido.
        sinceLastPulse++;
        e = sinceLastPulse >= lag ? Math.sqrt(lag) : 0;
        if (e) sinceLastPulse = 0;
      } else {
        e = (rand() * 2 - 1) * Math.sqrt(3);
      }
      excitation[i] = e * gain;
      y[i] = filter.process(excitation[i], a);
    }
  }
  return { y, excitation };
}
