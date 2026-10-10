import React from 'react';
import {AbsoluteFill, Html5Audio, Sequence, staticFile, useVideoConfig} from 'remotion';
import type {CalculateMetadataFunction} from 'remotion';
import {AdScene} from './AdScene';
import {brand} from './brand/tokens';
import {IglesiaProvider} from './church';
import {sceneFrames, voiceSeconds} from './timing';
import type {EventAdProps} from './types';

/** Single-event composition: exported as fotograma.png (a still) and clip.mp4. It plays its own slice of the week's narration. */
export const EventAd: React.FC<EventAdProps> = ({slug, event, iglesia, voz, imagen}) => {
  const {fps} = useVideoConfig();
  return (
    <IglesiaProvider iglesia={iglesia}>
      <AbsoluteFill>
        <AdScene slug={slug} event={event} iglesia={iglesia} imagen={imagen} />
        {voz ? (
          <Sequence from={Math.round(brand.motion.leadSeconds * fps)}>
            <Html5Audio src={staticFile(voz.src)} trimBefore={Math.round(voz.fromSec * fps)} trimAfter={Math.round(voz.toSec * fps)} />
          </Sequence>
        ) : null}
      </AbsoluteFill>
    </IglesiaProvider>
  );
};

/** The clip lasts exactly as long as its slice of the narration, plus lead-in and tail. */
export const calculateEventAd: CalculateMetadataFunction<EventAdProps> = async ({props}) => ({
  durationInFrames: sceneFrames(voiceSeconds(props), brand.video.fps),
});
