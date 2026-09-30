# Creative levels

`design.md` holds the rules that never move: tokens only, facts only from `events.json`,
the logo on a flat panel, Spanish with `tú`. This file decides **how much creativity an
ad gets and how to spend it**. Read it after `design.md`, pick a level for your event
(§ 1), and build to that level. Every rule of `design.md` still holds at all three.

The levels come from how the church's own designers work. They have five reference
pieces (§ 8); the images are not in the repo, so each is described in words there.

## 1. Pick the level

Take the first match. Decide from `events.json` only, never from a guess about what the
event is. If two seem to fit, or you cannot tell, take the more sober one (the higher
number is the bolder one).

| Level (`nivel`) | Pick it when | Look |
|---|---|---|
| **3 `juvenil`** | `ministerio` names a youth group (Jóvenes, Adolescentes) or the title says *juvenil* / *jóvenes* / *adolescentes* | Joyful and attractive for young people: big, energetic, warm |
| **2 `tematico`** | Not youth, and either `plantilla` is `destacado` (a person marked it special) or the title names a themed edition or a subject of its own (a family service, a campaign, a retreat), not a regular service under its usual name | The subject shown with a motif image |
| **1 `institucional`** | Everything else, above all a regular service under its usual name (a prayer service, Sunday school) | The corporate brand manual, as written |

An `origen` of `recurrente` means there is no calendar card at all: the church's own
recurring schedule placed this event, so it is by definition a regular service under its
usual name — `institucional`, unless `ministerio` names a youth group. A card
(`origen: "calendario"`) is never downgraded by its `horaFuente`: even one that took the
recurring service's own time (the orchestrator resolved an overlap doubt that way) has its
own title, and a themed edition of the regular slot is still judged by that title, the same
as any other event (ad2 is a family service in the Sunday-school slot, and it is
`tematico`).

Audience beats recurrence: a weekly youth prayer hour is still `juvenil` (reference ad3).
If the title's meaning is unclear (a nickname, an acronym) do not guess it: judge by
`ministerio`, and use that ministry's cached motif image (§ 6), never an invented one.

`plantilla` is the structure and the level is the finish. A `virtual` event still reads
as online and a `destacado` one keeps its hero scale, whatever the level.

## 2. The three levels at a glance

| | 1 `institucional` | 2 `tematico` | 3 `juvenil` |
|---|---|---|---|
| Idea | Sober, trustworthy: the manual | One idea: the event's subject, as a motif image | Energy: the audience is young |
| Build | The `design.md` wrapper: `<Layout>` chosen by `plantilla` | Custom composition from `parts.tsx` plus one large motif | Custom composition from `parts.tsx` plus motif, icon chips |
| Type | `Headline` as is | Two sizes: a small lead-in, the subject word at `hero` scale | Uppercase, weight 800, tight tracking, one giant word, a slight skew |
| Color | Field, white type, cyan secondary, gold as one small mark | The cached motif's own navy-to-gold tones, tints of `primary`, gold highlight | Dark field, gold and cyan as the two pops, white type. **No new hues** |
| Motif | None, or one tonal texture | Full-bleed, faded toward the text side | Full-bleed behind everything; its own silhouettes and warm gold glow |
| Motion | Calm `Reveal` stagger | Motif springs in, then a very slow drift | Snappy: springs with overshoot, 4 to 6 frames between elements |
| Density | Title, info, call to action | Title, info, call to action, motif | The same content, more graphic devices. Never more text |

## 3. Level 1: `institucional`

This is the manual: a flat dark-blue field, the logo, restrained type, little text. The
wrapper in `design.md` is already a complete Level 1 ad, and the three layouts
(`Estandar`, `Virtual`, `Destacado`) are all this level. Deliver it as it is: your work on
this event is then its script and voice. Choosing this level is not an obligation to decorate.

- One optional extra: a single tonal motif behind the title as texture, in `surface` or
  `primary` at 0.25 alpha or less, like the faded collage in ad5. Skipping it is correct.
- Gold marks one thing (the tag, a rule). It is an accent, never a background.
- Motion is `Reveal`. Nothing loops, nothing bounces.

## 4. Level 2: `tematico`

The event has a subject, so show it. Place one large motif image (§ 6) for a word in the
`titulo` or `ministerio`: `familia.png` for a family talk, `oracion.png` for a prayer,
`evangelismo.png` for a campaign.

- Field: the cached motif (§ 6) fills the whole frame — there is no separate CSS gradient
  to build. White type is weak on the image's bright glow, so fade the motif toward the
  text side with `MotifImage`'s `fadeFrom` and let a flat `brand.color.background` show
  through there instead. No cached category matches the subject: skip `MotifImage`
  entirely and use a flat `brand.color.background` field (§ 6's table, "anything else") —
  never force-fit an unrelated image.
- Composition: the motif reads on one side, the text block on the other (ad2), from one
  full-bleed `MotifImage` faded toward the text — never a separate boxed or medallioned
  image (§ 6 explains why). Text still never sits directly on the image unless it has a
  solid or shaded panel under it (`design.md` § Legibility).
- Title: split it into words from the title itself, a small lead-in and the subject word
  large (ad2 sets "Culto de" small over a huge "Familias"). Only the words the record has.
- Info: date and time may share one pill (ad2). A null time or place drops its part,
  and so does a place equal to `iglesia.lugarPorDefecto` (`design.md` § Facts) — use
  `lugarVisible(event, iglesia)`, never `event.lugar`.
- Motion: `MotifImage` (§ 6) already fades the image in over the first frames and drifts it
  slowly for the rest of the scene; there is nothing to add.

## 5. Level 3: `juvenil`

Make it joyful and attractive to a young audience, using the palette only (`tokens.ts`
does not change). The energy comes from scale, angle, shape and motion, not from new colors.

- **Type.** Uppercase, `brand.font.display`, weight 800, tight tracking. One word at
  `brand.type.hero` scale or larger and everything else far smaller (ad1's giant
  "Jóvenes"). A `skewX` of a few degrees on the giant word adds attitude; the weight and
  scale alone carry the rest — do not fake an outline with `WebkitTextStroke`: at this
  scale and weight Chromium's text-stroke renders spurious triangular seams inside the
  letterforms (self-intersecting stroke geometry at sharp glyph vertices), and
  `ad-source.mjs` rejects it (`text-stroke`) for exactly that reason. Brush lettering is
  not available: only Montserrat is vendored, and fonts cannot be imported.
- **Color.** Keep at least 60% of the frame on the dark field. Gold and cyan are the only
  pops. Where the examples use pink or orange, use gold or cyan.
- **Motif.** The cached `jovenes.png` or `evangelismo.png` image (§ 6), placed full-bleed
  behind everything with `MotifImage` — its own silhouettes and warm gold glow already read
  as ad3's glow or ad4's sunrise. Nothing to draw.
- **Info chips.** Date and time as outlined pills (ad1), or an icon row (ad3, ad4) with a
  drawn calendar, clock and pin, each heading its own chip. An icon exists only for a field
  the record has: no time, no clock chip. The pin chip uses `lugarVisible(event, iglesia)`
  (`design.md` § Facts): no chip when the place is the default one.
- **Motion.** Headline words spring in one by one with slight overshoot, the motif floats
  a few pixels. Everything must be in by 60% of the clip.
- **Tone.** Joyful is not flippant: no jokes, no slang, no emoji. The manual asks for a
  serious and trustworthy voice, and prayer and worship are sincere.

## 6. The motif: a cached image

The pipeline has no photos, and a designer does not draw the motif, or any other figure or
decorative vector, and does not generate an image either. **Illustration comes only from a
cached, ElevenLabs-generated background image, never from hand-drawn SVG or CSS shapes** —
that was tried (a drawn crowd, a brush band, sparks) and it read as amateurish every time.
The only exception is a small functional glyph with no illustrative ambition, like the
calendar/clock/pin icons of a Level 3 info chip (§ 5): a plain line icon naming a field is
not a "figure", the same way a corporate manual uses simple iconography beside its type.

The orchestrator keeps one background image per category, checked in under
`video/public/motifs/<categoria>.png`:

- `familia.png`
- `oracion.png`
- `jovenes.png`
- `evangelismo.png`
- `alabanza.png`
- `escuela-dominical.png`
- `bautismo.png`

Each is a flat-vector-illustration-style, deep-navy background with an anonymous silhouette
motif in cyan/pale-blue tones and a warm gold glow, no text, no logo, and generous negative
space in the upper two-thirds for the title to sit over. **This is not generated once and
forgotten**: the orchestrator asks the person, once per run at Checkpoint 1 (`SKILL.md`
step 4), whether to keep the saved images or generate fresh ones this week — generating
costs money, the same as the voice, so the default when they say nothing is to keep what is
saved. Either way, an `ad-designer` subagent never generates or edits these images itself —
there is no image-generation tool available to it anyway, and doing so per event would defeat
the point of a shared, reviewed set (`CLAUDE.md` hard rule 4, the same reason TTS runs once
for the week). Your job as a designer is only to pick the right cached filename for your
event and place it with `MotifImage`.

| The title or ministry says | Use this cached image |
|---|---|
| familia, familias | `motifs/familia.png` |
| oración, orar | `motifs/oracion.png` |
| jóvenes, juvenil | `motifs/jovenes.png` |
| evangelismo, campaña | `motifs/evangelismo.png` |
| alabanza, adoración | `motifs/alabanza.png` |
| escuela dominical, enseñanza | `motifs/escuela-dominical.png` |
| bautismo | `motifs/bautismo.png` |
| anything else | No motif: a flat `brand.color.background` field. Do not invent a subject |

**`MotifImage`** (`video/src/templates/parts.tsx`) is how you place a cached image. It takes
`src` (`staticFile('motifs/<categoria>.png')`) and `fadeFrom` (`'top' | 'left' | 'right' |
'none'`, default `'top'`): it renders the image full-bleed, locks its tone to the brand
palette with a multiply tint, and masks it so a flat field shows through on the named side.
It already handles the entrance and the slow drift; there is nothing left to animate.

**Always full-bleed, at every level — never boxed.** A motif contained to a box next to the
text (a fixed-size container, a directional fade on just that box, a radial fade dissolving
it into a medallion) was tried both ways and rejected both times: a hard-edged box read as a
pasted-in photo, and the softened medallion still read as a shape floating in empty space
instead of a background. `MotifImage` has no box mode for exactly this reason. Pick the
`fadeFrom` side that matches where your text sits instead:

- **Text across the top or one whole side, image reads as the rest of the frame** (Level 3,
  `fadeFrom="top"`): the corner logo and headline sit on the flat field near the top, the
  motif fills the bottom two-thirds. See `video/src/ads/servicio-sabado-1845.tsx`.
- **Text block on one side, image reads on the other** (Level 2, `fadeFrom="left"` or
  `"right"` to match which side the text is on, `"top"` in portrait where the layout stacks
  instead): the whole frame is the image, faded to flat behind the text rather than boxed
  beside it. See `video/src/ads/ayuno-evangelismo.tsx`.

What is fixed:

- **A motif makes no claim.** These images are already anonymous silhouettes: nothing that
  names a place, crowd count, person or object the record doesn't give. Positioning or
  choosing among them cannot violate this on its own — just don't caption or crop one into
  claiming something it doesn't show.
- **No text over the image.** The cached images already have none baked in; a designer adds
  none either — text belongs to the Remotion layer on top, never composited into the image.
- **Never echo the logo.** No lone globe, ring or lettered arc: the manual forbids using its
  parts separately (pp.17 to 19). This is why `escuela-dominical.png` is a plain book shape,
  not the corporate globe/ring emblem — that was the closest risk when the image was
  reviewed, so double-check it if you ever swap that image.
- **Keep the logo's field flat.** The logo (`Logo`, or `CornerLogo` in left-aligned layouts;
  `design.md` § Brand) sits on a flat area of `brand.color.background`: no gradient, glow,
  band or motif behind it or over it. `MotifImage`'s fade already does this for the current
  layouts, but a designer who repositions `MotifImage` or the logo must re-check it — the
  mask's percentages are tuned for where the logo sits today, not derived from it.
- **The tint overlay locks it to the brand palette**, not the raw generated color: never
  drop or weaken it to "improve" an image's look.
- **No hand-drawn illustration.** Do not add a drawn crowd, brush stroke, banner, blob or
  spark to fill space or add energy — that is what the cached image is for, and code-drawn
  attempts at it have read as amateurish every time they were tried. If a scene feels bare,
  the fix is motion, type scale or a functional icon (§ 5's info chips), never a new shape.

## 7. You cannot see your work

You never render, and the orchestrator will look at `fotograma.png`, the frame of your clip,
and may send it back. So build so it cannot go wrong quietly:

- Give the motif its own region (the side or the bottom) and the text its own region. Let
  them overlap only where the text has a panel behind it.
- Use `Headline` or `fitSize` for every title, so a long one fits.
- Position any spark, accent or flourish relative to the text it decorates, not a fixed
  offset: you are building against this week's title, but the same file renders again for
  another week with a different, possibly longer one.
- Keep the motif's opacity and size modest: a motif that is too quiet costs the ad a
  little, one that crowds the title costs the whole ad.
- Keep all text inside the `brand.space.xl` margin and all of it in by 60% of the clip.
- Type-check with `(cd video && npx tsc --noEmit)` and run `validate.mjs`. That is all the
  checking there is.

## 8. What the five references teach

The church's own pieces. Copy the method, never the contents: they carry colors, photos and
copy that this pipeline cannot use, listed under each.

| Ref | Piece | What it teaches | Do not copy |
|---|---|---|---|
| **ad1** | *Integración Jóvenes, Mente y fe*: a purple duotone photo of young people hugging in a circle; a giant white "JÓVENES" with a thin script word across it; date and time in outlined pills at the top corners; two line icons beside a bold subtitle | Level 3. One giant word against small type; pills for date and time; a circle of people as the motif | The purple, the photo, the quotation under the subtitle, the script face, the missing logo |
| **ad2** | *Culto de Familias, Escuela Dominical*: a sky-blue glow with light rays and a large arc; a smiling family in front of the title; a small navy script line over a heavy white "CULTO DE FAMILIAS"; one white and blue pill "date, time"; the logo at the bottom | Level 2 in brand blues. The subject beside the title; two title sizes; one info pill | The photo, the script face, the logo sitting on a gradient (the manual wants a flat panel) |
| **ad3** | *Hora de oración juvenil*: near-black navy; white and gold brush lettering; a blue brush strip behind "Juvenil"; five silhouetted young people praying in a circle around a warm glow; a three-column icon row (calendar, clock, video call) | Level 3 closest to the palette. Glow and silhouettes; the icon row | "Todos los lunes" (a recurrence the record lacks), "por Google Meet" (a platform the record lacks), the purpose line, "Invita Comité de Jóvenes", the four-word footer, the missing logo, and the brush strip itself — a hand-drawn flourish like it is not built in code (§ 6) |
| **ad4** | *Campaña Evangelista*: a sunset crowd with raised hands; a cream paint-stroke banner behind black brush lettering; orange, pink, yellow and cyan highlights; three round icon badges (place, time, everyone); a boxed footer | Level 3 scale. A crowd of raised hands is the motif; round icon badges | The orange and pink, "Todos invitados", "¡No faltes!", the invitation line, the second event folded into the footer, the missing logo, and the paint-stroke banner — again, no hand-drawn flourish (§ 6) |
| **ad5** | *Culto de Oración*: a blue monochrome collage of people praying, faded; a huge script "Oración" with a small white bold "CULTO DE"; the logo and "Envigado Central" at the bottom; no date, no time | Level 1. One field, one dominant word, the logo. Imagery, when present, is tonal | The photos, the script face |

The secondary copy in the references (a quotation, a purpose line, an "everyone is invited"
line, a slogan) is not in `events.json`, so it is not on screen. The space it filled goes
to the motif or to air. Nor does the logo go missing: it is mandatory (`brand/corporate-brand.md`).
The church name reaches the screen only through `Logo` (`design.md` § Facts), so a typed name
such as ad5's "Envigado Central" is not reproduced either.

## 9. Report your level

Add `nivel` to your manifest fragment (see `.claude/agents/ad-designer.md`): `institucional`,
`tematico` or `juvenil`. If it was a judgement call, say why in one line of `avisos`. The
orchestrator reads `fotograma.png`, the frame of your clip, against the level you chose.

Also add `motif`: the cached filename you placed with `MotifImage` (e.g. `jovenes.png`), or
`null` if your ad has none. The orchestrator uses this to know exactly which categories are
in play this week, in case the person asked for fresh images (§ 6).
