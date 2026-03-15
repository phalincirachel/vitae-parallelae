function createLine(documentRef, segment, index, activeIndex) {
  const line = documentRef.createElement('div');
  line.className = 'subtitle-line intro-subtitle-line';
  line.dataset.segmentIndex = String(index);
  line.textContent = segment.text;
  line.classList.toggle('subtitle-current', index === activeIndex);
  line.classList.toggle('intro-segment-past', index < activeIndex);
  line.classList.toggle('intro-segment-future', index > activeIndex);
  return line;
}

function createEmptyLayer(documentRef) {
  const layer = documentRef.createElement('div');
  layer.className = 'blaettern-page-layer blaettern-page-empty';
  return layer;
}

function chunkSegments(segments) {
  const pages = [];
  let currentPage = [];
  let currentLength = 0;
  const limit = 420;

  segments.forEach((segment, index) => {
    const segmentLength = String(segment.text || '').length;
    if (currentPage.length > 0 && currentLength + segmentLength > limit) {
      pages.push(currentPage);
      currentPage = [];
      currentLength = 0;
    }
    currentPage.push({ ...segment, __index: index });
    currentLength += segmentLength;
  });

  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}

export function createIntroTextRenderer(options = {}) {
  const documentRef = options.document || globalThis.document || null;
  const container = options.container || null;
  const getLayout = typeof options.getLayout === 'function' ? options.getLayout : () => 'flat';
  if (!documentRef || !container) {
    return {
      setTrack() {},
      setActiveSegment() {},
      render() {},
      getTrack() { return []; }
    };
  }

  let activeSegmentIndex = 0;
  let trackSegments = [];
  let trackName = 'main';

  function renderFlat() {
    container.innerHTML = '';
    trackSegments.forEach((segment, index) => {
      container.appendChild(createLine(documentRef, segment, index, activeSegmentIndex));
    });
    const activeLine = container.querySelector(`.intro-subtitle-line[data-segment-index="${activeSegmentIndex}"]`);
    activeLine?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }

  function renderBlaettern() {
    container.innerHTML = '';
    const pages = chunkSegments(trackSegments);
    const pageIndex = Math.max(0, pages.findIndex((page) => page.some((segment) => segment.__index === activeSegmentIndex)));
    const pageRoot = documentRef.createElement('div');
    pageRoot.className = 'blaettern-page-root';

    const pageKeys = [pageIndex - 1, pageIndex, pageIndex + 1];
    const classNames = ['blaettern-page-prev', 'blaettern-page-current', 'blaettern-page-next'];

    pageKeys.forEach((index, position) => {
      const page = pages[index] || null;
      const layer = page ? documentRef.createElement('div') : createEmptyLayer(documentRef);
      layer.classList.add('blaettern-page-layer', classNames[position]);
      if (page) {
        page.forEach((segment) => {
          const line = createLine(documentRef, segment, segment.__index, activeSegmentIndex);
          line.classList.add('blaettern-line');
          layer.appendChild(line);
        });
      }
      pageRoot.appendChild(layer);
    });

    const indicator = documentRef.createElement('div');
    indicator.className = 'blaettern-progress-indicator';
    indicator.textContent = `${Math.min(pageIndex + 1, Math.max(1, pages.length))}/${Math.max(1, pages.length)}`;
    pageRoot.appendChild(indicator);
    container.appendChild(pageRoot);
  }

  function render() {
    const layout = getLayout();
    if (layout === 'blaettern') {
      renderBlaettern();
      return;
    }
    renderFlat();
  }

  function setTrack(nextTrackName, nextSegments) {
    trackName = nextTrackName || trackName;
    trackSegments = Array.isArray(nextSegments) ? nextSegments.slice() : [];
    render();
  }

  function setActiveSegment(nextIndex) {
    activeSegmentIndex = Math.max(0, Math.min(Number(nextIndex) || 0, Math.max(0, trackSegments.length - 1)));
    render();
  }

  return {
    setTrack,
    setActiveSegment,
    render,
    getTrack() {
      return { name: trackName, segments: trackSegments.slice(), activeSegmentIndex };
    }
  };
}

export default createIntroTextRenderer;
