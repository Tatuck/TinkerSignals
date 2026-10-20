import { defineBlock } from '@/engine/types';
import { loadAsset } from '../_shared/asset';

export default defineBlock({
  id: 'audio-file',
  category: 'entrada',
  icon: '📂',
  inputs: {},
  outputs: { out: { type: 'signal' } },
  params: {
    audio: { type: 'audio', default: null, widget: 'file' },
  },
  process: ({ params, getAsset }) => ({ outputs: { out: loadAsset(params.audio, getAsset) } }),
});
