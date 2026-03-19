(function initIndexMapRuntime(globalObject) {
  function createMatrix(width, height, initialValue = false) {
    return new Array(height).fill(null).map(() => new Array(width).fill(initialValue));
  }

  function pullNearbyPixel(data, x, y, width, height, cyanPixels) {
    const maxRadius = 15;
    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const pixelIndex = (ny * width + nx) * 4;
          const r = data[pixelIndex];
          const g = data[pixelIndex + 1];
          const b = data[pixelIndex + 2];

          if (r > 200 && g < 80 && b > 200) continue;
          if (r < 80 && g > 200 && b > 200) continue;
          if (cyanPixels.has(`${nx},${ny}`)) continue;
          return { r, g, b };
        }
      }
    }

    return { r: 60, g: 55, b: 50 };
  }

  function findEnclosedAreas(cyanPixels, width, height, foregroundData) {
    const visited = createMatrix(width, height, 0);
    const dilationRadius = 2;

    for (const entry of cyanPixels) {
      const [x, y] = entry.split(',').map(Number);
      for (let dy = -dilationRadius; dy <= dilationRadius; dy += 1) {
        for (let dx = -dilationRadius; dx <= dilationRadius; dx += 1) {
          if (Math.abs(dx) + Math.abs(dy) > dilationRadius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          visited[ny][nx] = 2;
        }
      }
    }

    const queue = [];
    for (let x = 0; x < width; x += 1) {
      if (visited[0][x] === 0) queue.push([x, 0]);
      if (visited[height - 1][x] === 0) queue.push([x, height - 1]);
    }
    for (let y = 0; y < height; y += 1) {
      if (visited[y][0] === 0) queue.push([0, y]);
      if (visited[y][width - 1] === 0) queue.push([width - 1, y]);
    }

    let index = 0;
    while (index < queue.length) {
      const [x, y] = queue[index++];
      if (x < 0 || x >= width || y < 0 || y >= height || visited[y][x] !== 0) continue;
      visited[y][x] = 1;
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (visited[y][x] === 0 || visited[y][x] === 2) {
          foregroundData[y][x] = true;
        }
      }
    }

    for (const entry of cyanPixels) {
      const [x, y] = entry.split(',').map(Number);
      foregroundData[y][x] = true;
    }
  }

  function buildLayerCanvases(documentObject, data, width, height, foregroundData) {
    const bgData = new Uint8ClampedArray(data);
    const fgData = new Uint8ClampedArray(data.length);
    for (let i = 0; i < fgData.length; i += 4) fgData[i + 3] = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!foregroundData[y][x]) continue;
        const pixelIndex = (y * width + x) * 4;
        fgData[pixelIndex] = data[pixelIndex];
        fgData[pixelIndex + 1] = data[pixelIndex + 1];
        fgData[pixelIndex + 2] = data[pixelIndex + 2];
        fgData[pixelIndex + 3] = 255;
      }
    }

    const createImageDataCompat = (ctx2d, pixels, targetWidth, targetHeight) => {
      try {
        return new ImageData(pixels, targetWidth, targetHeight);
      } catch (_) {
        const fallback = ctx2d.createImageData(targetWidth, targetHeight);
        fallback.data.set(pixels);
        return fallback;
      }
    };

    const bgCanvas = documentObject.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d');
    if (!bgCtx) throw new Error('bg canvas context unavailable');
    bgCtx.putImageData(createImageDataCompat(bgCtx, bgData, width, height), 0, 0);

    const fgCanvas = documentObject.createElement('canvas');
    fgCanvas.width = width;
    fgCanvas.height = height;
    const fgCtx = fgCanvas.getContext('2d');
    if (!fgCtx) throw new Error('fg canvas context unavailable');
    fgCtx.putImageData(createImageDataCompat(fgCtx, fgData, width, height), 0, 0);

    return { bgCanvas, fgCanvas, bgData, fgData };
  }

  function processMapImage(options = {}) {
    const documentObject = options.document || globalObject.document || null;
    const image = options.image || options.img || null;
    const createYellowLight = typeof options.createYellowLight === 'function'
      ? options.createYellowLight
      : (x, y, id) => ({ x, y, id });
    const sortAutoWalkPath = typeof options.sortAutoWalkPath === 'function'
      ? options.sortAutoWalkPath
      : (points) => points.slice();

    if (!documentObject || !image) {
      throw new Error('processMapImage requires a document and image.');
    }

    const width = image.width;
    const height = image.height;
    const tempCanvas = documentObject.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(image, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const collisionData = createMatrix(width, height, false);
    const foregroundData = createMatrix(width, height, false);
    const flowData = createMatrix(width, height, false);
    const magentaPixels = [];
    const cyanPixels = new Set();
    const greenPixels = [];
    const yellowLights = [];
    const orangePixels = [];
    let spawnPixel = null;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = (y * width + x) * 4;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];

        if (r > 200 && g < 80 && b > 200) {
          collisionData[y][x] = true;
          magentaPixels.push({ x, y, i: pixelIndex });
        } else if (r < 80 && g > 200 && b > 200) {
          cyanPixels.add(`${x},${y}`);
        } else if (r < 80 && g > 200 && b < 80) {
          flowData[y][x] = true;
          greenPixels.push({ x, y, i: pixelIndex });
        } else if (r > 250 && g > 250 && b < 10) {
          const id = yellowLights.length + 1;
          yellowLights.push(createYellowLight(x, y, id));
        } else if (r < 50 && g < 50 && b > 200) {
          if (!spawnPixel) spawnPixel = { x, y, i: pixelIndex };
        } else if (r > 240 && g > 130 && g < 200 && b < 50) {
          orangePixels.push({ x, y, i: pixelIndex });
        }
      }
    }

    if (cyanPixels.size > 0) {
      findEnclosedAreas(cyanPixels, width, height, foregroundData);
    }

    const extraWalls = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!collisionData[y][x]) continue;
        if (x > 0) extraWalls.push({ x: x - 1, y });
        if (x < width - 1) extraWalls.push({ x: x + 1, y });
        if (y > 0) extraWalls.push({ x, y: y - 1 });
        if (y < height - 1) extraWalls.push({ x, y: y + 1 });
      }
    }
    for (const wall of extraWalls) {
      collisionData[wall.y][wall.x] = true;
    }

    for (const magentaPixel of magentaPixels) {
      const replacement = pullNearbyPixel(data, magentaPixel.x, magentaPixel.y, width, height, cyanPixels);
      data[magentaPixel.i] = replacement.r;
      data[magentaPixel.i + 1] = replacement.g;
      data[magentaPixel.i + 2] = replacement.b;
    }

    for (const greenPixel of greenPixels) {
      const replacement = pullNearbyPixel(data, greenPixel.x, greenPixel.y, width, height, cyanPixels);
      data[greenPixel.i] = replacement.r;
      data[greenPixel.i + 1] = replacement.g;
      data[greenPixel.i + 2] = replacement.b;
    }

    for (const yellowLight of yellowLights) {
      const pixelIndex = (yellowLight.y * width + yellowLight.x) * 4;
      const replacement = pullNearbyPixel(data, yellowLight.x, yellowLight.y, width, height, cyanPixels);
      data[pixelIndex] = replacement.r;
      data[pixelIndex + 1] = replacement.g;
      data[pixelIndex + 2] = replacement.b;
    }

    if (spawnPixel) {
      const replacement = pullNearbyPixel(data, spawnPixel.x, spawnPixel.y, width, height, cyanPixels);
      data[spawnPixel.i] = replacement.r;
      data[spawnPixel.i + 1] = replacement.g;
      data[spawnPixel.i + 2] = replacement.b;
    }

    let autoWalkPath = [];
    if (orangePixels.length > 0) {
      const startReference = spawnPixel || { x: width / 2, y: height / 2 };
      autoWalkPath = sortAutoWalkPath(orangePixels, startReference);
      for (const orangePixel of orangePixels) {
        const replacement = pullNearbyPixel(data, orangePixel.x, orangePixel.y, width, height, cyanPixels);
        data[orangePixel.i] = replacement.r;
        data[orangePixel.i + 1] = replacement.g;
        data[orangePixel.i + 2] = replacement.b;
      }
    }

    for (const cyanPixel of cyanPixels) {
      const [x, y] = cyanPixel.split(',').map(Number);
      const pixelIndex = (y * width + x) * 4;
      const replacement = pullNearbyPixel(data, x, y, width, height, cyanPixels);
      data[pixelIndex] = replacement.r;
      data[pixelIndex + 1] = replacement.g;
      data[pixelIndex + 2] = replacement.b;
    }

    const { bgCanvas, fgCanvas, bgData, fgData } = buildLayerCanvases(documentObject, data, width, height, foregroundData);

    return {
      mapW: width,
      mapH: height,
      collisionData,
      foregroundData,
      flowData,
      magentaPixels,
      cyanPixels,
      greenPixels,
      yellowLights,
      orangePixels,
      spawnPixel,
      autoWalkPath,
      bgCanvas,
      fgCanvas,
      bgData,
      fgData,
      processedPixelData: data
    };
  }

  globalObject.GameboyIndexMapRuntime = Object.freeze({
    processMapImage,
    pullNearbyPixel,
    findEnclosedAreas
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
