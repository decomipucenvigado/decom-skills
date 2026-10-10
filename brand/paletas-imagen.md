# Palettes for the event images

The event images (`out/<week>/<slug>/ad.png`) are made in Claude Design, one artboard per
event, and may leave the IPUC manual's palette: each kind of event has its own color, the
same every week. The video does not: `clip.mp4` and `semana.mp4` keep the manual's palette
from `video/src/brand/tokens.ts`. This file is free text read by the orchestrator; no code
parses it, so edit it in plain words.

## Which palette an event gets

By the event's ministry when it has one, else by the words of its title, else the default.
A ministry with no row in the table counts as none: go by the title's words, then General.
An event that fits two kinds takes its ministry's kind, otherwise the first row it matches
in the table's order. The final report says which kind each event took. Rows are checked
from the top, so a more specific group sits above a broader one: an event for the young
women's group ("Damas Jóvenes") is Damas, not Jóvenes, unless its ministry puts it in
another kind (the ministry is checked first).

| Kind | When | Field | Accent |
|---|---|---|---|
| Damas | ministry Damas Dorcas; title says damas (this includes "Damas Jóvenes") | magenta `#8A1C5C` | cream `#F8E8D4` |
| Jóvenes | ministry Jóvenes or Adolescentes; title says jóvenes, juvenil or adolescentes | violet `#4A1A8C` | gold `#F2B53A` |
| Evangelismo | ministry Evangelismo; title says evangelístico, evangelismo or campaña | amber `#F5A623` | navy `#0D2A5E` (also the text) |
| Enseñanza | title says oración, enseñanza or escuela dominical | teal `#0B6668` | pale teal `#D5F0EC` |
| Ayuno | title says ayuno | deep indigo | muted gold |
| General | everything else | IPUC blue `#00338D` | cyan `#009FDA` |

These are the shades the W40 images used; keep them, so each kind's color is the same
every week. Ayuno has not been used yet: pick its shades once, then record them here.
Text is white on the dark fields and navy `#0D2A5E` on the amber field.

## What does not change

- Facts only from `events.json`: the title, ministry, date, time (if the event has one),
  place (only if it is not the church's default place) and the church's call to action.
  Nothing else is written on an artboard: no slogan, no invented detail. The export audit
  rejects any other word or number.
- Show those strings word for word as `events.json` writes them (capitals may change): an
  abbreviation such as "sáb." fails the audit. An event with no time shows no clock time.
  A decorative giant word (such as a "Culto" that bleeds off the edge) must itself be one
  of those words.
- Keep each time and date on one line (`white-space: nowrap`) inside a box wide enough for
  it: the export refuses a time or date that runs out of its box.
- Images only as `<img>`. No text through CSS `content`, form fields or iframes, and no
  text outside the artboards: the export refuses them, because its audit cannot read them.
- The church name is never typed; the logo carries it. The logo variant follows the color
  of the panel it sits on (`brand/logo/IPUC_COLOR para fondo oscuro.png` on a dark one,
  `brand/logo/IPUC_COLOR para fondo claro.png` on a light one), unaltered, on a flat panel
  with no gradient, glow or pattern behind it.
- Spanish (Colombia), addressing the reader as `tú`.
- 16:9, exactly 1920x1080 per artboard, with `data-slug="<slug>"` on its root element.
- Vary the composition from event to event: the giant word, the shapes, where the date sits.
  Two events of one kind share a color, not a layout.
