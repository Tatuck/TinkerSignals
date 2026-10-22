/**
 * Renderiza los dos vídeos (y el GIF y el póster para el README) en out/.
 *
 *   node scripts/render.mjs                    # todo
 *   node scripts/render.mjs --fotos 60,300     # solo fotogramas sueltos, para revisar
 *
 * Cada pestaña de Chromium decodifica capturas de 5760×3240 (~75 MB cada una):
 * con las 8 pestañas por defecto se acaba la memoria, así que van 2 (HILOS=n).
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const out = (f) => `${raiz}out/${f}`;
mkdirSync(out(''), { recursive: true });

// El bundle copia public/ (casi 2 GB de capturas): a /tmp no, que suele estar en memoria.
const outDir = out('bundle');
rmSync(outDir, { recursive: true, force: true });
const serveUrl = await bundle({ entryPoint: `${raiz}src/index.ts`, outDir });
const comp = (id) => selectComposition({ serveUrl, id });

const i = process.argv.indexOf('--fotos');
if (i > 0) {
  const fotos = process.argv[i + 1].split(',').map(Number);
  for (const id of ['Horizontal', 'Cuadrado']) {
    const composition = await comp(id);
    for (const frame of fotos) {
      await renderStill({ serveUrl, composition, frame, output: out(`${id}-${frame}.png`) });
    }
  }
  console.log('Fotogramas en out/');
  rmSync(outDir, { recursive: true, force: true });
  process.exit(0);
}

const concurrency = Number(process.env.HILOS ?? 2);
const progreso = (id) => ({ progress }) => process.stdout.write(`\r${id} ${Math.round(progress * 100)} %`);
for (const [id, archivo] of [
  ['Horizontal', 'tinkersignals.mp4'],
  ['Cuadrado', 'tinkersignals-cuadrado.mp4'],
]) {
  const composition = await comp(id);
  await renderMedia({
    serveUrl,
    composition,
    concurrency,
    codec: 'h264',
    crf: 17,
    audioCodec: 'aac',
    audioBitrate: '192k',
    pixelFormat: 'yuv420p',
    outputLocation: out(archivo),
    onProgress: progreso(id),
  });
  console.log();
}

// Póster y GIF corto para el README (unir bloques con cables y mirar los bits del cable).
const horizontal = await comp('Horizontal');
await renderStill({ serveUrl, composition: horizontal, frame: 470, output: out('poster.png') });
await renderMedia({
  serveUrl,
  composition: horizontal,
  concurrency,
  codec: 'gif',
  scale: 0.5,
  everyNthFrame: 3,
  frameRange: [250, 500],
  outputLocation: out('preview.gif'),
  onProgress: progreso('GIF'),
});
console.log();
rmSync(outDir, { recursive: true, force: true });
