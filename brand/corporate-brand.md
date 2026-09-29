# IPUC corporate brand — what applies to ads

Distilled from *Manual de Identidad Corporativa IPUC* (2014, 64 pp., in this folder),
converted with `markitdown`, with the image-only pages (layout schemes, lockups,
slide example) read from the PDF directly. Kept: colors, type, logo, naming and
layout rules that a video ad has to obey. Dropped: legal framing, mission/vision,
stationery, envelopes, ID cards, signage dimensions, merchandise, social-media
governance and org responsibilities.

Page numbers below (`p.14`) are the manual's own; they match the PDF page index.
The manual is print-first and has **nothing on video, motion, sound or music**.
Where this file goes beyond it, the line says *inference*.

**What this file governs (2026-09-29).** The manual's palette below governs the video and
the logo. The event images (`ad.png`) come from a Claude Design canvas and may use the
per-kind palettes of [`paletas-imagen.md`](paletas-imagen.md), which leave the manual's
palette on purpose. The logo rules (§ 3, and item 1 of the § 6 checklist) still apply to
them: unaltered, on a flat background, in the right variant for that background.

## 1. Colors

The manual defines three colors and one gradient. Its glossary says these are "the
only ones permitted in any application", and that the identity elements "cannot be
modified" (p.14, p.62). White and black appear in the manual's own pieces as neutrals.

| Role | Manual name | HEX | RGB | CMYK | Pantone |
|---|---|---|---|---|---|
| Primary | Azul oscuro | `#00338D` | 0 · 51 · 141 | 100 · 70 · 0 · 10 | 287 C |
| Secondary | Azul claro (cyan) | `#009FDA` | 0 · 159 · 218 | 100 · 0 · 0 · 0 | Process Cyan C |
| Accent | Amarillo ocre / dorado | `#F0AB00` | 240 · 171 · 0 | 0 · 30 · 100 · 0 | 130 C |
| Gradient | Degradé radial | — | dark blue → cyan | — | — |

Meaning (p.14), useful for tone: blue is balance, water/new birth, sky, royalty and
priesthood; gold is the glory of God, royalty and value. Gold marks the Bible and
Colombia inside the logo. *Inference:* keep it as the accent, not a background.

Backgrounds the manual actually shows: dark blue, white, and a pale tint of the cyan
(slide example p.56, layout schemes p.53–55). Text on dark blue is inverted (white),
with cyan as the secondary text color (p.24 sign). The manual gives no hex for the
pale tint or for any text neutral; derive tints from the three colors by opacity
rather than adding new hues.

### Known discrepancy: three different "blues"

The stated digital values are not what the manual's own swatches and the supplied
logo files show; the CMYK-to-RGB conversions differ.

| Source | Blue | Cyan | Gold |
|---|---|---|---|
| Stated in the manual (p.14 text) | `#00338D` | `#009FDA` | `#F0AB00` |
| Swatches as rendered in the PDF (sampled) | `#00519C` | `#00ADEF` | `#FDB812` |
| Logo PNGs in `brand/logo/` (sampled) | `#01498F` ring | `#5CC0ED` globe centre | `#FBB900` |

**Decided: `tokens.ts` uses the stated values** (first row). The logo's own ring is
therefore a lighter blue than the field it sits on; that is expected. Verified: the
dark-background logo stays legible on `#00338D`, because it carries a thin white
reserve line around the ring.

## 2. Typography

- **Official family: Myriad Pro.** Institutional text is Myriad Pro Regular. The church
  name inside the logo is Myriad Pro Bold, "for easy reading" (p.12–13).
- Weights the manual lists: Regular, Semibold, Bold, Bold Condensed, Condensed, plus
  the italic of each.
- **Approved substitute: Calibri**, for any internal or external text, letters and
  on-screen presentations. Never for the logo itself (p.13).
- The church name in the logo arc is uppercase and never italic, bold-styled or
  underlined. Do not retype or re-typeset the logo lettering.
- Manual style on screen (p.56 slide example): bold dark-blue titles, regular blue
  body, gold `•` bullets, `>>` as a heading marker. "Use little text per slide."

## 3. Logo (*logosímbolo*)

Globe with Colombia in gold, Bible drawn as four gold lines beneath it, ring with the
church name, and the verse *"Un Señor, una fe, un bautismo."* (Efesios 4:5) under it.
The verse is part of the logo.

**It is mandatory**: every mass-media piece that mentions the church, event promotion
included, must carry the logosímbolo (p.53).

### Files in `brand/logo/`

All five are RGBA PNGs on the same 2363 × 1638 canvas.

| File | Use |
|---|---|
| `IPUC_COLOR para fondo oscuro.png` | Full color for dark-blue backgrounds. Verse is white, ring has a white reserve line. **The default for video on a blue background.** |
| `IPUC_COLOR para fondo claro.png` | Full color for white or pale backgrounds. Verse is dark blue. |
| `IPUC_Blanco.png` | One-color white. |
| `IPUC_Negro.png` | One-color black (seals, single-ink print). |
| `IPUC_Marca de agua 11_.png` | Watermark (manual: 13 % black), for letterheads and envelopes. No video rule. |

Full color is the screen version (p.15). The one-ink and watermark versions are for
print. The manual states no minimum size for screens.

### Do

- Scale proportionally only, from a corner along the diagonal (p.17).
- Place it on a flat background: dark blue with the dark-background version, or white
  with the light version (p.25 sign versions, p.56 slides).
- On-screen presentations: logo top right (p.56). Flyers and posters: bottom right,
  next to the organizer block (p.53–54). The 2-vertical layout puts it top right beside
  the title (p.55).

### Don't (pp.17–19)

- Redraw, recolor, crop, distort, or remove any part of it.
- Put text, graphics or other elements on top of or inside it.
- Use its parts separately (no lone globe, book or ring).
- Add shadows, gradients or backgrounds that reduce its visibility.
- Place photographs or busy backgrounds over or under it. In video, this means no
  logo over footage or photos; put it on a flat panel.
- Change its typography, or use any other logo. Congregations and departments do not
  get their own.
- *Inference:* a uniform scale or opacity fade leaves the mark intact. Anything that
  warps, masks, glows or casts a shadow does not.

## 4. Naming and wording

- The **full name is "Iglesia Pentecostal Unida de Colombia"**. Uppercase on signs
  (p.24); initial capitals beside a department or district name (p.20, p.22).
- The acronym **IPUC** is allowed in texts and titles, always uppercase and without
  dots, in the surrounding text's typeface. It never replaces the logosímbolo, and on
  posters, flyers, web pages and signs it never replaces the full name (p.36).
- A local congregation is identified by the name plus its **sede** (location) in Myriad
  Pro Bold, mixed case, and never by "IPUC" alone (p.24). The national web address is
  `www.ipuc.org.co`; local sites are not used on institutional stationery (p.36).
- **No other slogans or Bible verses** for identification. A phrase or verse is fine
  for a specific program or event, not as a permanent tagline (p.36).
- Voice the manual wants: *seria, confiable, transparente y basada en la verdad del
  Evangelio* (p.9).

### Department or ministry lockup (p.20–21)

For event promotion the department name sits beside the standard logo, never in a
replacement logo. The manual gives it in print units, so proportions relative to the
logo width are more useful for video (logo 4.5 cm wide = 127.6 pt):

| Element | Manual | Relative to logo width |
|---|---|---|
| Department name | Myriad Pro Bold, 21 pt, dark blue `C100 M70 Y0 K10`, tracking −40 | ≈ 0.165 × |
| Sub-line ("Comité Nacional") | Myriad Pro Italic, 12 pt, cyan, tracking −40 | ≈ 0.094 × |
| Connector line | 0.5 pt, cyan, between logo and text | hairline |
| Margin around the connector line | 5.2 mm | ≈ 0.116 × |

Districts follow the same idea: the district name uses the church-name typeface,
centered under it at 50 % of its size (p.22).

## 5. Layout references

These are the manual's own compositions. They are the closest thing it has to a
template for a screen piece.

**Horizontal flyer (p.53) — the reference for our 16:9 frame.** A 1 cm safe margin
("caja tipográfica") on every side. Top to bottom: title band, then a middle row with
image area on the left and text area on the right, then a full-width text band, then a
footer with the organizer's information on the left, a thin vertical cyan divider, and
the logo on the right.

**Vertical 1 (p.54).** Title band, image area with a text box overlaid at its right
side, text band, then the same footer (organizer left, divider, logo right).

**Vertical 2 (p.55).** Title on the left with the logo and a divider on the right in the
top band, then text, a large image area, text, and an organizer-information band.
Relevant if 9:16 is added later (CLAUDE.md rule 3).

**Slide (p.56).** Pale cyan panel with rounded corners, `>>` title in bold dark blue,
logo top right, a thin divider under the title, gold-bulleted body, and a white
open-book wave graphic along the bottom edge.

**Congregation sign (p.24).** Solid dark-blue field, logo on the left, church name in
white bold capitals, the sede below it in cyan (mixed case), the web address in cyan at
the bottom right. Basic info only: logo, name, sede, web address. The legal registration
and service schedules are deliberately left off (signage rule).

## 6. Quick checklist for an ad

1. Logo present, unmodified, on a flat background, right variant for that background.
2. Only the three brand colors (plus white/black and tints of the cyan).
3. Myriad Pro, or Calibri as the sanctioned fallback; never restyle the logo lettering.
4. Full church name spelled out; "IPUC" alone never stands in for it.
5. No slogan or verse of our own as a permanent tagline.
6. Ministry named beside the logo, not in a new logo.
7. Sober, trustworthy tone.

## 7. Not in the manual

Motion and transitions, sound and music, video safe areas, minimum logo size on screen,
dark-mode or text-neutral hex values, photo treatment (beyond "no photos behind the
logo"), social-media formats. These fall back to project decisions in `PLAN.md` and
`tokens.ts`.

## 8. State in `tokens.ts`

Done (2026-09-21): the palette uses the stated hex values of § 1 and `logo` points at
`IPUC_COLOR para fondo oscuro.png`. Roles: `background` and `onAccent` = Azul oscuro,
`primary` = cyan, `accent` = gold, `text` = white. Two roles are tints derived by blending
brand colors, not new hues: `surface` (20 % cyan into the blue) and `textMuted` (white
20 % toward the blue).

Open:

1. **Myriad Pro is not vendored.** `brand/fonts/` holds Montserrat, a placeholder.
   Myriad Pro and Calibri are both proprietary, so neither is in the repo. An
   open-licensed Myriad-style face (for example Source Sans 3, *not* in the manual) is
   an option if a lookalike is acceptable.
2. **SVG.** PLAN.md asked for `brand/logo.svg`; only PNG exists.
3. **No sede on screen.** The manual calls for name plus sede beside the logo (§ 4). The
   project decision is that the logo carries the name and nothing on screen is read from
   `church-info.md`, so the congregation ("Envigado Central") is not shown as text.

Also done: `Logo` draws it 150 px tall (`logoHeight`), top-right in the left-aligned
layouts (as on the manual's slide, p.56) and at the top of the stack in the centered
ones; `Backdrop` keeps its shapes low so nothing sits behind it. `iglesia.nombre` is no
longer drawn on screen; the voiceover still says it once.
