import type { EffectKind } from '../effects/types';
import { patchFor, type SfxPatch } from './patches';

// v0.5 — Web Audio engine. Synthesises per-effect sfx procedurally and routes
// everything through a master bus that fans out to the speakers AND a
// MediaStreamDestination, so recordings can mux the audio track (画音同步).

const LS_VOLUME = 'auraseal.audio.volume';
const LS_MUTED = 'auraseal.audio.muted';
const LS_BGM = 'auraseal.audio.bgm';

function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw === '1';
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private recordDest: MediaStreamAudioDestinationNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private bgmNodes: { osc: OscillatorNode[]; gain: GainNode } | null = null;

  volume = readNumber(LS_VOLUME, 0.8);
  muted = readBool(LS_MUTED, false);
  bgmOn = readBool(LS_BGM, false);

  /** Lazily create + resume the context (must follow a user gesture). */
  async resume(): Promise<void> {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        return;
      }
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.recordDest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.ctx.destination);
      this.master.connect(this.recordDest);
      this.applyGain();
      this.noiseBuffer = this.makeNoise(this.ctx);
      if (this.bgmOn) {
        this.startBgm();
      }
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  get audioStream(): MediaStream | null {
    return this.recordDest?.stream ?? null;
  }

  setVolume(value: number) {
    this.volume = Math.min(1, Math.max(0, value));
    localStorage.setItem(LS_VOLUME, String(this.volume));
    this.applyGain();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(LS_MUTED, this.muted ? '1' : '0');
    this.applyGain();
    return this.muted;
  }

  toggleBgm(): boolean {
    this.bgmOn = !this.bgmOn;
    localStorage.setItem(LS_BGM, this.bgmOn ? '1' : '0');
    if (this.bgmOn) {
      this.startBgm();
    } else {
      this.stopBgm();
    }
    return this.bgmOn;
  }

  playSfx(id: EffectKind) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== 'running' || this.muted) {
      return;
    }
    this.renderPatch(ctx, master, patchFor(id));
  }

  private applyGain() {
    if (this.master && this.ctx) {
      const target = this.muted ? 0 : this.volume;
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private renderPatch(ctx: AudioContext, master: GainNode, patch: SfxPatch) {
    const t0 = ctx.currentTime;
    const end = t0 + patch.duration;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(1, t0 + patch.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    env.connect(master);

    if (patch.tone) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = patch.tone.type;
      osc.frequency.setValueAtTime(patch.tone.freq, t0);
      if (patch.tone.freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, patch.tone.freqEnd), end);
      }
      gain.gain.value = patch.tone.gain;
      osc.connect(gain).connect(env);
      osc.start(t0);
      osc.stop(end + 0.02);
    }

    if (patch.noise && this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      filter.type = patch.noise.filter;
      filter.frequency.setValueAtTime(patch.noise.cutoff, t0);
      if (patch.noise.cutoffEnd) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(60, patch.noise.cutoffEnd), end);
      }
      filter.Q.value = patch.noise.q ?? 1;
      gain.gain.value = patch.noise.gain;
      src.connect(filter).connect(gain).connect(env);
      src.start(t0);
      src.stop(end + 0.02);
    }

    if (patch.sub) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(patch.sub.freq, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, patch.sub.freq * 0.6), end);
      gain.gain.value = patch.sub.gain;
      osc.connect(gain).connect(env);
      osc.start(t0);
      osc.stop(end + 0.02);
    }
  }

  private startBgm() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.bgmNodes) {
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(0.06, ctx.currentTime, 1.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const freqs = [110, 164.81, 220];
    const oscs = freqs.map((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (i - 1) * 6;
      osc.connect(filter);
      osc.start();
      return osc;
    });
    filter.connect(gain).connect(master);
    this.bgmNodes = { osc: oscs, gain };
  }

  private stopBgm() {
    const nodes = this.bgmNodes;
    const ctx = this.ctx;
    if (!nodes || !ctx) {
      return;
    }
    nodes.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
    const stopAt = ctx.currentTime + 1;
    nodes.osc.forEach((osc) => osc.stop(stopAt));
    this.bgmNodes = null;
  }
}

export const audioEngine = new AudioEngine();
