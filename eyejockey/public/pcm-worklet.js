/**
 * PCM audio worklet: captures mono Float32 samples from the mic graph,
 * converts to 16-bit little-endian PCM, and posts fixed-duration chunks
 * to the main thread for streaming to Deepgram with linear16 encoding.
 *
 * Uses `sampleRate` (AudioWorkletGlobalScope global) so the chunk size
 * corresponds to the requested duration regardless of the actual context rate.
 */
class PCMWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const chunkMs = options?.processorOptions?.chunkMs ?? 50;
    const chunkSize = Math.max(1, Math.floor((sampleRate * chunkMs) / 1000));
    this._buffer = new Int16Array(chunkSize);
    this._offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;

    const buf = this._buffer;
    let off = this._offset;
    for (let i = 0; i < channel.length; i++) {
      const s = channel[i] < -1 ? -1 : channel[i] > 1 ? 1 : channel[i];
      buf[off++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (off === buf.length) {
        const out = new Int16Array(buf);
        this.port.postMessage(out.buffer, [out.buffer]);
        off = 0;
      }
    }
    this._offset = off;
    return true;
  }
}

registerProcessor('pcm-worklet', PCMWorklet);
