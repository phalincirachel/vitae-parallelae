const fs = require('fs');
const path = require('path');

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function createSaveStore(options = {}) {
  const appRef = options.app;
  const fileName = options.fileName || 'savegame_v3.json';
  const fsPromises = options.fsPromises || fs.promises;
  const pathRef = options.pathModule || path;

  if (!appRef || typeof appRef.getPath !== 'function') {
    throw new Error('createSaveStore requires an Electron app instance');
  }

  function getFilePath() {
    return pathRef.join(appRef.getPath('userData'), fileName);
  }

  async function save(data) {
    if (!isPlainObject(data)) {
      throw new Error('Refusing to persist invalid save payload');
    }
    const filePath = getFilePath();
    await fsPromises.writeFile(filePath, JSON.stringify(data), 'utf8');
    return filePath;
  }

  async function load() {
    const filePath = getFilePath();
    try {
      const raw = await fsPromises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!isPlainObject(parsed)) {
        throw new Error('Save file does not contain an object payload');
      }
      return parsed;
    } catch (error) {
      if (error && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  return {
    getFilePath,
    save,
    load
  };
}

module.exports = {
  createSaveStore
};
