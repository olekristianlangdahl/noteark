import { expect, it, vi, afterEach } from "vitest";
import { example, parse, section, bar } from "./model";
import { timeline, ScorePlayer } from "./playback";
import { dragPitch } from "./transpose";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("snapper drag til linjer/mellomrom og bevarer eksplisitte fortegn", () => {
  expect(dragPitch("G/4", 1)).toBe("A/4");
  expect(dragPitch("B/4", 1)).toBe("C/5");
  expect(dragPitch("C#/5", -1)).toBe("B#/4");
  expect(dragPitch("C/0", -20)).toBe("C/0");
  expect(dragPitch("B/8", 20)).toBe("B/8");
});
it("beregner sekunder, pauser og korrekte MIDI-toner fra tonearten", () => {
  const s = example();
  s.tempo = 120;
  const sec = section("melody");
  sec.key = "G";
  sec.bars = [{ ...bar(), notes: parse("F4:4+p4+Fn4:4+H4:4") }];
  s.sections = [sec];
  const plan = timeline(s);
  expect(plan.duration).toBe(2);
  expect(plan.events.map((e) => e.time)).toEqual([0, 1, 1.5]);
  expect(plan.events.map((e) => e.midi)).toEqual([66, 65, 71]);
  expect(plan.events.every((e) => e.instrument === "piano")).toBe(true);
});
it("spiller trioler, punktering og rytmepinner med riktig varighet", () => {
  const s = example();
  s.tempo = 60;
  const sec = section("rhythm");
  sec.bars = [{ ...bar(), notes: parse("tri(8,8,8)+4.+8+p4") }];
  s.sections = [sec];
  const p = timeline(s);
  expect(p.duration).toBe(4);
  expect(p.events[1].time).toBeCloseTo(1 / 3);
  expect(p.events[3].time).toBe(1);
  expect(p.events[3].duration).toBe(1.5);
  expect(p.events.every((e) => e.instrument === "stick")).toBe(true);
});
it("holder bindebuer, opptakt, tomme akkordtakter og seksjonsvalg", () => {
  const s = example();
  s.tempo = 60;
  const sec = section("melody");
  sec.bars = [{ ...bar(), pickup: 96, notes: parse("C4:4+C4:4") }];
  sec.bars[0].notes[0].tie = true;
  s.sections = [s.sections[0], sec];
  const all = timeline(s),
    solo = timeline(s, sec.id);
  expect(all.bars[0].duration).toBe(4);
  expect(all.duration).toBe(18);
  expect(solo.duration).toBe(2);
  expect(solo.events).toHaveLength(1);
  expect(solo.events[0].duration).toBe(2);
});
it("planlegger lydnoder, stopper dem og avslutter avspilling", async () => {
  vi.useFakeTimers();
  const sources: any[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  });
  class FakeContext {
    currentTime = 0;
    sampleRate = 48000;
    destination = {};
    resume = async () => {};
    createGain = () => ({
      gain: param(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
    createOscillator = () => {
      const n = {
        frequency: param(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
        type: "sine",
      };
      sources.push(n);
      return n;
    };
  }
  vi.stubGlobal("AudioContext", FakeContext);
  const s = example();
  s.tempo = 120;
  const sec = section("melody");
  sec.bars = [{ ...bar(), notes: parse("C4:1") }];
  s.sections = [sec];
  const player = new ScorePlayer();
  const update = vi.fn(),
    done = vi.fn();
  await player.play(s, undefined, update, done);
  expect(sources).toHaveLength(4);
  expect(sources[0].frequency.value).toBeCloseTo(261.6256, 3);
  expect(sources[0].start).toHaveBeenCalledWith(0.08);
  player.stop();
  expect(sources.every((n) => n.stop.mock.calls.length === 2)).toBe(true);
  vi.advanceTimersByTime(10000);
  expect(done).not.toHaveBeenCalled();
});
