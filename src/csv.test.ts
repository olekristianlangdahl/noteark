import { describe, it, expect } from "vitest";
import { example, parse } from "./model";
import { scoreToCsv, scoreFromCsv, parseCsv } from "./csv";
describe("Noteark-CSV", () => {
  it("bevarer hele det redigerbare prosjektet, inkludert tomme takter og valgfrie egenskaper", () => {
    const s = example();
    s.layout = { landscape: true, margin: 22, scale: 1.2, barsPerLine: 3 };
    const sec = s.sections[2];
    sec.key = "Bb";
    sec.meter = "6/8";
    const b = sec.bars[0];
    b.notes = parse("tri(8,8,8)+p4+F#4:8");
    b.notes[0].tie = false;
    b.notes[1].slash = true;
    b.notes[2].tie = true;
    b.pickup = 120;
    b.break = "page";
    b.ending = "1.";
    b.symbol = "segno";
    b.repeatEnd = true;
    b.marks = [
      {
        id: "tekst",
        text: 'æøå, "rolig"\nSå: bygg opp',
        tick: 24,
        position: "above",
      },
    ];
    expect(scoreFromCsv(scoreToCsv(s))).toEqual(s);
  });
  it("håndterer komma, semikolon, anførselstegn, linjeskift, BOM og formellignende tekst", () => {
    for (const title of [
      "æøå, blå; sol",
      '"Noter"\r\nNeste linje',
      "=SUM(1,2)",
      "'tittel",
      "+solo",
      "-intro",
      "@vers",
      "\ttekst",
    ]) {
      const s = example();
      s.title = title;
      expect(scoreFromCsv(scoreToCsv(s)).title).toBe(title);
    }
    expect(parseCsv('a,b\r\n"x,y","a""b"\r\n')).toEqual([
      ["a", "b"],
      ["x,y", 'a"b'],
    ]);
    const s = example();
    const table = parseCsv(scoreToCsv(s));
    const semicolon = table
      .map((row) =>
        row.map((v) => '"' + v.replaceAll('"', '""') + '"').join(";"),
      )
      .join("\r\n");
    expect(scoreFromCsv(semicolon)).toEqual(s);
  });
  it("avviser andre CSV-er, feil versjon, ødelagte felt og manglende foreldre", () => {
    expect(() => scoreFromCsv("navn,noter\na,4+4")).toThrow(
      "ikke en Noteark-CSV",
    );
    expect(() => parseCsv('a,b\n"åpen,b')).toThrow("avsluttende");
    expect(() => parseCsv('a,b\n"lukket"feil,b')).toThrow("uventet");
    const csv = scoreToCsv(example());
    expect(() =>
      scoreFromCsv(csv.replace('"noteark","1"', '"noteark","2"')),
    ).toThrow("versjon");
    const rows = csv.trimEnd().split("\r\n");
    expect(() =>
      scoreFromCsv(rows.filter((r) => !r.includes('"section"')).join("\r\n")),
    ).toThrow();
    expect(() => scoreFromCsv(rows.slice(1).join("\r\n"))).toThrow();
  });
  it("avviser duplisert rekkefølge og ugyldige notedata uten å endre originalen", () => {
    const s = example(),
      csv = scoreToCsv(s),
      before = structuredClone(s);
    const lines = csv.trimEnd().split("\r\n");
    const note = lines.find((l) => l.includes('"note"'))!;
    expect(() => scoreFromCsv(csv + note + "\r\n")).toThrow("duplisert");
    expect(() => scoreFromCsv(csv.replace('"B/4"', '"Z/4"'))).toThrow(
      "ugyldige notedata",
    );
    expect(s).toEqual(before);
  });
});
