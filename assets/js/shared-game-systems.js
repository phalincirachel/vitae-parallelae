/**
 * Shared Game Systems
 * Contains reusable classes for all chapters: Particle, Cloud, YellowLight
 * 
 * USAGE: Include this file AFTER the main game variables are defined.
 * <script src="assets/js/shared-game-systems.js"></script>
 * 
 * Required globals that must exist before including this file:
 * - mapW, mapH, SCREEN_W, SCREEN_H
 * - collisionData, flowData, greenPixels
 * - player, SPRITE
 * - particles (array), nearbyLights (array)
 * - getPlayerDrawCoords (function)
 * - isLoreMode, activeLightSourceId
 * - SCENE_NAME, GameState
 */

// ============================================
// YELLOW LIGHT (Lore Triggers)
// ============================================
class YellowLight {
    constructor(x, y, id) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.seed = Math.random() * 100;
        this.activeFactor = 0; // 0.0 bis 1.0 (Soft Transition Status)

        // Init State: Check if already collected on load
        this.vanished = false;
        if (window.GameState && window.GameState.isLightCollected(SCENE_NAME, this.id)) {
            this.vanished = true;
        }
        this.animPhase = 0; // 0=None, 1=Grow, 2=Shrink
        this.animScale = 1.0;
    }

    draw(ctx) {
        if (this.vanished) return;

        // FRUSTUM CULLING: Skip if light is outside camera viewport
        // Requires camX, camY, SCREEN_W, SCREEN_H to be global
        if (typeof camX !== 'undefined') {
            const margin = 50; // Radius + buffer for glow
            if (this.x + margin < camX || this.x - margin > camX + SCREEN_W ||
                this.y + margin < camY || this.y - margin > camY + SCREEN_H) {
                return; // Off-screen, skip drawing
            }
        }

        // Check for collection event (Start Animation)
        if (this.animPhase === 0 && window.GameState && window.GameState.isLightCollected(SCENE_NAME, this.id)) {
            this.animPhase = 1;
        }

        // ANIMATION UPDATE
        if (this.animPhase > 0) {
            // Grow Phase
            if (this.animPhase === 1) {
                this.animScale += 0.05; // speed
                if (this.animScale >= 1.5) { // Max scale
                    this.animPhase = 2;
                }
            }
            // Shrink Phase
            else if (this.animPhase === 2) {
                this.animScale -= 0.05;
                if (this.animScale <= 0) {
                    this.vanished = true;
                    return;
                }
            }
        }

        const time = Date.now() / 1000;
        const swayX = Math.sin(time + this.seed) * 1.5;
        const swayY = Math.cos(time * 1.2 + this.seed) * 1.5;
        const isActive = (isLoreMode && this.id === activeLightSourceId);

        // Smooth Animation für Zustandswechsel
        const targetFactor = isActive ? 1.0 : 0.0;
        this.activeFactor += (targetFactor - this.activeFactor) * 0.02;

        const currentBaseRadius = 10 + this.activeFactor * 15;
        const pulseAmp = 2 + this.activeFactor * 2; // Pulsieren

        // Calculate Radius with Animation Scale
        let radius = (currentBaseRadius + Math.sin(time * 3 + this.seed) * pulseAmp) * this.animScale;
        if (radius < 0) radius = 0;

        // Calculate Alpha
        let alpha = (0.7 + Math.sin(time * 2 + this.seed) * 0.2);
        if (this.animPhase === 2) alpha *= (this.animScale / 1.5); // Fade out during shrink

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const grad = ctx.createRadialGradient(this.x + swayX, this.y + swayY, 0, this.x + swayX, this.y + swayY, radius);

        grad.addColorStop(0, `rgba(255, 255, 240, ${alpha})`);
        grad.addColorStop(0.6, `rgba(255, 240, 100, ${alpha * 0.6})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x + swayX, this.y + swayY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ============================================
// CLOUD (Parallax Background)
// ============================================
// ============================================
// HELPER: iOS Detection
// ============================================
function isIOS() {
    return [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
    ].includes(navigator.platform) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

// ============================================
// CLOUD (Parallax Background)
// ============================================

let cloudSprite = null;
function createCloudSprite() {
    const size = 128;
    const half = size / 2;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    const grad = ctx.createRadialGradient(half, half, 10, half, half, half);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
}

class Cloud {
    constructor(startX, startY) {
        // WELT-Koordinaten - Wolken sind an der KARTE fixiert
        this.x = startX !== undefined ? startX : mapW + 100;
        this.y = startY !== undefined ? startY : Math.random() * mapH;
        this.speed = 0.15 + Math.random() * 0.1; // Langsame Drift über Karte
        this.size = 100 + Math.random() * 150;
        this.alpha = 0.5;

        // Debug Log only once per session/type load to avoid spam, but here acceptable on init
    }
    update() {
        this.x -= this.speed;
        // Wrap: links raus -> rechts wieder rein
        if (this.x < -this.size * 2) {
            this.x = mapW + this.size;
            this.y = Math.random() * mapH;
        }
    }
    draw(ctx, camX, camY) {
        // FRUSTUM CULLING: Skip if cloud is outside camera viewport
        const margin = this.size * 2;
        if (this.x + margin < camX || this.x - margin > camX + SCREEN_W ||
            this.y + margin < camY || this.y - margin > camY + SCREEN_H) {
            return; // Off-screen, skip drawing
        }

        // WELT-Koordinaten - ctx ist bereits mit Kamera translated
        // KEIN setTransform Reset! Dadurch bewegen sich Wolken mit Karte
        ctx.save();
        ctx.globalAlpha = this.alpha;

        if (isIOS()) {
            // iOS Optimization: Use Sprite instead of Blur Filter
            if (!cloudSprite) cloudSprite = createCloudSprite();

            // Draw the gradient sprite, scaled to this cloud's size
            // Sprite base size is 128. We want to draw it at this.size
            const scale = this.size / 128;

            // Center draw
            ctx.translate(this.x, this.y);
            ctx.scale(scale * 1.5, scale); // Make it elliptical via scale
            ctx.drawImage(cloudSprite, -64, -64); // -half size

        } else {
            // Desktop/Other: Use Blur Filter (Original Look)
            ctx.filter = 'blur(25px)';
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.size, this.size * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// ============================================
// PARTICLE (Floating White Lights)
// ============================================

// Helper function for glow sprite
function createGlowSprite() {
    const size = 64;
    const half = size / 2;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    const grad = ctx.createRadialGradient(half, half, 2, half, half, half);
    // Sehr subtiler Nebel
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    return c;
}

class Particle {
    constructor(startX, startY) {
        this.sizeMod = 0.5 + Math.random() * 1.5;
        this.resetVelocity();
        if (startX !== undefined && startY !== undefined) {
            this.x = startX;
            this.y = startY;
        } else {
            this.reset();
        }
    }

    resetVelocity() {
        // Etwas langsamer
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.2 + Math.random() * 0.4;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        this.life = Math.random();
        this.pulseSpeed = 0.01 + Math.random() * 0.02;
        this.maxLife = 0.5 + Math.random() * 0.5;
        this.onFlow = false;
    }

    resetTo(x, y) {
        this.x = x;
        this.y = y;
        // Store spawn point for rubber band effect
        this.spawnX = x;
        this.spawnY = y;
        this.resetVelocity();
    }

    reset() {
        if (greenPixels.length > 0) {
            // Versuche bis zu 10 mal eine gültige Position zu finden
            for (let attempt = 0; attempt < 10; attempt++) {
                const idx = Math.floor(Math.random() * greenPixels.length);
                const gp = greenPixels[idx];

                // Jitter NUR wenn kein Wall
                let testX = gp.x + (Math.random() - 0.5) * 8;
                let testY = gp.y + (Math.random() - 0.5) * 8;

                const ix = Math.floor(testX), iy = Math.floor(testY);

                // Prüfe ob Position NICHT in Wand ist
                if (ix >= 0 && ix < mapW && iy >= 0 && iy < mapH) {
                    if (!collisionData[iy][ix]) {
                        this.resetTo(testX, testY);
                        return;
                    }
                }
            }
            // Fallback: Exakt auf grünem Pixel (ohne Jitter)
            const gp = greenPixels[Math.floor(Math.random() * greenPixels.length)];
            this.resetTo(gp.x, gp.y);
        } else {
            this.x = Math.random() * mapW;
            this.y = Math.random() * mapH;
            // Store spawn point for rubber band effect
            this.spawnX = this.x;
            this.spawnY = this.y;
            this.resetVelocity();
        }
    }

    update(dt) {
        if (!dt) dt = 0.016; // Fallback to ~60 FPS
        // SOFORTIGER WALL-CHECK: Bin ich in/nahe einer Wand? -> Reset!
        const myX = Math.floor(this.x), myY = Math.floor(this.y);
        const wallCheckR = 2;
        let inWall = false;
        for (let cy = -wallCheckR; cy <= wallCheckR && !inWall; cy++) {
            for (let cx = -wallCheckR; cx <= wallCheckR && !inWall; cx++) {
                const checkX = myX + cx, checkY = myY + cy;
                if (checkX >= 0 && checkX < mapW && checkY >= 0 && checkY < mapH) {
                    if (collisionData[checkY][checkX]) {
                        inWall = true;
                    }
                }
            }
        }
        if (inWall) {
            this.reset();
            return;
        }

        // 1. Mehr Chaos & Torkeln (Abweichung) - DOUBLED
        this.vx += (Math.random() - 0.5) * 0.4;
        this.vy += (Math.random() - 0.5) * 0.4;

        // 2. Flow-Movement (Sanftes Schweben entlang der grünen Zonen)
        // Statt hartem "Zurückziehen" lassen wir sie driften.
        // Prüfe, ob wir "nah" an Grün sind (größerer Radius)
        let nearFlow = false;
        const lookAhead = 10; // Weit vorausschauen

        // Wir nutzen scanForFlow, aber nutzen das Ergebnis sanfter
        const flowDir = this.scanForFlow(20); // Suchradius erhöht

        if (flowDir) {
            // Wir sind in der Nähe von Grün -> Sanfter Drift in diese Richtung
            // Aber wir lassen viel Randomness zu (aus Schritt 1)
            this.vx += flowDir.x * 0.02; // SEHR sanfter Zug (war 0.08)
            this.vy += flowDir.y * 0.02;
            nearFlow = true;
        } else {
            // Weit weg von Grün davon schweben lassen
        }

        // ==========================================
        // NEU: MAGNETISCHE ANZIEHUNG (User Request)
        // ==========================================
        // Soll wirken wie ein Magnet an einer Schnur.
        // Schnur = Flow Logic (zieht zurück), Magnet = Player Logic (zieht hin).

        // Center on Player Sprite (approximation)
        const pCenterX = player.x + 8;
        const pCenterY = player.y + 10;

        const dx = pCenterX - this.x;
        const dy = pCenterY - this.y;
        const distToPlayer = Math.sqrt(dx * dx + dy * dy);
        const magnetRange = 200;

        if (distToPlayer < magnetRange) {
            // Quadratische Zunahme der Kraft: Je näher, desto stärker
            // 0 am Rand (200px), 1.0 bei 0px
            const urgency = Math.pow((magnetRange - distToPlayer) / magnetRange, 2);

            // Stärke des Magneten.
            // Muss gegen die Randomness (0.4) und Flow (0.02) ankommen, aber nicht teleportieren.
            const pullStrength = 1.0 * urgency;

            this.vx += (dx / distToPlayer) * pullStrength;
            this.vy += (dy / distToPlayer) * pullStrength;
        }
        // ==========================================

        // ==========================================
        // RUBBER BAND: Pull particle back to spawn point
        // ==========================================
        if (this.spawnX !== undefined && this.spawnY !== undefined) {
            const RUBBER_BAND_RANGE = 150; // Start pulling back after 150px
            const spawnDx = this.x - this.spawnX;
            const spawnDy = this.y - this.spawnY;
            const distToSpawn = Math.sqrt(spawnDx * spawnDx + spawnDy * spawnDy);

            if (distToSpawn > RUBBER_BAND_RANGE) {
                // Strong pull back to spawn, increasing with distance
                const returnStrength = 0.5 * ((distToSpawn - RUBBER_BAND_RANGE) / 100);
                this.vx -= (spawnDx / distToSpawn) * returnStrength;
                this.vy -= (spawnDy / distToSpawn) * returnStrength;
            }
        }
        // ==========================================

        // 3. Speed Limit calculation
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        // DYNAMIC MAX SPEED (User Request: PlayerSpeed - 20%)
        // Player speed is usually 35 (px/sec) in main logic.
        // But particles work on per-frame velocity mostly (vx, vy accumulated).
        // Let's approximate: 
        // Player moves 'amount = player.speed * dt' per frame.
        // Particle velocity here is effectively 'pixels per frame' in the update loop concept unless dt is applied to vx/vy?
        // Wait, vx/vy are added directly to x/y? No!
        // IN MAIN LOOP (index.html): updates particles via `p.update(dt)`.
        // BUT inside `update` here:
        // `resetVelocity` sets `vx` to ~0.4 (random).
        // `update` adds random chaos `0.4`.
        // AND THEN... where is position updated? 
        // MISSING IN THIS CLASS? No, it IS in this class (lines 229+).
        // `this.x = nextX`. 
        // WAIT. `nextX = this.x + this.vx`. It does NOT multiply by dt!
        // This implies `vx` IS pixels per frame (assuming 60fps).

        // So we need to convert player.speed (px/sec) to px/frame (approx 1/60).
        // player.speed = 35 px/sec -> ~0.58 px/frame at 60fps.
        // Requested: PlayerSpeed - 20% = PlayerSpeed * 0.8
        // Metric: 35 * 0.8 / 60 = ~0.466

        let maxSpeed = 0.375; // Default fallback
        if (typeof player !== 'undefined' && player.speed) {
            // Assume 60fps for conversation factor roughly
            const playerPerFrame = player.speed / 60;
            maxSpeed = playerPerFrame * 0.8; // 20% slower than player

            // LOGGING (Throttled via Math.random)
            if (Math.random() < 0.001) {
                console.log(`[DEBUG_SYS] WhiteLight MaxSpeed: Player=${player.speed}(${playerPerFrame.toFixed(3)}/f) -> Limit=${maxSpeed.toFixed(3)}`);
            }
        }

        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        // 3b. Kollision mit anderen Partikeln (Abstoßung)
        const collisionRadius = 8; // Größe wie Männchen-Kopf
        for (const other of particles) {
            if (other === this) continue;
            const pdx = this.x - other.x;
            const pdy = this.y - other.y;
            const distSq = pdx * pdx + pdy * pdy;
            const minDist = collisionRadius * 2;

            if (distSq < minDist * minDist && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const overlap = minDist - dist;
                // Normalisierte Richtung weg vom anderen
                const nx = pdx / dist;
                const ny = pdy / dist;
                // Abstoßung proportional zur Überlappung
                this.vx += nx * overlap * 0.1;
                this.vy += ny * overlap * 0.1;
            }
        }

        // 4. Kollision mit Wänden - DICKERE PRÜFUNG (3x3 Bereich)
        const nextX = this.x + this.vx;
        const nextY = this.y + this.vy;

        let hitWall = false;
        // Prüfe 3x3 Bereich um die nächste Position
        const checkRadius = 2;
        for (let checkY = -checkRadius; checkY <= checkRadius && !hitWall; checkY++) {
            for (let checkX = -checkRadius; checkX <= checkRadius && !hitWall; checkX++) {
                const ix = Math.floor(nextX + checkX);
                const iy = Math.floor(nextY + checkY);
                if (ix >= 0 && ix < mapW && iy >= 0 && iy < mapH) {
                    if (collisionData[iy][ix]) {
                        hitWall = true;
                    }
                }
            }
        }

        if (hitWall) {
            // Abprallen
            this.vx *= -0.5;
            this.vy *= -0.5;
            this.vx += (Math.random() - 0.5) * 0.3;
            this.vy += (Math.random() - 0.5) * 0.3;
        } else {
            this.x = nextX;
            this.y = nextY;
        }

        // 5. Spieler Beleuchtung - Sammle nur NAHE Lichtquellen
        if (typeof player !== 'undefined' && typeof getPlayerDrawCoords === 'function') {
            const refW = Math.floor(SPRITE.frameWidth * SPRITE.scale);
            const refH = Math.floor(SPRITE.frameHeight * SPRITE.scale);

            // Zentrum des gerenderten Sprites (Präzise Mitte der Bounding Box)
            const coords = getPlayerDrawCoords(player.x, player.y, player.dir, player.frame);
            const px = coords.x + coords.w / 2;
            const py = coords.y + coords.h / 2;

            const ddx = this.x - px;
            const ddy = this.y - py;
            const distSq = ddx * ddx + ddy * ddy;

            // Radius = ca 65px (4225 squared) für sehr großzügige Erfassung
            if (distSq < 4225) {
                const dist = Math.sqrt(distSq);
                nearbyLights.push({
                    x: this.x,
                    y: this.y,
                    dist: dist,
                    life: this.life
                });
            }
        }

        // Lifecycle (dt-based for FPS independence)
        this.life += this.pulseSpeed * dt * 60;  // Normalize to ~60 FPS base
        if (this.life > this.maxLife || this.life < 0.1) this.pulseSpeed *= -1;

        // Out of Bounds Reset
        if (this.x < -50 || this.x > mapW + 50 || this.y < -50 || this.y > mapH + 50) {
            this.reset();
        }
    }

    isOnFlow(x, y) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const r = 4;

        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const cx = ix + dx, cy = iy + dy;
                if (cx >= 0 && cx < mapW && cy >= 0 && cy < mapH) {
                    if (flowData[cy][cx]) return true;
                }
            }
        }
        return false;
    }

    scanForFlow() {
        const angles = [-0.5, 0.5, -1.0, 1.0, -1.5, 1.5];
        const currentAngle = Math.atan2(this.vy, this.vx);
        const scanDist = 10;

        for (let a of angles) {
            const checkAngle = currentAngle + a;
            const dx = Math.cos(checkAngle);
            const dy = Math.sin(checkAngle);
            const cx = this.x + dx * scanDist;
            const cy = this.y + dy * scanDist;

            if (this.isOnFlow(cx, cy)) {
                return { x: dx, y: dy };
            }
        }
        return null;
    }

    draw(ctx, camX, camY) {
        const drawSize = 64 * this.sizeMod;

        // Culling (Screen Check)
        const sx = this.x - camX;
        const sy = this.y - camY;

        if (sx < -drawSize || sx > SCREEN_W + drawSize || sy < -drawSize || sy > SCREEN_H + drawSize) return;

        const alpha = Math.max(0, Math.min(1, this.life));

        // Partikel-Schatten (sanft nach unten)
        ctx.globalAlpha = alpha * 0.12;
        ctx.drawImage(particleSprite,
            this.x - drawSize / 2 + 3,
            this.y - drawSize / 2 + drawSize * 0.35,
            drawSize, drawSize * 0.35);

        // Partikel selbst
        ctx.globalAlpha = alpha;
        ctx.drawImage(particleSprite, this.x - drawSize / 2, this.y - drawSize / 2, drawSize, drawSize);
        ctx.globalAlpha = 1.0;
    }
}

// ============================================
// INITIALIZATION HELPERS
// ============================================

function initClouds() {
    clouds.length = 0;
    if (mapW <= 0 || mapH <= 0) return;

    // Log Mode on Init
    console.log(`[DEBUG_SYS] Cloud System Init: Mode=${isIOS() ? 'IOS_GRADIENT' : 'DESKTOP_BLUR'}`);

    // Wolken verteilt über die Kartenfläche
    const numClouds = Math.max(3, Math.floor((mapW * mapH) / 150000));
    for (let i = 0; i < numClouds; i++) {
        const x = Math.random() * mapW;
        const y = Math.random() * mapH;
        clouds.push(new Cloud(x, y));
    }
    console.log("Clouds initialized:", clouds.length, "for map", mapW, "x", mapH);
}

function initParticles() {
    if (!particleSprite) particleSprite = createGlowSprite();

    particles.length = 0;
    if (greenPixels.length > 0) {
        for (let i = 0; i < 60; i++) { // User Request: 60 Particles
            // Versuche gültige Position zu finden
            let startX, startY;
            let found = false;

            for (let attempt = 0; attempt < 5; attempt++) {
                const idx = Math.floor(Math.random() * greenPixels.length);
                const gp = greenPixels[idx];

                startX = gp.x + (Math.random() - 0.5) * 8;
                startY = gp.y + (Math.random() - 0.5) * 8;

                const ix = Math.floor(startX), iy = Math.floor(startY);
                if (ix >= 0 && ix < mapW && iy >= 0 && iy < mapH) {
                    if (!collisionData[iy][ix]) {
                        found = true;
                        break;
                    }
                }
            }

            // Fallback: Exakt auf grünem Pixel
            if (!found) {
                const gp = greenPixels[Math.floor(Math.random() * greenPixels.length)];
                startX = gp.x;
                startY = gp.y;
            }

            particles.push(new Particle(startX, startY));
        }
    } else {
        for (let i = 0; i < 60; i++) particles.push(new Particle()); // User Request: 60 Particles
    }
}

// Export to window for global access
window.YellowLight = YellowLight;
window.Cloud = Cloud;
window.Particle = Particle;
window.createGlowSprite = createGlowSprite;
window.initClouds = initClouds;
window.initParticles = initParticles;
window.isIOS = isIOS; // Export for iOS-specific fixes

console.log("[shared-game-systems.js] Classes loaded: YellowLight, Cloud, Particle, isIOS");
