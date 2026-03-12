import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/liminal3d/hallway-runtime.global.js');

const hallwayRuntime = globalThis.GameboyLiminalHallwayRuntime;

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

  copy(other) {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }

  add(other) {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }
}

class BaseNode {
  constructor() {
    this.children = [];
    this.position = new Vector3();
    this.rotation = { x: 0, y: 0, z: 0, set(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } };
    this.parent = null;
    this.visible = true;
  }

  add(node) {
    node.parent = this;
    this.children.push(node);
  }

  remove(node) {
    this.children = this.children.filter((entry) => entry !== node);
    if (node) node.parent = null;
  }

  getWorldPosition(target) {
    target.copy(this.position);
    if (this.parent && this.parent.position) target.add(this.parent.position);
    return target;
  }

  updateMatrixWorld() {}
}

class Group extends BaseNode {}

class Mesh extends BaseNode {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
    this.castShadow = false;
    this.receiveShadow = false;
    this.frustumCulled = true;
  }
}

class Points extends Mesh {}

class PointLight extends BaseNode {
  constructor(color, intensity, distance) {
    super();
    this.color = color;
    this.intensity = intensity;
    this.distance = distance;
  }
}

class Object3D extends BaseNode {
  constructor() {
    super();
    this.scale = { set() {} };
    this.matrix = {};
  }

  updateMatrix() {}
}

class Material {
  constructor(config = {}) {
    this.config = config;
    Object.assign(this, config);
  }

  clone() {
    return new this.constructor({ ...this.config });
  }

  dispose() {
    this.disposed = true;
  }
}

class MeshStandardMaterial extends Material {}
class MeshBasicMaterial extends Material {}
class PointsMaterial extends Material {}

class Geometry {
  constructor(...args) {
    this.args = args;
    this.index = { array: Array.from({ length: 36 }, (_, index) => index) };
    this.attributes = {};
  }

  setIndex(value) {
    this.index = { array: value };
  }

  clearGroups() {}

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  dispose() {
    this.disposed = true;
  }
}

class PlaneGeometry extends Geometry {}
class BoxGeometry extends Geometry {}
class SphereGeometry extends Geometry {}
class CylinderGeometry extends Geometry {}
class BufferGeometry extends Geometry {}

class BufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.needsUpdate = false;
  }
}

class CanvasTexture {
  constructor(canvas) {
    this.canvas = canvas;
    this.repeat = { set() {} };
  }
}

class InstancedMesh extends Mesh {
  constructor(geometry, material, count) {
    super(geometry, material);
    this.count = count;
    this.instanceMatrix = { needsUpdate: false };
    this.instanceColor = { needsUpdate: false };
  }

  setMatrixAt() {}

  setColorAt() {}
}

class Color {
  constructor(value = 0) {
    this.value = value;
    this.r = 0;
  }

  setHex(value) {
    this.value = value;
    return this;
  }
}

function createCanvasContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect() {},
    putImageData() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    createRadialGradient() {
      return { addColorStop() {} };
    },
    getImageData() {
      return { data: new Uint8ClampedArray(512 * 512 * 4) };
    }
  };
}

function createDocument() {
  return {
    hidden: false,
    createElement(tagName) {
      assert.equal(tagName, 'canvas');
      return {
        width: 0,
        height: 0,
        getContext() {
          return createCanvasContext();
        }
      };
    }
  };
}

function createThreeStub() {
  return {
    Vector3,
    Group,
    Mesh,
    Points,
    PointLight,
    Object3D,
    MeshStandardMaterial,
    MeshBasicMaterial,
    PointsMaterial,
    PlaneGeometry,
    BoxGeometry,
    SphereGeometry,
    CylinderGeometry,
    BufferGeometry,
    BufferAttribute,
    CanvasTexture,
    InstancedMesh,
    Color,
    RepeatWrapping: 'repeat',
    AdditiveBlending: 'additive'
  };
}

test('liminal hallway runtime exposes temp vectors, shimmer controls and segment freeze behavior', () => {
  const THREE = createThreeStub();
  const documentObject = createDocument();
  const scene = {
    children: [],
    add(node) {
      this.children.push(node);
    },
    remove(node) {
      this.children = this.children.filter((entry) => entry !== node);
    }
  };
  let readerBackgroundVolume = 0.5;
  let hasStartedGame = false;
  let contentSwitchInProgress = false;
  class SCAudioAdapter {
    constructor() {
      this.audio = null;
      this.paused = true;
      this.volume = 0;
      this.src = '';
    }

    pause() {}

    play() {
      return Promise.resolve();
    }
  }

  const windowObject = {
    fallback2DMode: false,
    dustTex: null,
    AudioVisibilityManager: { unregister() {} },
    matchMedia() {
      return { matches: false };
    },
    audioPlayer: { paused: true, audio: { isProbablyPlaying: () => false } },
    visualFreezeActive: false,
    requestAnimationFrame(callback) {
      return callback();
    },
    cancelAnimationFrame() {}
  };

  const runtime = hallwayRuntime.init({
    window: windowObject,
    document: documentObject,
    THREE,
    scene,
    config: { roomWidth: 5, segmentLength: 10, shelfDepth: 1, roomHeight: 4 },
    isIOSSafari: false,
    SCAudioAdapter,
    getSCUrl: (value) => value,
    getReaderBackgroundVolume: () => readerBackgroundVolume,
    liminalDebugNote: () => {},
    currentSceneName: 'liminal_library',
    loreProgressDefaultTotal: 8,
    debugLogs: false,
    requestAnimationFrame: (callback) => windowObject.requestAnimationFrame(callback),
    cancelAnimationFrame: () => {},
    getHasStartedGame: () => hasStartedGame,
    getContentSwitchInProgress: () => contentSwitchInProgress
  });

  assert.ok(runtime.getTmpLookDir());
  assert.ok(runtime.getTmpMovementInput());
  assert.equal(runtime.getSegmentLength(), 10);
  assert.equal(runtime.getInitialSegmentStartZ(), 40);
  assert.equal(runtime.getActiveSegmentTarget(), 5);
  assert.equal(runtime.getShimmerSound().volume, 0.2);

  readerBackgroundVolume = 0.75;
  runtime.applyBackgroundSfxVolume('test');
  assert.ok(Math.abs(runtime.getShimmerSound().volume - 0.3) < 1e-9);

  const preloadSegment = runtime.createPreloadSegment(40, 10, () => {});
  runtime.pushSegment(preloadSegment);
  assert.equal(preloadSegment.isPreload, true);
  assert.equal(scene.children.length >= 1, true);
  assert.equal(preloadSegment.bookBuildPaused, false);

  runtime.setSegmentGenerationPaused(true);
  assert.equal(preloadSegment.bookBuildPaused, false);

  hasStartedGame = true;
  runtime.setSegmentGenerationPaused(true);
  assert.equal(preloadSegment.bookBuildPaused, true);
  runtime.setSegmentGenerationPaused(false);

  contentSwitchInProgress = true;
  assert.equal(runtime.allowAuxSfxPlaybackLiminal(), false);
  contentSwitchInProgress = false;
  assert.equal(runtime.allowAuxSfxPlaybackLiminal(), true);
});

test('liminal hallway runtime recycles the oldest segment when the player advances', () => {
  const runtime = hallwayRuntime.init({
    window: {
      fallback2DMode: true,
      matchMedia() {
        return { matches: false };
      },
      AudioVisibilityManager: { unregister() {} },
      audioPlayer: null,
      requestAnimationFrame() {},
      cancelAnimationFrame() {}
    },
    document: createDocument(),
    THREE: createThreeStub(),
    scene: { add() {}, remove() {} },
    config: { roomWidth: 5, segmentLength: 10, shelfDepth: 1, roomHeight: 4 },
    getReaderBackgroundVolume: () => 1,
    liminalDebugNote: () => {},
    currentSceneName: 'liminal_library',
    loreProgressDefaultTotal: 8,
    requestAnimationFrame() {},
    cancelAnimationFrame() {},
    getHasStartedGame: () => true,
    getContentSwitchInProgress: () => false,
    SCAudioAdapter: class {
      constructor() {
        this.volume = 0;
        this.audio = null;
      }
    },
    getSCUrl: (value) => value
  });

  const resets = [];
  for (const zStart of [40, 30, 20, 10, 0]) {
    runtime.pushSegment({
      zStart,
      isPreload: false,
      reset(newZ) {
        resets.push([zStart, newZ]);
        this.zStart = newZ;
      }
    });
  }

  runtime.updateSegments(24);
  const segments = runtime.getSegments();
  assert.equal(resets.length, 1);
  assert.deepEqual(resets[0], [40, -10]);
  assert.equal(segments[segments.length - 1].zStart, -10);
});
