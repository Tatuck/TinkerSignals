import { BlockWaiting } from '@/engine/errors';
import { defineBlock } from '@/engine/types';

/** Entrada de un circuito interior: recibe lo mismo que entra al bloque real. */
export default defineBlock({
  id: 'inner-signal-in',
  category: 'entrada',
  icon: '↘️',
  hidden: true,
  inputs: {},
  outputs: { out: { type: 'signal' } },
  params: { port: { type: 'external', default: 'in' } },
  process({ params, getExternal }) {
    const v = getExternal(`inner:${params.port}`);
    if (v?.kind !== 'signal') throw new BlockWaiting('Al bloque real no le llega señal todavía');
    return { outputs: { out: v } };
  },
});
