import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/index2d/loop-runtime.global.js');

const loopRuntime = globalThis.GameboyIndexLoopRuntime;

function createWindow() {
  return {
    gameLoopRunning: false,
    gamePaused: false,
    visualFreezeActive: false
  };
}

test('index loop runtime starts loop, hides loading and schedules frame', () => {
  const frames = [];
  const hides = [];
  const logs = [];
  const processingInfo = { style: { display: 'block' } };
  let lastTime = 99;
  const runtime = loopRuntime.init({
    window: createWindow(),
    document: {
      getElementById(id) {
        return id === 'processingInfo' ? processingInfo : null;
      }
    },
    requestAnimationFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    hideLoadingScreenSafely: (reason) => hides.push(reason),
    update: () => {},
    updateLoreSystem: () => {},
    draw: () => {},
    getGameReady: () => true,
    getLastTime: () => lastTime,
    setLastTime: (value) => { lastTime = value; },
    log: (message) => logs.push(message)
  });

  assert.equal(runtime.startGameLoop(), true);
  assert.equal(lastTime, 0);
  assert.equal(hides[0], 'start-game-loop');
  assert.equal(processingInfo.style.display, 'none');
  assert.equal(logs[0], 'startGameLoop');
  assert.equal(frames.length, 1);
  assert.equal(typeof frames[0], 'function');
});

test('index loop runtime avoids duplicate starts and respects pause or freeze states', () => {
  const frames = [];
  const windowObject = createWindow();
  let lastTime = 0;
  const runtime = loopRuntime.init({
    window: windowObject,
    requestAnimationFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    update: () => {},
    updateLoreSystem: () => {},
    draw: () => {},
    getLastTime: () => lastTime,
    setLastTime: (value) => { lastTime = value; }
  });

  assert.equal(runtime.startGameLoop(), true);
  assert.equal(runtime.startGameLoop(), false);
  assert.equal(frames.length, 1);

  windowObject.gamePaused = true;
  assert.equal(runtime.gameLoop(16), true);
  assert.equal(frames.length, 2);

  windowObject.gamePaused = false;
  windowObject.visualFreezeActive = true;
  assert.equal(runtime.gameLoop(32), false);
  assert.equal(windowObject.gameLoopRunning, false);
});

test('index loop runtime clamps dt and drives update, lore update and draw in order', () => {
  const calls = [];
  const frames = [];
  const windowObject = createWindow();
  let lastTime = 0;
  const runtime = loopRuntime.init({
    window: windowObject,
    requestAnimationFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    update: (dt) => calls.push(['update', dt]),
    updateLoreSystem: () => calls.push(['lore']),
    draw: () => calls.push(['draw']),
    getLastTime: () => lastTime,
    setLastTime: (value) => { lastTime = value; }
  });

  runtime.startGameLoop();
  calls.length = 0;
  frames.length = 0;
  lastTime = 10;
  const dt = runtime.gameLoop(310);

  assert.equal(Number(dt.toFixed(3)), 0.1);
  assert.deepEqual(calls, [
    ['update', 0.1],
    ['lore'],
    ['draw']
  ]);
  assert.equal(lastTime, 310);
  assert.equal(frames.length, 1);
});

