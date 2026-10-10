import React from 'react';
import {AbsoluteFill, Html5Audio, Sequence, staticFile} from 'remotion';
import type {CalculateMetadataFunction} from 'remotion';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {linearTiming, TransitionSeries, type TransitionPresentation} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {AdScene} from './AdScene';
import {IntroCard, OutroCard} from './cards';
import {brand} from './brand/tokens';
import {IglesiaProvider} from './church';
import {reelFrames, transitionFrames} from './timing';
import type {WeeklyReelProps} from './types';

const {fps} = brand.video;

/** Fade, slide and wipe in rotation, so consecutive cuts do not repeat. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const presentationFor = (i: number): TransitionPresentation<any> =>
  [fade(), slide({direction: 'from-right'}), wipe({direction: 'from-left'})][i % 3];

/**
 * The scene lengths come from the voiceover's per-character timing (core/render-plan.mjs);
 * here they are only summed, and the audio file is checked against that timing.
 */
export const calculateWeeklyReel: CalculateMetadataFunction<WeeklyReelProps> = async ({props}) => {
  const escenas = props.items.length + 2;
  if (props.frames.length !== escenas) {
    throw new Error(`WeeklyReel needs ${escenas} scene lengths (intro, each event, outro), got ${props.frames.length}`);
  }
  if (props.narration) {
    const real = await getAudioDurationInSeconds(staticFile(props.narration.audioSrc));
    if (Math.abs(real - props.narration.audioSeconds) > brand.motion.audioToleranceSeconds) {
      throw new Error(
        `${props.narration.audioSrc} lasts ${real.toFixed(2)} s but its alignment ends at ${props.narration.audioSeconds.toFixed(2)} s: regenerate the voiceover (node scripts/tts.mjs --week <week> --force)`,
      );
    }
  }
  return {durationInFrames: reelFrames(props.frames, fps)};
};

export const WeeklyReel: React.FC<WeeklyReelProps> = ({semanaTexto, iglesia, items, musicSrc, frames, voiceStartFrame, narration}) => {
  const timing = linearTiming({durationInFrames: transitionFrames(fps)});
  return (
    <IglesiaProvider iglesia={iglesia}>
      <AbsoluteFill>
        <TransitionSeries>
          <TransitionSeries.Sequence durationInFrames={frames[0]}>
            <IntroCard semanaTexto={semanaTexto} />
          </TransitionSeries.Sequence>
          {items.flatMap((item, i) => [
            <TransitionSeries.Transition key={`t-${item.slug}`} presentation={presentationFor(i)} timing={timing} />,
            <TransitionSeries.Sequence key={item.slug} durationInFrames={frames[i + 1]}>
              <AdScene slug={item.slug} event={item.event} iglesia={item.iglesia} imagen={item.imagen} />
            </TransitionSeries.Sequence>,
          ])}
          <TransitionSeries.Transition presentation={presentationFor(items.length)} timing={timing} />
          <TransitionSeries.Sequence durationInFrames={frames[items.length + 1]}>
            <OutroCard iglesia={iglesia} />
          </TransitionSeries.Sequence>
        </TransitionSeries>
        {/* One voice over the whole reel: it starts after the lead-in and is never cut at a scene boundary. */}
        {narration ? (
          <Sequence from={voiceStartFrame}>
            <Html5Audio src={staticFile(narration.audioSrc)} />
          </Sequence>
        ) : null}
        {/* Music bed slot: pass musicSrc (a file under public/) to turn it on; null keeps the reel voice-only. */}
        {musicSrc ? <Html5Audio src={staticFile(musicSrc)} volume={brand.audio.musicVolume} loop /> : null}
      </AbsoluteFill>
    </IglesiaProvider>
  );
};
