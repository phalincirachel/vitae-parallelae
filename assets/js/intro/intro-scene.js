const FRONT_SPRITE_DATA = Object.freeze([
  Object.freeze({ left: 38, width: 141, footX: 106, footY: 267 }),
  Object.freeze({ left: 201, width: 138, footX: 273, footY: 265 }),
  Object.freeze({ left: 361, width: 140, footX: 436, footY: 270 }),
  Object.freeze({ left: 534, width: 137, footX: 604, footY: 268 })
]);
const FRONT_ANIM_CYCLE = Object.freeze([0, 1, 2, 3, 2, 1]);
const BACK_SPRITE_DATA = Object.freeze([
  Object.freeze({ left: 16, width: 147, footX: 90, footY: 282 }),
  Object.freeze({ left: 177, width: 144, footX: 253, footY: 283 }),
  Object.freeze({ left: 336, width: 152, footX: 417, footY: 285 })
]);
const BACK_ANIM_CYCLE = Object.freeze([0, 1, 2, 1]);
const SIDE_SPRITE_DATA = Object.freeze([
  Object.freeze({ left: 20, footX: 92, footY: 275 }),
  Object.freeze({ left: 200, footX: 268, footY: 281 }),
  Object.freeze({ left: 372, footX: 440, footY: 280 }),
  Object.freeze({ left: 528, footX: 595, footY: 284 })
]);
const SIDE_ANIM_CYCLE = Object.freeze([0, 1, 2, 3, 2, 1]);
const FOOT_OFFSET_Y = 15;
const TARGET_RATIO = 320 / 240;

class IntroYellowLight {
  constructor(x, y, id) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.seed = Math.random() * 100;
    this.animScale = 1;
    this.animPhase = 0;
    this.vanished = false;
  }

  collect() {
    if (this.animPhase !== 0 || this.vanished) return;
    this.animPhase = 1;
  }

  hitTest(worldX, worldY, radius = 18) {
    return Math.hypot(worldX - this.x, worldY - this.y) <= radius;
  }

  draw(ctx) {
    if (this.vanished) return;
    if (this.animPhase === 1) {
      this.animScale += 0.05;
      if (this.animScale >= 1.45) this.animPhase = 2;
    } else if (this.animPhase === 2) {
      this.animScale -= 0.08;
      if (this.animScale <= 0) {
        this.vanished = true;
        return;
      }
    }

    const time = Date.now() / 1000;
    const swayX = Math.sin(time + this.seed) * 1.4;
    const swayY = Math.cos(time * 1.2 + this.seed) * 1.4;
    const alpha = 0.78 + Math.sin(time * 2.4 + this.seed) * 0.12;
    const radius = Math.max(6, (10 + Math.sin(time * 3 + this.seed) * 2.5) * this.animScale);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gradient = ctx.createRadialGradient(this.x + swayX, this.y + swayY, 0, this.x + swayX, this.y + swayY, radius);
    gradient.addColorStop(0, `rgba(255,255,244,${alpha})`);
    gradient.addColorStop(0.45, `rgba(255,230,120,${alpha * 0.8})`);
    gradient.addColorStop(0.82, `rgba(255,193,54,${alpha * 0.32})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x + swayX, this.y + swayY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function createSilentAudioNode() {
  return {
    play() {
      return Promise.resolve();
    },
    pause() {}
  };
}

function createImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    try {
      image.decoding = 'async';
    } catch (_) {}
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function chooseAutoWalkDirection(dx, dy, fallback = 0) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 3 : 2;
  if (Math.abs(dy) > 0) return dy >= 0 ? 0 : 1;
  return fallback;
}

export async function createIntroScene(options = {}) {
  const windowRef = options.window || globalThis.window || globalThis;
  const documentRef = options.document || globalThis.document || null;
  const canvas = options.canvas || documentRef?.getElementById?.('gameCanvas') || null;
  const ctx = canvas?.getContext?.('2d') || null;
  if (!documentRef || !canvas || !ctx) {
    throw new Error('Intro scene requires a canvas context.');
  }

  const getIsReadingMode = typeof options.getIsReadingMode === 'function' ? options.getIsReadingMode : () => true;
  const getCanCollectOrb = typeof options.getCanCollectOrb === 'function' ? options.getCanCollectOrb : () => false;
  const onOrbCollected = typeof options.onOrbCollected === 'function' ? options.onOrbCollected : () => {};
  const sceneAssetPath = options.sceneAssetPath || 'assets/intro/einfuehrungsplatz.png';

  const state = {
    SCREEN_W: 320,
    SCREEN_H: 240,
    mapW: 0,
    mapH: 0,
    bgCanvas: null,
    fgCanvas: null,
    foregroundData: [],
    collisionData: [],
    yellowLights: [],
    greenPixels: [],
    flowData: [],
    gameReady: false,
    spriteReady: false,
    lastTime: 0,
    cameraZoom: 1,
    cameraZoomTarget: 1,
    cameraPanOffsetX: 0,
    cameraPanOffsetY: 0,
    camX: 0,
    camY: 0,
    targetCamX: 0,
    targetCamY: 0,
    nearbyLights: [],
    screenShake: 0,
    activeLightSourceId: null,
    footstepPlaying: false,
    moveTarget: null,
    clickWalkPath: [],
    clickWalkGoal: null,
    autoWalkPath: [],
    autoWalkIndex: 0,
    autoWalkFacingLockTimer: 0,
    orbCollected: false,
    renderState: null,
    drawRuntime: null,
    navRuntime: null,
    updateRuntime: null,
    loopRuntime: null,
    cleanup: []
  };

  const gameCanvasGesture = {
    pointers: new Map(),
    primaryPointerId: null,
    dragStartCanvasX: 0,
    dragStartCanvasY: 0,
    dragBaseOffsetX: 0,
    dragBaseOffsetY: 0,
    dragMoved: false,
    pinchActive: false,
    pinchStartDistance: 0,
    pinchFilteredDistance: 0,
    pinchStartZoom: 1,
    pinchAnchorWorldX: 0,
    pinchAnchorWorldY: 0,
    pinchCenterCanvasX: 0,
    pinchCenterCanvasY: 0,
    suppressTap: false,
    mode: 'idle'
  };

  const keys = {};
  const particles = [];
  const clouds = [];
  const dustParticles = [];
  const footstepSound = createSilentAudioNode();
  const sprite = {
    frameWidth: 0,
    frameHeight: 0,
    cols: 4,
    baseScale: 0.15,
    scale: 0.15
  };
  const player = {
    x: 0,
    y: 0,
    w: 14,
    h: 8,
    speed: 35,
    dir: 0,
    frame: 1,
    animTimer: 0,
    isMoving: false,
    isBehindForeground: false,
    stuckTime: 0,
    repathCooldown: 0,
    embedTime: 0,
    lastFootX: Number.NaN,
    lastFootY: Number.NaN
  };

  const sprites = {
    front: null,
    back: null,
    side: null
  };

  function updateDimensions() {
    const winW = windowRef.innerWidth || 1280;
    const winH = windowRef.innerHeight || 720;
    const winRatio = winW / Math.max(1, winH);
    if (winRatio > TARGET_RATIO) {
      state.SCREEN_H = 240;
      state.SCREEN_W = Math.ceil(state.SCREEN_H * winRatio);
    } else {
      state.SCREEN_W = 320;
      state.SCREEN_H = Math.ceil(state.SCREEN_W / Math.max(0.1, winRatio));
    }
    canvas.width = state.SCREEN_W;
    canvas.height = state.SCREEN_H;
  }

  function getCameraViewWidth() {
    return state.SCREEN_W / Math.max(0.0001, state.cameraZoom);
  }

  function getCameraViewHeight() {
    return state.SCREEN_H / Math.max(0.0001, state.cameraZoom);
  }

  function getCameraZoomClamped(nextZoom) {
    const fitZoom = (state.mapW > 0 && state.mapH > 0)
      ? Math.max(state.SCREEN_W / Math.max(1, state.mapW), state.SCREEN_H / Math.max(1, state.mapH))
      : 1;
    const minZoom = Math.max(0.85, fitZoom);
    return Math.min(2.25, Math.max(minZoom, Number.isFinite(nextZoom) ? nextZoom : 1));
  }

  function clampCameraX(nextX) {
    const maxX = Math.max(0, state.mapW - getCameraViewWidth());
    return Math.max(0, Math.min(nextX, maxX));
  }

  function clampCameraY(nextY) {
    const maxY = Math.max(0, state.mapH - getCameraViewHeight());
    return Math.max(0, Math.min(nextY, maxY));
  }

  function getCameraFollowTargetX() {
    return clampCameraX(player.x - (getCameraViewWidth() * 0.5) + 10);
  }

  function getCameraFollowTargetY() {
    return clampCameraY(player.y - (getCameraViewHeight() * 0.3) + 10);
  }

  function getCanvasPointFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      canvasX: (clientX - rect.left) * (canvas.width / rect.width),
      canvasY: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function screenPointToWorld(clientX, clientY) {
    const point = getCanvasPointFromClient(clientX, clientY);
    if (!point) return null;
    return {
      canvasX: point.canvasX,
      canvasY: point.canvasY,
      worldX: state.camX + (point.canvasX / Math.max(0.0001, state.cameraZoom)),
      worldY: state.camY + (point.canvasY / Math.max(0.0001, state.cameraZoom))
    };
  }

  function getGameCameraPanLimitX() {
    const mapSlack = Math.max(0, state.mapW - getCameraViewWidth());
    return Math.max(0, Math.min(192, Math.min(getCameraViewWidth() * 0.48, mapSlack * 0.82)));
  }

  function getGameCameraPanLimitY() {
    const mapSlack = Math.max(0, state.mapH - getCameraViewHeight());
    return Math.max(0, Math.min(144, Math.min(getCameraViewHeight() * 0.4, mapSlack * 0.78)));
  }

  function applyGameCameraRubberBand(nextOffset, limit) {
    if (!Number.isFinite(nextOffset) || limit <= 0) return 0;
    const sign = nextOffset < 0 ? -1 : 1;
    const distance = Math.abs(nextOffset);
    const maxInput = limit * 1.85;
    const t = Math.min(1, distance / Math.max(1, maxInput));
    const eased = 1 - Math.pow(1 - t, 1.65);
    return sign * (limit * eased);
  }

  function setGameCameraPanFromDrag(deltaX, deltaY, baseOffsetX = 0, baseOffsetY = 0) {
    const zoom = Math.max(0.0001, state.cameraZoom);
    state.cameraPanOffsetX = applyGameCameraRubberBand(baseOffsetX - (deltaX / zoom), getGameCameraPanLimitX());
    state.cameraPanOffsetY = applyGameCameraRubberBand(baseOffsetY - (deltaY / zoom), getGameCameraPanLimitY());
  }

  function isGameCanvasGestureActive() {
    return gameCanvasGesture.mode === 'drag' || gameCanvasGesture.mode === 'pinch';
  }

  function resetGameCanvasGestureState() {
    gameCanvasGesture.pointers.clear();
    gameCanvasGesture.primaryPointerId = null;
    gameCanvasGesture.dragStartCanvasX = 0;
    gameCanvasGesture.dragStartCanvasY = 0;
    gameCanvasGesture.dragBaseOffsetX = 0;
    gameCanvasGesture.dragBaseOffsetY = 0;
    gameCanvasGesture.dragMoved = false;
    gameCanvasGesture.pinchActive = false;
    gameCanvasGesture.pinchStartDistance = 0;
    gameCanvasGesture.pinchFilteredDistance = 0;
    gameCanvasGesture.pinchStartZoom = state.cameraZoom;
    gameCanvasGesture.pinchAnchorWorldX = 0;
    gameCanvasGesture.pinchAnchorWorldY = 0;
    gameCanvasGesture.pinchCenterCanvasX = 0;
    gameCanvasGesture.pinchCenterCanvasY = 0;
    gameCanvasGesture.suppressTap = false;
    gameCanvasGesture.mode = 'idle';
  }

  function syncCanvasTouchAction() {
    canvas.style.touchAction = (!getIsReadingMode() && windowRef.PointerEvent) ? 'none' : '';
  }

  function getCurrentSpriteSize() {
    const ready = state.spriteReady;
    return {
      w: ready ? sprite.frameWidth * sprite.scale : 16,
      h: ready ? sprite.frameHeight * sprite.scale : 20
    };
  }

  function collectOrb(light) {
    if (!light || state.orbCollected) return false;
    state.orbCollected = true;
    state.activeLightSourceId = light.id;
    light.collect();
    onOrbCollected(light);
    return true;
  }

  function handleOrbPointerDown(event) {
    if (!getCanCollectOrb() || !state.gameReady || getIsReadingMode()) return;
    const point = screenPointToWorld(event.clientX, event.clientY);
    if (!point) return;
    const light = state.yellowLights.find((entry) => !entry.vanished && entry.hitTest(point.worldX, point.worldY));
    if (!light) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    collectOrb(light);
  }

  function initRuntimes() {
    const drawApi = windowRef.GameboyIndexDrawRuntime.init({
      document: documentRef,
      navigator: windowRef.navigator,
      ctx,
      canvas,
      player,
      particles,
      clouds,
      dustParticles,
      yellowLights: state.yellowLights,
      getGameReady: () => state.gameReady,
      getMapW: () => state.mapW,
      getMapH: () => state.mapH,
      getForegroundData: () => state.foregroundData,
      getBgImage: () => state.bgCanvas,
      getForegroundImage: () => state.fgCanvas,
      getScreenShake: () => state.screenShake,
      getCameraZoom: () => state.cameraZoom,
      getCamX: () => state.camX,
      getCamY: () => state.camY,
      getNearbyLights: () => state.nearbyLights,
      setNearbyLights: (value) => {
        state.nearbyLights = Array.isArray(value) ? value : [];
      },
      getActiveLightSourceId: () => state.activeLightSourceId,
      getIsLoreMode: () => false,
      getIsReadingMode,
      getSpriteReady: () => state.spriteReady,
      getSprite: () => sprite,
      getSpriteFront: () => sprites.front,
      getSpriteBack: () => sprites.back,
      getSpriteSide: () => sprites.side,
      frontSpriteData: FRONT_SPRITE_DATA,
      frontAnimCycle: FRONT_ANIM_CYCLE,
      backSpriteData: BACK_SPRITE_DATA,
      backAnimCycle: BACK_ANIM_CYCLE,
      sideSpriteData: SIDE_SPRITE_DATA,
      sideAnimCycle: SIDE_ANIM_CYCLE
    });

    const navApi = windowRef.GameboyIndexNavigationRuntime.init({
      window: windowRef,
      document: documentRef,
      canvas,
      keys,
      player,
      gameCanvasGesture,
      getGameReady: () => state.gameReady,
      getIsReadingMode,
      getMapW: () => state.mapW,
      getMapH: () => state.mapH,
      getCollisionData: () => state.collisionData,
      getCurrentSpriteSize,
      footOffsetY: FOOT_OFFSET_Y,
      getMoveTarget: () => state.moveTarget,
      setMoveTarget: (value) => {
        state.moveTarget = value;
      },
      getClickWalkPath: () => state.clickWalkPath,
      setClickWalkPath: (value) => {
        state.clickWalkPath = Array.isArray(value) ? value : [];
      },
      getClickWalkGoal: () => state.clickWalkGoal,
      setClickWalkGoal: (value) => {
        state.clickWalkGoal = value;
      },
      getCameraZoom: () => state.cameraZoom,
      setCameraZoomTarget: (value) => {
        state.cameraZoomTarget = value;
      },
      getCameraPanOffsetX: () => state.cameraPanOffsetX,
      getCameraPanOffsetY: () => state.cameraPanOffsetY,
      getCanvasPointFromClient,
      screenPointToWorld,
      setGameCameraPanFromDrag,
      getCameraZoomClamped,
      resetGameCanvasGestureState,
      onTogglePal: () => {},
      onToggleHalftone: () => {},
      onPreventDirectionalFocus: () => {}
    });

    const updateApi = windowRef.GameboyIndexUpdateRuntime.init({
      player,
      keys,
      particles,
      clouds,
      dustParticles,
      gameCanvasGesture,
      footstepSound,
      getGameReady: () => state.gameReady,
      getMapW: () => state.mapW,
      getMapH: () => state.mapH,
      getIsReadingMode,
      getSpriteReady: () => state.spriteReady,
      getSprite: () => sprite,
      getMoveTarget: () => state.moveTarget,
      setMoveTarget: (value) => {
        state.moveTarget = value;
      },
      getClickWalkPath: () => state.clickWalkPath,
      setClickWalkPath: (value) => {
        state.clickWalkPath = Array.isArray(value) ? value : [];
      },
      getClickWalkGoal: () => state.clickWalkGoal,
      setClickWalkGoal: (value) => {
        state.clickWalkGoal = value;
      },
      getAutoWalkPath: () => [],
      getAutoWalkIndex: () => 0,
      setAutoWalkIndex: () => {},
      getPlayerFootPosition: (...args) => navApi.getPlayerFootPosition(...args),
      setPlayerFromFootPosition: (...args) => navApi.setPlayerFromFootPosition(...args),
      isFootSolid: (...args) => navApi.isFootSolid(...args),
      findNearestFreeFootPoint: (...args) => navApi.findNearestFreeFootPoint(...args),
      findPathAStar: (...args) => navApi.findPathAStar(...args),
      chooseAutoWalkDirection,
      checkCollisionAt: (px, py) => {
        const foot = navApi.getPlayerFootPosition(px, py);
        return navApi.isFootSolid(foot.x, foot.y, 0, 0);
      },
      allowAuxScPlayback: () => false,
      replanClickPathFromPlayer: () => navApi.replanClickPathFromPlayer(),
      checkForeground: (...args) => drawApi.checkForeground(...args),
      getCameraZoomClamped,
      clampCameraX,
      clampCameraY,
      getCameraFollowTargetX,
      getCameraFollowTargetY,
      isGameCanvasGestureActive,
      getAudioUnlocked: () => false,
      getFootstepPlaying: () => state.footstepPlaying,
      setFootstepPlaying: (value) => {
        state.footstepPlaying = !!value;
      },
      setNearbyLights: (value) => {
        state.nearbyLights = Array.isArray(value) ? value : [];
      },
      getScreenShake: () => state.screenShake,
      setScreenShake: (value) => {
        state.screenShake = Number(value) || 0;
      },
      getCameraZoom: () => state.cameraZoom,
      setCameraZoom: (value) => {
        state.cameraZoom = value;
      },
      getCameraZoomTarget: () => state.cameraZoomTarget,
      setCameraZoomTarget: (value) => {
        state.cameraZoomTarget = value;
      },
      getCameraPanOffsetX: () => state.cameraPanOffsetX,
      setCameraPanOffsetX: (value) => {
        state.cameraPanOffsetX = value;
      },
      getCameraPanOffsetY: () => state.cameraPanOffsetY,
      setCameraPanOffsetY: (value) => {
        state.cameraPanOffsetY = value;
      },
      getCamX: () => state.camX,
      setCamX: (value) => {
        state.camX = value;
      },
      getCamY: () => state.camY,
      setCamY: (value) => {
        state.camY = value;
      },
      setTargetCamX: (value) => {
        state.targetCamX = value;
      },
      setTargetCamY: (value) => {
        state.targetCamY = value;
      },
      getAutoWalkFacingLockTimer: () => state.autoWalkFacingLockTimer,
      setAutoWalkFacingLockTimer: (value) => {
        state.autoWalkFacingLockTimer = value;
      },
      footOffsetY: FOOT_OFFSET_Y
    });

    const loopApi = windowRef.GameboyIndexLoopRuntime.init({
      window: windowRef,
      document: documentRef,
      hideLoadingScreenSafely: () => {},
      update: (dt) => updateApi.update(dt),
      updateLoreSystem: () => {},
      draw: () => drawApi.draw(),
      getGameReady: () => state.gameReady,
      getLastTime: () => state.lastTime,
      setLastTime: (value) => {
        state.lastTime = value;
      }
    });

    state.drawRuntime = drawApi;
    state.navRuntime = navApi;
    state.updateRuntime = updateApi;
    state.loopRuntime = loopApi;
  }

  async function preload() {
    if (state.gameReady) return api;
    updateDimensions();
    syncCanvasTouchAction();

    const [sceneImage, front, back, side] = await Promise.all([
      createImage(sceneAssetPath),
      createImage('assets/spriteneu.png'),
      createImage('assets/spriterueckenneu.png'),
      createImage('assets/seitlichneu.png')
    ]);

    sprites.front = front;
    sprites.back = back;
    sprites.side = side;
    sprite.frameWidth = Math.floor(front.width / sprite.cols);
    sprite.frameHeight = front.height;
    state.spriteReady = true;

    const mapResult = windowRef.GameboyIndexMapRuntime.processMapImage({
      document: documentRef,
      image: sceneImage,
      createYellowLight: (x, y, id) => new IntroYellowLight(x, y, id)
    });

    state.mapW = mapResult.mapW;
    state.mapH = mapResult.mapH;
    state.bgCanvas = mapResult.bgCanvas;
    state.fgCanvas = mapResult.fgCanvas;
    state.foregroundData = mapResult.foregroundData;
    state.collisionData = mapResult.collisionData;
    state.yellowLights = mapResult.yellowLights;
    state.greenPixels = mapResult.greenPixels;
    state.flowData = mapResult.flowData;

    if (mapResult.spawnPixel) {
      player.x = mapResult.spawnPixel.x - (sprite.frameWidth * sprite.scale * 0.5);
      player.y = mapResult.spawnPixel.y - (sprite.frameHeight * sprite.scale) - FOOT_OFFSET_Y;
    }

    initRuntimes();
    state.navRuntime.generateNavGrid();
    state.gameReady = true;
    state.cameraZoom = getCameraZoomClamped(1);
    state.cameraZoomTarget = state.cameraZoom;
    state.camX = clampCameraX(player.x);
    state.camY = clampCameraY(player.y);
    state.targetCamX = state.camX;
    state.targetCamY = state.camY;
    state.loopRuntime.startGameLoop();
    return api;
  }

  function setReadingMode(nextValue) {
    syncCanvasTouchAction();
    if (!nextValue) {
      state.cameraPanOffsetX = 0;
      state.cameraPanOffsetY = 0;
    }
  }

  function destroy() {
    state.cleanup.forEach((cleanup) => cleanup());
    state.cleanup.length = 0;
  }

  const resizeHandler = () => {
    updateDimensions();
  };
  const pointerHandler = (event) => handleOrbPointerDown(event);
  windowRef.addEventListener('resize', resizeHandler);
  canvas.addEventListener('pointerdown', pointerHandler, true);
  state.cleanup.push(() => windowRef.removeEventListener('resize', resizeHandler));
  state.cleanup.push(() => canvas.removeEventListener('pointerdown', pointerHandler, true));

  const api = {
    preload,
    destroy,
    setReadingMode,
    collectOrb,
    getOrbCollected() {
      return state.orbCollected;
    },
    getState() {
      return state;
    }
  };

  return api;
}

export default createIntroScene;
