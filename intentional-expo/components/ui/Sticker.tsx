/**
 * US-110 · Sticker icons: Microsoft Fluent Emoji "Flat" (MIT, assets/icons/stickers/LICENSE) turned into die-cut
 * stickers (thick white outline, soft shadow) at 192 px by scripts/build-stickers.mjs. Use a sticker wherever an
 * icon is an illustration (pillars, blockers, presets, stat tiles, settings rows, empty states, the tab bar); keep
 * thin line glyphs only for tiny affordances (chevrons, close, plus).
 *
 *   <Sticker name="lock" size={40} />                 bare
 *   <Sticker name="moon" size={44} tint="#7A5AF8" />   on a soft tinted circle
 */
import { Image, View, type ImageSourcePropType } from 'react-native';
import { hexToRgba } from '@/constants/design';

export const STICKERS = {
  apple: require('@/assets/icons/stickers/apple.png'),
  baby: require('@/assets/icons/stickers/baby.png'),
  banknote: require('@/assets/icons/stickers/banknote.png'),
  beach: require('@/assets/icons/stickers/beach.png'),
  bed: require('@/assets/icons/stickers/bed.png'),
  bell: require('@/assets/icons/stickers/bell.png'),
  bike: require('@/assets/icons/stickers/bike.png'),
  book: require('@/assets/icons/stickers/book.png'),
  box: require('@/assets/icons/stickers/box.png'),
  brain: require('@/assets/icons/stickers/brain.png'),
  briefcase: require('@/assets/icons/stickers/briefcase.png'),
  bulb: require('@/assets/icons/stickers/bulb.png'),
  calendar: require('@/assets/icons/stickers/calendar.png'),
  camera: require('@/assets/icons/stickers/camera.png'),
  candle: require('@/assets/icons/stickers/candle.png'),
  chart: require('@/assets/icons/stickers/chart.png'),
  check: require('@/assets/icons/stickers/check.png'),
  church: require('@/assets/icons/stickers/church.png'),
  city: require('@/assets/icons/stickers/city.png'),
  clock: require('@/assets/icons/stickers/clock.png'),
  cloud: require('@/assets/icons/stickers/cloud.png'),
  code: require('@/assets/icons/stickers/code.png'),
  coffee: require('@/assets/icons/stickers/coffee.png'),
  coins: require('@/assets/icons/stickers/coins.png'),
  crystal: require('@/assets/icons/stickers/crystal.png'),
  dog: require('@/assets/icons/stickers/dog.png'),
  dumbbell: require('@/assets/icons/stickers/dumbbell.png'),
  envelope: require('@/assets/icons/stickers/envelope.png'),
  eyes: require('@/assets/icons/stickers/eyes.png'),
  film: require('@/assets/icons/stickers/film.png'),
  flame: require('@/assets/icons/stickers/flame.png'),
  footprints: require('@/assets/icons/stickers/footprints.png'),
  gamepad: require('@/assets/icons/stickers/gamepad.png'),
  gear: require('@/assets/icons/stickers/gear.png'),
  gem: require('@/assets/icons/stickers/gem.png'),
  globe: require('@/assets/icons/stickers/globe.png'),
  graduation: require('@/assets/icons/stickers/graduation.png'),
  hammer: require('@/assets/icons/stickers/hammer.png'),
  handheart: require('@/assets/icons/stickers/handheart.png'),
  handshake: require('@/assets/icons/stickers/handshake.png'),
  heart: require('@/assets/icons/stickers/heart.png'),
  hourglass: require('@/assets/icons/stickers/hourglass.png'),
  house: require('@/assets/icons/stickers/house.png'),
  hundred: require('@/assets/icons/stickers/hundred.png'),
  key: require('@/assets/icons/stickers/key.png'),
  landmark: require('@/assets/icons/stickers/landmark.png'),
  languages: require('@/assets/icons/stickers/languages.png'),
  laptop: require('@/assets/icons/stickers/laptop.png'),
  leaf: require('@/assets/icons/stickers/leaf.png'),
  lock: require('@/assets/icons/stickers/lock.png'),
  lotus: require('@/assets/icons/stickers/lotus.png'),
  memo: require('@/assets/icons/stickers/memo.png'),
  mic: require('@/assets/icons/stickers/mic.png'),
  moon: require('@/assets/icons/stickers/moon.png'),
  mountain: require('@/assets/icons/stickers/mountain.png'),
  music: require('@/assets/icons/stickers/music.png'),
  nophone: require('@/assets/icons/stickers/nophone.png'),
  palette: require('@/assets/icons/stickers/palette.png'),
  party: require('@/assets/icons/stickers/party.png'),
  pen: require('@/assets/icons/stickers/pen.png'),
  phone: require('@/assets/icons/stickers/phone.png'),
  picture: require('@/assets/icons/stickers/picture.png'),
  piggybank: require('@/assets/icons/stickers/piggybank.png'),
  pin: require('@/assets/icons/stickers/pin.png'),
  plane: require('@/assets/icons/stickers/plane.png'),
  prohibited: require('@/assets/icons/stickers/prohibited.png'),
  question: require('@/assets/icons/stickers/question.png'),
  repeat: require('@/assets/icons/stickers/repeat.png'),
  rocket: require('@/assets/icons/stickers/rocket.png'),
  salad: require('@/assets/icons/stickers/salad.png'),
  seedling: require('@/assets/icons/stickers/seedling.png'),
  shield: require('@/assets/icons/stickers/shield.png'),
  smile: require('@/assets/icons/stickers/smile.png'),
  sparkles: require('@/assets/icons/stickers/sparkles.png'),
  sprout: require('@/assets/icons/stickers/sprout.png'),
  star: require('@/assets/icons/stickers/star.png'),
  stethoscope: require('@/assets/icons/stickers/stethoscope.png'),
  stop: require('@/assets/icons/stickers/stop.png'),
  stopwatch: require('@/assets/icons/stickers/stopwatch.png'),
  sun: require('@/assets/icons/stickers/sun.png'),
  sunrise: require('@/assets/icons/stickers/sunrise.png'),
  sunset: require('@/assets/icons/stickers/sunset.png'),
  target: require('@/assets/icons/stickers/target.png'),
  teacup: require('@/assets/icons/stickers/teacup.png'),
  tree: require('@/assets/icons/stickers/tree.png'),
  trending: require('@/assets/icons/stickers/trending.png'),
  trophy: require('@/assets/icons/stickers/trophy.png'),
  unlock: require('@/assets/icons/stickers/unlock.png'),
  users: require('@/assets/icons/stickers/users.png'),
  utensils: require('@/assets/icons/stickers/utensils.png'),
  wallet: require('@/assets/icons/stickers/wallet.png'),
  wave: require('@/assets/icons/stickers/wave.png'),
  door: require('@/assets/icons/stickers/door.png'),
  inbox: require('@/assets/icons/stickers/inbox.png'),
  trash: require('@/assets/icons/stickers/trash.png'),
} satisfies Record<string, ImageSourcePropType>;

export type StickerName = keyof typeof STICKERS;

/** US-110: muted (greyscale) twins, used by the inactive tabs. */
const GREY: Partial<Record<StickerName, ImageSourcePropType>> = {
  sun: require('@/assets/icons/stickers/sun-grey.png'),
  target: require('@/assets/icons/stickers/target-grey.png'),
  lock: require('@/assets/icons/stickers/lock-grey.png'),
  chart: require('@/assets/icons/stickers/chart-grey.png'),
  house: require('@/assets/icons/stickers/house-grey.png'),
  gear: require('@/assets/icons/stickers/gear-grey.png'),
};
export const STICKER_NAMES = Object.keys(STICKERS) as StickerName[];
export const isStickerName = (s: string | null | undefined): s is StickerName => !!s && s in STICKERS;

export function Sticker({
  name,
  size = 32,
  tint,
  circle,
  accessibilityLabel,
  muted,
}: {
  name: StickerName;
  /** The greyscale twin when there is one (inactive tabs); otherwise the sticker at half opacity. */
  muted?: boolean;
  size?: number;
  /** Draws the sticker on a soft circle of this colour (alpha 0.16). */
  tint?: string;
  /** Circle diameter when tinted (default size × 1.5). */
  circle?: number;
  accessibilityLabel?: string;
}) {
  const img = (
    <Image
      source={muted && GREY[name] ? GREY[name] : STICKERS[name]}
      style={{ width: size, height: size, opacity: muted && !GREY[name] ? 0.5 : 1 }}
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
