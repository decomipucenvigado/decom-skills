# INSTALL.md — set up this repo on a new machine, for a congregation

This file is written **for you, the agent**, not for the human. Read it top to bottom and
execute it as a checklist, in order — most steps only make sense after the one before.
The human present is either a technical admin or church staff; when a step needs facts
only they have, ask for exactly that fact and nothing else, wait for the answer, and
keep going. Do not skip a step because it looks optional — each one exists because a
past run needed it.

This installs the tool as-is for **another IPUC congregation**. The brand (logo, colors,
fonts) is the organization's, shared by every congregation on purpose, and lives in code
(`video/src/brand/tokens.ts`, `brand/`) — see CLAUDE.md § Scope. If the person setting up
is *not* an IPUC congregation, stop after step 0 and say so: reusing the code for a
different brand is a real rewrite (new tokens, new logo, new motifs), not a config change,
and is out of scope for this file.

Read `CLAUDE.md` and `PLAN.md` §6 (Environment) before starting; this file only sequences
what they already document — it does not restate the reasoning.

## Step 0 — Confirm scope

Ask: "¿Esta instalación es para otra congregación de la IPUC?" If no, stop here and say
why (see above) instead of proceeding.

## Step 1 — Get the code onto this machine

If this file is already present, the repo is already here — skip to step 2. Otherwise:

```bash
git clone <the repo's URL, given by the person> decom-skills
cd decom-skills
```

On a fresh Debian or Ubuntu machine (a cloud VM, a container, CI), `bash scripts/setup-cloud.sh`
does steps 2 to 4 for you and runs the unit tests and the type-check. It is idempotent, and it
ends with a list of what only a person can finish (steps 5, 6, 6b and 7). Run it first, then
continue from step 5.

There is no root `package.json`: everything under `scripts/` runs on Node's built-ins
only (`node:fs`, `node:path`, `node:child_process`, …). The only install step is `video/`
(step 3).

## Step 2 — Verify Node

```bash
node -v
```

Needs Node 22 or newer (built and verified on v22.23.2). If `node` is not found, look for
an existing nvm install before asking the person to install one:

```bash
ls "$HOME/.nvm/versions/node/" 2>/dev/null
export PATH="$HOME/.nvm/versions/node/<version found>/bin:$PATH"
```

If nothing is there, ask the person to install Node 22+ (nvm is the least surprising way
on Linux) and re-run this step.

## Step 3 — Install the Remotion project's dependencies

```bash
(cd video && npm install)
```

This is the only `npm install` in the repo. Confirm it finished without errors before
continuing.

## Step 4 — Verify rendering works on this machine

Remotion bundles its own ffmpeg inside
`video/node_modules/@remotion/compositor-linux-*-gnu/` — there is no system ffmpeg to
install. Confirm the package matching this machine's arch is present:

```bash
ls video/node_modules/@remotion/ | grep compositor
```

Remotion also needs a Chromium. Try letting it use its own first:

```bash
(cd video && npx remotion still HelloWorld /tmp/install-check.png 2>&1 | tail -20)
```

(`HelloWorld` may not exist as a composition name in this project — if it errors with
"composition not found," that's fine, it proves Chromium launched; a browser-launch error
is the one to act on.)

- If Chromium fails to **download**, or launches but crashes with missing shared
  libraries: on Linux, run `ldd` on Remotion's `headless_shell` binary (find it under
  `video/node_modules/@remotion/`) and install whatever it reports missing
  (`libnss3`, `libnspr4`, and similar — the exact list is machine-specific). If the
  person cannot install system packages, find or ask for an existing Chromium binary on
  the machine and set `REMOTION_BROWSER_EXECUTABLE` to its path; `render.mjs` and
  `remotion still`/`studio` fall back to Remotion's own Chromium when it is unset, so
  this is additive, not a config file to edit.
- Clean up the scratch file afterward: `rm -f /tmp/install-check.png`.
- The image export (`scripts/export-stills.mjs`) uses the same browser: `REMOTION_BROWSER_EXECUTABLE`
  when it is set, otherwise the headless shell Remotion installed under `video/node_modules/.remotion/`
  (named `chrome-headless-shell`, or `headless_shell` on Linux arm64). It never downloads one, so on a
  machine that has never rendered run `(cd video && npx remotion browser ensure)` first. If you point
  `REMOTION_BROWSER_EXECUTABLE` at the system's Chromium on Ubuntu, check that it is not a snap: a snap
  has its own private `/tmp`, so the export may not read its staged files. Set `TMPDIR` to a folder under
  `$HOME` or use a Chromium that is not a snap. And since non-interactive shells (the Claude Code Bash
  tool) do not read `~/.bashrc`, set the variable in the environment's own settings.

Do not attempt to install a system ffmpeg or ffprobe — the bundled one is deliberately
used instead (see CLAUDE.md § Environment); if audio-level measurement is ever needed,
decode to `pcm_s16le` WAV and compute RMS in Node, not with `ffprobe -af volumedetect`
(the bundled build is trimmed and lacks it).

## Step 5 — Connect Google Calendar

This is the step most likely to trip someone up, because it is **not** a repo file, not
an `.env` value, and not something in Claude Code's `/plugin` marketplace. It is a
**claude.ai account-level connector**: Google's own remote MCP server
(`https://calendarmcp.googleapis.com/mcp/v1`), tied to whichever account is logged into
Claude Code, not to this project.

Check first:

```bash
claude mcp list
```

Look for a line reading `claude.ai Google Calendar: ... - ✔ Connected`. If it's there,
this step is already done — skip to verification below.

If it's missing (or shows "Needs authentication"), do **not** look in `/plugin` — that
manages Claude Code's own plugins (skills/agents/bundled MCP servers), which is a
different system. You may also see a decoy line like
`plugin:engineering:google calendar: ... - Not configured`: that belongs to an unrelated
plugin and is never the one this project needs, even though the name is nearly
identical. Instead, tell the person plainly:

1. Sign in to **claude.ai** in a browser, on the account that will run Claude Code here.
2. Go to **Settings → Connectors**, connect **Google Calendar**, and authorize the
   Google account that has the church's calendar. (Whether this needs a paid claude.ai
   plan is worth them checking on that page — do not assume either way.)
3. Back here, run `claude mcp list` again (a fresh Claude Code session may be needed) and
   confirm it now shows `✔ Connected`.

This is an OAuth flow only the person can complete — do not attempt it on their behalf.

Once connected, verify with `list_calendars` and confirm at least one calendar name
contains the new congregation's name (the `church-ads` skill matches calendars this way
later). If none does, that's fine — it will just mean asking the person to name the
calendar explicitly on the first real run.

## Step 6 — ElevenLabs credentials

`.env` at the repo root is git-ignored and holds two values `scripts/tts.mjs` reads
(directly, or via the `ELEVENLABS_*` spelling):

```
ELEVEN_LABS_API_KEY=...
ELEVEN_LABS_VOICE_ID=...
```

Ask the person for both, one at a time:

1. **`ELEVEN_LABS_API_KEY`** — their ElevenLabs API key. Note for them: voices from
   ElevenLabs' shared library (the usual choice for a Colombian Spanish voice) only work
   over the API on a **paid** ElevenLabs plan (the free tier returns
   `402 paid_plan_required`) — ask whether their plan is paid before treating a later
   `402` as a bug.
2. **`ELEVEN_LABS_VOICE_ID`** — the ID of the voice they want. If they don't have one
   picked yet, the ElevenLabs MCP connector (`creative_list_voices`) is a good way to
   audition candidates together — pick a Latin-American Spanish voice; PLAN.md §Phase 0
   for context. This ID is the one thing that is genuinely per-congregation in `.env`;
   the model and voice *settings* are shared and already committed in `scripts/voice.json`
   — do not ask about those unless the person specifically wants a different model or
   stability/similarity setting.

Write the file yourself once both values are given:

```bash
cat > .env <<'EOF'
ELEVEN_LABS_API_KEY=<value the person gave>
ELEVEN_LABS_VOICE_ID=<value the person gave>
EOF
```

**Never print these values back**, in this step or later, and never commit `.env` (it is
already in `.gitignore` — do not remove that line).

## Step 6b — Claude Design (the event images)

The image of each event (`ad.png`) is not rendered by Remotion. The `church-ads` skill builds it
in a **Claude Design canvas** with the Artifact tool (Design type), reads the canvas back to
`out/<week>/imagenes/` and exports it with `node scripts/export-stills.mjs <week>` (SKILL.md
step 5 and step 7). The video itself is still rendered by Remotion.

Check that the Claude Code session on this machine can use it: the Artifact tool must be
available and able to create a Design artifact. If it is not, the image step cannot run: tell
the person plainly, because the rest of the week (the video and the voice) would still work but
without images. Do not try to work around it. The artifact is private to the account signed in
to Claude Code; nothing is shared unless the person chooses to.

## Step 7 — This congregation's facts

`church-info.md` at the repo root is what makes this copy of the tool belong to *this*
congregation instead of the one it was copied from — it is tracked in git (not a secret)
but every congregation's copy has its own. If the repo still has another congregation's
`church-info.md`, it must be replaced now, not merged.

Show the person `church-info.example.md` (or just its field list) and ask, in plain
Spanish since this is church staff, for their own version of each — free text, no format
required, typos are fine, and anything they skip is simply absent from the ads, never
guessed:

- **Nombre** — el nombre de la congregación (se dice una vez en la bienvenida del video).
- **Direccion** — aparece en el cierre del video.
- **Lugar por defecto** — dónde es un evento cuando su tarjeta no dice nada.
- **Ministerios** — los grupos de la iglesia (Jóvenes, Familias...), para etiquetar el
  público de cada evento.
- **Llamado a la accion** — la frase que cierra el video de la semana (por ejemplo, "Te
  esperamos").
- **Despedida** (opcional) — lo que se dice justo después (por ejemplo, "Dios te
  bendiga").
- **Servicios recurrentes** — el día y la hora de inicio de cada culto fijo de la semana,
  y su nombre si hay dos el mismo día (por ejemplo, uno de damas y otro de caballeros).

Write their answers to `church-info.md` in that same free-text style (a list is fine, see
`church-info.example.md`). Do not invent or infer any of these facts — an empty field
stays empty, exactly as hard rule 1 requires for events later.

## Step 8 — Confirm shared brand assets need no changes

Nothing to do here for an IPUC congregation — the logo (`brand/logo/`), the identity
manual (`brand/corporate-brand.md`), the color/type tokens
(`video/src/brand/tokens.ts`), and the seven cached motif images
(`video/public/motifs/*.png`) are the organization's, already committed, and shared by
every congregation by design (CLAUDE.md § Scope). Just confirm they're present:

```bash
ls brand/logo/ video/public/motifs/
```

One known, pre-existing gap worth mentioning to the person once: the brand manual's
typeface (Myriad Pro) is not vendored, so renders currently use Montserrat as a
placeholder (`brand/fonts/`). This is a standing to-do for the org, not something to fix
per-installation.

## Step 9 — Smoke-test the install

```bash
(cd video && npx tsc --noEmit)
```

This alone proves Node, `npm install` and the TypeScript toolchain are sound. The unit tests
go further: `node --test scripts/test/*.test.mjs` also launches the browser for the image
exporter, so a green run proves Chromium and its launch options work here (a test that says
"no headless Chromium found" is skipped, so read the summary line: skipped should be 0). It does
not exercise rendering or TTS — do not fabricate a fake week to test those; the real proof is
running the `church-ads` skill on the congregation's actual first week once the person is
ready, which will exercise Google Calendar, `.env`, and Chromium/ffmpeg together end to
end.

## Step 10 — Report back

Tell the person, plainly, what is now true and what is still open:

- Node, `video/`'s dependencies, and rendering are confirmed working on this machine.
- Whether Google Calendar is connected, or still needs their action (step 5).
- Whether Claude Design is available for the event images (step 6b).
- `.env` is written (never repeat the values).
- `church-info.md` now has this congregation's facts (name what was written).
- The Montserrat/Myriad Pro gap (step 8), so it isn't a surprise later.
- That the tool is ready for its first real week — offer to run it now if they'd like:
  "Haz los anuncios de esta semana."
