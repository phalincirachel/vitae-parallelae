export function createSaveDataControls(options = {}) {
  const documentRef = options.document || globalThis.document || null;
  const getGameState = typeof options.getGameState === 'function'
    ? options.getGameState
    : () => globalThis.window?.GameState || globalThis.GameState || null;
  const alertFn = typeof options.alert === 'function' ? options.alert : globalThis.alert;
  const locationRef = options.location || globalThis.location || null;
  const URLRef = options.URL || globalThis.URL || null;
  const BlobCtor = options.Blob || globalThis.Blob;
  const FileReaderCtor = options.FileReader || globalThis.FileReader;
  const saveButtonId = options.saveButtonId || 'btnSaveData';
  const loadButtonId = options.loadButtonId || 'btnLoadData';
  const fileInputId = options.fileInputId || 'fileInputSave';
  const downloadPrefix = options.downloadPrefix || 'liminal_save_';
  const successMessage = options.successMessage || 'Save Data Imported Successfully! Reloading...';
  const invalidMessage = options.invalidMessage || 'Invalid Save File.';
  let bound = false;

  function getElements() {
    if (!documentRef) return {};
    return {
      saveButton: documentRef.getElementById?.(saveButtonId) || null,
      loadButton: documentRef.getElementById?.(loadButtonId) || null,
      fileInput: documentRef.getElementById?.(fileInputId) || null
    };
  }

  function exportSaveData() {
    const gameState = getGameState();
    if (!gameState || typeof gameState.exportState !== 'function' || !documentRef || !URLRef || !BlobCtor) {
      return false;
    }

    const json = gameState.exportState();
    const blob = new BlobCtor([json], { type: 'application/json' });
    const url = URLRef.createObjectURL(blob);
    const anchor = documentRef.createElement?.('a');
    if (!anchor || !documentRef.body?.appendChild || !documentRef.body?.removeChild) {
      URLRef.revokeObjectURL?.(url);
      return false;
    }

    anchor.href = url;
    anchor.download = `${downloadPrefix}${Date.now()}.json`;
    documentRef.body.appendChild(anchor);
    anchor.click?.();
    documentRef.body.removeChild(anchor);
    URLRef.revokeObjectURL?.(url);
    return true;
  }

  function requestImport() {
    const { fileInput } = getElements();
    fileInput?.click?.();
    return !!fileInput;
  }

  async function importFromText(text) {
    const gameState = getGameState();
    if (!gameState || typeof gameState.importState !== 'function') {
      return false;
    }

    const success = await gameState.importState(text);
    if (success) {
      alertFn?.(successMessage);
      locationRef?.reload?.();
      return true;
    }

    alertFn?.(invalidMessage);
    return false;
  }

  function handleFileChange(event) {
    const file = event?.target?.files?.[0];
    if (!file || !FileReaderCtor) return false;

    const reader = new FileReaderCtor();
    reader.onload = async (loadEvent) => {
      await importFromText(loadEvent?.target?.result);
    };
    reader.readAsText(file);
    return true;
  }

  function bind() {
    if (bound) return controller;
    bound = true;

    const { saveButton, loadButton, fileInput } = getElements();
    saveButton?.addEventListener?.('click', () => {
      exportSaveData();
    });
    loadButton?.addEventListener?.('click', () => {
      requestImport();
    });
    fileInput?.addEventListener?.('change', (event) => {
      handleFileChange(event);
    });
    return controller;
  }

  const controller = {
    bind,
    exportSaveData,
    requestImport,
    importFromText,
    handleFileChange
  };

  return controller;
}

export default createSaveDataControls;
