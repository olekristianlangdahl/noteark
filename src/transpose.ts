const semitones: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const signatures: Record<string, string> = {
  C: "",
  G: "F#",
  D: "F# C#",
  A: "F# C# G#",
  E: "F# C# G# D#",
  B: "F# C# G# D# A#",
  "F#": "F# C# G# D# A# E#",
  F: "Bb",
  Bb: "Bb Eb",
  Eb: "Bb Eb Ab",
  Ab: "Bb Eb Ab Db",
  Db: "Bb Eb Ab Db Gb",
};
/** Return an explicit pitch, so naturals cancel the key signature and earlier accidentals. */
export function transposePitch(
  pitch: string,
  delta: number,
  key: string,
): string {
  const [name, octave] = pitch.split("/");
  const accidental =
    name.slice(1) ||
    signatures[key]
      ?.split(" ")
      .find((n) => n[0] === name[0])
      ?.slice(1) ||
    "";
  const current =
    Number(octave) * 12 +
    semitones[name[0]] +
    (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  const target = current + delta;
  if (target < 0 || target > 107) return pitch;
  const names =
    delta > 0
      ? ["Cn", "C#", "Dn", "D#", "En", "Fn", "F#", "Gn", "G#", "An", "A#", "Bn"]
      : [
          "Cn",
          "Db",
          "Dn",
          "Eb",
          "En",
          "Fn",
          "Gb",
          "Gn",
          "Ab",
          "An",
          "Bb",
          "Bn",
        ];
  return names[target % 12] + "/" + Math.floor(target / 12);
}
export function pitchShortcut(
  e: Pick<
    KeyboardEvent,
    | "key"
    | "code"
    | "shiftKey"
    | "ctrlKey"
    | "metaKey"
    | "altKey"
    | "isComposing"
  >,
): number | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  // Shift changes + to ? on Norwegian keyboards, and - to _.
  const up =
    e.key === "+" ||
    e.code === "NumpadAdd" ||
    (e.shiftKey && e.code === "Minus" && e.key === "?");
  const down = e.key === "-" || e.key === "_" || e.code === "NumpadSubtract";
  return up ? (e.shiftKey ? 2 : 1) : down ? (e.shiftKey ? -2 : -1) : null;
}
