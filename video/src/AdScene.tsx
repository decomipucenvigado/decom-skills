import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ads} from './ads/registry.gen';
import {brand} from './brand/tokens';
import type {EventAdProps} from './types';

/** How much the event's image grows over its scene: a slow push-in, so a still picture still moves. */
const ZOOM = 0.05;

/** The event's exported image (ad.png), the same one that gets published, filling the frame. */
const ImagenEvento: React.FC<{src: string}> = ({src}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const escala = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [1, 1 + ZOOM], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{backgroundColor: brand.color.background, overflow: 'hidden'}}>
      <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${escala})`}} />
    </AbsoluteFill>
  );
};

/**
 * One event's picture: its exported image when the week's canvas gave it one, else its ad
 * component. Sound is not its business: the single-event clip (EventAd) plays its own slice of
 * the narration, and the weekly reel plays the whole narration once over all its scenes.
 */
export const AdScene: React.FC<Pick<EventAdProps, 'slug' | 'event' | 'iglesia' | 'imagen'>> = ({slug, event, iglesia, imagen}) => {
  if (imagen) return <ImagenEvento src={imagen} />;
  const Ad = ads[slug];
  if (!Ad) throw new Error(`No ad component registered for "${slug}". Run: node scripts/gen-registry.mjs`);
  return (
    <AbsoluteFill>
      <Ad event={event} iglesia={iglesia} />
    </AbsoluteFill>
  );
};
