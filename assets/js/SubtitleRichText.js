(function initSubtitleRichText(globalScope) {
    'use strict';

    const OVERLAY_ID = 'subtitleInfoOverlay';
    const OVERLAY_VISIBLE_CLASS = 'visible';
    const LINK_BOUND_ATTR = 'data-subtitle-info-bound';
    const DEFAULT_HIDE_DELAY_MS = 170;

    const state = {
        container: null,
        overlay: null,
        card: null,
        title: null,
        text: null,
        imageWrap: null,
        image: null,
        closeBtn: null,
        activeKey: '',
        pinned: false,
        hover: false,
        hideTimer: 0,
        isDesktopPointer: () => {
            if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
            return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        }
    };

    function safeText(value) {
        if (value === null || value === undefined) return '';
        return String(value);
    }

    function clamp(value, min, max) {
        if (!Number.isFinite(value)) return min;
        return Math.max(min, Math.min(max, value));
    }

    function normalizeMarkup(rawText) {
        let text = safeText(rawText);
        if (!text) return '';

        // BBCode-style alias: [u]...[/u] and [u:key]...[/u]
        text = text.replace(/\[u(?::([a-z0-9_.-]+))?\]([\s\S]*?)\[\/u\]/gi, (_, key, content) => {
            const inner = safeText(content);
            const lookupKey = safeText(key).trim();
            return lookupKey ? `<u:${lookupKey}>${inner}</u>` : `<u>${inner}</u>`;
        });

        return text;
    }

    function parse(rawText) {
        const normalized = normalizeMarkup(rawText);
        const tokens = [];
        const tagPattern = /<u(?::([a-z0-9_.-]+))?>([\s\S]*?)<\/u>/gi;
        let cursor = 0;
        let match = null;

        while ((match = tagPattern.exec(normalized)) !== null) {
            const matchIndex = match.index;
            if (matchIndex > cursor) {
                const plainChunk = normalized.slice(cursor, matchIndex);
                if (plainChunk) {
                    tokens.push({ text: plainChunk, underline: false, linkKey: null });
                }
            }

            const key = safeText(match[1]).trim();
            const markedChunk = safeText(match[2]);
            if (markedChunk) {
                tokens.push({
                    text: markedChunk,
                    underline: true,
                    linkKey: key || null
                });
            }

            cursor = tagPattern.lastIndex;
        }

        if (cursor < normalized.length) {
            const tail = normalized.slice(cursor);
            if (tail) {
                tokens.push({ text: tail, underline: false, linkKey: null });
            }
        }

        if (!tokens.length) {
            tokens.push({ text: normalized, underline: false, linkKey: null });
        }

        return {
            plainText: tokens.map((token) => token.text).join(''),
            tokens
        };
    }

    function resolveLibraryEntry(key) {
        const lookupKey = safeText(key).trim();
        if (!lookupKey) return null;

        const library = globalScope.SubtitleInfoLibrary;
        if (!library) return null;

        if (typeof library.get === 'function') {
            try {
                const result = library.get(lookupKey);
                if (result && typeof result === 'object') return result;
            } catch (_) {
                // no-op
            }
        }

        const entries = (library.entries && typeof library.entries === 'object')
            ? library.entries
            : library;
        const direct = entries ? entries[lookupKey] : null;
        return (direct && typeof direct === 'object') ? direct : null;
    }

    function clearHideTimer() {
        if (!state.hideTimer) return;
        clearTimeout(state.hideTimer);
        state.hideTimer = 0;
    }

    function isOverlayVisible() {
        return !!(state.overlay && state.overlay.classList.contains(OVERLAY_VISIBLE_CLASS));
    }

    function scheduleOverlayHide(delayMs = DEFAULT_HIDE_DELAY_MS) {
        if (state.pinned) return;
        clearHideTimer();
        state.hideTimer = setTimeout(() => {
            state.hideTimer = 0;
            if (state.hover || state.pinned) return;
            closeOverlay(true);
        }, Math.max(40, Number(delayMs) || DEFAULT_HIDE_DELAY_MS));
    }

    function setOverlayContent(entry, key) {
        if (!state.card || !state.title || !state.text || !state.imageWrap || !state.image) return;

        const title = safeText(entry.title || key).trim() || safeText(key);
        const text = safeText(entry.text || entry.body || entry.description || '').trim();
        const image = safeText(entry.image || entry.imageUrl || '').trim();

        state.title.textContent = title;
        state.text.textContent = text;

        if (image) {
            state.image.src = image;
            state.image.alt = title;
            state.card.classList.add('has-image');
        } else {
            state.image.removeAttribute('src');
            state.image.alt = '';
            state.card.classList.remove('has-image');
        }
    }

    function placeOverlay(anchorEl) {
        if (!state.card) return;

        const viewportMargin = 12;
        const minCardWidth = 220;
        const minCardHeight = 180;
        const containerRect = state.container && typeof state.container.getBoundingClientRect === 'function'
            ? state.container.getBoundingClientRect()
            : null;
        const hasContainerRect = !!(containerRect && containerRect.width > 80 && containerRect.height > 80);
        const containerInset = hasContainerRect
            ? clamp(Math.round(Math.min(20, Math.max(10, containerRect.width * 0.02))), 10, 20)
            : 0;

        const viewportMaxWidth = Math.max(minCardWidth, window.innerWidth - (viewportMargin * 2));
        const containerMaxWidth = hasContainerRect
            ? Math.max(minCardWidth, containerRect.width - (containerInset * 2))
            : viewportMaxWidth;
        const preferredWidth = hasContainerRect
            ? containerRect.width * 0.90
            : window.innerWidth * 0.88;
        const width = clamp(
            preferredWidth,
            minCardWidth,
            Math.min(760, viewportMaxWidth, containerMaxWidth)
        );

        const viewportMaxHeight = Math.max(minCardHeight, window.innerHeight - (viewportMargin * 2));
        const containerMaxHeight = hasContainerRect
            ? Math.max(minCardHeight, containerRect.height - (containerInset * 2))
            : viewportMaxHeight;
        const preferredHeight = hasContainerRect
            ? containerRect.height * 0.86
            : window.innerHeight * 0.68;
        const maxHeight = clamp(
            preferredHeight,
            minCardHeight,
            Math.min(560, viewportMaxHeight, containerMaxHeight)
        );

        let left = hasContainerRect
            ? containerRect.left + ((containerRect.width - width) * 0.5)
            : (window.innerWidth - width) * 0.5;

        let top = hasContainerRect
            ? containerRect.top + ((containerRect.height - maxHeight) * 0.5)
            : (window.innerHeight - maxHeight) * 0.5;

        if (
            anchorEl
            && hasContainerRect
            && state.isDesktopPointer()
            && typeof anchorEl.getBoundingClientRect === 'function'
        ) {
            const anchorRect = anchorEl.getBoundingClientRect();
            const preferBelow = anchorRect.bottom + 10;
            const preferAbove = anchorRect.top - maxHeight - 10;

            if (preferBelow + maxHeight <= containerRect.bottom - containerInset) {
                top = preferBelow;
            } else if (preferAbove >= containerRect.top + containerInset) {
                top = preferAbove;
            }
        }

        let minLeft = viewportMargin;
        let maxLeft = window.innerWidth - width - viewportMargin;
        let minTop = viewportMargin;
        let maxTop = window.innerHeight - maxHeight - viewportMargin;

        if (hasContainerRect) {
            minLeft = Math.max(minLeft, containerRect.left + containerInset);
            maxLeft = Math.min(maxLeft, containerRect.right - containerInset - width);
            minTop = Math.max(minTop, containerRect.top + containerInset);
            maxTop = Math.min(maxTop, containerRect.bottom - containerInset - maxHeight);
        }

        if (maxLeft < minLeft) {
            minLeft = viewportMargin;
            maxLeft = window.innerWidth - width - viewportMargin;
        }
        if (maxTop < minTop) {
            minTop = viewportMargin;
            maxTop = window.innerHeight - maxHeight - viewportMargin;
        }

        left = clamp(left, minLeft, maxLeft);
        top = clamp(top, minTop, maxTop);

        state.card.style.left = `${Math.round(left)}px`;
        state.card.style.top = `${Math.round(top)}px`;
        state.card.style.width = `${Math.round(width)}px`;
        state.card.style.maxHeight = `${Math.round(maxHeight)}px`;
    }

    function closeOverlay(force = false) {
        if (!state.overlay) return;
        if (!force && state.pinned) return;

        clearHideTimer();
        state.overlay.classList.remove(OVERLAY_VISIBLE_CLASS);
        state.overlay.setAttribute('aria-hidden', 'true');
        state.activeKey = '';
        state.pinned = false;
        state.hover = false;
    }

    function openOverlay(key, anchorEl, options = {}) {
        const lookupKey = safeText(key).trim();
        if (!lookupKey) return false;

        const entry = resolveLibraryEntry(lookupKey);
        if (!entry) return false;

        initOverlay(options);
        clearHideTimer();

        state.activeKey = lookupKey;
        state.pinned = !!options.pinned;
        setOverlayContent(entry, lookupKey);
        placeOverlay(anchorEl || null);

        state.overlay.classList.add(OVERLAY_VISIBLE_CLASS);
        state.overlay.setAttribute('aria-hidden', 'false');

        if (options.focusClose && state.closeBtn) {
            state.closeBtn.focus();
        }

        return true;
    }

    function handleEscToClose(event) {
        if (!event || event.key !== 'Escape') return;
        if (!isOverlayVisible()) return;
        event.stopPropagation();
        closeOverlay(true);
    }

    function initOverlay(options = {}) {
        if (options.container && options.container instanceof HTMLElement) {
            state.container = options.container;
        }
        if (typeof options.isDesktopPointer === 'function') {
            state.isDesktopPointer = options.isDesktopPointer;
        }

        if (state.overlay) return state.overlay;

        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'subtitle-info-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        const card = document.createElement('article');
        card.className = 'subtitle-info-card';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'false');
        card.setAttribute('aria-label', 'Textinfo');

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'subtitle-info-close';
        closeBtn.setAttribute('aria-label', 'Schliessen');
        closeBtn.innerHTML = '&times;';

        const mediaWrap = document.createElement('div');
        mediaWrap.className = 'subtitle-info-media';
        const mediaImage = document.createElement('img');
        mediaImage.className = 'subtitle-info-image';
        mediaImage.loading = 'lazy';
        mediaImage.decoding = 'async';
        mediaWrap.appendChild(mediaImage);

        const body = document.createElement('div');
        body.className = 'subtitle-info-body';

        const title = document.createElement('h3');
        title.className = 'subtitle-info-title';
        body.appendChild(title);

        const text = document.createElement('p');
        text.className = 'subtitle-info-text';
        body.appendChild(text);

        card.appendChild(closeBtn);
        card.appendChild(mediaWrap);
        card.appendChild(body);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        state.overlay = overlay;
        state.card = card;
        state.title = title;
        state.text = text;
        state.imageWrap = mediaWrap;
        state.image = mediaImage;
        state.closeBtn = closeBtn;

        closeBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            closeOverlay(true);
        });

        overlay.addEventListener('pointerdown', (event) => {
            if (event.target !== overlay) return;
            closeOverlay(true);
        });

        card.addEventListener('mouseenter', () => {
            state.hover = true;
            clearHideTimer();
        });
        card.addEventListener('mouseleave', () => {
            state.hover = false;
            scheduleOverlayHide();
        });

        document.addEventListener('keydown', handleEscToClose);

        window.addEventListener('resize', () => {
            if (!isOverlayVisible()) return;
            placeOverlay(null);
        });
        window.addEventListener('orientationchange', () => {
            if (!isOverlayVisible()) return;
            placeOverlay(null);
        });

        return overlay;
    }

    function bindLink(linkEl, key, options = {}) {
        if (!(linkEl instanceof HTMLElement)) return;

        const lookupKey = safeText(key).trim();
        if (!lookupKey) return;
        if (!resolveLibraryEntry(lookupKey)) return;

        initOverlay(options);

        linkEl.classList.add('subtitle-inline-link');
        linkEl.setAttribute('data-info-key', lookupKey);

        if (linkEl.getAttribute(LINK_BOUND_ATTR) === '1') return;
        linkEl.setAttribute(LINK_BOUND_ATTR, '1');

        linkEl.setAttribute('role', 'button');
        linkEl.setAttribute('tabindex', '0');
        linkEl.setAttribute('aria-haspopup', 'dialog');
        linkEl.setAttribute('aria-label', `Info: ${lookupKey}`);

        linkEl.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });
        linkEl.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });
        linkEl.addEventListener('touchstart', (event) => {
            event.stopPropagation();
        }, { passive: true });

        linkEl.addEventListener('mouseenter', () => {
            if (!state.isDesktopPointer()) return;
            openOverlay(lookupKey, linkEl, { pinned: false });
        });

        linkEl.addEventListener('mouseleave', () => {
            if (!state.isDesktopPointer()) return;
            scheduleOverlayHide();
        });

        linkEl.addEventListener('focus', () => {
            openOverlay(lookupKey, linkEl, { pinned: true });
        });

        linkEl.addEventListener('blur', () => {
            if (state.isDesktopPointer()) scheduleOverlayHide();
        });

        linkEl.addEventListener('keydown', (event) => {
            if (!event) return;
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            openOverlay(lookupKey, linkEl, { pinned: true, focusClose: false });
        });

        linkEl.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (state.isDesktopPointer()) {
                const alreadyPinned = isOverlayVisible() && state.activeKey === lookupKey && state.pinned;
                if (alreadyPinned) {
                    closeOverlay(true);
                    return;
                }
                openOverlay(lookupKey, linkEl, { pinned: true });
                return;
            }

            openOverlay(lookupKey, linkEl, { pinned: true, focusClose: true });
        });
    }

    function renderTrackInto(lineEl, track, options = {}) {
        if (!(lineEl instanceof HTMLElement)) return;
        const disableInfoLinks = !!options.disableInfoLinks;

        const fallbackText = track && typeof track.text === 'string'
            ? track.text
            : safeText(track);
        const sourceText = track && typeof track.rawText === 'string'
            ? track.rawText
            : fallbackText;

        const tokens = Array.isArray(track && track.richTokens)
            ? track.richTokens
            : parse(sourceText).tokens;

        lineEl.textContent = '';

        for (const token of tokens) {
            if (!token || !token.text) continue;

            if (!token.underline) {
                lineEl.appendChild(document.createTextNode(token.text));
                continue;
            }

            const span = document.createElement('span');
            span.className = 'subtitle-inline-mark subtitle-inline-underline';
            span.textContent = token.text;

            if (token.linkKey && !disableInfoLinks) {
                bindLink(span, token.linkKey, options);
            }

            lineEl.appendChild(span);
        }

        if (!lineEl.childNodes.length) {
            lineEl.textContent = fallbackText;
        }
    }

    globalScope.SubtitleRichText = {
        parse,
        renderTrackInto,
        initOverlay,
        bindLink,
        openOverlay,
        closeOverlay
    };
})(typeof window !== 'undefined' ? window : globalThis);
