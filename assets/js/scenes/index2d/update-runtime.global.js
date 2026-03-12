(function initIndexUpdateRuntime(globalObject) {
  function initIndexUpdateRuntime(options = {}) {
    const player = options.player || {};
    const keys = options.keys || {};
    const particles = options.particles || [];
    const clouds = options.clouds || [];
    const dustParticles = options.dustParticles || [];
    const gameCanvasGesture = options.gameCanvasGesture || { mode: 'idle' };
    const footstepSound = options.footstepSound || { play() { return Promise.resolve(); }, pause() {} };
    const getGameReady = typeof options.getGameReady === 'function' ? options.getGameReady : () => false;
    const getMapW = typeof options.getMapW === 'function' ? options.getMapW : () => 0;
    const getMapH = typeof options.getMapH === 'function' ? options.getMapH : () => 0;
    const getIsReadingMode = typeof options.getIsReadingMode === 'function' ? options.getIsReadingMode : () => false;
    const getSpriteReady = typeof options.getSpriteReady === 'function' ? options.getSpriteReady : () => false;
    const getSprite = typeof options.getSprite === 'function' ? options.getSprite : () => ({ frameWidth: 16, frameHeight: 20, scale: 1, baseScale: 1 });
    const getMoveTarget = typeof options.getMoveTarget === 'function' ? options.getMoveTarget : () => null;
    const setMoveTarget = typeof options.setMoveTarget === 'function' ? options.setMoveTarget : () => {};
    const getClickWalkPath = typeof options.getClickWalkPath === 'function' ? options.getClickWalkPath : () => [];
    const setClickWalkPath = typeof options.setClickWalkPath === 'function' ? options.setClickWalkPath : () => {};
    const getClickWalkGoal = typeof options.getClickWalkGoal === 'function' ? options.getClickWalkGoal : () => null;
    const setClickWalkGoal = typeof options.setClickWalkGoal === 'function' ? options.setClickWalkGoal : () => {};
    const getAutoWalkPath = typeof options.getAutoWalkPath === 'function' ? options.getAutoWalkPath : () => [];
    const getAutoWalkIndex = typeof options.getAutoWalkIndex === 'function' ? options.getAutoWalkIndex : () => 0;
    const setAutoWalkIndex = typeof options.setAutoWalkIndex === 'function' ? options.setAutoWalkIndex : () => {};
    const getPlayerFootPosition = typeof options.getPlayerFootPosition === 'function' ? options.getPlayerFootPosition : () => ({ x: player.x || 0, y: player.y || 0 });
    const setPlayerFromFootPosition = typeof options.setPlayerFromFootPosition === 'function' ? options.setPlayerFromFootPosition : () => {};
    const isFootSolid = typeof options.isFootSolid === 'function' ? options.isFootSolid : () => false;
    const findNearestFreeFootPoint = typeof options.findNearestFreeFootPoint === 'function' ? options.findNearestFreeFootPoint : () => null;
    const findPathAStar = typeof options.findPathAStar === 'function' ? options.findPathAStar : () => [];
    const chooseAutoWalkDirection = typeof options.chooseAutoWalkDirection === 'function' ? options.chooseAutoWalkDirection : () => player.dir;
    const checkCollisionAt = typeof options.checkCollisionAt === 'function' ? options.checkCollisionAt : () => false;
    const allowAuxScPlayback = typeof options.allowAuxScPlayback === 'function' ? options.allowAuxScPlayback : () => false;
    const replanClickPathFromPlayer = typeof options.replanClickPathFromPlayer === 'function' ? options.replanClickPathFromPlayer : () => false;
    const checkForeground = typeof options.checkForeground === 'function' ? options.checkForeground : () => false;
    const getCameraZoomClamped = typeof options.getCameraZoomClamped === 'function' ? options.getCameraZoomClamped : (value) => value;
    const clampCameraX = typeof options.clampCameraX === 'function' ? options.clampCameraX : (value) => value;
    const clampCameraY = typeof options.clampCameraY === 'function' ? options.clampCameraY : (value) => value;
    const getCameraFollowTargetX = typeof options.getCameraFollowTargetX === 'function' ? options.getCameraFollowTargetX : () => 0;
    const getCameraFollowTargetY = typeof options.getCameraFollowTargetY === 'function' ? options.getCameraFollowTargetY : () => 0;
    const isGameCanvasGestureActive = typeof options.isGameCanvasGestureActive === 'function' ? options.isGameCanvasGestureActive : () => false;
    const getAudioUnlocked = typeof options.getAudioUnlocked === 'function' ? options.getAudioUnlocked : () => false;
    const getFootstepPlaying = typeof options.getFootstepPlaying === 'function' ? options.getFootstepPlaying : () => false;
    const setFootstepPlaying = typeof options.setFootstepPlaying === 'function' ? options.setFootstepPlaying : () => {};
    const setNearbyLights = typeof options.setNearbyLights === 'function' ? options.setNearbyLights : () => {};
    const getScreenShake = typeof options.getScreenShake === 'function' ? options.getScreenShake : () => 0;
    const setScreenShake = typeof options.setScreenShake === 'function' ? options.setScreenShake : () => {};
    const getCameraZoom = typeof options.getCameraZoom === 'function' ? options.getCameraZoom : () => 1;
    const setCameraZoom = typeof options.setCameraZoom === 'function' ? options.setCameraZoom : () => {};
    const getCameraZoomTarget = typeof options.getCameraZoomTarget === 'function' ? options.getCameraZoomTarget : () => 1;
    const setCameraZoomTarget = typeof options.setCameraZoomTarget === 'function' ? options.setCameraZoomTarget : () => {};
    const getCameraPanOffsetX = typeof options.getCameraPanOffsetX === 'function' ? options.getCameraPanOffsetX : () => 0;
    const setCameraPanOffsetX = typeof options.setCameraPanOffsetX === 'function' ? options.setCameraPanOffsetX : () => {};
    const getCameraPanOffsetY = typeof options.getCameraPanOffsetY === 'function' ? options.getCameraPanOffsetY : () => 0;
    const setCameraPanOffsetY = typeof options.setCameraPanOffsetY === 'function' ? options.setCameraPanOffsetY : () => {};
    const getCamX = typeof options.getCamX === 'function' ? options.getCamX : () => 0;
    const setCamX = typeof options.setCamX === 'function' ? options.setCamX : () => {};
    const getCamY = typeof options.getCamY === 'function' ? options.getCamY : () => 0;
    const setCamY = typeof options.setCamY === 'function' ? options.setCamY : () => {};
    const setTargetCamX = typeof options.setTargetCamX === 'function' ? options.setTargetCamX : () => {};
    const setTargetCamY = typeof options.setTargetCamY === 'function' ? options.setTargetCamY : () => {};
    const gameCameraPanReturnSpeed = Number.isFinite(options.gameCameraPanReturnSpeed) ? options.gameCameraPanReturnSpeed : 8.4;
    const gameCameraActiveLerp = Number.isFinite(options.gameCameraActiveLerp) ? options.gameCameraActiveLerp : 18.0;
    const gameCameraZoomActiveLerp = Number.isFinite(options.gameCameraZoomActiveLerp) ? options.gameCameraZoomActiveLerp : 22.0;
    const navGridSize = Number.isFinite(options.navGridSize) ? options.navGridSize : 8;
    const navMaxStartSearchCells = Number.isFinite(options.navMaxStartSearchCells) ? options.navMaxStartSearchCells : 28;
    const navCollisionPaddingX = Number.isFinite(options.navCollisionPaddingX) ? options.navCollisionPaddingX : 1;
    const navCollisionPaddingY = Number.isFinite(options.navCollisionPaddingY) ? options.navCollisionPaddingY : 1;
    const random = typeof options.random === 'function' ? options.random : Math.random;
    const log = typeof options.log === 'function' ? options.log : () => {};

    function update(dt = 0.016) {
      if (!getGameReady()) return;
      if (player.embedTime === undefined) player.embedTime = 0;
      if (player.repathCooldown === undefined) player.repathCooldown = 0;
      if (player.stuckTime === undefined) player.stuckTime = 0;
      if (player.slowdownTimer === undefined) player.slowdownTimer = 0;
      if (player.animTimer === undefined) player.animTimer = 0;
      if (player.frame === undefined) player.frame = 0;
      if (player.dir === undefined) player.dir = 0;

      if (options.getAutoWalkFacingLockTimer && options.setAutoWalkFacingLockTimer) {
        const lockTimer = options.getAutoWalkFacingLockTimer();
        if (lockTimer > 0) {
          options.setAutoWalkFacingLockTimer(Math.max(0, lockTimer - dt));
        }
      }

      const sprite = getSprite();
      const mapH = getMapH();
      const mapW = getMapW();
      const spriteReady = getSpriteReady();
      if (mapH > 0) {
        const yNorm = Math.max(0, Math.min(1, player.y / mapH));
        const depthFactor = 0.5 + (0.8 * yNorm);
        sprite.scale = sprite.baseScale * depthFactor;
      }

      const currentFoot = getPlayerFootPosition(player.x, player.y);
      if (isFootSolid(currentFoot.x, currentFoot.y, navCollisionPaddingX, navCollisionPaddingY)) {
        player.embedTime += dt;
        if (player.embedTime > 0.12) {
          const escapeFoot = findNearestFreeFootPoint(currentFoot.x, currentFoot.y, navGridSize * navMaxStartSearchCells);
          if (escapeFoot) {
            setPlayerFromFootPosition(escapeFoot.x, escapeFoot.y);
            const clickWalkGoal = getClickWalkGoal();
            if (clickWalkGoal) {
              const replanned = findPathAStar(escapeFoot.x, escapeFoot.y, clickWalkGoal.x, clickWalkGoal.y);
              setClickWalkPath(replanned);
              if (replanned.length === 0) setClickWalkGoal(null);
            } else {
              setClickWalkPath([]);
            }
          } else {
            setClickWalkPath([]);
            setClickWalkGoal(null);
          }
          player.embedTime = 0;
        }
      } else {
        player.embedTime = 0;
      }

      let dx = 0;
      let dy = 0;
      player.isMoving = false;

      if (keys.w || keys.arrowup || keys.ArrowUp) {
        dy = -1;
        player.dir = 1;
      }
      if (keys.s || keys.arrowdown || keys.ArrowDown) {
        dy = 1;
        player.dir = 0;
      }
      if (keys.a || keys.arrowleft || keys.ArrowLeft) {
        dx = -1;
        player.dir = 2;
      }
      if (keys.d || keys.arrowright || keys.ArrowRight) {
        dx = 1;
        player.dir = 3;
      }

      if (dx !== 0 || dy !== 0) {
        setClickWalkPath([]);
        setClickWalkGoal(null);
        setMoveTarget(null);
      }

      let clickWalkPath = getClickWalkPath();
      if (dx === 0 && dy === 0 && clickWalkPath.length > 0 && !getIsReadingMode()) {
        while (
          clickWalkPath.length > 0 &&
          isFootSolid(clickWalkPath[0].x, clickWalkPath[0].y, navCollisionPaddingX, navCollisionPaddingY)
        ) {
          clickWalkPath.shift();
        }

        if (clickWalkPath.length === 0) {
          setClickWalkGoal(null);
        }

        if (clickWalkPath.length > 0) {
          const target = clickWalkPath[0];
          const foot = getPlayerFootPosition(player.x, player.y);
          const tdx = target.x - foot.x;
          const tdy = target.y - foot.y;
          const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
          const reachRadius = clickWalkPath.length === 1 ? 2 : 8;

          if (tdist < reachRadius) {
            clickWalkPath.shift();
            if (clickWalkPath.length === 0) setClickWalkGoal(null);
          } else {
            dx = tdx / tdist;
            dy = tdy / tdist;
            if (Math.abs(tdx) > Math.abs(tdy)) {
              player.dir = tdx > 0 ? 3 : 2;
            } else {
              player.dir = tdy > 0 ? 0 : 1;
            }
          }
        }
      }

      const autoWalkPath = getAutoWalkPath();
      let autoWalkIndex = getAutoWalkIndex();
      if ((getIsReadingMode() || player.slowdownTimer > 0) && autoWalkPath.length > 0) {
        if (getIsReadingMode()) {
          player.slowdownTimer = 1.0;
        } else {
          player.slowdownTimer -= dt;
        }

        const spriteW = spriteReady ? sprite.frameWidth * sprite.scale : 16;
        const spriteH = spriteReady ? sprite.frameHeight * sprite.scale : 20;
        const footX = player.x + spriteW / 2;
        const footY = player.y + spriteH + (options.footOffsetY || 0);
        const target = autoWalkPath[autoWalkIndex];
        const tdx = target.x - footX;
        const tdy = target.y - footY;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);
        let walkSpeed = player.speed;
        if (!getIsReadingMode()) {
          walkSpeed *= Math.max(0, player.slowdownTimer);
        }
        const step = walkSpeed * dt;

        if (dist < 4) {
          autoWalkIndex += 1;
          if (autoWalkIndex >= autoWalkPath.length) {
            autoWalkIndex = autoWalkPath.length - 1;
            if (!getIsReadingMode()) player.slowdownTimer = 0;
          }
          setAutoWalkIndex(autoWalkIndex);
        }

        if (autoWalkIndex < autoWalkPath.length && player.slowdownTimer > 0) {
          const nextTarget = autoWalkPath[autoWalkIndex];
          const nextTdx = nextTarget.x - footX;
          const nextTdy = nextTarget.y - footY;
          const nextDist = Math.sqrt(nextTdx * nextTdx + nextTdy * nextTdy);
          if (nextDist > 1) {
            const stepDx = (nextTdx / nextDist) * step;
            const stepDy = (nextTdy / nextDist) * step;
            player.x += stepDx;
            player.y += stepDy;
            player.isMoving = true;

            const lookAheadIndex = Math.min(autoWalkPath.length - 1, autoWalkIndex + 8);
            const lookAheadTarget = autoWalkPath[lookAheadIndex];
            const lookAheadDx = lookAheadTarget.x - footX;
            const lookAheadDy = lookAheadTarget.y - footY;
            const blendedDx = nextTdx * 0.35 + lookAheadDx * 0.65;
            const blendedDy = nextTdy * 0.35 + lookAheadDy * 0.65;
            const nextDir = chooseAutoWalkDirection(blendedDx, blendedDy, player.dir);
            const lockTimer = options.getAutoWalkFacingLockTimer ? options.getAutoWalkFacingLockTimer() : 0;
            if (nextDir !== player.dir && lockTimer <= 0) {
              player.dir = nextDir;
              if (options.setAutoWalkFacingLockTimer) {
                options.setAutoWalkFacingLockTimer(0.14);
              }
            }

            player.animTimer += dt;
            const animThreshold = (player.dir === 0 || player.dir === 1) ? 0.30 : 0.15;
            if (player.animTimer > animThreshold) {
              player.animTimer = 0;
              player.frame = (player.frame + 1) % 12;
            }
          }
        }
      }

      if (dx !== 0 || dy !== 0) {
        player.isMoving = true;
        if ((keys.w || keys.s || keys.a || keys.d || keys.arrowup || keys.arrowdown || keys.arrowleft || keys.arrowright) && Math.abs(dx) === 1 && Math.abs(dy) === 1) {
          dx *= 0.7071;
          dy *= 0.7071;
        }

        let moveSpeed = player.speed;
        if (getIsReadingMode()) {
          moveSpeed = player.speed * 0.175;
        }

        if (player.isMoving && random() < 0.01) {
          log(`[DEBUG_SYS] Player Move Speed: Base=${player.speed}, Actual=${moveSpeed} (Mode=${getIsReadingMode() ? 'READING' : 'GAME'})`);
        }

        const amount = moveSpeed * dt;
        const vx = dx * amount;
        const vy = dy * amount;
        const targetX = player.x + vx;
        const targetY = player.y + vy;
        if (!checkCollisionAt(targetX, targetY)) {
          player.x = targetX;
          player.y = targetY;
        } else if (!checkCollisionAt(targetX, player.y)) {
          player.x = targetX;
        } else if (!checkCollisionAt(player.x, targetY)) {
          player.y = targetY;
        }

        player.animTimer += dt;
        const animThreshold = (player.dir === 0 || player.dir === 1) ? 0.30 : 0.15;
        if (player.animTimer > animThreshold) {
          player.animTimer = 0;
          player.frame = (player.frame + 1) % 12;
        }
      }

      if (player.isMoving) {
        if (getAudioUnlocked() && !getFootstepPlaying() && allowAuxScPlayback()) {
          const playResult = footstepSound.play();
          if (playResult && typeof playResult.catch === 'function') playResult.catch(() => {});
          setFootstepPlaying(true);
        }
        if (!allowAuxScPlayback() && getFootstepPlaying()) {
          footstepSound.pause();
          setFootstepPlaying(false);
        }

        if (random() > 0.9) {
          const spriteW = spriteReady ? sprite.frameWidth * sprite.scale : 16;
          const spriteH = spriteReady ? sprite.frameHeight * sprite.scale : 20;
          const offsetY = Math.floor(spriteH * 0.22);
          const shiftY = Math.floor(spriteH / 3) - 4;
          const anchorY = player.y + spriteH + offsetY + shiftY;
          dustParticles.push({
            x: player.x + spriteW / 2 + (random() - 0.5) * 6,
            y: anchorY - 15 + (random() - 0.5) * 2,
            vx: (random() - 0.5) * 10,
            vy: -random() * 10,
            life: 1.0,
            size: 2 + random() * 2
          });
        }
      } else {
        player.frame = 1;
        if (getFootstepPlaying()) {
          footstepSound.pause();
          setFootstepPlaying(false);
        }
      }

      for (let i = dustParticles.length - 1; i >= 0; i--) {
        const d = dustParticles[i];
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.life -= 2.5 * dt;
        if (d.life <= 0) dustParticles.splice(i, 1);
      }

      {
        const spriteW = spriteReady ? sprite.frameWidth * sprite.scale : 16;
        const spriteH = spriteReady ? sprite.frameHeight * sprite.scale : 20;
        player.x = Math.max(0, Math.min(player.x, mapW - spriteW));
        player.y = Math.max(0, Math.min(player.y, mapH - spriteH - (options.footOffsetY || 0)));
      }

      player.isBehindForeground = checkForeground(player.x, player.y);

      const clampedZoomTarget = getCameraZoomClamped(getCameraZoomTarget());
      setCameraZoomTarget(clampedZoomTarget);
      const zoomStep = Math.min(1, ((gameCanvasGesture.mode === 'pinch') ? gameCameraZoomActiveLerp : 9.5) * dt);
      const nextZoom = getCameraZoom() + (clampedZoomTarget - getCameraZoom()) * zoomStep;
      setCameraZoom(nextZoom);

      let desiredCamX;
      let desiredCamY;
      let cameraStep;
      if (gameCanvasGesture.mode === 'pinch') {
        const pinchZoom = Math.max(0.0001, getCameraZoom());
        const rawDesiredCamX = gameCanvasGesture.pinchAnchorWorldX - (gameCanvasGesture.pinchCenterCanvasX / pinchZoom);
        const rawDesiredCamY = gameCanvasGesture.pinchAnchorWorldY - (gameCanvasGesture.pinchCenterCanvasY / pinchZoom);
        desiredCamX = clampCameraX(rawDesiredCamX);
        desiredCamY = clampCameraY(rawDesiredCamY);
        if (Math.abs(desiredCamX - rawDesiredCamX) > 0.01) {
          gameCanvasGesture.pinchAnchorWorldX = desiredCamX + (gameCanvasGesture.pinchCenterCanvasX / pinchZoom);
        }
        if (Math.abs(desiredCamY - rawDesiredCamY) > 0.01) {
          gameCanvasGesture.pinchAnchorWorldY = desiredCamY + (gameCanvasGesture.pinchCenterCanvasY / pinchZoom);
        }
        cameraStep = Math.min(1, gameCameraActiveLerp * dt);
      } else {
        const followCamX = getCameraFollowTargetX();
        const followCamY = getCameraFollowTargetY();
        if (gameCanvasGesture.mode !== 'drag') {
          const spring = Math.min(1, gameCameraPanReturnSpeed * dt);
          let nextOffsetX = getCameraPanOffsetX() + (0 - getCameraPanOffsetX()) * spring;
          let nextOffsetY = getCameraPanOffsetY() + (0 - getCameraPanOffsetY()) * spring;
          if (Math.abs(nextOffsetX) < 0.01) nextOffsetX = 0;
          if (Math.abs(nextOffsetY) < 0.01) nextOffsetY = 0;
          setCameraPanOffsetX(nextOffsetX);
          setCameraPanOffsetY(nextOffsetY);
        }
        desiredCamX = clampCameraX(followCamX + getCameraPanOffsetX());
        desiredCamY = clampCameraY(followCamY + getCameraPanOffsetY());
        cameraStep = Math.min(1, (isGameCanvasGestureActive() ? gameCameraActiveLerp : 5.0) * dt);
      }

      setTargetCamX(desiredCamX);
      setTargetCamY(desiredCamY);
      setCamX(getCamX() + (desiredCamX - getCamX()) * cameraStep);
      setCamY(getCamY() + (desiredCamY - getCamY()) * cameraStep);
      setNearbyLights([]);
      for (const particle of particles) particle.update(dt);
      for (const cloud of clouds) cloud.update(dt);

      const screenShake = getScreenShake();
      if (screenShake > 0.01) {
        setScreenShake(screenShake * Math.pow(0.8, dt * 60));
      } else {
        setScreenShake(0);
      }

      if (player.repathCooldown > 0) {
        player.repathCooldown = Math.max(0, player.repathCooldown - dt);
      }

      clickWalkPath = getClickWalkPath();
      if (clickWalkPath.length > 0 && !getIsReadingMode()) {
        const foot = getPlayerFootPosition(player.x, player.y);
        if (Number.isFinite(player.lastFootX) && Number.isFinite(player.lastFootY)) {
          const actualDist = Math.hypot(foot.x - player.lastFootX, foot.y - player.lastFootY);
          const intendedDist = Math.max(0.01, player.speed * dt * 0.55);
          if (actualDist < intendedDist * 0.25) {
            player.stuckTime += dt;
            if (player.stuckTime > 0.28) {
              let recovered = false;
              const clickWalkGoal = getClickWalkGoal();
              if (clickWalkGoal && player.repathCooldown <= 0) {
                recovered = replanClickPathFromPlayer();
                player.repathCooldown = 0.18;
              }
              clickWalkPath = getClickWalkPath();
              if (!recovered && clickWalkPath.length > 0) {
                clickWalkPath.shift();
                if (clickWalkPath.length === 0) setClickWalkGoal(null);
              }
              player.stuckTime = 0;
            }
          } else {
            player.stuckTime = Math.max(0, player.stuckTime - dt * 2);
          }
        }
        player.lastFootX = foot.x;
        player.lastFootY = foot.y;
      } else {
        player.stuckTime = 0;
        const foot = getPlayerFootPosition(player.x, player.y);
        player.lastFootX = foot.x;
        player.lastFootY = foot.y;
      }
    }

    return { update };
  }

  globalObject.GameboyIndexUpdateRuntime = Object.freeze({
    init: initIndexUpdateRuntime
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
