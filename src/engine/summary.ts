import { bitsToString } from './dsp/bits';
import { peak, rms } from './dsp/metrics';
import { envelope, interestingWindow } from './dsp/signal';
import type { PortValue, ValueSummary } from './types';

const PREVIEW_BINS = 160;

/** Resumen ligero de un valor para la UI (miniaturas, info de cables). */
export function summarize(v: PortValue): ValueSummary {
  if (v.kind === 'signal') {
    return {
      kind: 'signal',
      sampleRate: v.sampleRate,
      length: v.samples.length,
      durationS: v.samples.length / v.sampleRate,
      peak: peak(v.samples),
      rms: rms(v.samples),
      preview: envelope(v.samples, PREVIEW_BINS),
      snippet: v.samples.slice(...interestingWindow(v.samples, Math.round(0.015 * v.sampleRate))),
    };
  }
  if (v.kind === 'packets') {
    const pps = 1000 / v.packetMs;
    const payloadBits = v.packets.reduce((a, p) => a + p.payloadBits, 0) / Math.max(1, v.packets.length);
    return {
      kind: 'packets',
      protocol: v.protocol,
      count: v.packets.length,
      lost: v.packets.filter((p) => p.arrivalMs === null).length,
      packetMs: v.packetMs,
      packetsPerSecond: pps,
      payloadBitrate: payloadBits * pps,
      networkBitrate: (payloadBits + v.overheadBits) * pps,
    };
  }
  const duration = v.header.numSamples / v.header.sampleRate;
  return {
    kind: 'bitstream',
    codec: v.header.codec,
    bitLength: v.bitLength,
    bitrate: duration > 0 ? v.bitLength / duration : 0,
    compression: v.bitLength > 0 ? v.referenceBits / v.bitLength : 0,
    firstBits: bitsToString(v.bytes, v.bitLength),
  };
}
