import test from 'node:test';
import assert from 'node:assert/strict';
import { SC_URLS } from '../assets/js/shared/audio/soundcloud-urls.js';
import {
  INTRO_DEMO_LORE_ENTRY,
  INTRO_DEMO_LORE_ID,
  INTRO_STEP_SCHEMA,
  INTRO_TRACKS,
  getTrackEntries,
  getTrackText
} from '../assets/js/intro/intro-script.js';

test('intro script exposes the expected tracks and checkpoints', () => {
  assert.equal(INTRO_DEMO_LORE_ID, 9001);
  assert.equal(INTRO_DEMO_LORE_ENTRY.title, 'Einf\u00fchrungs-Souvenier');
  assert.equal(INTRO_TRACKS.start.length, 1);
  assert.equal(INTRO_TRACKS.main.length, 20);
  assert.equal(INTRO_TRACKS.souvenir.length, 2);
  assert.equal(INTRO_STEP_SCHEMA.some((step) => step.id === 'layout-choice'), true);
  assert.equal(INTRO_STEP_SCHEMA.some((step) => step.id === 'collect-orb'), true);
  assert.match(getTrackText('main'), /Sp\u00fcren Sie mich\?/);
  assert.match(getTrackText('souvenir'), /Zur\u00fcck zum Kapitel/);
});

test('intro tracks expose monotonic cue times and segment playback metadata', () => {
  for (const [trackName, track] of Object.entries(INTRO_TRACKS)) {
    let previousCue = -1;
    const cueEntries = getTrackEntries(trackName);
    assert.equal(cueEntries.length, track.length);
    track.forEach((segment, index) => {
      const cue = cueEntries[index];
      assert.equal(typeof cue.text, 'string');
      assert.ok(Number.isFinite(cue.time), `${trackName}:${segment.id} cue time must be finite`);
      assert.ok(cue.time >= previousCue, `${trackName}:${segment.id} cue time must be monotonic`);
      previousCue = cue.time;
      const hasAudio = Number.isFinite(segment.audioStartSec) && Number.isFinite(segment.audioEndSec);
      const hasSilentHold = Number.isFinite(segment.holdDurationMs) && segment.holdDurationMs > 0;
      assert.ok(hasAudio || hasSilentHold, `${trackName}:${segment.id} needs audio timing or silent hold`);
      if (hasAudio) {
        assert.ok(segment.audioEndSec > segment.audioStartSec, `${trackName}:${segment.id} audio end must be after start`);
      }
    });
  }
});

test('intro SoundCloud stream URL is configured', () => {
  assert.match(SC_URLS.INTRO_LITA_1, /2284299347/);
  assert.match(SC_URLS.INTRO_LITA_1, /secret_token=s-ayl0JnZXdSq/);
});


test('start block spans the first white-reader checkpoint', () => {
  assert.ok(INTRO_TRACKS.start[0].audioEndSec >= INTRO_TRACKS.main[2].audioEndSec);
  assert.ok(INTRO_TRACKS.start[0].audioStartSec <= INTRO_TRACKS.main[0].audioStartSec);
});
