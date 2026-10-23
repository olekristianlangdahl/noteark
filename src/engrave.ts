import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Beam,
  Fraction,
  Tuplet,
  Dot,
  Accidental,
  StaveTie,
  Barline,
  Repetition,
  Volta,
} from "vexflow";
import { type Score, type Bar, type Section, ticks, capacity } from "./model";
export type Hit = {
  barId: string;
  sectionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  start: number;
  end: number;
  notes: { id: string; x: number; y: number }[];
};
export type Page = { svg: SVGSVGElement; hits: Hit[] };
const NS = "http://www.w3.org/2000/svg";
function text(
  svg: SVGSVGElement,
  x: number,
  y: number,
  value: string,
  size = 14,
  weight = "normal",
  anchor = "start",
) {
  const t = document.createElementNS(NS, "text");
  t.setAttribute("stroke", "none");
  t.setAttribute("x", "" + x);
  t.setAttribute("y", "" + y);
  t.setAttribute("font-family", "Arial, sans-serif");
  t.setAttribute("font-size", "" + size);
  t.setAttribute("font-weight", weight);
  t.setAttribute("text-anchor", anchor);
  t.textContent = value;
  svg.append(t);
}
export function renderScore(score: Score): Page[] {
  const scale = score.layout.scale;
  const width = (score.layout.landscape ? 1123 : 794) / scale,
    height = (score.layout.landscape ? 794 : 1123) / scale,
    m = (score.layout.margin * 3.78) / scale;
  const pages: Page[] = [];
  let ctx: ReturnType<Renderer["getContext"]>,
    svg: SVGSVGElement,
    y = 0;
  let page: Page;
  function newPage() {
    const host = document.createElement("div");
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, height);
    ctx = renderer.getContext();
    svg = host.querySelector("svg")!;
    svg.removeAttribute("style");
    svg.setAttribute("xmlns", NS);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    page = { svg, hits: [] };
    pages.push(page);
    text(svg, width / 2, m + 22, score.title, 28, "bold", "middle");
    text(svg, width / 2, m + 47, score.subtitle, 13, "normal", "middle");
    text(svg, width - m, m + 70, score.composer, 11, "normal", "end");
    text(svg, m, m + 70, `Tempo ${score.tempo} · ${score.meter}`, 11);
    text(
      svg,
      width - m,
      height - m / 2,
      `${pages.length}`,
      10,
      "normal",
      "end",
    );
    y = m + 110;
  }
  newPage();
  let number = 0;
  for (const sec of score.sections) {
    let index = 0;
    let first = true;
    while (index < sec.bars.length) {
      const row: Bar[] = [];
      while (index < sec.bars.length && row.length < score.layout.barsPerLine) {
        const b = sec.bars[index];
        if (row.length && b.break !== "none") break;
        const candidate = [...row, b];
        const needed =
          Math.max(
            ...candidate.map(
              (v, j) =>
                (j === 0 ? (sec.mode === "melody" ? 120 : 65) : 30) +
                Math.max(2, v.notes.length) * 30,
            ),
          ) * candidate.length;
        if (row.length && needed > width - 2 * m) break;
        row.push(b);
        index++;
      }
      const density = Math.max(...row.map((b) => b.notes.length));
      const extra = Math.max(0, ...row.map((b) => b.marks.length * 18));
      const rowHeight = 220 + extra + Math.max(0, density - 12) * 2;
      if (
        (row[0].break === "page" && page!.hits.length) ||
        y + rowHeight > height - m
      )
        newPage();
      text(
        svg!,
        m,
        y - 14,
        first ? sec.name : `${sec.name} · forts.`,
        16,
        "bold",
      );
      first = false;
      const w = (width - 2 * m) / row.length;
      row.forEach((b, i) => {
        number++;
        const x = m + i * w;
        const staveY = y + 36;
        const staff = new Stave(x, staveY, w, { numLines: 5 });
        if (sec.mode !== "melody")
          staff.setConfigForLines(
            [false, false, true, false, false].map((visible) => ({ visible })),
          );
        if (i === 0) {
          if (sec.mode === "melody")
            staff.addClef("treble").addKeySignature(sec.key || score.key);
          staff.addTimeSignature(sec.meter || score.meter);
        }
        if (b.repeatStart) staff.setBegBarType(Barline.type.REPEAT_BEGIN);
        if (b.repeatEnd) staff.setEndBarType(Barline.type.REPEAT_END);
        if (b.ending) staff.setVoltaType(Volta.type.BEGIN_END, b.ending, 0);
        if (b.symbol)
          staff.setRepetitionType(
            b.symbol === "segno"
              ? Repetition.type.SEGNO_LEFT
              : Repetition.type.CODA_LEFT,
            0,
          );
        staff.setContext(ctx!).draw();
        text(svg!, x + 4, y + 13, "" + number, 10);
        const start = staff.getNoteStartX() + 10,
          end = x + w - 22;
        const hit: Hit = {
          barId: b.id,
          sectionId: sec.id,
          x,
          y: y - 5,
          width: w,
          height: rowHeight - 10,
          start,
          end,
          notes: [],
        };
        page!.hits.push(hit);
        const notes = b.notes.map((n) => {
          const key =
            sec.mode === "melody" && !n.rest ? n.pitch.toLowerCase() : "b/4";
          const note = new StaveNote({
            keys: [key],
            duration:
              "" +
              n.value +
              (n.dot ? "d" : "") +
              (n.rest ? "r" : n.slash ? "s" : ""),
            autoStem: true,
          });
          if (n.dot) Dot.buildAndAttach([note], { all: true });
          const acc = /^[A-G]([#bn])\//.exec(n.pitch);
          if (acc && sec.mode === "melody" && !n.rest)
            note.addModifier(new Accidental(acc[1]), 0);
          return note;
        });
        if (notes.length) {
          const [a, d] = (sec.meter || score.meter).split("/").map(Number);
          const voice = new Voice({ numBeats: a, beatValue: d })
            .setStrict(false)
            .addTickables(notes);
          const tuplets: Tuplet[] = [];
          for (let j = 0; j < b.notes.length; j++)
            if (
              b.notes[j].triplet &&
              b.notes[j].triplet !== b.notes[j - 1]?.triplet
            )
              tuplets.push(
                new Tuplet(notes.slice(j, j + 3), {
                  numNotes: 3,
                  notesOccupied: 2,
                }),
              );
          new Formatter()
            .joinVoices([voice])
            .formatToStave([voice], staff, { stave: staff });
          const beams = Beam.generateBeams(notes, {
            groups: d === 8 ? [new Fraction(3, 8)] : [new Fraction(1, 4)],
          });
          voice.draw(ctx!, staff);
          beams.forEach((v) => v.setContext(ctx!).draw());
          tuplets.forEach((t) => t.setContext(ctx!).draw());
          notes.forEach((n, j) => {
            hit.notes.push({
              id: b.notes[j].id,
              x: n.getAbsoluteX(),
              y: n.getYs()[0],
            });
            if (
              b.notes[j].tie &&
              notes[j + 1] &&
              !b.notes[j].rest &&
              !b.notes[j + 1].rest
            )
              new StaveTie({
                firstNote: n,
                lastNote: notes[j + 1],
                firstIndexes: [0],
                lastIndexes: [0],
              })
                .setContext(ctx!)
                .draw();
          });
        }
        const duration = Math.max(
          capacity(sec.meter || score.meter),
          b.notes.reduce((sum, n) => sum + ticks(n), 0),
        );
        function anchor(tick: number) {
          let t = 0;
          for (let j = 0; j < b.notes.length; j++) {
            if (t === tick && hit.notes[j]) return hit.notes[j].x;
            t += ticks(b.notes[j]);
          }
          return start + ((end - start) * tick) / duration;
        }
        b.chords.forEach((c, j) =>
          text(
            svg!,
            anchor(c.tick),
            y + 33 - (j && c.tick === b.chords[j - 1].tick ? 17 : 0),
            c.text,
            15,
            "bold",
          ),
        );
        b.marks.forEach((c, j) =>
          text(
            svg!,
            c.position === "side" ? x + w - 8 : anchor(c.tick),
            c.position === "above" ? y - 33 - j * 17 : staveY + 135 + j * 17,
            c.text,
            11,
            "normal",
            c.position === "side" ? "end" : "start",
          ),
        );
      });
      y += rowHeight;
    }
  }
  return pages;
}
export function renderPalette(value: number, rest: boolean): string {
  const host = document.createElement("div");
  const r = new Renderer(host, Renderer.Backends.SVG);
  r.resize(48, 62);
  const ctx = r.getContext();
  const s = new Stave(0, -12, 48, { numLines: 0 });
  s.setContext(ctx);
  const n = new StaveNote({
    keys: ["b/4"],
    duration: "" + value + (rest ? "r" : ""),
  });
  Formatter.FormatAndDraw(ctx, s, [n]);
  return host.innerHTML;
}
