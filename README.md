# TinkerSignals

[![CI](https://github.com/Tatuck/TinkerSignals/actions/workflows/ci.yml/badge.svg)](https://github.com/Tatuck/TinkerSignals/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

https://github.com/user-attachments/assets/ccdef1f1-90e6-4027-ad7e-3fd3f333b8b9

Laboratorio visual para aprender codificación y compresión de audio montando
bloques, como en TinkerCad. Entra audio real (archivo, micrófono o generador),
pasa por cuantizadores, codificadores, canales con errores y decodificadores, y
sale un WAV que puedes escuchar y descargar. Cada bloque explica qué hace y
enseña sus números (SNR, bps, factor de compresión, retardo) y una gráfica
sencilla de entrada frente a salida. Cada cable se puede abrir para ver qué pasa
por él.

Los bloques cubren lo que se suele ver en un curso de codificación de audio,
imagen y servicios multimedia:

- **Digitalización**: muestreo con filtro antialiasing, cuantización uniforme y no uniforme, PCM y G.711.
- **Códecs de forma de onda**: DPCM y ADPCM.
- **Voz**: análisis por tramas, vocoder LPC y CELP.
- **Transformada y perceptuales**: DCT por bloques, MPEG-1 Layer I con modelo psicoacústico y subbandas tipo G.722.
- **Sin pérdidas**: Huffman, codificación aritmética, LZW y RLE.
- **Canal y red**: errores de bit, ruido, paquetes RTP, red IP con pérdidas y jitter, búfer de jitter.
- **Imagen y JPEG**: espacio de color YCbCr, submuestreo de crominancia, DCT 2D por bloques, cuantizador con las tablas de JPEG, códec JPEG básico completo, PCM de imagen y comparador con PSNR y SSIM.
- **Esteganografía**: esconder cualquier flujo de bits (un texto, otra imagen) en los bits bajos de una imagen o de un audio.

Hay lecciones guiadas, experimentos ya montados, una biblioteca de sonidos
(sintéticos y grabaciones de dominio público), enlaces para compartir
circuitos y deshacer/rehacer. Además:

- **Por dentro**: doble clic en un bloque abre su circuito equivalente hecho
  con piezas básicas (tramas, DCT, FFT, filtros, Levinson…), ejecutado sobre
  la misma entrada y comparado con el bloque real.
- **Lupa temporal**: eliges un instante y todos los bloques muestran esa trama.
- **Teoría**: fichas con explicación y fórmulas, enlazadas desde cada bloque.
- **Comparar códecs**: curvas tasa–calidad de varias familias con la misma señal.
- **Calidad de la llamada**: MOS con el modelo E (ITU-T G.107).

## Uso

Funciona entero en el navegador: no hay servidor ni cuentas, y lo que montas se
guarda en tu equipo. Para ejecutarlo en local hace falta Node 22 o superior:

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests del motor y de todos los bloques
npm run typecheck
npm run lint
```

## Arquitectura

```
src/
  engine/   Motor en TypeScript puro (sin React ni DOM)
    types.ts       El contrato: Signal, Bitstream, BlockDefinition, Graph…
    registry.ts    Catálogo de bloques y saneado de parámetros
    graph.ts       Validación de cables (tipos, bucles) y orden topológico
    evaluator.ts   Ejecución con caché por nodo, aislamiento de errores y retardo acumulado
    dsp/           Matemáticas compartidas: FFT, DCT, LPC, filtros, bits, métricas…
  blocks/   Un bloque = una carpeta (autodescubiertos)
    <id>/index.ts          defineBlock({...})
    <id>/locales/es.json   Textos didácticos
    _shared/               Núcleos de códecs que comparten codificador y decodificador
    _template/             Plantilla comentada para crear bloques
  runtime/  Web Worker donde se ejecuta el motor + análisis de los cables
  ui/       React + React Flow: lienzo, paleta, panel lateral, gráficas
  i18n/     Textos generales de la interfaz
```

Las dependencias van en un solo sentido: `ui → runtime → engine ← blocks`. El
motor y los bloques no pueden importar la UI (ESLint lo impide), así que todo se
prueba en Node sin navegador.

Ideas clave:

- **Bloques atómicos.** Un bloque declara puertos, parámetros y una función
  pura `process`. Un fallo en un bloque solo marca ese nodo en rojo.
- **Cinco tipos de cable**: audio (`signal`), bits (`bitstream`), paquetes de red (`packets`), tramas (`frames`) e imágenes (`image`).
- **Los cables llevan datos reales.** Un codificador produce bits empaquetados
  (`Bitstream`) y el decodificador los lee, igual que un códec de verdad. Por
  eso un bloque de errores de canal estropea lo que estropearía en la realidad.
- **El retardo cuenta.** Cada bloque declara su retardo algorítmico (lo que
  tiene que esperar para reunir una trama). El motor lo suma por el camino y la
  Salida lo compara con los 150 ms de ITU-T G.114. Las señales se mantienen
  alineadas para poder compararlas; el retardo se informa, no se aplica.
- **Caché por nodo.** Al mover un deslizador solo se recalcula ese bloque y lo
  que hay detrás.

Para añadir un bloque, lee [docs/como-crear-un-bloque.md](docs/como-crear-un-bloque.md).

## Sonidos

Los fragmentos de `public/sounds/` se generan con
`node scripts/make-sound-clips.mjs <carpeta-con-los-mp3>` a partir de
grabaciones de dominio público; los créditos están en
[public/sounds/CREDITS.md](public/sounds/CREDITS.md).

## Despliegue

`npm run build` genera en `dist/` un sitio estático. Está preparado para
Cloudflare Workers (`wrangler.jsonc` y `public/_headers`): conectando el
repositorio en Cloudflare cada push a `main` se publica solo, o a mano con
`npm run deploy`. Sirve también cualquier hosting estático (GitHub Pages,
Netlify…) siempre que use HTTPS, que el micrófono lo necesita.

## Contribuir

Las ideas y correcciones son bienvenidas por issues o pull requests. Para
añadir un bloque sigue [docs/como-crear-un-bloque.md](docs/como-crear-un-bloque.md);
antes de enviar nada, `npm test`, `npm run typecheck` y `npm run lint` deben
pasar (la integración continua los lanza en cada pull request). Los textos de
la interfaz y la documentación están en español.

El vídeo de presentación se genera desde la propia app; los pasos están en
[video/README.md](video/README.md).

## Licencia

El código está bajo licencia [MIT](LICENSE). Las grabaciones de
`public/sounds/` son de dominio público (ver [CREDITS.md](public/sounds/CREDITS.md)).
