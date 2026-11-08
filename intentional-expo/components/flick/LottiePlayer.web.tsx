/**
 * US-118 · Flick's Lottie player on the web: lottie-web (plain JavaScript, SVG renderer).
 *
 * Why not lottie-react-native's web player: it is dotlottie-web, a WebAssembly build fetched from a CDN, and it
 * aborts ("`earlier` cannot be later than `self`") when the page's clock is faked or jumps (the e2e suites install
 * Playwright's clock), raising the dev error overlay over the app. lottie-web follows requestAnimationFrame and the
 * page's clock, needs no network, and draws crisp SVG.
 */
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

export function LottiePlayer({ source, width, height, loop = true }: { source: unknown; width: number; height: number; loop?: boolean }) {
  const host = useRef<unknown>(null);
  useEffect(() => {
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return;
    let anim: { destroy: () => void } | null = null;
    let alive = true;
    void import('lottie-web/build/player/lottie_light').then((m) => {
      if (!alive) return;
      const lottie = (m as { default: { loadAnimation: (o: object) => { destroy: () => void } } }).default;
      anim = lottie.loadAnimation({ container: el, renderer: 'svg', loop, autoplay: true, animationData: source, rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
    });
    return () => {
      alive = false;
      anim?.destroy();
    };
  }, [source, loop]);
  return <View ref={host as never} style={{ width, height }} />;
}
