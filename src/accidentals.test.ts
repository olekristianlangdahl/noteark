import { expect, it } from "vitest";
import { parse } from "./model";
import { barAccidentals } from "./accidentals";
import { pitchNumber } from "./transpose";
it("gjentar ikke fortegn fra tonearten, i noen oktav", () => {
  expect(barAccidentals(parse("F#4:4+F#5:4+F4:4+F5:4"), "G")).toEqual([
    "",
    "",
    "",
    "",
  ]);
  expect(barAccidentals(parse("Bb4:4+Bb5:4+B4:4"), "F")).toEqual(["", "", ""]);
  expect(barAccidentals(parse("C#4:4+F#4:4"), "D")).toEqual(["", ""]);
});
it("viser oppløsning én gang og gjeninnfører kryss når det trengs", () => {
  expect(barAccidentals(parse("F#4:4+Fn4:4+Fn4:4+F#4:4"), "G")).toEqual([
    "",
    "n",
    "",
    "#",
  ]);
  expect(barAccidentals(parse("F#4:4+F#4:4+F4:4+F4:4"), "C")).toEqual([
    "#",
    "",
    "n",
    "",
  ]);
});
it("løse fortegn gjelder én oktav og nullstilles ved neste takt", () => {
  const notes = parse("F#4:8+F#4:8+F#5:8+F#5:8+p4+F#4:4");
  expect(barAccidentals(notes, "C")).toEqual(["#", "", "#", "", "", ""]);
  expect(barAccidentals(parse("F#4:4"), "C")).toEqual(["#"]);
  expect(barAccidentals(parse("F4:4"), "C")).toEqual([""]);
  expect(barAccidentals(parse("Fn4:4"), "G")).toEqual(["n"]);
  expect(barAccidentals(parse("F#4:4"), "G")).toEqual([""]);
});
it("bevarer tonehøyder og ignorerer pauser/slash i fortegnstilstanden", () => {
  const notes = parse("F#4:4+Fn4:4+F4:4");
  const original = structuredClone(notes);
  expect(notes.map((n) => pitchNumber(n.pitch, "G"))).toEqual([54, 53, 54]);
  expect(barAccidentals(notes, "G")).toEqual(["", "n", "#"]);
  expect(notes).toEqual(original);
  const rest = parse("Fn4:4")[0];
  rest.rest = true;
  expect(barAccidentals([rest, ...parse("F#4:4")], "G")).toEqual(["", ""]);
});
