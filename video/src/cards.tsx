import React from 'react';
import {AbsoluteFill} from 'remotion';
import {brand} from './brand/tokens';
import {useLayout} from './layout';
import {Backdrop, Cta, Headline, Reveal, Logo} from './templates/parts';
import type {Iglesia} from './types';

/** Opens the weekly video with its title card: "Programación <church>" (core/render-plan.mjs). */
export const IntroCard: React.FC<{semanaTexto: string}> = ({semanaTexto}) => {
  const {u} = useLayout();
  return (
    <AbsoluteFill style={{fontFamily: brand.font.body, color: brand.color.text}}>
      <Backdrop zoom />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: brand.space.xl * u,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: brand.space.md * u,
        }}
      >
        <Reveal>
          <Logo />
        </Reveal>
        <Reveal delay={8}>
          <Headline text={semanaTexto} size={brand.type.hero} align="center" />
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};

/** Closes the weekly video with the church's own closing line and address, as far as church-info.md gives them. */
export const OutroCard: React.FC<{iglesia: Iglesia}> = ({iglesia}) => {
  const {u} = useLayout();
  return (
    <AbsoluteFill style={{fontFamily: brand.font.body, color: brand.color.text}}>
      <Backdrop />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: brand.space.xl * u,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: brand.space.md * u,
        }}
      >
        <Reveal>
          <Logo />
        </Reveal>
        <Reveal delay={8}>
          <Cta text={iglesia.llamadoAccion} align="center" />
        </Reveal>
        {iglesia.despedida ? (
          <Reveal delay={14}>
            <Headline text={iglesia.despedida} size={brand.type.subtitle} align="center" />
          </Reveal>
        ) : null}
        {iglesia.direccion ? (
          <Reveal delay={20}>
            <div style={{fontFamily: brand.font.body, fontWeight: 500, fontSize: brand.type.body * u, color: brand.color.textMuted}}>
              {iglesia.direccion}
            </div>
          </Reveal>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
