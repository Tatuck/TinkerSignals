/**
 * Grabaciones reales de dominio público servidas desde `public/sounds/`.
 * La UI las descarga y las registra como assets con id `lib:<id>`.
 * Los créditos completos están en public/sounds/CREDITS.md.
 */
export const RECORDINGS = {
  'voz-masculina': { file: 'voz-masculina.wav', credit: 'Samaniego, «Fábulas». Lee mpinedag (LibriVox, dominio público)' },
  'voz-femenina': { file: 'voz-femenina.wav', credit: 'Samaniego, «Fábulas». Lee Consuelo Aponte (LibriVox, dominio público)' },
  'piano-bach': { file: 'piano-bach.wav', credit: 'Bach, Variaciones Goldberg n.º 4 (Musopen, dominio público)' },
  'cuarteto-haydn': { file: 'cuarteto-haydn.wav', credit: 'Haydn, Cuarteto «La alondra», IV (Musopen, dominio público)' },
} as const;

export type RecordingId = keyof typeof RECORDINGS;
export const recordingAssetId = (id: RecordingId) => `lib:${id}`;
