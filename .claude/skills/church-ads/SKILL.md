---
name: church-ads
description: Produce the weekly church ad video. Pulls a week of events from Google Calendar, builds events.json, fans out one ad-designer per event for the video's visuals, builds the per-event images on the week's Claude Design canvas and exports them, writes one narration for the whole week and voices it once, validates, and renders per-event clips plus one combined weekly video. The person needs no exact prompt: it proposes the week and the calendars and asks, in plain Spanish, about anything unclear before making anything. Use when asked to make, redo or check a week of church ads.
---

# Weekly church ads: orchestrator workflow

You are the video editor. Designers write components in parallel. **You write the
week's narration, voice it once, and render, and only you render**: rendering is
CPU-bound and is serialized by `scripts/render.mjs`.

Read `design.md` (the visual and component contract) and `creative-ads.md` (how much
creativity each kind of event gets) before briefing anyone; the designers read them
too. Read `script.md` (the Spanish copy rules) before writing the narration: it is
yours, not theirs.

The people you work for are church staff, not developers, and this tool is their
automation. They will not send a perfect prompt ("haz los anuncios" is enough), so you
propose and ask; they answer in a few words. Read *Talking to the person* before you say
anything to them.

## Hard rules

1. **Never invent an event fact.** A time, place, name or detail may only come from
   the calendar card, `church-info.md`, or the person you are working for. What is
   unknown stays absent: the ad is made without it. What is doubtful is asked once, at
   Checkpoint 1 (step 4), and every numbered doubt needs its own answer: nothing is
   designed, voiced or rendered while one is still open.
2. All audience-facing text is Spanish (Colombia), addressing the reader as `tú`.
3. All video is 16:9, 1920x1080, 30 fps.
4. The church's facts (name, address, default place, ministries, call to action,
   blessing (`Despedida`), recurring services) live in `church-info.md`, never in code. It is
   free text written by non-technical staff: you read it, see *Reading the calendar and
   church-info.md*.

## Talking to the person

Everything you say to them follows these rules:

- **Spanish (Colombia), `tú`, short and warm, plain words.** The English of this file is
  for you, not for them.
- **Propose, do not quiz.** Every question carries a suggested answer and can be answered
  in a few words. Never ask an open question you could answer with a proposal.
- **No jargon.** Never say slug, override, JSON, `events.json`, notice ids (`sin-hora`),
  "ISO week", commands or file paths. Say "evento", "hora", "lugar", "la semana del 21 al
  27 de septiembre". Write times as "6:45 p. m." (`horaTexto`) and dates as `fechaTexto`.
- **Two checkpoints per run, one message each**: Checkpoint 1 (step 4) before anything is
  made, Checkpoint 2 (step 8) before the paid voice. Between them, do not interrupt.
  Never ask the same thing twice: what they answered lives in `overrides/<week>.json`, so
  read it before asking on a re-run.
- **Say what a problem means for them**, not the error text: "no pude generar la voz; te
  dejo el video sin audio y lo intento de nuevo cuando quieras".
- **Designers cannot reach the person** (they do not ask). Their `avisos` come to you, and
  you turn them into plain lines of the final list (step 11).

## Flow

### 1. Agree the week and the calendars

Propose; do not ask. The person may name neither, one or both, and whatever they name
wins.

- **The week** runs Monday to Sunday (an ISO week such as `2026-W39` for you, never for
  them). From today's date: Monday to Friday, propose the current week; Saturday or
  Sunday, propose the upcoming week and mention the one just ending. "La próxima semana"
  or a date they give is resolved the same way. Its dates:

  ```bash
  node -e "import('./scripts/core/spanish.mjs').then(m => console.log(m.weekRange('2026-W39')))"
  ```

- **The calendars** come from `list_calendars`: propose every calendar whose name contains
  the church's name (`Nombre` in `church-info.md`, ignoring case and accents), so
  "IPUC Ejemplo" and "IPUC Ejemplo II-2026" both match. Preview each with `list_events` for
  the week, read-only and with the window of step 2, and count its events. If no calendar
  matches, list them all and ask which are the church's: the one time step 1 asks its own
  question.

Do not send a message for this when the proposal is clear: state the week and the
calendars at the top of Checkpoint 1 (step 4), where the person can correct them.

### 2. Pull the events and save the raw response

For each proposed calendar, call Google Calendar `list_events` with `startTime` at the
Monday 00:00 and `endTime` at the following Monday 00:00 in the calendar's own
time zone, and `orderBy: startTime`: it is the same call as the step 1 preview, so save
what it returned instead of pulling again. Page through `nextPageToken` until it is
exhausted. Save the response **verbatim** as JSON (`summary`, `timeZone`, `events`)
to `out/<week>/raw/<name>.json`. One file per calendar. The normalizer also drops
anything outside the week, so a slightly wide window is safe. If the person drops a
calendar at Checkpoint 1, delete its file from `raw/` and run step 3 again.

**No calendar connector in this session?** Say so in one line (they connect Google Calendar
in their claude.ai connectors and start a new session) and offer the other way: a
screenshot of the week in Google Calendar, or the events pasted as text. What the person
sends is a fact from the user (hard rule 1), so transcribe it into the same
`raw/<name>.json` shape (`summary`, `timeZone`, `events` with `id`, `summary`, `start`,
`end`), one card per event, giving each a short made-up `id`, and note in a `nota` key where
it came from. A truncated title in the screenshot ("Precongreso Juven…") is a doubt for
Checkpoint 1, never a guess. A day the screenshot does not show (often the last Sunday) is
asked about too.

### 3. Normalize, read, normalize

```bash
node scripts/normalize.mjs --week 2026-W39
```

The first run writes `out/<week>/events.json` from the calendar alone: dates, slugs, and
the time and place the card itself carries. What is left is words: the clean title, a time
in the title, the place, the ministry, whether the event is virtual, and which of the
church's recurring services this week actually has. Reading words is your job, not the
code's. Read `events.json` (each event's `eventId`, day and raw title) together with
`church-info.md`, write `out/<week>/lectura.json` as *Reading the calendar and
church-info.md* says, and run the same command again. It merges your reading, then an
existing `overrides/<week>.json` on top (see Overrides).

Every recurring service of `church-info.md` is an ad by default: add it to
`lectura.json`'s `recurrentes` list unless a calendar card of that day *is* that service
(§ *Placing the week's recurring services*, below). Code only turns each `recurrentes`
entry into an event on its weekday; deciding whether a card and a service are the same
event, or two events that happen to share a day, is judgment, never code's.

- Exit **2** means integrity errors: a malformed time, an untrusted `horaFuente`
  (`inferido`), a duplicate slug, an override or reading that names no event. Fix the
  cause (an override, the raw file, `lectura.json`) and run it again. Do not continue.
- Exit **0** approves the file for the next step.

### 4. Checkpoint 1: confirm the week and ask about what is unclear

Send ONE message, in Spanish, before any designer starts. It has five parts, and only the
fourth is numbered: a number means "I need your own answer to this one," and nothing
proceeds while a number is unanswered.

1. **The week and the calendars**: "Voy a preparar la semana del lunes 21 al domingo 27 de
   septiembre con los calendarios X y Y (7 eventos)." Mention a calendar with no events
   that week; if every calendar is empty, say so and stop: there is nothing to make.
2. **The background images**, one line, every run — never silently reuse without asking:
   "Para las imágenes de fondo uso las mismas de siempre, ya revisadas; si quieres unas
   nuevas para esta semana, dímelo." This is not a numbered doubt (it risks no one's
   Sunday, only money): if they say nothing, keep the saved ones, the same way an unpaid
   voice is never regenerated on a guess. If they ask for fresh ones, see step 5. Not
   numbered does not mean rhetorical: this line needs a real chance at a reply before
   step 5 starts, the same pause the numbered doubts already force — never state it and
   dispatch designers in the same turn (a real run did exactly this once: the line was
   said, but nothing paused for it, so it was never actually asked). If there are numbered
   doubts this run, ask this alongside them in the same interactive call so one pause
   covers both.
3. **Every event, grouped by day** (skip a day with nothing on it), introduced by a plain
   confirmation line ("Los tomé así; dime si alguno está mal:"). Under each day, one line
   per event: title, and the time and place it will use, with where each comes from in
   plain words. Time: `calendario` "del calendario", `titulo` "escrita en el título",
   `church-info.md` "horario del culto", `usuario` "la que me dijiste", none "sin hora".
   Place: `calendario` "del calendario", `titulo` "escrito en el título" (a virtual event),
   `church-info.md` "el lugar de siempre", `usuario` "el que me dijiste", none "sin lugar".
   Grouping by day is what lets the person see, and correct, two events sharing one day.
   Send this list even when there is nothing to ask.

   **Routine confirmations are plain lines, never numbered.** The list already shows them;
   the confirmation line above says what they mean. Each keeps what the sources say, so
   there is nothing to decide. They are:
   - events that go without a time — **except** a recurring-service card confirmed as the
     service itself (§ *Placing the week's recurring services*, "one card is plainly it")
     that has no time of its own: `church-info.md` already knows this one, so that is a
     numbered doubt below, not routine;
   - events that go without a place;
   - events whose place is only the default (`lugarFuente: church-info.md`) with no sign of
     being elsewhere: they keep it;
   - a recurring service placed on its weekday with no calendar card of its own.
4. **Only the real doubts**, numbered in the order of the week, each with a suggested
   answer; if there are none, leave this part out. The doubts:
   - **Two events on one day that may be the same service**: a calendar card that shares,
     or may share, a recurring service's time — the same time, an overlapping one, or no
     time at all on a day that service runs. Never merge or drop either one yourself: two
     services really can share a day in different rooms (a men's and a women's service,
     say). Ask which it is: "¿el culto de caballeros es otro a la vez, el de siempre, o a
     otra hora?" Suggested: two separate events, the card's own announced by date only and
     with no place unless its own card gives one (the default place may not be where it is
     held). If the answer is "es el mismo", the recurring service is omitted for the week
     and its time (and place, if given) becomes the card's own, by override.
   - **A recurring-service card with no time of its own**: a card already confirmed as
     the service itself (§ *Placing the week's recurring services*, "one card is plainly
     it") — identity is not in doubt here — but the card carries no time and the title
     gives none either. Do not let this fall to date-only by default: `church-info.md`
     states the service's usual time, and that is a known fact, not a guess (this is
     exactly what happened with a real Saturday fast card in 2026-W39: no time on the
     card, though `church-info.md` already gives 7:00 a. m. for it). Ask: "¿el ayuno es a
     la hora de siempre, las siete de la mañana, o prefieres anunciarlo solo con la
     fecha?" Suggested: use the service's usual time from `church-info.md`, by override.
   - **A recurring service whose usual card is missing or cancelled** this week: ask
     whether it is happening. Suggested: leave it out this once — a wrong "yes" sends
     people to a locked door.
   - **A time with no AM/PM** in the title (you left `hora` out of the reading):
     "¿2 de la mañana o de la tarde?" Suggested: date only.
   - **A day with two services** where the title names neither (you left `hora` out):
     which one. Suggested: date only.
   - **A place that may be elsewhere**: an event whose place is only the default
     (`lugarFuente: church-info.md`) but whose title suggests it is held elsewhere (a
     district or zone event, a convention, another church). Suggested: announce it without
     a place (`lugar: null`). A wrong place sends people to the wrong door; a missing one
     does not (hard rule 1).
   - **An unclear title**: an acronym or nickname you cannot read, or one that looks
     internal (a teachers' meeting, a committee). Ask what it is and whether to announce
     it; never guess its meaning. Suggested: leave it out, whichever of the two it is.
     Publishing cannot be undone once the video is out, while a left-out event comes back
     when the person says «anúncialo».
5. **How to answer**, in one line: "Responde con el número y una palabra, por ejemplo «1
   los dos, 2 omitir, 3 anúncialo, 4 sin lugar», o escríbeme con tus palabras. Si algo de
   la lista está mal, dime cuál; si eso está bien, dime «todo bien» o «dale»."

If the interactive question tool caps how many numbered doubts fit in one call (Claude
Code's `AskUserQuestion` allows at most 4), split them across consecutive calls back to
back, before anything else happens — it is still one uninterrupted checkpoint to the
person, not two separate ones.

**There is no word that answers a numbered doubt for you.** "Todo bien" or "dale" confirms
only the plain list (part 3) as it stands; each numbered question (part 4) still needs its
own reply. If the person answers some and leaves others open, or says "sigue" out of
habit, ask again about the ones left open, once, naming them — never apply the suggestion
on their behalf and never proceed with one unanswered. The final report lists every event
left out (step 11), so nothing disappears silently.

Then apply the answers yourself: write `overrides/<week>.json` (see Overrides), run step 3
again and check that it exits 0. The person never sees a file. If an answer is still
unclear, ask again about that item only, once and narrower. If they dropped a calendar,
see step 2. A fix that belongs to the church for good (a missing service, the default
place) is an update to `church-info.md`: offer it once, in plain words, after the run.

### 5. Fan out one `ad-designer` per event, and build the image canvas

One subagent per event, all in a single message so they run in parallel. Each prompt
is just the `week` and the `slug`; they read everything else themselves. They deliver
`video/src/ads/<slug>.tsx` and a JSON manifest fragment (`slug`, `plantilla`, `nivel`,
`motif`, `avisos`). They write no script and make no audio, and they cannot ask the person
anything. Collect the fragments; gather every `avisos` entry for the final report.

**If the person asked, at Checkpoint 1, for fresh background images this week**: collect
every fragment's `motif` into the set of cached filenames actually in play (skip `null`),
and regenerate exactly those — never one nothing used. One ElevenLabs image request per
filename, using the style brief in `creative-ads.md` § 6 (flat-vector-illustration-style,
deep-navy background, an anonymous silhouette motif in cyan/pale-blue with a warm gold
glow, no text, no logo, generous negative space in the upper two-thirds) plus that
category's subject (a family, a prayer, young people, a campaign crowd, worship, Sunday
school, a baptism). Review each result the same way the first set was reviewed — no text,
no logo echo (creative-ads.md § 6's "never echo the logo"), a generic, anonymous scene —
before overwriting `video/public/motifs/<filename>`. This happens once, here, off the
per-event critical path, the same way TTS is centralized rather than run per event
(`CLAUDE.md` hard rule 4); a designer never generates or edits these images either way.
Note in the final report (step 11) that this week's motifs are new and worth a look.

**While the designers work, build the week's image canvas yourself.** Each event's
`ad.png` does not come from a designer's component (those make the video only) but from
one Claude Design canvas for the whole week, so the week's variety stays balanced. A
subagent has no `Artifact` tool, and only you build and export it, serialized like every
render (`CLAUDE.md` hard rule 4). Follow the spec's "Spike result"
(`docs/superpowers/specs/2026-09-29-claude-design-stills-design.md`, including its "Write
side" subsection) and the type's own instructions; do not invent the artboard markup
yourself.

- Read `brand/paletas-imagen.md`. It says which palette each event takes, the only text an
  artboard may carry (the event's own title, ministry, date, time, its place unless it is
  the default, and the church's call to action) and which logo variant goes on which
  field. Keep the kind each event took for the report (step 11).
- Start with the `Artifact` `quickstart` (`intent: "design"`, `design_systems: false`: the
  account's default design system is not the IPUC's), then publish a private Design
  artifact from the type, named for the week in plain Spanish, as the W40 run did:
  `IPUC semana 28 sep - 4 oct`.
- Upload the five brand files to that canvas with one `Artifact` publish (`asset: true`,
  `file_paths`): the two logos, dark and light (`brand/logo/IPUC_COLOR para fondo
  oscuro.png` and `... para fondo claro.png`), and the three Montserrat fonts, 500, 700 and
  800 (`brand/fonts/montserrat-latin-{500,700,800}-normal.woff2`). Reference each as the
  `/_blob/<id>` the result returns, verbatim (the type forbids `data:` URIs and file
  names).
- One artboard per event, 1920x1080, with `data-slug="<slug>"` on its root element; the
  first one goes in `project/Main.dc.html`.
- Read it back to `out/<week>/imagenes/`. Delete any older `out/<week>/imagenes/` first, so
  a stale artboard cannot pass for a current one. Then `Artifact` `list` with
  `scope: "files"`, and `read` with `paths` and `out_dir` for `project/canvas.json` and
  every `project/*.dc.html` (skip `index.html`, `app.js`, `app.css` and the reference
  pages). Then `list` with `scope: "assets"` and `read` with `path` (singular), once per
  asset, which saves `<id>.<ext>` at the root of `out_dir`.

**An image the person sends for an event** (the ministry's own flyer) is used as that
event's image as is: save it as `out/<week>/aportadas/<slug>.<png|jpg|jpeg|webp>` (one copy
per slug when it covers two days), give the event no artboard, and the video shows it
(`render.mjs`); `export-stills.mjs` leaves that event out of its audit. Its words are the
person's (hard rule 1), but the event record still follows the usual reading: the
narration states only what `events.json` holds (not the speakers' names on the flyer), and a
time the flyer does not give stays out. The event still needs its `video/src/ads/<slug>.tsx`
(the plain template wrapper is enough: it is only the fallback).

If the canvas cannot be published or read back, the video is unaffected: carry on, there
is no `ad.png` this week, and step 11 says so. Remove any `out/<week>/<slug>/ad.png` left
from an earlier run (an earlier export, or a frame of an earlier render), so no old image
passes for this week's.

### 6. Write the week's narration

Write `out/<week>/guion.md` yourself, once, with every event of `events.json` in view,
following `script.md`: `## intro`, one `## <slug>` per event in `events.json` order, and
`## outro`. This is what makes the video one piece instead of separate ads: vary how each
event line opens, let the lines lead into one another, and keep the church's call to
action for the outro alone.

### 7. Validate, and export the images

```bash
node scripts/validate.mjs 2026-W39
```

This checks each ad file against the source rules and the narration against the
record: the sections, the intro (church name, the week as `semana.hablada`), each event
line's facts, and the outro (exactly the church's closing words). Exit **2** blocks
rendering: send a component error back to that event's designer (or fix the file
yourself), fix a script error in `guion.md`, then validate again. Notices do not block.

Then read `guion.md` against `events.json` yourself. The checker is a net, not proof:
it will not notice an invented topic. A time in a church ad that is not in the record
sends real people to a locked door.

Then turn the canvas of step 5 into the images:

```bash
node scripts/export-stills.mjs 2026-W39            # every event
node scripts/export-stills.mjs 2026-W39 <slug>     # one event only
```

It reads `out/<week>/imagenes/`, checks that every font and image really loaded and that
each artboard is 1920x1080, audits each artboard's text against `events.json`, and writes
`out/<week>/<slug>/ad.png`. It is CPU-bound like a render: run it alone, never next to
one. It never downloads a browser: it uses `REMOTION_BROWSER_EXECUTABLE` or the headless
shell Remotion installed, so on a machine that has never rendered, run
`(cd video && npx remotion browser ensure)` first, or set that variable. A single-slug
export still stages and audits the whole canvas: one bad artboard blocks every export,
and every event needs its artboard. Exit **2** blocks the images: no image is written, and
the old `ad.png` of each event in scope is removed. Its causes: an artboard that fails the
audit (including text the audit cannot read, such as CSS text, a frame or form field, or
text outside the artboards, and a time or date that runs out of its box), a font or image
that did not load, a missing asset, a wrong size. Fix the canvas (update the same
artifact), read it back as in step 5 and export again. Exit **1** means an input is missing,
or the browser could not start, died or stalled. The audit is a net, not proof, like
`validate.mjs`: you still look at every `ad.png` (step 10).

### 8. Checkpoint 2: show the script before the voice

The voice is the only step that costs money, and every later edit voices the whole week
again. So once validate passes and you have read the script, show `guion.md` to the
person as what the voice will say: the welcome, each event's line under its plain title,
the closing. Point out any word the voice may say oddly (an acronym; do not respell it,
see `script.md`). Say in one line that this is the last moment to change words before the
voice is generated, and wait for a yes. Apply their changes to `guion.md` (a change to a
fact is an override, step 4), validate again and show only the changed lines. A change to
a fact also means updating that event's artboard in the canvas, reading it back and
exporting again (step 7).

The person may waive this checkpoint ("no me lo muestres, genera la voz"): go straight to
step 9. A waiver never relaxes the hard rules or `validate.mjs`.

### 9. Voice the week

```bash
node scripts/tts.mjs --week 2026-W39
```

One request voices the whole script in a single take and keeps its per-character timing
(`voz.mp3`, `voz.json`, `voz.alineacion.json`). It refuses to run while validation has
errors and reuses the files when the text is unchanged. It costs money and every edit
re-voices the whole week, so validate and Checkpoint 2 come first. Exit **3** (ElevenLabs
unreachable) is a valid outcome: the week is rendered silent and reported. After the first
voicing, ask the person to listen: this is the first time the voice says the church's name.

### 10. Render

Right before rendering, run `node scripts/export-stills.mjs <week>` once more, against the
final `events.json`: this is the gate for the images, since `validate.mjs` does not look at
them.

```bash
node scripts/render.mjs 2026-W39            # every event, then semana.mp4
node scripts/render.mjs 2026-W39 <slug>     # one event only, no weekly video
```

A single-slug render still needs a valid weekly `guion.md`: every clip is a slice of the
one narration, so a facts error in another event's line blocks it too.

`render.mjs` validates again, regenerates `video/src/ads/registry.gen.ts`, stages
the week's `voz.mp3` into `video/public/audio/semana.mp3` and each event's `ad.png` into
`video/public/imagenes/` (the scene shows that image, the one that gets published; an event
with no image falls back to its designer's component), cuts the scenes where the
voice pauses, bundles once, and renders one thing at a time: per event `fotograma.png` (a
frame of the clip, only to check the video) and `clip.mp4` (its own slice of the
narration), then `semana.mp4` (an intro card, the events in order with transitions, an
outro, one continuous narration over all of it; a music bed only if
`video/public/music/bed.mp3` exists). The images are not made here: they come from the
export of step 7, so export before every render or the video shows a stale image. Set `REMOTION_BROWSER_EXECUTABLE` where Remotion cannot download its own
Chromium.

Look at every `out/<week>/<slug>/ad.png` and every `fotograma.png` before calling it done.
The image is what gets published and what the video shows; a designer's scene appears only
for an event with no image, so a bad frame there goes back to its designer. Generated output is disposable and is never edited by
hand: change the source and render again (for an image, the canvas, then read it back and
export again).

### 11. Report

In Spanish, in plain words: what was produced and where (the week's folder under `out/`),
then a list headed **"Revisa esto antes de publicar"** with what the person must know:
the events made without a time or place, the events left out (by their own answer; tell
them that «anúncialo» brings one back), whether the week was rendered silent (and how to
retry: they can ask you to voice it again; the command is `node scripts/tts.mjs --week
<week>`), whether this week's background images are new (step 5) and worth a look, the
events that have no image (no `ad.png`: the canvas could not be published, read back or
exported; tell them, with no file names, that the video is fine and that a frame of the
video stands in until the image is done; for you, that frame is `fotograma.png`), the kind
each event's image took, in words ("la de Ecos del Futuro salió en morado, por ser de
jóvenes"), naming which of two kinds an event that fits both was given, the designers'
`avisos` put in plain words, and any word the voice may mispronounce. Always end with the reminder to check every time and date in the images.

### 12. One video per service, once the week's video is approved

The week's video is shared ahead of the week (on the Saturday before, say). At each service
of the week the past is no longer news, so once the person approves the week's video, make
one more video per service day of the run, every one of them including the run's first day:
the video played at that day's service announces only what comes after that service. The days
after it, and of that same day only what starts after its last recurring service: Sunday
morning's video keeps that Sunday's evening vigil but not its morning services; Tuesday's,
whose only service is Tuesday's, starts on Wednesday. The service days are the weekdays of
`church-info.md`'s recurring services (for IPUC Envigado Central: domingo, martes, jueves and
sábado). Skip a day with nothing after it. When the person asks for these videos one at a
time, make the nearest service's first ("primero dame el de hoy").

Each is a run of its own, `<week>-<weekday>` (accent-free: `2026-W42-sabado`), in
`out/<week>-<weekday>/`:

```bash
node scripts/normalize.mjs --week 2026-W42-martes   # the week's events after Tuesday
node scripts/validate.mjs 2026-W42-martes --narracion
node scripts/tts.mjs --week 2026-W42-martes
node scripts/render.mjs 2026-W42-martes             # only its semana.mp4
```

The weekday names its first occurrence in the run, so in a run that starts on the Sunday before
(`desde`), `domingo` is that first Sunday. `normalize` reads the week's own raw files, reading and overrides, and keeps the slugs the
whole week gave each event, so nothing is asked again and every image is the week's
`ad.png` (`render.mjs` takes it from the week's folder). No designer, canvas or export runs
again. Its `guion.md` is yours: the intro (the formula of `script.md`, with this run's
`semana.hablada`, or "el resto de la semana" in its place, which `validate.mjs` accepts only
in a service's run and which IPUC Envigado Central asks for), then each remaining event's line copied word for word from the week's
approved script, changing only an opening that leans on a line no longer there ("Ya el
domingo…" as the first line), then the outro. Because those lines are already approved,
the person's approval of the week's video covers these: show them, in the same message as
the finished videos, rather than asking again. Each costs one voicing; send each
`semana.mp4` and say which service it is for ("el del martes").

Write the week's run as `desde` asks (§ *Reading the calendar*): the cut is by date, so a
run that started on the Sunday before keeps its slugs here too.

The person's later changes reach every video: a change to the week (an event added or
dropped, a time) is made once in the week's run, then the week's video and each service's
video are rebuilt from it (normalize, script, voice, render, in that order of runs). Send
the nearest one first.

### Lessons from the runs (keep them)

- **An event that replaces a service** ("la Semana Pre-Congreso reemplaza el culto del
  sábado"): drop that week's service with `omitir` on its slug; the replacing event keeps its
  own record. Do not move the service's time onto it unless the person says so.
- **A permanent change to a service** ("cámbialo a 6:30 para siempre"): edit
  `church-info.md` (and offer it whenever an answer sounds permanent); this week's slug may
  change with the time, so re-check the overrides that name it.
- **A ministry you are not sure of**: a recurring service's "Dirigido por" line names who
  leads that weekday's usual service, not a special event that falls on that day ("Culto de
  obra social" on a Tuesday was not the Damas Dorcas'). Ask before tagging a calendar event
  with the ministry of the service it may replace.
- **A flyer the person sends** is that event's image (step 5): its speakers and slogans
  stay on the image and out of the record. The narration names them only when the person
  asks ("informa que contaremos con la visita de los pastores…"), and then only as the
  flyer writes them.
- **The person edits the script line by line** before the voice: show the whole updated
  script after each round, never voice until they say so, and keep their wording.
- **An event that spans non-consecutive days** (Thursday and Saturday): one event per day,
  each with the same image, not one event with a range.

## Reading the calendar and church-info.md

`church-info.md` and the calendar titles are typed by non-technical staff: any layout,
typos, prose instead of lists. Read them as a person would and never ask the staff to
reformat anything. Reading is judgment, so Checkpoint 1 is its only gate: everything you
read is shown there with where it came from. Write it fresh on every run, from the current
`church-info.md`; the week's folder is disposable.

```json
{
  "iglesia": {"nombre": "...", "direccion": "...", "lugarPorDefecto": "...", "llamadoAccion": "...", "despedida": "..."},
  "eventos": {
    "<eventId, copied exactly>": {
      "titulo": "Ecos del Futuro", "hora": "14:00", "horaFuente": "titulo",
      "lugar": "Templo", "lugarFuente": "church-info.md", "ministerio": "Jóvenes",
      "modalidad": "virtual", "horaNota": "..."
    }
  }
}
```

When the person asks for a run that starts before the Monday (on a Saturday, "desde el domingo
11", so tomorrow's events are announced too), keep the ISO week of the Monday after it and add
`"desde": "YYYY-MM-DD"` at the top level: the run then starts that day (at most 6 days early),
its cards are kept, the intro says the longer range, and each recurring service lands on every
matching day of it.

Every key is optional except `iglesia.nombre` (`validate.mjs` errors without it, so a
forgotten file cannot silently skip the intro and outro checks). Leave out what the sources
do not say; the code never fills it in.

- **`iglesia`**: as `church-info.md` says it. A line the file does not have stays out.
- **`titulo`**: the title without the parts that have their own field (a time such as
  `2pm`, a `(Ministerio) -` prefix), wording and spelling otherwise as written. Leave it
  out to keep the calendar's title.
- **`hora`** (24 h `HH:MM`) **and `horaFuente`**: only when the card has no time (the card
  always wins), and only from `titulo`: the title states it with AM/PM or the period of
  the day (`2pm`, "a las 7 de la noche"). A card's time never comes from `church-info.md`
  here — an untimed card on a service day is not merged with the service's time in the
  reading itself. What happens next depends on identity: a card that might or might not
  be the recurring service is the overlap doubt at Checkpoint 1 (§ *Placing the week's
  recurring services*); a card that is plainly the same event as the service and still has
  no time is the separate "recurring-service card with no time of its own" doubt (step 4).
  Either way the person confirms it and it lands as an override — never a silent guess
  here, and never a silent "sin hora" either. A bare "7:30" or "a las 7" is not a time:
  leave `hora` out and ask at Checkpoint 1. Never write `inferido`; it blocks. `horaNota`
  says in plain words why there is no time, if useful.
- **`lugar` and `lugarFuente`**: only when the card has no place. `titulo` for a virtual
  event ("Zoom" or "Virtual"); `church-info.md` for the default place, when nothing
  suggests the event is elsewhere. If the title suggests elsewhere (a district or zone
  event, a convention, another church), leave `lugar` out and ask at Checkpoint 1.
- **`modalidad`**: `virtual` when the title says Zoom, virtual or online; otherwise omit.
- **`ministerio`**: from a `(Ministerio) -` prefix, or the church's ministry the title
  names; omit when there is none or it is ambiguous. A name in `church-info.md`'s
  `Ministerios` line is not automatically a standing group — one congregation's list
  briefly included "Escuela Dominical", which was really just that recurring service's
  own name, not a committee that leads anything. If a "ministry" only ever names one
  recurring service and nothing else, it is worth confirming with the person rather than
  tagging every mention of that service as led by it.

Cover every event. One you skip is announced with its calendar title and card facts alone,
and a `eventId` that names no event is an error. The limit is hard rule 1: a fact you
cannot point to on the card, in the title or in `church-info.md` stays out, and a doubt
becomes a numbered question at Checkpoint 1 with the safe suggestion.

### Placing the week's recurring services

`church-info.md`'s recurring services are ads by default: each one that has no calendar
card of its own goes in `lectura.json`'s `recurrentes`, an array read the same way as
`eventos`, one entry per service:

```json
{
  "recurrentes": [
    {"dia": "martes", "titulo": "Culto", "hora": "18:45", "lugar": "Templo", "ministerio": "Damas Dorcas"}
  ]
}
```

`dia` is the weekday, in any spelling `church-info.md` uses ("Sabados", "sábado",
"SABADO"); code turns it into this week's date, and it is the only required key besides
`titulo`. `titulo` names the service so the ad and the script line have something to say —
but think about what each field already says before folding one into another. When a tema
line gives the service its own name, use it ("Oración y Enseñanza" -> "Culto de oración y
enseñanza"). A bare "Dirigido por X" is not a name for the service, it is who leads it —
that belongs in `ministerio`, not stitched into `titulo` as "Culto dirigido por X": the
`ministerio` you set is what puts the leader's name on the ad, once, as its own tag, and
what lets the narration say who leads it, once, in the leader's own sentence (script.md).
Writing "dirigido por X" into `titulo` too makes the ad repeat the ministry's name against
its own tag and say "dirigido por" on screen right where the voice is about to say it again
out loud. With nothing but a "Dirigido por" line, `titulo` is just the plain service name —
"Culto" here, or whatever this church's recurring slot is generically called — dropping
"dirigido por X" is the invariant, not any particular replacement word: a slug that
already has a bespoke `video/src/ads/<slug>.tsx` (check before writing `titulo` for a
returning `recurrentes` entry) may lean on `titulo`'s own words for its layout — a giant
last word pulled from it for a youth-styled ad, say — and still needs that word present,
just not the "dirigido por" phrase in front of it ("Culto Jóvenes", not "Culto dirigido por
Jóvenes"). Apply the same check anywhere else a fact could land twice: before adding a word
to `titulo` (or a custom `headline`), ask whether `ministerio`, the date/time/place row or
the narration already says it, and leave it out of one of them if so. `hora`, `lugar` and
`ministerio`
come straight from `church-info.md`; leave one out if the file does not say it, the same as
any other event. A `recurrentes` entry that lacks a `titulo`, or whose `dia` is not a
weekday `normalize.mjs` recognizes, is a loud problem (exit 2), not a silently dropped
service.

**Deciding whether a card is the service, or a second event on the same day, is your
judgment — never code's.** For every recurring service, look at that weekday's calendar
cards:

- **No card looks like it**: add the service to `recurrentes` as above. This is the
  ordinary case — most weeks nothing marks the service on the calendar, because it is
  assumed well known but still happens.
- **One card is plainly it** — the same time (or close), or a title that is just the
  service's own name («Culto de jóvenes», «Ayuno»): that card *is* the event. Leave the
  service out of `recurrentes` and read the card as any other event (above); its own time
  and place win. If it carries no time of its own, do not let it fall silently to "sin
  hora" — that throws away a time `church-info.md` already gives for this exact service.
  Raise it instead as the "recurring-service card with no time of its own" doubt at
  Checkpoint 1 (step 4).
- **A card on that day might be the service, or might be a second one** — no time, a
  different time, or a title that names a group rather than repeating the service's own
  name («Culto de caballeros» on a day whose service is not directed by one particular
  group): do **not** decide. Add the service to `recurrentes` *and* leave the card as its
  own event; this is what puts both under the same day at Checkpoint 1, where the
  numbered "two events on one day" doubt asks the person. Two services really can run at
  the same time in different rooms (a men's and a women's service, say), so guessing
  either way risks a fact none of the sources give.
- **A card that would have been the service is cancelled, or a service that usually has
  one has none this week**: still add it to `recurrentes` (`church-info.md` says it runs),
  and raise the "missing or cancelled" doubt at Checkpoint 1 rather than silently
  advertising or silently dropping it.

## Overrides

Human answers live in `overrides/<week>.json`, keyed by slug, and are applied by
step 3. **You write this file from the person's answers** (Checkpoints 1 and 2); they never
edit it. An override is how their answers are kept: a time or place they supply, a time or
place they do not want, the layout, an event they drop. Because it persists, it is also
what stops a question being asked twice. All keys are optional:

```json
{
  "culto-especial": {"hora": "19:00", "lugar": "Salón Principal", "plantilla": "destacado"},
  "retiro-jovenes": {"hora": null},
  "reunion-interna": {"omitir": true}
}
```

| Key | Value | Effect |
|---|---|---|
| `hora` | `"HH:MM"`, 24 h, or `null` | `"HH:MM"` sets the time (its source becomes `usuario`); `null` announces the event without a time, even if the card, the title or a service gave one |
| `lugar` | text, or `null` | text sets the place; `null` announces the event without a place, even the default one |
| `modalidad` | `presencial` or `virtual` | if you set `virtual`, set `plantilla: "virtual"` too |
| `plantilla` | `estandar`, `destacado` or `virtual` | `destacado` is only ever chosen this way |
| `omitir` | `true` | drops the event from the week |

In the person's words: "solo con la fecha" is `hora: null`, "sin lugar" is `lugar: null`,
"omítelo" is `omitir: true`, "anúncialo" removes that `omitir`, and a time or place they
give is `hora` or `lugar`.

A recurring service's slug is `servicio-<día>` or, when it has a time, `servicio-<día>-<hhmm>`
(e.g. `servicio-sabado-1845`) — stable from week to week, never from its title, so
`omitir: true` on it reliably drops just that one service. When the person answers "es el
mismo" to an overlap doubt (§ *Placing the week's recurring services*), write both:
`omitir: true` on the recurring service's slug, and `hora` (and `lugar`, if given) on the
calendar card's own slug, so the card alone carries the service's time.

After editing an override, run step 3 again, then rewrite that event's line in `guion.md`,
update its artboard in the canvas, read it back and export again (step 7), and re-run its
designer if the template changed, validate, show the changed lines (Checkpoint 2) and voice
the week again (step 9). A script or component that no longer follows `events.json` fails
`validate.mjs`. An image that no longer follows `events.json` fails `export-stills.mjs`, not
`validate.mjs`.

## Layout of a week

```
out/<week>/
  raw/<calendar>.json      calendar response, verbatim
  lectura.json             your reading of the titles and church-info.md, written by you
  events.json              the contract
  guion.md                 the week's narration, written by the orchestrator
  voz.mp3, voz.json, voz.alineacion.json   the one voiceover and its per-character timing
  imagenes/                the week's Claude Design canvas, read back from the published artifact
  <slug>/{ad.png, fotograma.png, clip.mp4}   ad.png: export-stills.mjs from the canvas;
                           fotograma.png and clip.mp4: render.mjs (Remotion)
  semana.mp4
out/<week>-<weekday>/      a service's video (step 12): events.json, guion.md, voz.*, semana.mp4
```
