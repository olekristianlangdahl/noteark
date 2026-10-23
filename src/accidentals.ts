import type { Note } from "./model";
import { pitchAccidental } from "./transpose";
/** Engrave the stored pitches without redundant signs. Local signs apply to one staff position until the barline. */
export function barAccidentals(
  notes: Note[],
  key: string,
): ("" | "#" | "b" | "n")[] {
  const state = new Map<string, string>();
  return notes.map((note) => {
    if (note.rest || note.slash) return "";
    const [name, octave] = note.pitch.split("/");
    const staffPosition = name[0] + "/" + octave;
    const desired = pitchAccidental(note.pitch, key);
    const current =
      state.get(staffPosition) ?? pitchAccidental(staffPosition, key);
    state.set(staffPosition, desired);
    return desired === current ? "" : desired;
  });
}
