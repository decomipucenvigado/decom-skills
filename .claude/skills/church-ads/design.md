# Design contract

Every `video/src/ads/<slug>.tsx` obeys this. `node scripts/validate.mjs` enforces
the parts a type-checker cannot (see the last section), so a broken rule fails the
delivery, it does not just look wrong.

## Component

- One file per event: `video/src/ads/<slug>.tsx`, `<slug>` exactly as in `events.json`.
- It exports `Ad`, props-driven, so any week re-renders from `events.json` alone:

  ```tsx
  import React from 'react';
  import {Destacado} from '../templates/Destacado';
  import {Estandar} from '../templates/Estandar';
  import {Virtual} from '../templates/Virtual';
  import type {TemplateProps} from '../templates/parts';
  import type {AdComponent, Plantilla} from '../types';

  const layouts: Record<Plantilla, React.FC<TemplateProps>> = {destacado: Destacado, estandar: Estandar, virtual: Virtual};

  export const Ad: AdComponent = ({event, iglesia}) => {
    const Layout = layouts[event.plantilla];
    return <Layout event={event} iglesia={iglesia} />;
  };
  ```

- Pick the layout with `event.plantilla`; never hardcode one. The orchestrator
  decides the template (`normalize.mjs`, then `overrides/<week>.json`), so an
  override changes the layout without anyone rewriting the ad. `destacado` is only
  ever chosen by an override; a designer does not pick it.
- Custom composition is allowed, built from `video/src/templates/parts.tsx`
  (`Backdrop`, `Logo`, `CornerLogo`, `MinistryTag`, `Headline`, `EventInfo`, `Cta`, `Reveal`,
  `MotifImage`, `fitSize`, `lugarVisible`) as long as every rule below still holds.
- A `headline` prop on a template may replace the title, but only with text built
  from `event.titulo` / `event.ministerio`. No tagline that `events.json` does not
  contain.

## Format

- 16:9, 1920x1080, 30 fps, from `brand.video`. An ad never sets width, height or fps.
- Lay out with `useLayout()`: multiply 1080-based sizes by `u`, and branch on
  `portrait` for anything that would break at 9:16. No hardcoded 1920/1080 geometry;
  use flex and `inset` so a 9:16 render stays a config change.
- The scene length is not the ad's business, so the ad must look right at any length.
  In the reel it comes from the voiceover's per-character timing (`voz.alineacion.json`),
  cut in the pauses by `scripts/core/render-plan.mjs` and passed as props;
  `calculateWeeklyReel` only sums them and checks the mp3 against that timing. A
  standalone `EventAd` clip (`calculateEventAd`) lasts lead + its slice of the narration
  + tail. Never write `durationInFrames` with a number.

## Facts

Every fact on screen comes from `event` or `iglesia`, and nothing else exists.

- Date: `event.fechaTexto`. Time: `event.horaTexto`. Place: `event.lugar`. Title:
  `event.titulo`. Audience tag: `event.ministerio`. Call to action:
  `iglesia.llamadoAccion`. The church name reaches the screen only through `Logo`:
  never type it, and never read `iglesia.nombre` (by property or by destructuring) or call
  `useIglesia()` in an ad. `validate.mjs` rejects all of these.
- Place, on screen, only when it says something the default doesn't already: a place
  equal to `iglesia.lugarPorDefecto` is dropped, the same way `script.md` § Place
  skips it in the narration — repeating "Templo" on every ad is filler. Get it through
  `lugarVisible(event, iglesia)` (`templates/parts.tsx`), never `event.lugar` directly,
  whether in `EventInfo` or in a custom pill/chip.
- Don't let `event.titulo` restate what `event.ministerio` already shows: when a
  ministry is set, its `MinistryTag` is the ad's own audience tag and the narration
  names it too (script.md), each once — a title built as "Culto dirigido por X" then
  says the ministry's name a second time on the same frame, and puts "dirigido por" on
  screen right where the voice is about to say it out loud. That phrasing belongs to the
  spoken line, not the image. This is the same filler the place rule above avoids, just
  for who leads the event instead of where it is; a `headline` prop built at read time
  (`lectura.json`'s `recurrentes`, see the skill) is where this gets decided, not the ad
  component.
- Never type a date, weekday, month, clock time or place into the file, even
  "just for the layout". Use the sample data in `video/src/sample.ts` to preview.
- No time (`hora` is `null`): the time row is simply absent. Do not write "hora por
  confirmar", "próximamente" or a placeholder. Same for a `null` or default place, or a
  `null` call to action: `EventInfo` and `Cta` already render nothing.
- On-screen text is Spanish (Colombia), addressing the reader as `tú`.

## Brand

`video/src/brand/tokens.ts` is the single source of truth.

- Colors: `brand.color.*`. No `#hex`, `rgb()` or `hsl()` in an ad. For a translucent
  color use `alpha(brand.color.x, 0.4)`.
- Type: `brand.font.display` / `brand.font.body` and the `brand.type` scale. Fonts
  are vendored under `brand/fonts/` and registered once by `brand/fonts.ts`; do not
  import web fonts.
- Spacing: `brand.space.*`. The logo is drawn by `Logo` (`CornerLogo` in the left-aligned
  layouts). While `brand.logo` is null, `Logo` draws the church's name from `church-info.md`
  as a wordmark instead, so a church without a logo still names itself on screen; it finds
  the name itself, an ad passes it nothing. Keep it on a flat field: no shapes behind it,
  nothing over it.
- Colors and logo are the IPUC's official identity; `brand/corporate-brand.md` holds
  the logo, naming and layout rules (flat background under the logo, nothing over it,
  full name never replaced by "IPUC"). The fonts are still placeholders. Design
  against the token names, never against what they currently look like.

## Motion

- Drive everything with `useCurrentFrame()` + `interpolate()` (or `spring()`); the
  helpers `useEnter` and `Reveal` do this. CSS `transition`, `animation`,
  `@keyframes` and Tailwind `animate-*` do not render and are rejected.
- The still `fotograma.png` is taken about 60% into the clip. It is only a frame for
  checking the video, not the event's image (`ad.png` comes from the week's Claude
  Design canvas). All text must be fully in by then. In a standalone clip the voiceover starts after `brand.motion.leadSeconds`;
  inside the reel the scene is cut in the pause before its line, so the speech starts
  at the scene boundary. Either way the key information should be readable well before
  the narration ends.

## Legibility

- A long title must still fit: use `Headline` (it applies `fitSize`) or do the same.
- Keep content inside the `brand.space.xl` margin of the frame.
- Text sits on a solid or shaded area, never straight on a busy shape.
- A decorative element placed near text (an accent mark, a spark, a flourish) must sit
  in the flow beside or around the text's own box, not at a fixed pixel offset guessed
  from one title. `event.titulo` comes from `events.json` and its length changes every
  week (an override or a `church-info.md` edit can make a recurring service's title
  longer or shorter); an offset tuned for one title's line count will drift into
  neighbouring text for another. This broke a real week's render (2026-W39): a "spark"
  pinned above a giant subject word intruded on the lead-in line once the lead-in grew
  longer.

## What `validate.mjs` rejects in an ad file

The check reads every line, comments included, so keep comments free of literals.

| Rule | Trips on |
|---|---|
| `hora-literal` | `7:00`, `7 pm` — render `event.horaTexto` |
| `fecha-literal` | a weekday, or `de septiembre` — render `event.fechaTexto` |
| `color-literal` | `#RRGGBB`, `rgb(`, `hsl(` — use tokens |
| `css-animacion` | `transition:`, `animation:`, `@keyframes`, `animate-*` |
| `text-stroke` | `WebkitTextStroke`, `-webkit-text-stroke` — fakes an outline; renders broken seams at hero scale (§ Motion says why), use weight/scale/skew instead |
| `duracion-fija` | `durationInFrames={90}` |
