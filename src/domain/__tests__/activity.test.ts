import { describe, expect, it } from 'vitest';
import {
  dailyMinutes,
  decodePolyline,
  deviceValues,
  formatPace,
  mergeIntervals,
  segmentsFromEvents,
} from '../activity';
import type { Workout } from '../types';

const MIN = 60_000;
const at = (day: string, hh: number, mm = 0) =>
  new Date(`${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`).getTime();

function workout(p: Partial<Workout>): Workout {
  return {
    id: 'w1',
    type: 'run',
    date: '2026-10-10',
    startedAt: at('2026-10-10', 7),
    endedAt: at('2026-10-10', 7, 30),
    movingSec: 30 * 60,
    distanceM: 5200,
    distanceSource: 'gps',
    elevationGainM: 40,
    elevationSource: 'barometer',
    steps: 4800,
    splits: [],
    route: null,
    elevationProfile: [],
    updatedAt: 1,
    ...p,
  };
}

describe('activity detection', () => {
  it('pairs transitions, drops blips and keeps an ongoing activity open', () => {
    const t0 = at('2026-10-10', 9);
    const segs = segmentsFromEvents(
      [
        { type: 'walk', enter: true, t: t0 },
        { type: 'walk', enter: false, t: t0 + 20 * MIN },
        { type: 'run', enter: true, t: t0 + 30 * MIN },
        { type: 'run', enter: false, t: t0 + 31 * MIN }, // 1-minute blip
        { type: 'ride', enter: true, t: t0 + 60 * MIN },
      ],
      t0 + 75 * MIN,
    );
    expect(segs).toEqual([
      { type: 'walk', start: t0, end: t0 + 20 * MIN },
      { type: 'ride', start: t0 + 60 * MIN, end: t0 + 75 * MIN },
    ]);
  });

  it('merges overlapping intervals', () => {
    expect(
      mergeIntervals([
        [5, 10],
        [1, 3],
        [2, 6],
        [12, 12],
      ]),
    ).toEqual([[1, 10]]);
  });

  it('does not double count a recorded run that was also detected', () => {
    const w = workout({});
    const minutes = dailyMinutes(
      'run',
      [w],
      [{ type: 'run', start: w.startedAt + 10 * MIN, end: w.startedAt + 40 * MIN }],
    );
    expect(minutes['2026-10-10']).toBe(40);
  });

  it('splits an activity across midnight', () => {
    const minutes = dailyMinutes(
      'walk',
      [],
      [{ type: 'walk', start: at('2026-10-10', 23, 50), end: at('2026-10-11', 0, 20) }],
    );
    expect(minutes).toEqual({ '2026-10-10': 10, '2026-10-11': 20 });
  });
});

describe('deviceValues', () => {
  const data = {
    steps: { '2026-10-10': 9100 },
    workouts: [workout({})],
    segments: [],
  };

  it('maps to the habit unit', () => {
    const base = { target: 1, unit: null as string | null };
    expect(deviceValues({ ...base, kind: 'duration', auto: { provider: 'device', metric: 'run' } }, data)).toEqual({
      '2026-10-10': 30,
    });
    expect(
      deviceValues({ ...base, kind: 'count', unit: 'km', auto: { provider: 'device', metric: 'run' } }, data),
    ).toEqual({ '2026-10-10': 5.2 });
    expect(deviceValues({ ...base, kind: 'check', auto: { provider: 'device', metric: 'run' } }, data)).toEqual({
      '2026-10-10': 1,
    });
    expect(
      deviceValues({ ...base, kind: 'count', unit: 'steps', auto: { provider: 'device', metric: 'steps' } }, data),
    ).toEqual({ '2026-10-10': 9100 });
  });

  it('ignores habits that are not device tracked', () => {
    expect(deviceValues({ kind: 'check', unit: null, target: 1, auto: null }, data)).toEqual({});
  });
});

describe('formatting', () => {
  it('decodes Google polylines', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it('formats pace', () => {
    expect(formatPace(312)).toBe(`5'12"`);
    expect(formatPace(null)).toBe('–');
  });
});
