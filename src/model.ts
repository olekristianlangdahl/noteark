export type Mode = "chords" | "rhythm" | "melody";
export type Note = {
  id: string;
  value: number;
  dot: boolean;
  rest: boolean;
  pitch: string;
  triplet?: string;
  tie?: boolean;
  slash?: boolean;
};
export type Mark = {
  id: string;
  text: string;
  tick: number;
  position: "above" | "below" | "side";
};
export type Bar = {
  id: string;
  notes: Note[];
  chords: Mark[];
  marks: Mark[];
  break: "none" | "system" | "page";
  pickup: number;
  repeatStart: boolean;
  repeatEnd: boolean;
  ending: string;
  symbol: string;
};
export type Section = {
  id: string;
  name: string;
  mode: Mode;
  key: string;
  meter: string;
  bars: Bar[];
};
export type Score = {
  version: 1;
  id: string;
  title: string;
  subtitle: string;
  composer: string;
  tempo: number;
  key: string;
  meter: string;
  sections: Section[];
  layout: {
    landscape: boolean;
    margin: number;
    scale: number;
    barsPerLine: number;
  };
};
export const uid = () => crypto.randomUUID();
export const bar = (): Bar => ({
  id: uid(),
  notes: [],
  chords: [],
  marks: [],
  break: "none",
  pickup: 0,
  repeatStart: false,
  repeatEnd: false,
  ending: "",
  symbol: "",
});
export const section = (mode: Mode = "rhythm"): Section => ({
  id: uid(),
  name: "Ny seksjon",
  mode,
  key: "",
  meter: "",
  bars: [bar(), bar(), bar(), bar()],
});
export function pitch(raw: string): string {
  const m = /^([A-Ha-h])([#bn]?)([0-8])$/.exec(raw);
  if (!m)
    throw Error(`Ugyldig tone: ${raw}. Bruk for eksempel G4, H4 eller Bb4.`);
  let letter = m[1].toUpperCase();
  let acc = m[2];
  if (letter === "H") letter = "B";
  else if (letter === "B" && !acc) acc = "b";
  return `${letter}${acc}/${m[3]}`;
}
export function pitchLabel(p: string) {
  const [n, o] = p.split("/");
  return (n === "B" ? "H" : n === "Bb" ? "B" : n) + o;
}
export function parse(text: string): Note[] {
  if (!text.trim()) return [];
  const tokens = text.replace(/\s/g, "").split("+");
  const out: Note[] = [];
  for (const token of tokens) {
    const tri = /^tri\((8,8,8)\)$/.exec(token);
    if (tri) {
      const g = uid();
      for (let i = 0; i < 3; i++)
        out.push({
          id: uid(),
          value: 8,
          dot: false,
          rest: false,
          pitch: "B/4",
          triplet: g,
        });
      continue;
    }
    const m = /^(?:([A-Ha-h][#bn]?[0-8]):)?(p)?(1|2|4|8|16)(\.)?$/.exec(token);
    if (!m)
      throw Error(`Kan ikke lese «${token}». Bruk 8+8+2+8+8 eller tri(8,8,8).`);
    out.push({
      id: uid(),
      pitch: m[1] ? pitch(m[1]) : "B/4",
      rest: !!m[2],
      value: +m[3],
      dot: !!m[4],
    });
  }
  return out;
}
export const ticks = (n: Note) =>
  (192 / n.value) * (n.dot ? 3 / 2 : 1) * (n.triplet ? 2 / 3 : 1);
export const capacity = (meter: string) => {
  const [a, b] = meter.split("/").map(Number);
  return (a * 192) / b;
};
export const used = (b: Bar) => b.notes.reduce((a, n) => a + ticks(n), 0);
export const target = (b: Bar, meter: string) => b.pickup || capacity(meter);
export function fill(b: Bar, meter: string): Note[] {
  let remaining = target(b, meter) - used(b);
  if (remaining < 0) throw Error("Takten er allerede for lang.");
  const notes: Note[] = [];
  for (const value of [1, 2, 4, 8, 16])
    while (remaining >= 192 / value) {
      notes.push({ id: uid(), value, dot: false, rest: true, pitch: "B/4" });
      remaining -= 192 / value;
    }
  if (remaining)
    throw Error(
      "Resten kan ikke fylles med vanlige pauser. Fullfør triolgruppen først.",
    );
  return notes;
}
export function example(): Score {
  const intro = section("chords");
  intro.name = "Intro";
  intro.bars.forEach((b, i) => {
    b.chords = [
      {
        id: uid(),
        text: ["G", "D/F#", "Am7", "Cmaj7"][i],
        tick: 0,
        position: "above",
      },
    ];
  });
  intro.bars[0].repeatStart = true;
  intro.bars[3].repeatEnd = true;
  intro.bars[0].marks = [
    { id: uid(), text: "Rolig, med luft", tick: 0, position: "below" },
  ];
  const verse = section();
  verse.name = "Vers 1";
  verse.bars.forEach((b) => (b.notes = parse("8+8+2+8+8")));
  verse.bars[0].marks = [
    { id: uid(), text: "Kun trommer · bygg opp", tick: 0, position: "below" },
  ];
  const solo = section("melody");
  solo.name = "Solo";
  solo.bars.forEach((b) => (b.notes = parse("G4:8+A4:8+H4:2+A4:8+G4:8")));
  solo.bars[3].marks = [
    { id: uid(), text: "D.C. al Fine", tick: 0, position: "below" },
  ];
  return {
    version: 1,
    id: uid(),
    title: "Nordlys",
    subtitle: "Et lite stykke for bandet",
    composer: "Arr. bandet",
    tempo: 96,
    key: "G",
    meter: "4/4",
    sections: [intro, verse, solo],
    layout: { landscape: false, margin: 16, scale: 1, barsPerLine: 4 },
  };
}
export function validate(input: unknown): Score {
  const s = input as Score;
  const fail = () => {
    throw Error(
      "Ugyldig prosjektfil. Forventet et Noteark-prosjekt, versjon 1.",
    );
  };
  if (
    !s ||
    s.version !== 1 ||
    typeof s.id !== "string" ||
    typeof s.title !== "string" ||
    typeof s.subtitle !== "string" ||
    typeof s.composer !== "string" ||
    !Number.isFinite(s.tempo) ||
    s.tempo < 20 ||
    s.tempo > 400 ||
    !["4/4", "3/4", "2/4", "6/8"].includes(s.meter) ||
    !Array.isArray(s.sections) ||
    !s.sections.length ||
    s.sections.length > 100
  )
    fail();
  const keys = [
    "C",
    "G",
    "D",
    "A",
    "E",
    "B",
    "F#",
    "F",
    "Bb",
    "Eb",
    "Ab",
    "Db",
  ];
  if (
    !keys.includes(s.key) ||
    !s.layout ||
    !Number.isFinite(s.layout.margin) ||
    s.layout.margin < 8 ||
    s.layout.margin > 35 ||
    !Number.isFinite(s.layout.scale) ||
    s.layout.scale < 0.7 ||
    s.layout.scale > 1.5 ||
    !Number.isInteger(s.layout.barsPerLine) ||
    s.layout.barsPerLine < 1 ||
    s.layout.barsPerLine > 6 ||
    typeof s.layout.landscape !== "boolean"
  )
    fail();
  for (const sec of s.sections) {
    if (
      !sec ||
      typeof sec.id !== "string" ||
      typeof sec.name !== "string" ||
      !["chords", "rhythm", "melody"].includes(sec.mode) ||
      !["", ...keys].includes(sec.key) ||
      !["", "4/4", "3/4", "2/4", "6/8"].includes(sec.meter) ||
      !Array.isArray(sec.bars) ||
      !sec.bars.length ||
      sec.bars.length > 500
    )
      fail();
    for (const b of sec.bars) {
      if (
        !b ||
        typeof b.id !== "string" ||
        !Array.isArray(b.notes) ||
        b.notes.length > 128 ||
        !Array.isArray(b.chords) ||
        !Array.isArray(b.marks) ||
        !["none", "system", "page"].includes(b.break) ||
        !Number.isFinite(b.pickup) ||
        b.pickup < 0 ||
        b.pickup > 288 ||
        typeof b.repeatStart !== "boolean" ||
        typeof b.repeatEnd !== "boolean" ||
        typeof b.ending !== "string" ||
        !["", "segno", "coda"].includes(b.symbol)
      )
        fail();
      for (const n of b.notes) {
        if (
          !n ||
          typeof n.id !== "string" ||
          ![1, 2, 4, 8, 16].includes(n.value) ||
          typeof n.dot !== "boolean" ||
          typeof n.rest !== "boolean" ||
          !/^([A-G])([#bn]?)\/[0-8]$/.test(n.pitch) ||
          (n.triplet &&
            (n.value !== 8 || n.dot || typeof n.triplet !== "string"))
        )
          fail();
      }
      const groups = new Map<string, number>();
      b.notes.forEach((n) => {
        if (n.triplet) groups.set(n.triplet, (groups.get(n.triplet) || 0) + 1);
      });
      if ([...groups.values()].some((n) => n !== 3)) fail();
      for (const m of [...b.chords, ...b.marks])
        if (
          !m ||
          typeof m.id !== "string" ||
          typeof m.text !== "string" ||
          m.text.length > 200 ||
          !Number.isFinite(m.tick) ||
          m.tick < 0 ||
          m.tick >= capacity(sec.meter || s.meter) ||
          !["above", "below", "side"].includes(m.position)
        )
          fail();
    }
  }
  return structuredClone(s);
}
export function move<T>(arr: T[], index: number, delta: number) {
  const to = index + delta;
  if (to < 0 || to >= arr.length) return;
  [arr[index], arr[to]] = [arr[to], arr[index]];
}
