import { describe, expect, it } from 'vitest';
import { Engine } from '@/engine/evaluator';
import { convertColor, dct2, idct2, imageMse, psnrFromMse, ssim, zigzag } from '@/engine/dsp/image';
import type { Bitstream, Graph, Image } from '@/engine/types';
import { createRegistry } from './index';
import { __specs, category, jpegDecode, jpegEncode, scaledTable, LUMA_TABLE } from './_shared/jpeg';
import { testImage } from './_shared/test-images';

const registry = createRegistry();

type Step = { id: string; type: string; params?: Record<string, number | string | boolean> };

/**
 * Monta un circuito a partir de nodos y cables escritos como
 * "origen.puerto>destino.puerto" y lo ejecuta.
 */
function circuit(nodes: Step[], wires: string[]) {
  const edges: Graph['edges'] = wires.map((w, i) => {
    const [from, to] = w.split('>');
    const [source, sourcePort] = from.split('.');
    const [target, targetPort] = to.split('.');
    return { id: `e${i}`, source, sourcePort, target, targetPort };
  });
  const engine = new Engine(registry);
  const result = engine.run({
    nodes: nodes.map((n) => ({ ...n, params: n.params ?? {} })),
    edges,
  });
  return {
    result,
    value: (node: string, port = 'out') => engine.getValue(node, port),
    metric: (node: string, key: string) =>
      result.nodes[node].metrics.find((m) => m.key === key)?.value,
  };
}

const psnr = (a: Image, b: Image) => psnrFromMse(imageMse(a, b));

describe('matemáticas de imagen', () => {
  it('el zigzag de 8×8 empieza como en la norma', () => {
    expect(zigzag(8).slice(0, 10)).toEqual([0, 1, 8, 16, 9, 2, 3, 10, 17, 24]);
    expect(new Set(zigzag(8)).size).toBe(64);
  });

  it('la DCT 2D es invertible y la DC es 8 veces la media', () => {
    const block = Float64Array.from({ length: 64 }, (_, i) => ((i * 37) % 50) - 25);
    const mean = block.reduce((a, b) => a + b, 0) / 64;
    const c = dct2(block, 8);
    expect(c[0]).toBeCloseTo(8 * mean, 6);
    const back = idct2(c, 8);
    for (let i = 0; i < 64; i++) expect(back[i]).toBeCloseTo(block[i], 6);
  });

  it('RGB → YCbCr → RGB no pierde nada', () => {
    const img = testImage('barras', 64, true);
    const back = convertColor(convertColor(img, 'ycbcr'), 'rgb');
    expect(psnr(img, back)).toBeGreaterThan(60);
  });

  it('el SSIM de una imagen consigo misma es 1', () => {
    const y = testImage('paisaje', 64, false).planes[0];
    expect(ssim(y, y)).toBeCloseTo(1, 6);
  });
});

describe('JPEG', () => {
  it('las tablas de Huffman tienen tantos códigos como símbolos', () => {
    for (const t of Object.values(__specs)) {
      expect(t.bits.reduce((a, b) => a + b, 0)).toBe(t.values.length);
      expect(new Set(t.values).size).toBe(t.values.length);
    }
    // Las de AC tienen los 160 pares (racha, categoría) más EOB y ZRL.
    expect(__specs.AC_LUMA.values.length).toBe(162);
    expect(__specs.AC_CHROMA.values.length).toBe(162);
  });

  it('la calidad 50 usa la tabla de la norma y la 100, pasos de 1', () => {
    expect(scaledTable(LUMA_TABLE, 50)).toEqual(LUMA_TABLE);
    expect(scaledTable(LUMA_TABLE, 100).every((v) => v === 1)).toBe(true);
  });

  it('categoría = bits de la magnitud (ejercicios de DC y AC)', () => {
    expect([0, 1, -1, 2, 3, -7, 8, 255, -988].map(category)).toEqual([0, 1, 1, 2, 2, 3, 4, 8, 10]);
  });

  it('codifica y decodifica: más calidad = más bits y más PSNR', () => {
    const img = testImage('paisaje', 128, true);
    const res = [20, 90].map((q) => {
      const { writer } = jpegEncode(img, q, '4:2:0');
      const { bytes, bitLength } = writer.finish();
      return { bits: bitLength, psnr: psnr(img, jpegDecode(bytes, bitLength).image) };
    });
    expect(res[1].bits).toBeGreaterThan(res[0].bits);
    expect(res[1].psnr).toBeGreaterThan(res[0].psnr);
    expect(res[1].psnr).toBeGreaterThan(30);
    // A calidad 90, una foto de 24 bits/píxel cabe en menos de 4.
    expect(res[1].bits / (128 * 128)).toBeLessThan(4);
  });

  it('las piezas DCT → cuantizador → DCT inversa dan lo mismo que el códec en grises', () => {
    const c = circuit(
      [
        { id: 'src', type: 'image-source', params: { image: 'paisaje', size: '64', color: false } },
        { id: 'dct', type: 'block-dct-2d' },
        { id: 'q', type: 'dct-quantizer', params: { quality: 40 } },
        { id: 'idct', type: 'block-idct-2d' },
        { id: 'enc', type: 'jpeg-encoder', params: { quality: 40 } },
        { id: 'dec', type: 'jpeg-decoder' },
      ],
      ['src.out>dct.in', 'dct.out>q.in', 'q.out>idct.in', 'src.out>enc.in', 'enc.out>dec.in'],
    );
    const pieces = c.value('idct') as Image;
    const codec = c.value('dec') as Image;
    expect(psnr(pieces, codec)).toBeGreaterThan(50);
  });

  it('un flujo con errores de bit no rompe el decodificador', () => {
    const c = circuit(
      [
        { id: 'src', type: 'image-source', params: { size: '64' } },
        { id: 'enc', type: 'jpeg-encoder' },
        { id: 'ch', type: 'bit-errors', params: { ber: 0.001 } },
        { id: 'dec', type: 'jpeg-decoder' },
      ],
      ['src.out>enc.in', 'enc.out>ch.in', 'ch.out>dec.in'],
    );
    expect(['ok', 'error']).toContain(c.result.nodes.dec.status);
    if (c.result.nodes.dec.status === 'error') {
      expect(c.result.nodes.dec.error).toMatch(/cabecera/);
    }
  });
});

describe('submuestreo y comparador', () => {
  it('4:2:0 reduce el color a la cuarta parte y ahorra la mitad de los datos', () => {
    const c = circuit(
      [
        { id: 'src', type: 'image-source', params: { size: '64' } },
        { id: 'ycc', type: 'color-space', params: { to: 'ycbcr' } },
        { id: 'sub', type: 'chroma-subsampling', params: { scheme: '4:2:0' } },
        { id: 'up', type: 'chroma-upsampling' },
        { id: 'rgb', type: 'color-space', params: { to: 'rgb' } },
        { id: 'cmp', type: 'image-comparator' },
      ],
      [
        'src.out>ycc.in',
        'ycc.out>sub.in',
        'sub.out>up.in',
        'up.out>rgb.in',
        'src.out>cmp.reference',
        'rgb.out>cmp.test',
      ],
    );
    const sub = c.value('sub') as Image;
    expect(sub.planes[1].width).toBe(32);
    expect(sub.planes[1].height).toBe(32);
    expect(c.metric('sub', 'saved')).toBeCloseTo(50, 6);
    expect(c.metric('cmp', 'psnr')).toBeGreaterThan(25);
  });
});

describe('PCM de imagen y sin pérdidas', () => {
  it('el ejercicio 7 a 3 bits pasa por Huffman y vuelve idéntico', () => {
    const c = circuit(
      [
        { id: 'src', type: 'image-source', params: { image: 'ejercicio-7' } },
        { id: 'pcm', type: 'image-pcm-encoder', params: { bits: 3 } },
        { id: 'hf', type: 'huffman-encoder' },
        { id: 'hd', type: 'huffman-decoder' },
        { id: 'dec', type: 'image-pcm-decoder' },
      ],
      ['src.out>pcm.in', 'pcm.out>hf.in', 'hf.out>hd.in', 'hd.out>dec.in'],
    );
    expect(psnr(c.value('src') as Image, c.value('dec') as Image)).toBe(Infinity);
    // 64 píxeles × 3 bits = 192 bits sin comprimir; Huffman (sin contar su tabla) baja de 3 bits/píxel.
    expect((c.value('pcm') as Bitstream).bitLength).toBe(192);
    expect(c.metric('hf', 'avgLength')).toBeLessThan(3);
  });
});

describe('esteganografía', () => {
  const message = 'Nos vemos a las cinco. ¡Ñandú!';

  it('un texto escondido en una imagen se recupera tal cual', () => {
    const c = circuit(
      [
        { id: 'img', type: 'image-source', params: { size: '64' } },
        { id: 'txt', type: 'text-source', params: { text: message } },
        { id: 'hide', type: 'lsb-hide-image', params: { bits: 1 } },
        { id: 'show', type: 'lsb-reveal-image', params: { bits: 1 } },
        { id: 'view', type: 'text-view' },
      ],
      ['img.out>hide.cover', 'txt.out>hide.message', 'hide.out>show.in', 'show.message>view.in'],
    );
    const plot = c.result.nodes.view.plots[0];
    expect(plot.kind === 'text' && plot.text).toBe(message);
    // Con 1 bit la imagen apenas cambia.
    expect(c.metric('hide', 'psnr')).toBeGreaterThan(50);
  });

  it('el JPEG borra el mensaje', () => {
    const c = circuit(
      [
        { id: 'img', type: 'image-source', params: { size: '64' } },
        { id: 'txt', type: 'text-source', params: { text: message } },
        { id: 'hide', type: 'lsb-hide-image' },
        { id: 'enc', type: 'jpeg-encoder', params: { quality: 95 } },
        { id: 'dec', type: 'jpeg-decoder' },
        { id: 'show', type: 'lsb-reveal-image' },
      ],
      [
        'img.out>hide.cover',
        'txt.out>hide.message',
        'hide.out>enc.in',
        'enc.out>dec.in',
        'dec.out>show.in',
      ],
    );
    expect(c.result.nodes.show.status).toBe('error');
  });

  it('una imagen se esconde dentro de otra', () => {
    const c = circuit(
      [
        { id: 'cover', type: 'image-source', params: { image: 'paisaje', size: '128' } },
        {
          id: 'secret',
          type: 'image-source',
          params: { image: 'tablero', size: '64', color: false },
        },
        { id: 'pcm', type: 'image-pcm-encoder', params: { bits: 2 } },
        { id: 'hide', type: 'lsb-hide-image', params: { bits: 1 } },
        { id: 'show', type: 'lsb-reveal-image', params: { bits: 1 } },
        { id: 'dec', type: 'image-pcm-decoder' },
      ],
      [
        'cover.out>hide.cover',
        'secret.out>pcm.in',
        'pcm.out>hide.message',
        'hide.out>show.in',
        'show.message>dec.in',
      ],
    );
    expect(c.result.nodes.dec.status).toBe('ok');
    expect((c.value('dec') as Image).width).toBe(64);
  });

  it('un texto escondido en audio se recupera, y con bits distintos no aparece', () => {
    const run = (revealBits: number) =>
      circuit(
        [
          { id: 'g', type: 'generator', params: { duration: 1 } },
          { id: 'txt', type: 'text-source', params: { text: message, encoding: 'ascii' } },
          { id: 'hide', type: 'lsb-hide-audio', params: { bits: 2 } },
          { id: 'show', type: 'lsb-reveal-audio', params: { bits: revealBits } },
          { id: 'view', type: 'text-view' },
        ],
        ['g.out>hide.cover', 'txt.out>hide.message', 'hide.out>show.in', 'show.message>view.in'],
      );
    const ok = run(2);
    const plot = ok.result.nodes.view.plots[0];
    // En ASCII la ñ y los signos de fuera de 7 bits se cambian por «?».
    expect(plot.kind === 'text' && plot.text).toBe('Nos vemos a las cinco. ??and?!');
    expect(ok.metric('hide', 'snr')).toBeGreaterThan(60);
    expect(run(3).result.nodes.show.status).toBe('error');
  });
});
