import { Easing, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export type Caja = { x: number; y: number; w: number; h: number };
export type Escena = {
  ancho: number;
  alto: number;
  dpr: number;
  frames: { file: string; t: number }[];
  raton: { t: number; x: number; y: number; down: boolean }[];
  marcas: Record<string, number>;
  cajas: Record<string, Caja>;
  arrastres?: { desde: number; hasta: number; caja: Caja; agarre: { x: number; y: number } }[];
};
/** Un plano de cámara: a partir de `t` (s de la toma) encuadra `caja` (o `cuadrado` en 1:1). */
export type Plano = { t: number; caja: Caja; cuadrado?: Caja };

const easing = Easing.inOut(Easing.cubic);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Interpolación lineal por tramos: [[s de la toma, s de la captura], …]. */
export function tramos(s: number, puntos: [number, number][]): number {
  if (s <= puntos[0][0]) return puntos[0][1];
  for (let i = 1; i < puntos.length; i++) {
    const [a, b] = [puntos[i - 1], puntos[i]];
    if (s <= b[0]) return a[1] + ((s - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return puntos[puntos.length - 1][1];
}

function ultimo<T extends { t: number }>(xs: T[], t: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (xs[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Margen alrededor de una caja (en píxeles CSS de la captura). */
export const holgura = (c: Caja, h: number, v = h): Caja => ({
  x: c.x - h,
  y: c.y - v,
  w: c.w + 2 * h,
  h: c.h + 2 * v,
});
/** Caja que envuelve a varias. */
export const union = (...cs: Caja[]): Caja => {
  const x = Math.min(...cs.map((c) => c.x));
  const y = Math.min(...cs.map((c) => c.y));
  return {
    x,
    y,
    w: Math.max(...cs.map((c) => c.x + c.w)) - x,
    h: Math.max(...cs.map((c) => c.y + c.h)) - y,
  };
};

/**
 * La app grabada dentro de un rectángulo del vídeo, con cámara y cursor. La
 * escala nunca pasa de la densidad de la captura (dpr): un píxel del vídeo
 * nunca se inventa, así que el zoom no pixela.
 */
export function Captura({
  nombre,
  datos,
  tiempo,
  planos,
  marco,
  acento,
}: {
  nombre: string;
  datos: Escena;
  tiempo: [number, number][];
  planos: Plano[];
  /** Rectángulo del vídeo donde va la captura. */
  marco: Caja;
  /** Color de la onda del clic. */
  acento: string;
}) {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const cuadrado = W === H;
  const s = frame / fps;
  const t = tramos(s, tiempo);

  const caja = (p: Plano) => (cuadrado && p.cuadrado ? p.cuadrado : p.caja);
  let i = 0;
  while (i + 1 < planos.length && planos[i + 1].t <= s) i++;
  let r = caja(planos[i]);
  const sig = planos[i + 1];
  // Cada cambio de plano dura 0,8 s y acaba en el instante del plano siguiente.
  if (sig && s > sig.t - 0.8) {
    const u = easing(Math.min(1, (s - (sig.t - 0.8)) / 0.8));
    const b = caja(sig);
    r = { x: r.x + (b.x - r.x) * u, y: r.y + (b.y - r.y) * u, w: r.w + (b.w - r.w) * u, h: r.h + (b.h - r.h) * u };
  }
  const minima = Math.max(marco.w / datos.ancho, marco.h / datos.alto);
  const esc = clamp(Math.min((marco.w * 0.94) / r.w, (marco.h * 0.92) / r.h), minima, datos.dpr);
  const X = clamp(marco.w / 2 - (r.x + r.w / 2) * esc, marco.w - datos.ancho * esc, 0);
  const Y = clamp(marco.h / 2 - (r.y + r.h / 2) * esc, marco.h - datos.alto * esc, 0);

  const f = datos.frames[ultimo(datos.frames, t)];

  // Cursor: posición interpolada y onda al hacer clic.
  const k = ultimo(datos.raton, t);
  const a = datos.raton[k];
  const b = datos.raton[k + 1];
  const u = b && b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
  const px = a.x + (b ? (b.x - a.x) * u : 0);
  const py = a.y + (b ? (b.y - a.y) * u : 0);
  let clic = -1;
  for (let j = k; j >= 1; j--) {
    if (datos.raton[j].down && !datos.raton[j - 1].down) {
      clic = t - datos.raton[j].t;
      break;
    }
  }
  const visible = t >= datos.raton[0]?.t;

  // Ficha que se arrastra desde la paleta (en headless el navegador no la pinta).
  const arrastre = datos.arrastres?.find((d) => t >= d.desde && t <= d.hasta);
  const fArr = arrastre && datos.frames[ultimo(datos.frames, arrastre.desde)];

  return (
    <div
      style={{
        position: 'absolute',
        left: marco.x,
        top: marco.y,
        width: marco.w,
        height: marco.h,
        overflow: 'hidden',
        background: '#f3f5f8',
      }}
    >
      <Img
        src={staticFile(`capturas/${nombre}/${f.file}`)}
        style={{ position: 'absolute', left: X, top: Y, width: datos.ancho * esc, height: datos.alto * esc }}
      />
      {arrastre && fArr && (
        <div
          style={{
            position: 'absolute',
            left: X + (px - arrastre.agarre.x) * esc,
            top: Y + (py - arrastre.agarre.y) * esc,
            width: arrastre.caja.w * esc,
            height: arrastre.caja.h * esc,
            overflow: 'hidden',
            borderRadius: 8 * esc,
            opacity: 0.92,
            boxShadow: '0 18px 40px -12px rgba(21,24,29,.35)',
            transform: 'rotate(-2deg)',
          }}
        >
          <Img
            src={staticFile(`capturas/${nombre}/${fArr.file}`)}
            style={{
              position: 'absolute',
              left: -arrastre.caja.x * esc,
              top: -arrastre.caja.y * esc,
              width: datos.ancho * esc,
              height: datos.alto * esc,
            }}
          />
        </div>
      )}
      {visible && (
        <div style={{ position: 'absolute', left: X + px * esc, top: Y + py * esc }}>
          {clic >= 0 && clic < 0.45 && (
            <div
              style={{
                position: 'absolute',
                left: -30 * (0.4 + clic * 1.8),
                top: -30 * (0.4 + clic * 1.8),
                width: 60 * (0.4 + clic * 1.8),
                height: 60 * (0.4 + clic * 1.8),
                borderRadius: '50%',
                background: acento,
                opacity: 0.45 * (1 - clic / 0.45),
              }}
            />
          )}
          <svg width={34} height={40} viewBox="0 0 17 20" style={{ position: 'absolute', left: -3, top: -2 }}>
            <path
              d="M1.5 1.5v14.2l3.6-3.4 2.4 5.5 2.6-1.1-2.4-5.4h5z"
              fill="#15181d"
              stroke="#fff"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
