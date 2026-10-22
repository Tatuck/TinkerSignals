import { AbsoluteFill, Easing, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Captura, holgura, union, type Caja, type Escena, type Plano } from './Captura';
import { BANDA, C, CABLE, COLUMNA } from './estilo';
import { Campo, Cierre, Intro, type Capitulo } from './piezas';
import taller from '../public/capturas/taller/escena.json';
import leccion from '../public/capturas/leccion/escena.json';
import voip from '../public/capturas/voip/escena.json';
import esteganografia from '../public/capturas/esteganografia/escena.json';
import dentro from '../public/capturas/dentro/escena.json';

export const FPS = 30;

const CAPITULOS: Capitulo[] = [
  { titulo: 'Arrastra bloques', cable: CABLE.senal },
  { titulo: 'Únelos con cables', cable: CABLE.bits },
  { titulo: 'Mira dentro del cable', cable: CABLE.tramas },
  { titulo: 'Ábrelo por dentro', cable: CABLE.perceptual },
  { titulo: 'Aprende la teoría', cable: CABLE.imagen },
  { titulo: 'Resuelve ejercicios', cable: CABLE.onda },
  { titulo: 'Prueba lo especial', cable: CABLE.paquetes },
];

/** Una demo sonora: suena entre `desde` y `hasta` (s del tramo) empezando en `inicio` s del archivo. */
type Voz = { archivo: string; desde: number; hasta: number; inicio: number };
type Tramo = {
  escena: string;
  datos: Escena;
  capitulo: number;
  frase: string;
  segundos: number;
  /** [s del tramo, s de la captura] */
  tiempo: [number, number][];
  planos: Plano[];
  voces?: Voz[];
};

const T = taller as Escena;
const L = leccion as Escena;
const V = voip as Escena;
const E = esteganografia as Escena;
const D = dentro as Escena;

// Cajas que no se midieron al grabar (en píxeles CSS de la captura).
const salidaT: Caja = { x: 1109, y: 436, w: 205, h: 207 };
const cuantizador: Caja = { x: 750, y: 380, w: 310, h: 270 };
const textoOculto: Caja = { x: 700, y: 330, w: 800, h: 560 };
// Gráfica de bits por subbanda en el panel de la pieza de asignación de bits.
const barras: Caja = { x: 1585, y: 430, w: 310, h: 222 };
const formula: Caja = { x: 700, y: 190, w: 760, h: 440 };

const TRAMOS: Tramo[] = [
  {
    escena: 'taller',
    datos: T,
    capitulo: 0,
    frase: 'Fuentes, codificadores, canales y salidas: cada pieza es un bloque que sacas de la paleta.',
    segundos: 5.8,
    tiempo: [
      [0, 1.0],
      [0.6, 1.75],
      [1.9, 3.1],
      [2.3, 4.65],
      [3.5, 5.95],
      [4.1, 9.1],
      [5.4, 10.45],
      [5.8, 10.9],
    ],
    planos: [
      { t: 0, caja: { x: 0, y: 340, w: 1100, h: 680 } },
      { t: 4.6, caja: { x: 0, y: 340, w: 1340, h: 680 } },
    ],
  },
  {
    escena: 'taller',
    datos: T,
    capitulo: 1,
    frase: 'Arrastra de un puerto a otro. Cada color de cable es un tipo de dato: audio, bits, paquetes…',
    segundos: 5.0,
    tiempo: [
      [0, 11.2],
      [1.5, 13.9],
      [3.0, 17.1],
      [4.6, 21.7],
      [5.0, 22.2],
    ],
    planos: [
      { t: 0, caja: holgura(union(T.cajas.fuente, T.cajas.codificador), 40, 50) },
      { t: 2.0, caja: holgura(union(T.cajas.codificador, T.cajas.decodificador), 40, 80) },
      { t: 3.6, caja: holgura(union(T.cajas.decodificador, salidaT), 40, 50) },
    ],
  },
  {
    escena: 'taller',
    datos: T,
    capitulo: 2,
    frase: 'Pincha un cable y verás lo que lleva: la señal, su espectro o los bits uno a uno.',
    segundos: 4.6,
    tiempo: [
      [0, 23.6],
      [1.0, 25.0],
      [1.8, 26.2],
      [4.6, 29.6],
    ],
    planos: [
      { t: 0, caja: holgura(union(T.cajas.codificador, T.cajas.decodificador), 40, 90) },
      { t: 2.4, caja: { x: 760, y: 56, w: 1152, h: 600 } },
      { t: 3.9, caja: { x: 1560, y: 50, w: 360, h: 560 } },
    ],
  },
  {
    escena: 'dentro',
    datos: D,
    capitulo: 3,
    frase: 'Doble clic en un códec: dentro hay un circuito que también puedes medir y tocar.',
    segundos: 8.6,
    tiempo: [
      [0, 1.4],
      [1.2, 2.7],
      [2.4, 4.4],
      [3.4, 7.1],
      [4.8, 8.6],
      [5.6, 11.8],
      [6.6, 13.6],
      [7.2, 15.2],
      [8.6, 17.4],
    ],
    planos: [
      { t: 0, caja: holgura(D.cajas.cadena, 30) },
      { t: 2.0, caja: holgura(D.cajas.interior, 20) },
      { t: 4.2, caja: { x: 700, y: 95, w: 1220, h: 800 } },
      { t: 6.2, caja: holgura(union(D.cajas.asignacion, D.cajas.tasa, barras), 24) },
    ],
  },
  {
    escena: 'taller',
    datos: T,
    capitulo: 4,
    frase: 'Cada bloque enlaza con su ficha de teoría, con las fórmulas y los conceptos relacionados.',
    segundos: 4.6,
    tiempo: [
      [0, 30.5],
      [0.9, 32.0],
      [1.8, 35.4],
      [2.6, 36.4],
      [4.6, 39.5],
    ],
    planos: [
      { t: 0, caja: { x: 600, y: 60, w: 1280, h: 960 } },
      { t: 2.6, caja: holgura(T.cajas.teoria, 20) },
      { t: 4.0, caja: formula },
    ],
  },
  {
    escena: 'leccion',
    datos: L,
    capitulo: 5,
    frase: 'Lecciones guiadas con tareas que se comprueban solas. Aquí: sube a 8 bits y la SNR gana 24 dB.',
    segundos: 6.0,
    tiempo: [
      [0, 2.8],
      [0.9, 3.8],
      [1.5, 7.2],
      [2.0, 12.6],
      [4.0, 16.5],
      [4.8, 17.6],
      [5.2, 19.2],
      [6.0, 20.4],
    ],
    planos: [
      { t: 0, caja: holgura(union(L.cajas.leccion, L.cajas.cadena), 30) },
      { t: 2.2, caja: holgura(union(cuantizador, L.cajas.ajuste), 30) },
      { t: 4.7, caja: holgura(union(L.cajas.leccion, cuantizador), 30) },
    ],
  },
  {
    escena: 'voip',
    datos: V,
    capitulo: 6,
    frase: 'Paquetes por una red IP. Escucha la voz con un 1 % de pérdidas… y con un 20 %.',
    segundos: 4.6,
    tiempo: [
      [0, 2.6],
      [0.8, 3.5],
      [3.4, 9.9],
      [4.6, 11.4],
    ],
    planos: [
      { t: 0, caja: holgura(V.cajas.tramo, 30) },
      { t: 1.6, caja: holgura(union(V.cajas.red, V.cajas.ajuste), 30) },
      { t: 4.0, caja: holgura(V.cajas.red, 50) },
    ],
    voces: [
      { archivo: 'voip-1', desde: 0.1, hasta: 1.9, inicio: 0.4 },
      { archivo: 'voip-20', desde: 1.9, hasta: 4.6, inicio: 2.2 },
    ],
  },
  {
    escena: 'esteganografia',
    datos: E,
    capitulo: 6,
    frase: 'Esconde un texto en el último bit de cada píxel: la foto no cambia y el mensaje sale intacto.',
    segundos: 4.6,
    tiempo: [
      [0, 2.4],
      [1.0, 3.6],
      [4.6, 8.6],
    ],
    planos: [
      { t: 0, caja: holgura(E.cajas.circuito, 20) },
      { t: 4.2, caja: textoOculto },
    ],
  },
];

const INTRO = Math.round(4.0 * FPS);
const CIERRE = Math.round(4.6 * FPS);
/** Fotograma en que empieza cada tramo; el último es el del cierre. */
const CORTES: number[] = [INTRO];
for (const t of TRAMOS) CORTES.push(CORTES[CORTES.length - 1] + Math.round(t.segundos * FPS));
export const DURACION = CORTES[CORTES.length - 1] + CIERRE;

// Barrido entre tramos: el campo nuevo tapa la imagen (IDA) y se recoge (VUELTA).
const IDA = 10;
const VUELTA = 14;

/** Dónde acaba el campo de color del tramo `k` en el fotograma `f`. */
function bordeDe(f: number, k: number, total: number, reposo: number) {
  return interpolate(f, [CORTES[k], CORTES[k] + VUELTA], [total, reposo], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

function Campos() {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const cuadrado = W === H;
  const total = cuadrado ? H : W;
  const reposo = cuadrado ? BANDA : COLUMNA;
  const n = TRAMOS.length;
  let k = -1;
  while (k + 1 < n && CORTES[k + 1] <= f) k++;
  const fin = f >= CORTES[n];

  // El campo del tramo actual, y encima el del siguiente si ya está entrando.
  const sig = fin ? null : k + 1;
  const ida =
    sig === null
      ? 0
      : interpolate(f, [CORTES[sig] - IDA, CORTES[sig]], [0, total], {
          easing: Easing.in(Easing.cubic),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
  const campo = (j: number, borde: number) => (
    <Campo capitulos={CAPITULOS} actual={TRAMOS[j].capitulo} frase={TRAMOS[j].frase} borde={borde} />
  );
  return (
    <AbsoluteFill>
      {k >= 0 && !fin && campo(k, bordeDe(f, k, total, reposo))}
      {sig !== null && sig < n && ida > 0 && campo(sig, ida)}
      {sig === n && ida > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            background: C.tinta,
            width: cuadrado ? W : ida,
            height: cuadrado ? ida : H,
          }}
        />
      )}
    </AbsoluteFill>
  );
}

/** Tramos (en fotogramas globales) en los que suena una demo: ahí baja la música. */
const DEMOS = TRAMOS.flatMap((t, i) =>
  (t.voces ?? []).map((v) => [CORTES[i] + v.desde * FPS, CORTES[i] + v.hasta * FPS] as const),
);

/** La variación entera (54 s, sin repetir), con fundido de entrada y de salida. */
function volumenMusica(f: number) {
  const entrada = interpolate(f, [0, 45], [0, 1], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' });
  const salida = interpolate(f, [DURACION - 75, DURACION - 1], [1, 0], {
    easing: Easing.in(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  let baja = 1;
  for (const [a, b] of DEMOS) {
    baja = Math.min(
      baja,
      interpolate(f, [a - 12, a, b, b + 15], [1, 0.1, 0.1, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    );
  }
  return 0.55 * entrada * salida * baja;
}

export function Video() {
  const { width: W, height: H } = useVideoConfig();
  const cuadrado = W === H;
  const marco: Caja = cuadrado
    ? { x: 0, y: BANDA, w: W, h: H - BANDA }
    : { x: COLUMNA, y: 0, w: W - COLUMNA, h: H };
  return (
    <AbsoluteFill style={{ background: C.tinta }}>
      <Html5Audio src={staticFile('audio/bach.wav')} volume={volumenMusica} />
      <Sequence durationInFrames={INTRO} name="intro">
        <Intro />
      </Sequence>
      {TRAMOS.map((t, i) => {
        const dur = CORTES[i + 1] - CORTES[i];
        return (
          <Sequence key={i} from={CORTES[i]} durationInFrames={dur} name={`${t.escena} ${i}`}>
            <Captura
              nombre={t.escena}
              datos={t.datos}
              tiempo={t.tiempo}
              planos={t.planos}
              marco={marco}
              acento={CAPITULOS[t.capitulo].cable.color}
            />
            {t.voces?.map((v) => {
              const largo = (v.hasta - v.desde) * FPS;
              return (
                <Sequence key={v.archivo} from={Math.round(v.desde * FPS)} durationInFrames={Math.round(largo)}>
                  <Html5Audio
                    src={staticFile(`audio/${v.archivo}.wav`)}
                    trimBefore={Math.round(v.inicio * FPS)}
                    volume={(f) =>
                      interpolate(f, [0, 4, largo - 5, largo], [0, 1, 1, 0], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                      })
                    }
                  />
                </Sequence>
              );
            })}
          </Sequence>
        );
      })}
      <Campos />
      <Sequence from={CORTES[TRAMOS.length]} durationInFrames={CIERRE} name="cierre">
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
}
