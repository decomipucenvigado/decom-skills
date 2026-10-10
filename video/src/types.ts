import type React from 'react';

export type Plantilla = 'destacado' | 'estandar' | 'virtual';

/** One record of out/<week>/events.json. Ads may state nothing that is not in it. */
export type EventRecord = {
  slug: string;
  eventId: string | null;
  /** `calendario`: a card of the church's calendar. `recurrente`: one of the church's recurring services, with no card. */
  origen: 'calendario' | 'recurrente';
  titulo: string;
  ministerio: string | null;
  fecha: string;
  fechaFin?: string;
  diaSemana: string;
  fechaTexto: string;
  hora: string | null;
  horaTexto: string | null;
  horaHablada: string | null;
  horaFuente: string | null;
  horaNota?: string;
  lugar: string | null;
  lugarFuente: string | null;
  lugarNota?: string;
  modalidad: 'presencial' | 'virtual';
  plantilla: Plantilla;
};

/** The `iglesia` block of events.json, taken from church-info.md. */
export type Iglesia = {
  nombre: string | null;
  direccion: string | null;
  lugarPorDefecto: string | null;
  llamadoAccion: string | null;
  /** Said and shown right after the call to action (e.g. a blessing); null when church-info.md has none. */
  despedida: string | null;
};

export type AdProps = {event: EventRecord; iglesia: Iglesia};

/** What every video/src/ads/<slug>.tsx exports as `Ad`. */
export type AdComponent = React.FC<AdProps>;

/** Props of the single-event composition; render.mjs builds them from out/<week>/ (core/render-plan.mjs). */
export type EventAdProps = {
  slug: string;
  event: EventRecord;
  iglesia: Iglesia;
  /** The slice of the week's voiceover this event speaks (seconds into the file), or null for a silent clip. */
  voz: {src: string; fromSec: number; toSec: number} | null;
  /** Words of this event's line in guion.md; sizes the clip when there is no voiceover. */
  palabras: number;
  /** Path under public/ of the event's exported image (ad.png), shown instead of its ad component; null when it has none. */
  imagen?: string | null;
};

export type WeeklyReelProps = {
  semanaTexto: string;
  iglesia: Iglesia;
  items: EventAdProps[];
  /** Path under public/ of the music bed, or null for none. */
  musicSrc: string | null;
  /** Length in frames of each scene, in order: intro card, one per item, outro card. Overlaps count once (see timing.reelFrames). */
  frames: number[];
  /** Frame at which the narration starts: after the lead-in. */
  voiceStartFrame: number;
  /** The one voiceover of the whole reel, or null for a silent reel. */
  narration: {audioSrc: string; audioSeconds: number} | null;
};
