import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTRO_DEMO_LORE_ENTRY,
  INTRO_DEMO_LORE_ID,
  INTRO_STEP_SCHEMA,
  INTRO_TRACKS,
  getTrackText
} from '../assets/js/intro/intro-script.js';

test('intro script exposes the expected tracks and checkpoints', () => {
  assert.equal(INTRO_DEMO_LORE_ID, 9001);
  assert.equal(INTRO_DEMO_LORE_ENTRY.title, 'Einf\u00fchrungs-Souvenier');
  assert.equal(INTRO_TRACKS.start.length, 2);
  assert.equal(INTRO_TRACKS.main.length, 20);
  assert.equal(INTRO_TRACKS.souvenir.length, 2);
  assert.equal(INTRO_STEP_SCHEMA.some((step) => step.id === 'layout-choice'), true);
  assert.equal(INTRO_STEP_SCHEMA.some((step) => step.id === 'collect-orb'), true);
  assert.match(getTrackText('main'), /Sp\u00fcren Sie mich\?/);
  assert.match(getTrackText('souvenir'), /Zur\u00fcck zum Kapitel/);
});
