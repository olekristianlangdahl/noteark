import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { VexFlow } from "vexflow";
import {
  Music2,
  Plus,
  Undo2,
  Redo2,
  Download,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  FileUp,
  Eye,
  MousePointer2,
} from "lucide-react";
import {
  type Score,
  type Mode,
  type Note,
  type Bar,
  example,
  section,
  bar,
  parse,
  uid,
  used,
  target,
  fill,
  move,
  pitchLabel,
  capacity,
  ticks,
  validate,
} from "./model";
import { renderScore, renderPalette, type Page, type Hit } from "./engrave";
import { download, exportScore } from "./export";
import "./style.css";
import { transposePitch, pitchShortcut } from "./transpose";
const KEY = "noteark.projects.v1";
const modes: Record<Mode, string> = {
  chords: "Akkordskjema",
  rhythm: "Trommer / rytme",
  melody: "Melodi / solo",
};
const keys = ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"];
function load(): Score[] {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved).map(validate);
  } catch {
    sessionStorage.setItem(
      "noteark-recovery",
      "Lagrede data kunne ikke leses. Eksporter sikkerhetskopi før du lukker nettleseren.",
    );
  }
  return [example()];
}
function App() {
  const [projects, setProjects] = useState<Score[]>(load);
  const [score, setScore] = useState(projects[0]);
  const [past, setPast] = useState<Score[]>([]),
    [future, setFuture] = useState<Score[]>([]);
  const [selected, setSelected] = useState(score.sections[0].bars[0].id);
  const [noteId, setNoteId] = useState("");
  const [tool, setTool] = useState<number | null>(null),
    [rest, setRest] = useState(false),
    [dot, setDot] = useState(false);
  const [expr, setExpr] = useState("8+8+2+8+8"),
    [message, setMessage] = useState(
      sessionStorage.getItem("noteark-recovery") || "",
    );
  const [preview, setPreview] = useState(false),
    [showExport, setShowExport] = useState(false),
    [format, setFormat] = useState<"pdf" | "png" | "jpg">("pdf"),
    [exportPage, setExportPage] = useState<number | "all">("all"),
    [transparent, setTransparent] = useState(false),
    [busy, setBusy] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [chord, setChord] = useState("G"),
    [beat, setBeat] = useState(1),
    [instruction, setInstruction] = useState("Bygg opp"),
    [position, setPosition] = useState<"above" | "below" | "side">("below");
  const inputRef = useRef<HTMLInputElement>(null);
  const sec =
    score.sections.find((s) => s.bars.some((b) => b.id === selected)) ||
    score.sections[0];
  const b = sec.bars.find((b) => b.id === selected) || sec.bars[0];
  const note = b.notes.find((n) => n.id === noteId);
  const meter = sec.meter || score.meter;
  function commit(fn: (s: Score) => void) {
    setScore((old) => {
      const next = structuredClone(old);
      fn(next);
      setPast((p) => [...p.slice(-99), old]);
      setFuture([]);
      return next;
    });
  }
  function editBar(fn: (b: Bar) => void) {
    commit((s) =>
      fn(
        s.sections
          .find((x) => x.id === sec.id)!
          .bars.find((x) => x.id === b.id)!,
      ),
    );
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [score, ...f]);
    setScore(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, score]);
    setScore(future[0]);
    setFuture((f) => f.slice(1));
  }
  useEffect(() => {
    try {
      const next = projects.map((p) => (p.id === score.id ? score : p));
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      setMessage("Lokal lagring feilet. Last ned JSON som sikkerhetskopi.");
    }
  }, [score, projects]);
  useEffect(() => {
    try {
      setPages(renderScore(score));
    } catch (e) {
      setMessage("Notegrafikk: " + (e as Error).message);
    }
  }, [score]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
        )
      )
        return;
      const delta = pitchShortcut(e);
      if (
        delta !== null &&
        note &&
        !note.rest &&
        sec.mode === "melody" &&
        !preview &&
        !showExport
      ) {
        e.preventDefault();
        transpose(delta);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function switchDoc(id: string) {
    const next = projects.find((p) => p.id === id);
    if (!next) return;
    setProjects((ps) => ps.map((p) => (p.id === score.id ? score : p)));
    setScore(next);
    setPast([]);
    setFuture([]);
    setSelected(next.sections[0].bars[0].id);
  }
  function addDoc() {
    const n = example();
    n.title = "Uten tittel";
    n.subtitle = "";
    n.sections = [section()];
    setProjects((ps) => [...ps.map((p) => (p.id === score.id ? score : p)), n]);
    setScore(n);
    setSelected(n.sections[0].bars[0].id);
    setPast([]);
    setFuture([]);
  }
  function apply() {
    try {
      const notes = parse(expr);
      editBar((b) => (b.notes = notes));
      setNoteId("");
      setMessage("Rytmen er lagt inn.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function insert(hit: Hit, x: number, y: number) {
    setSelected(hit.barId);
    if (tool === null) return;
    const section = score.sections.find((s) => s.id === hit.sectionId)!;
    const bar = section.bars.find((b) => b.id === hit.barId)!;
    const letters = ["C", "D", "E", "F", "G", "A", "B"];
    const step = Math.round((hit.y + 5 + 36 + 90 - y) / 5);
    const diatonic = 4 * 7 + 2 + step;
    const pitch =
      section.mode === "melody"
        ? `${letters[((diatonic % 7) + 7) % 7]}/${Math.floor(diatonic / 7)}`
        : "B/4";
    const n: Note = { id: uid(), value: tool, dot, rest, pitch };
    const tick = Math.max(
      0,
      Math.round(
        (((x - hit.start) / (hit.end - hit.start)) *
          target(bar, section.meter || score.meter)) /
          12,
      ) * 12,
    );
    let sum = 0,
      index = bar.notes.length;
    for (let i = 0; i < bar.notes.length; i++) {
      if (sum >= tick) {
        index = i;
        break;
      }
      sum += ticks(bar.notes[i]);
    }
    commit((s) =>
      s.sections
        .find((s) => s.id === section.id)!
        .bars.find((b) => b.id === bar.id)!
        .notes.splice(index, 0, n),
    );
    setNoteId(n.id);
  }
  function changeNote(fn: (n: Note) => void) {
    editBar((b) => {
      const n = b.notes.find((n) => n.id === noteId);
      if (n) {
        fn(n);
      }
    });
  }
  function transpose(delta: number) {
    if (!note) return;
    if (note.rest || sec.mode !== "melody") return;
    const next = transposePitch(note.pitch, delta, sec.key || score.key);
    if (next !== note.pitch) changeNote((n) => (n.pitch = next));
  }
  const status =
    sec.mode === "chords" && !b.notes.length
      ? "Komplett akkordtakt"
      : used(b) === target(b, meter)
        ? "Takten er komplett"
        : `${Math.abs(target(b, meter) - used(b)) / 48} firedelsslag ${used(b) > target(b, meter) ? "for mye" : "mangler"}`;
  return (
    <>
      <header>
        <a className="brand" href="#">
          <Music2 size={25} />
          <span>
            noteark<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-center">Ditt neste samspill starter her</div>
        <span className="saved">● Lagret i nettleseren</span>
        <button className="primary" onClick={() => setShowExport(true)}>
          <Download size={17} /> Eksporter
        </button>
      </header>
      <div className="workspace">
        <aside className="left">
          <div className="eyebrow">BIBLIOTEK</div>
          <label>
            Mitt dokument
            <select
              value={score.id}
              onChange={(e) => switchDoc(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === score.id ? score.title : p.title}
                </option>
              ))}
            </select>
          </label>
          <div className="buttonrow">
            <button onClick={addDoc}>
              <Plus size={15} /> Nytt
            </button>
            <button onClick={() => inputRef.current?.click()}>
              <FileUp size={15} /> Importer
            </button>
          </div>
          <input
            hidden
            ref={inputRef}
            type="file"
            accept=".json"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;
                const n = validate(JSON.parse(await file.text()));
                n.id = uid();
                setProjects((p) => [
                  ...p.map((x) => (x.id === score.id ? score : x)),
                  n,
                ]);
                setScore(n);
                setSelected(n.sections[0].bars[0].id);
                setPast([]);
                setFuture([]);
                setMessage("Prosjektet er importert.");
              } catch (err) {
                setMessage((err as Error).message);
              }
              e.target.value = "";
            }}
          />
          <div className="divider" />
          <div className="eyebrow section-heading">
            SEKSJONER <span>{score.sections.length}</span>
          </div>
          <nav>
            {score.sections.map((s, i) => (
              <button
                className={"section-card " + (s.id === sec.id ? "active" : "")}
                key={s.id}
                onClick={() => {
                  setSelected(s.bars[0].id);
                  setNoteId("");
                }}
              >
                <span className="section-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    {modes[s.mode]} · {s.bars.length} takter
                  </small>
                </span>
              </button>
            ))}
          </nav>
          <button
            className="add-section"
            onClick={() =>
              commit((s) => {
                const n = section();
                s.sections.push(n);
                setSelected(n.bars[0].id);
              })
            }
          >
            <Plus size={16} /> Legg til seksjon
          </button>
          <div className="local-note">
            <strong>Musikken din, hos deg.</strong>
            <p>
              Dokumentene lagres bare i denne nettleseren. Ta en JSON-kopi for
              sikkerhetskopi eller en annen enhet.
            </p>
            <button
              onClick={() =>
                download(
                  new Blob([JSON.stringify(score, null, 2)], {
                    type: "application/json",
                  }),
                  score.title + ".json",
                )
              }
            >
              Last ned prosjekt (JSON)
            </button>
            <button
              className="subtle"
              disabled={projects.length === 1}
              onClick={() => {
                if (confirm("Slette dette lokale dokumentet?")) {
                  const ps = projects.filter((p) => p.id !== score.id);
                  setProjects(ps);
                  setScore(ps[0]);
                  setSelected(ps[0].sections[0].bars[0].id);
                  setPast([]);
                  setFuture([]);
                }
              }}
            >
              Slett dokument
            </button>
          </div>
        </aside>
        <main>
          <div className="editor-top">
            <div>
              <div className="eyebrow">NOTEVERKSTED</div>
              <h1>{score.title}</h1>
            </div>
            <div className="buttonrow">
              <button aria-label="Angre" disabled={!past.length} onClick={undo}>
                <Undo2 size={18} />
              </button>
              <button
                aria-label="Gjør om"
                disabled={!future.length}
                onClick={redo}
              >
                <Redo2 size={18} />
              </button>
              <button
                className={preview ? "chosen" : ""}
                onClick={() => setPreview(!preview)}
              >
                <Eye size={17} />{" "}
                {preview ? "Til redigering" : "Forhåndsvisning"}
              </button>
            </div>
          </div>
          {!preview && (
            <>
              <div className="palette">
                <button
                  title="Velg element"
                  className={tool === null ? "chosen" : ""}
                  onClick={() => setTool(null)}
                >
                  <MousePointer2 size={19} />
                </button>
                <span className="palette-divider" />
                {[1, 2, 4, 8, 16].map((v) => (
                  <button
                    key={v}
                    aria-label={`${rest ? "Pause" : "Note"} ${v}`}
                    className={"note-tool " + (tool === v ? "chosen" : "")}
                    draggable
                    onDragStart={(e) => {
                      setTool(v);
                      e.dataTransfer.setData("text/plain", "note");
                    }}
                    onClick={() => setTool(v)}
                    dangerouslySetInnerHTML={{ __html: renderPalette(v, rest) }}
                  />
                ))}
                <span className="palette-divider" />
                <button
                  className={rest ? "chosen" : ""}
                  onClick={() => setRest(!rest)}
                >
                  Pause
                </button>
                <button
                  className={dot ? "chosen" : ""}
                  onClick={() => setDot(!dot)}
                >
                  Punktert
                </button>
                <span className="palette-tip">
                  {tool
                    ? "Klikk i en takt for å sette inn"
                    : "Velg en note eller dra den til arket"}
                </span>
              </div>
              <div className="quick-entry">
                <div>
                  <strong>Rask innlegging</strong>
                  <span>Valgt takt · {sec.name}</span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    apply();
                  }}
                >
                  <input
                    aria-label="Rytmeuttrykk"
                    value={expr}
                    onChange={(e) => setExpr(e.target.value)}
                  />
                  <button className="primary" type="submit">
                    Sett inn rytme
                  </button>
                </form>
                <details>
                  <summary>Syntaks og tonenavn</summary>
                  <p>
                    1, 2, 4, 8, 16 = noteverdi · p4 = pause · 4. = punktert ·
                    tri(8,8,8) = triol. Skill med +. Eksempel: 8+8+2+8+8.
                  </p>
                  <p>
                    Melodi: G4:8+A4:8+H4:2+A4:8+G4:8. C4 er enstrøken C. H = B
                    natural, B = B♭. Bb4 og F#4 er eksplisitte fortegn; n gir
                    oppløsning. Rytme uten tone settes på H4.
                  </p>
                </details>
              </div>
            </>
          )}
          <div className="paper-meta">
            <span>
              A4 {score.layout.landscape ? "liggende" : "stående"} ·{" "}
              {pages.length} {pages.length === 1 ? "side" : "sider"}
            </span>
            <span>
              {preview ? "Eksportvisning" : "Klikk på en takt for å redigere"}
            </span>
          </div>
          <div className="pages">
            {pages.map((p, i) => (
              <div
                className="paper"
                key={i}
                style={{
                  aspectRatio: `${p.svg.viewBox.baseVal.width}/${p.svg.viewBox.baseVal.height}`,
                }}
              >
                <div
                  className="engraving"
                  ref={(el) => {
                    if (el) el.replaceChildren(p.svg);
                  }}
                />
                {!preview && (
                  <svg
                    className="interaction"
                    viewBox={p.svg.getAttribute("viewBox")!}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const r = e.currentTarget.getBoundingClientRect();
                      const x =
                          ((e.clientX - r.left) / r.width) *
                          p.svg.viewBox.baseVal.width,
                        y =
                          ((e.clientY - r.top) / r.height) *
                          p.svg.viewBox.baseVal.height;
                      const h = p.hits.find(
                        (h) =>
                          x >= h.x &&
                          x <= h.x + h.width &&
                          y >= h.y &&
                          y <= h.y + h.height,
                      );
                      if (h) insert(h, x, y);
                    }}
                  >
                    {p.hits.map((h) => (
                      <g key={h.barId}>
                        <rect
                          x={h.x + 1}
                          y={h.y}
                          width={h.width - 2}
                          height={h.height}
                          rx={3}
                          fill={
                            selected === h.barId ? "#2f7b6810" : "transparent"
                          }
                          stroke={
                            selected === h.barId ? "#579b86" : "transparent"
                          }
                          strokeDasharray="4 4"
                          onClick={(e) => {
                            const r =
                              e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                            insert(
                              h,
                              ((e.clientX - r.left) / r.width) *
                                p.svg.viewBox.baseVal.width,
                              ((e.clientY - r.top) / r.height) *
                                p.svg.viewBox.baseVal.height,
                            );
                          }}
                        />
                        {tool === null &&
                          h.notes.map((n) => (
                            <circle
                              key={n.id}
                              cx={n.x + 6}
                              cy={n.y}
                              r={12}
                              fill={
                                noteId === n.id ? "#31866c50" : "transparent"
                              }
                              onClick={() => {
                                setSelected(h.barId);
                                setNoteId(n.id);
                              }}
                            />
                          ))}
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            ))}
          </div>
        </main>
        <aside className="right">
          <div className="eyebrow">EGENSKAPER</div>
          <details open>
            <summary>Dokument</summary>
            {(["title", "subtitle", "composer"] as const).map((k, i) => (
              <label key={k}>
                {["Tittel", "Undertittel", "Komponist / arrangør"][i]}
                <input
                  value={score[k]}
                  onChange={(e) => commit((s) => (s[k] = e.target.value))}
                />
              </label>
            ))}
            <div className="two">
              <label>
                Toneart
                <select
                  value={score.key}
                  onChange={(e) => commit((s) => (s.key = e.target.value))}
                >
                  {keys.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                Taktart
                <select
                  value={score.meter}
                  onChange={(e) => commit((s) => (s.meter = e.target.value))}
                >
                  {["4/4", "3/4", "2/4", "6/8"].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Tempo
              <input
                type="number"
                min="20"
                max="400"
                value={score.tempo}
                onChange={(e) =>
                  commit(
                    (s) =>
                      (s.tempo = Math.min(400, Math.max(20, +e.target.value))),
                  )
                }
              />
            </label>
          </details>
          <details open>
            <summary>Seksjon</summary>
            <label>
              Navn
              <input
                value={sec.name}
                onChange={(e) =>
                  commit(
                    (s) =>
                      (s.sections.find((x) => x.id === sec.id)!.name =
                        e.target.value),
                  )
                }
              />
            </label>
            <label>
              Notasjon
              <select
                value={sec.mode}
                onChange={(e) =>
                  commit(
                    (s) =>
                      (s.sections.find((x) => x.id === sec.id)!.mode = e.target
                        .value as Mode),
                  )
                }
              >
                {Object.entries(modes).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="two">
              {(["key", "meter"] as const).map((k) => (
                <label key={k}>
                  {k === "key" ? "Toneart" : "Taktart"}
                  <select
                    value={sec[k]}
                    onChange={(e) =>
                      commit(
                        (s) =>
                          (s.sections.find((x) => x.id === sec.id)![k] =
                            e.target.value),
                      )
                    }
                  >
                    <option value="">Fra dokument</option>
                    {(k === "key" ? keys : ["4/4", "3/4", "2/4", "6/8"]).map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </label>
              ))}
            </div>
            <div className="buttonrow">
              <button
                title="Flytt seksjon opp"
                onClick={() =>
                  commit((s) =>
                    move(
                      s.sections,
                      s.sections.findIndex((x) => x.id === sec.id),
                      -1,
                    ),
                  )
                }
              >
                <ChevronUp size={16} />
              </button>
              <button
                title="Flytt seksjon ned"
                onClick={() =>
                  commit((s) =>
                    move(
                      s.sections,
                      s.sections.findIndex((x) => x.id === sec.id),
                      1,
                    ),
                  )
                }
              >
                <ChevronDown size={16} />
              </button>
              <button
                title="Kopier seksjon"
                onClick={() =>
                  commit((s) => {
                    const n = structuredClone(sec);
                    n.id = uid();
                    n.name += " (kopi)";
                    n.bars.forEach((b) => {
                      b.id = uid();
                      b.notes.forEach((n) => (n.id = uid()));
                    });
                    s.sections.splice(
                      s.sections.findIndex((x) => x.id === sec.id) + 1,
                      0,
                      n,
                    );
                  })
                }
              >
                <Copy size={16} />
              </button>
              <button
                title="Slett seksjon"
                disabled={score.sections.length === 1}
                onClick={() =>
                  commit((s) => {
                    s.sections = s.sections.filter((x) => x.id !== sec.id);
                    setSelected(s.sections[0].bars[0].id);
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          </details>
          <details open>
            <summary>Valgt takt</summary>
            <div
              className={
                "status " +
                (used(b) === target(b, meter) ||
                (!b.notes.length && sec.mode === "chords")
                  ? "complete"
                  : "")
              }
            >
              {status}
            </div>
            <div className="buttonrow">
              <button
                title="Ny takt etter valgt"
                onClick={() =>
                  commit((s) => {
                    const bars = s.sections.find((x) => x.id === sec.id)!.bars;
                    const n = bar();
                    bars.splice(bars.findIndex((x) => x.id === b.id) + 1, 0, n);
                    setSelected(n.id);
                  })
                }
              >
                <Plus size={16} />
              </button>
              <button
                title="Kopier takt"
                onClick={() =>
                  commit((s) => {
                    const bars = s.sections.find((x) => x.id === sec.id)!.bars;
                    const n = structuredClone(b);
                    n.id = uid();
                    n.notes.forEach((n) => (n.id = uid()));
                    bars.splice(bars.findIndex((x) => x.id === b.id) + 1, 0, n);
                    setSelected(n.id);
                  })
                }
              >
                <Copy size={16} />
              </button>
              <button
                title="Flytt takt bakover"
                onClick={() =>
                  commit((s) =>
                    move(
                      s.sections.find((x) => x.id === sec.id)!.bars,
                      sec.bars.indexOf(b),
                      -1,
                    ),
                  )
                }
              >
                <ChevronUp size={16} />
              </button>
              <button
                title="Flytt takt fremover"
                onClick={() =>
                  commit((s) =>
                    move(
                      s.sections.find((x) => x.id === sec.id)!.bars,
                      sec.bars.indexOf(b),
                      1,
                    ),
                  )
                }
              >
                <ChevronDown size={16} />
              </button>
              <button
                title="Slett takt"
                disabled={sec.bars.length === 1}
                onClick={() =>
                  commit((s) => {
                    const bars = s.sections.find((x) => x.id === sec.id)!.bars;
                    bars.splice(
                      bars.findIndex((x) => x.id === b.id),
                      1,
                    );
                    setSelected(bars[0].id);
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
            <button
              className="wide"
              onClick={() => {
                try {
                  const notes = fill(b, meter);
                  editBar((b) => b.notes.push(...notes));
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Fyll med pauser
            </button>
            <label>
              Opptakt (firedelsslag, 0 = vanlig)
              <input
                type="number"
                min="0"
                max="6"
                step="0.25"
                value={b.pickup / 48}
                onChange={(e) =>
                  editBar(
                    (b) =>
                      (b.pickup = Math.min(
                        288,
                        Math.max(0, +e.target.value * 48),
                      )),
                  )
                }
              />
            </label>
            <label>
              Ombrekking
              <select
                value={b.break}
                onChange={(e) =>
                  editBar((b) => (b.break = e.target.value as Bar["break"]))
                }
              >
                <option value="none">Automatisk</option>
                <option value="system">Nytt system før takten</option>
                <option value="page">Ny side før takten</option>
              </select>
            </label>
            <div className="two">
              <label>
                <input
                  type="checkbox"
                  checked={b.repeatStart}
                  onChange={(e) =>
                    editBar((b) => (b.repeatStart = e.target.checked))
                  }
                />{" "}
                Repetisjon inn
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={b.repeatEnd}
                  onChange={(e) =>
                    editBar((b) => (b.repeatEnd = e.target.checked))
                  }
                />{" "}
                Repetisjon ut
              </label>
            </div>
            <div className="two">
              <label>
                Hus
                <select
                  value={b.ending}
                  onChange={(e) => editBar((b) => (b.ending = e.target.value))}
                >
                  <option value="">Ingen</option>
                  <option value="1.">1.</option>
                  <option value="2.">2.</option>
                </select>
              </label>
              <label>
                Symbol
                <select
                  value={b.symbol}
                  onChange={(e) => editBar((b) => (b.symbol = e.target.value))}
                >
                  <option value="">Ingen</option>
                  <option value="segno">Segno</option>
                  <option value="coda">Coda</option>
                </select>
              </label>
            </div>
          </details>
          {note && (
            <details open>
              <summary>Valgt note {pitchLabel(note.pitch)}</summary>
              {sec.mode === "melody" && !note.rest && (
                <p>
                  + / −: halvtone opp / ned. Shift + / Shift −: heltone opp /
                  ned.
                </p>
              )}
              <>
                {note.triplet && (
                  <p>Triolens rytme redigeres samlet med tekstinnlegging.</p>
                )}
                <div className="buttonrow">
                  <button
                    disabled={note.rest || sec.mode !== "melody"}
                    onClick={() => transpose(1)}
                  >
                    Halvtone opp
                  </button>
                  <button
                    disabled={note.rest || sec.mode !== "melody"}
                    onClick={() => transpose(-1)}
                  >
                    Halvtone ned
                  </button>
                </div>
                <label>
                  Verdi
                  <select
                    disabled={!!note.triplet}
                    value={note.value}
                    onChange={(e) =>
                      changeNote((n) => (n.value = +e.target.value))
                    }
                  >
                    {[1, 2, 4, 8, 16].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Fortegn
                  <select
                    value={/^[A-G]([#bn])/.exec(note.pitch)?.[1] || ""}
                    onChange={(e) =>
                      changeNote(
                        (n) =>
                          (n.pitch =
                            n.pitch[0] +
                            e.target.value +
                            "/" +
                            n.pitch.split("/")[1]),
                      )
                    }
                  >
                    <option value="">Fra tonearten</option>
                    <option value="#">Kryss</option>
                    <option value="b">b</option>
                    <option value="n">Oppløsning</option>
                  </select>
                </label>
                {(["dot", "rest", "tie", "slash"] as const).map((k, i) => (
                  <label key={k}>
                    <input
                      type="checkbox"
                      disabled={k === "dot" && !!note.triplet}
                      checked={!!note[k]}
                      onChange={(e) =>
                        changeNote((n) => (n[k] = e.target.checked))
                      }
                    />
                    {
                      [
                        "Punktert",
                        "Pause",
                        "Bind til neste note",
                        "Rytmeslash",
                      ][i]
                    }
                  </label>
                ))}
                <button
                  onClick={() =>
                    editBar(
                      (b) =>
                        (b.notes = b.notes.filter((n) =>
                          note.triplet
                            ? n.triplet !== note.triplet
                            : n.id !== noteId,
                        )),
                    )
                  }
                >
                  {note.triplet ? "Slett triolgruppe" : "Slett note"}
                </button>
              </>
            </details>
          )}
          <details>
            <summary>Akkorder og anvisninger</summary>
            <label>
              Slag / underdeling
              <input
                type="number"
                min="1"
                max={capacity(meter) / 48 + 0.75}
                step="0.25"
                value={beat}
                onChange={(e) => setBeat(+e.target.value)}
              />
            </label>
            <label>
              Akkord
              <input
                value={chord}
                onChange={(e) => setChord(e.target.value)}
                placeholder="D/F#, Am7, Cmaj7"
              />
            </label>
            <button
              className="wide"
              onClick={() => {
                if ((beat - 1) * 48 >= capacity(meter) || beat < 1) {
                  setMessage("Velg et slag innenfor takten.");
                  return;
                }
                if (chord.trim())
                  editBar((b) =>
                    b.chords.push({
                      id: uid(),
                      text: chord,
                      tick: (beat - 1) * 48,
                      position: "above",
                    }),
                  );
              }}
            >
              Legg til akkord
            </button>
            <label>
              Spilleanvisning
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                list="instructions"
              />
            </label>
            <datalist id="instructions">
              {[
                "Intro",
                "Vers 1",
                "Refreng",
                "Mellomspill",
                "Solo",
                "Til toppen",
                "D.C. / Da capo",
                "D.S.",
                "Fine",
                "To Coda",
                "Spilles 2 ganger",
                "Kun trommer",
                "Bygg opp",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </datalist>
            <select
              aria-label="Plassering"
              value={position}
              onChange={(e) => setPosition(e.target.value as typeof position)}
            >
              <option value="above">Over systemet</option>
              <option value="below">Under systemet</option>
              <option value="side">Ved siden av</option>
            </select>
            <button
              className="wide"
              onClick={() => {
                if ((beat - 1) * 48 >= capacity(meter) || beat < 1) {
                  setMessage("Velg et slag innenfor takten.");
                  return;
                }
                if (instruction.trim())
                  editBar((b) =>
                    b.marks.push({
                      id: uid(),
                      text: instruction,
                      tick: (beat - 1) * 48,
                      position,
                    }),
                  );
              }}
            >
              Legg til anvisning
            </button>
            {(["chords", "marks"] as const).map((k) =>
              b[k].map((m, i) => (
                <div className="mark-edit" key={m.id}>
                  <input
                    aria-label="Rediger tekst"
                    value={m.text}
                    onChange={(e) =>
                      editBar((b) => (b[k][i].text = e.target.value))
                    }
                  />
                  <button
                    title="Slett tekst"
                    onClick={() => editBar((b) => b[k].splice(i, 1))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )),
            )}
          </details>
          <details>
            <summary>Sideoppsett</summary>
            <label>
              Retning
              <select
                value={score.layout.landscape ? "landscape" : "portrait"}
                onChange={(e) =>
                  commit(
                    (s) =>
                      (s.layout.landscape = e.target.value === "landscape"),
                  )
                }
              >
                <option value="portrait">Stående A4</option>
                <option value="landscape">Liggende A4</option>
              </select>
            </label>
            {(["barsPerLine", "margin", "scale"] as const).map((k, i) => (
              <label key={k}>
                {["Takter per system", "Marger (mm)", "Notestørrelse"][i]}
                <input
                  type="number"
                  min={[1, 8, 0.7][i]}
                  max={[6, 35, 1.5][i]}
                  step={k === "scale" ? 0.1 : 1}
                  value={score.layout[k]}
                  onChange={(e) =>
                    commit(
                      (s) =>
                        (s.layout[k] = Math.max(
                          [1, 8, 0.7][i],
                          Math.min([6, 35, 1.5][i], +e.target.value),
                        )),
                    )
                  }
                />
              </label>
            ))}
          </details>
        </aside>
      </div>
      {message && (
        <div role="status" className="toast">
          {message}
          <button onClick={() => setMessage("")}>Lukk</button>
        </div>
      )}
      {showExport && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="eyebrow">KLAR FOR NESTE ØVING</div>
            <h2>Ta med musikken.</h2>
            <p>
              {score.title} · {pages.length} A4-sider
            </p>
            <label>
              Filformat
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
              >
                <option value="pdf">PDF · vektorgrafikk</option>
                <option value="png">PNG · høy oppløsning</option>
                <option value="jpg">JPG · hvit bakgrunn</option>
              </select>
            </label>
            {format !== "pdf" && (
              <>
                <label>
                  Sider
                  <select
                    value={exportPage}
                    onChange={(e) =>
                      setExportPage(
                        e.target.value === "all" ? "all" : +e.target.value,
                      )
                    }
                  >
                    <option value="all">Alle sider som ZIP</option>
                    {pages.map((_, i) => (
                      <option key={i} value={i}>
                        Side {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                {format === "png" && (
                  <label>
                    <input
                      type="checkbox"
                      checked={transparent}
                      onChange={(e) => setTransparent(e.target.checked)}
                    />
                    Transparent bakgrunn
                  </label>
                )}
              </>
            )}
            <p>
              Sideoppsettet følger arket i forhåndsvisningen. Ingen
              redigeringskontroller blir med.
            </p>
            <div className="buttonrow">
              <button disabled={busy} onClick={() => setShowExport(false)}>
                Avbryt
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await exportScore(score, format, exportPage, transparent);
                    setMessage("Eksporten er lastet ned.");
                  } catch (e) {
                    setMessage("Eksport feilet: " + (e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Download size={16} />
                {busy ? "Eksporterer…" : "Last ned"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
async function start() {
  await document.fonts.ready;
  VexFlow.setFonts("Bravura", "Academico");
  await document.fonts.ready;
  createRoot(document.getElementById("root")!).render(<App />);
}
start().catch((e) => {
  document.getElementById("root")!.textContent =
    "Kunne ikke laste musikkfontene: " + e.message;
});
