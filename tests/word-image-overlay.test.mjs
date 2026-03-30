import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/shared/ui/word-image-overlay.global.js');

const overlayApi = globalThis.GameboyWordImageOverlay;
const overlayTestApi = overlayApi && overlayApi.__test;

test('word image overlay api is available', () => {
  assert.ok(overlayApi);
  assert.equal(typeof overlayApi.initController, 'function');
  assert.equal(typeof overlayApi.getDefaultCueDefinitions, 'function');
  assert.ok(overlayTestApi);
  assert.equal(typeof overlayTestApi.buildTimelineEntries, 'function');
});

test('buildTimelineEntries resolves index test-balloon cues for marktplatz/kapitel1', () => {
  const cues = overlayApi.getDefaultCueDefinitions();
  const tracks = [
    { time: 10, text: 'Du hast vielleicht \u00c4rger empfunden oder' },
    { time: 14, text: 'Unter der Versch\u00fcttung der Jahrzehnte lag ich und schrieb nicht' },
    { time: 18, text: 'Und dann ging es weiter' }
  ];

  const entries = overlayTestApi.buildTimelineEntries(cues, {
    sceneKey: 'marktplatz',
    contentRef: 'assets/kapitel1.txt',
    tracks,
    durationSec: 40
  });

  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.cue.word), ['\u00c4rger', 'Versch\u00fcttung']);

  for (const entry of entries) {
    assert.ok(entry.start <= entry.holdStart);
    assert.ok(entry.holdStart <= entry.holdEnd);
    assert.ok(entry.holdEnd <= entry.end);
    assert.ok(entry.holdDuration > 0);
    assert.ok(entry.holdDuration <= 3);
  }
});

test('buildTimelineEntries resolves liminal test-balloon cue for liminal_library/kapitel1b', () => {
  const cues = overlayApi.getDefaultCueDefinitions();
  const tracks = [
    { time: 22, text: 'Dann erscheinen vor mir meterhohe B\u00fccherregale in einem nach hinten gel\u00e4ngten Gesch\u00e4ft' },
    { time: 27, text: 'Der Raum wird still' }
  ];

  const entries = overlayTestApi.buildTimelineEntries(cues, {
    sceneKey: 'liminal_library',
    contentRef: 'assets/kapitel1b.txt',
    tracks,
    durationSec: 60
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].cue.word, 'B\u00fccherregale');
});

test('resolveActiveWeights normalizes overlapping cues so total weight stays <= 1', () => {
  const entries = [
    {
      start: 0,
      holdStart: 1,
      holdEnd: 2,
      end: 3,
      fadeInDuration: 1,
      fadeOutDuration: 1
    },
    {
      start: 1,
      holdStart: 2,
      holdEnd: 3,
      end: 4,
      fadeInDuration: 1,
      fadeOutDuration: 1
    }
  ];

  const active = overlayTestApi.resolveActiveWeights(entries, 2);
  assert.equal(active.length, 2);

  const total = active.reduce((sum, item) => sum + item.weight, 0);
  assert.ok(total <= 1.000001);
  assert.ok(Math.abs(total - 1) < 0.0001);
});

test('resolveImageUrlCandidates expands Google Drive links with fallback URLs', () => {
  const driveUrl = 'https://drive.google.com/file/d/1oMDq1s3AA74V2VF3W3guQRm0C6TFgDHs/view?usp=sharing';
  const candidates = overlayTestApi.resolveImageUrlCandidates(driveUrl);

  assert.ok(candidates.includes(driveUrl));
  assert.ok(candidates.includes('https://drive.google.com/uc?export=view&id=1oMDq1s3AA74V2VF3W3guQRm0C6TFgDHs'));
  assert.ok(candidates.includes('https://drive.google.com/uc?export=download&id=1oMDq1s3AA74V2VF3W3guQRm0C6TFgDHs'));
  assert.ok(candidates.includes('https://drive.google.com/thumbnail?id=1oMDq1s3AA74V2VF3W3guQRm0C6TFgDHs&sz=w4096'));
});

test('buildTimelineEntries clamps early cue timings when there is no 3s pre-roll available', () => {
  const cues = [
    {
      id: 'edge-start',
      sceneKeys: ['marktplatz'],
      contentRefs: ['assets/kapitel1.txt'],
      word: '\u00c4rger',
      sentenceHint: '\u00c4rger direkt am Anfang',
      imageUrl: 'https://example.com/edge.jpg',
      estimatedSizeBytes: 300000
    }
  ];
  const tracks = [
    { time: 0, text: '\u00c4rger direkt am Anfang' },
    { time: 0.6, text: 'N\u00e4chste Zeile' }
  ];

  const entries = overlayTestApi.buildTimelineEntries(cues, {
    sceneKey: 'marktplatz',
    contentRef: 'assets/kapitel1.txt',
    tracks,
    durationSec: 0.6
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].start, 0);
  assert.equal(entries[0].fadeInDuration, 0);
  assert.ok(entries[0].holdDuration > 0);
  assert.ok(entries[0].holdDuration <= 0.6);
});
