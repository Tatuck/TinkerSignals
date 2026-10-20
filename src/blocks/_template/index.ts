/**
 * PLANTILLA DE BLOQUE
 * ───────────────────
 * Copia esta carpeta, renómbrala (p. ej. `src/blocks/mi-bloque/`) y cambia el
 * `id` para que coincida con el nombre de la carpeta. El bloque aparecerá
 * solo en la paleta: no hay que registrarlo en ningún otro sitio.
 *
 * Las carpetas que empiezan por "_" se ignoran, por eso esta no sale.
 *
 * Reglas:
 *  1. `process` debe ser una función pura: mismas entradas → mismo resultado.
 *     Nada de Math.random() sin semilla (usa `seededRandom` de `../_shared/random`).
 *  2. No importes nada de `src/ui` ni de React: el bloque se ejecuta en un Worker.
 *  3. Si algo va mal, lanza un Error con un mensaje que diga cómo arreglarlo.
 *     El motor lo enseña en el nodo y el resto del circuito sigue funcionando.
 *  4. Todos los textos van en `locales/es.json` (un test comprueba que no falte ninguno).
 */
import { snr } from '@/engine/dsp/metrics';
import { compareWaves } from '@/engine/dsp/plots';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';

export default defineBlock({
  id: '_template',
  // Categoría de la paleta: entrada, digitalizacion, diferencial, transformada,
  // sin-perdidas, voz, canal, utilidades o salida. Decide el color del bloque.
  category: 'utilidades',
  icon: '🧩',

  // Puertos. Tipos: 'signal' (audio) o 'bitstream' (bits). Solo se pueden
  // conectar puertos del mismo tipo. `optional: true` si puede ir sin conectar.
  inputs: { in: { type: 'signal' } },
  outputs: { out: { type: 'signal' } },

  // Parámetros: la UI genera los controles a partir de aquí.
  //  - number  → deslizador (scale: 'log' para frecuencias)
  //  - select  → botones (≤ 3 opciones) o desplegable
  //  - boolean → casilla
  //  - visibleIf para mostrarlo solo según otro parámetro
  params: {
    gain: { type: 'number', default: 0.5, min: 0, max: 2, step: 0.01 },
    invert: { type: 'boolean', default: false },
  },

  process({ inputs, params }) {
    // `inputs` y `params` están tipados a partir de lo declarado arriba.
    const { samples: x, sampleRate: fs } = inputs.in;
    const k = params.invert ? -params.gain : params.gain;
    const y = x.map((v) => v * k);

    return {
      outputs: { out: makeSignal(y, fs) },
      // Métricas: las `highlight` se ven en grande en el nodo (2 o 3 como mucho).
      // Claves comunes con etiqueta ya traducida: snr, snrSeg, bitrate,
      // compression, bitsPerSample, entropy, duration, sampleRate.
      metrics: [{ key: 'snr', value: snr(x, y), unit: 'dB', highlight: true }],
      // Gráficas didácticas: la primera se ve en el nodo; todas, en el panel.
      // `compareWaves` superpone un trozo de entrada (gris) y salida (color).
      plots: [compareWaves(x, y, fs)],
      // Retardo algorítmico en ms: lo que hay que esperar para reunir las
      // muestras que necesita el bloque (p. ej. tamaño de trama / fs).
      latencyMs: 0,
    };
  },
});
