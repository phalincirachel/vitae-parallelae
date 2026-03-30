(function initIndexNavigationRuntime(globalObject) {
  class PriorityQueue {
    constructor() {
      this.elements = [];
    }

    enqueue(element, priority) {
      this.elements.push({ element, priority });
      this.bubbleUp(this.elements.length - 1);
    }

    bubbleUp(index) {
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (this.elements[parent].priority <= this.elements[index].priority) break;
        [this.elements[parent], this.elements[index]] = [this.elements[index], this.elements[parent]];
        index = parent;
      }
    }

    bubbleDown(index) {
      const len = this.elements.length;
      while (true) {
        let smallest = index;
        const left = index * 2 + 1;
        const right = left + 1;
        if (left < len && this.elements[left].priority < this.elements[smallest].priority) {
          smallest = left;
        }
        if (right < len && this.elements[right].priority < this.elements[smallest].priority) {
          smallest = right;
        }
        if (smallest === index) break;
        [this.elements[index], this.elements[smallest]] = [this.elements[smallest], this.elements[index]];
        index = smallest;
      }
    }

    dequeue() {
      if (this.elements.length === 0) return null;
      const top = this.elements[0];
      const last = this.elements.pop();
      if (this.elements.length > 0) {
        this.elements[0] = last;
        this.bubbleDown(0);
      }
      return top.element;
    }

    isEmpty() {
      return this.elements.length === 0;
    }
  }

  function createMutableNavState() {
    return {
      navGrid: [],
      navPenaltyGrid: [],
      navGridW: 0,
      navGridH: 0
    };
  }

  function initIndexNavigationRuntime(options = {}) {
    const root = options.root || globalObject;
    const windowObject = options.window || root.window || root;
    const documentObject = options.document || root.document || null;
    const canvas = options.canvas || null;
    const keys = options.keys || {};
    const player = options.player || {};
    const gameCanvasGesture = options.gameCanvasGesture || { pointers: new Map(), mode: 'idle' };
    const navState = options.navState || createMutableNavState();
    const getGameReady = typeof options.getGameReady === 'function' ? options.getGameReady : () => false;
    const getIsReadingMode = typeof options.getIsReadingMode === 'function' ? options.getIsReadingMode : () => false;
    const getMapW = typeof options.getMapW === 'function' ? options.getMapW : () => 0;
    const getMapH = typeof options.getMapH === 'function' ? options.getMapH : () => 0;
    const getCollisionData = typeof options.getCollisionData === 'function' ? options.getCollisionData : () => [];
    const getCurrentSpriteSize = typeof options.getCurrentSpriteSize === 'function'
      ? options.getCurrentSpriteSize
      : () => ({ w: 16, h: 20 });
    const footOffsetY = Number.isFinite(options.footOffsetY) ? options.footOffsetY : 0;
    const getMoveTarget = typeof options.getMoveTarget === 'function' ? options.getMoveTarget : () => null;
    const setMoveTarget = typeof options.setMoveTarget === 'function' ? options.setMoveTarget : () => {};
    const getClickWalkPath = typeof options.getClickWalkPath === 'function' ? options.getClickWalkPath : () => [];
    const setClickWalkPath = typeof options.setClickWalkPath === 'function' ? options.setClickWalkPath : () => {};
    const getClickWalkGoal = typeof options.getClickWalkGoal === 'function' ? options.getClickWalkGoal : () => null;
    const setClickWalkGoal = typeof options.setClickWalkGoal === 'function' ? options.setClickWalkGoal : () => {};
    const getCameraZoom = typeof options.getCameraZoom === 'function' ? options.getCameraZoom : () => 1;
    const setCameraZoomTarget = typeof options.setCameraZoomTarget === 'function' ? options.setCameraZoomTarget : () => {};
    const getCameraPanOffsetX = typeof options.getCameraPanOffsetX === 'function' ? options.getCameraPanOffsetX : () => 0;
    const getCameraPanOffsetY = typeof options.getCameraPanOffsetY === 'function' ? options.getCameraPanOffsetY : () => 0;
    const getCanvasPointFromClient = typeof options.getCanvasPointFromClient === 'function' ? options.getCanvasPointFromClient : () => null;
    const screenPointToWorld = typeof options.screenPointToWorld === 'function' ? options.screenPointToWorld : () => null;
    const setGameCameraPanFromDrag = typeof options.setGameCameraPanFromDrag === 'function' ? options.setGameCameraPanFromDrag : () => {};
    const getCameraZoomClamped = typeof options.getCameraZoomClamped === 'function' ? options.getCameraZoomClamped : (value) => value;
    const resetGameCanvasGestureState = typeof options.resetGameCanvasGestureState === 'function' ? options.resetGameCanvasGestureState : () => {};
    const onTogglePal = typeof options.onTogglePal === 'function' ? options.onTogglePal : () => {};
    const onToggleHalftone = typeof options.onToggleHalftone === 'function' ? options.onToggleHalftone : () => {};
    const onPreventDirectionalFocus = typeof options.onPreventDirectionalFocus === 'function' ? options.onPreventDirectionalFocus : () => {};
    const hasPointerEvent = options.hasPointerEvent !== undefined ? !!options.hasPointerEvent : !!windowObject.PointerEvent;
    const performanceNow = typeof options.performanceNow === 'function'
      ? options.performanceNow
      : () => ((windowObject.performance && typeof windowObject.performance.now === 'function') ? windowObject.performance.now() : Date.now());
    const navGridSize = Number.isFinite(options.navGridSize) ? options.navGridSize : 8;
    const navCollisionPaddingX = Number.isFinite(options.navCollisionPaddingX) ? options.navCollisionPaddingX : 1;
    const navCollisionPaddingY = Number.isFinite(options.navCollisionPaddingY) ? options.navCollisionPaddingY : 1;
    const navMaxGoalSearchCells = Number.isFinite(options.navMaxGoalSearchCells) ? options.navMaxGoalSearchCells : 72;
    const navMaxStartSearchCells = Number.isFinite(options.navMaxStartSearchCells) ? options.navMaxStartSearchCells : 28;
    const dragThresholdPx = Number.isFinite(options.dragThresholdPx) ? options.dragThresholdPx : 7;
    const log = typeof options.log === 'function' ? options.log : () => {};

    function clearClickWalkState() {
      setMoveTarget(null);
      setClickWalkPath([]);
      setClickWalkGoal(null);
    }

    function getPlayerFootPosition(px = player.x, py = player.y) {
      const size = getCurrentSpriteSize();
      return {
        x: px + size.w / 2,
        y: py + size.h + footOffsetY
      };
    }

    function setPlayerFromFootPosition(fx, fy) {
      const size = getCurrentSpriteSize();
      player.x = fx - size.w / 2;
      player.y = fy - size.h - footOffsetY;
    }

    function clampPointToMap(x, y) {
      const mapW = getMapW();
      const mapH = getMapH();
      return {
        x: Math.max(0, Math.min(Math.round(x), mapW - 1)),
        y: Math.max(0, Math.min(Math.round(y), mapH - 1))
      };
    }

    function isSolid(x, y) {
      const mapW = getMapW();
      const mapH = getMapH();
      const collisionData = getCollisionData();
      if (x < 0 || x >= mapW || y < 0 || y >= mapH) return true;
      return !!(collisionData[y] && collisionData[y][x]);
    }

    function isFootSolid(fx, fy, extraHalfWidth = 0, extraVerticalPad = 0) {
      fx = Math.floor(fx);
      fy = Math.floor(fy);
      const halfWidth = 4 + Math.max(0, extraHalfWidth);
      const verticalPad = Math.max(0, extraVerticalPad);
      const left = fx - halfWidth;
      const right = fx + halfWidth;
      const top = fy - verticalPad;
      const bottom = fy + verticalPad;

      for (let y = top; y <= bottom; y++) {
        for (let x = left; x <= right; x++) {
          if (isSolid(x, y)) return true;
        }
      }
      return false;
    }

    function generateNavGrid() {
      const mapW = getMapW();
      const mapH = getMapH();
      const collisionData = getCollisionData();
      if (!mapW || !mapH || !collisionData || collisionData.length === 0) {
        navState.navGrid = [];
        navState.navPenaltyGrid = [];
        navState.navGridW = 0;
        navState.navGridH = 0;
        return;
      }

      navState.navGridW = Math.max(1, Math.ceil(mapW / navGridSize));
      navState.navGridH = Math.max(1, Math.ceil(mapH / navGridSize));
      navState.navGrid = new Array(navState.navGridH).fill(null).map(() => new Array(navState.navGridW).fill(true));
      navState.navPenaltyGrid = new Array(navState.navGridH).fill(null).map(() => new Array(navState.navGridW).fill(0));

      for (let gy = 0; gy < navState.navGridH; gy++) {
        for (let gx = 0; gx < navState.navGridW; gx++) {
          const px = Math.min(mapW - 1, gx * navGridSize);
          const py = Math.min(mapH - 1, gy * navGridSize);
          navState.navGrid[gy][gx] = isFootSolid(px, py, navCollisionPaddingX, navCollisionPaddingY);
        }
      }

      for (let gy = 0; gy < navState.navGridH; gy++) {
        for (let gx = 0; gx < navState.navGridW; gx++) {
          if (navState.navGrid[gy][gx]) {
            navState.navPenaltyGrid[gy][gx] = 1.0;
            continue;
          }
          let blockedNeighbors = 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              if (ox === 0 && oy === 0) continue;
              const nx = gx + ox;
              const ny = gy + oy;
              if (nx < 0 || ny < 0 || nx >= navState.navGridW || ny >= navState.navGridH || navState.navGrid[ny][nx]) {
                blockedNeighbors++;
              }
            }
          }
          navState.navPenaltyGrid[gy][gx] = blockedNeighbors * 0.12;
        }
      }

      log(`[Pathfinding] NavGrid ready: ${navState.navGridW}x${navState.navGridH}`);
    }

    function checkFootLineOfSight(x0, y0, x1, y1) {
      x0 = Math.floor(x0);
      y0 = Math.floor(y0);
      x1 = Math.floor(x1);
      y1 = Math.floor(y1);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      const steps = Math.ceil(dist / 2);
      if (steps === 0) return true;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = Math.round(x0 + t * dx);
        const py = Math.round(y0 + t * dy);
        if (isFootSolid(px, py, navCollisionPaddingX, navCollisionPaddingY)) return false;
      }
      return true;
    }

    function getFurthestValidPoint(x0, y0, x1, y1) {
      x0 = Math.floor(x0);
      y0 = Math.floor(y0);
      x1 = Math.floor(x1);
      y1 = Math.floor(y1);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      const steps = Math.ceil(dist);
      if (steps === 0) return { x: x0, y: y0 };

      let lastValid = { x: x0, y: y0 };
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const px = Math.round(x0 + t * dx);
        const py = Math.round(y0 + t * dy);
        if (isFootSolid(px, py, navCollisionPaddingX, navCollisionPaddingY)) {
          break;
        }
        lastValid = { x: px, y: py };
      }
      return lastValid;
    }

    function isNavBlocked(gx, gy) {
      if (gx < 0 || gy < 0 || gx >= navState.navGridW || gy >= navState.navGridH) return true;
      return navState.navGrid[gy][gx];
    }

    function getNavPenalty(gx, gy) {
      if (gx < 0 || gy < 0 || gx >= navState.navGridW || gy >= navState.navGridH) return 1.0;
      return navState.navPenaltyGrid[gy][gx];
    }

    function toNavCell(fx, fy) {
      return {
        x: Math.max(0, Math.min(navState.navGridW - 1, Math.round(fx / navGridSize))),
        y: Math.max(0, Math.min(navState.navGridH - 1, Math.round(fy / navGridSize)))
      };
    }

    function toWorldFromNav(cell) {
      return {
        x: Math.max(0, Math.min(getMapW() - 1, cell.x * navGridSize)),
        y: Math.max(0, Math.min(getMapH() - 1, cell.y * navGridSize))
      };
    }

    function findNearestWalkableCell(origin, maxRadiusCells) {
      if (!isNavBlocked(origin.x, origin.y)) return { x: origin.x, y: origin.y };

      for (let r = 1; r <= maxRadiusCells; r++) {
        let best = null;
        let bestDistSq = Infinity;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const nx = origin.x + dx;
            const ny = origin.y + dy;
            if (isNavBlocked(nx, ny)) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              best = { x: nx, y: ny };
            }
          }
        }
        if (best) return best;
      }

      return null;
    }

    function findNearestFreeFootPoint(fx, fy, maxRadiusPx = 96) {
      const clamped = clampPointToMap(fx, fy);
      if (!isFootSolid(clamped.x, clamped.y)) return clamped;

      for (let r = 1; r <= maxRadiusPx; r++) {
        let best = null;
        let bestDistSq = Infinity;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const px = clamped.x + dx;
            const py = clamped.y + dy;
            if (px < 0 || py < 0 || px >= getMapW() || py >= getMapH()) continue;
            if (isFootSolid(px, py, navCollisionPaddingX, navCollisionPaddingY)) continue;
            const dSq = dx * dx + dy * dy;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              best = { x: px, y: py };
            }
          }
        }
        if (best) return best;
      }

      return null;
    }

    function octileHeuristic(ax, ay, bx, by) {
      const dx = Math.abs(ax - bx);
      const dy = Math.abs(ay - by);
      const diagonal = Math.min(dx, dy);
      const straight = dx + dy;
      return straight + (Math.SQRT2 - 2) * diagonal;
    }

    function smoothFootPath(pixelPath) {
      if (pixelPath.length <= 2) return pixelPath.slice(1);
      const smoothed = [pixelPath[0]];
      let currentIndex = 0;
      while (currentIndex < pixelPath.length - 1) {
        let lookAhead = pixelPath.length - 1;
        while (lookAhead > currentIndex + 1) {
          if (checkFootLineOfSight(pixelPath[currentIndex].x, pixelPath[currentIndex].y, pixelPath[lookAhead].x, pixelPath[lookAhead].y)) {
            break;
          }
          lookAhead--;
        }
        smoothed.push(pixelPath[lookAhead]);
        currentIndex = lookAhead;
      }
      return smoothed.slice(1);
    }

    function findPathAStar(sFx, sFy, gFx, gFy) {
      if (!getGameReady() || !getMapW() || !getMapH()) return [];
      if (navState.navGrid.length === 0 || navState.navGridW === 0 || navState.navGridH === 0) {
        generateNavGrid();
      }
      if (navState.navGrid.length === 0 || navState.navGridW === 0 || navState.navGridH === 0) return [];

      let start = clampPointToMap(sFx, sFy);
      let goal = clampPointToMap(gFx, gFy);

      if (isFootSolid(start.x, start.y, navCollisionPaddingX, navCollisionPaddingY)) {
        const escapedStart = findNearestFreeFootPoint(start.x, start.y, navGridSize * navMaxStartSearchCells);
        if (!escapedStart) return [];
        start = escapedStart;
      }

      if (isFootSolid(goal.x, goal.y, navCollisionPaddingX, navCollisionPaddingY)) {
        goal = getFurthestValidPoint(start.x, start.y, goal.x, goal.y);
        if (isFootSolid(goal.x, goal.y, navCollisionPaddingX, navCollisionPaddingY)) {
          const escapedGoal = findNearestFreeFootPoint(goal.x, goal.y, navGridSize * navMaxStartSearchCells);
          if (escapedGoal) goal = escapedGoal;
        }
      }

      if (checkFootLineOfSight(start.x, start.y, goal.x, goal.y)) {
        return [{ x: goal.x, y: goal.y }];
      }

      const startCellRaw = toNavCell(start.x, start.y);
      const goalCellRaw = toNavCell(goal.x, goal.y);
      const startCell = findNearestWalkableCell(startCellRaw, navMaxStartSearchCells);
      const goalCell = findNearestWalkableCell(goalCellRaw, navMaxGoalSearchCells);

      if (!startCell || !goalCell) {
        const fallback = getFurthestValidPoint(start.x, start.y, goal.x, goal.y);
        if (fallback.x === start.x && fallback.y === start.y) return [];
        return [fallback];
      }

      if (startCell.x === goalCell.x && startCell.y === goalCell.y) {
        return [{ x: goal.x, y: goal.y }];
      }

      const frontier = new PriorityQueue();
      const startKey = `${startCell.x},${startCell.y}`;
      const goalKey = `${goalCell.x},${goalCell.y}`;
      frontier.enqueue(startCell, 0);

      const cameFrom = new Map();
      const costSoFar = new Map();
      const closed = new Set();
      cameFrom.set(startKey, null);
      costSoFar.set(startKey, 0);

      const dirs = [
        { dx: 1, dy: 0, cost: 1.0 },
        { dx: -1, dy: 0, cost: 1.0 },
        { dx: 0, dy: 1, cost: 1.0 },
        { dx: 0, dy: -1, cost: 1.0 },
        { dx: 1, dy: 1, cost: Math.SQRT2 },
        { dx: 1, dy: -1, cost: Math.SQRT2 },
        { dx: -1, dy: 1, cost: Math.SQRT2 },
        { dx: -1, dy: -1, cost: Math.SQRT2 }
      ];

      let iterations = 0;
      const maxIterations = Math.min(Math.max(8000, navState.navGridW * navState.navGridH), 120000);
      let bestKey = startKey;
      let bestH = octileHeuristic(startCell.x, startCell.y, goalCell.x, goalCell.y);
      let reachedGoal = false;

      while (!frontier.isEmpty() && iterations < maxIterations) {
        iterations++;
        const current = frontier.dequeue();
        if (!current) break;
        const currentKey = `${current.x},${current.y}`;
        if (closed.has(currentKey)) continue;
        closed.add(currentKey);

        if (currentKey === goalKey) {
          reachedGoal = true;
          bestKey = currentKey;
          break;
        }

        const currentCost = costSoFar.get(currentKey);
        for (const dir of dirs) {
          const nx = current.x + dir.dx;
          const ny = current.y + dir.dy;
          if (isNavBlocked(nx, ny)) continue;
          if (dir.dx !== 0 && dir.dy !== 0) {
            if (isNavBlocked(current.x + dir.dx, current.y) || isNavBlocked(current.x, current.y + dir.dy)) {
              continue;
            }
          }

          const nextKey = `${nx},${ny}`;
          if (closed.has(nextKey)) continue;
          const tentativeCost = currentCost + dir.cost + getNavPenalty(nx, ny);
          if (costSoFar.has(nextKey) && tentativeCost >= costSoFar.get(nextKey)) continue;
          costSoFar.set(nextKey, tentativeCost);
          cameFrom.set(nextKey, current);
          const h = octileHeuristic(nx, ny, goalCell.x, goalCell.y);
          if (h < bestH) {
            bestH = h;
            bestKey = nextKey;
          }
          frontier.enqueue({ x: nx, y: ny }, tentativeCost + h);
        }
      }

      if (bestKey === startKey) {
        const fallback = getFurthestValidPoint(start.x, start.y, goal.x, goal.y);
        if (fallback.x === start.x && fallback.y === start.y) return [];
        return [fallback];
      }

      let currentNode = reachedGoal ? goalCell : (() => {
        const parts = bestKey.split(',');
        return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) };
      })();

      const path = [];
      while (currentNode !== null) {
        path.push(currentNode);
        currentNode = cameFrom.get(`${currentNode.x},${currentNode.y}`) || null;
      }
      path.reverse();

      const pixelPath = path.map((node) => toWorldFromNav(node));
      pixelPath[0] = { x: start.x, y: start.y };
      if (reachedGoal) {
        pixelPath[pixelPath.length - 1] = { x: goal.x, y: goal.y };
      }
      return smoothFootPath(pixelPath);
    }

    function replanClickPathFromPlayer() {
      const clickWalkGoal = getClickWalkGoal();
      if (!clickWalkGoal) return false;
      const foot = getPlayerFootPosition(player.x, player.y);
      const newPath = findPathAStar(foot.x, foot.y, clickWalkGoal.x, clickWalkGoal.y);
      if (!newPath || newPath.length === 0) return false;
      setClickWalkPath(newPath);
      return true;
    }

    function handleClickMove(screenX, screenY) {
      if (!getGameReady() || getIsReadingMode()) return;
      const point = screenPointToWorld(screenX, screenY);
      if (!point) return;
      const startFoot = getPlayerFootPosition(player.x, player.y);
      const goal = clampPointToMap(point.worldX, point.worldY);
      setClickWalkGoal(goal);
      setClickWalkPath(findPathAStar(startFoot.x, startFoot.y, goal.x, goal.y));
      setMoveTarget(null);
      const clickWalkPath = getClickWalkPath();
      if (clickWalkPath.length === 0) {
        const fallback = getFurthestValidPoint(startFoot.x, startFoot.y, goal.x, goal.y);
        if (Math.hypot(fallback.x - startFoot.x, fallback.y - startFoot.y) > 1) {
          setClickWalkPath([fallback]);
        } else {
          setClickWalkGoal(null);
        }
      }
    }

    function beginGameCanvasSinglePointerGesture(pointerInfo, config = {}) {
      if (!pointerInfo) {
        resetGameCanvasGestureState();
        return;
      }
      gameCanvasGesture.mode = 'pending';
      gameCanvasGesture.primaryPointerId = pointerInfo.pointerId;
      gameCanvasGesture.dragStartCanvasX = pointerInfo.canvasX;
      gameCanvasGesture.dragStartCanvasY = pointerInfo.canvasY;
      gameCanvasGesture.dragStartClientX = pointerInfo.clientX;
      gameCanvasGesture.dragStartClientY = pointerInfo.clientY;
      gameCanvasGesture.dragBaseOffsetX = getCameraPanOffsetX();
      gameCanvasGesture.dragBaseOffsetY = getCameraPanOffsetY();
      gameCanvasGesture.dragMoved = false;
      gameCanvasGesture.pinchActive = false;
      gameCanvasGesture.pinchStartDistance = 0;
      gameCanvasGesture.pinchStartZoom = getCameraZoom();
      gameCanvasGesture.suppressTap = !!config.suppressTap;
    }

    function beginGameCanvasPinchGesture() {
      const pointers = Array.from(gameCanvasGesture.pointers.values());
      if (pointers.length < 2) return;
      const [first, second] = pointers;
      const midClientX = (first.clientX + second.clientX) * 0.5;
      const midClientY = (first.clientY + second.clientY) * 0.5;
      const anchor = screenPointToWorld(midClientX, midClientY);
      if (!anchor) return;
      gameCanvasGesture.mode = 'pinch';
      gameCanvasGesture.primaryPointerId = null;
      gameCanvasGesture.dragMoved = false;
      gameCanvasGesture.pinchActive = true;
      gameCanvasGesture.suppressTap = true;
      gameCanvasGesture.pinchStartDistance = Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY));
      gameCanvasGesture.pinchFilteredDistance = gameCanvasGesture.pinchStartDistance;
      gameCanvasGesture.pinchStartZoom = getCameraZoom();
      gameCanvasGesture.pinchAnchorWorldX = anchor.worldX;
      gameCanvasGesture.pinchAnchorWorldY = anchor.worldY;
      gameCanvasGesture.pinchCenterCanvasX = anchor.canvasX;
      gameCanvasGesture.pinchCenterCanvasY = anchor.canvasY;
      setCameraZoomTarget(getCameraZoom());
    }

    function updateGameCanvasPinchGesture() {
      if (gameCanvasGesture.mode !== 'pinch') return;
      const pointers = Array.from(gameCanvasGesture.pointers.values());
      if (pointers.length < 2) return;
      const [first, second] = pointers;
      const distance = Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY));
      const nextCenterCanvasX = (first.canvasX + second.canvasX) * 0.5;
      const nextCenterCanvasY = (first.canvasY + second.canvasY) * 0.5;
      const pinchFilter = 0.34;
      gameCanvasGesture.pinchFilteredDistance += (distance - gameCanvasGesture.pinchFilteredDistance) * pinchFilter;
      gameCanvasGesture.pinchCenterCanvasX += (nextCenterCanvasX - gameCanvasGesture.pinchCenterCanvasX) * pinchFilter;
      gameCanvasGesture.pinchCenterCanvasY += (nextCenterCanvasY - gameCanvasGesture.pinchCenterCanvasY) * pinchFilter;
      setCameraZoomTarget(getCameraZoomClamped(
        gameCanvasGesture.pinchStartZoom * (gameCanvasGesture.pinchFilteredDistance / Math.max(1, gameCanvasGesture.pinchStartDistance))
      ));
    }

    function handleKeyDown(event) {
      if (!event) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        onPreventDirectionalFocus();
      }
      if (event.key === '1') onTogglePal();
      if (event.key === '2') onToggleHalftone();
      keys[event.key.toLowerCase()] = true;
      keys[event.key] = true;
      clearClickWalkState();
    }

    function handleKeyUp(event) {
      if (!event) return;
      keys[event.key.toLowerCase()] = false;
      keys[event.key] = false;
    }

    if (windowObject && typeof windowObject.addEventListener === 'function') {
      windowObject.addEventListener('keydown', handleKeyDown);
      windowObject.addEventListener('keyup', handleKeyUp);
    }

    if (canvas && typeof canvas.addEventListener === 'function') {
      if (hasPointerEvent) {
        canvas.addEventListener('pointerdown', (event) => {
          if (!getGameReady() || getIsReadingMode()) return;
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          if (event.target !== canvas && event.target.tagName !== 'CANVAS') return;
          const point = getCanvasPointFromClient(event.clientX, event.clientY);
          if (!point) return;
          if (typeof event.preventDefault === 'function') event.preventDefault();
          if (typeof canvas.setPointerCapture === 'function') {
            try {
              canvas.setPointerCapture(event.pointerId);
            } catch (_) {}
          }

          gameCanvasGesture.pointers.set(event.pointerId, {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            canvasX: point.canvasX,
            canvasY: point.canvasY
          });

          if (gameCanvasGesture.mode === 'blocked') return;
          if (gameCanvasGesture.pointers.size === 1 && gameCanvasGesture.mode === 'idle') {
            beginGameCanvasSinglePointerGesture(gameCanvasGesture.pointers.get(event.pointerId));
            return;
          }
          if (gameCanvasGesture.pointers.size >= 2) {
            if (gameCanvasGesture.mode === 'drag' && gameCanvasGesture.dragMoved) {
              gameCanvasGesture.mode = 'blocked';
              gameCanvasGesture.primaryPointerId = null;
              gameCanvasGesture.suppressTap = true;
              return;
            }
            beginGameCanvasPinchGesture();
          }
        });

        canvas.addEventListener('pointermove', (event) => {
          const pointer = gameCanvasGesture.pointers.get(event.pointerId);
          if (!pointer) return;
          const point = getCanvasPointFromClient(event.clientX, event.clientY);
          if (!point) return;

          pointer.clientX = event.clientX;
          pointer.clientY = event.clientY;
          pointer.canvasX = point.canvasX;
          pointer.canvasY = point.canvasY;

          if (!getGameReady() || getIsReadingMode()) return;
          if (typeof event.preventDefault === 'function') event.preventDefault();

          if (gameCanvasGesture.mode === 'pinch') {
            if (gameCanvasGesture.pointers.size >= 2) updateGameCanvasPinchGesture();
            return;
          }
          if (gameCanvasGesture.mode !== 'drag' && gameCanvasGesture.mode !== 'pending') return;
          if (event.pointerId !== gameCanvasGesture.primaryPointerId) return;

          const deltaX = pointer.canvasX - gameCanvasGesture.dragStartCanvasX;
          const deltaY = pointer.canvasY - gameCanvasGesture.dragStartCanvasY;
          const deltaClientX = pointer.clientX - (Number.isFinite(gameCanvasGesture.dragStartClientX)
            ? gameCanvasGesture.dragStartClientX
            : pointer.clientX);
          const deltaClientY = pointer.clientY - (Number.isFinite(gameCanvasGesture.dragStartClientY)
            ? gameCanvasGesture.dragStartClientY
            : pointer.clientY);

          if (gameCanvasGesture.mode === 'pending' && Math.hypot(deltaClientX, deltaClientY) >= dragThresholdPx) {
            gameCanvasGesture.mode = 'drag';
            gameCanvasGesture.dragMoved = true;
            gameCanvasGesture.suppressTap = true;
          }

          if (gameCanvasGesture.mode !== 'drag' || !gameCanvasGesture.dragMoved) return;
          setGameCameraPanFromDrag(deltaX, deltaY, gameCanvasGesture.dragBaseOffsetX, gameCanvasGesture.dragBaseOffsetY);
        });

        const endGameCanvasPointerGesture = (event, cancelled = false) => {
          const pointer = gameCanvasGesture.pointers.get(event.pointerId);
          if (!pointer) return;

          const hadSinglePointer = gameCanvasGesture.pointers.size === 1;
          const wasPrimary = event.pointerId === gameCanvasGesture.primaryPointerId;
          const gestureMode = gameCanvasGesture.mode;
          const wasDragGesture = gameCanvasGesture.dragMoved;
          const suppressTap = gameCanvasGesture.suppressTap;

          if (typeof canvas.releasePointerCapture === 'function') {
            try {
              canvas.releasePointerCapture(event.pointerId);
            } catch (_) {}
          }

          gameCanvasGesture.pointers.delete(event.pointerId);

          const canTreatAsTap = gestureMode === 'pending' || (gestureMode === 'drag' && !wasDragGesture);
          if (!cancelled && hadSinglePointer && wasPrimary && canTreatAsTap && !suppressTap) {
            handleClickMove(pointer.clientX, pointer.clientY);
          }

          if (gameCanvasGesture.pointers.size === 0) {
            resetGameCanvasGestureState();
            return;
          }

          if (gestureMode === 'pinch') {
            if (gameCanvasGesture.pointers.size >= 2) {
              beginGameCanvasPinchGesture();
              return;
            }
            gameCanvasGesture.mode = 'blocked';
            gameCanvasGesture.primaryPointerId = null;
            gameCanvasGesture.pinchActive = false;
            gameCanvasGesture.suppressTap = true;
            return;
          }

          gameCanvasGesture.mode = 'blocked';
          gameCanvasGesture.primaryPointerId = null;
          gameCanvasGesture.dragMoved = false;
          gameCanvasGesture.suppressTap = true;
        };

        canvas.addEventListener('pointerup', (event) => endGameCanvasPointerGesture(event, false));
        canvas.addEventListener('pointercancel', (event) => endGameCanvasPointerGesture(event, true));
      } else {
        let suppressCanvasClickUntil = 0;
        canvas.addEventListener('click', (event) => {
          if (event.target !== canvas && event.target.tagName !== 'CANVAS') return;
          if (performanceNow() < suppressCanvasClickUntil) return;
          handleClickMove(event.clientX, event.clientY);
        });
        canvas.addEventListener('touchstart', (event) => {
          if (event.target !== canvas && event.target.tagName !== 'CANVAS') return;
          if (typeof event.preventDefault === 'function') event.preventDefault();
          suppressCanvasClickUntil = performanceNow() + 420;
          if (event.touches && event.touches.length > 0) {
            handleClickMove(event.touches[0].clientX, event.touches[0].clientY);
          }
        }, { passive: false });
      }
    }

    return {
      handleKeyDown,
      handleKeyUp,
      getPlayerFootPosition,
      setPlayerFromFootPosition,
      generateNavGrid,
      isFootSolid,
      findNearestFreeFootPoint,
      findPathAStar,
      replanClickPathFromPlayer,
      handleClickMove,
      getNavState() {
        return navState;
      }
    };
  }

  globalObject.GameboyIndexNavigationRuntime = Object.freeze({
    init: initIndexNavigationRuntime,
    createMutableNavState
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
