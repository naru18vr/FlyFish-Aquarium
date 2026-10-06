import { describe, expect, it } from 'vitest';
import { AUDIO_DEFAULTS, fishNote, readAudioSettings, scaleNote, tapTime, TRACKS, type TrackId } from '../../src/audio';

describe('original retro music and musical taps', () => {
  it('validates saved sound controls and starts silent', () => {
    expect(readAudioSettings(null)).toEqual(AUDIO_DEFAULTS);
    expect(readAudioSettings({ enabled: true, bgm: false, effects: 'yes', sync: false, track: '__proto__', timbre: 'invalid', volume: 20 })).toEqual({ ...AUDIO_DEFAULTS, enabled: true, bgm: false, sync: false, volume: 1 });
    expect(readAudioSettings({ volume: NaN, track: 'bubbles', timbre: 'sparkle' })).toMatchObject({ volume: .4, track: 'bubbles', timbre: 'sparkle' });
  });
  it('has nine distinct looping melodies and assigns fish harmonious, stable pitches', () => {
    expect(new Set(Object.values(TRACKS).map(t => t.melody.join(','))).size).toBe(9);
    for (const id of Object.keys(TRACKS) as TrackId[]) {
      const track = TRACKS[id];
      expect(track.melody).toHaveLength(64); expect(track.bass).toHaveLength(4); expect(track.chords).toHaveLength(4);
      expect(track.melody.every(n => Number.isInteger(n) && n >= -1 && n <= 9)).toBe(true);
      const pitches = Array.from({ length: 40 }, (_, i) => fishNote(id, i + 1));
      expect(new Set(pitches).size).toBe(10);
      expect(pitches.every(n => [0,2,4,7,9].includes((n - track.root) % 12))).toBe(true);
      expect(fishNote(id, 1)).toBe(fishNote(id, 11));
    }
    expect(scaleNote(60, 5)).toBe(72); expect(scaleNote(60, -1)).toBe(57);
  });
  it('snaps close taps to the music grid without introducing long input lag', () => {
    for (const { bpm } of Object.values(TRACKS)) {
      for (let now = 1; now < 8; now += .013) {
        const when = tapTime(now, 1, bpm, true);
        expect(when).toBeGreaterThanOrEqual(now + .0059); expect(when - now).toBeLessThanOrEqual(.075001);
        if (when - now > .00601) {
          const beat = (when - 1) / (60 / bpm / 4);
          expect(Math.abs(beat - Math.round(beat))).toBeLessThan(.00001);
        }
      }
    }
    expect(tapTime(3, 1, 108, false)).toBe(3.006);
  });
});
