import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { engine } from '@/runtime/client';
import { downloadWav, onPlaybackChange, play, stop } from '../lib/audio';
import { useStore } from '../store';
import { LatencyMeter } from './LatencyMeter';

/** Controles del bloque Salida: A/B entre procesada y original, descarga y retardo total. */
export function OutputControls({ nodeId }: { nodeId: string }) {
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => onPlaybackChange(setPlaying), []);
  const status = useStore((s) => s.results?.nodes[nodeId]?.status);
  const hasReference = useStore((s) =>
    s.edges.some((e) => e.target === nodeId && e.targetHandle === 'reference'),
  );
  const latency = useStore((s) => {
    const e = s.edges.find((x) => x.target === nodeId && x.targetHandle === 'in');
    return e ? s.results?.nodes[e.source]?.outputs[e.sourceHandle ?? '']?.latencyMs : undefined;
  });

  const keyOut = `${nodeId}:in`;
  const keyRef = `${nodeId}:reference`;

  async function toggle(port: 'in' | 'reference', key: string) {
    if (playing === key) return stop();
    const s = await engine.getSignal(nodeId, port, 'in');
    if (s) play(s, key);
  }

  async function download() {
    const s = await engine.getSignal(nodeId, 'in', 'in');
    if (s) downloadWav(s, 'tinkersignals.wav');
  }

  const disabled = status !== 'ok';
  return (
    <div className="output-controls nodrag">
      <div className="ab">
        <button className="btn btn-primary" disabled={disabled} onClick={() => toggle('in', keyOut)}>
          {playing === keyOut ? t('node.stop') : hasReference ? t('node.playProcessed') : t('node.play')}
        </button>
        {hasReference && (
          <button className="btn" disabled={disabled} onClick={() => toggle('reference', keyRef)}>
            {playing === keyRef ? t('node.stop') : t('node.playOriginal')}
          </button>
        )}
      </div>
      <button className="btn btn-block" disabled={disabled} onClick={download}>
        {t('node.download')}
      </button>
      {latency !== undefined && <LatencyMeter ms={latency} />}
    </div>
  );
}
