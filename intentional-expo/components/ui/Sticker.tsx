/**
 * US-105 · Real icons: glossy 3D "stickers" from Microsoft's Fluent Emoji (MIT, assets/icons/3d/LICENSE),
 * downscaled to 128px. Use a sticker wherever an icon is an illustration (pillars, blockers, presets, stat tiles,
 * settings rows, empty states); keep thin line glyphs only for tiny affordances (chevrons, close, plus).
 *
 *   <Sticker name="lock" size={40} />                 bare
 *   <Sticker name="moon" size={44} tint="#7A5AF8" />   on a soft tinted circle
 */
import { Image, View, type ImageSourcePropType } from 'react-native';
import { hexToRgba } from '@/constants/design';

export const STICKERS = {
  apple: require('@/assets/icons/3d/apple.png'),
  baby: require('@/assets/icons/3d/baby.png'),
  banknote: require('@/assets/icons/3d/banknote.png'),
  beach: require('@/assets/icons/3d/beach.png'),
  bed: require('@/assets/icons/3d/bed.png'),
  bell: require('@/assets/icons/3d/bell.png'),
  bike: require('@/assets/icons/3d/bike.png'),
  book: require('@/assets/icons/3d/book.png'),
  box: require('@/assets/icons/3d/box.png'),
  brain: require('@/assets/icons/3d/brain.png'),
  briefcase: require('@/assets/icons/3d/briefcase.png'),
  bulb: require('@/assets/icons/3d/bulb.png'),
  calendar: require('@/assets/icons/3d/calendar.png'),
  camera: require('@/assets/icons/3d/camera.png'),
  candle: require('@/assets/icons/3d/candle.png'),
  chart: require('@/assets/icons/3d/chart.png'),
  check: require('@/assets/icons/3d/check.png'),
  church: require('@/assets/icons/3d/church.png'),
  city: require('@/assets/icons/3d/city.png'),
  clock: require('@/assets/icons/3d/clock.png'),
  cloud: require('@/assets/icons/3d/cloud.png'),
  code: require('@/assets/icons/3d/code.png'),
  coffee: require('@/assets/icons/3d/coffee.png'),
  coins: require('@/assets/icons/3d/coins.png'),
  crystal: require('@/assets/icons/3d/crystal.png'),
  dog: require('@/assets/icons/3d/dog.png'),
  dumbbell: require('@/assets/icons/3d/dumbbell.png'),
  envelope: require('@/assets/icons/3d/envelope.png'),
  eyes: require('@/assets/icons/3d/eyes.png'),
  film: require('@/assets/icons/3d/film.png'),
  flame: require('@/assets/icons/3d/flame.png'),
  footprints: require('@/assets/icons/3d/footprints.png'),
  gamepad: require('@/assets/icons/3d/gamepad.png'),
  gear: require('@/assets/icons/3d/gear.png'),
  gem: require('@/assets/icons/3d/gem.png'),
  globe: require('@/assets/icons/3d/globe.png'),
  graduation: require('@/assets/icons/3d/graduation.png'),
  hammer: require('@/assets/icons/3d/hammer.png'),
  handheart: require('@/assets/icons/3d/handheart.png'),
  handshake: require('@/assets/icons/3d/handshake.png'),
  heart: require('@/assets/icons/3d/heart.png'),
  hourglass: require('@/assets/icons/3d/hourglass.png'),
  house: require('@/assets/icons/3d/house.png'),
  hundred: require('@/assets/icons/3d/hundred.png'),
  key: require('@/assets/icons/3d/key.png'),
  landmark: require('@/assets/icons/3d/landmark.png'),
  languages: require('@/assets/icons/3d/languages.png'),
  laptop: require('@/assets/icons/3d/laptop.png'),
  leaf: require('@/assets/icons/3d/leaf.png'),
  lock: require('@/assets/icons/3d/lock.png'),
  lotus: require('@/assets/icons/3d/lotus.png'),
  memo: require('@/assets/icons/3d/memo.png'),
  mic: require('@/assets/icons/3d/mic.png'),
  moon: require('@/assets/icons/3d/moon.png'),
  mountain: require('@/assets/icons/3d/mountain.png'),
  music: require('@/assets/icons/3d/music.png'),
  nophone: require('@/assets/icons/3d/nophone.png'),
  palette: require('@/assets/icons/3d/palette.png'),
  party: require('@/assets/icons/3d/party.png'),
  pen: require('@/assets/icons/3d/pen.png'),
  phone: require('@/assets/icons/3d/phone.png'),
  picture: require('@/assets/icons/3d/picture.png'),
  piggybank: require('@/assets/icons/3d/piggybank.png'),
  pin: require('@/assets/icons/3d/pin.png'),
  plane: require('@/assets/icons/3d/plane.png'),
  prohibited: require('@/assets/icons/3d/prohibited.png'),
  question: require('@/assets/icons/3d/question.png'),
  repeat: require('@/assets/icons/3d/repeat.png'),
  rocket: require('@/assets/icons/3d/rocket.png'),
  salad: require('@/assets/icons/3d/salad.png'),
  seedling: require('@/assets/icons/3d/seedling.png'),
  shield: require('@/assets/icons/3d/shield.png'),
  smile: require('@/assets/icons/3d/smile.png'),
  sparkles: require('@/assets/icons/3d/sparkles.png'),
  sprout: require('@/assets/icons/3d/sprout.png'),
  star: require('@/assets/icons/3d/star.png'),
  stethoscope: require('@/assets/icons/3d/stethoscope.png'),
  stop: require('@/assets/icons/3d/stop.png'),
  stopwatch: require('@/assets/icons/3d/stopwatch.png'),
  sun: require('@/assets/icons/3d/sun.png'),
  sunrise: require('@/assets/icons/3d/sunrise.png'),
  sunset: require('@/assets/icons/3d/sunset.png'),
  target: require('@/assets/icons/3d/target.png'),
  teacup: require('@/assets/icons/3d/teacup.png'),
  tree: require('@/assets/icons/3d/tree.png'),
  trending: require('@/assets/icons/3d/trending.png'),
  trophy: require('@/assets/icons/3d/trophy.png'),
  unlock: require('@/assets/icons/3d/unlock.png'),
  users: require('@/assets/icons/3d/users.png'),
  utensils: require('@/assets/icons/3d/utensils.png'),
  wallet: require('@/assets/icons/3d/wallet.png'),
  wave: require('@/assets/icons/3d/wave.png'),
  door: require('@/assets/icons/3d/door.png'),
  inbox: require('@/assets/icons/3d/inbox.png'),
  trash: require('@/assets/icons/3d/trash.png'),
} satisfies Record<string, ImageSourcePropType>;

export type StickerName = keyof typeof STICKERS;
export const STICKER_NAMES = Object.keys(STICKERS) as StickerName[];
export const isStickerName = (s: string | null | undefined): s is StickerName => !!s && s in STICKERS;

export function Sticker({
  name,
  size = 32,
  tint,
  circle,
  accessibilityLabel,
}: {
  name: StickerName;
  size?: number;
  /** Draws the sticker on a soft circle of this colour (alpha 0.16). */
  tint?: string;
  /** Circle diameter when tinted (default size × 1.5). */
  circle?: number;
  accessibilityLabel?: string;
}) {
  const img = (
    <Image
      source={STICKERS[name]}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
    />
  );
  if (!tint) return img;
  const d = circle ?? Math.round(size * 1.5);
  return (
    <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: hexToRgba(tint, 0.16), alignItems: 'center', justifyContent: 'center' }}>
      {img}
    </View>
  );
}
