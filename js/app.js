/* ═══════════════════════════════════════════
   app.js — Digital Garden core
   Loads notes.json, handles routing, renders
   note content, sidebar, graph, and outline.
═══════════════════════════════════════════ */

let NOTES = {};
let currentKey = '';
let activeTagFilter = null;

// ── BOOT ──────────────────────────────────
async function init() {
    try {
        const res = await fetch('notes.json');
        NOTES = await res.json();
    } catch (e) {
        document.getElementById('note-title').textContent = 'Could not load notes.json';
        return;
    }

    buildSidebar();
    routeFromURL();

    // Listen for browser back/forward
    window.addEventListener('popstate', routeFromURL);

    // Internal link clicks (delegated)
    document.addEventListener('click', e => {
        const a = e.target.closest('a.internal-link');
        if (a) {
            e.preventDefault();
            const url = new URL(a.href);
            const key = url.searchParams.get('note');
            if (key) navigateTo(key);
        }
    });
}

// ── ROUTING ───────────────────────────────
function routeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('note') || Object.keys(NOTES)[0];
    renderNote(key);
}

function navigateTo(key) {
    if (!NOTES[key]) return;
    const url = new URL(window.location);
    url.searchParams.set('note', key);
    history.pushState({}, '', url);
    renderNote(key);
}

// ── RENDER NOTE ───────────────────────────
function renderNote(key) {
    if (!NOTES[key]) key = Object.keys(NOTES)[0];
    currentKey = key;
    const note = NOTES[key];

    // Tags
    const tagsEl = document.getElementById('note-tags');
    tagsEl.innerHTML = note.tags.map(t =>
        `<span class="tag" data-tag="${t}">#${t}</span>`
    ).join('');
    tagsEl.querySelectorAll('.tag').forEach(t => {
        t.addEventListener('click', () => setTagFilter(t.dataset.tag));
    });

    // Title & meta
    document.getElementById('note-title').textContent = note.title;
    document.title = note.title + ' — Digital Garden';
    document.getElementById('note-meta').textContent =
        `${note.links.length} outgoing · ${note.backlinks.length} incoming`;

    // Body
    document.getElementById('note-body').innerHTML = note.content;

    // Backlinks
    const blSection = document.getElementById('backlinks-section');
    const blList    = document.getElementById('backlinks-list');
    if (note.backlinks.length > 0) {
        document.getElementById('backlinks-title').textContent =
            `Linked references (${note.backlinks.length})`;
        blList.innerHTML = note.backlinks.map(blKey => {
            const bl = NOTES[blKey];
            if (!bl) return '';
            return `<div class="backlink-item" data-key="${blKey}">
                <span class="bl-title">${bl.title}</span>
                <span class="bl-excerpt">${bl.tags.map(t => '#'+t).join(', ')}</span>
            </div>`;
        }).join('');
        blList.querySelectorAll('.backlink-item').forEach(el => {
            el.addEventListener('click', () => navigateTo(el.dataset.key));
        });
        blSection.style.display = '';
    } else {
        blSection.style.display = 'none';
    }

    // Sidebar active state
    document.querySelectorAll('#sidebar-notes .nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.key === key);
    });

    // Outline
    buildOutline();

    // Right panel linked notes
    buildLinkedNotes(note);

    // Graph
    drawGraph();

    // Scroll to top
    document.querySelector('.note-pane').scrollTop = 0;

    // Notify radial.js of note change (for its nav list)
    document.dispatchEvent(new CustomEvent('noteChanged', { detail: { key, notes: NOTES } }));
}

// ── SIDEBAR ───────────────────────────────
function buildSidebar() {
    // Notes list
    const notesEl = document.getElementById('sidebar-notes');
    notesEl.innerHTML = Object.entries(NOTES).map(([key, note]) =>
        `<div class="nav-item" data-key="${key}">
            <span class="item-icon">📄</span>${note.title}
        </div>`
    ).join('');
    notesEl.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', () => {
            clearTagFilter();
            navigateTo(el.dataset.key);
        });
    });

    // Tags list
    const allTags = [...new Set(Object.values(NOTES).flatMap(n => n.tags))];
    const tagsEl = document.getElementById('sidebar-tags');
    tagsEl.innerHTML = allTags.map(tag =>
        `<div class="nav-item" data-tag="${tag}">
            <span class="item-icon">#</span>${tag}
        </div>`
    ).join('');
    tagsEl.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', () => setTagFilter(el.dataset.tag));
    });
}

// ── TAG FILTER ────────────────────────────
function setTagFilter(tag) {
    if (activeTagFilter === tag) { clearTagFilter(); return; }
    activeTagFilter = tag;

    // Highlight tag in sidebar
    document.querySelectorAll('#sidebar-tags .nav-item').forEach(el => {
        el.classList.toggle('tag-active', el.dataset.tag === tag);
    });

    // Dim notes that don't have the tag
    document.querySelectorAll('#sidebar-notes .nav-item').forEach(el => {
        const note = NOTES[el.dataset.key];
        const matches = note && note.tags.includes(tag);
        el.classList.toggle('dimmed', !matches);
    });
}

function clearTagFilter() {
    activeTagFilter = null;
    document.querySelectorAll('#sidebar-tags .nav-item').forEach(el => el.classList.remove('tag-active'));
    document.querySelectorAll('#sidebar-notes .nav-item').forEach(el => el.classList.remove('dimmed'));
}

// ── OUTLINE ───────────────────────────────
function buildOutline() {
    const body = document.getElementById('note-body');
    const headings = body.querySelectorAll('h2, h3');
    const outlineEl = document.getElementById('outline-list');
    if (headings.length === 0) { outlineEl.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">No headings</span>'; return; }
    outlineEl.innerHTML = [...headings].map(h => {
        const level = h.tagName === 'H3' ? 'h3' : '';
        return `<div class="outline-item ${level}" data-text="${h.textContent}">${h.textContent}</div>`;
    }).join('');
    outlineEl.querySelectorAll('.outline-item').forEach(el => {
        el.addEventListener('click', () => {
            const target = [...document.querySelectorAll('.note-body h2, .note-body h3')]
                .find(h => h.textContent === el.dataset.text);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

// ── LINKED NOTES (right panel) ────────────
function buildLinkedNotes(note) {
    const el = document.getElementById('linked-notes');
    if (!note.links.length) { el.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">No links</span>'; return; }
    el.innerHTML = note.links.map(lk => {
        if (!NOTES[lk]) return '';
        return `<div class="backlink-item" data-key="${lk}" style="margin-bottom:6px">
            <span class="bl-title" style="font-size:12px">${NOTES[lk].title}</span>
        </div>`;
    }).join('');
    el.querySelectorAll('.backlink-item').forEach(el => {
        el.addEventListener('click', () => navigateTo(el.dataset.key));
    });
}

// ── GRAPH ─────────────────────────────────
function drawGraph() {
    const canvas = document.getElementById('graph-canvas');
    const ctx    = canvas.getContext('2d');
    const dpr    = window.devicePixelRatio || 1;
    const rect   = canvas.getBoundingClientRect();

    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const keys = Object.keys(NOTES);
    const positions = {};

    keys.forEach((k, i) => {
        const angle = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
        const r = Math.min(W, H) * 0.33;
        positions[k] = { x: W / 2 + Math.cos(angle) * r, y: H / 2 + Math.sin(angle) * r };
    });

    ctx.clearRect(0, 0, W, H);

    // Draw edges
    keys.forEach(k => {
        NOTES[k].links.forEach(lk => {
            if (!positions[lk]) return;
            const isHighlighted = k === currentKey || lk === currentKey;
            ctx.beginPath();
            ctx.moveTo(positions[k].x, positions[k].y);
            ctx.lineTo(positions[lk].x, positions[lk].y);
            ctx.strokeStyle = isHighlighted ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.07)';
            ctx.lineWidth   = isHighlighted ? 1.5 : 1;
            ctx.stroke();
        });
    });

    // Draw nodes
    keys.forEach(k => {
        const pos = positions[k];
        const isCurrent = k === currentKey;
        const isLinked  = NOTES[currentKey]?.links.includes(k) || NOTES[currentKey]?.backlinks.includes(k);
        const r = isCurrent ? 7 : 4.5;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? 'var(--accent, #a78bfa)' : isLinked ? '#6ee7b7' : '#4a4540';
        ctx.fill();

        if (isCurrent || isLinked) {
            ctx.font = `${isCurrent ? 11 : 10}px DM Sans, sans-serif`;
            ctx.fillStyle = isCurrent ? '#c4b5fd' : '#9ca3af';
            ctx.textAlign = 'center';
            const words = NOTES[k].title.split(' ').slice(0, 2).join(' ');
            ctx.fillText(words, pos.x, pos.y - r - 5);
        }
    });

    // Click to navigate
    canvas.onclick = e => {
        const r2 = canvas.getBoundingClientRect();
        const mx = e.clientX - r2.left;
        const my = e.clientY - r2.top;
        keys.forEach(k => {
            const p = positions[k];
            if (Math.hypot(p.x - mx, p.y - my) < 12) navigateTo(k);
        });
    };
}

window.addEventListener('resize', drawGraph);

// ── START ─────────────────────────────────
init();

// Expose for radial.js
window.GARDEN = { get NOTES() { return NOTES; }, navigateTo, setTagFilter, clearTagFilter, get currentKey() { return currentKey; } };
