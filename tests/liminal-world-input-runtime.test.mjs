import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/liminal3d/world-input-runtime.global.js');

const worldInputRuntime = globalThis.GameboyLiminalWorldInputRuntime;

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

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
}

test('liminal world input runtime restores mobile tap move target and look target', () => {
  const documentObject = createEventTarget({
    elementFromPoint() {
      return { nodeType: 1, closest: () => null };
    }
  });
  const move = { f: false, b: false, l: false, r: false };
  let moveTarget = null;
  let cameraLookTarget = null;
  const targetPoint = new Vector3(5, 0, -8);
  const raycaster = {
    ray: {
      intersectPlane() {
        return false;
      }
    },
    setFromCamera(mouse, camera) {
      this.lastMouse = mouse;
      this.lastCamera = camera;
    },
    intersectObjects() {
      return [{ object: { type: 'Mesh' }, point: targetPoint }];
    }
  };

  const runtime = worldInputRuntime.init({
    window: { innerWidth: 1200, innerHeight: 800 },
    document: documentObject,
    THREE: { Vector2, Vector3 },
    getWorldInputLockReason: () => '',
    isUiClickTarget: () => false,
    isPointInsideUi: () => false,
    getUiDeadzoneTop: () => 700,
    markUiInteraction: () => {},
    isRendererElement: () => true,
    getShieldRoots: () => [],
    getSuppressWorldInputUntil: () => 0,
    getLastUiInteractionAt: () => 0,
    getUiInteractionStarted: () => false,
    setUiInteractionStarted: () => {},
    getIsTouchDragging: () => false,
    setIsTouchDragging: () => {},
    getTouchMovedForTap: () => false,
    setTouchMovedForTap: () => {},
    getTouchStartedOnUi: () => false,
    setTouchStartedOnUi: () => {},
    getTouchStartedOnRenderer: () => true,
    setTouchStartedOnRenderer: () => {},
    getIsTouchValid: () => true,
    setIsTouchValid: () => {},
    getPlayer: () => ({ isReadingMode: false }),
    getRenderer: () => ({ domElement: {} }),
    getCamera: () => ({ position: { x: 0, y: 1.6, z: -2 } }),
    getScene: () => ({ children: [] }),
    getRaycaster: () => raycaster,
    getGroundPlane: () => ({}),
    getMoveTarget: () => moveTarget,
    setMoveTarget: (value) => { moveTarget = value; },
    getCameraLookTarget: () => cameraLookTarget,
    setCameraLookTarget: (value) => { cameraLookTarget = value; },
    getMoveState: () => move,
    isFallback2DMode: () => false,
    performanceNow: () => 1000,
    uiClickSuppressMs: 700,
    debugNote: () => {},
    cause: () => {},
    syncLookTargetsToCamera: () => {},
    log: () => {}
  });

  const applied = runtime.trySetMoveTargetFromScreenPoint(600, 300, true);
  assert.equal(applied, true);
  assert.ok(moveTarget);
  assert.equal(moveTarget.x, 2.5);
  assert.equal(moveTarget.y, 1.6);
  assert.equal(moveTarget.z, -8);
  assert.ok(cameraLookTarget);
  assert.equal(cameraLookTarget.x, 5);
  assert.equal(cameraLookTarget.y, 0);
  assert.equal(cameraLookTarget.z, -8);
});



test('liminal world input runtime prefers scene hits over ground-plane hits for mobile taps', () => {
  const documentObject = createEventTarget({
    elementFromPoint() {
      return { nodeType: 1, closest: () => null };
    }
  });
  let moveTarget = null;
  let cameraLookTarget = null;
  const scenePoint = new Vector3(2.1, 0.8, -6.5);
  const groundPoint = new Vector3(-2.4, 0, -20);
  const raycaster = {
    ray: {
      intersectPlane(_plane, target) {
        target.x = groundPoint.x;
        target.y = groundPoint.y;
        target.z = groundPoint.z;
        return true;
      }
    },
    setFromCamera() {},
    intersectObjects() {
      return [{ object: { type: 'Mesh' }, point: scenePoint }];
    }
  };

  const runtime = worldInputRuntime.init({
    window: { innerWidth: 430, innerHeight: 800 },
    document: documentObject,
    THREE: { Vector2, Vector3 },
    getWorldInputLockReason: () => '',
    isUiClickTarget: () => false,
    isPointInsideUi: () => false,
    getUiDeadzoneTop: () => 700,
    markUiInteraction: () => {},
    isRendererElement: () => true,
    getShieldRoots: () => [],
    getSuppressWorldInputUntil: () => 0,
    getLastUiInteractionAt: () => 0,
    getUiInteractionStarted: () => false,
    setUiInteractionStarted: () => {},
    getIsTouchDragging: () => false,
    setIsTouchDragging: () => {},
    getTouchMovedForTap: () => false,
    setTouchMovedForTap: () => {},
    getTouchStartedOnUi: () => false,
    setTouchStartedOnUi: () => {},
    getTouchStartedOnRenderer: () => true,
    setTouchStartedOnRenderer: () => {},
    getIsTouchValid: () => true,
    setIsTouchValid: () => {},
    getPlayer: () => ({ isReadingMode: false }),
    getRenderer: () => ({ domElement: {} }),
    getCamera: () => ({ position: { x: 0, y: 1.6, z: -2 } }),
    getScene: () => ({ children: [{ id: 'shelf' }] }),
    getRaycaster: () => raycaster,
    getGroundPlane: () => ({}),
    getMoveTarget: () => moveTarget,
    setMoveTarget: (value) => { moveTarget = value; },
    getCameraLookTarget: () => cameraLookTarget,
    setCameraLookTarget: (value) => { cameraLookTarget = value; },
    getMoveState: () => ({ f: false, b: false, l: false, r: false }),
    isFallback2DMode: () => false,
    performanceNow: () => 1000,
    debugNote: () => {},
    cause: () => {},
    log: () => {}
  });

  const applied = runtime.trySetMoveTargetFromScreenPoint(200, 200, true);
  assert.equal(applied, true);
  assert.ok(moveTarget);
  assert.equal(moveTarget.x, 2.1);
  assert.equal(moveTarget.y, 1.6);
  assert.equal(moveTarget.z, -6.5);
  assert.ok(cameraLookTarget);
  assert.equal(cameraLookTarget.x, 2.1);
  assert.equal(cameraLookTarget.y, 0.8);
  assert.equal(cameraLookTarget.z, -6.5);
});

test('liminal world input runtime blocks pinch zoom gestures on mobile', () => {
  const interactions = [];
  const causes = [];
  const documentObject = createEventTarget({
    elementFromPoint() {
      return { nodeType: 1, closest: () => null };
    }
  });

  worldInputRuntime.init({
    window: { innerWidth: 430, innerHeight: 800 },
    document: documentObject,
    THREE: { Vector2, Vector3 },
    getWorldInputLockReason: () => '',
    isUiClickTarget: () => false,
    isPointInsideUi: () => false,
    getUiDeadzoneTop: () => 700,
    markUiInteraction: (reason) => { interactions.push(reason); },
    isRendererElement: () => true,
    getShieldRoots: () => [],
    getSuppressWorldInputUntil: () => 0,
    getLastUiInteractionAt: () => 0,
    getUiInteractionStarted: () => false,
    setUiInteractionStarted: () => {},
    getIsTouchDragging: () => false,
    setIsTouchDragging: () => {},
    getTouchMovedForTap: () => false,
    setTouchMovedForTap: () => {},
    getTouchStartedOnUi: () => false,
    setTouchStartedOnUi: () => {},
    getTouchStartedOnRenderer: () => true,
    setTouchStartedOnRenderer: () => {},
    getIsTouchValid: () => true,
    setIsTouchValid: () => {},
    getPlayer: () => ({ isReadingMode: false }),
    getRenderer: () => ({ domElement: {} }),
    getCamera: () => ({ position: { x: 0, y: 1.6, z: -2 } }),
    getScene: () => ({ children: [] }),
    getRaycaster: () => ({ ray: { intersectPlane: () => false }, setFromCamera() {}, intersectObjects: () => [] }),
    getGroundPlane: () => ({}),
    getMoveTarget: () => null,
    setMoveTarget: () => {},
    getCameraLookTarget: () => null,
    setCameraLookTarget: () => {},
    getMoveState: () => ({ f: false, b: false, l: false, r: false }),
    isFallback2DMode: () => false,
    performanceNow: () => 1000,
    debugNote: () => {},
    cause: (code, detail) => { causes.push([code, detail]); },
    log: () => {}
  });

  const event = {
    type: 'touchmove',
    touches: [{ clientX: 10, clientY: 10 }, { clientX: 30, clientY: 30 }],
    preventDefault() {
      this.defaultPrevented = true;
    }
  };

  documentObject.emit('touchmove', event);

  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(interactions, ['gesture:touchmove']);
  assert.deepEqual(causes, [['C09_PINCH_ZOOM_BLOCKED', 'touchmove']]);
});


test('liminal world input runtime blocks move target updates when input is locked or backward', () => {
  let moveTarget = null;
  let cameraLookTarget = 'keep';
  let worldLocked = true;
  const runtime = worldInputRuntime.init({
    window: { innerWidth: 1200, innerHeight: 800 },
    document: createEventTarget({ elementFromPoint: () => null }),
    THREE: { Vector2, Vector3 },
    getWorldInputLockReason: () => (worldLocked ? 'archive-modal' : ''),
    isUiClickTarget: () => false,
    isPointInsideUi: () => false,
    getUiDeadzoneTop: () => 700,
    markUiInteraction: () => {},
    isRendererElement: () => true,
    getShieldRoots: () => [],
    getSuppressWorldInputUntil: () => 0,
    getLastUiInteractionAt: () => 0,
    getUiInteractionStarted: () => false,
    setUiInteractionStarted: () => {},
    getIsTouchDragging: () => false,
    setIsTouchDragging: () => {},
    getTouchMovedForTap: () => false,
    setTouchMovedForTap: () => {},
    getTouchStartedOnUi: () => false,
    setTouchStartedOnUi: () => {},
    getTouchStartedOnRenderer: () => true,
    setTouchStartedOnRenderer: () => {},
    getIsTouchValid: () => true,
    setIsTouchValid: () => {},
    getPlayer: () => ({ isReadingMode: false }),
    getRenderer: () => ({ domElement: {} }),
    getCamera: () => ({ position: { y: 1.6, z: -4 } }),
    getScene: () => ({ children: [] }),
    getRaycaster: () => ({
      ray: { intersectPlane: () => false },
      setFromCamera() {},
      intersectObjects() {
        return [{ object: { type: 'Mesh' }, point: new Vector3(1, 1.6, 2) }];
      }
    }),
    getGroundPlane: () => ({}),
    getMoveTarget: () => moveTarget,
    setMoveTarget: (value) => { moveTarget = value; },
    getCameraLookTarget: () => cameraLookTarget,
    setCameraLookTarget: (value) => { cameraLookTarget = value; },
    getMoveState: () => ({ f: false, b: false, l: false, r: false }),
    isFallback2DMode: () => false,
    performanceNow: () => 1000,
    debugNote: () => {},
    cause: () => {},
    log: () => {}
  });

  assert.equal(runtime.trySetMoveTargetFromScreenPoint(200, 200, false), false);
  assert.equal(moveTarget, null);

  worldLocked = false;
  assert.equal(runtime.trySetMoveTargetFromScreenPoint(200, 200, true), false);
  assert.equal(moveTarget, null);
  assert.equal(cameraLookTarget, null);
});

test('liminal world input runtime binds keyboard movement listeners', () => {
  const documentObject = createEventTarget({ elementFromPoint: () => null });
  const move = { f: false, b: false, l: false, r: false };
  worldInputRuntime.init({
    window: { innerWidth: 1200, innerHeight: 800 },
    document: documentObject,
    THREE: { Vector2, Vector3 },
    getWorldInputLockReason: () => '',
    isUiClickTarget: () => false,
    isPointInsideUi: () => false,
    getUiDeadzoneTop: () => 700,
    markUiInteraction: () => {},
    isRendererElement: () => true,
    getShieldRoots: () => [],
    getSuppressWorldInputUntil: () => 0,
    getLastUiInteractionAt: () => 0,
    getUiInteractionStarted: () => false,
    setUiInteractionStarted: () => {},
    getIsTouchDragging: () => false,
    setIsTouchDragging: () => {},
    getTouchMovedForTap: () => false,
    setTouchMovedForTap: () => {},
    getTouchStartedOnUi: () => false,
    setTouchStartedOnUi: () => {},
    getTouchStartedOnRenderer: () => true,
    setTouchStartedOnRenderer: () => {},
    getIsTouchValid: () => true,
    setIsTouchValid: () => {},
    getPlayer: () => ({ isReadingMode: false }),
    getRenderer: () => ({ domElement: {} }),
    getCamera: () => ({ position: { y: 1.6, z: -2 } }),
    getScene: () => ({ children: [] }),
    getRaycaster: () => ({ ray: { intersectPlane: () => false }, setFromCamera() {}, intersectObjects: () => [] }),
    getGroundPlane: () => ({}),
    getMoveTarget: () => null,
    setMoveTarget: () => {},
    getCameraLookTarget: () => null,
    setCameraLookTarget: () => {},
    getMoveState: () => move,
    isFallback2DMode: () => true,
    performanceNow: () => 1000,
    debugNote: () => {},
    cause: () => {},
    log: () => {}
  });

  assert.equal(documentObject.listenerCount('keydown'), 1);
  assert.equal(documentObject.listenerCount('keyup'), 1);

  documentObject.emit('keydown', { code: 'KeyW' });
  documentObject.emit('keydown', { code: 'ArrowLeft' });
  assert.equal(move.f, true);
  assert.equal(move.l, true);

  documentObject.emit('keyup', { code: 'KeyW' });
  documentObject.emit('keyup', { code: 'ArrowLeft' });
  assert.equal(move.f, false);
  assert.equal(move.l, false);
});


test('liminal world input runtime ignores desktop clicks outside the renderer', () => {
  const overlayEl = { nodeType: 1, closest: () => null };
  const canvasEl = { nodeType: 1, closest: () => null };
  const documentObject = createEventTarget({
    elementFromPoint() {
      return overlayEl;
    }
  });
  const causes = [];
  let moveTarget = null;

  worldInputRuntime.init({
    window: { innerWidth: 1200, innerHeight: 800 },
    document: documentObject,
    THREE: { Vector2, Vector3 },
    getWorldInputLockReason: () => '',
    isUiClickTarget: () => false,
    isPointInsideUi: () => false,
    getUiDeadzoneTop: () => 700,
    markUiInteraction: () => {},
    isRendererElement: (el) => el === canvasEl,
    getShieldRoots: () => [],
    getSuppressWorldInputUntil: () => 0,
    getLastUiInteractionAt: () => 0,
    getUiInteractionStarted: () => false,
    setUiInteractionStarted: () => {},
    getIsTouchDragging: () => false,
    setIsTouchDragging: () => {},
    getTouchMovedForTap: () => false,
    setTouchMovedForTap: () => {},
    getTouchStartedOnUi: () => false,
    setTouchStartedOnUi: () => {},
    getTouchStartedOnRenderer: () => true,
    setTouchStartedOnRenderer: () => {},
    getIsTouchValid: () => true,
    setIsTouchValid: () => {},
    getPlayer: () => ({ isReadingMode: false }),
    getRenderer: () => ({ domElement: canvasEl }),
    getCamera: () => ({ position: { y: 1.6, z: -2 } }),
    getScene: () => ({ children: [] }),
    getRaycaster: () => ({ ray: { intersectPlane: () => false }, setFromCamera() {}, intersectObjects: () => [] }),
    getGroundPlane: () => ({}),
    getMoveTarget: () => moveTarget,
    setMoveTarget: (value) => { moveTarget = value; },
    getCameraLookTarget: () => null,
    setCameraLookTarget: () => {},
    getMoveState: () => ({ f: false, b: false, l: false, r: false }),
    isFallback2DMode: () => false,
    performanceNow: () => 1000,
    debugNote: () => {},
    cause: (code, detail) => { causes.push([code, detail]); },
    log: () => {}
  });

  documentObject.emit('click', { clientX: 400, clientY: 300, target: overlayEl });

  assert.equal(moveTarget, null);
  assert.deepEqual(causes, [['C02_WORLD_BLOCKED_CLICK', 'not-renderer']]);
});
