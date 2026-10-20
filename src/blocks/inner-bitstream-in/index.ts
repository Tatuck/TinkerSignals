import { BlockWaiting } from '@/engine/errors';
import { defineBlock } from '@/engine/types';

/** Entrada de un circuito interior para bloques que reciben bits. */
export default defineBlock({
  id: 'inner-bitstream-in',
  category: 'entrada',
  icon: '↘️',
  hidden: true,
  inputs: {},
  outputs: { out: { type: 'bitstream' } },
  params: { port: { type: 'external', default: 'in' } },
  process({ params, getExternal }) {
    const v = getExternal(`inner:${params.port}`);
    if (v?.kind !== 'bitstream') throw new BlockWaiting('Al bloque real no le llegan bits todavía');
    return { outputs: { out: v } };
  },
});
