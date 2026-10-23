# Verifikasjon – 23. oktober 2026

## Automatiske kontroller

`npm test`: 6 tester bestått. Riktig 4/4 (192 ticks), overfylt 4/4 (288), punktering, pauser, trioler, ugyldig syntaks uten mutasjon, norske tonenavn og oktaver, utfylling, taktarter og JSON-rundtur/importvalidering.

`npm run build`: TypeScript og Vite produksjonsbygg bestått. Bundelen inkluderer musikkfonter. Vite varsler om stor hovedbundle (fonter og eksportbiblioteker); ingen byggefeil.

## Nettleser og eksport

Kontrollert i nettleseren via appens faktiske kontroller:

- Eksempel med tre notasjonstyper, akkorder og seksjoner vises med ekte VexFlow-grafikk.
- `8+8+1+8+8` viser «2 firedelsslag for mye» og beholder notene.
- `tri(8,8,8)+p4+4.+8` vises med trioltall, pause og punktering, komplett takt.
- Ugyldig uttrykk `8+feil` gir leselig feil og beholder innholdet.
- Visuell firedelsinnlegging i meloditakt, endring av tone, angre og gjør om fungerer.
- Oppfriskning gjenoppretter dokumentet med den visuelle innleggingen og sideskiftet.
- Manuelt sideskift lager flere sider. Akkorder og anvisninger følger taktene ved automatisk ombrekking.
- PDF med flere A4-sider er lastet ned fra eksportdialogen, åpnet med Poppler og visuelt inspisert. Musikktegn er vektorbaner. Kontrollene er ikke med.
- To transparente PNG-sider er lastet ned som ZIP, pakket ut og åpnet. JPG-side er lastet ned og visuelt inspisert med hvit bakgrunn.
- SVG-skalering og dobbelttegning av flagg ved bjelking er rettet under testen. PDF-tekst har `stroke=none`. Tette takter brekkes før de kolliderer med neste takt.

## Kjente grenser

Se README.md. Ingen avspilling, polyfoni eller MusicXML/MIDI. Bindebuer innenfor samme takt. Ekstreme mengder tekst eller overfylte takter krever oppdeling og kontroll av forhåndsvisning.

## Publisert miljø

GitHub Actions fullførte tester, bygg og deploy. Appen er åpnet på https://olekristianlangdahl.github.io/noteark/ og viser eksempelarket med to sider og innlastede musikkfonter under repository-base-pathen. Vanlig oppfriskning kontrolleres i samme URL.

## Hurtigtaster for tonehøyde

+ og - flytter valgt meloditone én halvtone, Shift med tastene flytter to halvtoner. Norsk Shift+ (? på plusstasten), Shift- (_), numerisk tastatur, toneart, eksplisitte fortegn og oktavgrenser dekkes av to nye tester. Totalt åtte tester bestått. Nettlesertest: G4 → G#4 → A#4 → A4 → G4 ved +, Shift+, -, Shift-. Skrivefelt, forhåndsvisning og eksportdialog er unntatt hurtigtastene.
