import { useEffect, useState, type CSSProperties } from 'react';
import { blockText, t } from '@/i18n';
import { engine } from '@/runtime/client';
import type { ProbeData } from '@/runtime/probe';
import { onPlaybackChange, play, stop } from '../lib/audio';
import { formatMetric, formatNumber, formatRate } from '../lib/format';
import { Envelope } from '../plots/Envelope';
import { Plot } from '../plots/Plot';
import { Spectrogram, Spectrum } from '../plots/Spectrum';
import { useGraphStore } from '../store';
import { portColor } from '../theme';

const W = 292;

/** Inspector de un cable: qué pasa por él, cómo suena y cómo se ve. */
export function ProbePanel({ edgeId }: { edgeId: string }) {
  const useS = useGraphStore();
  const scope = useS((s) => s.scope);
  const edge = useS((s) => s.edges.find((e) => e.id === edgeId));
  const nodes = useS((s) => s.nodes);
  const port = useS((s) =>
    edge ? s.results?.nodes[edge.source]?.outputs[edge.sourceHandle ?? ''] : undefined,
  );
  const removeEdge = useS((s) => s.removeEdge);
  // El análisis se guarda junto al resumen del puerto del que salió: si el
  // cable cambia, el análisis antiguo deja de mostrarse sin tener que borrarlo.
  const [probed, setProbed] = useState<{ port: unknown; data: ProbeData | null } | null>(null);
  const data = probed && probed.port === port ? probed.data : null;
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => onPlaybackChange(setPlaying), []);

  // Pide al Worker el análisis del cable cada vez que cambia lo que pasa por él.
  useEffect(() => {
    if (!edge || !port) return;
    let alive = true;
    void engine
      .probeOutput(edge.source, edge.sourceHandle ?? '', scope)
      .then((d) => alive && setProbed({ port, data: d }));
    return () => {
      alive = false;
    };
  }, [edge, port, scope]);

  if (!edge) return null;
  const src = nodes.find((n) => n.id === edge.source);
  const dst = nodes.find((n) => n.id === edge.target);
  const srcText = src ? blockText(src.data.blockType) : null;
  const dstText = dst ? blockText(dst.data.blockType) : null;
  const kind = port?.summary.kind ?? 'signal';
  const color = portColor[kind];
  const key = `edge:${edgeId}`;

  async function listen() {
    if (playing === key) return stop();
    const s = await engine.getSignal(edge!.source, edge!.sourceHandle ?? '', 'out', scope);
    if (s) play(s, key);
  }

  return (
    <div className="probe" style={{ '--cable': color } as CSSProperties}>
      <header className="insp-head">
        <span className="probe-swatch" aria-hidden />
        <div>
          <h2>{t(`probe.${kind}`)}</h2>
          <p className="insp-cat">
            {t('probe.from')} {srcText?.title} ({srcText?.ports?.[edge.sourceHandle ?? '']}){' '}
            {t('probe.to')} {dstText?.title} ({dstText?.ports?.[edge.targetHandle ?? '']})
          </p>
        </div>
      </header>

      {!port && <p className="node-msg">{t('probe.noData')}</p>}

      {port && (
        <dl className="insp-metrics">
          {port.summary.kind === 'signal' ? (
            <>
              <Metric label={t('metrics.sampleRate')} text={formatRate(port.summary.sampleRate)} />
              <Metric
                label={t('metrics.duration')}
                text={`${formatNumber(port.summary.durationS, 2)} s`}
              />
              <Metric label="Pico" text={formatNumber(port.summary.peak, 3)} />
              <Metric label="Valor eficaz (RMS)" text={formatNumber(port.summary.rms, 3)} />
            </>
          ) : port.summary.kind === 'frames' ? (
            <>
              <Metric label="Contenido" text={DOMAIN_LABEL[port.summary.domain]} />
              <Metric label="Tramas" text={formatNumber(port.summary.count, 0)} />
              <Metric label="Valores por trama" text={formatNumber(port.summary.size, 0)} />
              <Metric
                label="Avance entre tramas"
                text={`${formatNumber((1000 * port.summary.hop) / port.summary.sampleRate, 1)} ms`}
              />
            </>
          ) : port.summary.kind === 'packets' ? (
            <>
              <Metric label="Tasa en la red" text={fmt(port.summary.networkBitrate, 'bps')} />
              <Metric label="Tasa del códec" text={fmt(port.summary.payloadBitrate, 'bps')} />
              <Metric
                label="Paquetes por segundo"
                text={formatNumber(port.summary.packetsPerSecond, 1)}
              />
              <Metric
                label="Perdidos"
                text={`${port.summary.lost} de ${port.summary.count} (${formatNumber((100 * port.summary.lost) / Math.max(1, port.summary.count), 1)} %)`}
              />
              <Metric
                label="Audio por paquete"
                text={`${formatNumber(port.summary.packetMs, 1)} ms`}
              />
              <Metric label="Protocolos" text={port.summary.protocol} />
            </>
          ) : (
            <>
              <Metric label={t('metrics.bitrate')} text={fmt(port.summary.bitrate, 'bps')} />
              <Metric label={t('metrics.compression')} text={fmt(port.summary.compression, '×')} />
              <Metric label="Bits totales" text={formatNumber(port.summary.bitLength, 0)} />
              <Metric label="Formato" text={port.summary.codec} />
            </>
          )}
          <Metric
            label={t('probe.latency')}
            text={`${formatMetric(port.latencyMs, 'ms').value} ms`}
            wide
          />
        </dl>
      )}

      {data?.kind === 'signal' && (
        <>
          <button className="btn btn-primary btn-block" onClick={listen}>
            {playing === key ? t('probe.stop') : t('probe.listen')}
          </button>
          <section>
            <h3>{t('probe.waveform')}</h3>
            <Envelope env={data.wave} width={W} height={70} color={color} />
          </section>
          <section>
            <h3>{t('probe.spectrum')}</h3>
            <Spectrum
              db={data.spectrum}
              sampleRate={data.sampleRate}
              width={W}
              height={100}
              color={color}
            />
          </section>
          <section>
            <h3>{t('probe.spectrogram')}</h3>
            <Spectrogram cols={data.spectrogram} width={W} height={110} />
          </section>
        </>
      )}

      {data?.kind === 'bitstream' && (
        <section>
          <h3>{t('probe.bits')}</h3>
          <p className="bits">{data.bits}</p>
          <p className="param-help">
            Unos: {formatNumber(data.onesRatio * 100, 1)} %. Lo que no viaja por el canal (la
            cabecera acordada) es:{' '}
            {Object.entries(data.header)
              .map(([k, v]) => `${k} = ${String(v)}`)
              .join(', ')}
            .
          </p>
        </section>
      )}

      {data?.kind === 'frames' && (
        <>
          <section>
            <h3>Todas las tramas</h3>
            <Spectrogram cols={data.heat} width={W} height={110} />
            <p className="param-help">
              Tiempo en horizontal, índice dentro de la trama en vertical. Más claro, más energía.
            </p>
          </section>
          <section>
            <h3>
              Trama {data.loudestIndex + 1} (la de más energía, en{' '}
              {formatNumber((data.loudestIndex * data.hop) / data.sampleRate, 2)} s)
            </h3>
            <Plot
              plot={{
                kind: 'line',
                title: '',
                series: [
                  {
                    role: 'out',
                    y: data.loudest,
                    style: data.loudest.length <= 64 ? 'step' : 'line',
                  },
                ],
              }}
              color={color}
              width={W}
              height={100}
            />
          </section>
        </>
      )}

      {data?.kind === 'packets' && (
        <>
          <section>
            <h3>Retardo de cada paquete</h3>
            <Plot
              plot={{
                kind: 'line',
                title: '',
                series: [
                  { role: 'out', y: data.delays.map((d) => d ?? 0), style: 'dots' },
                  {
                    role: 'error',
                    y: data.delays.map((d) => (d === null ? 0 : NaN)),
                    style: 'dots',
                  },
                ],
              }}
              color={color}
              width={W}
              height={90}
            />
            <p className="param-help">
              Cada punto es un paquete. Los rojos, abajo, no llegaron (o llegaron tarde al búfer).
            </p>
          </section>
          <section>
            <h3>Qué lleva cada paquete</h3>
            <PacketBar payload={data.payloadBits} overhead={data.overheadBits} />
          </section>
        </>
      )}

      <footer className="insp-actions">
        <button className="btn btn-danger" onClick={() => removeEdge(edgeId)}>
          {t('probe.delete')}
        </button>
      </footer>
    </div>
  );
}

const DOMAIN_LABEL: Record<string, string> = {
  time: 'Muestras en el tiempo',
  dct: 'Coeficientes DCT',
  spectrum: 'Espectro (dB)',
  subbands: 'Subbandas',
  autocorrelation: 'Autocorrelación',
  lpc: 'Coeficientes LPC',
  smr: 'Relación señal/máscara (dB)',
  pitch: 'Tono',
};

/** Barra proporcional: carga útil frente a cabeceras. */
function PacketBar({ payload, overhead }: { payload: number; overhead: number }) {
  const total = Math.max(1, payload + overhead);
  return (
    <div className="packet-bar">
      <div>
        <span style={{ flex: payload / total }} className="packet-payload">
          Audio {Math.round(payload / 8)} B
        </span>
        <span style={{ flex: overhead / total }} className="packet-overhead">
          Cabeceras {Math.round(overhead / 8)} B
        </span>
      </div>
      <p className="param-help">
        Las cabeceras son el {formatNumber((100 * overhead) / total, 0)} % de cada paquete.
      </p>
    </div>
  );
}

const fmt = (v: number, u: string) => {
  const f = formatMetric(v, u);
  return `${f.value} ${f.unit}`;
};

function Metric({ label, text, wide }: { label: string; text: string; wide?: boolean }) {
  return (
    <div className={wide ? 'is-wide' : ''}>
      <dt>{label}</dt>
      <dd>{text}</dd>
    </div>
  );
}
