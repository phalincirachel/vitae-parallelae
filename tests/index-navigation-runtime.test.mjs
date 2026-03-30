import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/index2d/navigation-runtime.global.js');

const navigationRuntime = globalThis.GameboyIndexNavigationRuntime;

function createEventTarget(initial = {}) {
  const listeners = new Map();
  return Object.assign(initial, {
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    emit(type, event = {}) {
      for (const handler of listeners.get(type) || []) {
        handler(event);
      }
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    }
  });
}

function createCollisionData(width, height, blocked = []) {
  const blockedSet = new Set(blocked.map(([x, y]) => `${x},${y}`));
  return Array.from({ length: height }, (_, y) => (
    Array.from({ length: width }, (_, x) => blockedSet.has(`${x},${y}`))
  ));
}

test('index navigation runtime binds key listeners and clears manual path state', () => {
  const windowObject = createEventTarget();
  const canvas = createEventTarget({ tagName: 'CANVAS' });
  const keys = {};
  let moveTarget = { x: 12, y: 8 };
  let clickWalkPath = [{ x: 1, y: 2 }];
  let clickWalkGoal = { x: 9, y: 9 };
  let palToggles = 0;
  let halftoneToggles = 0;
  let focusCalls = 0;

  const runtime = navigationRuntime.init({
    window: windowObject,
    canvas,
    keys,
    player: { x: 0, y: 0 },
    gameCanvasGesture: { pointers: new Map(), mode: 'idle' },
    getGameReady: () => true,
    getIsReadingMode: () => false,
    getMapW: () => 64,
    getMapH: () => 64,
    getCollisionData: () => createCollisionData(64, 64),
    getCurrentSpriteSize: () => ({ w: 16, h: 20 }),
    getMoveTarget: () => moveTarget,
    setMoveTarget: (value) => { moveTarget = value; },
    getClickWalkPath: () => clickWalkPath,
    setClickWalkPath: (value) => { clickWalkPath = value; },
    getClickWalkGoal: () => clickWalkGoal,
    setClickWalkGoal: (value) => { clickWalkGoal = value; },
    getCanvasPointFromClient: () => ({ canvasX: 10, canvasY: 10 }),
    screenPointToWorld: () => ({ worldX: 20, worldY: 20 }),
    setGameCameraPanFromDrag: () => {},
    getCameraZoomClamped: (value) => value,
    resetGameCanvasGestureState: () => {},
    onTogglePal: () => { palToggles += 1; },
    onToggleHalftone: () => { halftoneToggles += 1; },
    onPreventDirectionalFocus: () => { focusCalls += 1; },
    performanceNow: () => 0
  });

  assert.equal(windowObject.listenerCount('keydown'), 1);
  assert.equal(windowObject.listenerCount('keyup'), 1);

  let prevented = false;
  runtime.handleKeyDown({
    key: 'ArrowUp',
    preventDefault() {
      prevented = true;
    }
  });
  assert.equal(prevented, true);
  assert.equal(focusCalls, 1);
  assert.equal(keys.arrowup, true);
  assert.equal(keys.ArrowUp, true);
  assert.equal(moveTarget, null);
  assert.deepEqual(clickWalkPath, []);
  assert.equal(clickWalkGoal, null);

  runtime.handleKeyDown({ key: '1' });
  runtime.handleKeyDown({ key: '2' });
  assert.equal(palToggles, 1);
  assert.equal(halftoneToggles, 1);

  runtime.handleKeyUp({ key: 'ArrowUp' });
  assert.equal(keys.arrowup, false);
  assert.equal(keys.ArrowUp, false);
});

test('index navigation runtime computes direct click path and nav grid state', () => {
  const canvas = createEventTarget({ tagName: 'CANVAS' });
  let clickWalkPath = [];
  let clickWalkGoal = null;
  let moveTarget = { x: 1, y: 1 };
  const runtime = navigationRuntime.init({
    canvas,
    keys: {},
    player: { x: 0, y: 0 },
    gameCanvasGesture: { pointers: new Map(), mode: 'idle' },
    getGameReady: () => true,
    getIsReadingMode: () => false,
    getMapW: () => 64,
    getMapH: () => 64,
    getCollisionData: () => createCollisionData(64, 64),
    getCurrentSpriteSize: () => ({ w: 16, h: 20 }),
    footOffsetY: 0,
    getMoveTarget: () => moveTarget,
    setMoveTarget: (value) => { moveTarget = value; },
    getClickWalkPath: () => clickWalkPath,
    setClickWalkPath: (value) => { clickWalkPath = value; },
    getClickWalkGoal: () => clickWalkGoal,
    setClickWalkGoal: (value) => { clickWalkGoal = value; },
    getCanvasPointFromClient: () => ({ canvasX: 16, canvasY: 16 }),
    screenPointToWorld: () => ({ worldX: 32, worldY: 40 }),
    setGameCameraPanFromDrag: () => {},
    getCameraZoomClamped: (value) => value,
    resetGameCanvasGestureState: () => {}
  });

  runtime.generateNavGrid();
  const navState = runtime.getNavState();
  assert.equal(navState.navGridW, 8);
  assert.equal(navState.navGridH, 8);

  runtime.handleClickMove(100, 120);
  assert.deepEqual(clickWalkGoal, { x: 32, y: 40 });
  assert.equal(moveTarget, null);
  assert.deepEqual(clickWalkPath, [{ x: 32, y: 40 }]);
});

test('index navigation runtime finds nearby free point when current foot cell is blocked', () => {
  const blocked = [];
  for (let y = 0; y <= 8; y++) {
    for (let x = 0; x <= 8; x++) {
      blocked.push([x, y]);
    }
  }
  const runtime = navigationRuntime.init({
    canvas: createEventTarget({ tagName: 'CANVAS' }),
    keys: {},
    player: { x: 0, y: 0 },
    gameCanvasGesture: { pointers: new Map(), mode: 'idle' },
    getGameReady: () => true,
    getIsReadingMode: () => false,
    getMapW: () => 32,
    getMapH: () => 32,
    getCollisionData: () => createCollisionData(32, 32, blocked),
    getCurrentSpriteSize: () => ({ w: 16, h: 20 }),
    getMoveTarget: () => null,
    setMoveTarget: () => {},
    getClickWalkPath: () => [],
    setClickWalkPath: () => {},
    getClickWalkGoal: () => null,
    setClickWalkGoal: () => {},
    getCanvasPointFromClient: () => null,
    screenPointToWorld: () => null,
    setGameCameraPanFromDrag: () => {},
    getCameraZoomClamped: (value) => value,
    resetGameCanvasGestureState: () => {}
  });

  const freePoint = runtime.findNearestFreeFootPoint(4, 4, 20);
  assert.ok(freePoint);
  assert.notDeepEqual(freePoint, { x: 4, y: 4 });
  assert.equal(runtime.isFootSolid(freePoint.x, freePoint.y, 1, 1), false);
});

test('index navigation runtime keeps click-to-move without camera pan for sub-threshold pointer jitter', () => {
  const canvas = createEventTarget({
    tagName: 'CANVAS',
    setPointerCapture() {},
    releasePointerCapture() {}
  });

  const gesture = {
    pointers: new Map(),
    mode: 'idle',
    primaryPointerId: null,
    dragStartCanvasX: 0,
    dragStartCanvasY: 0,
    dragBaseOffsetX: 0,
    dragBaseOffsetY: 0,
    dragMoved: false,
    pinchActive: false,
    pinchStartDistance: 0,
    pinchStartZoom: 1,
    suppressTap: false
  };

  const resetGesture = () => {
    gesture.pointers.clear();
    gesture.mode = 'idle';
    gesture.primaryPointerId = null;
    gesture.dragMoved = false;
    gesture.suppressTap = false;
    gesture.dragStartClientX = 0;
    gesture.dragStartClientY = 0;
  };

  let clickWalkPath = [];
  let clickWalkGoal = null;
  let panCalls = 0;
  const collisionData = createCollisionData(128, 128);

  navigationRuntime.init({
    canvas,
    keys: {},
    player: { x: 0, y: 0 },
    gameCanvasGesture: gesture,
    hasPointerEvent: true,
    dragThresholdPx: 10,
    getGameReady: () => true,
    getIsReadingMode: () => false,
    getMapW: () => 128,
    getMapH: () => 128,
    getCollisionData: () => collisionData,
    getCurrentSpriteSize: () => ({ w: 16, h: 20 }),
    getMoveTarget: () => null,
    setMoveTarget: () => {},
    getClickWalkPath: () => clickWalkPath,
    setClickWalkPath: (value) => { clickWalkPath = value; },
    getClickWalkGoal: () => clickWalkGoal,
    setClickWalkGoal: (value) => { clickWalkGoal = value; },
    getCanvasPointFromClient: (clientX, clientY) => ({
      canvasX: clientX * 4,
      canvasY: clientY * 4
    }),
    screenPointToWorld: (clientX, clientY) => ({
      worldX: clientX,
      worldY: clientY,
      canvasX: clientX * 4,
      canvasY: clientY * 4
    }),
    setGameCameraPanFromDrag: () => { panCalls += 1; },
    getCameraZoom: () => 1,
    getCameraZoomClamped: (value) => value,
    setCameraZoomTarget: () => {},
    getCameraPanOffsetX: () => 0,
    getCameraPanOffsetY: () => 0,
    resetGameCanvasGestureState: resetGesture
  });

  canvas.emit('pointerdown', {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    target: canvas,
    clientX: 100,
    clientY: 100,
    preventDefault() {}
  });

  canvas.emit('pointermove', {
    pointerId: 1,
    clientX: 103,
    clientY: 100,
    preventDefault() {}
  });

  canvas.emit('pointerup', {
    pointerId: 1,
    clientX: 103,
    clientY: 100
  });

  assert.equal(panCalls, 0);
  assert.deepEqual(clickWalkGoal, { x: 103, y: 100 });
  assert.equal(clickWalkPath.length, 1);
  assert.deepEqual(clickWalkPath[0], { x: 103, y: 100 });
  assert.equal(gesture.mode, 'idle');
});

test('index navigation runtime starts camera pan only after threshold and suppresses tap move', () => {
  const canvas = createEventTarget({
    tagName: 'CANVAS',
    setPointerCapture() {},
    releasePointerCapture() {}
  });

  const gesture = {
    pointers: new Map(),
    mode: 'idle',
    primaryPointerId: null,
    dragStartCanvasX: 0,
    dragStartCanvasY: 0,
    dragBaseOffsetX: 0,
    dragBaseOffsetY: 0,
    dragMoved: false,
    pinchActive: false,
    pinchStartDistance: 0,
    pinchStartZoom: 1,
    suppressTap: false
  };

  const resetGesture = () => {
    gesture.pointers.clear();
    gesture.mode = 'idle';
    gesture.primaryPointerId = null;
    gesture.dragMoved = false;
    gesture.suppressTap = false;
    gesture.dragStartClientX = 0;
    gesture.dragStartClientY = 0;
  };

  let clickWalkPath = [];
  let clickWalkGoal = null;
  let panCalls = 0;
  const collisionData = createCollisionData(128, 128);

  navigationRuntime.init({
    canvas,
    keys: {},
    player: { x: 0, y: 0 },
    gameCanvasGesture: gesture,
    hasPointerEvent: true,
    dragThresholdPx: 10,
    getGameReady: () => true,
    getIsReadingMode: () => false,
    getMapW: () => 128,
    getMapH: () => 128,
    getCollisionData: () => collisionData,
    getCurrentSpriteSize: () => ({ w: 16, h: 20 }),
    getMoveTarget: () => null,
    setMoveTarget: () => {},
    getClickWalkPath: () => clickWalkPath,
    setClickWalkPath: (value) => { clickWalkPath = value; },
    getClickWalkGoal: () => clickWalkGoal,
    setClickWalkGoal: (value) => { clickWalkGoal = value; },
    getCanvasPointFromClient: (clientX, clientY) => ({
      canvasX: clientX * 4,
      canvasY: clientY * 4
    }),
    screenPointToWorld: (clientX, clientY) => ({
      worldX: clientX,
      worldY: clientY,
      canvasX: clientX * 4,
      canvasY: clientY * 4
    }),
    setGameCameraPanFromDrag: () => { panCalls += 1; },
    getCameraZoom: () => 1,
    getCameraZoomClamped: (value) => value,
    setCameraZoomTarget: () => {},
    getCameraPanOffsetX: () => 0,
    getCameraPanOffsetY: () => 0,
    resetGameCanvasGestureState: resetGesture
  });

  canvas.emit('pointerdown', {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    target: canvas,
    clientX: 100,
    clientY: 100,
    preventDefault() {}
  });

  canvas.emit('pointermove', {
    pointerId: 1,
    clientX: 116,
    clientY: 100,
    preventDefault() {}
  });

  canvas.emit('pointerup', {
    pointerId: 1,
    clientX: 116,
    clientY: 100
  });

  assert.ok(panCalls > 0);
  assert.equal(clickWalkGoal, null);
  assert.deepEqual(clickWalkPath, []);
  assert.equal(gesture.mode, 'idle');
});
