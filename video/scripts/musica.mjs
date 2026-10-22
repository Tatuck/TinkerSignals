/**
 * Descarga la música del vídeo y la deja en public/audio/bach.wav: la variación 4
 * de las Variaciones Goldberg del DVD de Musopen (Public Domain Mark 1.0), entera
 * (54 s) para que no se repita. public/sounds/piano-bach.wav es un recorte de 10 s
 * de la misma grabación.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const URL_MP3 =
  'https://archive.org/download/musopen-dvd/Musopen-DVD.zip/Musopen%20DVD%2FGoldberg%20Variations%2FGoldberg%20Variations%2C%20BWV.%20988%20-%20Variation%204.mp3';
const dir = fileURLToPath(new URL('../public/audio/', import.meta.url));
mkdirSync(dir, { recursive: true });

const res = await fetch(URL_MP3);
if (!res.ok) throw new Error(`No se pudo descargar la música: ${res.status}`);
writeFileSync(`${dir}bach.mp3`, Buffer.from(await res.arrayBuffer()));
// Remotion trae su propio ffmpeg.
execFileSync('npx', ['remotion', 'ffmpeg', '-y', '-v', 'error', '-i', `${dir}bach.mp3`, '-ar', '48000', `${dir}bach.wav`], {
  stdio: 'inherit',
});
console.log('Música en public/audio/bach.wav');
