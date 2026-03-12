import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/liminal3d/scene-bootstrap-runtime.global.js');

const bootstrapRuntime = globalThis.GameboyLiminalSceneBootstrapRuntime;

function createEventTarget(initial = {}) {
  const listeners = new Map();
  return Object.assign(initial, {
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    }
  });
}

function createThreeStub(shouldThrow = false) {
  class Scene {
    constructor() {
      this.added = [];
      this.background = null;
      this.fog = null;
      this.children = [];
    }

    add(node) {
      this.added.push(node);
      this.children.push(node);
    }
  }

  class FogExp2 {
    constructor(color, density) {
      this.color = color;
      this.density = density;
    }
  }

  class Color {
    constructor(value) {
      this.value = value;
    }
  }

  class PerspectiveCamera {
    constructor(fov, aspect, near, far) {
      this.fov = fov;
      this.aspect = aspect;
      this.near = near;
      this.far = far;
      this.position = {
        x: 0,
        y: 0,
        z: 0,
        set: (x, y, z) => {
          this.position.x = x;
          this.position.y = y;
          this.position.z = z;
        }
      };
      this.up = {};
      this.matrix = {};
      this.projectionUpdates = 0;
    }

    updateProjectionMatrix() {
      this.projectionUpdates += 1;
    }
  }

  class Euler {
    constructor(x, y, z, order) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.order = order;
    }
  }

  class SphereGeometry {
    constructor(radius) {
      this.radius = radius;
    }
  }

  class MeshBasicMaterial {
    constructor(config) {
      this.config = config;
    }
  }

  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
    }
  }

  class Vector3 {
    setFromMatrixColumn() {
      return this;
    }

    crossVectors() {
      return this;
    }
  }

  class WebGLRenderer {
    constructor() {
      if (shouldThrow) {
        throw new Error('webgl failed');
      }
      this.shadowMap = {};
      this.sizeCalls = [];
      this.pixelRatios = [];
      this.domElement = createEventTarget();
    }

    setSize(width, height, updateStyle) {
      this.sizeCalls.push([width, height, updateStyle]);
    }

    setPixelRatio(value) {
      this.pixelRatios.push(value);
    }
  }

  return {
    Scene,
    FogExp2,
    Color,
    PerspectiveCamera,
    Euler,
    Mesh,
    SphereGeometry,
    MeshBasicMaterial,
    Vector3,
    WebGLRenderer,
    PCFSoftShadowMap: 'soft-shadow',
    ACESFilmicToneMapping: 'aces-tone'
  };
}

test('liminal scene bootstrap runtime initializes scene, renderer and viewport sync', () => {
  const THREE = createThreeStub(false);
  const appended = [];
  let renderArchiveCalls = 0;
  const documentObject = {
    body: {
      style: {},
      appendChild(node) {
        appended.push(node);
      }
    },
    getElementById() {
      return null;
    }
  };
  const runtime = bootstrapRuntime.init({
    window: { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 2, visualViewport: { width: 1000, height: 700 } },
    document: documentObject,
    THREE,
    isIOSSafari: false,
    getIsReadingMode: () => true,
    getIsFallback2DMode: () => false,
    setFallback2DMode: () => {},
    renderArchive: () => { renderArchiveCalls += 1; },
    refreshLoreProgressUi: () => {},
    log: () => {},
    warn: () => {},
    error: () => {}
  });

  assert.ok(runtime.scene);
  assert.ok(runtime.camera);
  assert.ok(runtime.renderer);
  assert.equal(runtime.backgroundModeColor, 0x010101);
  assert.equal(runtime.camera.position.y, 1.6);
  assert.equal(runtime.scene.background.value, 0x010101);
  assert.equal(appended.length, 1);
  assert.deepEqual(runtime.renderer.sizeCalls[0], [1200, 800, undefined]);
  assert.deepEqual(runtime.renderer.sizeCalls[1], [1000, 700, false]);
  assert.equal(runtime.camera.aspect, 1000 / 700);
  runtime.renderArchiveContent();
  assert.equal(renderArchiveCalls, 1);
  runtime.syncViewport();
  assert.equal(runtime.camera.projectionUpdates >= 2, true);
});

test('liminal scene bootstrap runtime falls back when renderer init fails', () => {
  const THREE = createThreeStub(true);
  let fallbackMode = false;
  let refreshCalls = 0;
  const loading = { style: { display: 'block' } };
  const loadingScreen = { style: { display: 'block' } };
  const uiContainer = { style: { display: 'none' } };
  const documentObject = {
    body: { style: {}, appendChild() {} },
    getElementById(id) {
      if (id === 'loading') return loading;
      if (id === 'loading-screen') return loadingScreen;
      if (id === 'audioPlayerUI') return uiContainer;
      return null;
    }
  };

  const runtime = bootstrapRuntime.init({
    window: { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 2 },
    document: documentObject,
    THREE,
    isIOSSafari: false,
    getIsReadingMode: () => false,
    getIsFallback2DMode: () => fallbackMode,
    setFallback2DMode: (value) => { fallbackMode = value; },
    renderArchive: () => {},
    refreshLoreProgressUi: () => { refreshCalls += 1; },
    log: () => {},
    warn: () => {},
    error: () => {}
  });

  assert.equal(fallbackMode, true);
  assert.equal(documentObject.body.style.backgroundColor, '#050505');
  assert.equal(loading.style.display, 'none');
  assert.equal(loadingScreen.style.display, 'none');
  assert.equal(uiContainer.style.display, 'flex');
  assert.equal(refreshCalls, 1);
  assert.equal(runtime.renderer, null);
});
