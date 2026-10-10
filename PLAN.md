# Anuncios IPUC — Weekly Church Ad Video Generator

Pulls a week of events from Google Calendar, fans out one subagent per event to
design its ad, writes one Spanish narration for the whole week and voices it once, then
edits everything into one professionally-cut video plus per-event assets.

**Status:** in progress. Phases 1 and 2 are verified. The pipeline has run end to
end on the real week 2026-W39 with real TTS: `events.json`, then per event an
`ad.png`, a voiced `clip.mp4`, and the weekly `semana.mp4`. Not yet exercised: the
`ad-designer` subagent fan-out (the three W39 deliveries were written by the
orchestrator following the same docs), and a Phase 5 dry run with the real logo
and brand colors. `church-info.md` is complete. This document is the build
contract; § 4 records the decisions that changed it.
**Target runtime:** Claude Code CLI (see [Environment](#6-environment)).
**Branch:** `claude/church-ad-video-generator-rn8pnl`

---

## 1. Feasibility — verified 2026-09-20

Everything below was tested in a live container, not assumed.

| Capability | Verdict | Evidence |
|---|---|---|
| Google Calendar pull | Works | Listed calendars; pulled real events from both church calendars |
| Remotion render @ 1920x1080 | Works | Rendered h264 mp4 + PNG still, 30fps |
| Remotion licence | Free to use | Licence grants free use to "a non-profit or not-for-profit organization" |
| Official Remotion skills | Exist | `remotion-dev/skills` — install with `npx skills add remotion-dev/skills` |
| Spanish accents / Google Fonts | Works | Accented text rendered correctly; `fonts.gstatic.com` reachable |
| ffmpeg | Bundled | Ships inside `@remotion/compositor-linux-x64-gnu`; no system ffmpeg needed |
| ElevenLabs TTS | Blocked on web, fine on desktop | `api.elevenlabs.io` returned 403 from the web sandbox egress proxy |
| Remotion Chromium download | Blocked on web, fine on desktop | `remotion.media` returned 403; worked around with `--browser-executable` |

Measured: 2 seconds of 1080p took ~19s on 4 cores (~10x realtime). Rendering is
the bottleneck and scales with core count.

### The finding that shapes the design

The calendars do not carry enough information to write an honest ad. From a real
sample:

- `Charla familias` — all-day, no time, no location, no description
- `(Jóvenes) - Oracion virtual` — all-day, no time
- `2pm Ecos del Futuro Jovenes Distrito 9` — all-day, **time buried in the title**
- `Integración maestros Adolescentes` — has a real start/end time
- **No event** in either calendar has `location` or `description` populated

So the pipeline reconstructs time and place from the event card (code), then the title
and `church-info.md` (read by the orchestrator); where none of them knows, the ad is made without it. It must
never guess (§ 4, "Missing schedule").

---

## 2. Architecture

```
Orchestrator (main session — "professional video editor")
  1. propose the week and the calendars (no perfect prompt needed)
  2. pull events via Google Calendar MCP (America/Bogota)
  3. normalize + enrich -> out/<week>/events.json     <- the contract
  4. CHECKPOINT 1: one plain-Spanish message, events grouped by day, only the real
     doubts numbered, each with a suggested answer that still needs the person's
     own reply (routine confirmations are plain lines, not numbered); events with
     no time or place are made without it (never guessed); only integrity errors
     stop the run
  5. fan out one ad-designer subagent per event (the video components); meanwhile
     build the week's Claude Design canvas (the images) and read it back to
     out/<week>/imagenes/
  6. write the week's narration (guion.md) and validate it, and every ad, against
     events.json; export each event's ad.png from the canvas with
     scripts/export-stills.mjs (its audit blocks on any error)
  7. CHECKPOINT 2: show the script and wait for a yes before the paid voice
  8. voice the week in one take (voz.mp3 + per-character timing)
  9. export the images again against the final events.json, then render per-event
     clips and the combined weekly video (the Remotion frame, fotograma.png, only
     checks the video)
```

Subagents write component files in parallel (I/O-bound, cheap). They never render —
rendering is CPU-bound and is serialized by the orchestrator. The narration and its one
voicing are the orchestrator's, so the script is written with every event in view. The
image canvas is the orchestrator's too (a subagent has no `Artifact` tool), and its export
is serialized like a render.

Fan-out is what keeps this tractable: each designer's React source stays inside its own
context window, and only a short manifest fragment comes back to the orchestrator.

### Repo layout

```
.claude/
  agents/ad-designer.md          subagent: designer of one event's ad component
  skills/church-ads/
    SKILL.md                     orchestrator workflow
    design.md                    brand + component contract
    creative-ads.md              creative levels: how much creativity each ad gets
    script.md                    Spanish copywriting rules for the week's narration
brand/
  logo.svg                       church logo (to be supplied)
  fonts/                         vendored font files for deterministic renders
  paletas-imagen.md              palette per kind of event, for the images (free text)
church-info.md                   this church's reference data: name, address, default
                                 place, ministries, call to action, recurring services
church-info.example.md           suggests what to say (free text, read by the orchestrator)
overrides/<week>.json            human answers keyed by slug: hora, lugar, modalidad,
                                 plantilla, omitir
.env                             ELEVEN_LABS_API_KEY, ELEVEN_LABS_VOICE_ID (git-ignored)
video/                           Remotion project (16:9, 1920x1080, 30fps)
  src/
    brand/tokens.ts              colors, spacing, type scale — single source of truth
    brand/fonts.ts               font loading
    templates/                   layout variants: destacado / estandar / virtual
    ads/<slug>.tsx               one component per event, written by subagents
    EventAd.tsx                  single-event composition
    WeeklyReel.tsx               TransitionSeries of all events
  public/audio/semana.mp3        the week's voiceover, staged by render.mjs
scripts/
  core/                          tested logic (spanish, normalize,
                                 audit, guion, narracion, narracion-check, escenas,
                                 ad-source, tts, project, registry, render-plan,
                                 stage-audio, stage-canvas, cdp, still-source,
                                 export-stills)
  test/                          node --test scripts/test/*.test.mjs
  normalize.mjs                  raw calendar -> events.json
  validate.mjs                   audits events.json, each ad and the week's guion.md
  gen-registry.mjs               rebuilds video/src/ads/registry.gen.ts
  tts.mjs                        ElevenLabs text-to-speech
  voice.json                     TTS model and voice settings (voice ID is in .env)
  render.mjs                     clips, fotograma.png, weekly reel
  export-stills.mjs              week's Claude Design canvas -> <slug>/ad.png
out/<YYYY>-W<NN>/
  events.json
  guion.md, voz.mp3, voz.json, voz.alineacion.json   the week's narration
  imagenes/                      the week's Claude Design canvas, read back from the artifact
  <slug>/{ad.png, fotograma.png, clip.mp4}
  semana.mp4
```

### The `events.json` contract

Every subagent reads this and may state nothing that is not in it.

A fictional example (a real week is in `out/<week>/events.json`):

```jsonc
{
  "week": "2026-W39",
  "semana": {"inicio": "2026-09-21", "fin": "2026-09-27", "texto": "Semana del 21 al 27 de septiembre", "hablada": "del veintiuno al veintisiete de septiembre"},
  "calendar": "Calendario Ejemplo",
  "timezone": "America/Bogota",        // the calendar's own timeZone
  "iglesia": {                         // from church-info.md; null where it is silent
    "nombre": "Iglesia Ejemplo",
    "direccion": "Calle 1 #2-3, Ciudad Ejemplo",
    "lugarPorDefecto": "Salón Principal",
    "llamadoAccion": "Te esperamos",
    "despedida": "Dios te bendiga"
  },
  "events": [
    {
      "slug": "culto-de-jovenes",
      "eventId": "…",                  // calendar event id, or null for a recurring service with no card
      "origen": "calendario",          // calendario | recurrente
      "titulo": "Culto de jóvenes",
      "ministerio": "Jóvenes",         // a "(Jóvenes) - ..." prefix, or a church-info.md ministry word in the title
      "fecha": "2026-09-22",
      "diaSemana": "martes",
      "fechaTexto": "martes 22 de septiembre",
      "hora": "19:00",                 // card | title ("2pm ...") | church-info.md | overrides; null if unknown
      "horaTexto": "7:00 p. m.",       // on screen
      "horaHablada": "a las siete de la noche",   // in the script, verbatim
      "horaFuente": "church-info.md",  // calendario | titulo | church-info.md | usuario; null when hora is
      "horaNota": "…",                 // only when hora is null: why no time was found
      "lugar": "Salón Principal",      // card | church-info.md default | "Virtual"/"Zoom" from the title | overrides; null if unknown
      "lugarFuente": "church-info.md",
      "modalidad": "presencial",       // presencial | virtual
      "plantilla": "estandar"          // estandar | virtual; destacado only via overrides
    }
  ],
  "descartados": []                    // events dropped, with the reason (outside the week, omitted by override)
}
```

`horaFuente` exists so the orchestrator can prove where every time came from. A
value of `inferido` is not allowed to reach a rendered ad, and it is an integrity
error, not a notice.

---

## 3. Phases

### Phase 0 — Inputs needed (Bryan)

Environment is assumed working: Claude Code CLI with Google Calendar access and
`ELEVENLABS_API_KEY` already configured. Machine setup is out of scope for this
plan.

1. Church logo into `brand/` (SVG preferred, else high-res PNG).
2. Brand colors + fonts — or an existing flyer / Instagram post to extract from.
3. An ElevenLabs Spanish voice ID (Latin-American, `eleven_multilingual_v2`),
   kept in `.env` as `ELEVEN_LABS_VOICE_ID`; the model and voice settings are pinned
   in `scripts/voice.json`. The MCP connector is a good way to audition candidates.
4. The church's reference data in `church-info.md` (free text the orchestrator reads;
   `church-info.example.md` suggests what to say): Nombre, Direccion, Lugar por defecto, Ministerios,
   Llamado a la accion, Despedida (optional, added 2026-09-21), and the recurring services.

### Phase 1 — Scaffold + brand system
Remotion project at 16:9 1920x1080 30fps. `tokens.ts` as the single source of
truth for the visual language. Fonts vendored locally so renders are
reproducible. `design.md` written as the contract subagents must obey.
Chromium path configurable via env var, defaulting to Remotion's own download.

**Checkpoint:** render one hardcoded sample ad to PNG + clip and review the frame.
*Done 2026-09-21: three sample stills reviewed (fixed a ministry tag that stretched
across the column), plus a real clip: 1920x1080, 30 fps, h264 + AAC.*

### Phase 2 — Calendar to `events.json`
Normalizer handling the real mess found in the calendars:
- all-day vs. timed events
- **reading the words is the orchestrator's job, not the code's** (decided 2026-09-21):
  the titles and `church-info.md` are typed by non-technical staff, so no regex or
  parser reads them. The orchestrator finds the times hiding in titles (`2pm ...`), the
  ministry (a `(Jóvenes)` prefix or a ministry word), `virtual` / `zoom` / `online`,
  the default place and the recurring schedules, and writes them to
  `out/<week>/lectura.json`; `normalize` merges that with what the card carries, and
  Checkpoint 1 is the only gate on the reading
- **non-blocking report:** an event still missing a time is listed and made without
  one (date only). Only integrity errors block: an `inferido` time source, a
  malformed time, a duplicate slug, an override that names no event

**Checkpoint:** run against a real week; confirm every untimed event is listed and
the run exits 0. *Done on 2026-W39: three all-day events, none with a time, exit 0.*

### Phase 3 — Subagent fleet
`.claude/agents/ad-designer.md` defines one designer per event. Each reads `design.md` and
its own event record, then delivers `video/src/ads/<slug>.tsx` (a props-driven Remotion
component) and a manifest fragment (template, warnings). *Amended 2026-09-21:* designers
no longer write scripts or voice. The orchestrator writes one narration for the whole week
(`out/<week>/guion.md`: intro, one section per event, outro), voices it in one ElevenLabs
`with-timestamps` take, and the scenes are cut where the voice pauses. `script.md` fixes
register and the closing words, and forbids stating any fact absent from `events.json`.
Design: `docs/superpowers/specs/2026-09-21-weekly-narration-design.md`.

**Checkpoint:** one subagent end-to-end on a single event.

### Phase 4 — Assembly
Orchestrator validates each delivery against `events.json` (this is what catches a
hallucinated time), then exports each event's image from the Claude Design canvas
(`ad.png`) and renders per-event clips and `semana.mp4`:
intro card, events joined by `<TransitionSeries>` with fade/slide/wipe, outro,
music bed underneath.

The detail that makes it read as *edited* rather than a slideshow (*amended
2026-09-21*): one continuous narration over the whole reel, and each scene cut where the
voice pauses, from the voice's per-character timing (`voz.alineacion.json`); the clip of
one event plays only its own slice. `calculateMetadata` checks the mp3 against that
timing. No scene ends mid-sentence, no dead air.

### Phase 5 — Dry run + docs
Full end-to-end on a real week; `README.md` for the church team. *The Spanish
`README.md` is written; the dry run waits on the real brand assets.*

---

## 4. Decisions made

| Question | Decision |
|---|---|
| Image generation | *Changed 2026-09-29.* The event image (`ad.png`) comes from a weekly Claude Design canvas, one artboard per event, built by the orchestrator, read back to `out/<week>/imagenes/` and exported with `scripts/export-stills.mjs`, which first audits each artboard's text against `events.json`. Each kind of event has its own palette (`brand/paletas-imagen.md`). The video is untouched: `clip.mp4` and `semana.mp4` still come from the Remotion components with the IPUC palette, and the frame `render.mjs` takes from them is `fotograma.png`, only to check the video. The earlier decision (design authored as one Remotion component that exports the PNG and animates in the video) is superseded for images only. Design: `docs/superpowers/specs/2026-09-29-claude-design-stills-design.md`. |
| Output format | 16:9 1920x1080 for everything. Templates built to re-layout to 9:16 later without a rewrite. |
| Deliverables | Per event: image, audio, clip. Plus one combined weekly video. |
| Calendar | "IPUC Envigado Central II-2026". Sample week 2026-W39 has three all-day events: Oracion virtual (Mon 21), Refam juvenil (Wed 23), Charla familias (Fri 25). |
| Church facts | Reference data, not code, so another church can reuse the tool. `church-info.md` is free text the orchestrator reads (Nombre, Direccion, Lugar por defecto, Ministerios, Llamado a la accion, Despedida (optional) and the recurring services are what it looks for; no code parses it). The time zone comes from the calendar's own `timeZone`. Tests use a fictional church ("Iglesia Ejemplo"); `church-info.example.md` suggests what to say. |
| Missing location | The place is the card's, else `Lugar por defecto` from `church-info.md`; "Zoom"/"virtual" in the title makes it a virtual event. With none of these the event has no place and the ad omits it. No address or phone needed. |
| Missing schedule | **Supersedes "stop and ask".** A calendar event's time is taken from the card, then the title; `church-info.md` no longer fills in a card's time directly (see "Recurring services", below). If nothing matches, the ad is made without a time (date only): nothing is guessed and nothing blocks. What is doubtful is asked once, in plain Spanish, at Checkpoint 1 (step 4 of the `church-ads` skill), and every numbered doubt needs the person's own answer, one by one — no reply stands in for all of them, and none is ever applied on the person's behalf. A doubtful time or place is dropped, or an event left out, only once the person says so (publishing cannot be undone; «anúncialo» brings a left-out event back). |
| Recurring services | *Added 2026-09-21.* Every recurring service in `church-info.md` is an ad by default: it is not always given its own calendar event (it is assumed well known), but it still happens every week. The orchestrator adds it to `lectura.json`'s `recurrentes`; `normalize.mjs` places it on its weekday and stamps `origen: "recurrente"`. Whether a same-day calendar card *is* that service, or a second event alongside it, is the orchestrator's judgment, never code's: a clear match retires the service for the week; a real doubt (an untimed or same-time card, or one that may be a second service) is asked at Checkpoint 1 rather than merged or dropped, because two services really can share a day in different rooms (e.g. a men's and a women's service). |
| "Sigue" | *Removed 2026-09-21.* A blanket "sigue"/"todo bien" no longer answers a numbered Checkpoint 1 doubt; it now only confirms the plain, un-numbered list. Each numbered doubt needs the person's own reply, or the run does not proceed. Reason: the easy way out produced more re-processing than it saved. |
| What blocks | Integrity errors only: an `inferido` time source, a malformed time, a duplicate slug, an override that names no event. |
| Human answers | `overrides/<week>.json`, keyed by slug: `hora`, `lugar`, `modalidad`, `plantilla`, `omitir`; the orchestrator writes it from the person's answers. `hora: null` and `lugar: null` announce the event without a time or place, even one the sources gave. `destacado` is chosen only this way. |
| Harness | Claude Code CLI, so the pipeline can run over SSH on a Linux VM rather than only at a desk. |
| TTS access | ElevenLabs REST API via `scripts/tts.mjs`. Not the MCP connector: the pipeline must re-render a past week identically, and voice, model and stability belong in version control. The MCP server is still useful in Phase 0 for auditioning voices. The voice ID lives in `.env`; the model and voice settings are in `scripts/voice.json`. |
| TTS billing | **A paid ElevenLabs plan (decided 2026-09-21). Supersedes pay-as-you-go.** The voice the church chose is a shared-library `professional` voice (Colombian Spanish), and ElevenLabs refuses library voices over the API on the free tier (HTTP 402, `paid_plan_required`); the free tier's premade voices are all English-labelled. Verified on the paid plan: three voiceovers generated with that voice. The original estimate (`eleven_multilingual_v2` at $0.10 per 1,000 characters, about $0.52/month at ~5,200 characters, no subscription) no longer applies: the cost is now the plan's price. `tts.mjs` still reuses an unchanged script's audio, so only new or edited text is billed. Flash/Turbo halves per-character cost but loses quality on Spanish narration. |
| TTS licensing | Cleared. Confirmed directly with ElevenLabs that API use is good to go for this project; no attribution constraint blocks publishing. |
| Register | `tú`. Warm and direct, never formal `usted`. Applies to every script and every on-screen line. |
| Closing CTA | The church's own, read from `church-info.md` (`Llamado a la accion`). For IPUC Envigado Central that is **"Te esperamos"**, spoken once in the weekly outro, followed by the optional `Despedida` (**"Dios te bendiga"**, added 2026-09-21). Event lines carry neither. If the file has none, the ads have none. |
| Weekly narration | *2026-09-21.* One script for the whole week, voiced in one take, so the video sounds like one ad and not five joined ones. The intro and outro are narrated ("Bienvenidos a <Nombre>, estos son nuestros eventos del … al …"; the call to action and `Despedida`). |
| Intro card | Yes. The weekly video opens with a dated card, e.g. "Semana del 21 al 27 de septiembre" — Spanish month names, lowercase. |
| Music bed | None for now. `WeeklyReel` still wires the audio slot so adding a track later is a config change, not a rewrite. |

## 5. Deferred

- **Music bed.** Shipping without one. The slot exists in `WeeklyReel`, so this
  stays a one-file change whenever a royalty-free track is chosen.

Brand, tracked in § 3 Phase 0: colors and logo are set from the identity manual
(2026-09-21, the manual's stated hex values; see `brand/corporate-brand.md`). Still
open: the fonts (Myriad Pro is not vendored, so the Montserrat files are placeholders).
The logo (`Logo`, 150 px, top-right in the left-aligned layouts) carries the church name
on screen, so the name is not drawn as text; `Nombre` from `church-info.md` is only said
in the voiceover. The ElevenLabs voice ID is in `.env`. `church-info.md` carries Nombre,
Lugar por defecto, Ministerios and Llamado a la accion (added 2026-09-21); without them
the ads have no place, no call to action and the voice skips the church name.

---

## 6. Environment

Assumed configured; setup is out of scope. Built and verified against Node
v22.23.2 on arm64 Linux.

Three things the code must honor regardless of machine:

- **`REMOTION_BROWSER_EXECUTABLE`.** Render scripts use it when set and fall back
  to Remotion's own Chromium otherwise, so the repo runs unchanged where Remotion
  cannot download its browser. On Linux, Remotion's own headless Chromium also needs
  system libraries (`libnss3`, `libnspr4`, ...); `ldd` on its `headless_shell` lists
  what is missing.
- **Degrade rather than fail on TTS.** When ElevenLabs is unreachable, still
  produce images, scripts and a silent video, and report which events lack audio.

**Planning fact.** Rendering is the bottleneck and scales with core count:
measured ~10x realtime at 1080p on 4 cores. A six-event week, counting the
per-event clips, is a 20-25 minute job there.

**The missing-time report is deliberately non-blocking.** An event with no known
time is made without one and listed for the user. That keeps the run unattended-safe:
the ad never states a time it does not have, so it cannot send anyone to a locked
door. Only integrity errors halt the pipeline. The cost is an ad with less
information, so the report is the place to look each week: a time added to
`church-info.md` or `overrides/<week>.json` and a re-run fixes it.
