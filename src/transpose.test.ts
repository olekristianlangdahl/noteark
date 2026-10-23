import { expect, it } from "vitest";
import { transposePitch, pitchShortcut } from "./transpose";
it("flytter kromatisk med fortegn, toneart og oktavskifte", () => {
  expect(transposePitch("E/4", 1, "C")).toBe("Fn/4");
  expect(transposePitch("B/4", 1, "C")).toBe("Cn/5");
  expect(transposePitch("C/4", -1, "C")).toBe("Bn/3");
  expect(transposePitch("F/4", 1, "G")).toBe("Gn/4");
  expect(transposePitch("Fn/4", 1, "G")).toBe("F#/4");
  expect(transposePitch("Bb/4", 2, "C")).toBe("Cn/5");
  expect(transposePitch("F#/4", -2, "C")).toBe("En/4");
  expect(transposePitch("C/0", -1, "C")).toBe("C/0");
  expect(transposePitch("B/8", 1, "C")).toBe("B/8");
});
it("leser halvtoner og heltoner også med norske skifttegn", () => {
  const event = {
    key: "+",
    code: "Minus",
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
  };
  expect(pitchShortcut(event)).toBe(1);
  expect(pitchShortcut({ ...event, key: "?", shiftKey: true })).toBe(2);
  expect(pitchShortcut({ ...event, key: "-", code: "Slash" })).toBe(-1);
  expect(
    pitchShortcut({ ...event, key: "_", code: "Slash", shiftKey: true }),
  ).toBe(-2);
  expect(pitchShortcut({ ...event, ctrlKey: true })).toBe(null);
});
