(function initIndexDrawRuntime(globalObject) {
  function createRenderState() {
    return {
      playerLightCanvas: null,
      playerLightCtx: null,
      playerMaskCanvas: null,
      playerMaskCtx: null,
      graySpriteCacheCanvas: null,
      graySpriteCacheCtx: null,
      graySpriteCacheKey: ''
    };
  }

  function initIndexDrawRuntime(options = {}) {
    const root = options.root || globalObject;
    const documentObject = options.document || root.document || null;
    const navigatorObject = options.navigator || root.navigator || { userAgent: '' };
    const ctx = options.ctx || null;
    const canvas = options.canvas || null;
    const player = options.player || {};
    const particles = options.particles || [];
    const clouds = options.clouds || [];
    const dustParticles = options.dustParticles || [];
    const yellowLights = options.yellowLights || [];
    const getGameReady = typeof options.getGameReady === 'function' ? options.getGameReady : () => false;
    const getMapW = typeof options.getMapW === 'function' ? options.getMapW : () => 0;
    const getMapH = typeof options.getMapH === 'function' ? options.getMapH : () => 0;
    const getForegroundData = typeof options.getForegroundData === 'function' ? options.getForegroundData : () => null;
    const getBgImage = typeof options.getBgImage === 'function' ? options.getBgImage : () => null;
    const getForegroundImage = typeof options.getForegroundImage === 'function' ? options.getForegroundImage : () => null;
    const getScreenShake = typeof options.getScreenShake === 'function' ? options.getScreenShake : () => 0;
    const getCameraZoom = typeof options.getCameraZoom === 'function' ? options.getCameraZoom : () => 1;
    const getCamX = typeof options.getCamX === 'function' ? options.getCamX : () => 0;
    const getCamY = typeof options.getCamY === 'function' ? options.getCamY : () => 0;
    const getNearbyLights = typeof options.getNearbyLights === 'function' ? options.getNearbyLights : () => [];
    const setNearbyLights = typeof options.setNearbyLights === 'function' ? options.setNearbyLights : () => {};
    const getActiveLightSourceId = typeof options.getActiveLightSourceId === 'function' ? options.getActiveLightSourceId : () => null;
    const getIsLoreMode = typeof options.getIsLoreMode === 'function' ? options.getIsLoreMode : () => false;
    const getIsReadingMode = typeof options.getIsReadingMode === 'function' ? options.getIsReadingMode : () => false;
    const getSpriteReady = typeof options.getSpriteReady === 'function' ? options.getSpriteReady : () => false;
    const getSprite = typeof options.getSprite === 'function' ? options.getSprite : () => ({ frameWidth: 16, frameHeight: 20, scale: 1, cols: 4 });
    const getSpriteFront = typeof options.getSpriteFront === 'function' ? options.getSpriteFront : () => null;
    const getSpriteBack = typeof options.getSpriteBack === 'function' ? options.getSpriteBack : () => null;
    const getSpriteSide = typeof options.getSpriteSide === 'function' ? options.getSpriteSide : () => null;
    const frontSpriteData = options.frontSpriteData || [];
    const frontAnimCycle = options.frontAnimCycle || [];
    const backSpriteData = options.backSpriteData || [];
    const backAnimCycle = options.backAnimCycle || [];
    const sideSpriteData = options.sideSpriteData || [];
    const sideAnimCycle = options.sideAnimCycle || [];
    const random = typeof options.random === 'function' ? options.random : Math.random;
    const state = options.renderState || createRenderState();

    if (root.debugFoot === undefined) {
      root.debugFoot = false;
    }

    function ensureNearbyLights() {
      let nearbyLights = getNearbyLights();
      if (!Array.isArray(nearbyLights)) {
        nearbyLights = [];
        setNearbyLights(nearbyLights);
      }
      return nearbyLights;
    }

    function checkForeground(px, py) {
      const sprite = getSprite();
      const spriteW = getSpriteReady() ? sprite.frameWidth * sprite.scale : 16;
      const spriteH = getSpriteReady() ? sprite.frameHeight * sprite.scale : 20;
      const cx = Math.floor(px + spriteW / 2);
      const cy = Math.floor(py + spriteH / 2);
      const foregroundData = getForegroundData();
      const mapW = getMapW();
      const mapH = getMapH();
      if (foregroundData && foregroundData[cy] && cy >= 0 && cy < mapH && cx >= 0 && cx < mapW) {
        return !!foregroundData[cy][cx];
      }
      return false;
    }

    function getPlayerDrawCoords(x, y, dir, frame) {
      const sprite = getSprite();
      const spriteFront = getSpriteFront();
      const spriteBack = getSpriteBack();
      const spriteSide = getSpriteSide();
      const refW = Math.floor(sprite.frameWidth * sprite.scale);
      const refH = Math.floor(sprite.frameHeight * sprite.scale);
      const visualShiftY = Math.floor(refH / 3) - 4;
      const flipX = dir === 3;
      let result = {};

      if (dir === 0 && frontAnimCycle.length > 0 && frontSpriteData.length > 0 && spriteFront) {
        const cycleIdx = frame % frontAnimCycle.length;
        const frameIdx = frontAnimCycle[cycleIdx];
        const data = frontSpriteData[frameIdx];
        const footRelX = data.footX - data.left;
        const footRelY = data.footY;
        const sw = data.width;
        const dw = Math.floor(sw * sprite.scale);
        const dh = Math.floor(spriteFront.height * sprite.scale);
        const dx = x + refW / 2 - footRelX * sprite.scale;
        const dy = y + refH + visualShiftY - footRelY * sprite.scale;
        result = {
          x: dx,
          y: dy,
          w: dw,
          h: dh,
          isSide: false,
          frameIdx,
          sx: data.left,
          sw,
          sh: spriteFront.height,
          footRelX: footRelX * sprite.scale,
          flipX: false
        };
      } else if (dir === 1 && backAnimCycle.length > 0 && backSpriteData.length > 0 && spriteBack) {
        const cycleIdx = frame % backAnimCycle.length;
        const frameIdx = backAnimCycle[cycleIdx];
        const data = backSpriteData[frameIdx];
        const footRelX = data.footX - data.left;
        const footRelY = data.footY;
        const sw = data.width;
        const dw = Math.floor(sw * sprite.scale);
        const dh = Math.floor(spriteBack.height * sprite.scale);
        const dx = x + refW / 2 - footRelX * sprite.scale;
        const dy = y + refH + visualShiftY - footRelY * sprite.scale;
        result = {
          x: dx,
          y: dy,
          w: dw,
          h: dh,
          isSide: false,
          frameIdx,
          sx: data.left,
          sw,
          sh: spriteBack.height,
          footRelX: footRelX * sprite.scale,
          flipX: false
        };
      } else if ((dir === 2 || dir === 3) && sideAnimCycle.length > 0 && sideSpriteData.length > 0 && spriteSide) {
        const cycleIdx = frame % sideAnimCycle.length;
        const frameIdx = sideAnimCycle[cycleIdx];
        const data = sideSpriteData[frameIdx];
        const footRelX = data.footX - data.left;
        const footRelY = data.footY;
        const sw = 175;
        const dw = Math.floor(sw * sprite.scale);
        const dh = Math.floor(spriteSide.height * sprite.scale);
        const dx = flipX
          ? ((x + refW / 2 + footRelX * sprite.scale) - dw)
          : (x + refW / 2 - footRelX * sprite.scale);
        const dy = y + refH + visualShiftY - footRelY * sprite.scale;
        result = {
          x: dx,
          y: dy,
          w: dw,
          h: dh,
          isSide: true,
          frameIdx,
          sx: data.left,
          sw,
          sh: spriteSide.height,
          footRelX: footRelX * sprite.scale,
          flipX
        };
      } else {
        const fallbackSprite = (dir === 1) ? (spriteBack || spriteFront) : (spriteFront || spriteSide || spriteBack);
        const sw = Math.floor(fallbackSprite.width / sprite.cols);
        const sh = fallbackSprite.height;
        const dw = Math.floor(sw * sprite.scale);
        const dh = Math.floor(sh * sprite.scale);
        const offsetY = Math.floor(dh * 0.22);
        const frameIdx = frame % 4;
        const sx = frameIdx * sw;
        result = {
          x,
          y: y + offsetY + visualShiftY,
          w: dw,
          h: dh,
          isSide: false,
          frameIdx,
          sx,
          sw,
          sh,
          flipX: false
        };
      }

      if (/iPhone|iPad|iPod/i.test(navigatorObject.userAgent || '')) {
        result.x = Math.floor(result.x);
        result.y = Math.floor(result.y);
      }
      return result;
    }

    function drawPlayer(targetCtx, x, y, dir, frame) {
      if (!getSpriteReady()) return;
      const sprite = getSprite();
      const coords = getPlayerDrawCoords(x, y, dir, frame);
      const refW = Math.floor(sprite.frameWidth * sprite.scale);
      const refH = Math.floor(sprite.frameHeight * sprite.scale);
      const visualShiftY = Math.floor(refH / 3) - 4;
      let spriteAsset;
      if (dir === 0) spriteAsset = getSpriteFront();
      else if (dir === 1) spriteAsset = getSpriteBack() || getSpriteFront();
      else spriteAsset = getSpriteSide() || getSpriteFront();

      targetCtx.save();
      if (root.debugFoot) {
        targetCtx.save();
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        targetCtx.beginPath();
        targetCtx.arc(x + refW / 2, y + refH + visualShiftY, 20, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.fillStyle = 'red';
        targetCtx.fillRect(x + refW / 2 - 2, y + refH + visualShiftY - 2, 4, 4);
        targetCtx.restore();
      }

      if (coords.isSide && coords.flipX) {
        targetCtx.translate(coords.x + coords.w, coords.y);
        targetCtx.scale(-1, 1);
        targetCtx.drawImage(spriteAsset, coords.sx, 0, coords.sw, coords.sh, 0, 0, coords.w, coords.h);
      } else {
        targetCtx.drawImage(spriteAsset, coords.sx, 0, coords.sw, coords.sh, coords.x, coords.y, coords.w, coords.h);
      }
      targetCtx.restore();
    }

    function createGraySpriteCanvas() {
      if (!getSpriteReady()) return null;
      const coords = getPlayerDrawCoords(player.x, player.y, player.dir, player.frame);
      const flipX = player.dir === 3;
      let spriteAsset;
      if (player.dir === 0) spriteAsset = getSpriteFront();
      else if (player.dir === 1) spriteAsset = getSpriteBack() || getSpriteFront();
      else spriteAsset = getSpriteSide() || getSpriteFront();

      const cacheKey = [
        player.dir,
        player.frame,
        coords.w,
        coords.h,
        coords.sx,
        coords.sw,
        coords.sh,
        coords.flipX ? 1 : 0
      ].join(':');
      if (state.graySpriteCacheCanvas && state.graySpriteCacheKey === cacheKey) {
        return state.graySpriteCacheCanvas;
      }

      if (!state.graySpriteCacheCanvas) {
        state.graySpriteCacheCanvas = documentObject.createElement('canvas');
        state.graySpriteCacheCtx = state.graySpriteCacheCanvas.getContext('2d');
      }
      if (state.graySpriteCacheCanvas.width !== coords.w || state.graySpriteCacheCanvas.height !== coords.h) {
        state.graySpriteCacheCanvas.width = coords.w;
        state.graySpriteCacheCanvas.height = coords.h;
      }
      const c = state.graySpriteCacheCanvas;
      const gc = state.graySpriteCacheCtx;
      gc.clearRect(0, 0, c.width, c.height);
      if (coords.isSide && flipX) {
        gc.translate(coords.w, 0);
        gc.scale(-1, 1);
      }
      gc.drawImage(spriteAsset, coords.sx, 0, coords.sw, coords.sh, 0, 0, coords.w, coords.h);
      if (coords.isSide && flipX) {
        gc.setTransform(1, 0, 0, 1, 0, 0);
      }
      gc.globalCompositeOperation = 'source-in';
      gc.fillStyle = 'rgb(180, 180, 180)';
      gc.fillRect(0, 0, coords.w, coords.h);
      gc.globalCompositeOperation = 'source-over';
      state.graySpriteCacheKey = cacheKey;
      return c;
    }

    function drawPlayerOutline(targetCtx, x, y) {
      const sprite = getSprite();
      const spriteFront = getSpriteFront();
      if (!getSpriteReady() || !spriteFront) return;
      const dir = player.dir;
      let spriteAsset;
      let flipX = false;
      switch (dir) {
        case 0:
          spriteAsset = spriteFront;
          break;
        case 1:
          spriteAsset = getSpriteBack() || spriteFront;
          break;
        case 2:
          spriteAsset = getSpriteSide() || spriteFront;
          break;
        case 3:
          spriteAsset = getSpriteSide() || spriteFront;
          flipX = true;
          break;
        default:
          spriteAsset = spriteFront;
      }

      const spriteW = Math.floor(spriteAsset.width / sprite.cols);
      const spriteH = spriteAsset.height;
      const drawW = Math.floor(spriteW * sprite.scale);
      const drawH = Math.floor(spriteH * sprite.scale);
      const frame = player.frame % sprite.cols;
      const offCanvas = documentObject.createElement('canvas');
      offCanvas.width = drawW;
      offCanvas.height = drawH;
      const offCtx = offCanvas.getContext('2d');
      if (flipX) {
        offCtx.translate(drawW, 0);
        offCtx.scale(-1, 1);
      }
      offCtx.drawImage(spriteAsset, frame * spriteW, 0, spriteW, spriteH, 0, 0, drawW, drawH);
      offCtx.globalCompositeOperation = 'source-in';
      offCtx.fillStyle = 'rgb(200, 200, 200)';
      offCtx.fillRect(0, 0, drawW, drawH);
      targetCtx.save();
      targetCtx.globalAlpha = 0.6;
      targetCtx.drawImage(offCanvas, Math.floor(x), Math.floor(y));
      targetCtx.restore();
    }

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!getGameReady()) return;

      let nearbyLights = ensureNearbyLights();
      ctx.save();
      const screenShake = getScreenShake();
      const shakeX = screenShake > 0 ? (random() - 0.5) * screenShake : 0;
      const shakeY = screenShake > 0 ? (random() - 0.5) * screenShake : 0;
      const cameraZoom = getCameraZoom();
      const camX = getCamX();
      const camY = getCamY();
      ctx.setTransform(cameraZoom, 0, 0, cameraZoom, shakeX - (camX * cameraZoom), shakeY - (camY * cameraZoom));

      const bgImage = getBgImage();
      if (bgImage) ctx.drawImage(bgImage, 0, 0);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const particle of particles) particle.draw(ctx, camX, camY);
      ctx.restore();

      for (const light of yellowLights) {
        light.draw(ctx);
        if (getActiveLightSourceId() === light.id && getIsLoreMode()) {
          const coords = getPlayerDrawCoords(player.x, player.y, player.dir, player.frame);
          const px = coords.x + coords.w / 2;
          const py = coords.y + coords.h / 2;
          const ddx = light.x - px;
          const ddy = light.y - py;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);
          nearbyLights.push({ x: light.x, y: light.y, dist, life: 1.0, isYellow: true });
        }
      }

      {
        const sprite = getSprite();
        const spriteW = getSpriteReady() ? sprite.frameWidth * sprite.scale : 16;
        const spriteH = getSpriteReady() ? sprite.frameHeight * sprite.scale : 20;
        const offsetY = Math.floor(spriteH * 0.22);
        const shiftY = Math.floor(spriteH / 3) - 4;
        const shadowCenterX = player.x + spriteW / 2;
        const shadowCenterY = player.y + offsetY + shiftY + spriteH - 15;
        const shadowWidth = spriteW * 0.4;
        const shadowHeight = 3;
        let shadowAlpha = 0.35;
        if (nearbyLights.length > 0) {
          const light = nearbyLights[0];
          const distFactor = 1 - (light.dist / 35);
          shadowAlpha = 0.25 + distFactor * 0.15;
        }
        ctx.save();
        const gradient = ctx.createRadialGradient(shadowCenterX, shadowCenterY, 0, shadowCenterX, shadowCenterY, shadowWidth);
        gradient.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
        gradient.addColorStop(0.5, `rgba(0, 0, 0, ${shadowAlpha * 0.4})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(shadowCenterX, shadowCenterY, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      drawPlayer(ctx, player.x, player.y, player.dir, player.frame);

      if (getIsReadingMode() && player.debugFootX !== undefined) {
        const fx = player.debugFootX;
        const fy = player.debugFootY;
        ctx.save();
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx - 8, fy);
        ctx.lineTo(fx + 8, fy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(fx, fy - 8);
        ctx.lineTo(fx, fy + 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (nearbyLights.length > 0) {
        nearbyLights.sort((a, b) => a.dist - b.dist);
        const maxRadius = 65;
        let totalIntensity = 0;
        let avgDx = 0;
        let avgDy = 0;
        let useYellow = false;
        const coords = getPlayerDrawCoords(player.x, player.y, player.dir, player.frame);
        const spriteW = coords.w;
        const spriteH = coords.h;
        const playerCX = coords.x + spriteW / 2;
        const playerCY = coords.y + spriteH / 2;
        const numLights = Math.min(2, nearbyLights.length);
        for (let i = 0; i < numLights; i++) {
          const light = nearbyLights[i];
          if (light.isYellow) useYellow = true;
          const distFactor = 1 - (light.dist / maxRadius);
          const intensity = distFactor * light.life * (light.isYellow ? 1.5 : 1.0);
          totalIntensity += intensity * 0.4;
          const dx = playerCX - light.x;
          const dy = playerCY - light.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          avgDx += (dx / len) * intensity;
          avgDy += (dy / len) * intensity;
        }
        totalIntensity = Math.min(useYellow ? 0.7 : 0.5, totalIntensity);
        if (totalIntensity > 0.02) {
          const dirLen = Math.sqrt(avgDx * avgDx + avgDy * avgDy) || 1;
          const ndx = avgDx / dirLen;
          const ndy = avgDy / dirLen;
          if (!state.playerLightCanvas) {
            state.playerLightCanvas = documentObject.createElement('canvas');
            state.playerLightCtx = state.playerLightCanvas.getContext('2d');
          }
          if (state.playerLightCanvas.width !== spriteW || state.playerLightCanvas.height !== spriteH) {
            state.playerLightCanvas.width = spriteW;
            state.playerLightCanvas.height = spriteH;
          }
          const lightCanvas = state.playerLightCanvas;
          const lightCtx = state.playerLightCtx;
          lightCtx.globalCompositeOperation = 'source-over';
          lightCtx.clearRect(0, 0, spriteW, spriteH);
          lightCtx.save();
          lightCtx.translate(-coords.x, -coords.y);
          drawPlayer(lightCtx, player.x, player.y, player.dir, player.frame);
          lightCtx.restore();
          const r = 255;
          const g = useYellow ? 220 : 255;
          const b = useYellow ? 50 : 255;
          lightCtx.globalCompositeOperation = 'source-in';
          lightCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${totalIntensity * 0.8})`;
          lightCtx.fillRect(0, 0, spriteW, spriteH);
          const rad = Math.max(spriteW, spriteH) * 2;
          const gradient = lightCtx.createRadialGradient(
            spriteW / 2 + ndx * (spriteW / 2),
            spriteH / 2 + ndy * (spriteH / 2),
            0,
            spriteW / 2,
            spriteH / 2,
            rad
          );
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${totalIntensity * 0.2})`);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          lightCtx.fillStyle = gradient;
          lightCtx.fillRect(0, 0, spriteW, spriteH);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(lightCanvas, coords.x, coords.y);
          ctx.restore();
        }
      }

      ctx.save();
      for (const dust of dustParticles) {
        ctx.globalAlpha = dust.life * 0.4;
        ctx.fillStyle = '#a89070';
        ctx.beginPath();
        ctx.arc(dust.x, dust.y, dust.size * dust.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      const foregroundImage = getForegroundImage();
      if (foregroundImage) ctx.drawImage(foregroundImage, 0, 0);
      if (foregroundImage && getSpriteReady()) {
        const coords = getPlayerDrawCoords(player.x, player.y, player.dir, player.frame);
        const px = coords.x;
        const py = coords.y;
        const dw = coords.w;
        const dh = coords.h;
        const maskW = dw + 4;
        const maskH = dh + 4;
        if (!state.playerMaskCanvas) {
          state.playerMaskCanvas = documentObject.createElement('canvas');
          state.playerMaskCtx = state.playerMaskCanvas.getContext('2d');
        }
        if (state.playerMaskCanvas.width !== maskW || state.playerMaskCanvas.height !== maskH) {
          state.playerMaskCanvas.width = maskW;
          state.playerMaskCanvas.height = maskH;
        }
        const maskCanvas = state.playerMaskCanvas;
        const maskCtx = state.playerMaskCtx;
        maskCtx.globalCompositeOperation = 'source-over';
        maskCtx.clearRect(0, 0, maskW, maskH);
        maskCtx.drawImage(foregroundImage, px - 2, py - 2, dw + 4, dh + 4, 0, 0, dw + 4, dh + 4);
        maskCtx.globalCompositeOperation = 'source-in';
        const graySprite = createGraySpriteCanvas();
        if (graySprite) {
          maskCtx.drawImage(graySprite, 2, 2);
        }
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.drawImage(maskCanvas, px - 2, py - 2);
        ctx.restore();
      }

      for (const cloud of clouds) cloud.draw(ctx, camX, camY);
      ctx.restore();
    }

    return {
      renderState: state,
      checkForeground,
      draw,
      getPlayerDrawCoords,
      drawPlayer,
      createGraySpriteCanvas,
      drawPlayerOutline
    };
  }

  globalObject.GameboyIndexDrawRuntime = Object.freeze({
    init: initIndexDrawRuntime,
    createRenderState
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
