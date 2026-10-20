/**
 * Genera los fragmentos de la biblioteca de sonidos a partir de grabaciones
 * de dominio público. Uso:
 *   node scripts/make-sound-clips.mjs <carpeta-con-los-mp3>
 * Escribe WAV mono de 16 bits en public/sounds/ y el índice sounds.json.
 */
import { MPEGDecoder } from 'mpg123-decoder';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.argv[2];
if (!SRC) throw new Error('Indica la carpeta con los MP3 descargados');

const CLIPS = [
  { id: 'voz-masculina', file: 'voz-mpinedag.mp3', start: 75, seconds: 10, rate: 16000 },
  { id: 'voz-femenina', file: 'voz-aponte.mp3', start: 90, seconds: 10, rate: 16000 },
  { id: 'piano-bach', file: 'goldberg4.mp3', start: 2, seconds: 10, rate: 32000 },
  { id: 'cuarteto-haydn', file: 'haydn-lark.mp3', start: 4, seconds: 10, rate: 32000 },
];

const decoder = new MPEGDecoder();
await decoder.ready;

for (const c of CLIPS) {
  await decoder.reset();
  const { mono, sampleRate } = decodeMp3(readFileSync(join(SRC, c.file)));

  // Ajusta inicio y fin al silencio más cercano para no cortar a mitad de palabra.
  const a = snapToQuiet(mono, Math.round(c.start * sampleRate), sampleRate);
  const b = snapToQuiet(mono, a + Math.round(c.seconds * sampleRate), sampleRate);
  const clip = resample(mono.subarray(a, b), sampleRate, c.rate);
  fade(clip, c.rate);
  normalize(clip, 0.89);
  writeFileSync(join('public/sounds', `${c.id}.wav`), wav(clip, c.rate));
  console.log(`${c.id}: ${(clip.length / c.rate).toFixed(2)} s @ ${c.rate} Hz`);
}

/** Decodifica por trozos (el decodificador no acepta el archivo de golpe) y mezcla a mono. */
function decodeMp3(buf) {
  if (buf.toString('latin1', 0, 3) === 'ID3') {
    const size = ((buf[6] & 127) << 21) | ((buf[7] & 127) << 14) | ((buf[8] & 127) << 7) | (buf[9] & 127);
    buf = buf.subarray(10 + size);
  }
  const parts = [];
  let sampleRate = 0;
  let total = 0;
  for (let i = 0; i < buf.length; i += 16384) {
    const r = decoder.decode(buf.subarray(i, i + 16384));
    if (!r.samplesDecoded) continue;
    sampleRate = r.sampleRate;
    const m = new Float32Array(r.samplesDecoded);
    for (const ch of r.channelData) for (let k = 0; k < m.length; k++) m[k] += ch[k] / r.channelData.length;
    parts.push(m);
    total += m.length;
  }
  const mono = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    mono.set(p, o);
    o += p.length;
  }
  return { mono, sampleRate };
}

/** Busca, en ±1 s, el punto con menos energía (ventanas de 20 ms). */
function snapToQuiet(x, at, fs) {
  const win = Math.round(0.02 * fs);
  let best = at;
  let bestE = Infinity;
  for (let s = Math.max(0, at - fs); s < Math.min(x.length - win, at + fs); s += win) {
    let e = 0;
    for (let i = s; i < s + win; i++) e += x[i] * x[i];
    if (e < bestE) {
      bestE = e;
      best = s;
    }
  }
  return best;
}

/** Remuestreo con sinc enventanada (calidad suficiente para material de referencia). */
function resample(x, fsIn, fsOut) {
  const ratio = fsOut / fsIn;
  const n = Math.floor(x.length * ratio);
  const y = new Float32Array(n);
  const fc = 0.47 * Math.min(1, ratio);
  const half = 32;
  for (let i = 0; i < n; i++) {
    const t = i / ratio;
    const c = Math.floor(t);
    let s = 0;
    for (let k = c - half + 1; k <= c + half; k++) {
      const d = t - k;
      const sinc = d === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * d) / (Math.PI * d);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * d) / half);
      s += (x[k] ?? 0) * sinc * w;
    }
    y[i] = s;
  }
  return y;
}

function fade(x, fs) {
  const n = Math.round(0.01 * fs);
  for (let i = 0; i < n; i++) {
    x[i] *= i / n;
    x[x.length - 1 - i] *= i / n;
  }
}

function normalize(x, peak) {
  let m = 1e-9;
  for (const v of x) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < x.length; i++) x[i] *= peak / m;
}

function wav(x, fs) {
  const buf = Buffer.alloc(44 + x.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + x.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(fs, 24);
  buf.writeUInt32LE(fs * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  return buf;
}
