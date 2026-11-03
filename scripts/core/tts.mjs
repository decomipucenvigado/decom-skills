// ElevenLabs text-to-speech, REST only (not the MCP connector) so that a past
// week can be re-generated from version-controlled settings. It voices the whole
// week in one request and asks for per-character timing along with the audio.

import { createHash } from 'node:crypto';

const API = 'https://api.elevenlabs.io/v1/text-to-speech';

/** The request to send: one take of the whole script, with per-character timing. The key goes in a header, never in the URL or body. */
export function buildRequest({ text, voice, voiceId, apiKey }) {
  return {
    url: `${API}/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${voice.output_format}`,
    init: {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        text,
        model_id: voice.model,
        voice_settings: {
          stability: voice.stability,
          similarity_boost: voice.similarity_boost,
          style: voice.style,
          use_speaker_boost: voice.use_speaker_boost,
        },
      }),
    },
  };
}

/** The audio and the per-character alignment out of a with-timestamps response body. */
export function parseTimestampResponse(json) {
  if (typeof json?.audio_base64 !== 'string') throw new Error('the response has no audio_base64');
  const a = json.alignment;
  const ok =
    Array.isArray(a?.characters) &&
    a.character_start_times_seconds?.length === a.characters.length &&
    a.character_end_times_seconds?.length === a.characters.length;
  if (!ok) throw new Error('the response has no per-character alignment');
  return {
    audio: Buffer.from(json.audio_base64, 'base64'),
    alignment: {
      characters: a.characters,
      character_start_times_seconds: a.character_start_times_seconds,
      character_end_times_seconds: a.character_end_times_seconds,
    },
  };
}

/**
 * The text the voice reads: each word of voice.json's `pronunciacion` (e.g. "IPUC", which the voice
 * would spell as an English acronym) swapped, as a whole word, for how it is said ("Ipuc"). The
 * spelling must keep the word's length, so the timing of each character still lands on the script.
 */
export function textoHablado(text, pronunciacion = {}) {
  let hablado = text;
  for (const [palabra, dicha] of Object.entries(pronunciacion ?? {})) {
    if ([...palabra].length !== [...dicha].length) {
      throw new Error(`voice.json pronunciacion "${palabra}" -> "${dicha}": the spelling must keep the same length`);
    }
    const escapada = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    hablado = hablado.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapada}(?![\\p{L}\\p{N}])`, 'gu'), dicha);
  }
  return hablado;
}

/** The spoken text's per-character timing, carrying the script's own characters again (same length by textoHablado). */
export function alineacionDelGuion(alignment, text) {
  if (alignment.characters.join('').length !== text.length) {
    throw new Error('the alignment does not have one character per character of the script');
  }
  let i = 0;
  const caracteres = alignment.characters.map((c) => text.slice(i, (i += c.length)));
  return { ...alignment, characters: caracteres };
}

/** Identifies one exact audio result, so an unchanged script is never paid for twice. */
export function cacheKey({ text, voice, voiceId }) {
  const { model, stability, similarity_boost, style, use_speaker_boost, output_format } = voice;
  return createHash('sha256')
    .update(JSON.stringify({ text, voiceId, model, stability, similarity_boost, style, use_speaker_boost, output_format }))
    .digest('hex');
}

/** Accepts the names CLAUDE.md documents and the ones already used in .env. */
/** The key comes from the environment; the voice is the one scripts/voice.json names, else the environment's. */
export function resolveCredentials(env, voice = {}) {
  return {
    apiKey: env.ELEVENLABS_API_KEY || env.ELEVEN_LABS_API_KEY || null,
    voiceId: voice.voiceId || env.ELEVENLABS_VOICE_ID || env.ELEVEN_LABS_VOICE_ID || null,
  };
}
