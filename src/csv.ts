import {
  validate,
  type Score,
  type Section,
  type Bar,
  type Note,
  type Mark,
} from "./model";
// Each record is an ordinary CSV row. Parent indices and explicit order preserve empty bars/sections.
const columns = [
  "format",
  "version",
  "type",
  "section",
  "bar",
  "index",
  "id",
  "title",
  "subtitle",
  "composer",
  "tempo",
  "key",
  "meter",
  "name",
  "mode",
  "landscape",
  "margin",
  "scale",
  "barsPerLine",
  "break",
  "pickup",
  "repeatStart",
  "repeatEnd",
  "ending",
  "symbol",
  "value",
  "dot",
  "rest",
  "pitch",
  "triplet",
  "tie",
  "slash",
  "text",
  "tick",
  "position",
] as const;
type Row = Record<string, string>;
const marker = "noteark";
function escapeCell(value: string) {
  // Reversible spreadsheet-formula protection, including values that already start with an apostrophe.
  if (/^[=+@\-\t\r']/.test(value)) value = "'" + value;
  return '"' + value.replaceAll('"', '""') + '"';
}
function unescapeCell(value: string) {
  return /^'[=+@\-\t\r']/.test(value) ? value.slice(1) : value;
}
export function scoreToCsv(score: Score): string {
  const rows: Row[] = [];
  const add = (type: string, data: Record<string, unknown>) =>
    rows.push(
      Object.fromEntries(
        Object.entries({ format: marker, version: 1, type, ...data })
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ),
    );
  const { sections, layout, version, ...doc } = score;
  add("document", { ...doc, ...layout });
  sections.forEach((section, si) => {
    const { bars, ...props } = section;
    add("section", { ...props, section: si, index: si });
    bars.forEach((bar, bi) => {
      const { notes, chords, marks, ...props } = bar;
      add("bar", { ...props, section: si, bar: bi, index: bi });
      notes.forEach((n, i) =>
        add("note", { ...n, section: si, bar: bi, index: i }),
      );
      chords.forEach((n, i) =>
        add("chord", { ...n, section: si, bar: bi, index: i }),
      );
      marks.forEach((n, i) =>
        add("mark", { ...n, section: si, bar: bi, index: i }),
      );
    });
  });
  return (
    "\uFEFF" +
    [
      columns.join(","),
      ...rows.map((r) => columns.map((c) => escapeCell(r[c] ?? "")).join(",")),
    ].join("\r\n") +
    "\r\n"
  );
}
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const delimiter = text
    .slice(0, text.search(/[\r\n]/) < 0 ? text.length : text.search(/[\r\n]/))
    .includes(";")
    ? ";"
    : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const finishCell = () => {
    row.push(unescapeCell(cell));
    cell = "";
    closed = false;
  };
  const finishRow = () => {
    finishCell();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === delimiter) {
      finishCell();
      continue;
    }
    if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      finishRow();
      continue;
    }
    if (closed)
      throw Error(
        `CSV rad ${rows.length + 1}: uventet tekst etter avsluttende anførselstegn.`,
      );
    if (c === '"') {
      if (cell)
        throw Error(
          `CSV rad ${rows.length + 1}: anførselstegn må stå rundt hele feltet.`,
        );
      quoted = true;
    } else cell += c;
  }
  if (quoted) throw Error("CSV-filen mangler et avsluttende anførselstegn.");
  if (cell || row.length || closed) finishRow();
  return rows;
}
export function scoreFromCsv(text: string): Score {
  if (text.length > 20_000_000)
    throw Error("CSV-filen er for stor (maks 20 MB).");
  const table = parseCsv(text),
    header = table.shift();
  if (
    !header ||
    header.length !== columns.length ||
    columns.some((c) => !header.includes(c)) ||
    new Set(header).size !== header.length
  )
    throw Error(
      "Dette er ikke en Noteark-CSV. Importer en CSV eksportert fra Noteark.",
    );
  const rows: Row[] = table.map((cells, i) => {
    if (cells.length !== header.length)
      throw Error(`CSV rad ${i + 2}: feil antall felt.`);
    const row = Object.fromEntries(header.map((key, j) => [key, cells[j]]));
    if (row.format !== marker || row.version !== "1")
      throw Error(
        `CSV rad ${i + 2}: ukjent format eller versjon. Forventet Noteark-CSV versjon 1.`,
      );
    if (
      !["document", "section", "bar", "note", "chord", "mark"].includes(
        row.type,
      )
    )
      throw Error(`CSV rad ${i + 2}: ukjent radtype «${row.type}».`);
    return row;
  });
  const num = (r: Row, k: string) => {
    if (!r[k]?.trim() || !Number.isFinite(Number(r[k])))
      throw Error(`CSV: «${k}» må være et tall (${r.type}).`);
    return Number(r[k]);
  };
  const bool = (r: Row, k: string) => {
    if (!["true", "false"].includes(r[k]))
      throw Error(`CSV: «${k}» må være true eller false (${r.type}).`);
    return r[k] === "true";
  };
  const index = (r: Row, k: string) => {
    const n = num(r, k);
    if (!Number.isInteger(n) || n < 0)
      throw Error(`CSV: «${k}» må være et heltall fra 0.`);
    return n;
  };
  const ordered = (rs: Row[], k = "index") => {
    const sorted = [...rs].sort((a, b) => index(a, k) - index(b, k));
    sorted.forEach((r, i) => {
      if (index(r, k) !== i)
        throw Error(`CSV: manglende eller duplisert rekkefølge for ${r.type}.`);
    });
    return sorted;
  };
  const docs = rows.filter((r) => r.type === "document");
  if (docs.length !== 1)
    throw Error("CSV-filen må inneholde nøyaktig én dokumentrad.");
  const d = docs[0];
  let consumed = 1;
  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.type === "document" || r.type === "section") continue;
    const key =
      r.type +
      ":" +
      index(r, "section") +
      (r.type === "bar" ? "" : ":" + index(r, "bar"));
    const bucket = buckets.get(key) || [];
    bucket.push(r);
    buckets.set(key, bucket);
  }
  const sectionRows = ordered(rows.filter((r) => r.type === "section"));
  const sections: Section[] = sectionRows.map((r, si) => {
    if (index(r, "section") !== si)
      throw Error("CSV: seksjonsnummer og rekkefølge stemmer ikke.");
    consumed++;
    const barRows = ordered(buckets.get("bar:" + si) || []);
    const bars: Bar[] = barRows.map((b, bi) => {
      if (index(b, "bar") !== bi)
        throw Error("CSV: taktnummer og rekkefølge stemmer ikke.");
      consumed++;
      const children = (type: string) =>
        ordered(buckets.get(type + ":" + si + ":" + bi) || []);
      const notes: Note[] = children("note").map((n) => {
        consumed++;
        const result: Note = {
          id: n.id,
          value: num(n, "value"),
          pitch: n.pitch,
          dot: bool(n, "dot"),
          rest: bool(n, "rest"),
        };
        if (n.triplet) result.triplet = n.triplet;
        if (n.tie !== "") result.tie = bool(n, "tie");
        if (n.slash !== "") result.slash = bool(n, "slash");
        return result;
      });
      const marks = (type: string): Mark[] =>
        children(type).map((m) => {
          consumed++;
          return {
            id: m.id,
            text: m.text,
            tick: num(m, "tick"),
            position: m.position as Mark["position"],
          };
        });
      return {
        id: b.id,
        notes,
        chords: marks("chord"),
        marks: marks("mark"),
        break: b.break as Bar["break"],
        pickup: num(b, "pickup"),
        repeatStart: bool(b, "repeatStart"),
        repeatEnd: bool(b, "repeatEnd"),
        ending: b.ending,
        symbol: b.symbol,
      };
    });
    return {
      id: r.id,
      name: r.name,
      mode: r.mode as Section["mode"],
      key: r.key,
      meter: r.meter,
      bars,
    };
  });
  if (consumed !== rows.length)
    throw Error(
      "CSV-filen inneholder noter eller takter som peker på en seksjon eller takt som ikke finnes.",
    );
  const score: Score = {
    version: 1,
    id: d.id,
    title: d.title,
    subtitle: d.subtitle,
    composer: d.composer,
    tempo: num(d, "tempo"),
    key: d.key,
    meter: d.meter,
    sections,
    layout: {
      landscape: bool(d, "landscape"),
      margin: num(d, "margin"),
      scale: num(d, "scale"),
      barsPerLine: num(d, "barsPerLine"),
    },
  };
  try {
    return validate(score);
  } catch {
    throw Error(
      "CSV-filen inneholder ugyldige notedata eller sideinnstillinger. Kontroller tonehøyder, noteverdier, triolgrupper og taktarter.",
    );
  }
}
