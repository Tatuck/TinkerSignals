import { AbsoluteFill, Easing, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Captura, holgura, union, type Caja, type Escena, type Plano } from './Captura';
import { BANDA, C, CABLE, COLUMNA } from './estilo';
import { Campo, Cierre, Intro, type Capitulo } from './piezas';
import taller from '../public/capturas/taller/escena.json';
import aprender from '../public/capturas/aprender/escena.json';
import problema from '../public/capturas/problema/escena.json';
import voip from '../public/capturas/voip/escena.json';
import esteganografia from '../public/capturas/esteganografia/escena.json';
import dentro from '../public/capturas/dentro/escena.json';

export const FPS = 30;

const CAPITULOS: Capitulo[] = [
  { titulo: 'Arrastra bloques', cable: CABLE.senal },
  { titulo: 'Únelos con cables', cable: CABLE.bits },
  { titulo: 'Mira dentro del cable', cable: CABLE.tramas },
  { titulo: 'Ábrelo por dentro', cable: CABLE.perceptual },
  { titulo: 'Explora por temas', cable: CABLE.sinPerdidas },
  { titulo: 'Aprende la teoría', cable: CABLE.imagen },
  { titulo: 'Sigue una lección', cable: CABLE.onda },
  { titulo: 'Resuelve problemas', cable: CABLE.piezas },
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
const A = aprender as Escena;
const P = problema as Escena;
const V = voip as Escena;
const E = esteganografia as Escena;
const D = dentro as Escena;

// Cajas que no se midieron al grabar (en píxeles CSS de la captura).
const salidaT: Caja = { x: 1109, y: 436, w: 205, h: 207 };
const textoOculto: Caja = { x: 700, y: 330, w: 800, h: 560 };
// Gráfica de bits por subbanda en el panel de la pieza de asignación de bits.
const barras: Caja = { x: 1585, y: 516, w: 310, h: 136 };
// «Primeros bits» y «Qué dicen los bits» en el inspector del cable.
const primerosBits: Caja = { x: 1568, y: 60, w: 344, h: 560 };
const rayos: Caja = { x: 1568, y: 640, w: 344, h: 432 };
// El nodo «Texto» de la lección, con su entropía.
const nodoTexto: Caja = { x: 334, y: 504, w: 236, h: 214 };
// La solución del problema cuando ya ha crecido el diálogo.
const solucion: Caja = { x: 550, y: 560, w: 820, h: 470 };

const TRAMOS: Tramo[] = [
  {
    escena: 'taller',
    datos: T,
    capitulo: 0,
    frase: 'Fuentes, codificadores, canales y salidas: cada pieza es un bloque que sacas de la paleta.',
    segundos: 4.8,
    tiempo: [
      [0, 1.1],
      [0.5, 1.75],
      [1.6, 3.05],
      [2.0, 4.65],
      [3.0, 5.95],
      [3.5, 9.15],
      [4.6, 10.5],
      [4.8, 10.8],
    ],
    planos: [
      { t: 0, caja: { x: 0, y: 340, w: 1100, h: 680 } },
      { t: 3.9, caja: { x: 0, y: 340, w: 1340, h: 680 } },
    ],
  },
  {
    escena: 'taller',
    datos: T,
    capitulo: 1,
    frase: 'Arrastra de un puerto a otro. Cada color de cable es un tipo de dato: audio, bits, paquetes…',
    segundos: 4.2,
    tiempo: [
      [0, 11.1],
      [1.3, 13.5],
      [2.6, 16.6],
      [4.0, 20.3],
      [4.2, 20.7],
    ],
    planos: [
      { t: 0, caja: holgura(union(T.cajas.fuente, T.cajas.codificador), 40, 50) },
      { t: 1.8, caja: holgura(union(T.cajas.codificador, T.cajas.decodificador), 40, 80) },
      { t: 3.2, caja: holgura(union(T.cajas.decodificador, salidaT), 40, 50) },
    ],
  },
  {
    escena: 'taller',
    datos: T,
    capitulo: 2,
    frase: 'Pincha un cable y verás lo que lleva. Los rayos X te dicen qué significa cada bit.',
    segundos: 4.6,
    tiempo: [
      [0, 22.1],
      [0.9, 23.3],
      [2.0, 26.0],
      [2.6, 28.6],
      [4.6, 34.6],
    ],
    planos: [
      { t: 0, caja: holgura(union(T.cajas.codificador, T.cajas.decodificador), 40, 90) },
      { t: 1.7, caja: primerosBits },
      { t: 3.2, caja: rayos },
    ],
  },
  {
    escena: 'dentro',
    datos: D,
    capitulo: 3,
    frase: 'Doble clic en un códec: dentro hay un circuito que también puedes medir y tocar.',
    segundos: 6.4,
    tiempo: [
      [0, 1.6],
      [0.9, 3.1],
      [2.0, 5.0],
      [2.6, 7.0],
      [3.6, 8.8],
      [4.2, 11.8],
      [4.9, 12.8],
      [5.4, 15.0],
      [6.4, 17.6],
    ],
    planos: [
      { t: 0, caja: holgura(D.cajas.cadena, 30) },
      { t: 1.6, caja: holgura(D.cajas.interior, 20) },
      { t: 3.3, caja: { x: 700, y: 95, w: 1220, h: 800 } },
      { t: 4.9, caja: holgura(union(D.cajas.asignacion, D.cajas.tasa, barras), 24) },
    ],
  },
  {
    escena: 'aprender',
    datos: A,
    capitulo: 4,
    frase: 'Diez temas, de la señal al JPEG, con teoría, lecciones, ejemplos y problemas en orden de estudio.',
    segundos: 4.0,
    tiempo: [
      [0, 1.5],
      [0.6, 2.3],
      [2.0, 5.2],
      [2.8, 6.6],
      [4.0, 8.6],
    ],
    planos: [
      { t: 0, caja: holgura(A.cajas.explorar, 24) },
      { t: 3.0, caja: { x: 470, y: 180, w: 840, h: 540 } },
    ],
  },
  {
    escena: 'aprender',
    datos: A,
    capitulo: 5,
    frase: 'Cada ficha trae sus fórmulas, los bloques para probarla y qué practicar después.',
    segundos: 4.2,
    tiempo: [
      [0, 8.7],
      [0.5, 9.4],
      [2.0, 10.7],
      [2.9, 12.3],
      [4.2, 14.2],
    ],
    planos: [
      { t: 0, caja: holgura(A.cajas.ficha, 20) },
      { t: 1.5, caja: holgura(A.cajas.formula, 30, 50) },
      { t: 3.2, caja: { x: 730, y: 560, w: 710, h: 340 } },
    ],
  },
  {
    escena: 'aprender',
    datos: A,
    capitulo: 6,
    frase: 'Antes de tocar, adivina qué pasará. Luego mira el resultado en el circuito de verdad.',
    segundos: 4.6,
    tiempo: [
      [0, 18.2],
      [0.6, 18.8],
      [1.3, 21.6],
      [1.9, 22.9],
      [2.8, 25.9],
      [3.3, 26.7],
      [4.6, 28.8],
    ],
    planos: [
      { t: 0, caja: holgura(union(A.cajas.lecc1, A.cajas.cadena), 24) },
      { t: 2.2, caja: holgura(union(A.cajas.lecc3, nodoTexto), 24) },
    ],
  },
  {
    escena: 'problema',
    datos: P,
    capitulo: 7,
    frase: 'Problemas de examen con números nuevos cada vez: se corrigen solos y la solución sale de los bloques.',
    segundos: 5.2,
    tiempo: [
      [0, 4.6],
      [0.5, 5.3],
      [1.4, 12.3],
      [2.0, 14.0],
      [2.5, 16.6],
      [3.1, 18.6],
      [3.6, 19.5],
      [4.1, 21.3],
      [5.2, 24.6],
    ],
    planos: [
      { t: 0, caja: holgura(P.cajas.problema, 30) },
      { t: 1.1, caja: holgura(P.cajas.respuestas, 24) },
      { t: 3.4, caja: holgura(P.cajas.bien, 24) },
      { t: 4.6, caja: solucion },
    ],
  },
  {
    escena: 'voip',
    datos: V,
    capitulo: 8,
    frase: 'Paquetes por una red IP. Escucha la voz con un 1 % de pérdidas… y con un 20 %.',
    segundos: 4.2,
    tiempo: [
      [0, 2.7],
      [0.7, 3.5],
      [3.1, 10.0],
      [4.2, 11.4],
    ],
    planos: [
      { t: 0, caja: holgura(V.cajas.tramo, 30) },
      { t: 1.4, caja: holgura(union(V.cajas.red, V.cajas.ajuste), 30) },
      { t: 3.7, caja: holgura(V.cajas.red, 50) },
    ],
    voces: [
      { archivo: 'voip-1', desde: 0.1, hasta: 1.8, inicio: 0.4 },
      { archivo: 'voip-20', desde: 1.8, hasta: 4.2, inicio: 2.1 },
    ],
  },
  {
    escena: 'esteganografia',
    datos: E,
    capitulo: 8,
    frase: 'Esconde un texto en el último bit de cada píxel: la foto no cambia y el mensaje sale intacto.',
    segundos: 3.6,
    tiempo: [
      [0, 4.9],
      [0.9, 6.0],
      [3.6, 9.9],
    ],
    planos: [
      { t: 0, caja: holgura(E.cajas.circuito, 20) },
      { t: 3.0, caja: textoOculto },
    ],
  },
];

const INTRO = Math.round(3.4 * FPS);
const CIERRE = Math.round(3.8 * FPS);
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
