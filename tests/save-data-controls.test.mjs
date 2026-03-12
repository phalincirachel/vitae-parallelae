import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveDataControls } from '../assets/js/shared/ui/save-data-controls.js';

function createElement() {
  return {
    listeners: {},
    clickCalls: 0,
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    click() {
      this.clickCalls += 1;
      this.listeners.click?.({ target: this });
    }
  };
}

test('save data controls export state and import successful save data', async () => {
  const saveButton = createElement();
  const loadButton = createElement();
  const fileInput = createElement();
  const bodyChildren = [];
  const clickedAnchors = [];
  const alerts = [];
  let reloads = 0;
  let lastBlob = null;
  let importedText = null;

  const documentRef = {
    body: {
      appendChild(node) {
        bodyChildren.push(node);
      },
      removeChild(node) {
        const index = bodyChildren.indexOf(node);
        if (index >= 0) bodyChildren.splice(index, 1);
      }
    },
    getElementById(id) {
      if (id === 'btnSaveData') return saveButton;
      if (id === 'btnLoadData') return loadButton;
      if (id === 'fileInputSave') return fileInput;
      return null;
    },
    createElement(tagName) {
      assert.equal(tagName, 'a');
      return {
        click() {
          clickedAnchors.push({ href: this.href, download: this.download });
        }
      };
    }
  };

  class FakeBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
      lastBlob = this;
    }
  }

  class FakeFileReader {
    readAsText(file) {
      this.onload?.({ target: { result: file.contents } });
    }
  }

  const controller = createSaveDataControls({
    document: documentRef,
    getGameState() {
      return {
        exportState() {
          return '{"ok":true}';
        },
        async importState(text) {
          importedText = text;
          return true;
        }
      };
    },
    alert(message) {
      alerts.push(message);
    },
    location: {
      reload() {
        reloads += 1;
      }
    },
    URL: {
      createObjectURL(blob) {
        return `blob:${blob.parts[0]}`;
      },
      revokeObjectURL() {}
    },
    Blob: FakeBlob,
    FileReader: FakeFileReader
  });

  controller.bind();
  saveButton.click();
  assert.equal(lastBlob.parts[0], '{"ok":true}');
  assert.equal(clickedAnchors.length, 1);
  assert.match(clickedAnchors[0].download, /^liminal_save_\d+\.json$/);

  loadButton.click();
  assert.equal(fileInput.clickCalls, 1);

  await controller.handleFileChange({ target: { files: [{ contents: '{"import":true}' }] } });
  assert.equal(importedText, '{"import":true}');
  assert.deepEqual(alerts, ['Save Data Imported Successfully! Reloading...']);
  assert.equal(reloads, 1);
});

test('save data controls alert on invalid import and no-op without file', async () => {
  const saveButton = createElement();
  const loadButton = createElement();
  const fileInput = createElement();
  const alerts = [];
  let importCalls = 0;

  class FakeFileReader {
    readAsText(file) {
      this.onload?.({ target: { result: file.contents } });
    }
  }

  const controller = createSaveDataControls({
    document: {
      body: { appendChild() {}, removeChild() {} },
      getElementById(id) {
        if (id === 'btnSaveData') return saveButton;
        if (id === 'btnLoadData') return loadButton;
        if (id === 'fileInputSave') return fileInput;
        return null;
      },
      createElement() {
        return { click() {} };
      }
    },
    getGameState() {
      return {
        exportState() {
          return '{}';
        },
        async importState() {
          importCalls += 1;
          return false;
        }
      };
    },
    alert(message) {
      alerts.push(message);
    },
    URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} },
    Blob: class { constructor() {} },
    FileReader: FakeFileReader
  });

  assert.equal(controller.handleFileChange({ target: { files: [] } }), false);
  await controller.handleFileChange({ target: { files: [{ contents: '{}' }] } });
  assert.equal(importCalls, 1);
  assert.deepEqual(alerts, ['Invalid Save File.']);
});
