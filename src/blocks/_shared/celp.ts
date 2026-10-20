import { BitReader, BitWriter } from '@/engine/dsp/bits';
import { SynthesisFilter, frameAt, lpcFrame, reflectionToLpc } from '@/engine/dsp/voice';
import { seededRandom } from './random';

/**
 * CELP (Code-Excited Linear Prediction) con análisis por síntesis.
 *
 * Por trama: filtro LPC (coeficientes de reflexión cuantizados).
 * Por subtrama, la excitación es  u = gA·v(T) + gS·c(i):
 *   - v(T): libro adaptativo = excitación pasada retrasada T muestras (el tono).
 *   - c(i): libro estocástico = vector i de un diccionario fijo de ruido disperso.
 * El codificador prueba candidatos, los sintetiza y elige los que minimizan
 * el error *ponderado perceptualmente* W(z) = A(z)/A(z/γ): permite más
 * error donde la voz tiene formantes, porque ahí el oído no lo nota.
 *
 * Formato por trama:
 *   [k_1…k_p: 5 bits][por subtrama: (T: pitchBits, gA: 4)? (i: log2 C, gS: 6)]
 */
export interface CelpConfig {
  frameLen: number;
  subframes: number;
  order: number;
  codebookSize: number;
  gamma: number;
  adaptive: boolean;
  minLag: number;
  pitchBits: number;
}

export const K_BITS = 5;
const GA_BITS = 4;
const GA_MAX = 1.4;
const GS_BITS = 6;
const GS_MIN_DB = -80;
const GS_STEP_DB = 90 / (2 ** (GS_BITS - 1) - 1);

export function celpConfig(
  fs: number,
  p: { frameMs: number; subframes: number; order: number; codebookSize: number; gamma: number; adaptive: boolean },
): CelpConfig {
  const minLag = Math.floor(fs / 400);
  const maxLag = Math.ceil(fs / 60);
  const sub = Math.max(8, Math.round(((p.frameMs / 1000) * fs) / p.subframes));
  return {
    frameLen: sub * p.subframes,
    subframes: p.subframes,
    order: p.order,
    codebookSize: p.codebookSize,
    gamma: p.gamma,
    adaptive: p.adaptive,
    minLag,
    pitchBits: Math.ceil(Math.log2(maxLag - minLag + 1)),
  };
}

export function celpBitsPerFrame(c: CelpConfig): number {
  const perSub = (c.adaptive ? c.pitchBits + GA_BITS : 0) + Math.log2(c.codebookSize) + GS_BITS;
  return c.order * K_BITS + c.subframes * perSub;
}

// ─── Cuantización ───────────────────────────────────────────────────────────

const quantK = (k: number) => {
  const L = 2 ** K_BITS;
  const t = (Math.asin(Math.max(-0.9999, Math.min(0.9999, k))) / Math.PI + 0.5) * L;
  return Math.min(L - 1, Math.max(0, Math.floor(t)));
};
const dequantK = (q: number) => Math.sin(((q + 0.5) / 2 ** K_BITS - 0.5) * Math.PI);
const quantGA = (g: number) => Math.min(2 ** GA_BITS - 1, Math.max(0, Math.round((g / GA_MAX) * (2 ** GA_BITS - 1))));
const dequantGA = (q: number) => (q * GA_MAX) / (2 ** GA_BITS - 1);
const quantGS = (g: number) => {
  const mag = Math.round((20 * Math.log10(Math.abs(g) + 1e-12) - GS_MIN_DB) / GS_STEP_DB);
  return ((g < 0 ? 1 : 0) << (GS_BITS - 1)) | Math.min(2 ** (GS_BITS - 1) - 1, Math.max(0, mag));
};
const dequantGS = (q: number) => {
  const mag = q & (2 ** (GS_BITS - 1) - 1);
  const v = mag === 0 ? 0 : Math.pow(10, (mag * GS_STEP_DB + GS_MIN_DB) / 20);
  return q >> (GS_BITS - 1) ? -v : v;
};

// ─── Libro estocástico ──────────────────────────────────────────────────────

/** Vector disperso: posiciones y signos de sus pulsos (≈ 1 de cada 8 muestras). */
type Sparse = { pos: Int32Array; sign: Float64Array };

/** Mismo diccionario en codificador y decodificador: se genera con semilla fija. */
export function makeCodebook(size: number, length: number): Sparse[] {
  const rand = seededRandom(1016 + length);
  const pulses = Math.max(2, Math.round(length / 8));
  const norm = 1 / Math.sqrt(pulses);
  return Array.from({ length: size }, () => {
    const pos = new Set<number>();
    while (pos.size < pulses) pos.add(Math.floor(rand() * length));
    const p = Int32Array.from([...pos].sort((a, b) => a - b));
    return { pos: p, sign: Float64Array.from(p, () => (rand() < 0.5 ? -norm : norm)) };
  });
}

function sparseToDense(c: Sparse, length: number): Float64Array {
  const v = new Float64Array(length);
  c.pos.forEach((p, i) => (v[p] = c.sign[i]));
  return v;
}

// ─── Ayudas de filtrado ─────────────────────────────────────────────────────

/** Respuesta al impulso de 1/A(z) truncada a `length` muestras. */
function impulseResponse(a: ArrayLike<number>, length: number): Float64Array {
  const h = new Float64Array(length);
  for (let n = 0; n < length; n++) {
    let v = n === 0 ? 1 : 0;
    for (let k = 0; k < a.length && n - 1 - k >= 0; k++) v += a[k] * h[n - 1 - k];
    h[n] = v;
  }
  return h;
}

/** Convolución truncada y = h * v (las dos de longitud L). */
function convolve(h: Float64Array, v: Float64Array, out: Float64Array): Float64Array {
  const L = h.length;
  for (let n = 0; n < L; n++) {
    let s = 0;
    for (let k = 0; k <= n; k++) s += h[k] * v[n - k];
    out[n] = s;
  }
  return out;
}

function sparseConvolve(h: Float64Array, c: Sparse, out: Float64Array): Float64Array {
  out.fill(0);
  const L = h.length;
  for (let i = 0; i < c.pos.length; i++) {
    const p = c.pos[i];
    const s = c.sign[i];
    for (let n = p; n < L; n++) out[n] += s * h[n - p];
  }
  return out;
}

const dot = (a: Float64Array, b: Float64Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

/** Filtro todo-polos con estado explícito (para poder calcular la respuesta a entrada cero). */
function allPole(a: ArrayLike<number>, input: Float64Array, mem: Float64Array, updateMem: boolean): Float64Array {
  const m = updateMem ? mem : mem.slice();
  const y = new Float64Array(input.length);
  for (let n = 0; n < input.length; n++) {
    let v = input[n];
    for (let k = 0; k < a.length; k++) v += a[k] * m[k];
    m.copyWithin(1, 0);
    m[0] = v;
    y[n] = v;
  }
  return y;
}

/** Vector del libro adaptativo: excitación pasada con retardo T (repetida si T < L). */
function adaptiveVector(history: Float64Array, T: number, L: number): Float64Array {
  const v = new Float64Array(L);
  const H = history.length;
  for (let n = 0; n < L; n++) v[n] = n < T ? history[H - T + n] : v[n - T];
  return v;
}

// ─── Codificador ────────────────────────────────────────────────────────────

export function celpEncode(x: Float32Array, c: CelpConfig) {
  const w = new BitWriter();
  const L = c.frameLen / c.subframes;
  const codebook = makeCodebook(c.codebookSize, L);
  const maxLag = c.minLag + 2 ** c.pitchBits - 1;
  const history = new Float64Array(maxLag + L);
  const weightMem = new Float64Array(c.order); // estado de 1/A(z/γ) sobre el residuo (voz ponderada)
  const hMem = new Float64Array(c.order); // estado de 1/A(z/γ) sobre la excitación
  const synth = new SynthesisFilter(c.order);
  const y = new Float32Array(x.length);
  const win = Math.round(c.frameLen * 1.5);
  const look = Math.round((win - c.frameLen) / 2);
  const yBuf = new Float64Array(L);
  let lastA: Float64Array = new Float64Array(c.order);

  for (let start = 0; start < x.length; start += c.frameLen) {
    const { k } = lpcFrame(frameAt(x, start - look, win), c.order);
    const qk = Array.from(k, quantK);
    qk.forEach((q) => w.write(q, K_BITS));
    const a = reflectionToLpc(qk.map(dequantK));
    const ag = a.map((v, i) => v * c.gamma ** (i + 1));
    const h = impulseResponse(ag, L);
    lastA = a;

    for (let s = 0; s < c.subframes; s++) {
      const s0 = start + s * L;
      // Voz ponderada: residuo A(z)·x pasado por 1/A(z/γ).
      const res = new Float64Array(L);
      for (let n = 0; n < L; n++) {
        let e = x[s0 + n] ?? 0;
        for (let j = 0; j < c.order; j++) e -= a[j] * (x[s0 + n - 1 - j] ?? 0);
        res[n] = e;
      }
      const sw = allPole(ag, res, weightMem, true);
      // Objetivo: lo que falta tras restar la respuesta a entrada cero del filtro ponderado.
      const zir = allPole(ag, new Float64Array(L), hMem, false);
      const target = sw.map((v, n) => v - zir[n]);

      // 1. Libro adaptativo (tono).
      let vA: Float64Array = new Float64Array(L);
      let gA = 0;
      if (c.adaptive) {
        let bestT = c.minLag;
        let bestScore = -1;
        let bestV: Float64Array = vA;
        let bestY: Float64Array = new Float64Array(L);
        for (let T = c.minLag; T <= maxLag; T++) {
          const v = adaptiveVector(history, T, L);
          const yv = convolve(h, v, new Float64Array(L));
          const ty = dot(target, yv);
          const yy = dot(yv, yv);
          if (yy > 1e-12 && ty > 0 && (ty * ty) / yy > bestScore) {
            bestScore = (ty * ty) / yy;
            bestT = T;
            bestV = v;
            bestY = yv;
          }
        }
        const yy = dot(bestY, bestY);
        const qa = quantGA(yy > 1e-12 ? dot(target, bestY) / yy : 0);
        gA = dequantGA(qa);
        w.write(bestT - c.minLag, c.pitchBits);
        w.write(qa, GA_BITS);
        vA = bestV;
        for (let n = 0; n < L; n++) target[n] -= gA * bestY[n];
      }

      // 2. Libro estocástico.
      let bestI = 0;
      let bestScore = -1;
      let bestG = 0;
      for (let i = 0; i < codebook.length; i++) {
        const yc = sparseConvolve(h, codebook[i], yBuf);
        const ty = dot(target, yc);
        const yy = dot(yc, yc);
        if (yy > 1e-12 && (ty * ty) / yy > bestScore) {
          bestScore = (ty * ty) / yy;
          bestI = i;
          bestG = ty / yy;
        }
      }
      const qs = quantGS(bestG);
      w.write(bestI, Math.log2(c.codebookSize));
      w.write(qs, GS_BITS);
      const gS = dequantGS(qs);
      const cS = sparseToDense(codebook[bestI], L);

      // Excitación final: actualiza memorias exactamente como lo hará el decodificador.
      const u = new Float64Array(L);
      for (let n = 0; n < L; n++) u[n] = gA * vA[n] + gS * cS[n];
      allPole(ag, u, hMem, true);
      history.copyWithin(0, L);
      history.set(u, history.length - L);
      for (let n = 0; n < L && s0 + n < x.length; n++) {
        y[s0 + n] = Math.max(-2, Math.min(2, synth.process(u[n], a)));
      }
      // Sigue la síntesis aunque la última subtrama se salga de la señal.
      for (let n = Math.max(0, x.length - s0); n < L; n++) synth.process(u[n], a);
    }
  }
  return { writer: w, reconstructed: y, lookaheadSamples: look, lastA };
}

// ─── Decodificador ──────────────────────────────────────────────────────────

export function celpDecode(bytes: Uint8Array, bitLength: number, n: number, c: CelpConfig) {
  const r = new BitReader(bytes, bitLength);
  const L = c.frameLen / c.subframes;
  const codebook = makeCodebook(c.codebookSize, L);
  const maxLag = c.minLag + 2 ** c.pitchBits - 1;
  const history = new Float64Array(maxLag + L);
  const synth = new SynthesisFilter(c.order);
  const y = new Float32Array(n);
  const excitation = new Float32Array(n);
  const idxBits = Math.log2(c.codebookSize);

  for (let start = 0; start < n; start += c.frameLen) {
    const a = reflectionToLpc(Array.from({ length: c.order }, () => dequantK(r.read(K_BITS))));
    for (let s = 0; s < c.subframes; s++) {
      const s0 = start + s * L;
      let vA: Float64Array = new Float64Array(L);
      let gA = 0;
      if (c.adaptive) {
        const T = Math.min(maxLag, r.read(c.pitchBits) + c.minLag);
        gA = dequantGA(r.read(GA_BITS));
        vA = adaptiveVector(history, T, L);
      }
      const i = Math.min(codebook.length - 1, r.read(idxBits));
      const gS = dequantGS(r.read(GS_BITS));
      const cS = sparseToDense(codebook[i], L);
      const u = new Float64Array(L);
      for (let k = 0; k < L; k++) u[k] = gA * vA[k] + gS * cS[k];
      history.copyWithin(0, L);
      history.set(u, history.length - L);
      for (let k = 0; k < L; k++) {
        const v = synth.process(u[k], a);
        if (s0 + k < n) {
          y[s0 + k] = Math.max(-2, Math.min(2, v));
          excitation[s0 + k] = u[k];
        }
      }
    }
  }
  return { y, excitation };
}
