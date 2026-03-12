(function initLiminalHallwayRuntime(globalObject) {
  function initLiminalHallwayRuntime(options = {}) {
    const root = options.root || globalObject;
    const window = options.window || root.window || root;
    const document = options.document || root.document || null;
    const THREE = options.THREE || root.THREE || null;
    const scene = options.scene || null;
    const config = options.config || {};
    const isIOSSafari = !!options.isIOSSafari;
    const SCAudioAdapter = options.SCAudioAdapter || root.SCAudioAdapter || null;
    const getSCUrl = typeof options.getSCUrl === 'function' ? options.getSCUrl : () => '';
    const getReaderBackgroundVolume = typeof options.getReaderBackgroundVolume === 'function' ? options.getReaderBackgroundVolume : () => 1;
    const liminalDebugNote = typeof options.liminalDebugNote === 'function' ? options.liminalDebugNote : () => {};
    const CURRENT_SCENE_NAME = typeof options.currentSceneName === 'string' && options.currentSceneName ? options.currentSceneName : 'liminal_library';
    const LORE_PROGRESS_DEFAULT_TOTAL = Number.isFinite(options.loreProgressDefaultTotal) ? options.loreProgressDefaultTotal : 8;
    const LIMINAL_CORRIDOR_DEBUG_LOGS = !!options.debugLogs;
    const requestAnimationFrame = typeof options.requestAnimationFrame === 'function'
      ? options.requestAnimationFrame
      : (callback) => window.requestAnimationFrame(callback);
    const cancelAnimationFrame = typeof options.cancelAnimationFrame === 'function'
      ? options.cancelAnimationFrame
      : (handle) => window.cancelAnimationFrame(handle);
    const getHasStartedGame = typeof options.getHasStartedGame === 'function' ? options.getHasStartedGame : () => false;
    const getContentSwitchInProgress = typeof options.getContentSwitchInProgress === 'function' ? options.getContentSwitchInProgress : () => false;

// --- TEXTURES & MATERIALS ---
function createWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 100; i++) {
        ctx.strokeStyle = `rgba(0,0,0, ${Math.random() * 0.2})`; ctx.lineWidth = Math.random() * 3;
        ctx.beginPath(); ctx.moveTo(Math.random() * 512, 0); ctx.lineTo(Math.random() * 512, 512); ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
}
function createCarpetTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 512, 512);
    const imgData = ctx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < imgData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 15; imgData.data[i] += noise + 10;
        imgData.data[i + 1] += noise + 10; imgData.data[i + 2] += noise + 10;
    }
    ctx.putImageData(imgData, 0, 0);
    const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 10); return t;
}
let woodMaterial, floorMaterial, wallMaterial, bookMat, bulbMat, cordMat;
let sharedPlaneGeo, sharedShelfGeo, sharedPlankGeo, sharedBookGeo, sharedBulbGeo, sharedCordGeo, sharedGlowBookGeo;
let sharedShelfGeoLeft, sharedShelfGeoRight;
let sharedPlankGeoLeft, sharedPlankGeoRight;
let tmpLookDir, tmpMovementInput, tmpForwardDir, tmpRightDir, tmpMoveDir, tmpVelocityStep;

if (!window.fallback2DMode && THREE) {
    woodMaterial = new THREE.MeshStandardMaterial({ map: createWoodTexture(), roughness: 0.8, color: 0x5c4033 });
    floorMaterial = new THREE.MeshStandardMaterial({ map: createCarpetTexture(), roughness: 0.9, metalness: 0.1 });
    wallMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    bookMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 });
    bulbMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    cordMat = new THREE.MeshBasicMaterial({ color: 0x111 });

    // variables declared in outer scope

    // --- SHARED GEOMETRIES (Performance Fix) ---
    sharedPlaneGeo = new THREE.PlaneGeometry(config.roomWidth, config.segmentLength);

    sharedShelfGeoLeft = new THREE.BoxGeometry(config.shelfDepth, config.roomHeight, config.segmentLength);
    sharedShelfGeoRight = new THREE.BoxGeometry(config.shelfDepth, config.roomHeight, config.segmentLength);

    sharedPlankGeoLeft = new THREE.BoxGeometry(1.2, 0.05, config.segmentLength);
    sharedPlankGeoRight = new THREE.BoxGeometry(1.2, 0.05, config.segmentLength);

    // --- EXPLICIT SHELF CULLING (Keep ONLY inward-facing wall) ---
    try {
        const idxL = sharedShelfGeoLeft.index.array;
        const newL = [];
        for (let i = 0; i < 6; i++) newL.push(idxL[i]); // Keep +X (Right) face for Left Wall
        sharedShelfGeoLeft.setIndex(newL); sharedShelfGeoLeft.clearGroups();

        const idxR = sharedShelfGeoRight.index.array;
        const newR = [];
        for (let i = 6; i < 12; i++) newR.push(idxR[i]); // Keep -X (Left) face for Right Wall
        sharedShelfGeoRight.setIndex(newR); sharedShelfGeoRight.clearGroups();
    } catch (e) { }

    // --- EXPLICIT PLANK CULLING (Keep Front Edge, Top, Bottom) ---
    try {
        const idxPL = sharedPlankGeoLeft.index.array;
        const newPL = [];
        for (let i = 0; i < 6; i++) newPL.push(idxPL[i]);   // Keep +X (Right edge) 
        for (let i = 12; i < 24; i++) newPL.push(idxPL[i]); // Keep +Y (Top), -Y (Bottom)
        sharedPlankGeoLeft.setIndex(newPL); sharedPlankGeoLeft.clearGroups();

        const idxPR = sharedPlankGeoRight.index.array;
        const newPR = [];
        for (let i = 6; i < 12; i++) newPR.push(idxPR[i]);  // Keep -X (Left edge)
        for (let i = 12; i < 24; i++) newPR.push(idxPR[i]); // Keep +Y (Top), -Y (Bottom)
        sharedPlankGeoRight.setIndex(newPR); sharedPlankGeoRight.clearGroups();
    } catch (e) { }

    sharedBookGeo = new THREE.BoxGeometry(1, 1, 1);

    // --- GLOBAL BOOK GEOMETRY REDUCTION (6 faces -> 2 faces) ---
    // By keeping only the spine (+X, indices 0-5) and the front cover (+Z, indices 24-29)
    // we save 66% of geometry rendering overhead per book for ALL devices.
    try {
        const oldIdx = sharedBookGeo.index.array;
        const newIdx = [];
        for (let i = 0; i < 6; i++) newIdx.push(oldIdx[i]);
        for (let i = 24; i < 30; i++) newIdx.push(oldIdx[i]);
        sharedBookGeo.setIndex(newIdx);
        sharedBookGeo.clearGroups();
    } catch (e) {
        console.warn("Global book geometry reduction failed:", e);
    }

    sharedBulbGeo = new THREE.SphereGeometry(0.1, 16, 16);
    sharedCordGeo = new THREE.CylinderGeometry(0.01, 0.01, 3);
    sharedGlowBookGeo = new THREE.BoxGeometry(0.6, 0.5, 0.08);

    tmpLookDir = new THREE.Vector3();
    tmpMovementInput = new THREE.Vector3();
    tmpForwardDir = new THREE.Vector3();
    tmpRightDir = new THREE.Vector3();
    tmpMoveDir = new THREE.Vector3();
    tmpVelocityStep = new THREE.Vector3();
}

// --- CLASSES ---
class YellowLight {
    constructor(zPos) {
        this.position = new THREE.Vector3(0, 3.5, zPos);
        this.worldPos = new THREE.Vector3();
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        const bulb = new THREE.Mesh(sharedBulbGeo, bulbMat);
        this.group.add(bulb);
        this.light = new THREE.PointLight(0xffaa00, 40, 15);
        this.light.castShadow = !isIOSSafari; // Disable on iOS
        this.group.add(this.light);
        const cord = new THREE.Mesh(sharedCordGeo, cordMat);
        cord.position.y = 1.5;
        this.group.add(cord);
        this.baseIntensity = 40;
        this.seed = Math.random() * 100;
    }
    update(time, playerZ) {
        const flicker = Math.sin(time * 20) * 0.05 + Math.random() * 0.1;

        // Distance Fade Logic
        // FIX: Use World Position for distance check
        this.group.getWorldPosition(this.worldPos);
        const dist = Math.abs(this.worldPos.z - playerZ);

        const fadeStart = 40; // Starts fading in at 40m
        const fadeEnd = 20;   // Full brightness at 20m

        // Normalized Fade: 0 at fadeStart, 1 at fadeEnd
        // Clamp between 0 and 1
        let fade = (fadeStart - dist) / (fadeStart - fadeEnd);
        fade = Math.max(0, Math.min(1, fade));

        // Apply Fade to Intensity
        // If fade is 0 (far away), light is OFF.
        // If fade is 1 (close), light is FULL.
        const currentBase = this.baseIntensity * fade;

        this.light.intensity = currentBase + flicker * 10 * fade; // Flicker scales with intensity
        this.light.distance = 15 * fade; // Also scale range to avoid pop-in

        this.group.rotation.x = Math.cos(time * 0.3 + this.seed) * 0.03;
        this.group.rotation.z = Math.sin(time * 0.5 + this.seed) * 0.03;
    }
    reset() {
        // FIX: Do NOT update position. Parent Group move handles it.
        // Just reset intensity logic states if needed.
        this.light.intensity = 0; // Start off
    }
    dispose() {
        // Shared geometries/materials stay alive globally; only detach this light group.
        if (this.group.parent) {
            this.group.parent.remove(this.group);
        }
    }
}

// --- GLOWING LORE BOOK STATE ---
// Spawn logic uses current chapter progress from GameState.
let glowingBookCounter = 0;       // ID generator
const activeGlowingBooks = [];    // Currently spawned books
const SHIMMER_BASE_VOLUME = 0.4;
const shimmerSound = SCAudioAdapter ? new SCAudioAdapter('sc-widget-shimmer') : { volume: 0, pause() {}, play() { return Promise.resolve(); }, paused: true, src: '', audio: null };
shimmerSound.src = getSCUrl('assets/shimmer.mp3');
shimmerSound.volume = SHIMMER_BASE_VOLUME * getReaderBackgroundVolume();
let lastShimmerAt = 0;
// One-shot SFX should not auto-resume after visibility changes.
if (window.AudioVisibilityManager && typeof window.AudioVisibilityManager.unregister === 'function') {
    window.AudioVisibilityManager.unregister(shimmerSound);
}

function applyBackgroundSfxVolume(reason = 'unspecified') {
    shimmerSound.volume = Math.max(0, Math.min(1, SHIMMER_BASE_VOLUME * getReaderBackgroundVolume()));
    liminalDebugNote('bg-sfx', `${reason} shimmer=${shimmerSound.volume.toFixed(3)}`);
}
applyBackgroundSfxVolume('init');

function allowAuxSfxPlaybackLiminal() {
    const p = window.audioPlayer;
    if (!p || !p.audio) return true;
    const primaryPlaying = (typeof p.audio.isProbablyPlaying === 'function')
        ? p.audio.isProbablyPlaying()
        : !p.paused;
    return !primaryPlaying && !getContentSwitchInProgress() && !document.hidden;
}

function getCurrentChapterProgress() {
    if (window.GameState && typeof window.GameState.getChapterProgress === 'function') {
        return window.GameState.getChapterProgress(CURRENT_SCENE_NAME);
    }
    return { collected: 0, total: LORE_PROGRESS_DEFAULT_TOTAL };
}

// Material for glowing books
const glowBookMaterial = THREE ? new THREE.MeshStandardMaterial({
    color: 0xf5c542,
    emissive: 0xf5c542,
    emissiveIntensity: 0.5,
    roughness: 0.8,
    metalness: 0.1
}) : null;

class GlowingBook {
    constructor(zPos, side) {
        this.id = glowingBookCounter++;
        this.collected = false;
        this.missed = false; // NEW: Track if player walked past without collecting
        this.side = side; // 'left' or 'right'
        this.worldPos = new THREE.Vector3();

        // Reuse shared geometry; only the material instance is per-book.
        this.mesh = new THREE.Mesh(sharedGlowBookGeo, glowBookMaterial.clone());

        // Position: eye level (camera at 1.6m), slightly higher for visibility
        // X offset: just 5cm (0.05m) towards center so book pops out slightly
        // Y = 1.68 (1.4 shelf + 0.025 halfPlank + 0.25 halfBook + 0.005 margin)
        const xPos = side === 'left' ? -2.45 : 2.45;
        this.mesh.position.set(xPos, 1.68, zPos);
        this.mesh.frustumCulled = false;

        this.baseEmissive = 0.5;
    }

    update(time, playerZ, playerX) {
        if (this.collected) return;

        // FIX: Use world position (meshGroup may have moved)
        this.mesh.getWorldPosition(this.worldPos);
        const distZ = Math.abs(this.worldPos.z - playerZ);
        const distX = Math.abs(this.worldPos.x - playerX);

        // Debug: log position every 60 frames
        if (LIMINAL_CORRIDOR_DEBUG_LOGS && Math.random() < 0.016) { // ~1 per second at 60fps
            console.log(`Book ${this.id}: worldZ=${this.worldPos.z.toFixed(1)}, playerZ=${playerZ.toFixed(1)}, dist=${distZ.toFixed(1)}`);
        }

        // Proximity glow intensification
        if (distZ < 8 && distX < 3) {
            const pulse = Math.sin(time * 3) * 0.15;
            this.mesh.material.emissiveIntensity = 0.8 + pulse;
        } else {
            this.mesh.material.emissiveIntensity = this.baseEmissive;
        }
    }

    collect() {
        if (this.collected) return;
        this.collected = true;
        this.mesh.visible = false;
    }

    reset(newZ, newSide) {
        // For pooling: reposition and reset state
        this.collected = false;
        this.mesh.visible = true;
        this.side = newSide;
        const xPos = newSide === 'left' ? -2.5 : 2.5;
        this.mesh.position.set(xPos, 1.5, newZ);
        this.mesh.material.emissiveIntensity = this.baseEmissive;
    }

    dispose() {
        if (this.mesh && this.mesh.material && this.mesh.material !== glowBookMaterial) {
            this.mesh.material.dispose();
        }
    }
}

class HallwaySegment {
    constructor(zStart, length, isPreload = false, onReady = null) {
        this.zStart = zStart;
        this.originalZStart = zStart; // Store for consistent local positioning
        this.length = length;
        this.isPreload = !!isPreload;
        this.meshGroup = new THREE.Group();
        this.lights = [];

        // 1. Floor & Ceiling
        // Use Shared Geometries!
        const floor = new THREE.Mesh(sharedPlaneGeo, floorMaterial);
        floor.rotation.x = -Math.PI / 2; floor.position.z = zStart - length / 2; floor.receiveShadow = !isIOSSafari;
        floor.frustumCulled = false; // FIX: Prevent Abyss
        this.meshGroup.add(floor);

        const ceiling = new THREE.Mesh(sharedPlaneGeo, wallMaterial);
        ceiling.rotation.x = Math.PI / 2; ceiling.position.y = config.roomHeight; ceiling.position.z = zStart - length / 2;
        ceiling.frustumCulled = false; // FIX: Prevent Abyss
        this.meshGroup.add(ceiling);

        // 2. Shelves
        const leftShelf = new THREE.Mesh(sharedShelfGeoLeft, woodMaterial);
        leftShelf.position.set(-3.2, config.roomHeight / 2, zStart - length / 2); leftShelf.castShadow = !isIOSSafari; leftShelf.receiveShadow = !isIOSSafari;
        leftShelf.frustumCulled = false; // FIX: Prevent Abyss
        this.meshGroup.add(leftShelf);

        const rightShelf = new THREE.Mesh(sharedShelfGeoRight, woodMaterial);
        rightShelf.position.set(3.2, config.roomHeight / 2, zStart - length / 2); rightShelf.castShadow = !isIOSSafari; rightShelf.receiveShadow = !isIOSSafari;
        rightShelf.frustumCulled = false; // FIX: Prevent Abyss
        this.meshGroup.add(rightShelf);

        // 3. Plank Levels
        const levels = 9;
        for (let i = 0; i < levels; i++) {
            const y = (config.roomHeight / levels) * i + 0.4;

            const pLeft = new THREE.Mesh(sharedPlankGeoLeft, woodMaterial);
            pLeft.position.set(-2.6, y, zStart - length / 2);
            pLeft.castShadow = !isIOSSafari; pLeft.receiveShadow = !isIOSSafari; // FIX: BLOCK LIGHT (Disable on iOS)
            this.meshGroup.add(pLeft);

            const pRight = new THREE.Mesh(sharedPlankGeoRight, woodMaterial);
            pRight.position.set(2.6, y, zStart - length / 2);
            pRight.castShadow = !isIOSSafari; pRight.receiveShadow = !isIOSSafari; // FIX: BLOCK LIGHT (Disable on iOS)
            this.meshGroup.add(pRight);
        }

        // 4. Books (InstancedMesh)
        this.createBooks(zStart, length, levels, isPreload, onReady);

        // 5. Light (One per segment)
        const light = new YellowLight(zStart - length / 2);
        this.lights.push(light);
        this.meshGroup.add(light.group);

        // 6. Dust (Segment-Local)
        this.createDust(length);

        scene.add(this.meshGroup);
    }

    createDust(length) {
        // ~80 particles per segment (approx half global density distributed)
        const count = isIOSSafari ? 30 : 80;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        this.dustSpeeds = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            // Local positions relative to segment center (0,0,0 is at floor, zStart-length/2)
            // But WAIT: meshGroup origin is (0,0,0). 
            // Floor is at zStart - length/2. 
            // Let's check meshGroup structure again.
            // Elements are added at Absolute World Coords? No.
            // floor.position.z = zStart - length / 2;
            // Yes, children have 'absolute' coords relative to a (0,0,0) group.

            // So Dust must be placed within [zStart - length, zStart]
            const z = this.zStart - Math.random() * length;
            const x = (Math.random() - 0.5) * (config.roomWidth - 1); // Stay inside walls
            const y = Math.random() * config.roomHeight;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            this.dustSpeeds[i] = 0.05 + Math.random() * 0.1;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Re-create texture here or reuse? Reuse is better but for safety defining inline or global helper.
        // Defining simple canvas texture helper:
        if (!window.dustTex) {
            const c = document.createElement('canvas'); c.width = 32; c.height = 32;
            const ctx = c.getContext('2d');
            const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
            window.dustTex = new THREE.CanvasTexture(c);
        }

        const mat = new THREE.PointsMaterial({
            color: 0xaaaaaa, size: 0.05, map: window.dustTex,
            transparent: true, opacity: 0.3,
            depthWrite: false, blending: THREE.AdditiveBlending
        });

        this.dustMesh = new THREE.Points(geo, mat);
        this.dustMesh.frustumCulled = false;
        this.meshGroup.add(this.dustMesh);
    }

    update(delta, time, playerPos) {
        // Update Lights
        this.lights.forEach(l => l.update(time, playerPos.z)); // Pass playerZ for light fade

        // Update Dust
        if (this.dustMesh) {
            const pos = this.dustMesh.geometry.attributes.position.array;
            for (let i = 0; i < pos.length / 3; i++) {
                pos[i * 3 + 1] -= this.dustSpeeds[i] * delta * 2.0; // Fall speed
                if (pos[i * 3 + 1] < 0) {
                    pos[i * 3 + 1] = config.roomHeight;
                }
            }
            this.dustMesh.geometry.attributes.position.needsUpdate = true;
        }
    }

    createBooks(zStart, length, levels) {
        this.glowingBook = null;
        const segmentIndex = Math.abs(Math.round(zStart / length));
        // Count uncollected active books
        const uncollectedBooks = activeGlowingBooks.filter(b => !b.collected && !b.missed).length;
        const chapterProgress = getCurrentChapterProgress();
        if (segmentIndex % 5 === 0 && segmentIndex > 0 && chapterProgress.collected < chapterProgress.total && uncollectedBooks < 1) {
            const side = Math.random() > 0.5 ? 'left' : 'right';
            this.glowingBook = new GlowingBook(zStart - length / 2, side);
            this.meshGroup.add(this.glowingBook.mesh);
            activeGlowingBooks.push(this.glowingBook);
        }
    }

    reset(newZStart) {
        // FIX: Calculate offset BEFORE updating this.zStart
        const currentZStart = this.zStart; // This tracks where it currently is logically
        const offset = newZStart - currentZStart;

        this.zStart = newZStart;

        // Move everything by offset
        this.meshGroup.position.z += offset;

        // Reset Lights
        // FIX: Do NOT pass newZ. Light position is relative and static.
        this.lights.forEach(l => l.reset());

        // Reset Books
        this.resetBooks();

        // Handle Glowing Book for recycled segment
        // Remove old book if it was collected or missed
        if (this.glowingBook && (this.glowingBook.collected || this.glowingBook.missed)) {
            // Remove from active list
            const idx = activeGlowingBooks.indexOf(this.glowingBook);
            if (idx > -1) activeGlowingBooks.splice(idx, 1);
            // Remove mesh
            this.meshGroup.remove(this.glowingBook.mesh);
            this.glowingBook.dispose();
            this.glowingBook = null;
        }

        // Try to spawn a new glowing book (same logic as constructor)
        const chapterProgress = getCurrentChapterProgress();
        if (!this.glowingBook && chapterProgress.collected < chapterProgress.total) {
            const segmentIndex = Math.abs(Math.round(newZStart / this.length));
            const uncollectedBooks = activeGlowingBooks.filter(b => !b.collected && !b.missed).length;
            if (segmentIndex % 5 === 0 && segmentIndex > 0 && uncollectedBooks < 1) {
                const side = Math.random() > 0.5 ? 'left' : 'right';
                // FIX: Use ORIGINAL constructor zStart for local coordinates
                // This matches how floor, shelves, and other segment objects are positioned
                const localZ = this.originalZStart - this.length / 2;
                this.glowingBook = new GlowingBook(localZ, side);
                this.meshGroup.add(this.glowingBook.mesh);
                // Force matrix update so getWorldPosition works immediately
                this.glowingBook.mesh.updateMatrixWorld(true);
                activeGlowingBooks.push(this.glowingBook);

                if (LIMINAL_CORRIDOR_DEBUG_LOGS) {
                    this.glowingBook.mesh.getWorldPosition(this.glowingBook.worldPos);
                    console.log(`Spawned book: local=(${localZ}), world=(${this.glowingBook.worldPos.z.toFixed(1)}), target=(${(newZStart - this.length / 2).toFixed(1)})`);
                }
            }
        }

        // force update
        this.meshGroup.updateMatrixWorld(true);
    }

    createBooks(zStart, length, levels, isPreload, onReady) {
        // User requested to NOT reduce book count, but instead reduce geometry faces (applied to sharedBookGeo)
        const bookCount = 6000;
        // SAVE REFERENCES for Reset
        this.bookCount = bookCount;
        this.isPreload = !!isPreload;
        if (!this.meshBooks) {
            this.meshBooks = new THREE.InstancedMesh(sharedBookGeo, bookMat, bookCount);
            this.meshBooks.castShadow = true; this.meshBooks.receiveShadow = true;
            this.meshBooks.frustumCulled = false; // FIX: Prevent invisible books
            this.meshGroup.add(this.meshBooks);
        }
        this.meshBooks.count = 0; // Hide all initially

        this.resetBooks = () => {
            // Correct Z of InstancedMesh?
            // It is child of meshGroup. If Group moves, it moves.
            // But book positions are calculated in LOCAL space or WORLD space?
            // in `processBatch`: dummy.position.set(..., currentZ)
            // currentZ starts at zStart. 
            // If meshGroup moved, currentZ (local) should validly be relative?
            // Wait. In constructor: `floor.position.z = zStart - length/2`.
            // If `meshGroup` is at (0,0,0) initially.
            // Objects are at world Z.
            // If we now move meshGroup.position.z by -50.
            // Objects move -50. 
            // So Reset Logic:
            // 1. Move MeshGroup.
            // 2. Generate books using RELATIVE coords?
            // Currently logic uses `zStart` (Absolute).
            // This is improper for grouping.
            // BUT converting to relative is risky big refactor.

            // Alternative:
            // Just update `zStart` in this closure?
            // New generator run.
            if (typeof this.pauseBookGeneration === 'function') {
                this.pauseBookGeneration();
            }
            this.meshBooks.count = 0;
            this.startBookGeneration();
        };

        // We need to allow restarting generation.
        this.startBookGeneration = () => {
            this.bookBuildVersion = (this.bookBuildVersion || 0) + 1;
            const buildVersion = this.bookBuildVersion;
            const dummy = new THREE.Object3D();
            const color = new THREE.Color();
            const bookColors = [0x4a3c31, 0x2f1e15, 0x6e2c2c, 0x1a2e1f, 0x0d0d0d, 0x5c5040];

            // Calculate Z range relative to GROUP position?
            // The group has moved to `newZStart`.
            // Objects inside are defined at `oldZStart`.
            // Moving group shifts them to `newZStart`.
            // So we should generate books at `oldZStart` coordinates? 
            // Yes. If we use `zStart` (original) it works.

            let globalIndex = 0;
            const workQueue = [];
            this.bookBuildRaf = null;
            this.bookBuildPaused = false;
            // Use 'local' start (original zStart) 
            // because Group translation handles current World Pos.
            const localZStart = zStart;

            // 1. Prepare Queue
            for (let side of [-1, 1]) {
                const shelfX = side * 2.6;
                for (let i = 0; i < levels; i++) {
                    workQueue.push({ side, shelfX, levelIndex: i });
                }
            }

            this.pauseBookGeneration = () => {
                this.bookBuildPaused = true;
                if (this.bookBuildRaf !== null) {
                    cancelAnimationFrame(this.bookBuildRaf);
                    this.bookBuildRaf = null;
                }
            };

            this.resumeBookGeneration = () => {
                if (!this.bookBuildPaused) return;
                this.bookBuildPaused = false;
                if (workQueue.length === 0 || globalIndex >= this.bookCount) return;
                if (this.bookBuildRaf === null) {
                    this.bookBuildRaf = requestAnimationFrame(processBatch);
                }
            };

            const processBatch = () => {
                if (buildVersion !== this.bookBuildVersion) {
                    this.bookBuildRaf = null;
                    return;
                }

                // Keep preload alive even if coming from another page with freeze enabled.
                const freezeBypassDuringBoot = this.isPreload && !getHasStartedGame();
                const shouldPauseForFreeze = window.visualFreezeActive && !freezeBypassDuringBoot;
                if (this.bookBuildPaused || shouldPauseForFreeze) {
                    this.bookBuildPaused = true;
                    this.bookBuildRaf = null;
                    return;
                }

                // Version guard above prevents stale generators from continuing after reset.
                if (workQueue.length === 0 || globalIndex >= this.bookCount) {
                    this.bookBuildPaused = false;
                    this.bookBuildRaf = null;
                    if (onReady) {
                        onReady();
                        onReady = null; // Prevent re-triggering during Recycle/Reset!
                    }
                    return;
                }
                // ... (Same logic)
                const batchSize = isPreload ? 60 : 5;
                for (let b = 0; b < batchSize; b++) {
                    if (workQueue.length === 0) break;
                    const task = workQueue.shift();
                    if (task.levelIndex >= 6) continue;
                    const y = (config.roomHeight / levels) * task.levelIndex + 0.7;
                    if (y > config.roomHeight - 0.5) continue;

                    let currentZ = localZStart;
                    const endZ = localZStart - length;

                    while (currentZ > endZ) {
                        if (globalIndex >= this.bookCount) break;
                        // ... Generation ...
                        const height = 0.5 + Math.random() * 0.3;
                        const thick = 0.05 + Math.random() * 0.08;
                        const depth = 0.7 + Math.random() * 0.15;
                        const gap = 0.03;

                        if (Math.random() > 0.02) {
                            const xOffset = (Math.random() - 0.5) * 0.1;
                            // Coordinates are "Local" (relative to original zStart)
                            dummy.position.set(task.shelfX + xOffset, y - 0.3 + height / 2, currentZ - thick / 2);
                            dummy.scale.set(depth, height, thick);
                            dummy.rotation.set(0, 0, 0);
                            let zRot = 0;
                            if (task.side === 1) {
                                // Rotate 180 deg around Z:
                                // Spine (+X) flips to (-X) facing the shelf center.
                                // Cover (+Z) stays (+Z) facing the player.
                                zRot = Math.PI;
                            }
                            dummy.rotation.z = zRot + (Math.random() - 0.5) * 0.08;
                            dummy.rotation.y += (Math.random() - 0.5) * 0.08;
                            dummy.updateMatrix();
                            this.meshBooks.setMatrixAt(globalIndex, dummy.matrix);

                            // Color
                            color.setHex(bookColors[Math.floor(Math.random() * bookColors.length)]);
                            color.r += (Math.random() - 0.5) * 0.1;
                            // ...
                            this.meshBooks.setColorAt(globalIndex, color);
                            globalIndex++;
                            currentZ -= (thick + gap);
                        } else {
                            currentZ -= (0.05 + Math.random() * 0.15);
                        }
                    }
                }
                this.meshBooks.count = globalIndex;
                this.meshBooks.instanceMatrix.needsUpdate = true;
                if (this.meshBooks.instanceColor) this.meshBooks.instanceColor.needsUpdate = true;
                if (buildVersion === this.bookBuildVersion) {
                    this.bookBuildRaf = requestAnimationFrame(processBatch);
                } else {
                    this.bookBuildRaf = null;
                }
            };
            processBatch();
        };

        this.startBookGeneration();
    }

    dispose() {
        if (typeof this.pauseBookGeneration === 'function') {
            this.pauseBookGeneration();
        }

        // 1. Dispose Lights
        this.lights.forEach(l => l.dispose());

        if (this.glowingBook) {
            const idx = activeGlowingBooks.indexOf(this.glowingBook);
            if (idx > -1) activeGlowingBooks.splice(idx, 1);
            this.meshGroup.remove(this.glowingBook.mesh);
            this.glowingBook.dispose();
            this.glowingBook = null;
        }

        if (this.dustMesh) {
            this.meshGroup.remove(this.dustMesh);
            this.dustMesh.geometry.dispose();
            this.dustMesh.material.dispose();
            this.dustMesh = null;
        }

        // 2. Dispose Geometries
        // FIX: DO NOT DISPOSE SHARED GEOMETRIES.

        // 3. Remove from Scene
        scene.remove(this.meshGroup);
    }
}

// --- GAME LOOP ---
const segments = [];
// const segmentPool = []; // REMOVED: Proper recycling uses the active list directly
const segmentLength = config.segmentLength;
// IMPORTANT:
// Do NOT reduce the active segment count for "performance savings".
// The extra front-most segment is intentional and prevents visible hallway pop-in.
// Lower values make the recycled segment appear in view in front of the player.
const INITIAL_SEGMENT_START_Z = 40;
const MIN_ACTIVE_SEGMENTS = 5;
const hasDesktopPointer = typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const ACTIVE_SEGMENT_TARGET = MIN_ACTIVE_SEGMENTS + (hasDesktopPointer ? 1 : 0);


function updateSegments(playerZ) {
    // Keep one additional front segment loaded for smoother forward visibility.
    if (segments.length < ACTIVE_SEGMENT_TARGET) {
        const lastZ = segments.length > 0 ? segments[segments.length - 1].zStart : INITIAL_SEGMENT_START_Z;
        addSegment(lastZ - segmentLength);
        return;
    }

    const lastSeg = segments[segments.length - 1];
    const firstSeg = segments[0];

    // Recycle trigger: Player passed the first segment's end (plus buffer)
    // firstSeg covers [zStart - 20, zStart]. Center is zStart - 10.
    // If playerZ < firstSeg.zStart - segmentLength - 5 (approx)
    // e.g. zStart=0. Range [-20, 0]. Player at -25.
    if (playerZ < firstSeg.zStart - segmentLength - 5) {
        // RECYCLE: Take first segment, reset it to new position at end
        const newZ = lastSeg.zStart - segmentLength;

        // console.log(`Recycling Segment: Moving from ${firstSeg.zStart} to ${newZ}`);

        firstSeg.reset(newZ);

        // Move from front to back of array
        segments.shift();
        segments.push(firstSeg);
    }
}

function addSegment(zStart) {
    const seg = new HallwaySegment(zStart, segmentLength);
    segments.push(seg);
}


    function setSegmentGenerationPaused(paused) {
      for (const segment of segments) {
        if (!segment) continue;
        if (!getHasStartedGame() && segment.isPreload) continue;
        if (paused && typeof segment.pauseBookGeneration === 'function') {
          segment.pauseBookGeneration();
        } else if (!paused && typeof segment.resumeBookGeneration === 'function') {
          segment.resumeBookGeneration();
        }
      }
    }

    return {
      applyBackgroundSfxVolume,
      allowAuxSfxPlaybackLiminal,
      getCurrentChapterProgress,
      getShimmerSound() {
        return shimmerSound;
      },
      getLastShimmerAt() {
        return lastShimmerAt;
      },
      setLastShimmerAt(value) {
        lastShimmerAt = value;
      },
      getActiveGlowingBooks() {
        return activeGlowingBooks;
      },
      getTmpLookDir() {
        return tmpLookDir;
      },
      getTmpMovementInput() {
        return tmpMovementInput;
      },
      getTmpForwardDir() {
        return tmpForwardDir;
      },
      getTmpRightDir() {
        return tmpRightDir;
      },
      getTmpMoveDir() {
        return tmpMoveDir;
      },
      getTmpVelocityStep() {
        return tmpVelocityStep;
      },
      getSegments() {
        return segments;
      },
      pushSegment(segment) {
        if (segment) segments.push(segment);
      },
      getSegmentLength() {
        return segmentLength;
      },
      getInitialSegmentStartZ() {
        return INITIAL_SEGMENT_START_Z;
      },
      getActiveSegmentTarget() {
        return ACTIVE_SEGMENT_TARGET;
      },
      updateSegments,
      addSegment,
      createPreloadSegment(zStart, length, onReady) {
        return new HallwaySegment(zStart, length, true, onReady);
      },
      setSegmentGenerationPaused
    };
  }

  globalObject.GameboyLiminalHallwayRuntime = Object.freeze({
    init: initLiminalHallwayRuntime
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
