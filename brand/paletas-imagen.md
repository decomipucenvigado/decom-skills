# Palettes for the event images

The event images (`out/<week>/<slug>/ad.png`) are made in Claude Design, one artboard per
event, and may leave the IPUC manual's palette: each kind of event has its own color, the
same every week. The video does not: `clip.mp4` and `semana.mp4` keep the manual's palette
from `video/src/brand/tokens.ts`. This file is free text read by the orchestrator; no code
parses it, so edit it in plain words.

## Which palette an event gets

By the event's ministry when it has one, else by the words of its title, else the default.
An event that fits two kinds takes its ministry's kind, otherwise the first row it matches
in the table's order. The final report says which kind each event took. Rows are checked from the top, so a more specific group sits above a broader one: an event for the young women's group ("Damas Jóvenes") is Damas, not Jóvenes.

| Kind | When | Field | Accent |
|---|---|---|---|
| Damas | ministry Damas Dorcas; title says damas (this includes "Damas Jóvenes") | magenta | cream |
| Jóvenes | ministry Jóvenes or Adolescentes; title says jóvenes, juvenil or adolescentes | violet | gold |
| Evangelismo | ministry Evangelismo; title says evangelístico, evangelismo or campaña | amber | navy |
| Enseñanza | title says oración, enseñanza or escuela dominical | teal | white |
| Ayuno | title says ayuno | deep indigo | muted gold |
| General | everything else | IPUC blue `#00338D` | cyan `#009FDA` |

Pick the exact shades in the canvas so that white text has strong contrast on the field.

## What does not change

- Facts only from `events.json`: the title, ministry, date, time (if the event has one),
  place (only if it is not the church's default place) and the church's call to action.
  Nothing else is written on an artboard: no slogan, no invented detail. The export audit
  rejects any other word or number.
- The church name is never typed; the logo carries it. Use the logo variant that suits the
  field (`IPUC_COLOR para fondo oscuro.png` on dark fields, `IPUC_COLOR para fondo claro.png`
  on light ones), unaltered, on a flat panel with no gradient, glow or pattern behind it.
- Spanish (Colombia), addressing the reader as `tú`.
- 16:9, exactly 1920x1080 per artboard, with `data-slug="<slug>"` on its root element.
- Vary the composition from event to event: the giant word, the shapes, where the date sits.
  Two events of one kind share a color, not a layout.
