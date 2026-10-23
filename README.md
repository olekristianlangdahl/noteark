# Noteark

Norsk, nettleserbasert noteskriving for band. React, TypeScript, Vite og VexFlow 5. Ingen backend, konto, betalte API-er eller automatisk opplasting av noteark.

## Kjør lokalt

Node 22.17 eller nyere (22-serien anbefales).

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

## Arbeidsflyt

Velg seksjon og notasjon: akkordskjema, énlinjet rytme eller melodi med g-nøkkel. Velg note/pause fra paletten og klikk i takten, eller dra noten inn. X-plassering velger nærmeste musikalske innsettingspunkt; i melodimodus bestemmer Y-plassering tonehøyde. Velg pekeren for å velge noter og endre tonehøyde, verdi, fortegn, punktering, bindebue eller slash i egenskapspanelet.

Rask innlegging erstatter valgt takt først når hele uttrykket er gyldig:

- `8+8+2+8+8`: komplett 4/4.
- `p4+4.+8+tri(8,8,8)`: pause, punktering og triol.
- `G4:8+A4:8+H4:2+A4:8+G4:8`: melodi.
- C4 = middle C. H4 = internasjonal B natural, B4 og Bb4 = B-flat. F#4 er eksplisitt kryss og Fn4 er oppløsning.
- Internt brukes A–G, eksplisitte fortegn og oktav, eksempelvis `B/4`, `Bb/4`.

Varigheter bruker 192 heltallsticks per helnote. Ufullstendige/overfylte takter bevares og varsles; ingen noter slettes automatisk. Opptakt oppgis i firedelsslag. Tomme akkordtakter er komplette. Trioler redigeres samlet via tekstfeltet.

Akkorder og tekster forankres til en takt og ticks fra taktstart. Slagfeltet i egenskapene teller firedeler også i 6/8 (1.5 er andre åttendel). Seksjoner har egne overskrifter, valgfri toneart og taktart. Antall takter per system er en øvre grense; tette takter brekkes tidligere for å gi noter plass.

## Eksport og lagring

Redigering, forhåndsvisning og eksport bruker samme SVG-layout. A4 stående/liggende, marger og notestørrelse kan velges i Sideoppsett. PDF lastes ned direkte med vektorgrafikk. Musikkfontene konverteres til vektorbaner, så de ikke mangler på mottakerens maskin. PNG/JPG rendres med 3× sideoppløsning; PNG kan være transparent. Velg én bildeside eller alle som ZIP.

Flere lokale dokumenter lagres i localStorage. Last ned versjonert JSON for sikkerhetskopi og flytting; import valideres før bruk. Lokal lagring er avhengig av denne nettleseren og kan slettes av nettleseren. Angre/gjør om gjelder gjeldende økt (opptil 100 endringer).

## GitHub Pages

GitHub Actions tester og bygger main, og publiserer dist. Aktiver Settings → Pages → Source: GitHub Actions. Vite bruker relative ressursadresser (`base: './'`) som fungerer under `/noteark/`. Appen har ingen rutebaserte undersider, slik at vanlig oppfriskning ikke krever SPA-omskriving. Avhengigheter er låst i package-lock.json. Brukerprosjekter lagres aldri i repoet.

## Verifikasjon og begrensninger

Automatiske modelltester dekker korrekte/overfylte rytmer, pauser, punkteringer, trioler, ugyldig syntaks uten mutasjon, norske toner/oktaver, utfylling og JSON-rundtur/importvalidering. Nettleserkontroller og eksportkontroller dokumenteres i QA.md.

Første versjon har én stemme per takt og enkeltnoter, ingen polyfoni, lydavspilling, MIDI, MusicXML eller automatisk D.C./D.S.-tolkning. Bindebuer går til neste note i samme takt. Trioler kan velges, men gruppens rytme redigeres via tekst. Det er ikke implementert fri flytting av eksisterende noter med drahåndtak; tonehøyde endres med opp/ned i panelet. Anvisninger kan legges til per takt/slag; seksjonstekst er seksjonsnavnet. Lange tekstmengder og ekstremt tette/overfylte takter bør fordeles på flere takter og kontrolleres i forhåndsvisningen. Appen er laget først for datamaskin og nettbrett, ikke telefon.

Fontdata er hentet fra VexFlow-distribusjonen. VexFlow er MIT-lisensiert; Bravura og Academico er under SIL Open Font License. Se licenses/.

## Dokumentasjon brukt

- https://github.com/vexflow/vexflow/wiki/Tutorial
- https://react.dev/reference/react-dom/client/createRoot
- https://vite.dev/guide/static-deploy.html
