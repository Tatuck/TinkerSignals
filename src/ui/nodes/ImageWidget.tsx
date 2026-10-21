import { useRef, useState } from 'react';
import { t } from '@/i18n';
import { setImageAsset } from '@/runtime/client';
import { saveAsset } from '../lib/assetDb';
import { decodeImage } from '../lib/image';
import { invalidate, useStore } from '../store';

/** Carga de una imagen desde un archivo para los bloques que la piden. */
export function ImageWidget({
  nodeId,
  paramKey,
  assetId,
}: {
  nodeId: string;
  paramKey: string;
  assetId: string | null;
}) {
  const info = useStore((s) => (assetId ? s.assets[assetId] : undefined));
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setError(null);
    try {
      const img = await decodeImage(file);
      const id = `${nodeId}:${Date.now().toString(36)}`;
      await setImageAsset(id, img.width, img.height, img.rgba);
      const s = useStore.getState();
      s.registerAsset(id, { name: file.name, width: img.width, height: img.height });
      s.setParam(nodeId, paramKey, id);
      invalidate();
      // Se guarda en el navegador para que siga disponible al recargar.
      void saveAsset({ id, name: file.name, kind: 'image', ...img, savedAt: Date.now() });
    } catch {
      setError(t('node.imageError'));
    }
  }

  return (
    <div className="asset nodrag">
      {info && (
        <p className="asset-info">
          <strong>{info.name}</strong>
          <span>
            {info.width} × {info.height} px
          </span>
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <button className="btn btn-block" onClick={() => fileRef.current?.click()}>
        {info ? t('node.replaceImage') : t('node.loadImage')}
      </button>
      {error && <p className="node-msg node-error">{error}</p>}
    </div>
  );
}
