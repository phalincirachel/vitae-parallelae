import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/index2d/update-runtime.global.js');

const updateRuntime = globalThis.GameboyIndexUpdateRuntime;

function createSound() {
  let playCount = 0;
  let pauseCount = 0;
  return {
    play() {
      playCount += 1;
      return Promise.resolve();
    },
    pause() {
      pauseCount += 1;
    },
    get playCount() {
      return playCount;
    },
    get pauseCount() {
      return pauseCount;
    }
  };
}

test('index update runtime handles manual movement and camera follow', () => {
  const player = { x: 10, y: 10, speed: 20, dir: 0, frame: 0, animTimer: 0 };
  const keys = { d: true };
  const particles = [{ updateCalls: 0, update(dt) { this.updateCalls += dt; } }];
  const clouds = [{ updateCalls: 0, update(dt) { this.updateCalls += dt; } }];
  const dustParticles = [];
  const gameCanvasGesture = { mode: 'idle' };
  const footstepSound = createSound();
  let moveTarget = { x: 5, y: 5 };
  let clickWalkPath = [{ x: 3, y: 4 }];
  let clickWalkGoal = { x: 8, y: 9 };
  let nearbyLights = [{ x: 1 }];
  let cameraZoom = 1;
  let cameraZoomTarget = 1.2;
  let cameraPanOffsetX = 0;
  let cameraPanOffsetY = 0;
  let camX = 0;
  let camY = 0;
  let targetCamX = 0;
  let targetCamY = 0;
  let footstepPlaying = false;
  let screenShake = 0;

  const runtime = updateRuntime.init({
    player,
    keys,
    particles,
    clouds,
    dustParticles,
    gameCanvasGesture,
    footstepSound,
    getGameReady: () => true,
    getMapW: () => 200,
    getMapH: () => 100,
    getIsReadingMode: () => false,
    getSpriteReady: () => true,
    getSprite: () => ({ frameWidth: 16, frameHeight: 20, scale: 1, baseScale: 1 }),
    footOffsetY: 0,
    getMoveTarget: () => moveTarget,
    setMoveTarget: (value) => { moveTarget = value; },
    getClickWalkPath: () => clickWalkPath,
    setClickWalkPath: (value) => { clickWalkPath = value; },
    getClickWalkGoal: () => clickWalkGoal,
    setClickWalkGoal: (value) => { clickWalkGoal = value; },
    getAutoWalkPath: () => [],
    getAutoWalkIndex: () => 0,
    setAutoWalkIndex: () => {},
    getAutoWalkFacingLockTimer: () => 0,
    setAutoWalkFacingLockTimer: () => {},
    getPlayerFootPosition: (x = player.x, y = player.y) => ({ x: x + 8, y: y + 20 }),
    setPlayerFromFootPosition: (fx, fy) => { player.x = fx - 8; player.y = fy - 20; },
    isFootSolid: () => false,
    findNearestFreeFootPoint: () => null,
    findPathAStar: () => [],
    chooseAutoWalkDirection: (_, __, fallback) => fallback,
    checkCollisionAt: () => false,
    allowAuxScPlayback: () => true,
    replanClickPathFromPlayer: () => false,
    checkForeground: () => false,
    getCameraZoomClamped: (value) => value,
    clampCameraX: (value) => value,
    clampCameraY: (value) => value,
    getCameraFollowTargetX: () => 40,
    getCameraFollowTargetY: () => 30,
    isGameCanvasGestureActive: () => false,
    getAudioUnlocked: () => false,
    getFootstepPlaying: () => footstepPlaying,
    setFootstepPlaying: (value) => { footstepPlaying = value; },
    setNearbyLights: (value) => { nearbyLights = value; },
    getScreenShake: () => screenShake,
    setScreenShake: (value) => { screenShake = value; },
    getCameraZoom: () => cameraZoom,
    setCameraZoom: (value) => { cameraZoom = value; },
    getCameraZoomTarget: () => cameraZoomTarget,
    setCameraZoomTarget: (value) => { cameraZoomTarget = value; },
    getCameraPanOffsetX: () => cameraPanOffsetX,
    setCameraPanOffsetX: (value) => { cameraPanOffsetX = value; },
    getCameraPanOffsetY: () => cameraPanOffsetY,
    setCameraPanOffsetY: (value) => { cameraPanOffsetY = value; },
    getCamX: () => camX,
    setCamX: (value) => { camX = value; },
    getCamY: () => camY,
    setCamY: (value) => { camY = value; },
    setTargetCamX: (value) => { targetCamX = value; },
    setTargetCamY: (value) => { targetCamY = value; },
    random: () => 0,
    log: () => {}
  });

  runtime.update(0.5);

  assert.ok(player.x > 10);
  assert.equal(moveTarget, null);
  assert.deepEqual(clickWalkPath, []);
  assert.equal(clickWalkGoal, null);
  assert.deepEqual(nearbyLights, []);
  assert.ok(camX > 0);
  assert.ok(camY > 0);
  assert.ok(cameraZoom > 1);
  assert.ok(particles[0].updateCalls > 0);
  assert.ok(clouds[0].updateCalls > 0);
});

test('index update runtime stops footsteps and settles idle player state', () => {
  const player = { x: 10, y: 10, speed: 20, dir: 0, frame: 4, animTimer: 0, isMoving: false };
  let footstepPlaying = true;
  const footstepSound = createSound();
  const runtime = updateRuntime.init({
    player,
    keys: {},
    particles: [],
    clouds: [],
    dustParticles: [],
    gameCanvasGesture: { mode: 'idle' },
    footstepSound,
    getGameReady: () => true,
    getMapW: () => 200,
    getMapH: () => 100,
    getIsReadingMode: () => false,
    getSpriteReady: () => false,
    getSprite: () => ({ frameWidth: 16, frameHeight: 20, scale: 1, baseScale: 1 }),
    footOffsetY: 0,
    getMoveTarget: () => null,
    setMoveTarget: () => {},
    getClickWalkPath: () => [],
    setClickWalkPath: () => {},
    getClickWalkGoal: () => null,
    setClickWalkGoal: () => {},
    getAutoWalkPath: () => [],
    getAutoWalkIndex: () => 0,
    setAutoWalkIndex: () => {},
    getAutoWalkFacingLockTimer: () => 0,
    setAutoWalkFacingLockTimer: () => {},
    getPlayerFootPosition: (x = player.x, y = player.y) => ({ x: x + 8, y: y + 20 }),
    setPlayerFromFootPosition: () => {},
    isFootSolid: () => false,
    findNearestFreeFootPoint: () => null,
    findPathAStar: () => [],
    chooseAutoWalkDirection: (_, __, fallback) => fallback,
    checkCollisionAt: () => false,
    allowAuxScPlayback: () => false,
    replanClickPathFromPlayer: () => false,
    checkForeground: () => false,
    getCameraZoomClamped: (value) => value,
    clampCameraX: (value) => value,
    clampCameraY: (value) => value,
    getCameraFollowTargetX: () => 0,
    getCameraFollowTargetY: () => 0,
    isGameCanvasGestureActive: () => false,
    getAudioUnlocked: () => false,
    getFootstepPlaying: () => footstepPlaying,
    setFootstepPlaying: (value) => { footstepPlaying = value; },
    setNearbyLights: () => {},
    getScreenShake: () => 0,
    setScreenShake: () => {},
    getCameraZoom: () => 1,
    setCameraZoom: () => {},
    getCameraZoomTarget: () => 1,
    setCameraZoomTarget: () => {},
    getCameraPanOffsetX: () => 0,
    setCameraPanOffsetX: () => {},
    getCameraPanOffsetY: () => 0,
    setCameraPanOffsetY: () => {},
    getCamX: () => 0,
    setCamX: () => {},
    getCamY: () => 0,
    setCamY: () => {},
    setTargetCamX: () => {},
    setTargetCamY: () => {},
    random: () => 0,
    log: () => {}
  });

  runtime.update(0.25);

  assert.equal(player.frame, 1);
  assert.equal(footstepSound.pauseCount, 1);
  assert.equal(footstepPlaying, false);
});
