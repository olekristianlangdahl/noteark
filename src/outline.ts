import { create } from "fontkit";
import { Bravura, Academico } from "./fonts";
const fonts = new Map<string, any>();
function font(name: string) {
  if (!fonts.has(name)) {
    const raw = atob((name === "Bravura" ? Bravura : Academico).split(",")[1]);
    fonts.set(name, create(Uint8Array.from(raw, (c) => c.charCodeAt(0))));
  }
  return fonts.get(name);
}
export function outline(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  for (const t of clone.querySelectorAll("text")) {
    let parent: Element | null = t;
    let family = "";
    let size = "";
    while (parent) {
      family ||= parent.getAttribute("font-family") || "";
      size ||= parent.getAttribute("font-size") || "";
      parent = parent.parentElement;
    }
    const name = family.includes("Bravura")
      ? "Bravura"
      : family.includes("Academico")
        ? "Academico"
        : "";
    if (!name) continue;
    const f = font(name);
    const glyphs = f.layout(t.textContent || "");
    const px = parseFloat(size || "13") * (size.endsWith("pt") ? 4 / 3 : 1);
    const scale = px / f.unitsPerEm;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    for (const a of t.attributes)
      if (!["font-family", "font-size", "x", "y"].includes(a.name))
        group.setAttribute(a.name, a.value);
    group.setAttribute("stroke", "none");
    let x = parseFloat(t.getAttribute("x") || "0"),
      y = parseFloat(t.getAttribute("y") || "0");
    glyphs.glyphs.forEach((glyph: any, i: number) => {
      const pos = glyphs.positions[i];
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", glyph.path.toSVG());
      p.setAttribute(
        "transform",
        `translate(${x + pos.xOffset * scale},${y - pos.yOffset * scale}) scale(${scale},${-scale})`,
      );
      group.append(p);
      x += pos.xAdvance * scale;
    });
    t.replaceWith(group);
  }
  return clone;
}
