# Script rules (`guion.md`)

The narration of the whole week, in one file: `out/<week>/guion.md`. The orchestrator
writes it, once, with every event of `events.json` in view; that is what lets the video
sound like one piece instead of separate ads. It is read aloud to the church and
published, so an invented detail here reaches real people.
`node scripts/validate.mjs <week> --narracion` catches many slips; it is a net, not
proof, and the orchestrator reads the whole script against `events.json` before it is
voiced.

## The one rule

State nothing that is not in `out/<week>/events.json`: the event's own record and
the `iglesia` block. That covers everything you would be tempted to add: a speaker,
a topic, a theme, "trae tu Biblia", food, a dress code, an age range, a price, "es
gratis", an address that is not `iglesia.direccion`. If it is not in the record, it
is not in the script. A short script that says less is correct.

## Language and register

- Spanish (Colombia). Address the listener as **tú**: "te invitamos", "ven", "trae".
  Never `usted`, `ustedes`, "los esperamos", "les invitamos".
- The intro's "Bienvenidos" is the church's own greeting: keep it.
- Warm and direct, spoken sentences. No slogans, no hype, no exclamation stacks.
- Write for the ear: real accents and punctuation (the voice reads them), no
  abbreviations, no emoji, and no digits: dates are spoken as words.

## Shape of the piece

Three kinds of section, in this order, each under a `## <id>` heading: `intro`, one
section per event (its `slug`, in `events.json` order), and `outro`.

### intro

"Bienvenidos a *iglesia.nombre*, estos son nuestros eventos *semana.hablada*." A church's
style notes may word it its own way ("esta es la programación para la semana *semana.hablada*");
the name and `semana.hablada` must still be in it.
`semana.hablada` is copied verbatim from `events.json` ("del veintiuno al veintisiete de
septiembre"). If `iglesia.nombre` is `null`, leave the name out and add nothing in its
place.

### Event lines

- One or two spoken sentences: what (the title, and `ministerio` if there is one), the
  day (`diaSemana`), the time if there is one, the place if there is one.
- `church-info.md` may carry its own style notes (how it wants a ministry named — some
  churches say "dirigido por el comité de X" rather than a bare "dirigido por X" — or
  whether to state the usual place every time). Follow them; absent one, name the
  ministerio plainly and state the place whenever the event has one, per the rules below.
  Never invent a phrasing style the file does not ask for.
- Put the parts in whatever order suits the sentence. Do not use one template for every
  event: vary how each line opens, and let the lines lead into each other ("El lunes…",
  "Después, el miércoles…", "Y el viernes…"). No two neighbouring events open with the
  same words.
- A connector may only say something true of the list order. Never "el último evento de
  la semana", "no te lo pierdas", "este fin de semana": the calendar may hold events the
  list does not.
- No greeting, no call to action, no blessing: they belong to the intro and the outro.
- About 8 to 25 words. `validate` gives a notice outside 6 to 30.

### outro

The church's own closing words, verbatim and in this order: `iglesia.llamadoAccion`, then
`iglesia.despedida` ("Te esperamos, Dios te bendiga."). One missing from `church-info.md`
is simply absent; both missing means no outro section.

## Time

- Say the time exactly as `event.horaHablada` ("a las siete de la noche"). Do not
  re-derive it from `hora`, and do not convert it to digits.
- `hora` is `null`: **mention no time at all.** No clock time, no "por la noche",
  no "a la hora de siempre", no "por confirmar". The line gives the day only.
- The day of the week, if named, is `event.diaSemana`, or one the title itself
  already contains.

## Relative dates

Avoid "hoy", "mañana", "pasado mañana", "esta noche", "ayer". The video is watched
on any day of the week, so a relative word is wrong most of the time. Say "el
viernes". The one exception is a video with a known publishing day that the church
asks for in its style notes (`church-info.md`) or the person asks for: the week's
video published on the Saturday before may say "mañana domingo". `validate.mjs` does
not stop it, so it is your call; never carry it into a service's video, which plays
on another day.

## Place

- Use `event.lugar` as written. `lugar` is `null`: name no place.
- `modalidad: "virtual"`: never point it at an in-person place. `modalidad:
  "presencial"`: never say Zoom, virtual, online, "enlace" or "link". A meeting ID,
  a link or a password is never in the script.
- Stating the place every time is the default. If `church-info.md` says to skip the
  usual place (a church whose events nearly all share one default place may prefer this,
  since repeating it in every line reads as filler), state it only when `event.lugar`
  differs from `iglesia.lugarPorDefecto` — a virtual event, or one somewhere else.

## Numbers

A digit may appear only if it is already in the record (the title, `fechaTexto`,
`horaTexto`, `lugar`), and never in the intro or the outro. Do not add counts, ages,
years or prices.

## Odd words

Keep the words of an event's title as the calendar wrote them ("Refam", "Oracion
virtual"): that is the church's own name for the event. Fit them into a natural
sentence, but do not rename the event. The intro speaks the church's name aloud, which
no script did before. If the name or a title looks like an acronym the voice may
mispronounce ("IPUC", "Refam"), do not respell it in the script: tell the person to
listen right after the first voicing.

## Format of `guion.md`

Spoken text only. `# ` lines and `<!-- ... -->` comments are ignored by both
`validate.mjs` and `tts.mjs`; a section starts at each `## <id>` line, and everything
else is sent to the voice in one request, so a note to yourself belongs in a comment.

A fictional week, one event with a time and one without:

```markdown
## intro
Bienvenidos a Iglesia Ejemplo, estos son nuestros eventos del veintiuno al veintisiete de septiembre.

## retiro-familias
<!-- sin hora en el registro: la línea no menciona ninguna -->
El viernes, el retiro de familias, en el Salón Principal.

## culto-jovenes
Y el sábado, el culto de jóvenes, a las seis y cuarenta y cinco de la tarde, también en el Salón Principal.

## outro
Te esperamos, Dios te bendiga.
```

Check the whole script against these before voicing it; every edit is a new charge for
the entire week:

- Is every fact in the record? Delete each one that is not.
- Is there a time? Then is it `horaHablada`, verbatim? No time: is there no hint of one?
- Does an event line say the call to action or the blessing? Move it to the outro.
- Do two neighbouring events open with the same words? Rewrite one.
- Is the intro's week exactly `semana.hablada`, and the outro exactly the closing words?
- Is it `tú` all the way through?
