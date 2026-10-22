import { makeBitstream } from '@/engine/dsp/bitstream';
import { expectPixels, planeToRgba, SUBSAMPLING } from '@/engine/dsp/image';
import { defineBlock, type Plot } from '@/engine/types';
import { jpegEncode, describeJpegField, type JpegBlockTrace } from '../_shared/jpeg';

export default defineBlock({
  id: 'jpeg-encoder',
  category: 'imagen',
  family: 'jpeg',
  familyRole: 'encoder',
  icon: '🗜️',
  inputs: { in: { type: 'image' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    quality: { type: 'number', default: 75, min: 1, max: 100, step: 1 },
    subsampling: {
      type: 'select',
      default: '4:2:0',
      options: Object.keys(SUBSAMPLING) as (keyof typeof SUBSAMPLING)[],
    },
    traceBlock: { type: 'number', default: 0, min: 0, max: 4095, step: 1 },
  },
  describeField: (field, value) => describeJpegField(field, value),
  process({ inputs, params }) {
    const img = inputs.in;
    expectPixels(img, 'El codificador JPEG');
    const { writer, stats } = jpegEncode(
      img,
      params.quality,
      params.subsampling,
      params.traceBlock,
    );
    const channels = img.color === 'gray' ? 1 : 3;
    const pixels = img.width * img.height;
    const out = makeBitstream(
      writer,
      { codec: 'jpeg', sampleRate: 0, numSamples: 0, unit: { name: 'píxel', count: pixels } },
      pixels * channels * 8,
    );
    const total = out.bitLength;
    const max = Math.max(1, ...stats.nonZero.data);
    return {
      outputs: { out },
      metrics: [
        { key: 'bpp', value: total / pixels, unit: 'bits', highlight: true },
        { key: 'compression', value: out.referenceBits / total, unit: '×', highlight: true },
        { key: 'size', value: total / 8 / 1024, unit: 'KB' },
        { key: 'zeros', value: 100 * stats.zeroRatio, unit: '%' },
        { key: 'dcShare', value: (100 * stats.dcBits) / total, unit: '%' },
        { key: 'acShare', value: (100 * stats.acBits) / total, unit: '%' },
        ...(stats.componentBits.length > 1
          ? [
              {
                key: 'chromaShare',
                value: (100 * (stats.componentBits[1] + stats.componentBits[2])) / total,
                unit: '%',
              },
            ]
          : []),
      ],
      plots: [
        {
          kind: 'image',
          title: 'detail',
          ...planeToRgba(
            { ...stats.nonZero, data: stats.nonZero.data.map((v) => (255 * v) / max) },
            128,
          ),
        },
        ...(stats.trace ? blockTables(stats.trace) : []),
      ],
    };
  },
});

const matrix = (title: string, values: number[], notes?: string[]): Plot => ({
  kind: 'table',
  title,
  columns: ['', ...Array.from({ length: 8 }, (_, i) => String(i))],
  rows: Array.from({ length: 8 }, (_, y) => [y, ...values.slice(y * 8, y * 8 + 8)]),
  notes,
});

/** Un bloque de la luminancia, de los píxeles a los bits, en cinco tablas. */
function blockTables(t: JpegBlockTrace): Plot[] {
  const dc = t.quantized[0];
  const zz = t.symbols.filter((s) => s.what !== 'EOB' && s.what !== 'ZRL');
  const bits = t.symbols.reduce((n, s) => n + s.code.length + s.amplitude.length, 0);
  return [
    matrix('blockPixels', t.pixels, [
      `Bloque ${t.index} (columna ${t.bx}, fila ${t.by}) de la luminancia $Y$. A cada píxel se le resta 128 antes de la DCT.`,
    ]),
    matrix(
      'blockDct',
      t.dct.map((v) => Math.round(v * 10) / 10),
      [
        'Arriba a la izquierda, la DC (el brillo medio); hacia abajo y a la derecha, frecuencias cada vez más altas.',
      ],
    ),
    matrix('blockTable', t.table, [
      'Pasos de cuantización $Q(u,v)$: la tabla típica de luminancia escalada con la calidad.',
    ]),
    matrix('blockQuant', t.quantized, [
      'Cada coeficiente se divide por su paso y se redondea: $F_q(u,v) = \\mathrm{round}\\big(F(u,v) / Q(u,v)\\big)$. Casi todos los de alta frecuencia acaban en 0.',
    ]),
    {
      kind: 'table',
      title: 'blockBits',
      columns: ['Qué', 'Ceros antes', 'Valor', 'Categoría', 'Código', 'Amplitud', 'Bits'],
      rows: t.symbols.map((s) => [
        s.what,
        s.what === 'DC' || s.what === 'EOB' ? '—' : s.run,
        s.what === 'DC' ? `${s.value} = ${dc} − ${t.prevDc}` : s.value,
        s.size,
        s.code,
        s.amplitude || '—',
        s.code.length + s.amplitude.length,
      ]),
      notes: [
        `La DC se envía como diferencia con la del bloque anterior: $${dc} - ${t.prevDc} = ${dc - t.prevDc}$.`,
        `Los AC se recorren en zigzag y se envían como (ceros antes, categoría) + amplitud; ${zz.length - 1} ${zz.length === 2 ? 'coeficiente distinto' : 'coeficientes distintos'} de cero.`,
        `Este bloque ocupa **${bits} bits** frente a los $64 \\times 8 = 512$ de los píxeles sin comprimir.`,
      ],
      stepwise: true,
    },
  ];
}
