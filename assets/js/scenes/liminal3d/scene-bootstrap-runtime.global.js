(function initLiminalSceneBootstrapRuntime(globalObject) {
  function initLiminalSceneBootstrapRuntime(options = {}) {
    const root = options.root || globalObject;
    const windowObject = options.window || root.window || root;
    const documentObject = options.document || root.document || null;
    const THREE = options.THREE || null;
    const isIOSSafari = !!options.isIOSSafari;
    const getIsReadingMode = typeof options.getIsReadingMode === 'function' ? options.getIsReadingMode : () => false;
    const getIsFallback2DMode = typeof options.getIsFallback2DMode === 'function' ? options.getIsFallback2DMode : () => !!windowObject.fallback2DMode;
    const setFallback2DMode = typeof options.setFallback2DMode === 'function' ? options.setFallback2DMode : (value) => { windowObject.fallback2DMode = !!value; };
    const renderArchive = typeof options.renderArchive === 'function' ? options.renderArchive : null;
    const refreshLoreProgressUi = typeof options.refreshLoreProgressUi === 'function' ? options.refreshLoreProgressUi : () => {};
    const log = typeof options.log === 'function' ? options.log : (...args) => globalObject.console && globalObject.console.log(...args);
    const warn = typeof options.warn === 'function' ? options.warn : (...args) => globalObject.console && globalObject.console.warn(...args);
    const error = typeof options.error === 'function' ? options.error : (...args) => globalObject.console && globalObject.console.error(...args);

    let scene = null;
    let camera = null;
    let euler = null;
    let backgroundModeColor = null;
    let lookTargetSphere = null;
    let renderer = null;

    if (!getIsFallback2DMode() && THREE) {
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050505, 0.06);
      scene.background = new THREE.Color(0x050505);
      camera = new THREE.PerspectiveCamera(60, windowObject.innerWidth / windowObject.innerHeight, 0.1, 100);
      camera.position.set(0, 1.6, 3.0);
      euler = new THREE.Euler(0, 0, 0, 'YXZ');
      backgroundModeColor = 0x010101;
      lookTargetSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.0 })
      );
      scene.add(lookTargetSphere);
    }

    function renderArchiveContent() {
      log('Archive content updated');
      if (!getIsFallback2DMode() && typeof renderArchive === 'function') {
        renderArchive();
      }
    }

    const controls = {
      moveRight(distance) {
        if (!camera || !THREE) return;
        const vec = new THREE.Vector3();
        vec.setFromMatrixColumn(camera.matrix, 0);
        camera.position.addScaledVector(vec, distance);
      },
      moveForward(distance) {
        if (!camera || !THREE) return;
        const vec = new THREE.Vector3();
        vec.setFromMatrixColumn(camera.matrix, 0);
        vec.crossVectors(camera.up, vec);
        camera.position.addScaledVector(vec, distance);
      }
    };

    if (!getIsFallback2DMode() && THREE) {
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: !isIOSSafari,
          powerPreference: isIOSSafari ? 'default' : 'high-performance',
          precision: isIOSSafari ? 'mediump' : 'highp'
        });
        renderer.setSize(windowObject.innerWidth, windowObject.innerHeight);
        renderer.shadowMap.enabled = !isIOSSafari;
        if (renderer.shadowMap.enabled) {
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        if (isIOSSafari) {
          renderer.setPixelRatio(Math.min(windowObject.devicePixelRatio || 1, 2));
          renderer.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            warn('[Liminal] WebGL context lost (iOS)');
          }, false);
          renderer.domElement.addEventListener('webglcontextrestored', () => {
            log('[Liminal] WebGL context restored (iOS)');
          }, false);
        } else {
          renderer.setPixelRatio(windowObject.devicePixelRatio || 1);
        }
        if (documentObject && documentObject.body && typeof documentObject.body.appendChild === 'function') {
          documentObject.body.appendChild(renderer.domElement);
        }
      } catch (runtimeError) {
        error('WebGL Initialization failed, entering 2D Fallback Mode.', runtimeError);
        setFallback2DMode(true);
        if (documentObject && documentObject.body && documentObject.body.style) {
          documentObject.body.style.backgroundColor = '#050505';
        }
        const loadingText = documentObject ? documentObject.getElementById('loading') : null;
        if (loadingText && loadingText.style) loadingText.style.display = 'none';
        const loadingScreen = documentObject ? documentObject.getElementById('loading-screen') : null;
        if (loadingScreen && loadingScreen.style) loadingScreen.style.display = 'none';
        const uiContainer = documentObject ? documentObject.getElementById('audioPlayerUI') : null;
        if (uiContainer && uiContainer.style) uiContainer.style.display = 'flex';
        refreshLoreProgressUi();
      }
    }

    function syncViewport() {
      const vv = windowObject.visualViewport;
      const viewWidth = Math.max(1, Math.round(vv ? vv.width : windowObject.innerWidth));
      const viewHeight = Math.max(1, Math.round(vv ? vv.height : windowObject.innerHeight));
      if (camera) {
        camera.aspect = viewWidth / viewHeight;
        camera.updateProjectionMatrix();
      }
      if (!getIsFallback2DMode() && renderer) {
        renderer.setSize(viewWidth, viewHeight, false);
      }
    }

    syncViewport();
    if (scene && THREE) {
      scene.background = new THREE.Color(getIsReadingMode() ? backgroundModeColor : 0x050505);
    }

    return {
      scene,
      camera,
      euler,
      backgroundModeColor,
      lookTargetSphere,
      renderer,
      controls,
      syncViewport,
      renderArchiveContent
    };
  }

  globalObject.GameboyLiminalSceneBootstrapRuntime = Object.freeze({
    init: initLiminalSceneBootstrapRuntime
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
