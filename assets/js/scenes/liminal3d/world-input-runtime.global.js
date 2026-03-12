(function initLiminalWorldInputRuntime(globalObject) {
  function initLiminalWorldInputRuntime(options = {}) {
    const root = options.root || globalObject;
    const windowObject = options.window || root.window || root;
    const documentObject = options.document || root.document || null;
    const THREE = options.THREE || null;
    const getWorldInputLockReason = typeof options.getWorldInputLockReason === 'function' ? options.getWorldInputLockReason : () => '';
    const isUiClickTarget = typeof options.isUiClickTarget === 'function' ? options.isUiClickTarget : () => false;
    const isPointInsideUi = typeof options.isPointInsideUi === 'function' ? options.isPointInsideUi : () => false;
    const getUiDeadzoneTop = typeof options.getUiDeadzoneTop === 'function' ? options.getUiDeadzoneTop : () => Number.POSITIVE_INFINITY;
    const markUiInteraction = typeof options.markUiInteraction === 'function' ? options.markUiInteraction : () => {};
    const isRendererElement = typeof options.isRendererElement === 'function' ? options.isRendererElement : () => false;
    const getShieldRoots = typeof options.getShieldRoots === 'function' ? options.getShieldRoots : () => [];
    const getSuppressWorldInputUntil = typeof options.getSuppressWorldInputUntil === 'function' ? options.getSuppressWorldInputUntil : () => 0;
    const getLastUiInteractionAt = typeof options.getLastUiInteractionAt === 'function' ? options.getLastUiInteractionAt : () => 0;
    const getUiInteractionStarted = typeof options.getUiInteractionStarted === 'function' ? options.getUiInteractionStarted : () => false;
    const setUiInteractionStarted = typeof options.setUiInteractionStarted === 'function' ? options.setUiInteractionStarted : () => {};
    const getIsTouchDragging = typeof options.getIsTouchDragging === 'function' ? options.getIsTouchDragging : () => false;
    const setIsTouchDragging = typeof options.setIsTouchDragging === 'function' ? options.setIsTouchDragging : () => {};
    const getTouchMovedForTap = typeof options.getTouchMovedForTap === 'function' ? options.getTouchMovedForTap : () => false;
    const setTouchMovedForTap = typeof options.setTouchMovedForTap === 'function' ? options.setTouchMovedForTap : () => {};
    const getTouchStartedOnUi = typeof options.getTouchStartedOnUi === 'function' ? options.getTouchStartedOnUi : () => false;
    const setTouchStartedOnUi = typeof options.setTouchStartedOnUi === 'function' ? options.setTouchStartedOnUi : () => {};
    const getTouchStartedOnRenderer = typeof options.getTouchStartedOnRenderer === 'function' ? options.getTouchStartedOnRenderer : () => false;
    const setTouchStartedOnRenderer = typeof options.setTouchStartedOnRenderer === 'function' ? options.setTouchStartedOnRenderer : () => {};
    const getIsTouchValid = typeof options.getIsTouchValid === 'function' ? options.getIsTouchValid : () => true;
    const setIsTouchValid = typeof options.setIsTouchValid === 'function' ? options.setIsTouchValid : () => {};
    const getPlayer = typeof options.getPlayer === 'function' ? options.getPlayer : () => null;
    const getRenderer = typeof options.getRenderer === 'function' ? options.getRenderer : () => null;
    const getCamera = typeof options.getCamera === 'function' ? options.getCamera : () => null;
    const getScene = typeof options.getScene === 'function' ? options.getScene : () => null;
    const getRaycaster = typeof options.getRaycaster === 'function' ? options.getRaycaster : () => null;
    const getGroundPlane = typeof options.getGroundPlane === 'function' ? options.getGroundPlane : () => null;
    const getMoveTarget = typeof options.getMoveTarget === 'function' ? options.getMoveTarget : () => null;
    const setMoveTarget = typeof options.setMoveTarget === 'function' ? options.setMoveTarget : () => {};
    const getCameraLookTarget = typeof options.getCameraLookTarget === 'function' ? options.getCameraLookTarget : () => null;
    const setCameraLookTarget = typeof options.setCameraLookTarget === 'function' ? options.setCameraLookTarget : () => {};
    const getMoveState = typeof options.getMoveState === 'function' ? options.getMoveState : () => ({ f: false, b: false, l: false, r: false });
    const isFallback2DMode = typeof options.isFallback2DMode === 'function' ? options.isFallback2DMode : () => false;
    const getPerformanceNow = typeof options.performanceNow === 'function'
      ? options.performanceNow
      : () => ((windowObject.performance && typeof windowObject.performance.now === 'function') ? windowObject.performance.now() : Date.now());
    const uiClickSuppressMs = Number.isFinite(options.uiClickSuppressMs) ? options.uiClickSuppressMs : 700;
    const disablePinchZoom = options.disablePinchZoom !== false;
    const mobileViewportMaxWidth = Number.isFinite(options.mobileViewportMaxWidth) ? options.mobileViewportMaxWidth : 768;
    const mobileTapMaxX = Number.isFinite(options.mobileTapMaxX) ? options.mobileTapMaxX : 1.75;
    const mobileTapMaxLateralStep = Number.isFinite(options.mobileTapMaxLateralStep) ? options.mobileTapMaxLateralStep : 1.55;
    const mobileTapLookEnabled = !!options.mobileTapLookEnabled;
    const debugNote = typeof options.debugNote === 'function' ? options.debugNote : () => {};
    const cause = typeof options.cause === 'function' ? options.cause : () => {};
    const syncLookTargetsToCamera = typeof options.syncLookTargetsToCamera === 'function' ? options.syncLookTargetsToCamera : () => {};
    const getIsLookingAtClickTarget = typeof options.getIsLookingAtClickTarget === 'function' ? options.getIsLookingAtClickTarget : () => false;
    const setIsLookingAtClickTarget = typeof options.setIsLookingAtClickTarget === 'function' ? options.setIsLookingAtClickTarget : () => {};
    const getIsCenteringCamera = typeof options.getIsCenteringCamera === 'function' ? options.getIsCenteringCamera : () => false;
    const setIsCenteringCamera = typeof options.setIsCenteringCamera === 'function' ? options.setIsCenteringCamera : () => {};
    const log = typeof options.log === 'function' ? options.log : () => {};

    function resetTouchFlags() {
      setIsTouchDragging(false);
      setTouchMovedForTap(false);
      setTouchStartedOnUi(false);
      setTouchStartedOnRenderer(false);
      setIsTouchValid(true);
    }

    function isMobileViewport() {
      return Number(windowObject.innerWidth || 0) <= mobileViewportMaxWidth;
    }

    function preventPinchZoom(event) {
      if (!disablePinchZoom || !isMobileViewport()) return false;
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      markUiInteraction(`gesture:${event && event.type ? event.type : 'unknown'}`);
      debugNote('gesture-block', event && event.type ? event.type : 'unknown');
      cause('C09_PINCH_ZOOM_BLOCKED', event && event.type ? event.type : 'unknown');
      return true;
    }

    function bindUiInputShield() {
      const shieldEvents = ['pointerdown', 'touchstart', 'touchend', 'click'];
      const onShield = (event) => {
        const targetInfo = event.target && event.target.id
          ? event.target.id
          : (event.target && event.target.className ? String(event.target.className) : event.type);
        markUiInteraction(`shield:${event.type}:${targetInfo}`);
      };
      for (const rootNode of getShieldRoots()) {
        if (!rootNode || typeof rootNode.addEventListener !== 'function') continue;
        for (const eventName of shieldEvents) {
          rootNode.addEventListener(eventName, onShield, true);
        }
      }
    }

    function trySetMoveTargetFromScreenPoint(clientX, clientY, isMobileTap) {
      if (isFallback2DMode()) return false;
      const worldLockReason = getWorldInputLockReason();
      if (worldLockReason) {
        debugNote('move-skip', `world-lock:${worldLockReason}`);
        cause('C04_WORLD_BLOCKED_TOUCH', `move-skip:world-lock:${worldLockReason}`);
        return false;
      }

      const now = getPerformanceNow();
      const sinceUi = now - getLastUiInteractionAt();
      if (now < getSuppressWorldInputUntil()) {
        debugNote('move-skip', 'suppressed-window');
        cause('C04_WORLD_BLOCKED_TOUCH', 'move-skip:suppressed-window');
        return false;
      }
      if (clientY >= getUiDeadzoneTop() || isPointInsideUi(clientX, clientY)) {
        debugNote('move-skip', 'ui-deadzone-boundary');
        cause('C04_WORLD_BLOCKED_TOUCH', 'move-skip:ui-deadzone-boundary');
        return false;
      }

      const camera = getCamera();
      const raycaster = getRaycaster();
      const scene = getScene();
      const groundPlane = getGroundPlane();
      if (!THREE || !camera || !raycaster || !scene || !groundPlane) return false;

      const clickScreenX = (clientX / windowObject.innerWidth) * 2 - 1;
      const clickScreenY = (clientY / windowObject.innerHeight) * 2 - 1;
      const clickMouse = new THREE.Vector2();
      clickMouse.x = clickScreenX;
      clickMouse.y = -clickScreenY;
      raycaster.setFromCamera(clickMouse, camera);

      let target = null;
      const groundTarget = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, groundTarget)) {
        target = groundTarget;
      } else if (scene && Array.isArray(scene.children)) {
        const intersects = raycaster.intersectObjects(scene.children, true);
        for (let i = 0; i < intersects.length; i++) {
          if (intersects[i].object.type === 'Points') continue;
          target = intersects[i].point;
          break;
        }
      }

      if (!target) return false;

      const baseClampedX = Math.max(-2.5, Math.min(2.5, target.x));
      const currentCameraX = Number(camera.position && camera.position.x);
      const safeCameraX = Number.isFinite(currentCameraX) ? currentCameraX : 0;
      let navigationX = baseClampedX;
      if (isMobileTap) {
        const mobileClampedX = Math.max(-mobileTapMaxX, Math.min(mobileTapMaxX, baseClampedX));
        const lateralDelta = mobileClampedX - safeCameraX;
        const limitedDelta = Math.max(-mobileTapMaxLateralStep, Math.min(mobileTapMaxLateralStep, lateralDelta));
        navigationX = safeCameraX + limitedDelta;
      }
      const navigationTarget = new THREE.Vector3(navigationX, camera.position.y, target.z);

      if (isPointInsideUi(clientX, clientY) || clientY >= getUiDeadzoneTop()) {
        cause('C05_MOVE_SET_FROM_UI_REGION', `x=${clientX} y=${clientY}`);
      }
      if (sinceUi < uiClickSuppressMs + 30) {
        cause('C06_MOVE_SET_RECENT_UI_WINDOW', `sinceUi=${sinceUi.toFixed(0)}ms`);
      }

      if (navigationTarget.z > camera.position.z + 2.0) {
        log('Ignored Backwards Click');
        setCameraLookTarget(null);
        debugNote('move-skip', 'backwards-target');
        return false;
      }

      if (isMobileTap) {
        if (mobileTapLookEnabled) {
          setCameraLookTarget(navigationTarget.clone());
        } else {
          setCameraLookTarget(null);
        }
      }

      setMoveTarget(navigationTarget);
      debugNote('move-set', `${isMobileTap ? 'tap' : 'click'} x=${navigationTarget.x.toFixed(2)} z=${navigationTarget.z.toFixed(2)}`);
      log('Moving to:', getMoveTarget(), 'Looking at:', getCameraLookTarget());
      return true;
    }

    bindUiInputShield();

    if (documentObject && typeof documentObject.addEventListener === 'function') {
      documentObject.addEventListener('touchstart', (event) => {
        if (event && event.touches && event.touches.length > 1) {
          preventPinchZoom(event);
        }
      }, { passive: false });

      documentObject.addEventListener('touchmove', (event) => {
        if (event && event.touches && event.touches.length > 1) {
          preventPinchZoom(event);
        }
      }, { passive: false });

      ['gesturestart', 'gesturechange', 'gestureend'].forEach((eventName) => {
        documentObject.addEventListener(eventName, (event) => {
          preventPinchZoom(event);
        }, { passive: false });
      });

      documentObject.addEventListener('pointerdown', (event) => {
        const worldLockReason = getWorldInputLockReason();
        if (worldLockReason) {
          markUiInteraction(`pointerdown-world-lock:${worldLockReason}`);
          cause('C04_WORLD_BLOCKED_TOUCH', `pointerdown-world-lock:${worldLockReason}`);
          return;
        }
        const isUiHit = isUiClickTarget(event.target) || isPointInsideUi(event.clientX, event.clientY) || event.clientY >= getUiDeadzoneTop();
        if (isUiHit) {
          markUiInteraction(`pointerdown-ui:${event.clientY}`);
        } else {
          setUiInteractionStarted(false);
        }
      }, true);

      documentObject.addEventListener('click', (event) => {
        const worldLockReason = getWorldInputLockReason();
        if (worldLockReason) {
          markUiInteraction(`click-world-lock:${worldLockReason}`);
          cause('C02_WORLD_BLOCKED_CLICK', `world-lock:${worldLockReason}`);
          return;
        }

        const now = getPerformanceNow();
        if (now < getSuppressWorldInputUntil()) {
          setUiInteractionStarted(false);
          debugNote('world-click-skip', 'suppressed-window');
          cause('C02_WORLD_BLOCKED_CLICK', 'suppressed-window');
          return;
        }

        const isMobile = windowObject.innerWidth <= 768;
        if (isMobile) {
          cause('C02_WORLD_BLOCKED_CLICK', 'mobile-click-path-disabled');
          return;
        }

        const sinceUiInteraction = now - getLastUiInteractionAt();
        if (isMobile && sinceUiInteraction < uiClickSuppressMs) {
          setUiInteractionStarted(false);
          debugNote('world-click-skip', 'mobile-ui-window');
          cause('C02_WORLD_BLOCKED_CLICK', 'mobile-ui-window');
          return;
        }

        if (getUiInteractionStarted()) {
          setUiInteractionStarted(false);
          debugNote('world-click-skip', 'ui-started');
          cause('C02_WORLD_BLOCKED_CLICK', 'ui-started');
          return;
        }

        const clickedEl = documentObject.elementFromPoint ? documentObject.elementFromPoint(event.clientX, event.clientY) : null;
        if (isUiClickTarget(clickedEl) || event.clientY >= getUiDeadzoneTop()) {
          markUiInteraction('click-ui-target');
          log('Click ignored: UI element');
          cause('C02_WORLD_BLOCKED_CLICK', 'click-ui-target');
          return;
        }

        const renderer = getRenderer();
        const clickHitsRenderer = isRendererElement(clickedEl)
          || isRendererElement(event.target)
          || !!(renderer && clickedEl === renderer.domElement);
        if (!clickHitsRenderer) {
          cause('C02_WORLD_BLOCKED_CLICK', isMobile ? 'mobile-not-renderer' : 'not-renderer');
          return;
        }

        const player = getPlayer();
        if (player && player.isReadingMode) {
          log('Click-to-move disabled in reading mode');
          cause('C02_WORLD_BLOCKED_CLICK', 'reading-mode');
          return;
        }

        if (getIsTouchDragging()) {
          log('Click ignored: was a drag gesture');
          setIsTouchDragging(false);
          cause('C02_WORLD_BLOCKED_CLICK', 'drag-gesture');
          return;
        }

        if (event.clientY >= getUiDeadzoneTop()) {
          log('Ignored Click in UI Deadzone');
          cause('C02_WORLD_BLOCKED_CLICK', 'deadzone');
          return;
        }

        cause('C01_WORLD_PATH_CLICK', `x=${event.clientX} y=${event.clientY}`);
        trySetMoveTargetFromScreenPoint(event.clientX, event.clientY, false);
      });

      documentObject.addEventListener('touchend', (event) => {
        const player = getPlayer();
        if (player && player.isReadingMode) {
          debugNote('touchend-skip', 'reading-mode');
          cause('C04_WORLD_BLOCKED_TOUCH', 'reading-mode');
          setTouchStartedOnRenderer(false);
          return;
        }
        if (windowObject.innerWidth > 768) return;

        const worldLockReason = getWorldInputLockReason();
        if (worldLockReason) {
          markUiInteraction(`touchend-world-lock:${worldLockReason}`);
          resetTouchFlags();
          cause('C04_WORLD_BLOCKED_TOUCH', `world-lock:${worldLockReason}`);
          return;
        }

        if (isUiClickTarget(event.target)) {
          markUiInteraction('touchend-event-target-ui');
          resetTouchFlags();
          cause('C04_WORLD_BLOCKED_TOUCH', 'event-target-ui');
          return;
        }

        const now = getPerformanceNow();
        if (now < getSuppressWorldInputUntil()) {
          debugNote('touchend-skip', 'suppressed-window');
          cause('C04_WORLD_BLOCKED_TOUCH', 'suppressed-window');
          setTouchStartedOnRenderer(false);
          return;
        }

        if (!getIsTouchValid() || getTouchStartedOnUi() || getIsTouchDragging() || getTouchMovedForTap()) {
          const sinceUi = now - getLastUiInteractionAt();
          debugNote('touchend-skip', `flags valid=${getIsTouchValid()} ui=${getTouchStartedOnUi()} drag=${getIsTouchDragging()} moved=${getTouchMovedForTap()}`);
          cause('C04_WORLD_BLOCKED_TOUCH', `flags valid=${getIsTouchValid()} ui=${getTouchStartedOnUi()} drag=${getIsTouchDragging()} moved=${getTouchMovedForTap()}`);
          if (!getTouchStartedOnUi() && !getIsTouchDragging() && !getTouchMovedForTap() && !getIsTouchValid() && sinceUi > 1200) {
            cause('C08_TOUCHFLAGS_STUCK', `isTouchValid=false sinceUi=${sinceUi.toFixed(0)}ms`);
          }
          resetTouchFlags();
          return;
        }

        if (!event.changedTouches || event.changedTouches.length === 0) return;
        const touch = event.changedTouches[0];
        if (isPointInsideUi(touch.clientX, touch.clientY)) {
          markUiInteraction('touchend-point-ui');
          resetTouchFlags();
          cause('C04_WORLD_BLOCKED_TOUCH', 'point-inside-ui');
          return;
        }
        if (touch.clientY >= getUiDeadzoneTop()) {
          debugNote('touchend-skip', 'deadzone');
          resetTouchFlags();
          cause('C04_WORLD_BLOCKED_TOUCH', 'deadzone');
          return;
        }

        const touchedEl = documentObject.elementFromPoint ? documentObject.elementFromPoint(touch.clientX, touch.clientY) : null;
        if (isUiClickTarget(touchedEl)) {
          markUiInteraction('touchend-ui-target');
          setTouchStartedOnRenderer(false);
          cause('C04_WORLD_BLOCKED_TOUCH', 'touchedEl-ui-target');
          return;
        }
        if (!getTouchStartedOnRenderer()) {
          debugNote('touchend-skip', 'start-not-renderer');
          resetTouchFlags();
          cause('C04_WORLD_BLOCKED_TOUCH', 'start-not-renderer');
          return;
        }
        if (!isRendererElement(touchedEl)) {
          debugNote('touchend-skip', 'not-renderer');
          resetTouchFlags();
          cause('C04_WORLD_BLOCKED_TOUCH', 'not-renderer');
          return;
        }

        cause('C03_WORLD_PATH_TOUCH', `x=${touch.clientX} y=${touch.clientY}`);
        trySetMoveTargetFromScreenPoint(touch.clientX, touch.clientY, true);
        resetTouchFlags();
      }, { passive: true });

      documentObject.addEventListener('keydown', (event) => {
        const move = getMoveState();
        const code = event.code;
        if (code === 'KeyW' || code === 'ArrowUp') move.f = true;
        if (code === 'KeyS' || code === 'ArrowDown') move.b = true;
        if (code === 'KeyA' || code === 'ArrowLeft') {
          move.l = true;
          log('Move Left START');
        }
        if (code === 'KeyD' || code === 'ArrowRight') {
          move.r = true;
          log('Move Right START');
        }
      });

      documentObject.addEventListener('keyup', (event) => {
        const move = getMoveState();
        const code = event.code;
        if (code === 'KeyW' || code === 'ArrowUp') move.f = false;
        if (code === 'KeyS' || code === 'ArrowDown') move.b = false;
        if (code === 'KeyA' || code === 'ArrowLeft') move.l = false;
        if (code === 'KeyD' || code === 'ArrowRight') move.r = false;
      });
    }

    return {
      bindUiInputShield,
      trySetMoveTargetFromScreenPoint
    };
  }

  globalObject.GameboyLiminalWorldInputRuntime = Object.freeze({
    init: initLiminalWorldInputRuntime
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
