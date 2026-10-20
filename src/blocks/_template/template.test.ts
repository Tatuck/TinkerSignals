import { describe, expect, it } from 'vitest';
import { makeSignal } from '@/engine/dsp/signal';
import block from './index';

/**
 * Los bloques se prueban llamando a `process` directamente, sin UI.
 * Comprueba propiedades que conozcas de la teoría (p. ej. la SNR de un
 * cuantizador) o compara con resultados de MATLAB guardados como fixture.
 */
describe('plantilla', () => {
  it('multiplica por la ganancia', () => {
    const r = block.process({
      inputs: { in: makeSignal(new Float32Array([1, -0.5]), 8000) },
      params: { gain: 2, invert: false },
      getAsset: () => undefined,
    });
    expect([...r.outputs.out.samples]).toEqual([2, -1]);
  });
});
