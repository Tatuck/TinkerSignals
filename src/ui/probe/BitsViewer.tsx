import { useEffect, useState, type CSSProperties } from 'react';
import { blockText } from '@/i18n';
import { engine, type Scope } from '@/runtime/client';
import type { BitsProbe } from '@/runtime/probe';
import { formatNumber } from '../lib/format';
import { useStore } from '../store';

/** Colores de los campos (por orden de aparición). */
const FIELD_COLORS = [
  '#2563d9',
  '#c98a00',
  '#1e7b4f',
  '#b4398f',
  '#0e8a9a',
  '#d0531f',
  '#6b4fd8',
  '#7a6a00',
  '#4b5563',
  '#c4242a',
  '#3f7f2a',
];
const colorOf = (i: number) => FIELD_COLORS[i % FIELD_COLORS.length];

/**
 * Rayos X de un flujo de bits: qué es cada bit (sonora/sorda, pitch,
 * ganancia, coeficiente DC…), cuánto ocupa cada campo y dónde ha caído el
 * daño del canal. Funciona con cualquier codificador que etiquete lo que
 * escribe; si el flujo no trae mapa, no se enseña.
 */
export function BitsViewer({
  nodeId,
  port,
  scope,
  version,
}: {
  nodeId: string;
  port: string;
  scope: Scope;
  /** Cambia cuando cambia lo que pasa por el cable (para volver a pedirlo). */
  version: unknown;
}) {
  const cursor = useStore((s) => s.cursor);
  // La trama elegida a mano vale mientras no se mueva la lupa temporal.
  const [manual, setManual] = useState<{ frame: number; cursor: number | null } | null>(null);
  const [probe, setProbe] = useState<{ key: string; data: BitsProbe | null } | null>(null);

  const last = probe?.data;
  const fromCursor =
    cursor !== null && last && last.frameSeconds > 0 ? Math.floor(cursor / last.frameSeconds) : 0;
  const frame = manual && manual.cursor === cursor ? manual.frame : fromCursor;
  const key = `${nodeId}:${port}:${frame}`;

  useEffect(() => {
    let alive = true;
    void engine.probeBits(nodeId, port, frame, scope).then((d) => {
      if (alive) setProbe({ key, data: d });
    });
    return () => {
      alive = false;
    };
  }, [nodeId, port, frame, scope, key, version]);

  const data = probe?.data;
  if (!data) return null;
  const text = blockText(data.block ?? '');
  const label = (f: string) => text.fields?.[f]?.label ?? f;
  const help = (f: string) => text.fields?.[f]?.help;
  const go = (f: number) => setManual({ frame: f, cursor });
  const fieldIndex = (f: string) => data.fields.indexOf(f);
  const firstFrame = data.hasHeader ? -1 : 0;
  const shownLast = data.frame + data.shownFrames - 1;
  const nextDamaged = data.damagedFrames.find((f) => f > shownLast) ?? data.damagedFrames[0];
  // Los campos que se repiten dentro de una trama (k1…k10, una subtrama tras otra) se numeran.
  const repeats = new Map<string, number>();
  for (const s of data.spans)
    repeats.set(`${s.frame}:${s.field}`, (repeats.get(`${s.frame}:${s.field}`) ?? 0) + 1);
  const seen = new Map<string, number>();
  const nth = data.spans.map((s) => {
    const k = `${s.frame}:${s.field}`;
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return (repeats.get(k) ?? 1) > 1 ? n : 0;
  });

  return (
    <section className="bits-viewer">
      <h3>Qué dicen los bits</h3>
      <p className="param-help">
        Cada color es un campo de lo que envía el codificador. Pasa por encima de un nombre para
        saber qué es.
      </p>

      <div className="bits-share" role="img" aria-label="Bits de cada campo en todo el flujo">
        {data.totals.map((n, i) => (
          <span
            key={i}
            style={{ flexGrow: n, background: colorOf(i) } as CSSProperties}
            title={`${label(data.fields[i])}: ${formatNumber((100 * n) / data.totalBits, 1)} %`}
          />
        ))}
      </div>
      <ul className="bits-legend">
        {data.fields.map((f, i) => (
          <li key={f} title={help(f)}>
            <i style={{ background: colorOf(i) }} aria-hidden />
            {label(f)} <small>{formatNumber((100 * data.totals[i]) / data.totalBits, 1)} %</small>
          </li>
        ))}
      </ul>

      <div className="bits-nav">
        {data.hasHeader && (
          <button
            className={`btn btn-small${data.frame < 0 ? ' btn-primary' : ''}`}
            onClick={() => go(-1)}
          >
            Cabecera
          </button>
        )}
        <button
          className="btn btn-small btn-icon"
          aria-label="Tramas anteriores"
          disabled={data.frame <= firstFrame}
          onClick={() => go(Math.max(firstFrame, data.frame - Math.max(1, data.shownFrames)))}
        >
          ‹
        </button>
        <span className="bits-where">
          {data.frame < 0
            ? 'Cabecera'
            : data.shownFrames > 1
              ? `Tramas ${data.frame + 1}–${shownLast + 1}`
              : `Trama ${data.frame + 1}`}{' '}
          <small>de {formatNumber(data.frames, 0)}</small>
          {data.frameSeconds > 0 && data.frame >= 0 && (
            <small> · t = {formatNumber(data.frame * data.frameSeconds, 3)} s</small>
          )}
        </span>
        <button
          className="btn btn-small btn-icon"
          aria-label="Tramas siguientes"
          disabled={shownLast >= data.frames - 1}
          onClick={() => go(shownLast + 1)}
        >
          ›
        </button>
      </div>
      {data.damagedBits > 0 && (
        <p className="bits-damage">
          El canal ha estropeado {formatNumber(data.damagedBits, 0)} bits.{' '}
          {nextDamaged !== undefined && (
            <button className="btn btn-small" onClick={() => go(nextDamaged)}>
              Ver una trama dañada
            </button>
          )}
        </p>
      )}
      {data.frameSeconds > 0 && cursor === null && (
        <p className="param-help">
          Con la lupa temporal, el visor salta a la trama de ese instante.
        </p>
      )}

      {data.beyond ? (
        <p className="param-help">
          El mapa solo guarda las primeras tramas de un flujo tan largo; estas no se pueden ver.
        </p>
      ) : (
        <>
          <div className="bits-ribbon" aria-hidden>
            {data.spans.map((s, i) => (
              <span
                key={i}
                className={s.hurt.length ? 'is-hurt' : undefined}
                style={{ flexGrow: s.length, background: colorOf(fieldIndex(s.field)) }}
              />
            ))}
          </div>
          <div className="table-wrap bits-table-wrap">
            <table className="trace-table bits-table">
              <thead>
                <tr>
                  {data.shownFrames > 1 && <th scope="col">Trama</th>}
                  <th scope="col">Campo</th>
                  <th scope="col">Bits</th>
                  <th scope="col">Qué significa</th>
                </tr>
              </thead>
              <tbody>
                {data.spans.map((s, i) => (
                  <tr key={i} className={s.hurt.length ? 'is-hurt' : undefined}>
                    {data.shownFrames > 1 && <td className="num">{s.frame + 1}</td>}
                    <td title={help(s.field)}>
                      <i
                        className="bits-dot"
                        style={{ background: colorOf(fieldIndex(s.field)) }}
                        aria-hidden
                      />
                      {label(s.field)}
                      {nth[i] > 0 && <sub>{nth[i]}</sub>}
                    </td>
                    <td className="bits-cell">
                      <Bits bits={s.bits} hurt={s.hurt} />
                    </td>
                    <td>{s.meaning ?? formatValue(s.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/** Los bits de un campo, con los dañados marcados. Los muy largos se recortan. */
function Bits({ bits, hurt }: { bits: string; hurt: number[] }) {
  const max = 40;
  const set = new Set(hurt);
  const shown = bits.length > max ? bits.slice(0, max) : bits;
  return (
    <>
      {[...shown].map((b, i) =>
        set.has(i) ? (
          <mark key={i} className="bit-hurt" title="Bit cambiado por el canal">
            {b}
          </mark>
        ) : (
          b
        ),
      )}
      {bits.length > max && '…'}
    </>
  );
}

const formatValue = (v: number) =>
  Number.isInteger(v) ? String(v) : formatNumber(v, Math.abs(v) < 1 ? 4 : 2);
