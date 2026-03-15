export function createIntroState(overrides = {}) {
  return {
    currentTrack: 'start',
    currentSegmentIndex: 0,
    currentStepId: 'start-screen',
    sentenceLayout: 'blaettern',
    dimmerMode: 'white',
    isReadingMode: true,
    archiveVisible: false,
    archiveMode: 'inhalt',
    archiveTab: 'kapitel',
    demoOrbCollected: false,
    demoLoreOpen: false,
    waitingAction: null,
    skipped: false,
    completed: false,
    ...overrides
  };
}

export default createIntroState;
