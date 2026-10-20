import { BlockWaiting } from '@/engine/errors';
import { makeSignal } from '@/engine/dsp/signal';
import { defineBlock } from '@/engine/types';
import { RECORDINGS, recordingAssetId, type RecordingId } from './recordings';
import { SYNTH_SOUNDS, type SynthSoundId } from './synth';

const OPTIONS = [...Object.keys(RECORDINGS), ...Object.keys(SYNTH_SOUNDS)] as (RecordingId | SynthSoundId)[];
const isRecording = (id: string): id is RecordingId => id in RECORDINGS;

/**
 * Sonidos listos para usar: grabaciones reales de dominio público (que la UI
 * descarga como assets) y sonidos sintéticos generados al vuelo.
 */
export default defineBlock({
  id: 'sound-library',
  category: 'entrada',
  icon: '📚',
  inputs: {},
  outputs: { out: { type: 'signal' } },
  params: {
    sound: { type: 'select', default: 'voz-femenina', options: OPTIONS },
  },
  process({ params, getAsset }) {
    let signal;
    if (isRecording(params.sound)) {
      signal = getAsset(recordingAssetId(params.sound));
      if (!signal) throw new BlockWaiting('Cargando el sonido…');
    } else {
      const s = SYNTH_SOUNDS[params.sound];
      signal = makeSignal(s.make(s.sampleRate), s.sampleRate);
    }
    return {
      outputs: { out: signal },
      metrics: [
        { key: 'sampleRate', value: signal.sampleRate, unit: 'Hz', highlight: true },
        { key: 'duration', value: signal.samples.length / signal.sampleRate, unit: 's', highlight: true },
      ],
    };
  },
});
