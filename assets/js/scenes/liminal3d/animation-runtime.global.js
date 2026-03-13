(function initLiminalAnimationRuntime(globalObject) {
  function initLiminalAnimationRuntime(options = {}) {
    const root = options.root || globalObject;
    const windowObject = options.window || root.window || root;
    const documentObject = options.document || root.document || null;
    const requestFrame = typeof options.requestAnimationFrame === 'function'
      ? options.requestAnimationFrame
      : (callback) => windowObject.requestAnimationFrame(callback);
    const getPerformanceNow = typeof options.performanceNow === 'function'
      ? options.performanceNow
      : () => ((windowObject.performance && typeof windowObject.performance.now === 'function')
        ? windowObject.performance.now()
        : Date.now());
    const getClock = typeof options.getClock === 'function' ? options.getClock : () => null;
    const getCamera = typeof options.getCamera === 'function' ? options.getCamera : () => null;
    const getControls = typeof options.getControls === 'function' ? options.getControls : () => null;
    const getEuler = typeof options.getEuler === 'function' ? options.getEuler : () => null;
    const getRenderer = typeof options.getRenderer === 'function' ? options.getRenderer : () => null;
    const getScene = typeof options.getScene === 'function' ? options.getScene : () => null;
    const getVelocity = typeof options.getVelocity === 'function' ? options.getVelocity : () => null;
    const getMoveState = typeof options.getMoveState === 'function' ? options.getMoveState : () => ({ f: false, b: false, l: false, r: false });
    const getMouse = typeof options.getMouse === 'function' ? options.getMouse : () => ({ x: 0, y: 0 });
    const setTargetMouseX = typeof options.setTargetMouseX === 'function' ? options.setTargetMouseX : () => {};
    const setTargetMouseY = typeof options.setTargetMouseY === 'function' ? options.setTargetMouseY : () => {};
    const getIsReadingMode = typeof options.getIsReadingMode === 'function' ? options.getIsReadingMode : () => false;
    const getIsFallback2DMode = typeof options.getIsFallback2DMode === 'function' ? options.getIsFallback2DMode : () => !!windowObject.fallback2DMode;
    const getWorldInputLockReason = typeof options.getWorldInputLockReason === 'function' ? options.getWorldInputLockReason : () => '';
    const getSuppressWorldInputUntil = typeof options.getSuppressWorldInputUntil === 'function' ? options.getSuppressWorldInputUntil : () => 0;
    const getLastUiInteractionAt = typeof options.getLastUiInteractionAt === 'function' ? options.getLastUiInteractionAt : () => 0;
    const uiClickSuppressMs = Number.isFinite(options.uiClickSuppressMs) ? options.uiClickSuppressMs : 700;
    const getMoveTarget = typeof options.getMoveTarget === 'function' ? options.getMoveTarget : () => null;
    const setMoveTarget = typeof options.setMoveTarget === 'function' ? options.setMoveTarget : () => {};
    const getCameraLookTarget = typeof options.getCameraLookTarget === 'function' ? options.getCameraLookTarget : () => null;
    const setCameraLookTarget = typeof options.setCameraLookTarget === 'function' ? options.setCameraLookTarget : () => {};
    const setIsLookingAtClickTarget = typeof options.setIsLookingAtClickTarget === 'function' ? options.setIsLookingAtClickTarget : () => {};
    const getIsCenteringCamera = typeof options.getIsCenteringCamera === 'function' ? options.getIsCenteringCamera : () => false;
    const setIsCenteringCamera = typeof options.setIsCenteringCamera === 'function' ? options.setIsCenteringCamera : () => {};
    const syncLookTargetsToCamera = typeof options.syncLookTargetsToCamera === 'function' ? options.syncLookTargetsToCamera : () => {};
    const flushDeferredReadingModeRender = typeof options.flushDeferredReadingModeRender === 'function' ? options.flushDeferredReadingModeRender : () => {};
    const getTmpLookDir = typeof options.getTmpLookDir === 'function' ? options.getTmpLookDir : () => null;
    const getTmpMovementInput = typeof options.getTmpMovementInput === 'function' ? options.getTmpMovementInput : () => null;
    const getTmpForwardDir = typeof options.getTmpForwardDir === 'function' ? options.getTmpForwardDir : () => null;
    const getTmpRightDir = typeof options.getTmpRightDir === 'function' ? options.getTmpRightDir : () => null;
    const getTmpMoveDir = typeof options.getTmpMoveDir === 'function' ? options.getTmpMoveDir : () => null;
    const getTmpVelocityStep = typeof options.getTmpVelocityStep === 'function' ? options.getTmpVelocityStep : () => null;
    const updateSegments = typeof options.updateSegments === 'function' ? options.updateSegments : () => {};
    const getSegments = typeof options.getSegments === 'function' ? options.getSegments : () => [];
    const getActiveGlowingBooks = typeof options.getActiveGlowingBooks === 'function' ? options.getActiveGlowingBooks : () => [];
    const getCurrentChapterProgress = typeof options.getCurrentChapterProgress === 'function' ? options.getCurrentChapterProgress : () => ({ collected: 0, total: 0 });
    const refreshLoreProgressUi = typeof options.refreshLoreProgressUi === 'function' ? options.refreshLoreProgressUi : () => {};
    const renderArchive = typeof options.renderArchive === 'function' ? options.renderArchive : null;
    const startLoreMode = typeof options.startLoreMode === 'function' ? options.startLoreMode : () => {};
    const allowAuxSfxPlaybackLiminal = typeof options.allowAuxSfxPlaybackLiminal === 'function' ? options.allowAuxSfxPlaybackLiminal : () => false;
    const getShimmerSound = typeof options.getShimmerSound === 'function' ? options.getShimmerSound : () => null;
    const getLastShimmerAt = typeof options.getLastShimmerAt === 'function' ? options.getLastShimmerAt : () => 0;
    const setLastShimmerAt = typeof options.setLastShimmerAt === 'function' ? options.setLastShimmerAt : () => {};
    const getGameState = typeof options.getGameState === 'function' ? options.getGameState : () => (root.GameState || windowObject.GameState || null);
    const sceneName = typeof options.sceneName === 'string' && options.sceneName ? options.sceneName : 'liminal_library';
    const getDebugLogs = typeof options.getDebugLogs === 'function' ? options.getDebugLogs : () => !!options.debugLogs;
    const debugNote = typeof options.debugNote === 'function' ? options.debugNote : () => {};
    const cause = typeof options.cause === 'function' ? options.cause : () => {};
    const log = typeof options.log === 'function' ? options.log : () => {};
    const error = typeof options.error === 'function' ? options.error : () => {};

    let animationLoopRunning = false;
    let headBob = 0;
    let lastFrameTime = getPerformanceNow();
    let frameCount = 0;
    let fpsLogTimer = 0;
    let lastReadingRenderAt = 0;

    function resetLookTargets() {
      setCameraLookTarget(null);
      setIsLookingAtClickTarget(false);
      syncLookTargetsToCamera();
    }

    function syncMouseTargets(mouse, euler) {
      mouse.x = -euler.y / 1.5;
      mouse.y = -euler.x / 0.5;
      setTargetMouseX(mouse.x);
      setTargetMouseY(mouse.y);
    }

    function updateLook(delta, lookSuppressed) {
      const camera = getCamera();
      const euler = getEuler();
      const mouse = getMouse();
      if (!camera || !euler || !camera.quaternion || !mouse) return;

      if (lookSuppressed) {
        resetLookTargets();
        return;
      }

      if (getIsCenteringCamera()) {
        camera.position.x += (0 - camera.position.x) * 2.0 * delta;
        euler.setFromQuaternion(camera.quaternion);
        let diff = 0 - euler.y;
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;

        euler.y += diff * 2.0 * delta;
        euler.x += (0 - euler.x) * 2.0 * delta;
        euler.z = 0;
        camera.quaternion.setFromEuler(euler);

        mouse.x = 0;
        mouse.y = 0;
        setTargetMouseX(0);
        setTargetMouseY(0);

        if (Math.abs(camera.position.x) < 0.02 && Math.abs(diff) < 0.02 && Math.abs(euler.x) < 0.02) {
          setIsCenteringCamera(false);
          syncLookTargetsToCamera();
          flushDeferredReadingModeRender('center-complete');
        }
        return;
      }

      const cameraLookTarget = getCameraLookTarget();
      if (cameraLookTarget) {
        const lookDir = getTmpLookDir();
        if (!lookDir) return;
        lookDir.subVectors(cameraLookTarget, camera.position).normalize();
        const targetYaw = Math.atan2(lookDir.x, -lookDir.z);
        const targetPitch = Math.asin(-lookDir.y);

        euler.setFromQuaternion(camera.quaternion);
        let yawDiff = targetYaw - euler.y;
        if (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        if (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        const pitchDiff = targetPitch - euler.x;
        const lookEase = Math.min(1, 0.1 * delta);
        euler.y += yawDiff * lookEase;
        euler.x += pitchDiff * lookEase;
        euler.z = 0;
        camera.quaternion.setFromEuler(euler);
        setIsLookingAtClickTarget(true);
        syncMouseTargets(mouse, euler);

        if (Math.abs(yawDiff) < 0.02 && Math.abs(pitchDiff) < 0.02) {
          setCameraLookTarget(null);
          setIsLookingAtClickTarget(false);
        }
        return;
      }

      setIsLookingAtClickTarget(false);

      const targetPitch = -mouse.y * 0.5;
      const targetYaw = -mouse.x * 1.5;
      const ease = 5.0 * delta;
      euler.setFromQuaternion(camera.quaternion);
      euler.x += (targetPitch - euler.x) * ease;
      euler.y += (targetYaw - euler.y) * ease;
      euler.z = 0;
      camera.quaternion.setFromEuler(euler);
    }

    function updateMovement(delta) {
      const camera = getCamera();
      const velocity = getVelocity();
      const move = getMoveState();
      const input = getTmpMovementInput();
      if (!camera || !velocity || !move || !input) return;

      const baseAccel = 150.0;
      const gameSpeed = baseAccel * 0.225;
      const readingSpeed = baseAccel * 0.15;
      const isReading = !!getIsReadingMode();

      input.set(0, 0, 0);
      velocity.x -= velocity.x * 10.0 * delta;
      velocity.z -= velocity.z * 10.0 * delta;
      velocity.y -= 9.8 * 100.0 * delta;

      if (isReading) {
        input.set(0, 0, -1);
        const centerForce = (0 - camera.position.x) * 0.5 * delta;
        camera.position.x += centerForce;
        velocity.add(input.multiplyScalar(readingSpeed * delta));
      } else {
        const forward = getTmpForwardDir();
        const right = getTmpRightDir();
        if (!forward || !right) return;
        forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();
        right.set(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();
        if (move.f) input.add(forward);
        if (move.r) input.add(right);
        if (move.l) input.sub(right);

        if (input.length() > 0) {
          input.normalize();
          velocity.add(input.multiplyScalar(gameSpeed * delta));
          setMoveTarget(null);
          setCameraLookTarget(null);
        } else {
          const moveTarget = getMoveTarget();
          if (moveTarget) {
            const sinceUi = getPerformanceNow() - getLastUiInteractionAt();
            const worldLockReason = getWorldInputLockReason();
            if (worldLockReason) {
              debugNote('move-skip', `loop-world-lock:${worldLockReason}`);
              cause('C04_WORLD_BLOCKED_TOUCH', `loop-world-lock:${worldLockReason}`);
              setMoveTarget(null);
              setCameraLookTarget(null);
              velocity.x = 0;
              velocity.z = 0;
            } else {
              if (sinceUi < uiClickSuppressMs + 50) {
                cause('C06_MOVE_SET_RECENT_UI_WINDOW', `loop-consume sinceUi=${sinceUi.toFixed(0)}ms`);
              }
              const dx = moveTarget.x - camera.position.x;
              const dz = moveTarget.z - camera.position.z;
              const dist = Math.sqrt(dx * dx + dz * dz);

              if (dist < 2.0) {
                setCameraLookTarget(null);
              }

              if (dist < 0.2) {
                setMoveTarget(null);
                setCameraLookTarget(null);
                if (typeof velocity.set === 'function') velocity.set(0, 0, 0);
              } else {
                const moveDir = getTmpMoveDir();
                if (!moveDir) return;
                moveDir.set(dx, 0, dz).normalize();
                velocity.add(moveDir.multiplyScalar(gameSpeed * delta));
              }
            }
          }
        }

        camera.position.x += velocity.x * delta;
        camera.position.z += velocity.z * delta;
        if (velocity.z > 0) velocity.z = 0;
        camera.position.y += velocity.y * delta;

        if (camera.position.y < 1.6) {
          velocity.y = 0;
          camera.position.y = 1.6;
        }

        camera.position.x = Math.max(-2.5, Math.min(2.5, camera.position.x));
      }

      velocity.multiplyScalar(1.0 - 5.0 * delta);
      if (velocity.length() > 0.5) {
        headBob += delta * 6;
        camera.position.y = 1.6 + Math.sin(headBob) * 0.0125;
      } else {
        camera.position.y += (1.6 - camera.position.y) * 5.0 * delta;
      }

      if (camera.position.x < -1.95) camera.position.x = -1.95;
      if (camera.position.x > 1.95) camera.position.x = 1.95;
    }

    function updateSegmentsAndBooks(delta, time) {
      const camera = getCamera();
      if (!camera) return;
      updateSegments(camera.position.z);
      for (const segment of getSegments()) {
        if (segment && typeof segment.update === 'function') {
          segment.update(delta, time, camera.position);
        }
      }

      const books = getActiveGlowingBooks();
      const gameState = getGameState();
      const shimmerSound = getShimmerSound();
      for (const book of books) {
        if (!book || book.collected || book.missed) continue;
        if (typeof book.update === 'function') {
          book.update(time, camera.position.z, camera.position.x);
        }
        const worldPos = book.worldPos;
        if (!worldPos) continue;
        const distZ = Math.abs(worldPos.z - camera.position.z);
        const distX = Math.abs(worldPos.x - camera.position.x);
        const alreadyCollected = !!(
          gameState
          && typeof gameState.isLightCollected === 'function'
          && gameState.isLightCollected(sceneName, book.id)
        );

        if (distZ < 1.5 && distX < 1.0 && !alreadyCollected) {
          if (typeof book.collect === 'function') {
            book.collect();
          }
          if (gameState && typeof gameState.collectLight === 'function') {
            Promise.resolve(gameState.collectLight(sceneName, book.id)).then((newLoreId) => {
              refreshLoreProgressUi();
              if (!newLoreId) return;
              const now = Date.now();
              if (now - getLastShimmerAt() > 400) {
                setLastShimmerAt(now);
                if (shimmerSound) {
                  if (typeof shimmerSound.pause === 'function') shimmerSound.pause();
                  shimmerSound.currentTime = 0;
                  if (allowAuxSfxPlaybackLiminal()) {
                    const playResult = shimmerSound.play();
                    if (playResult && typeof playResult.catch === 'function') playResult.catch(() => {});
                  }
                }
              }
              if (typeof renderArchive === 'function') renderArchive();
              startLoreMode(newLoreId);
            });
          }
        } else if (worldPos.z > camera.position.z + 5) {
          book.missed = true;
          if (book.mesh) {
            book.mesh.visible = false;
          }
          if (getDebugLogs()) {
            log(`Book ${book.id} missed (player walked past)`);
          }
        }
      }
    }

    function updateDebugHud() {
      if (!documentObject || typeof documentObject.getElementById !== 'function') return;
      const camera = getCamera();
      if (!camera) return;
      const debugEl = documentObject.getElementById('debugHUD');
      if (!debugEl) return;
      const chapterProgress = getCurrentChapterProgress();
      const segments = getSegments();
      debugEl.innerText = `Pos Z: ${camera.position.z.toFixed(2)} | Segments: ${segments.length} | Lore: ${chapterProgress.collected}/${chapterProgress.total}`;
    }

    function animate() {
      if (windowObject.visualFreezeActive) {
        animationLoopRunning = false;
        return false;
      }

      const now = getPerformanceNow();
      const frameDelta = now - lastFrameTime;
      lastFrameTime = now;
      frameCount += 1;
      fpsLogTimer += frameDelta;
      if (fpsLogTimer > 3000) {
        if (getDebugLogs()) {
          log(`[Performance] Avg FPS: ${(frameCount / 3).toFixed(1)}, Last Frame: ${frameDelta.toFixed(1)}ms`);
        }
        frameCount = 0;
        fpsLogTimer = 0;
      }

      if (windowObject.gamePaused) {
        requestFrame(animate);
        return true;
      }

      requestFrame(animate);

      try {
        const clock = getClock();
        const delta = clock ? Math.min(clock.getDelta(), 0.05) : 0.05;
        const time = clock ? clock.getElapsedTime() : (getPerformanceNow() / 1000);
        const now = getPerformanceNow();
        const worldLockReason = getWorldInputLockReason();
        const isReadingMode = !!getIsReadingMode();
        const lookSuppressed = (!isReadingMode) && (!!worldLockReason || now < getSuppressWorldInputUntil());
        const readingRenderIntervalMs = Number.isFinite(options.readingRenderIntervalMs) ? options.readingRenderIntervalMs : 66;

        if (!getIsFallback2DMode()) {
          updateLook(delta, lookSuppressed);
          updateMovement(delta);

          const shouldThrottleReadingRender = isReadingMode && !getIsCenteringCamera();
          const shouldRenderFrame = !shouldThrottleReadingRender || (now - lastReadingRenderAt) >= readingRenderIntervalMs;
          if (shouldRenderFrame) {
            updateSegmentsAndBooks(delta, time);
            if (windowObject.audioPlayer && windowObject.audioPlayer.onTimeUpdate) {
              // Shared player updates on its own timeupdate event.
            }
            const renderer = getRenderer();
            const scene = getScene();
            const camera = getCamera();
            if (renderer && scene && camera && typeof renderer.render === 'function') {
              renderer.render(scene, camera);
            }
            updateDebugHud();
            if (shouldThrottleReadingRender) {
              lastReadingRenderAt = now;
            }
          }
        }
      } catch (runtimeError) {
        error('Animation Loop Crash:', runtimeError);
      }

      return true;
    }

    function startAnimationLoop() {
      if (animationLoopRunning || windowObject.visualFreezeActive) return false;
      animationLoopRunning = true;
      lastFrameTime = getPerformanceNow();
      lastReadingRenderAt = 0;
      requestFrame(animate);
      return true;
    }

    return {
      startAnimationLoop,
      animate,
      isAnimationLoopRunning() {
        return animationLoopRunning;
      }
    };
  }

  globalObject.GameboyLiminalAnimationRuntime = Object.freeze({
    init: initLiminalAnimationRuntime
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
