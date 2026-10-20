import { useEffect, useState } from 'react';
import { RECORDINGS, recordingAssetId, type RecordingId } from '@/blocks/sound-library/recordings';
import { setAsset } from '@/runtime/client';
import { decodeAudio } from '../lib/audio';
import { invalidate } from '../store';

const loaded = new Map<string, Promise<void>>();

/** Descarga (una sola vez) la grabación elegida y la entrega al motor. */
function ensureLoaded(id: RecordingId): Promise<void> {
  let p = loaded.get(id);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}sounds/${RECORDINGS[id].file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then(decodeAudio)
      .then((a) => setAsset(recordingAssetId(id), a.samples, a.sampleRate))
      .then(invalidate);
    p.catch(() => loaded.delete(id));
    loaded.set(id, p);
  }
  return p;
}

export function LibraryLoader({ sound }: { sound: string }) {
  const [error, setError] = useState(false);
  const rec = sound in RECORDINGS ? (sound as RecordingId) : null;
  useEffect(() => {
    if (!rec) return;
    let alive = true;
    ensureLoaded(rec).then(
      () => alive && setError(false),
      () => alive && setError(true),
    );
    return () => {
      alive = false;
    };
  }, [rec]);
  if (!rec) return null;
  return (
    <p className="asset-info">
      {error ? (
        <span className="node-error">No se ha podido descargar el sonido.</span>
      ) : (
        RECORDINGS[rec].credit
      )}
    </p>
  );
}
