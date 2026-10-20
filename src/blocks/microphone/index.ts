import { defineBlock } from '@/engine/types';
import { loadAsset } from '../_shared/asset';

export default defineBlock({
  id: 'microphone',
  category: 'entrada',
  icon: '🎙️',
  inputs: {},
  outputs: { out: { type: 'signal' } },
  params: {
    audio: { type: 'audio', default: null, widget: 'record' },
  },
  process: ({ params, getAsset }) => ({ outputs: { out: loadAsset(params.audio, getAsset) } }),
});
