import { describe, expect, it } from 'vitest';
import { STEP, STOP, pathHeight, pathStops, pointOn, segment, youAreHere } from './worldPath';
import { worldStatuses } from './worldUnlocks';

describe("Flick's worlds as a path (US-114)", () => {
  it('stops zig-zag left, right, left… one step apart', () => {
    const stops = pathStops(worldStatuses(0), 390);
    expect(stops.map((s) => s.side)).toEqual(['left', 'right', 'left', 'right', 'left']);
    expect(stops[1]!.y - stops[0]!.y).toBe(STEP);
    expect(stops[1]!.x + STOP).toBe(390 - 22);
    expect(pathHeight(stops.length)).toBe(16 * 2 + 4 * STEP + STOP);
  });
  it('the road is an S-curve from centre to centre', () => {
    const [a, b] = pathStops(worldStatuses(0), 390);
    expect(segment(a!, b!)).toMatch(/^M78 72 C78 160 312 160 312 248$/);
    expect(pointOn(a!, b!, 0)).toEqual({ x: 78, y: 72 });
    expect(pointOn(a!, b!, 1)).toEqual({ x: 312, y: 248 });
  });
  it("Flick stands between the last world earned and the next, as far as the hours go (clamped)", () => {
    const stops13 = pathStops(worldStatuses(13), 390); // hill + forest (10h) earned, beach at 50h
    const here = youAreHere(stops13, 13)!;
    expect(here.index).toBe(1);
    expect(here.next.id).toBe(stops13[2]!.id);
    expect(here.t).toBe(0.45); // 3 of 40 hours → clamped up
    expect(youAreHere(pathStops(worldStatuses(40), 390), 40)!.t).toBe(0.6);
    expect(youAreHere(pathStops(worldStatuses(5000), 390), 5000)).toBeNull();
  });
});
