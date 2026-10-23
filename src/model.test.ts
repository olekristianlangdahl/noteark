import { describe, it, expect } from "vitest";
import {
  parse,
  used,
  bar,
  pitch,
  pitchLabel,
  example,
  validate,
  fill,
  capacity,
} from "./model";
describe("Musikalsk modell", () => {
  it("godkjenner korrekt 4/4 og oppdager overfull takt", () => {
    expect(used({ ...bar(), notes: parse("8 + 8 + 2 + 8 + 8") })).toBe(192);
    expect(used({ ...bar(), notes: parse("8+8+1+8+8") })).toBe(288);
  });
  it("håndterer punktering, pauser og trioler med eksakte ticks", () => {
    const ns = parse("p4+4.+8+tri(8,8,8)");
    expect(used({ ...bar(), notes: ns })).toBe(192);
    expect(ns[0].rest).toBe(true);
    expect(ns[1].dot).toBe(true);
    expect(new Set(ns.slice(3).map((n) => n.triplet)).size).toBe(1);
  });
  it("avviser ugyldige uttrykk uten mutasjon", () => {
    const b = { ...bar(), notes: parse("4") };
    expect(() => {
      b.notes = parse("8+oops");
    }).toThrow();
    expect(b.notes[0].value).toBe(4);
    for (const s of ["3", "4++8", "tri(4,8,8)", "C9:4", "p", "8+"])
      expect(() => parse(s)).toThrow();
  });
  it("bruker entydige norske tonenavn og oktaver", () => {
    expect(pitch("H4")).toBe("B/4");
    expect(pitch("B4")).toBe("Bb/4");
    expect(pitch("Bb4")).toBe("Bb/4");
    expect(pitch("F#4")).toBe("F#/4");
    expect(pitch("C4")).toBe("C/4");
    expect(pitchLabel("B/4")).toBe("H4");
    expect(parse("G4:8+A4:8+H4:2+A4:8+G4:8")[2].pitch).toBe("B/4");
  });
  it("fyller rest og støtter taktarter", () => {
    const b = { ...bar(), notes: parse("4") };
    const n = fill(b, "6/8");
    expect(used({ ...b, notes: [...b.notes, ...n] })).toBe(144);
    expect(["4/4", "3/4", "2/4", "6/8"].map(capacity)).toEqual([
      192, 144, 96, 144,
    ]);
  });
  it("bevarer eksempelet ved JSON-rundtur og avviser ødelagte filer", () => {
    const s = example();
    expect(validate(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(() => validate({ version: 2 })).toThrow();
    const bad = example();
    bad.sections[0].bars[0].notes = parse("4");
    bad.sections[0].bars[0].notes[0].value = 3;
    expect(() => validate(bad)).toThrow();
  });
});
