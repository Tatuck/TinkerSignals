import { useEffect, useState, type CSSProperties } from 'react';
import { blockText, t } from '@/i18n';
import { engine } from '@/runtime/client';
import type { ProbeData } from '@/runtime/probe';
import { onPlaybackChange, play, stop } from '../lib/audio';
import { formatMetric, formatNumber, formatRate } from '../lib/format';
import { Envelope } from '../plots/Envelope';
import { Spectrogram, Spectrum } from '../plots/Spectrum';
import { useStore } from '../store';
import { portColor } from '../theme';

const W = 292;

/** Inspector de un cable: qué pasa por él, cómo suena y cómo se ve. */
export function ProbePanel({ edgeId }: { edgeId: string }) {
  const edge = useStore((s) => s.edges.find((e) => e.id === edgeId));
  const nodes = useStore((s) => s.nodes);
  const port = useStore((s) =>
    edge ? s.results?.nodes[edge.source]?.outputs[edge.sourceHandle ?? ''] : undefined,
  );
  const removeEdge = useStore((s) => s.removeEdge);
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
      .probeOutput(edge.source, edge.sourceHandle ?? '')
      .then((d) => alive && setProbed({ port, data: d }));
    return () => {
      alive = false;
    };
  }, [edge, port]);

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
    const s = await engine.getSignal(edge!.source, edge!.sourceHandle ?? '', 'out');
    if (s) play(s, key);
  }

  return (
    <div className="probe" style={{ '--cable': color } as CSSProperties}>
      <header className="insp-head">
        <span className="probe-swatch" aria-hidden />
        <div>
          <h2>{kind === 'signal' ? t('probe.signal') : t('probe.bitstream')}</h2>
          <p className="insp-cat">
            {t('probe.from')} {srcText?.title} ({srcText?.ports?.[edge.sourceHandle ?? '']}) {t('probe.to')}{' '}
            {dstText?.title} ({dstText?.ports?.[edge.targetHandle ?? '']})
          </p>
        </div>
      </header>

      {!port && <p className="node-msg">{t('probe.noData')}</p>}

      {port && (
        <dl className="insp-metrics">
          {port.summary.kind === 'signal' ? (
            <>
              <Metric label={t('metrics.sampleRate')} text={formatRate(port.summary.sampleRate)} />
              <Metric label={t('metrics.duration')} text={`${formatNumber(port.summary.durationS, 2)} s`} />
              <Metric label="Pico" text={formatNumber(port.summary.peak, 3)} />
              <Metric label="Valor eficaz (RMS)" text={formatNumber(port.summary.rms, 3)} />
            </>
          ) : (
            <>
              <Metric label={t('metrics.bitrate')} text={fmt(port.summary.bitrate, 'bps')} />
              <Metric label={t('metrics.compression')} text={fmt(port.summary.compression, '×')} />
              <Metric label="Bits totales" text={formatNumber(port.summary.bitLength, 0)} />
              <Metric label="Formato" text={port.summary.codec} />
            </>
          )}
          <Metric label={t('probe.latency')} text={`${formatMetric(port.latencyMs, 'ms').value} ms`} wide />
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
            <Spectrum db={data.spectrum} sampleRate={data.sampleRate} width={W} height={100} color={color} />
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
            Unos: {formatNumber(data.onesRatio * 100, 1)} %. Lo que no viaja por el canal (la cabecera
            acordada) es: {Object.entries(data.header).map(([k, v]) => `${k} = ${String(v)}`).join(', ')}.
          </p>
        </section>
      )}

      <footer className="insp-actions">
        <button className="btn btn-danger" onClick={() => removeEdge(edgeId)}>
          {t('probe.delete')}
        </button>
      </footer>
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
