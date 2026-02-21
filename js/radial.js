/* ═══════════════════════════════════════════════════════
   radial.js — Floating Action Button with radial petals
   
   Strategy:
   - Detects @supports (appearance: base-select) for native
     CSS radial select (Chrome with Chromium Explainer flag)
   - Falls back to JS-driven radial menu for all other browsers
   Both share the same HTML structure and CSS variables.
═══════════════════════════════════════════════════════ */

(function () {

    // ── CONFIG ──────────────────────────────────────────
    // Angles (degrees) and distances for each petal
    // 0° = right, 90° = down, 180° = left, 270° = up
    // We want petals to radiate upward/left from bottom-right corner
    const PETALS = [
        { id: 'petal-navigate', angleDeg: 135, dist: 80 },
        { id: 'petal-tags',     angleDeg: 200, dist: 80 },
        { id: 'petal-theme',    angleDeg: 265, dist: 80 },
    ];

    // ── DETECT CSS base-select SUPPORT ──────────────────
    const supportsBaseSelect = CSS.supports('appearance', 'base-select');

    // ── ELEMENTS ────────────────────────────────────────
    const fab       = document.getElementById('fab-container');
    const trigger   = document.getElementById('fab-trigger');
    const backdrop  = createBackdrop();
    let isOpen      = false;
    let activePanel = null;

    // ── POSITION PETALS ─────────────────────────────────
    // Set CSS custom properties so petals translate to correct positions
    PETALS.forEach(({ id, angleDeg, dist }) => {
        const petal = document.getElementById(id);
        if (!petal) return;
        const rad = (angleDeg * Math.PI) / 180;
        const tx  = Math.round(Math.cos(rad) * dist);
        const ty  = Math.round(Math.sin(rad) * dist);
        petal.style.setProperty('--tx', `${tx}px`);
        petal.style.setProperty('--ty', `${ty}px`);

        // Position the panel relative to the petal's final location
        const panel = petal.querySelector('.petal-panel');
        if (panel) {
            panel.style.bottom = `${-ty + 52}px`;   // above petal button
            panel.style.right  = `${-tx}px`;
        }
    });

    // ── TOGGLE FAB ──────────────────────────────────────
    trigger.addEventListener('click', e => {
        e.stopPropagation();
        isOpen ? close() : open();
    });

    function open() {
        isOpen = true;
        fab.classList.add('fab-open');
        backdrop.classList.add('active');
        // Pulse off once opened
        trigger.classList.remove('pulse');
    }

    function close() {
        isOpen = false;
        fab.classList.remove('fab-open');
        backdrop.classList.remove('active');
        closePanels();
    }

    backdrop.addEventListener('click', close);

    // ── PETAL BUTTONS ────────────────────────────────────
    document.querySelectorAll('.petal-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const petalId = 'petal-' + btn.dataset.petal;
            const panel   = document.getElementById('panel-' + btn.dataset.petal);
            if (!panel) return;

            const isAlreadyOpen = panel.classList.contains('panel-open');
            closePanels();

            if (!isAlreadyOpen) {
                panel.classList.add('panel-open');
                btn.classList.add('active');
                activePanel = panel;
            }
        });
    });

    function closePanels() {
        document.querySelectorAll('.petal-panel').forEach(p => p.classList.remove('panel-open'));
        document.querySelectorAll('.petal-btn').forEach(b => b.classList.remove('active'));
        activePanel = null;
    }

    // Prevent panel clicks from closing
    document.querySelectorAll('.petal-panel').forEach(p => {
        p.addEventListener('click', e => e.stopPropagation());
    });

    // ── KEYBOARD ────────────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') close();
    });

    // ── BACKDROP ────────────────────────────────────────
    function createBackdrop() {
        const el = document.createElement('div');
        el.className = 'fab-backdrop';
        document.body.appendChild(el);
        return el;
    }

    // ── PULSE HINT on first load ─────────────────────────
    if (!sessionStorage.getItem('fab-seen')) {
        setTimeout(() => trigger.classList.add('pulse'), 1200);
        sessionStorage.setItem('fab-seen', '1');
    }

    // ── POPULATE NAVIGATE PANEL ─────────────────────────
    function populateNavigatePanel() {
        const list = document.getElementById('nav-note-list');
        if (!list || !window.GARDEN) return;
        const { NOTES, navigateTo, currentKey } = window.GARDEN;

        list.innerHTML = Object.entries(NOTES).map(([key, note]) =>
            `<button class="panel-nav-item ${key === currentKey ? 'active' : ''}" data-key="${key}">
                ${note.title}
            </button>`
        ).join('');

        list.querySelectorAll('.panel-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                navigateTo(btn.dataset.key);
                close();
            });
        });
    }

    // ── POPULATE TAGS PANEL ─────────────────────────────
    function populateTagsPanel() {
        const list = document.getElementById('nav-tag-list');
        if (!list || !window.GARDEN) return;
        const { NOTES, setTagFilter, clearTagFilter } = window.GARDEN;

        const allTags = [...new Set(Object.values(NOTES).flatMap(n => n.tags))];
        list.innerHTML = allTags.map(tag =>
            `<span class="panel-tag-pill" data-tag="${tag}">#${tag}</span>`
        ).join('');

        list.querySelectorAll('.panel-tag-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const isActive = pill.classList.contains('active');
                list.querySelectorAll('.panel-tag-pill').forEach(p => p.classList.remove('active'));
                if (isActive) {
                    clearTagFilter();
                } else {
                    pill.classList.add('active');
                    setTagFilter(pill.dataset.tag);
                }
                close();
            });
        });
    }

    // ── POPULATE THEME PANEL ─────────────────────────────
    function initThemePanel() {
        // Restore saved theme
        const saved = localStorage.getItem('garden-theme') || 'dark';
        applyTheme(saved);

        document.querySelectorAll('.theme-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                applyTheme(theme);
                localStorage.setItem('garden-theme', theme);
                document.querySelectorAll('.theme-opt').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                close();
            });
        });

        // Mark active theme
        markActiveTheme(saved);
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        markActiveTheme(theme);
    }

    function markActiveTheme(theme) {
        document.querySelectorAll('.theme-opt').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    // ── REACT TO NOTE CHANGES ────────────────────────────
    document.addEventListener('noteChanged', () => {
        populateNavigatePanel();
        populateTagsPanel();
    });

    // ── INIT ─────────────────────────────────────────────
    // Wait for app.js to expose GARDEN, then populate panels
    function waitForGarden(cb, tries = 0) {
        if (window.GARDEN) { cb(); }
        else if (tries < 20) { setTimeout(() => waitForGarden(cb, tries + 1), 100); }
    }

    waitForGarden(() => {
        populateNavigatePanel();
        populateTagsPanel();
        initThemePanel();
    });

    // ── LOG SUPPORT INFO ─────────────────────────────────
    console.log(
        supportsBaseSelect
            ? '✦ Radial FAB: using native CSS base-select'
            : '✦ Radial FAB: using JS fallback (base-select not supported)'
    );

})();
