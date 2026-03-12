import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/index2d/draw-runtime.global.js');

const drawRuntime = globalThis.GameboyIndexDrawRuntime;

function createGradient() {
  return {
    stops: [],
    addColorStop(offset, color) {
      this.stops.push([offset, color]);
    }
  };
}

function createContext() {
  const calls = [];
  return {
    calls,
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    setTransform(...args) { calls.push(['setTransform', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    createRadialGradient(...args) { calls.push(['createRadialGradient', ...args]); return createGradient(); },
    beginPath() { calls.push(['beginPath']); },
    ellipse(...args) { calls.push(['ellipse', ...args]); },
    fill() { calls.push(['fill']); },
    stroke() { calls.push(['stroke']); },
    arc(...args) { calls.push(['arc', ...args]); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    translate(...args) { calls.push(['translate', ...args]); },
    scale(...args) { calls.push(['scale', ...args]); },
    setTransform(...args) { calls.push(['setTransform', ...args]); }
  };
}

function createCanvasDocument() {
  return {
    createElement(tagName) {
      assert.equal(tagName, 'canvas');
      return {
        width: 0,
        height: 0,
        getContext() {
          return createContext();
        }
      };
    }
  };
}

test('index draw runtime resolves foreground occupancy and player draw coordinates', () => {
  const runtime = drawRuntime.init({
    document: createCanvasDocument(),
    navigator: { userAgent: '' },
    ctx: createContext(),
    canvas: { width: 320, height: 200 },
    player: { x: 10, y: 20, dir: 0, frame: 1 },
    particles: [],
    clouds: [],
    dustParticles: [],
    yellowLights: [],
    getGameReady: () => true,
    getMapW: () => 100,
    getMapH: () => 100,
    getForegroundData: () => {
      const rows = Array.from({ length: 100 }, () => Array(100).fill(false));
      rows[25][18] = true;
      return rows;
    },
    getBgImage: () => null,
    getForegroundImage: () => null,
    getScreenShake: () => 0,
    getCameraZoom: () => 1,
    getCamX: () => 0,
    getCamY: () => 0,
    getNearbyLights: () => [],
    setNearbyLights: () => {},
    getActiveLightSourceId: () => null,
    getIsLoreMode: () => false,
    getIsReadingMode: () => false,
    getSpriteReady: () => true,
    getSprite: () => ({ frameWidth: 16, frameHeight: 20, scale: 1, cols: 4 }),
    getSpriteFront: () => ({ width: 100, height: 60 }),
    getSpriteBack: () => ({ width: 100, height: 60 }),
    getSpriteSide: () => ({ width: 175, height: 60 }),
    frontSpriteData: [{ left: 0, width: 50, footX: 25, footY: 55 }, { left: 50, width: 50, footX: 75, footY: 55 }],
    frontAnimCycle: [0, 1],
    backSpriteData: [{ left: 0, width: 50, footX: 25, footY: 55 }],
    backAnimCycle: [0],
    sideSpriteData: [{ left: 0, width: 50, footX: 20, footY: 55 }],
    sideAnimCycle: [0],
    random: () => 0.5
  });

  assert.equal(runtime.checkForeground(10, 15), true);
  const front = runtime.getPlayerDrawCoords(10, 20, 0, 1);
  assert.equal(front.w, 50);
  assert.equal(front.h, 60);
  const side = runtime.getPlayerDrawCoords(10, 20, 3, 0);
  assert.equal(side.flipX, true);
  assert.ok(Number.isFinite(side.x));
  assert.ok(Number.isFinite(side.y));
});

test('index draw runtime draws scene layers without crashing', () => {
  const ctx = createContext();
  const nearbyLights = [];
  const runtime = drawRuntime.init({
    document: createCanvasDocument(),
    navigator: { userAgent: '' },
    ctx,
    canvas: { width: 320, height: 200 },
    player: { x: 10, y: 20, dir: 0, frame: 1 },
    particles: [{ draw(targetCtx, camX, camY) { targetCtx.calls.push(['particle', camX, camY]); } }],
    clouds: [{ draw(targetCtx, camX, camY) { targetCtx.calls.push(['cloud', camX, camY]); } }],
    dustParticles: [{ x: 2, y: 3, size: 2, life: 1 }],
    yellowLights: [{ id: 1, x: 30, y: 40, draw(targetCtx) { targetCtx.calls.push(['yellow-light']); } }],
    getGameReady: () => true,
    getMapW: () => 100,
    getMapH: () => 100,
    getForegroundData: () => null,
    getBgImage: () => ({ name: 'bg' }),
    getForegroundImage: () => ({ name: 'fg' }),
    getScreenShake: () => 0,
    getCameraZoom: () => 1,
    getCamX: () => 5,
    getCamY: () => 6,
    getNearbyLights: () => nearbyLights,
    setNearbyLights: () => {},
    getActiveLightSourceId: () => null,
    getIsLoreMode: () => false,
    getIsReadingMode: () => false,
    getSpriteReady: () => false,
    getSprite: () => ({ frameWidth: 16, frameHeight: 20, scale: 1, cols: 4 }),
    getSpriteFront: () => ({ width: 64, height: 20 }),
    getSpriteBack: () => ({ width: 64, height: 20 }),
    getSpriteSide: () => ({ width: 64, height: 20 }),
    frontSpriteData: [],
    frontAnimCycle: [],
    backSpriteData: [],
    backAnimCycle: [],
    sideSpriteData: [],
    sideAnimCycle: [],
    random: () => 0.5
  });

  runtime.draw();
  const drawImageCalls = ctx.calls.filter(([name]) => name === 'drawImage');
  assert.ok(drawImageCalls.length >= 2);
  assert.ok(ctx.calls.some(([name]) => name === 'particle'));
  assert.ok(ctx.calls.some(([name]) => name === 'cloud'));
});
