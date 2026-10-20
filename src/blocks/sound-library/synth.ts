import { seededRandom } from '../_shared/random';

/**
 * Sonidos sintéticos para la biblioteca. Todos se generan por código (sin
 * archivos ni licencias) y de forma determinista.
 */

// ─── Voz por formantes (síntesis fuente-filtro) ─────────────────────────────

/** Formantes (Hz) aproximados de las vocales del castellano. */
const VOWELS = {
  a: [800, 1250, 2600],
  e: [480, 1900, 2600],
  i: [300, 2300, 3000],
  o: [500, 900, 2500],
  u: [330, 750, 2400],
} as const;
type Vowel = keyof typeof VOWELS;

type Segment =
  | { kind: 'vowel'; v: Vowel; ms: number }
  | { kind: 'fric'; band: [number, number]; ms: number; gain?: number }
  | { kind: 'stop'; ms: number }
  | { kind: 'nasal'; ms: number }
  | { kind: 'pause'; ms: number };

/** Resonador de 2.º orden con coeficientes que pueden cambiar en cada muestra. */
class Resonator {
  private y1 = 0;
  private y2 = 0;
  process(x: number, f: number, bw: number, fs: number): number {
    const r = Math.exp((-Math.PI * bw) / fs);
    const a1 = 2 * r * Math.cos((2 * Math.PI * f) / fs);
    const a2 = -r * r;
    const y = (1 - r) * x + a1 * this.y1 + a2 * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/**
 * Sintetiza una secuencia de segmentos con tono `f0` que cae suavemente
 * (entonación declarativa). Los formantes se interpolan entre vocales para
 * imitar la coarticulación.
 */
function speak(segments: Segment[], fs: number, f0: number, seed = 3): Float32Array {
  const total = segments.reduce((s, g) => s + Math.round((g.ms / 1000) * fs), 0);
  const y = new Float32Array(total);
  const rand = seededRandom(seed);
  const res = [new Resonator(), new Resonator(), new Resonator()];
  const fric = [new Resonator(), new Resonator()];
  let phase = 0;
  let pos = 0;
  let prevF: readonly number[] = VOWELS.a;

  segments.forEach((seg, si) => {
    const n = Math.round((seg.ms / 1000) * fs);
    const next = segments.slice(si + 1).find((s) => s.kind === 'vowel') as
      | Extract<Segment, { kind: 'vowel' }>
      | undefined;
    for (let i = 0; i < n; i++, pos++) {
      const t = pos / total;
      const pitch = f0 * (1.08 - 0.22 * t) * (1 + 0.01 * Math.sin(pos * 0.002));
      let s = 0;
      if (seg.kind === 'vowel' || seg.kind === 'nasal') {
        phase += pitch / fs;
        let glottal = 0;
        if (phase >= 1) {
          phase -= 1;
          glottal = 1;
        }
        // Un poco de aspiración: la voz real nunca es periódica pura.
        const src = glottal + 0.02 * (rand() * 2 - 1);
        const target = seg.kind === 'vowel' ? VOWELS[seg.v] : [250, 1100, 2400];
        const k = Math.min(1, i / (0.3 * n + 1));
        const f = prevF.map((p, j) => p + (target[j] - p) * k);
        const after = next && i > 0.75 * n ? VOWELS[next.v] : null;
        const ff = after ? f.map((v, j) => v + (after[j] - v) * ((i - 0.75 * n) / (0.25 * n)) * 0.4) : f;
        s = res.reduce((acc, r, j) => r.process(acc, ff[j], 60 + 40 * j, fs), src) * 18;
        if (seg.kind === 'nasal') s *= 0.35;
        // Envolvente suave de ataque y caída.
        s *= Math.min(1, i / (0.015 * fs), (n - i) / (0.02 * fs));
        if (i === n - 1 && seg.kind === 'vowel') prevF = target;
      } else if (seg.kind === 'fric') {
        const noise = rand() * 2 - 1;
        const [lo, hi] = seg.band;
        s = fric[1].process(fric[0].process(noise, lo, (hi - lo) * 0.8, fs), hi, hi - lo, fs);
        s *= (seg.gain ?? 1) * Math.min(1, i / (0.01 * fs), (n - i) / (0.01 * fs));
      } else if (seg.kind === 'stop') {
        // Oclusiva: silencio y una pequeña explosión al final.
        s = i > n - 0.012 * fs ? (rand() * 2 - 1) * 0.5 : 0;
      }
      y[pos] = s;
    }
    // Cada tipo de sonido con su nivel típico: las vocales mandan, las
    // fricativas van unos 16 dB por debajo (como en la voz real).
    const level = { vowel: 0.2, nasal: 0.07, fric: 0.03, stop: 0.04, pause: 0 }[seg.kind];
    const seg0 = pos - n;
    let e = 0;
    for (let i = seg0; i < pos; i++) e += y[i] * y[i];
    const rms = Math.sqrt(e / Math.max(1, n));
    if (rms > 0) for (let i = seg0; i < pos; i++) y[i] *= (level * (seg.kind === 'fric' ? (seg.gain ?? 1) : 1)) / rms;
  });
  return normalize(y, 0.85);
}

const V = (v: Vowel, ms = 140): Segment => ({ kind: 'vowel', v, ms });
const S: Segment = { kind: 'fric', band: [4500, 7000], ms: 110 };
const F: Segment = { kind: 'fric', band: [1500, 6000], ms: 90, gain: 0.4 };
const J: Segment = { kind: 'fric', band: [1200, 2600], ms: 100, gain: 0.8 };
const P: Segment = { kind: 'stop', ms: 60 };
const N: Segment = { kind: 'nasal', ms: 70 };
const pause = (ms: number): Segment => ({ kind: 'pause', ms });

// ─── Música y otros ─────────────────────────────────────────────────────────

/** Acordes con timbre de piano eléctrico (aditiva con caída exponencial). */
function chords(fs: number): Float32Array {
  const progression = [
    [261.6, 329.6, 392.0],
    [220.0, 261.6, 329.6],
    [174.6, 220.0, 261.6],
    [196.0, 246.9, 293.7],
  ];
  const noteLen = Math.round(0.9 * fs);
  const y = new Float32Array(noteLen * progression.length);
  progression.forEach((chord, c) => {
    for (const f of chord) {
      for (let h = 1; h <= 6; h++) {
        const amp = 1 / (h * h * 0.7);
        const decay = 2.5 + h * 1.5;
        for (let i = 0; i < noteLen; i++) {
          const t = i / fs;
          y[c * noteLen + i] += amp * Math.exp(-decay * t) * Math.sin(2 * Math.PI * f * h * t);
        }
      }
    }
  });
  return normalize(y, 0.8);
}

/** Patrón de batería: bombo, caja y charles. Transitorios fuertes (ideal para ver el pre-eco). */
function drums(fs: number): Float32Array {
  const beat = Math.round(0.25 * fs);
  const steps = 16;
  const y = new Float32Array(beat * steps);
  const rand = seededRandom(11);
  const hit = (start: number, len: number, gen: (t: number, i: number) => number) => {
    for (let i = 0; i < len && start + i < y.length; i++) y[start + i] += gen(i / fs, i);
  };
  for (let s = 0; s < steps; s++) {
    const t0 = s * beat;
    if (s % 4 === 0 || s === 10) {
      hit(t0, 0.35 * fs, (t) => Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9));
    }
    if (s % 8 === 4) {
      hit(t0, 0.2 * fs, (t) => ((rand() * 2 - 1) * 0.7 + 0.4 * Math.sin(2 * Math.PI * 190 * t)) * Math.exp(-t * 22));
    }
    hit(t0, 0.05 * fs, (t) => (rand() * 2 - 1) * 0.25 * Math.exp(-t * 80) * (s % 2 ? 0.6 : 1));
  }
  return normalize(y, 0.85);
}

/** Tonos DTMF de un número de teléfono (cada dígito = dos senoidales). */
function dtmf(fs: number): Float32Array {
  const low = [697, 770, 852, 941];
  const high = [1209, 1336, 1477];
  const keys = '1234567890';
  const pos: Record<string, [number, number]> = {
    '1': [0, 0], '2': [0, 1], '3': [0, 2], '4': [1, 0], '5': [1, 1],
    '6': [1, 2], '7': [2, 0], '8': [2, 1], '9': [2, 2], '0': [3, 1],
  };
  const tone = Math.round(0.12 * fs);
  const gap = Math.round(0.08 * fs);
  const y = new Float32Array((tone + gap) * keys.length);
  [...keys].forEach((k, n) => {
    const [r, c] = pos[k];
    for (let i = 0; i < tone; i++) {
      const t = i / fs;
      y[n * (tone + gap) + i] = 0.4 * (Math.sin(2 * Math.PI * low[r] * t) + Math.sin(2 * Math.PI * high[c] * t));
    }
  });
  return y;
}

function normalize(x: Float32Array, peak: number): Float32Array {
  let m = 1e-9;
  for (const v of x) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
}

// ─── Catálogo ───────────────────────────────────────────────────────────────

export interface SynthSound {
  sampleRate: number;
  make(fs: number): Float32Array;
}

export const SYNTH_SOUNDS = {
  'vowels-low': {
    sampleRate: 16000,
    make: (fs) => speak([V('a', 300), pause(80), V('e', 300), pause(80), V('i', 300), pause(80), V('o', 300), pause(80), V('u', 300)], fs, 115),
  },
  'vowels-high': {
    sampleRate: 16000,
    make: (fs) => speak([V('a', 300), pause(80), V('e', 300), pause(80), V('i', 300), pause(80), V('o', 300), pause(80), V('u', 300)], fs, 215, 5),
  },
  syllables: {
    sampleRate: 16000,
    // «la casa es azul, sí» aproximado con segmentos.
    make: (fs) =>
      speak(
        [N, V('a'), P, V('a', 120), S, V('a', 160), pause(60), V('e', 110), S, V('a', 90), S, V('u', 140), N, pause(150), S, V('i', 260)],
        fs,
        130,
        9,
      ),
  },
  fricatives: {
    sampleRate: 16000,
    make: (fs) => speak([S, V('a', 160), pause(120), F, V('a', 160), pause(120), J, V('a', 160)], fs, 125, 4),
  },
  chords: { sampleRate: 44100, make: chords },
  drums: { sampleRate: 44100, make: drums },
  dtmf: { sampleRate: 8000, make: dtmf },
} satisfies Record<string, SynthSound>;

export type SynthSoundId = keyof typeof SYNTH_SOUNDS;
