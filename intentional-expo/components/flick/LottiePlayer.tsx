/**
 * US-118 · One Lottie player for Flick. Native: lottie-react-native (the native renderer).
 * Web: LottiePlayer.web.tsx (lottie-web) — see there for why.
 */
import LottieView from 'lottie-react-native';

export function LottiePlayer({ source, width, height, loop = true, onFinish }: { source: unknown; width: number; height: number; loop?: boolean; onFinish?: () => void }) {
  return <LottieView source={source as never} autoPlay loop={loop} style={{ width, height }} onAnimationFinish={(cancelled) => (cancelled ? undefined : onFinish?.())} />;
}
