import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { setAsset } from '@/runtime/client';
import { saveAsset } from '../lib/assetDb';
import { decodeAudio, startRecording, type DecodedAudio, type Recording } from '../lib/audio';
import { formatNumber, formatRate } from '../lib/format';
import { invalidate, useStore } from '../store';

/** Carga de archivo o grabación de micrófono para los bloques de entrada. */
export function AssetWidget({
  nodeId,
  paramKey,
  widget,
  assetId,
}: {
  nodeId: string;
  paramKey: string;
  widget: 'file' | 'record';
  assetId: string | null;
}) {
  const info = useStore((s) => (assetId ? s.assets[assetId] : undefined));
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!recording) return;
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed((Date.now() - t0) / 1000), 200);
    return () => clearInterval(iv);
  }, [recording]);

  async function store(audio: DecodedAudio, name: string) {
    const id = `${nodeId}:${Date.now().toString(36)}`;
    await setAsset(id, audio.samples, audio.sampleRate);
    const s = useStore.getState();
    s.registerAsset(id, {
      name,
      durationS: audio.samples.length / audio.sampleRate,
      sampleRate: audio.sampleRate,
      trimmedS: audio.trimmedS,
    });
    s.setParam(nodeId, paramKey, id);
    invalidate();
    // Se guarda en el navegador para que siga disponible al recargar.
    void saveAsset({
      id,
      name,
      sampleRate: audio.sampleRate,
      samples: audio.samples,
      trimmedS: audio.trimmedS,
      savedAt: Date.now(),
    });
  }

  async function onFile(file: File) {
    setError(null);
    try {
      await store(await decodeAudio(await file.arrayBuffer()), file.name);
    } catch {
      setError(t('node.decodeError'));
    }
  }

  async function toggleRecording() {
    setError(null);
    if (recording) {
      setRecording(null);
      try {
        await store(await recording.stop(), t('node.record'));
      } catch {
        setError(t('node.decodeError'));
      }
      return;
    }
    try {
      setElapsed(0);
      setRecording(await startRecording());
    } catch {
      setError(t('node.micDenied'));
    }
  }

  return (
    <div className="asset nodrag">
      {info && (
        <p className="asset-info">
          <strong>{info.name}</strong>
          <span>
            {formatNumber(info.durationS ?? 0, 1)} s, {formatRate(info.sampleRate ?? 0)}
          </span>
          {info.trimmedS && <span>{t('node.trimmed', { s: info.trimmedS })}</span>}
        </p>
      )}
      {widget === 'file' ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <button className="btn btn-block" onClick={() => fileRef.current?.click()}>
            {info ? t('node.replace') : t('node.load')}
          </button>
        </>
      ) : (
        <button
          className={`btn btn-block${recording ? ' btn-recording' : ''}`}
          onClick={toggleRecording}
          aria-pressed={!!recording}
        >
          <span className="rec-dot" aria-hidden />
          {recording
            ? `${t('node.stopRecording')} (${formatNumber(elapsed, 1)} s)`
            : t('node.record')}
        </button>
      )}
      {error && <p className="node-msg node-error">{error}</p>}
    </div>
  );
}
