import type { CSSProperties } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, SANS, COLUMNA, type Cable, type Forma } from './estilo';

const salida = Easing.out(Easing.cubic);
const aparece = (frame: number, desde: number, dur = 14) =>
  interpolate(frame, [desde, desde + dur], [0, 1], {
    easing: salida,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** El glifo del logo de la app: una onda que se convierte en bits. */
export function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" style={{ flex: 'none', display: 'block' }}>
      <rect width="28" height="28" rx="7" fill="#1A1D23" />
      <path d="M5 14c1.6-6 3.4-6 5 0s3.4 6 5 0" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M15 14h2v-4h2.5v8H22v-4h1.5"
        fill="none"
        stroke={C.ambar}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Un puerto de la app a gran tamaño: relleno blanco y borde del color del cable. */
export function Conector({ forma, color, tam, style }: { forma: Forma; color: string; tam: number; style?: CSSProperties }) {
  const borde = tam * 0.22;
  const medidas: Record<Forma, [number, number, number]> = {
    circulo: [tam, tam, tam / 2],
    cuadrado: [tam, tam, tam * 0.22],
    pastilla: [tam * 1.35, tam * 0.85, tam * 0.43],
    rect: [tam * 1.2, tam, tam * 0.14],
    rombo: [tam * 0.86, tam * 0.86, tam * 0.12],
  };
  const [w, h, r] = medidas[forma];
  return (
    <div
      style={{
        position: 'absolute',
        width: w,
        height: h,
        borderRadius: r,
        background: C.blanco,
        border: `${borde}px solid ${color}`,
        boxSizing: 'border-box',
        transform: `translate(-50%, -50%)${forma === 'rombo' ? ' rotate(45deg)' : ''}`,
        ...style,
      }}
    />
  );
}

export type Capitulo = { titulo: string; cable: Cable };

/**
 * El campo de color del capítulo: columna a la izquierda (16:9) o banda arriba
 * (1:1). `borde` es dónde acaba el campo; en los barridos crece hasta tapar
 * toda la imagen y vuelve. El cable sale del capítulo actual del índice y
 * acaba en un conector justo en el borde, enchufado a la captura.
 */
export function Campo({
  capitulos,
  actual,
  frase,
  borde,
}: {
  capitulos: Capitulo[];
  actual: number;
  frase: string;
  borde: number;
}) {
  const { width: W, height: H } = useVideoConfig();
  const cuadrado = W === H;
  const { cable } = capitulos[actual];
  const tinta = cable.texto;

  if (cuadrado) {
    const xNum = (i: number) => 62 + i * 58;
    const yNum = 312;
    return (
      <>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            height: borde,
            overflow: 'hidden',
            background: cable.color,
            color: tinta,
            fontFamily: SANS,
          }}
        >
          <div style={{ position: 'absolute', left: 48, top: 40, right: 48 }}>
            <div style={{ fontSize: 62, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
              {capitulos[actual].titulo}
            </div>
            <div style={{ fontSize: 30, lineHeight: 1.32, marginTop: 22, maxWidth: 960 }}>{frase}</div>
          </div>
          {capitulos.map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: xNum(i),
                top: yNum,
                transform: 'translate(-50%, -50%)',
                fontSize: 28,
                fontWeight: i === actual ? 600 : 500,
                opacity: i === actual ? 1 : 0.5,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {i + 1}
            </div>
          ))}
          <div
            style={{
              position: 'absolute',
              right: 48,
              top: yNum,
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            <Logo size={38} />
            TinkerSignals
          </div>
          <div
            style={{
              position: 'absolute',
              left: xNum(actual) - 3,
              top: yNum + 22,
              width: 6,
              height: Math.max(0, borde - yNum - 22),
              background: tinta,
            }}
          />
        </div>
        <Conector forma={cable.forma} color={cable.color} tam={36} style={{ left: xNum(actual), top: borde }} />
      </>
    );
  }

  const yFila = (i: number) => 1016 - (capitulos.length - 1 - i) * 42;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: borde,
          overflow: 'hidden',
          background: cable.color,
          color: tinta,
          fontFamily: SANS,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 64,
            top: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          <Logo size={44} />
          TinkerSignals
        </div>
        <div style={{ position: 'absolute', left: 64, top: 290, width: COLUMNA - 128 }}>
          <div style={{ fontSize: 82, fontWeight: 600, lineHeight: 1.02, letterSpacing: '-0.025em' }}>
            {capitulos[actual].titulo}
          </div>
          <div style={{ fontSize: 31, lineHeight: 1.36, marginTop: 40 }}>{frase}</div>
        </div>
        {capitulos.map((c, i) => (
          <div
            key={c.titulo}
            style={{
              position: 'absolute',
              left: 64,
              top: yFila(i),
              transform: 'translateY(-50%)',
              display: 'flex',
              gap: 18,
              fontSize: 25,
              fontWeight: i === actual ? 600 : 500,
              opacity: i === actual ? 1 : 0.5,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 22, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
            {c.titulo}
          </div>
        ))}
        <div
          style={{
            position: 'absolute',
            left: 452,
            top: yFila(actual) - 3,
            height: 6,
            width: Math.max(0, borde - 452),
            background: tinta,
          }}
        />
      </div>
      <Conector forma={cable.forma} color={cable.color} tam={40} style={{ left: borde, top: yFila(actual) }} />
    </>
  );
}

/**
 * Portada: una señal analógica que se muestrea y se cuantiza a su paso. A la
 * derecha sigue continua; por el medio quedan las muestras (con el conector
 * redondo de los cables de señal) y a la izquierda los escalones de los bits,
 * como en el logo.
 */
export function Intro() {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const cuadrado = W === H;
  const azul = '#2563D9';
  const nombre = aparece(frame, 4, 18);
  const lema = aparece(frame, 14, 18);

  const yc = cuadrado ? 770 : 770;
  const A = cuadrado ? 118 : 140;
  const T = cuadrado ? 40 : 52;
  const niveles = 8;
  const fase = frame * 0.045;
  const v = (x: number) =>
    0.68 * Math.sin((2 * Math.PI * x) / (cuadrado ? 520 : 760) + fase) +
    0.32 * Math.sin((2 * Math.PI * x) / (cuadrado ? 210 : 280) - fase * 0.7);
  const y = (x: number) => yc - A * v(x);
  const q = (x: number) => {
    const paso = 2 / (niveles - 1);
    return yc - A * (Math.round((v(x) + 1) / paso) * paso - 1);
  };
  const frente = (desde: number, hasta: number) =>
    interpolate(frame, [desde, hasta], [-T, W + T], {
      easing: Easing.inOut(Easing.quad),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  const xm = frente(14, 82); // muestreo
  const xq = frente(40, 108); // cuantización

  const continua: string[] = [];
  for (let x = Math.max(0, xm - T); x <= W; x += 6) continua.push(`${x.toFixed(1)},${y(x).toFixed(1)}`);
  const tenue: string[] = [];
  for (let x = 0; x <= Math.min(W, xm); x += 6) tenue.push(`${x.toFixed(1)},${y(x).toFixed(1)}`);
  const rejilla: number[] = [];
  for (let x = T / 2; x < W; x += T) rejilla.push(x);
  const muestras = rejilla.filter((x) => x <= xm && x > xq);
  const escalera = rejilla
    .filter((x) => x <= xq)
    .map((x) => `M ${x - T / 2} ${q(x).toFixed(1)} H ${x + T / 2}`)
    .join(' ');
  const verticales = rejilla
    .filter((x) => x + T <= xq)
    .map((x) => `M ${x + T / 2} ${q(x).toFixed(1)} V ${q(x + T).toFixed(1)}`)
    .join(' ');

  const etiqueta = (texto: string, a: number, b: number) => {
    const ancho = Math.min(b, W) - Math.max(a, 0);
    const o = interpolate(ancho, [160, 320], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return (
      <div
        style={{
          position: 'absolute',
          left: (Math.max(a, 0) + Math.min(b, W)) / 2,
          top: yc + A + (cuadrado ? 64 : 76),
          transform: 'translateX(-50%)',
          fontSize: cuadrado ? 26 : 30,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          opacity: o,
        }}
      >
        {texto}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: C.tinta, fontFamily: SANS, color: C.blanco }}>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        <polyline points={tenue.join(' ')} fill="none" stroke={azul} strokeOpacity={0.3} strokeWidth={4} />
        <polyline points={continua.join(' ')} fill="none" stroke={azul} strokeWidth={cuadrado ? 7 : 8} strokeLinejoin="round" />
        <path d={verticales} stroke={C.ambar} strokeWidth={cuadrado ? 6 : 7} />
        <path d={escalera} stroke={C.ambar} strokeWidth={cuadrado ? 6 : 7} strokeLinecap="square" />
        {muestras.map((x) => {
          const pop = interpolate(xm - x, [0, T * 1.5], [0, 1], { extrapolateRight: 'clamp' });
          return (
            <g key={x}>
              <line x1={x} x2={x} y1={yc} y2={y(x)} stroke={azul} strokeWidth={cuadrado ? 4 : 5} />
              <circle cx={x} cy={y(x)} r={(cuadrado ? 8 : 10) * pop} fill={C.blanco} stroke={azul} strokeWidth={cuadrado ? 4 : 5} />
            </g>
          );
        })}
      </svg>
      {etiqueta('Bits', 0, xq)}
      {etiqueta('Muestras', xq, xm)}
      {etiqueta('Señal analógica', xm, W)}
      <div style={{ position: 'absolute', left: cuadrado ? 64 : 120, top: cuadrado ? 120 : 150, right: cuadrado ? 64 : 120 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: cuadrado ? 26 : 36,
            opacity: nombre,
            transform: `translateY(${(1 - nombre) * 28}px)`,
          }}
        >
          <Logo size={cuadrado ? 100 : 140} />
          <div style={{ fontSize: cuadrado ? 100 : 148, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1 }}>
            TinkerSignals
          </div>
        </div>
        <div
          style={{
            marginTop: cuadrado ? 40 : 48,
            fontSize: cuadrado ? 44 : 54,
            lineHeight: 1.22,
            maxWidth: cuadrado ? 900 : 1150,
            opacity: lema,
            transform: `translateY(${(1 - lema) * 20}px)`,
          }}
        >
          Aprende compresión de audio e imagen montando bloques.
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Cierre: la web, con un cable de bits enchufado, y el repositorio debajo. */
export function Cierre() {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const cuadrado = W === H;
  const a = aparece(frame, 4, 16);
  const b = aparece(frame, 12, 16);
  const c = aparece(frame, 20, 16);
  const d = aparece(frame, 30, 16);
  const cable = interpolate(frame, [24, 46], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const izq = cuadrado ? 64 : 120;
  return (
    <AbsoluteFill style={{ background: C.tinta, fontFamily: SANS, color: C.blanco }}>
      <div style={{ position: 'absolute', left: izq, top: cuadrado ? 170 : 220, right: izq }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: cuadrado ? 24 : 32,
            opacity: a,
            transform: `translateY(${(1 - a) * 24}px)`,
          }}
        >
          <Logo size={cuadrado ? 84 : 112} />
          <div style={{ fontSize: cuadrado ? 84 : 116, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1 }}>
            TinkerSignals
          </div>
        </div>
        <div
          style={{
            marginTop: cuadrado ? 40 : 48,
            fontSize: cuadrado ? 42 : 52,
            lineHeight: 1.24,
            maxWidth: cuadrado ? 920 : 1240,
            opacity: b,
            transform: `translateY(${(1 - b) * 20}px)`,
          }}
        >
          Gratis y de código abierto (MIT). Funciona en el navegador, sin instalar nada.
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: izq,
          right: 0,
          top: cuadrado ? 610 : 720,
          display: 'flex',
          alignItems: 'center',
          opacity: c,
        }}
      >
        <div style={{ fontSize: cuadrado ? 56 : 76, fontWeight: 600, color: C.ambar, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
          tinkersignals.tatuck.com
        </div>
        <div style={{ position: 'relative', width: cuadrado ? 84 : 108, height: 10, flex: 'none' }}>
          <Conector forma="cuadrado" color={C.ambar} tam={cuadrado ? 38 : 46} style={{ left: '50%', top: '50%' }} />
        </div>
        <div style={{ flex: 1, height: cuadrado ? 8 : 10, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: `${cable * 100}%`, background: C.ambar }} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: izq,
          top: cuadrado ? 700 : 830,
          fontSize: cuadrado ? 34 : 40,
          opacity: d,
          transform: `translateY(${(1 - d) * 16}px)`,
        }}
      >
        Código: github.com/Tatuck/TinkerSignals
      </div>
    </AbsoluteFill>
  );
}

