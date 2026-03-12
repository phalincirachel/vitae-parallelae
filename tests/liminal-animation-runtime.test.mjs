import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/liminal3d/animation-runtime.global.js');

const animationRuntime = globalThis.GameboyLiminalAnimationRuntime;

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  add(other) {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }

  sub(other) {
    this.x -= other.x;
    this.y -= other.y;
    this.z -= other.z;
    return this;
  }

  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }

  multiplyScalar(value) {
    this.x *= value;
    this.y *= value;
    this.z *= value;
    return this;
  }

  normalize() {
    const len = this.length();
    if (len > 0) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }

  length() {
    return Math.sqrt((this.x * this.x) + (this.y * this.y) + (this.z * this.z));
  }

  copy(other) {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  applyQuaternion() {
    return this;
  }
}

function createEuler() {
  return {
    x: 0,
    y: 0,
    z: 0,
    setFromQuaternion() {
      return this;
    }
  };
}

test('liminal animation runtime drives segment updates, rendering and lore collection', async () => {
  const scheduled = [];
  const windowObject = {
    visualFreezeActive: false,
    gamePaused: false,
    requestAnimationFrame(callback) {
      scheduled.push(callback);
      return scheduled.length;
    }
  };
  const debugHud = { innerText: '' };
  const documentObject = {
    getElementById(id) {
      return id === 'debugHUD' ? debugHud : null;
    }
  };
  const camera = {
    position: new Vector3(0, 1.6, -8),
    quaternion: {
      setFromEuler(euler) {
        this.lastEuler = { x: euler.x, y: euler.y, z: euler.z };
      }
    }
  };
  const euler = createEuler();
  const velocity = new Vector3(0, 0, 0);
  const mouse = { x: 0, y: 0 };
  const move = { f: false, b: false, l: false, r: false };
  const segmentCalls = [];
  const book = {
    id: 'lore-book-1',
    collected: false,
    missed: false,
    worldPos: new Vector3(0.2, 1.6, -8.3),
    mesh: { visible: true },
    updateCalls: 0,
    collectCalls: 0,
    update() {
      this.updateCalls += 1;
    },
    collect() {
      this.collected = true;
      this.collectCalls += 1;
    }
  };
  const shimmerSound = {
    paused: false,
    currentTime: 12,
    pauseCalls: 0,
    playCalls: 0,
    pause() {
      this.pauseCalls += 1;
    },
    play() {
      this.playCalls += 1;
      return Promise.resolve();
    }
  };

  let lastShimmerAt = 0;
  let refreshCalls = 0;
  let renderArchiveCalls = 0;
  let startLoreModeId = null;
  let updateSegmentsZ = null;
  let renderedFrames = 0;
  let targetMouseX = null;
  let targetMouseY = null;
  const runtime = animationRuntime.init({
    root: { GameState: {
      isLightCollected: () => false,
      collectLight: async () => 'chapter-lore-7'
    } },
    window: windowObject,
    document: documentObject,
    requestAnimationFrame: (callback) => windowObject.requestAnimationFrame(callback),
    performanceNow: (() => {
      let now = 1000;
      return () => {
        now += 16;
        return now;
      };
    })(),
    getClock: () => ({
      getDelta: () => 0.016,
      getElapsedTime: () => 42
    }),
    getCamera: () => camera,
    getEuler: () => euler,
    getRenderer: () => ({
      render(scene, currentCamera) {
        renderedFrames += 1;
        assert.equal(scene.name, 'liminal-scene');
        assert.equal(currentCamera, camera);
      }
    }),
    getScene: () => ({ name: 'liminal-scene' }),
    getVelocity: () => velocity,
    getMoveState: () => move,
    getMouse: () => mouse,
    setTargetMouseX: (value) => { targetMouseX = value; },
    setTargetMouseY: (value) => { targetMouseY = value; },
    getIsReadingMode: () => false,
    getIsFallback2DMode: () => false,
    getWorldInputLockReason: () => '',
    getSuppressWorldInputUntil: () => 0,
    getLastUiInteractionAt: () => 0,
    getCameraLookTarget: () => null,
    setCameraLookTarget: () => {},
    setIsLookingAtClickTarget: () => {},
    getIsCenteringCamera: () => false,
    setIsCenteringCamera: () => {},
    syncLookTargetsToCamera: () => {},
    flushDeferredReadingModeRender: () => {},
    getTmpLookDir: () => new Vector3(),
    getTmpMovementInput: () => new Vector3(),
    getTmpForwardDir: () => new Vector3(),
    getTmpRightDir: () => new Vector3(),
    getTmpMoveDir: () => new Vector3(),
    getTmpVelocityStep: () => new Vector3(),
    updateSegments: (playerZ) => { updateSegmentsZ = playerZ; },
    getSegments: () => [{ update(delta, time, position) { segmentCalls.push([delta, time, position.z]); } }],
    getActiveGlowingBooks: () => [book],
    getCurrentChapterProgress: () => ({ collected: 1, total: 4 }),
    refreshLoreProgressUi: () => { refreshCalls += 1; },
    renderArchive: () => { renderArchiveCalls += 1; },
    startLoreMode: (id) => { startLoreModeId = id; },
    allowAuxSfxPlaybackLiminal: () => true,
    getShimmerSound: () => shimmerSound,
    getLastShimmerAt: () => lastShimmerAt,
    setLastShimmerAt: (value) => { lastShimmerAt = value; },
    getDebugLogs: () => false,
    debugNote: () => {},
    cause: () => {},
    log: () => {},
    warn: () => {},
    error: () => {}
  });

  assert.equal(runtime.startAnimationLoop(), true);
  assert.equal(runtime.isAnimationLoopRunning(), true);
  assert.equal(scheduled.length, 1);

  scheduled.shift()();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(updateSegmentsZ, -8);
  assert.equal(segmentCalls.length, 1);
  assert.equal(renderedFrames, 1);
  assert.equal(book.updateCalls, 1);
  assert.equal(book.collectCalls, 1);
  assert.equal(refreshCalls, 1);
  assert.equal(renderArchiveCalls, 1);
  assert.equal(startLoreModeId, 'chapter-lore-7');
  assert.equal(shimmerSound.pauseCalls, 1);
  assert.equal(shimmerSound.playCalls, 1);
  assert.match(debugHud.innerText, /Segments: 1/);
  assert.equal(targetMouseX, null);
  assert.equal(targetMouseY, null);
  assert.equal(scheduled.length >= 1, true);
});

test('liminal animation runtime stops when visual freeze is active', () => {
  const scheduled = [];
  const windowObject = {
    visualFreezeActive: false,
    gamePaused: false,
    requestAnimationFrame(callback) {
      scheduled.push(callback);
    }
  };
  const runtime = animationRuntime.init({
    window: windowObject,
    requestAnimationFrame: (callback) => windowObject.requestAnimationFrame(callback),
    performanceNow: () => 1000,
    getIsFallback2DMode: () => true,
    error: () => {}
  });

  runtime.startAnimationLoop();
  assert.equal(runtime.isAnimationLoopRunning(), true);
  windowObject.visualFreezeActive = true;
  scheduled.shift()();
  assert.equal(runtime.isAnimationLoopRunning(), false);
});


test('liminal animation runtime wraps click-look yaw to the short rotation path', () => {
  const scheduled = [];
  const camera = {
    position: new Vector3(0, 0, 0),
    quaternion: {
      setFromEuler(nextEuler) {
        this.lastEuler = { x: nextEuler.x, y: nextEuler.y, z: nextEuler.z };
      }
    }
  };
  const euler = {
    x: 0,
    y: 3.1,
    z: 0,
    setFromQuaternion() {
      return this;
    }
  };
  const lookStates = [];
  let cameraLookTarget = new Vector3(-0.1, 0, 1);

  const runtime = animationRuntime.init({
    window: {
      visualFreezeActive: false,
      gamePaused: false,
      requestAnimationFrame(callback) {
        scheduled.push(callback);
      }
    },
    requestAnimationFrame(callback) {
      scheduled.push(callback);
    },
    performanceNow: (() => {
      let now = 1000;
      return () => {
        now += 16;
        return now;
      };
    })(),
    getClock: () => ({ getDelta: () => 0.016, getElapsedTime: () => 1 }),
    getCamera: () => camera,
    getEuler: () => euler,
    getRenderer: () => ({ render() {} }),
    getScene: () => ({ children: [] }),
    getVelocity: () => new Vector3(0, 0, 0),
    getMoveState: () => ({ f: false, b: false, l: false, r: false }),
    getMouse: () => ({ x: 0, y: 0 }),
    setTargetMouseX: () => {},
    setTargetMouseY: () => {},
    getIsReadingMode: () => false,
    getIsFallback2DMode: () => false,
    getWorldInputLockReason: () => '',
    getSuppressWorldInputUntil: () => 0,
    getLastUiInteractionAt: () => 0,
    getMoveTarget: () => null,
    setMoveTarget: () => {},
    getCameraLookTarget: () => cameraLookTarget,
    setCameraLookTarget: (value) => { cameraLookTarget = value; },
    setIsLookingAtClickTarget: (value) => { lookStates.push(value); },
    getIsCenteringCamera: () => false,
    setIsCenteringCamera: () => {},
    syncLookTargetsToCamera: () => {},
    flushDeferredReadingModeRender: () => {},
    getTmpLookDir: () => new Vector3(),
    getTmpMovementInput: () => new Vector3(),
    getTmpForwardDir: () => new Vector3(),
    getTmpRightDir: () => new Vector3(),
    getTmpMoveDir: () => new Vector3(),
    getTmpVelocityStep: () => new Vector3(),
    updateSegments: () => {},
    getSegments: () => [],
    getActiveGlowingBooks: () => [],
    getCurrentChapterProgress: () => ({ collected: 0, total: 0 }),
    refreshLoreProgressUi: () => {},
    renderArchive: () => {},
    startLoreMode: () => {},
    allowAuxSfxPlaybackLiminal: () => false,
    getShimmerSound: () => null,
    getLastShimmerAt: () => 0,
    setLastShimmerAt: () => {},
    getDebugLogs: () => false,
    debugNote: () => {},
    cause: () => {},
    log: () => {},
    error: () => {}
  });

  assert.equal(runtime.startAnimationLoop(), true);
  assert.equal(scheduled.length, 1);

  scheduled.shift()();

  assert.equal(lookStates.includes(true), true);
  assert.equal(euler.y > 3.09, true);
  assert.equal(camera.quaternion.lastEuler.y > 3.09, true);
  assert.equal(cameraLookTarget instanceof Vector3, true);
});
