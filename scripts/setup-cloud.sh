#!/usr/bin/env bash
#
# Prepares this repo on a fresh Debian/Ubuntu machine (cloud VM, container, CI).
# Idempotent: safe to re-run.
#
#   bash scripts/setup-cloud.sh [--skip-apt] [--skip-render-check]
#
#   --skip-apt           do not touch system packages (no root, or already installed)
#   --skip-render-check  skip the still render that proves Chromium launches
#
# The repo is found from REPO_ROOT, this file's location, the current directory or
# a git checkout, so it also works pasted into an environment's setup script (which
# runs it from a temp copy such as /tmp/init-script-N.sh). Set REPO_ROOT if none of
# those points at it.
#
# It does not do what needs a person, and says so at the end: connecting Google
# Calendar (a claude.ai connector), setting the ElevenLabs credentials, and
# signing in to Claude Code. See INSTALL.md steps 5 and 6.

set -Eeuo pipefail

ROOT=""   # set by locate_repo
NODE_MAJOR_MIN=22
NVM_VERSION="v0.40.3"

SKIP_APT=0
SKIP_RENDER_CHECK=0
for arg in "$@"; do
  case "$arg" in
    --skip-apt) SKIP_APT=1 ;;
    --skip-render-check) SKIP_RENDER_CHECK=1 ;;
    -h|--help) sed -n '2,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

PENDING=()
NEED_NODE_PATH_HINT=""
BROWSER_FALLBACK=""
BROWSER_SNAP=""

step() { printf '\n==> %s\n' "$*"; }
ok()   { printf '    ok: %s\n' "$*"; }
warn() { printf '    warning: %s\n' "$*" >&2; }
die()  { printf '\nerror: %s\n' "$*" >&2; exit 1; }
on_err() { die "failed at line $1: $2"; }
trap 'on_err "$LINENO" "$BASH_COMMAND"' ERR

# nvm is written for interactive shells: it runs commands that fail on purpose, and
# it uses unset variables. The ERR trap is inherited into functions (set -E), so all
# three guards come off while nvm runs and go back on right after.
relax()   { trap - ERR; set +eu; }
tighten() { set -eu; trap 'on_err "$LINENO" "$BASH_COMMAND"' ERR; }

# Runs a command as root: directly, or through passwordless sudo. Returns 1 when
# neither is possible, so callers can degrade instead of hanging on a prompt.
as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"
  elif command -v sudo >/dev/null 2>&1; then sudo -n "$@"
  else return 1
  fi
}

can_root() { [ "$(id -u)" -eq 0 ] || { command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; }; }

# --- 1. System packages: what Remotion's headless Chromium links against -------

install_system_deps() {
  if [ "$SKIP_APT" -eq 1 ]; then ok "skipped (--skip-apt)"; return; fi
  if ! command -v apt-get >/dev/null 2>&1; then
    warn "no apt-get here; install Chromium's shared libraries yourself (step 5 names any that are missing)"
    return
  fi
  if ! can_root; then
    warn "no root or passwordless sudo; skipping apt (step 5 names any library that is missing)"
    return
  fi

  # sudo drops the caller's environment, so the variable travels through env(1).
  as_root env DEBIAN_FRONTEND=noninteractive apt-get update -qq

  # Ubuntu 24.04 and Debian 13 renamed many of these to <name>t64; take whichever exists.
  pick() {
    local p
    for p in "${1}t64" "$1"; do
      if apt-cache show "$p" >/dev/null 2>&1; then echo "$p"; return; fi
    done
    echo "$1"
  }

  local pkgs=(ca-certificates curl)
  local lib
  for lib in libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 \
             libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 \
             libpango-1.0-0 libcairo2 libcups2; do
    pkgs+=("$(pick "$lib")")
  done
  as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${pkgs[@]}"
  ok "system libraries installed"
}

# --- 2. Node 22+ -----------------------------------------------------------------

node_ok() {
  command -v node >/dev/null 2>&1 &&
    [ "$(node -p 'process.versions.node.split(".")[0]')" -ge "$NODE_MAJOR_MIN" ]
}

# Loads nvm into this shell if it is installed; returns 1 if it is not.
use_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [ -s "$NVM_DIR/nvm.sh" ] || return 1
  relax
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  tighten
}

ensure_node() {
  if node_ok; then ok "node $(node -v)"; return; fi

  # An nvm install may exist without being on PATH (a non-interactive shell never reads .bashrc).
  if use_nvm; then
    relax; nvm use "$NODE_MAJOR_MIN" >/dev/null 2>&1 || true; tighten
    if node_ok; then ok "node $(node -v) (via existing nvm)"; NEED_NODE_PATH_HINT=1; return; fi
  fi

  command -v curl >/dev/null 2>&1 || die "curl is needed to install Node and is missing; install curl or Node $NODE_MAJOR_MIN+ and re-run"
  step "Installing Node $NODE_MAJOR_MIN with nvm $NVM_VERSION"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
  fi
  use_nvm || die "nvm did not install correctly"
  local rc=0
  relax; nvm install "$NODE_MAJOR_MIN" && nvm alias default "$NODE_MAJOR_MIN" >/dev/null || rc=1; tighten
  if [ "$rc" -ne 0 ] || ! node_ok; then die "could not get Node $NODE_MAJOR_MIN+"; fi
  NEED_NODE_PATH_HINT=1
  ok "node $(node -v)"
}

# --- 3. Dependencies (video/ is the only package; scripts/ uses Node built-ins) ---

install_deps() {
  if npm ci --prefix "$ROOT/video" --no-audit --no-fund; then
    ok "npm ci"
  else
    warn "npm ci failed (lockfile out of sync with package.json?); falling back to npm install"
    npm install --prefix "$ROOT/video" --no-audit --no-fund
    ok "npm install"
  fi
}

# registry.gen.ts is git-ignored, and AdScene.tsx imports it: without this a clean
# clone fails to type-check and to bundle.
gen_registry() { node "$ROOT/scripts/gen-registry.mjs"; }

# --- 4. Chromium ------------------------------------------------------------------

find_system_chromium() {
  local bin
  for bin in chromium chromium-browser google-chrome google-chrome-stable; do
    if command -v "$bin" >/dev/null 2>&1; then command -v "$bin"; return 0; fi
  done
  return 1
}

# Ubuntu ships "chromium" as a snap: a stub script that starts the snap, whose sandbox has its
# own private /tmp. The image export (scripts/export-stills.mjs) stages the canvas and a browser
# profile under the OS temp dir, which a snap Chromium may not be able to read.
is_snap_chromium() {
  local real
  real="$(readlink -f "$1" 2>/dev/null || printf '%s' "$1")"
  case "$real" in /snap/*|*/snap/bin/*) return 0 ;; esac
  # a script (shebang) that mentions snap is the Ubuntu stub; a real binary is never read as text
  [ "$(head -c 2 "$1" 2>/dev/null)" = '#!' ] && grep -qi 'snap' "$1" 2>/dev/null
}

ensure_chromium() {
  if [ -n "${REMOTION_BROWSER_EXECUTABLE:-}" ] && [ -x "$REMOTION_BROWSER_EXECUTABLE" ]; then
    ok "using REMOTION_BROWSER_EXECUTABLE=$REMOTION_BROWSER_EXECUTABLE"
    return
  fi

  if (cd "$ROOT/video" && npx remotion browser ensure); then
    ok "Remotion's own Chromium is available"
    return
  fi

  # PLAN.md: remotion.media has answered 403 from some hosted environments.
  warn "Remotion could not download its Chromium; falling back to a system one"
  local path
  path="$(find_system_chromium || true)"
  if [ -z "$path" ] && [ "$SKIP_APT" -eq 0 ] && command -v apt-get >/dev/null 2>&1 && can_root; then
    as_root apt-get install -y --no-install-recommends chromium || true
    path="$(find_system_chromium || true)"
  fi
  [ -n "$path" ] || die "no Chromium: set REMOTION_BROWSER_EXECUTABLE to an existing one and re-run"

  if is_snap_chromium "$path"; then
    BROWSER_SNAP=1
    warn "$path is a snap Chromium; the image export may not read its files under /tmp (see the end of this output)"
  fi

  export REMOTION_BROWSER_EXECUTABLE="$path"
  BROWSER_FALLBACK="$path"
  if ! grep -qs 'REMOTION_BROWSER_EXECUTABLE' "$HOME/.bashrc"; then
    printf 'export REMOTION_BROWSER_EXECUTABLE="%s"\n' "$path" >> "$HOME/.bashrc"
  fi
  ok "using system Chromium at $path"
}

# A missing shared library makes Chromium die at launch with an opaque error;
# ldd names it up front. Only meaningful for Remotion's own binary.
check_chromium_libs() {
  [ -z "$BROWSER_FALLBACK" ] || return 0
  command -v ldd >/dev/null 2>&1 || return 0
  local bin missing
  bin="$(find "$ROOT/video/node_modules/.remotion" -type f \( -name chrome-headless-shell -o -name headless_shell \) 2>/dev/null | head -n1 || true)"
  [ -n "$bin" ] || return 0
  missing="$(ldd "$bin" 2>/dev/null | grep 'not found' || true)"
  if [ -n "$missing" ]; then
    printf '%s\n' "$missing" >&2
    die "Chromium is missing the libraries above; install them (apt-get install ...) and re-run"
  fi
  ok "Chromium links against every shared library"
}

# One still of a sample composition: bundles the project and launches Chromium,
# the same path render.mjs takes. It does not render a week or call any paid API.
render_check() {
  if [ "$SKIP_RENDER_CHECK" -eq 1 ]; then ok "skipped (--skip-render-check)"; return; fi
  local tmp
  tmp="$(mktemp -d)"
  if (cd "$ROOT/video" && npx remotion still Muestra-estandar "$tmp/check.png" --log=error); then
    [ -s "$tmp/check.png" ] || { rm -rf "$tmp"; die "the still render produced no image"; }
    ok "rendered a 1920x1080 still"
    rm -rf "$tmp"
  else
    rm -rf "$tmp"
    die "the still render failed; the message above is the one to act on"
  fi
}

# --- 5. Checks that need no network -----------------------------------------------

run_checks() {
  node --test "$ROOT"/scripts/test/*.test.mjs >/dev/null || die "unit tests failed: run 'node --test scripts/test/*.test.mjs' to see which"
  ok "unit tests pass"
  (cd "$ROOT/video" && npx tsc --noEmit) || die "type-check failed"
  ok "tsc --noEmit"
}

# --- 6. What only a person can finish ---------------------------------------------

# Reads .env by name only: values are never printed.
has_credential() {
  local suffix="$1" name
  for name in "ELEVENLABS_$suffix" "ELEVEN_LABS_$suffix"; do
    [ -n "${!name:-}" ] && return 0
    [ -f "$ROOT/.env" ] && grep -Eq "^[[:space:]]*(export[[:space:]]+)?$name=.+" "$ROOT/.env" && return 0
  done
  return 1
}

collect_pending() {
  [ -f "$ROOT/church-info.md" ] || PENDING+=("church-info.md is missing: copy church-info.example.md and fill in the congregation's facts (INSTALL.md step 7)")
  has_credential API_KEY  || PENDING+=("ElevenLabs API key: set ELEVEN_LABS_API_KEY in the environment or in .env (paid plan needed for shared-library voices)")
  has_credential VOICE_ID || PENDING+=("ElevenLabs voice: set ELEVEN_LABS_VOICE_ID in the environment or in .env")
  if command -v claude >/dev/null 2>&1; then
    PENDING+=("Google Calendar: run 'claude mcp list' and look for 'claude.ai Google Calendar ... Connected'. If it is not there, connect it in claude.ai -> Settings -> Connectors, on the account signed in to Claude Code here")
  else
    PENDING+=("Claude Code is not installed here: install it and sign in; the weekly run is driven by the church-ads skill")
    PENDING+=("Google Calendar: connect it in claude.ai -> Settings -> Connectors, on the account you sign in to Claude Code with (INSTALL.md step 5)")
  fi
  PENDING+=("Claude Design: the event images are built with the Artifact tool (Design type) in the church-ads skill, step 5. Check that the Claude Code session here can create a Design artifact (INSTALL.md step 6b); without it the image step cannot run")
}

summary() {
  printf '\n----------------------------------------------------------------\n'
  printf 'Setup finished: Node, dependencies, Chromium and the checks are in place.\n'
  if [ "${#PENDING[@]}" -gt 0 ]; then
    printf '\nStill needs a person:\n'
    local item
    for item in "${PENDING[@]}"; do printf '  - %s\n' "$item"; done
  fi
  if [ -n "$NEED_NODE_PATH_HINT" ]; then
    printf '\nNode came from nvm. Non-interactive shells (including the Claude Code Bash tool) do not\n'
    printf 'read ~/.bashrc, so put it on PATH there with:\n'
    printf '  export PATH="%s:$PATH"\n' "$(dirname "$(command -v node)")"
  fi
  if [ -n "$BROWSER_FALLBACK" ]; then
    printf '\nRemotion could not download its Chromium, so renders and the image export use %s.\n' "$BROWSER_FALLBACK"
    printf 'Make sure this is set wherever you render or export images. ~/.bashrc is not read by\n'
    printf 'non-interactive shells (including the Claude Code Bash tool), so set it in the\n'
    printf "environment's variables, not only there:\n"
    printf '  export REMOTION_BROWSER_EXECUTABLE="%s"\n' "$BROWSER_FALLBACK"
  fi
  if [ -n "$BROWSER_SNAP" ]; then
    printf '\nThat Chromium is a snap, and its sandbox has its own /tmp. If export-stills.mjs cannot load\n'
    printf 'the canvas, point the OS temp dir at a folder under your home and run it again:\n'
    printf '  mkdir -p "$HOME/tmp" && export TMPDIR="$HOME/tmp"\n'
    printf 'or install a Chromium that is not a snap. This has not been tested here.\n'
  fi
  printf '\nRendering is CPU-bound: about 10x realtime at 1080p on 4 cores (PLAN.md), so a\n'
  printf 'six-event week is a 20-25 minute job there. Size the machine for that.\n'
}

# --- Locating the repo ------------------------------------------------------------

is_repo() { [ -f "$1/video/package.json" ] && [ -f "$1/scripts/gen-registry.mjs" ]; }

TRIED=()

# A cloud environment may run this file from a temp copy, so where the file sits says
# nothing about where the repo is. Tries, in order: $REPO_ROOT, the file's parent, the
# current directory, the git checkout containing the current directory, and finally a
# single checkout under the usual places. Sets ROOT; returns 1 if there is none or the
# search is ambiguous.
resolve_root() {
  local cand top m
  for cand in "${REPO_ROOT:-}" "$(dirname "${BASH_SOURCE[0]:-.}")/.." "$PWD"; do
    [ -n "$cand" ] || continue
    TRIED+=("$cand")
    if is_repo "$cand"; then ROOT="$(cd "$cand" && pwd)"; return 0; fi
  done

  top="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -n "$top" ]; then
    TRIED+=("git checkout: $top")
    if is_repo "$top"; then ROOT="$top"; return 0; fi
  fi

  local found=()
  while IFS= read -r m; do
    top="$(dirname "$(dirname "$m")")"
    if is_repo "$top"; then found+=("$top"); fi
  done < <(find "$HOME" /home /workspace /workspaces /repo /repos /mnt /opt /srv -maxdepth 5 \
             \( -name node_modules -o -name .nvm -o -name .npm -o -name .cache -o -name .git \) -prune -o \
             -type f -path '*/scripts/gen-registry.mjs' -print 2>/dev/null | sort -u || true)
  TRIED+=("search under \$HOME /home /workspace /workspaces /repo /repos /mnt /opt /srv: ${#found[@]} match(es) ${found[*]:-}")
  if [ "${#found[@]}" -eq 1 ]; then ROOT="${found[0]}"; return 0; fi
  return 1
}

locate_repo() {
  printf '    cwd: %s\n    script: %s\n' "$PWD" "${BASH_SOURCE[0]:-stdin}"
  if resolve_root; then ok "repo at $ROOT"; return; fi
  local msg item
  msg="could not find the repo (it has video/package.json and scripts/gen-registry.mjs).
Looked at:"
  for item in "${TRIED[@]}"; do msg+=$'\n'"  - $item"; done
  msg+=$'\n'"System libraries and Node are already set up. Either set REPO_ROOT to the checkout's"
  msg+=$'\n'"path, or, if this ran before the repo was cloned, run it from the checkout instead:"
  msg+=$'\n'"  bash scripts/setup-cloud.sh"
  die "$msg"
}

step "1/7 System libraries for Chromium"; install_system_deps
step "2/7 Node $NODE_MAJOR_MIN+";            ensure_node
step "3/7 Locating the repo";               locate_repo
step "4/7 Dependencies (video/)";           install_deps; gen_registry
step "5/7 Chromium";                        ensure_chromium; check_chromium_libs; render_check
step "6/7 Unit tests and type-check";       run_checks
step "7/7 What is left for a person";       collect_pending
summary
