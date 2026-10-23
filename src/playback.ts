import { type Score, ticks, target, used } from "./model";
import { pitchNumber } from "./transpose";
export type SoundEvent = {
  time: number;
  duration: number;
  midi: number;
  instrument: "piano" | "stick";
  barId: string;
  noteId: string;
};
export type Timeline = {
  events: SoundEvent[];
  bars: { id: string; time: number; duration: number }[];
  duration: number;
};
export function timeline(score: Score, sectionId?: string): Timeline {
  const result: Timeline = { events: [], bars: [], duration: 0 };
  const secondsPerTick = 60 / score.tempo / 48;
  for (const section of score.sections) {
    if (sectionId && section.id !== sectionId) continue;
    for (const bar of section.bars) {
      const duration =
        Math.max(target(bar, section.meter || score.meter), used(bar)) *
        secondsPerTick;
      result.bars.push({ id: bar.id, time: result.duration, duration });
      let offset = 0;
      for (let i = 0; i < bar.notes.length; i++) {
        const n = bar.notes[i],
          length = ticks(n) * secondsPerTick;
        if (!n.rest) {
          const instrument =
            section.mode === "melody" && !n.slash ? "piano" : "stick";
          const midi = pitchNumber(n.pitch, section.key || score.key);
          let sustain = length;
          // Ties extend the first sound; a tied continuation is not struck again.
          const previous = bar.notes[i - 1];
          const continuation =
            previous?.tie &&
            !previous.slash &&
            !previous.rest &&
            pitchNumber(previous.pitch, section.key || score.key) === midi &&
            instrument === "piano";
          if (!continuation) {
            let j = i;
            while (
              instrument === "piano" &&
              bar.notes[j].tie &&
              bar.notes[j + 1] &&
              !bar.notes[j + 1].rest &&
              pitchNumber(bar.notes[j + 1].pitch, section.key || score.key) ===
                midi
            ) {
              j++;
              sustain += ticks(bar.notes[j]) * secondsPerTick;
            }
            result.events.push({
              time: result.duration + offset,
              duration: sustain,
              midi: midi + 12,
              instrument,
              barId: bar.id,
              noteId: n.id,
            });
          }
        }
        offset += length;
      }
      result.duration += duration;
    }
  }
  return result;
}
export type PlaybackPosition = { barId: string; noteId: string } | null;
export class ScorePlayer {
  private context?: AudioContext;
  private bus?: GainNode;
  private timer?: ReturnType<typeof setInterval>;
  private generation = 0;
  private volume = 0.55;
  private sources = new Set<AudioScheduledSourceNode>();
  setVolume(value: number) {
    this.volume = value;
    if (this.bus && this.context)
      this.bus.gain.setTargetAtTime(
        value * 0.35,
        this.context.currentTime,
        0.02,
      );
  }
  stop() {
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.bus?.disconnect();
    this.bus = undefined;
  }
  async play(
    score: Score,
    sectionId: string | undefined,
    update: (position: PlaybackPosition) => void,
    done: () => void,
  ) {
    this.stop();
    const generation = this.generation;
    this.context ||= new AudioContext();
    await this.context.resume();
    if (generation !== this.generation) return;
    const ctx = this.context,
      plan = timeline(score, sectionId);
    if (!plan.duration) {
      done();
      return;
    }
    const bus = ctx.createGain();
    bus.gain.value = this.volume * 0.35;
    bus.connect(ctx.destination);
    this.bus = bus;
    const start = ctx.currentTime + 0.08;
    let index = 0,
      last = "";
    const tick = () => {
      const time = ctx.currentTime - start;
      while (
        index < plan.events.length &&
        plan.events[index].time < time + 0.18
      ) {
        const event = plan.events[index++];
        this.sound(event, start + event.time, bus);
      }
      const bar = plan.bars.find(
        (b) => time >= b.time && time < b.time + b.duration,
      );
      const event = plan.events.find(
        (e) => time >= e.time && time < e.time + e.duration,
      );
      const signature = (bar?.id || "") + (event?.noteId || "");
      if (signature !== last) {
        last = signature;
        update(bar ? { barId: bar.id, noteId: event?.noteId || "" } : null);
      }
      if (time >= plan.duration + 0.15) {
        this.stop();
        update(null);
        done();
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }
  private sound(event: SoundEvent, time: number, bus: GainNode) {
    const ctx = this.context!;
    const add = (
      frequency: number,
      amplitude: number,
      decay: number,
      duration: number,
      type: OscillatorType = "sine",
    ) => {
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(amplitude, time + 0.003);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, amplitude * Math.exp(-duration / decay)),
        time + Math.max(0.01, duration),
      );
      gain.gain.linearRampToValueAtTime(0, time + duration + 0.045);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(time);
      osc.stop(time + duration + 0.05);
      this.sources.add(osc);
      osc.onended = () => {
        this.sources.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
    };
    if (event.instrument === "stick") {
      add(1800, 0.42, 0.012, 0.045, "triangle");
      add(930, 0.22, 0.008, 0.035);
    } else {
      const fundamental = 440 * 2 ** ((event.midi - 69) / 12);
      const length = Math.max(0.025, event.duration * 0.94);
      // Struck harmonic partials decay faster in the treble, like a simple electric piano.
      [1, 2, 3, 4].forEach((partial, i) => {
        if (fundamental * partial < ctx.sampleRate / 2)
          add(
            fundamental * partial,
            [0.6, 0.22, 0.1, 0.04][i],
            1.4 / partial,
            length,
          );
      });
    }
  }
}
