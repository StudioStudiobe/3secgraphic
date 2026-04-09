# 3 Second Graphic

A browser-based parametric poster tool that operates in two registers: the archival logic of <a href="https://anothergraphic.org" target="_blank">Another Graphic</a> and the site-specific demands of the roadside <a href="https://3sec.gallery/" target="_blank">3 sec Gallery</a> (Breda, The Netherlands).

## Background

<a href="https://studiostudio.be" target="_blank">Studio Studio</a> is a Ghent, Belgium based graphic and web design practice founded in 2014. We curate Another Graphic, a community-driven digital archive focused on typography, and recently published our first research publication, <a href="https://anothergraphic.org/product/new-glyphs-new-writings/" target="_blank"><em>New Glyphs, New Writings</em></a>. The invitation to 3 sec Gallery emerged from that ongoing editorial and typographic research.

We started from the logic established for the Another Graphic publication: read the archive, distill a research question, investigate, give the findings form using the Another Graphic visual identity, and publish the result. We applied the same sequence to the poster series.

For context we returned to the archive as both source and method. We carried forward parts of its visual logic: the grid and the Monotesk typeface (developed for Another Graphic). The parking-site setting of the 3 sec Gallery defined the brief: two viewing speeds and two distances. Drivers read in a glance; pedestrians linger.

## The tool

Because the deadline was short and we needed a complete series, we developed a graphic tool based on this framework. A parametric grid engine governs layout, scale, spacing, rhythm, and density while staying flexible. To fulfill the site-specific brief we work with antonyms, translated into macro text and micro text — integrated in the tool together with a tight set of controls: size, contrast, columns, rows. Each composition can be customized while the system remains cohesive.

At speed the macro letter reads instantly; up close the microtype resolves into layered detail. On export the tool places a slim frame around the artwork that prints the parameters used to generate the composition, making every poster fully reproducible from its settings.

## The poster series

To generate the series we co-wrote a sentence based on antonyms:

> *We choose light open near paths to build and give today now.*

Each letter of that sentence is set in macrotype on one poster. The antonym is set in microtype within the letter — for example, the "W" of "We" is set from "They," the "C" of "Choose" from "Reject." The monochrome palette provides a visual analogue to the logic of antonyms.

The final result balances speed and stillness. The logic and constraints embedded in the tool ensure cohesion, while its flexibility invites variation and experimentation. By adapting the restrictions or adding more parameters, that cohesion can be modulated to produce entirely new poster series and further iterations.

## Features

- Parametric grid engine with adjustable columns, rows, and density
- Macro text (large-scale mask/clipping shape) and micro text (small-scale fill)
- Grid styles: lines or dots, with configurable thickness
- Intersection decorations: circles, squares, triangles, crosshairs
- Cell background color fills
- Layer-based composition with drag-and-drop reordering
- Per-layer jitter for organic variation
- Randomize per layer for quick exploration
- Adjustable canvas dimensions
- Zoom and pan controls
- SVG export with parameter frame for reproducibility
- Color pickers powered by <a href="https://simonwep.github.io/pickr/" target="_blank">Pickr</a>
- Desktop-only (shows a message on mobile viewports)

## Tech stack

- <a href="https://p5js.org/" target="_blank">p5.js</a> — canvas rendering and drawing
- <a href="https://opentype.js.org/" target="_blank">opentype.js</a> — font parsing for precise text paths and SVG export
- <a href="https://simonwep.github.io/pickr/" target="_blank">Pickr</a> — color picker UI
- Vanilla HTML/CSS/JS — no build step, no frameworks

## Getting started

1. Clone the repository:
   ```
   git clone https://github.com/StudioStudiobe/3secgraphic.git
   ```
2. Open `index.html` in a modern desktop browser.

No install or build step required. All library dependencies are loaded via CDN.

Or visit the live version at <a href="https://studiostudio.be/3secgraphic" target="_blank">studiostudio.be/3secgraphic</a>.

See the full project portfolio at <a href="https://studiostudio.be/portfolio/3sec-gallery/" target="_blank">studiostudio.be/portfolio/3sec-gallery</a>.

## Project structure

```
├── index.html          # Main HTML — layout, panels, canvas container
├── script.js           # Core application logic — layers, rendering, SVG export
├── style.css           # All styling — panel, controls, canvas, color picker overrides
├── mobileViewport.js   # Mobile detection and desktop-only warning
├── fonts/
│   └── SpaceMono-Regular.ttf
└── LICENSE             # GNU GPL v3
```

## Font notice

The live version at <a href="https://studiostudio.be/3secgraphic" target="_blank">studiostudio.be/3secgraphic</a> uses **Monotesk Regular** by <a href="https://typotypo.be" target="_blank">TypoTypo</a>, developed for Another Graphic. Because Monotesk is a commercial typeface, it has been replaced in this public repository by <a href="https://fonts.google.com/specimen/Space+Mono" target="_blank">**Space Mono**</a> (Regular), an open-source monospaced font by Colophon Foundry, licensed under the <a href="https://scripts.sil.org/OFL" target="_blank">SIL Open Font License</a>.

If you want to use Monotesk in your own projects, you can purchase a license at:

- **Website:** <a href="https://typotypo.be" target="_blank">typotypo.be</a>
- **Email:** contact TypoTypo directly via their website for licensing inquiries

## License

The source code is licensed under the [GNU General Public License v3.0](LICENSE).

The Space Mono font is licensed under the <a href="https://scripts.sil.org/OFL" target="_blank">SIL Open Font License</a>.

## Author

<a href="https://studiostudio.be" target="_blank">Studio Studio</a> — Ghent, Belgium
