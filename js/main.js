import { LEVELS, STAGES } from './data/stages.js';
import { completedStages, totalPoints, highestStreak, tutorialComplete, setTutorialComplete, timedBest, saveTimedBest, unlockAchievement, unlockedAchievements, achievementProgress } from './data/storage.js';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from './data/achievements.js';
import { generateMatrices, formatAngleGate, getOccupiedQubits, canFit, GATE_MATRICES } from './quantum/gates.js';
import { computeStateVector, stateToString, statesMatch } from './quantum/engine.js';
import { toggleAllGates, getColumnHTML, renderDynamicCanvases, updateBlochSpheres, hideVictoryModal, showVictoryModal, showInfoModal, hideInfoModal, nextTourStep, endTour, setGhostPointer, clearGhostPointer, parseMarkdownAndMath, updateTargetBlochSphere, updateTimedStatusBar, showDuelChallengeBanner, showPlayChallengeBanner, showDailyChallengeBanner, showAchievementToast, renderAchievementsPanel, showTutorialPrompt } from './game/ui.js';
import { handleCellTap, updateActiveRow } from './game/dragdrop.js';
import { submitGuess } from './game/validator.js';
import { trackSessionStart, trackGameStart, trackHintViewed, trackLessonViewed } from './data/analytics.js';

export let gameStartTime = 0;
let tutorialPromptShown = false;

// X gates needed to encode |n⟩ for 3 qubits: qubit 0 = MSB (weight 4), qubit 2 = LSB (weight 1)
const QFT_LAB_CONFIGS = {
    0: [],
    1: ['X2'],
    2: ['X1'],
    3: ['X1', 'X2'],
    4: ['X0'],
    5: ['X0', 'X2'],
    6: ['X0', 'X1'],
    7: ['X0', 'X1', 'X2'],
};

// Phase rotations for the QFT Adder Lab: phaseCols[0] and [1] are the two middle columns
// Phase for qubit j = 2π × n / 2^(j+1), where qubit 0 = top (MSB), qubit 2 = bottom (LSB)
const LAB_CONFIGS = {
    1: [['RZ_PI4_2', 'RZ_PI2_1', 'RZ_PI_0'],             []],
    2: [['RZ_PI2_2', 'RZ_PI_1'],                          []],
    3: [['RZ_PI4_2', 'RZ_MINUS_PI2_1', 'RZ_PI_0'],        ['RZ_PI2_2']],
    4: [['RZ_PI_2'],                                       []],
    5: [['RZ_PI_2'],                                       ['RZ_PI4_2', 'RZ_PI2_1', 'RZ_PI_0']],
    6: [['RZ_MINUS_PI2_2', 'RZ_PI_1'],                    []],
    7: [['RZ_MINUS_PI4_2', 'RZ_MINUS_PI2_1', 'RZ_PI_0'],  []],
};
const LAB_HINTS = {
    1: 'RZ(π) on top · RZ(π/2) on middle · RZ(π/4) on bottom — fits in one column',
    2: 'RZ(π) on middle · RZ(π/2) on bottom — fits in one column',
    3: 'Col 2: RZ(π/4) on bottom, RZ(−π/2) on middle, RZ(π) on top | Col 3: RZ(π/2) on bottom',
    4: 'RZ(π) on bottom — fits in one column',
    5: 'Col 2: RZ(π) on bottom | Col 3: RZ(π/4) on bottom, RZ(π/2) on middle, RZ(π) on top',
    6: 'RZ(−π/2) on bottom · RZ(π) on middle — fits in one column',
    7: 'RZ(−π/4) on bottom · RZ(−π/2) on middle · RZ(π) on top — fits in one column',
};

// --- Global Application State ---
export const state = {
    currentMode: '',
    currentLvl: 1,
    currentP1: 0,
    currentP2: 0,
    numQubits: 1,
    numCols: 4,
    activeSet: [],
    secretCircuits: [],
    targetState: [],
    currentGuess: [],
    attempts: 0,
    gameOver: false,
    currentRzAngle: 'PI',
    currentStreak: 0,
    selectedBaseGate: null, 
    placement: { active: false, col: null, controls: [] },
    isTutorial: false,
    tutorialPhase: 'NONE',
    tutorialJustCompleted: false,
    timerRemaining: 0,
    _timerIntervalId: null,
    timedScore: 0,
    timedCircuitsSolved: 0,
    timedCircuitIndex: 0,
    timedNextPuzzle: null,
    timedEndSession: null,
    _timedSessionEnded: false,
    labTargetN: 0,
    labFromP2: 0,
    qftLabFromP2: 0,
    isDuelMode: false,
    duelSeed: 0,
    duelOpponentScore: 0,
    duelOpponentName: 'Challenger',
    randomSeed: 0,
    randomGateMask: 0,
    _usePresetSeed: false
};

// ── URL Router ───────────────────────────────────────────────────────────────
let _routerNavigating = false;

function pushRoute(hash) {
    if (_routerNavigating) return;
    history.pushState(null, '', location.pathname + location.search + hash);
}

function handleRoute(hash) {
    _routerNavigating = true;
    window.stopLabPlay?.();
    const parts = (hash || '#/').replace(/^#\//, '').split('/');
    const seg = parts[0] || '';
    const p1  = parseInt(parts[1] ?? '0');
    const p2  = Math.max(0, parseInt(parts[2] ?? '1') - 1);  // URL is 1-based
    if (!seg) {
        showMainMenu();
    } else if (seg === 'learn') {
        initGame('STAGE', p1, p2);
    } else if (seg === 'random') {
        initGame('RANDOM', p1);
    } else if (seg === 'daily') {
        initGame('DAILY', p1);
    } else if (seg === 'timed') {
        initGame('TIMED', p1);
    } else if (seg === 'sandbox') {
        initGame('FREEPLAY', p1);
    } else {
        showMainMenu();
    }
    _routerNavigating = false;
}

window.addEventListener('hashchange', () => handleRoute(location.hash));
// ─────────────────────────────────────────────────────────────────────────────

// --- Expose Global Hooks for dynamically created DOM elements ---
window.showHint = () => {
    trackHintViewed(state.currentMode, state.currentP1, state.currentP2, state.currentLvl);
    document.getElementById('hint-text').classList.remove('hidden');
    document.getElementById('hint-btn').classList.add('hidden');
};
window.showLesson = () => {
    trackLessonViewed(state.currentMode, state.currentP1, state.currentP2, state.currentLvl);
    document.getElementById('lesson-text').classList.remove('hidden');
    document.getElementById('lesson-text').innerHTML = parseMarkdownAndMath(document.getElementById('lesson-text').innerHTML);
    document.getElementById('lesson-btn').classList.add('hidden');
};
window.tryQftLab = () => { state.qftLabFromP2 = state.currentP2; window.initQftLab(0); };
window.tryAdderLab = () => { state.labFromP2 = state.currentP2; window.initLabGame(1); };

window._labPlayInterval = null;
window.stopLabPlay = () => {
    clearInterval(window._labPlayInterval);
    window._labPlayInterval = null;
    const btn = document.getElementById('lab-play-btn');
    if (btn) btn.textContent = '▶';
};
window.toggleQftLabPlay = () => {
    if (window._labPlayInterval) { window.stopLabPlay(); return; }
    document.getElementById('lab-play-btn').textContent = '⏸';
    window._labPlayInterval = setInterval(() => {
        window.selectQftInput(((state.labTargetN ?? 0) + 1) % 8);
    }, 1500);
};
window.toggleAdderLabPlay = () => {
    if (window._labPlayInterval) { window.stopLabPlay(); return; }
    document.getElementById('lab-play-btn').textContent = '⏸';
    window._labPlayInterval = setInterval(() => {
        window.selectLabNumber(state.labTargetN >= 7 ? 1 : state.labTargetN + 1);
    }, 1500);
};
window.toggleGroverLabPlay = () => {
    if (window._labPlayInterval) { window.stopLabPlay(); return; }
    document.getElementById('lab-play-btn').textContent = '⏸';
    window._labPlayInterval = setInterval(() => {
        window._groverSetK((window._groverCurrentK ?? 0) >= 8 ? 0 : (window._groverCurrentK ?? 0) + 1);
    }, 1500);
};

window.showGroverLab = () => {
    const θ = Math.asin(1 / Math.sqrt(8));
    let k = 1;

    function renderGroverLab() {
        const pTarget = Math.sin((2 * k + 1) * θ) ** 2;
        const pOther = (1 - pTarget) / 7;
        const probs = Array.from({length: 8}, (_, i) => i === 7 ? pTarget : pOther);
        const maxP = Math.max(...probs);
        const chartH = 100;
        const labels = ['000','001','010','011','100','101','110','111'];

        const barsHTML = probs.map((p, i) => {
            const isTarget = i === 7;
            const barH = Math.max(3, Math.round((p / maxP) * chartH));
            const pct = (p * 100).toFixed(1);
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:0;">
                <span style="font-size:0.6rem;color:${isTarget ? '#22c55e' : '#94a3b8'};white-space:nowrap;">${pct}%</span>
                <div style="width:70%;height:${barH}px;background:${isTarget ? '#22c55e' : '#6366f1'};border-radius:3px 3px 0 0;transition:height 0.3s ease;"></div>
                <span style="font-size:0.55rem;color:${isTarget ? '#22c55e' : '#64748b'};display:inline-block;transform:rotate(-45deg);transform-origin:top center;margin-top:4px;white-space:nowrap;">${labels[i]}</span>
            </div>`;
        }).join('');

        const isPlaying = !!window._labPlayInterval;
        const panel = document.getElementById('grover-lab-panel');
        if (!panel) return;
        panel.innerHTML = `
            <div style="font-size:0.9rem;font-weight:700;color:#22c55e;margin-bottom:10px;">Grover Iterations Lab</div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <button onclick="window.stopLabPlay(); window._groverSetK(${Math.max(0, k - 1)})" class="hint-btn" style="padding:2px 10px;font-size:1.1rem;line-height:1.3;" ${k === 0 ? 'disabled' : ''}>−</button>
                <span style="font-size:1rem;font-weight:700;min-width:130px;text-align:center;">k = ${k} iteration${k !== 1 ? 's' : ''}</span>
                <button onclick="window.stopLabPlay(); window._groverSetK(${Math.min(8, k + 1)})" class="hint-btn" style="padding:2px 10px;font-size:1.1rem;line-height:1.3;" ${k === 8 ? 'disabled' : ''}>+</button>
                <button id="lab-play-btn" class="hint-btn" style="padding:2px 10px;font-size:1.1rem;line-height:1.3;background:#22c55e;color:#0f172a;font-weight:700;" onclick="window.toggleGroverLabPlay()">${isPlaying ? '⏸' : '▶'}</button>
            </div>
            <div style="display:flex;align-items:flex-end;gap:2px;height:${chartH + 6}px;padding:0 2px;border-bottom:1px solid #334155;">
                ${barsHTML}
            </div>
            <div style="height:28px;"></div>
            <div style="margin-top:4px;font-size:0.8rem;color:#94a3b8;">
                P(|111⟩) = sin²((2·${k}+1)·θ) ≈ <span style="color:#22c55e;font-weight:700;">${(pTarget * 100).toFixed(1)}%</span>
                &nbsp;·&nbsp; θ = arcsin(1/√8) ≈ ${(θ * 180 / Math.PI).toFixed(1)}°
            </div>
            <div style="margin-top:3px;font-size:0.75rem;color:#64748b;">Search target: |111⟩ &nbsp;·&nbsp; Optimal k = 2 → P(|111⟩) ≈ ${(Math.sin(5 * θ) ** 2 * 100).toFixed(1)}%</div>
        `;
    }

    window._groverSetK = newK => { k = newK; window._groverCurrentK = newK; renderGroverLab(); };
    window._groverCurrentK = k;

    let panel = document.getElementById('grover-lab-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'grover-lab-panel';
        panel.style.cssText = 'margin-top:10px;padding:12px;background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.25);border-radius:8px;';
        const hintText = document.getElementById('hint-text');
        if (hintText) hintText.parentNode.insertBefore(panel, hintText.nextSibling);
        else document.getElementById('instructions').appendChild(panel);
    }
    panel.style.display = 'block';
    renderGroverLab();
};
window.showQftExplanation = () => {
    const el = document.getElementById('qft-lab-explanation');
    el.innerHTML = parseMarkdownAndMath(el.innerHTML);
    el.classList.remove('hidden');
    document.getElementById('qft-explain-btn').classList.add('hidden');
};

// A lightweight seeded PRNG
function getSeededRandom(seed) {
    return function() {
        var t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// A local version of the angle formatter that accepts our custom RNG
function formatAngleGateSeeded(gNext, rng) {
    if (gNext.startsWith('RZ') || gNext.startsWith('CP')) {
        let angles = ['PI', 'PI2', 'PI4', 'PI8', 'MINUS_PI2', 'MINUS_PI4', 'MINUS_PI8'];
        let randAngle = angles[Math.floor(rng() * angles.length)];
        let prefix = gNext.startsWith('RZ') ? 'RZ' : 'CP';
        let qSuffix = gNext.startsWith('RZ') ? gNext.slice(-1) : gNext.slice(-2);
        return `${prefix}_${randAngle}_${qSuffix}`;
    }
    return gNext;
}

function showMainMenu() {
    pushRoute('#/');
    document.getElementById('game-view').style.display = 'none';
    state.isDuelMode = false;
    buildMenu();
    document.getElementById('main-menu').style.display = 'flex';
    showModeCards();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (state.tutorialJustCompleted) {
        state.tutorialJustCompleted = false;
        setTimeout(() => {
            const learnCard = document.querySelector('.mode-card[data-mode="learn"]');
            if (learnCard) {
                learnCard.classList.add('ghost-pulse');
                learnCard.style.position = 'relative';
                const msg = document.createElement('div');
                msg.className = 'ghost-text';
                msg.innerText = 'Start your quantum journey here!';
                learnCard.appendChild(msg);
                setTimeout(() => {
                    learnCard.classList.remove('ghost-pulse');
                    learnCard.style.position = '';
                    msg.remove();
                }, 5000);
            }
        }, 400);
    }
}

// --- Main Menu Initialization ---
function buildMenu() {
    // 1. Update the Global Stats Bar
    document.getElementById('menu-total-points').innerText = totalPoints;
    document.getElementById('menu-highest-streak').innerText = highestStreak;
    const _ds = parseInt(localStorage.getItem('quiver_daily_streak') || '0');
    document.getElementById('menu-daily-streak').innerText = _ds;
    document.getElementById('menu-daily-streak-s').innerText = _ds === 1 ? '' : 's';

    // 2. Build the Stages — board-game snake path (boustrophedon)
    const container = document.getElementById('stages-container');
    container.innerHTML = '';

    const SECTION_STYLES = {
        'Foundations':       { color: '#3b82f6', bg: 'rgba(59,130,246,0.13)',  border: 'rgba(59,130,246,0.4)',  icon: '🧩' },
        'Multi-Qubit Gates': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.13)', border: 'rgba(139,92,246,0.4)', icon: '🔗' },
        'Quantum Protocols': { color: '#06b6d4', bg: 'rgba(6,182,212,0.13)',   border: 'rgba(6,182,212,0.4)',   icon: '🔬' },
        'Phase & QFT':       { color: '#f59e0b', bg: 'rgba(245,158,11,0.13)',  border: 'rgba(245,158,11,0.4)',  icon: '🌀' },
        'Quantum Algorithms':{ color: '#22c55e', bg: 'rgba(34,197,94,0.13)',   border: 'rgba(34,197,94,0.4)',   icon: '🔍' },
    };

    // Layout — x in SVG viewBox units 0–100 (= CSS %), y in px
    // 3 columns so labels fit; corners arc to the container edge
    const NODES_PER_ROW = 3;
    const X_POS   = [20, 50, 80];   // column x positions (%)
    const NODE_R  = 22;              // node circle radius (px)
    const ROW_H   = 96;             // vertical spacing between rows (px)
    const SECT_H  = 54;              // section banner height (px)
    const SECT_PAD = 18;             // gap after section banner (px)
    const PAD_TOP  = 20;

    let y = PAD_TOP, nodeInRow = 0, rowDir = 1;  // rowDir: +1 = L→R, -1 = R→L
    let curSection = null, curStyle = null;
    const items = [], pathPts = [];

    STAGES.forEach((stage, sIdx) => {
        if (stage.section !== curSection) {
            // Pad incomplete row so each section always starts on a fresh row
            if (nodeInRow > 0) { y += ROW_H; nodeInRow = 0; rowDir = -rowDir; }
            curSection = stage.section;
            curStyle   = SECTION_STYLES[curSection] || { color: '#64748b', bg: 'rgba(100,116,139,0.13)', border: 'rgba(100,116,139,0.4)', icon: '●' };
            items.push({ type: 'section', name: curSection, style: curStyle, y, h: SECT_H });
            y += SECT_H + SECT_PAD;
        }

        stage.levels.forEach((lvl, lIdx) => {
            const xIdx = rowDir > 0 ? nodeInRow : (NODES_PER_ROW - 1 - nodeInRow);
            const nx = X_POS[xIdx];
            const ny = y + NODE_R;
            items.push({ type: 'node', name: lvl.name, nx, ny, done: completedStages.includes(`${sIdx}-${lIdx}`), sIdx, lIdx, color: curStyle.color });
            pathPts.push({ x: nx, y: ny, color: curStyle.color });
            nodeInRow++;
            if (nodeInRow >= NODES_PER_ROW) { nodeInRow = 0; rowDir = -rowDir; y += ROW_H; }
        });
    });
    if (nodeInRow > 0) y += ROW_H;
    const totalH = y + PAD_TOP;

    // ── SVG path ─────────────────────────────────────────────────────────────
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 100 ${totalH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', String(totalH));
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:1;overflow:visible;';

    function drawPath(pts, stroke, width, opacity) {
        if (pts.length < 2) return;
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i-1], q = pts[i];
            if (p.y === q.y) {
                // Same row — straight horizontal segment
                d += ` L ${q.x} ${q.y}`;
            } else if (p.x === q.x) {
                // Corner turn (same column, different row) — arc outward to container edge
                const b = p.x > 50 ? 20 : -20;
                d += ` C ${p.x+b} ${p.y} ${q.x+b} ${q.y} ${q.x} ${q.y}`;
            } else {
                // Cross-section bridge — S-curve
                const m = (p.y + q.y) / 2;
                d += ` C ${p.x} ${m} ${q.x} ${m} ${q.x} ${q.y}`;
            }
        }
        const el = document.createElementNS(svgNS, 'path');
        el.setAttribute('d', d);
        el.setAttribute('fill', 'none');
        el.setAttribute('stroke', stroke);
        el.setAttribute('stroke-width', String(width));
        el.setAttribute('stroke-opacity', String(opacity));
        el.setAttribute('stroke-linecap', 'round');
        el.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(el);
    }

    drawPath(pathPts, '#1e3a5f', 10, 1);  // deep shadow
    drawPath(pathPts, '#334155', 6,  1);  // base rail

    // Per-section colour overlay
    let si = 0;
    while (si < pathPts.length) {
        const col = pathPts[si].color;
        let ei = si + 1;
        while (ei < pathPts.length && pathPts[ei].color === col) ei++;
        const seg = pathPts.slice(si, ei);
        if (seg.length >= 2) drawPath(seg, col, 3, 0.7);
        si = ei;
    }

    // ── HTML overlay ──────────────────────────────────────────────────────────
    const mapEl = document.createElement('div');
    mapEl.className = 'learn-map';
    mapEl.style.height = `${totalH}px`;
    mapEl.appendChild(svg);

    items.forEach(item => {
        if (item.type === 'section') {
            const el = document.createElement('div');
            el.className = 'map-section-banner';
            el.style.cssText = `top:${item.y}px;height:${item.h}px;background:${item.style.bg};border-color:${item.style.border};color:${item.style.color};`;
            el.innerHTML = `<span>${item.style.icon}</span><span>${item.name}</span>`;
            mapEl.appendChild(el);
        } else {
            const dot = document.createElement('div');
            dot.className = 'map-node-dot' + (item.done ? ' done' : '');
            dot.style.cssText = `left:${item.nx}%;top:${item.ny}px;--nc:${item.color};`;
            dot.textContent = item.done ? '✓' : '';
            dot.onclick = () => initGame('STAGE', item.sIdx, item.lIdx);
            mapEl.appendChild(dot);

            const lbl = document.createElement('div');
            lbl.className = 'map-node-label' + (item.done ? ' done' : '');
            lbl.style.cssText = `left:${item.nx}%;top:${item.ny + NODE_R + 5}px;`;
            lbl.textContent = item.name.replace(/^[\d\.]+[\.:]?\s*/, '');
            lbl.onclick = () => initGame('STAGE', item.sIdx, item.lIdx);
            mapEl.appendChild(lbl);
        }
    });

    container.appendChild(mapEl);
    
    // --- NEW: Daily Puzzle Tracking ---
    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    
    // Fetch saved daily data, or create a fresh slate if it doesn't exist
    let dailyStatus = JSON.parse(localStorage.getItem('quiver_daily') || '{"date":"","completed":[]}');
    
    // If the saved date isn't today, wipe the completed array clean!
    if (dailyStatus.date !== today) {
        dailyStatus = { date: today, completed: [] };
        localStorage.setItem('quiver_daily', JSON.stringify(dailyStatus));
    }

    // Apply the checkmarks and green color to finished daily buttons
    [1, 2, 3].forEach(lvl => {
        const btn = document.getElementById(`btn-daily-${lvl}`);
        if (btn) {
            let baseText = btn.innerText.replace('✓ ', ''); // Prevent duplicate checkmarks
            if (dailyStatus.completed.includes(lvl)) {
                btn.classList.add('completed');
                btn.innerText = `✓ ${baseText}`;
            } else {
                btn.classList.remove('completed');
                btn.innerText = baseText;
            }
        }
    });

    // Update timed best scores in menu
    [1, 2, 3].forEach(lvl => {
        const bestEl = document.getElementById(`timed-best-${lvl}`);
        if (bestEl) {
            const best = timedBest[lvl - 1];
            bestEl.innerText = best > 0 ? `Best: ${best}` : 'Best: —';
        }
    });

    // Update achievements card description
    const _achUnlocked = unlockedAchievements.size;
    const _achCard = document.getElementById('ach-card-desc');
    if (_achCard) _achCard.innerText = `${_achUnlocked} / ${ACHIEVEMENTS.length} unlocked`;
}

const GATE_MASK_ORDER = ['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX'];
const GATE_CHECKBOX_IDS = { X:'chk-x', Y:'chk-y', Z:'chk-z', H:'chk-h', SX:'chk-sx', RZ:'chk-rz', CX:'chk-cx', CP:'chk-cp', SWAP:'chk-swap', CCX:'chk-ccx' };

// --- Logic Helpers ---
function expandGateSet(baseGates, numQubits) {
    let expanded = [];
    baseGates.forEach(g => {
        if (['X', 'Y', 'Z', 'H', 'SX', 'RZ'].includes(g)) {
            for (let i = 0; i < numQubits; i++) expanded.push(`${g}${i}`);
        } else if (['CX', 'CP', 'SWAP'].includes(g)) {
            if (numQubits > 1) {
                for (let i = 0; i < numQubits; i++) {
                    for (let j = 0; j < numQubits; j++) {
                        if (i !== j) expanded.push(`${g}${i}${j}`);
                    }
                }
            }
        } else if (g === 'CCX') {
            if (numQubits > 2) {
                expanded.push('CCX012', 'CCX021', 'CCX120');
            }
        }
    });
    return expanded;
}

// --- Game Initialization ---
function initGame(mode, p1, p2) {
    window.stopLabPlay?.();
    if (mode === 'RANDOM') {
        let selectedBaseGates = Array.from(document.querySelectorAll('#play-gate-selection input:checked')).map(cb => cb.value);
        if (selectedBaseGates.length === 0) {
            alert("Please select at least one gate before starting!");
            return;
        }
    }

    if (mode === 'STAGE')         pushRoute(`#/learn/${p1}/${p2 + 1}`);  // 1-based level
    else if (mode === 'RANDOM')   pushRoute(`#/random/${p1}`);
    else if (mode === 'DAILY')    pushRoute(`#/daily/${p1}`);
    else if (mode === 'TIMED')    pushRoute(`#/timed/${p1}`);
    else if (mode === 'FREEPLAY') pushRoute(`#/sandbox/${p1}`);

    if (!state.isTutorial) state.tutorialJustCompleted = false;
    state.selectedBaseGate = null;

    document.getElementById('main-menu').style.display = 'none';
    hideVictoryModal();
    document.getElementById('game-view').style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    state.currentMode = mode;
    let instructions = document.getElementById('instructions-text');
    let submitBtn = document.getElementById('submit-btn');
    let targetBox = document.getElementById('target-container');
    let liveBox = document.getElementById('live-state-container');
    let clearBtn = document.getElementById('clear-btn');
    
    submitBtn.classList.remove('hidden');
    document.getElementById('next-btn').classList.add('hidden');
    document.getElementById('again-btn').classList.add('hidden');
    document.getElementById('restart-btn').classList.add('hidden');
    submitBtn.disabled = false;
    
    const stageNav = document.getElementById('stage-nav');
    if (mode === 'STAGE') {
        stageNav.classList.remove('hidden');
    } else {
        stageNav.classList.add('hidden');
    }

    if (mode === 'STAGE') {
        clearBtn.classList.add('hidden');
        state.currentP1 = p1;
        state.currentP2 = p2;
        let stage = STAGES[p1];
        let lvl = stage.levels[p2];

        const isFirst = (p1 === 0 && p2 === 0);
        const isLast = (p1 === STAGES.length - 1 && p2 === STAGES[p1].levels.length - 1);
        document.getElementById('stage-prev-btn').disabled = isFirst;
        document.getElementById('stage-next-btn').disabled = isLast;
        state.numQubits = lvl.qubits || stage.qubits;
        state.numCols = lvl.cols || stage.cols;
        state.activeSet = lvl.set || stage.set;
        state.secretCircuits = lvl.circuits;
        
        let isStrict = (p1 >= 4);
        let rulesText = isStrict ? "<br><span style='color:#ef4444; font-size:0.85rem; font-weight:bold;'>Strict Mode: A canonical implementation is required!</span>" : "";
        let lessonHTML = lvl.lesson ? `<button id="lesson-btn" class="hint-btn" style="background:#059669;" onclick="showLesson()">Read Lesson</button><div id="lesson-text" class="lesson-text hidden">${lvl.lesson}</div>` : "";
        let labBtnHTML = p1 === 8 ? `<button class="hint-btn" style="background:#f59e0b;" onclick="tryQftLab()">Try the QFT</button>`
                       : p1 === 9 ? `<button class="hint-btn" style="background:#f59e0b;" onclick="tryAdderLab()">Try the QFT Adder</button>`
                       : (p1 === 11 && state.currentP2 === 2) ? `<button class="hint-btn" style="background:#22c55e;color:#0f172a;" onclick="showGroverLab()">Try Grover Iterations</button>`
                       : "";

        instructions.innerHTML = `<div class="stage-breadcrumb">${stage.title}</div>
                                  <div class="stage-level-title">${lvl.name}</div>
                                  ${rulesText}
                                  <div style="margin-top:8px;">
                                    <button id="hint-btn" class="hint-btn" onclick="showHint()">Show Hint</button>
                                    ${lessonHTML}
                                    ${labBtnHTML}
                                  </div>
                                  <div id="hint-text" class="hint-text hidden">Hint: ${lvl.hint}</div>`;
        targetBox.style.display = 'block';
        liveBox.style.display = 'none';
        
    } else if (mode === 'RANDOM' || mode === 'DAILY') {
        clearBtn.classList.add('hidden');
        state.currentLvl = p1;
        state.numQubits = LEVELS[p1].q;
        state.numCols = LEVELS[p1].g;
        
        let rng; // We will assign either Math.random or our daily seeded PRNG to this

        if (mode === 'DAILY') {
            const now = new Date();
            // Seed based on Year, Month, Day, and the puzzle difficulty (1, 2, or 3)
            const seed = now.getFullYear() * 100000 + (now.getMonth() + 1) * 1000 + now.getDate() * 10 + p1;
            rng = getSeededRandom(seed);
            
            // Daily uses ALL gates, ignoring user selection
            state.activeSet = expandGateSet(['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX'], state.numQubits);
            instructions.innerHTML = `<div class="stage-breadcrumb">Daily Puzzle</div><div class="stage-level-title">${['Easy', 'Medium', 'Hard'][p1-1]}</div><div class="stage-subtitle">Equivalent circuits win! Resets at midnight.</div>`;
        } else {
            if (state._usePresetSeed) {
                state._usePresetSeed = false;
            } else {
                state.randomSeed = Math.floor(Math.random() * 900000) + 100000;
            }
            rng = getSeededRandom(state.randomSeed);
            let selectedBaseGates = Array.from(document.querySelectorAll('#play-gate-selection input:checked')).map(cb => cb.value);
            state.activeSet = expandGateSet(selectedBaseGates, state.numQubits);

            if (state.activeSet.length === 0) {
                state.activeSet = expandGateSet(['X', 'H'], state.numQubits);
                selectedBaseGates = ['X', 'H'];
            }
            // Encode selected gates as bitmask for challenge sharing
            state.randomGateMask = selectedBaseGates.reduce((mask, g) => {
                const idx = GATE_MASK_ORDER.indexOf(g);
                return idx >= 0 ? mask | (1 << idx) : mask;
            }, 0);
            instructions.innerHTML = `<div class="stage-breadcrumb">Random Puzzle</div><div class="stage-level-title">${['Easy', 'Medium', 'Hard'][p1-1]}</div><div class="stage-subtitle">Guess the circuit. Equivalent circuits win!</div>`;
        }
        
        generateMatrices(state.numQubits);
        let generatedCircuit = [];
        let activeLength = Math.floor(rng() * (state.numCols - LEVELS[p1].minActive + 1)) + LEVELS[p1].minActive;
        let singleQSet = state.activeSet.filter(g => getOccupiedQubits(g).length === 1);
        let singleGatesToPlace = 2;
        let randRunningState = computeStateVector([], state.numQubits, GATE_MATRICES);

        for (let i = 0; i < state.numCols; i++) {
            if (i < activeLength) {
                let col = [];
                let placedThisCol = 0;
                const isNonTrivial = (g) => !statesMatch(
                    computeStateVector([[g]], state.numQubits, GATE_MATRICES, randRunningState),
                    randRunningState, state.numQubits
                );

                if (singleGatesToPlace > 0 && singleQSet.length > 0) {
                    let g = formatAngleGateSeeded(singleQSet[Math.floor(rng() * singleQSet.length)], rng);
                    if (isNonTrivial(g)) { col.push(g); singleGatesToPlace--; placedThisCol++; }

                    if (singleGatesToPlace > 0 && state.numQubits >= 2) {
                        let g2 = formatAngleGateSeeded(singleQSet[Math.floor(rng() * singleQSet.length)], rng);
                        if (canFit(col, g2) && isNonTrivial(g2)) {
                            col.push(g2);
                            singleGatesToPlace--;
                            placedThisCol++;
                        }
                    }
                } else {
                    let baseGate = formatAngleGateSeeded(state.activeSet[Math.floor(rng() * state.activeSet.length)], rng);
                    if (isNonTrivial(baseGate)) { col.push(baseGate); placedThisCol++; }
                }

                for(let a=placedThisCol; a<state.numQubits; a++) {
                    if(rng() > 0.5) {
                        let gNext = formatAngleGateSeeded(state.activeSet[Math.floor(rng() * state.activeSet.length)], rng);
                        if(canFit(col, gNext) && isNonTrivial(gNext)) col.push(gNext);
                    }
                }
                randRunningState = computeStateVector([col], state.numQubits, GATE_MATRICES, randRunningState);
                generatedCircuit.push(col);
            } else generatedCircuit.push([]);
        }

        // Safety fallback: if all gates were trivial, ensure at least one non-trivial gate
        const zeroState = computeStateVector([], state.numQubits, GATE_MATRICES);
        if (statesMatch(computeStateVector(generatedCircuit, state.numQubits, GATE_MATRICES), zeroState, state.numQubits)) {
            generatedCircuit[0] = ['H0'];
        }

        state.secretCircuits = [generatedCircuit];
        targetBox.style.display = 'block';
        liveBox.style.display = 'none';

    } else if (mode === 'TIMED') {
        const isContinuingTimedSession = state._timerIntervalId !== null;

        clearBtn.classList.add('hidden');
        state.currentLvl = p1;
        state.numQubits = LEVELS[p1].q;
        state.numCols = LEVELS[p1].g;
        state.activeSet = expandGateSet(['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX'], state.numQubits);

        if (!isContinuingTimedSession) {
            if (!state.isDuelMode) state.duelSeed = Math.floor(Math.random() * 900000) + 100000;
            state.timedCircuitIndex = 0;
            state.timedScore = 0;
            state.timedCircuitsSolved = 0;
        }
        const timedRng = getSeededRandom(state.duelSeed * 1000 + state.timedCircuitIndex);
        generateMatrices(state.numQubits);
        let timedCircuit = [];
        let timedActiveLength = Math.floor(timedRng() * (state.numCols - LEVELS[p1].minActive + 1)) + LEVELS[p1].minActive;
        let timedSingleQSet = state.activeSet.filter(g => getOccupiedQubits(g).length === 1);
        let timedSingleToPlace = 2;
        let timedRunningState = computeStateVector([], state.numQubits, GATE_MATRICES);
        for (let i = 0; i < state.numCols; i++) {
            if (i < timedActiveLength) {
                let col = [];
                let placed = 0;
                const isNonTrivialTimed = (g) => !statesMatch(
                    computeStateVector([[g]], state.numQubits, GATE_MATRICES, timedRunningState),
                    timedRunningState, state.numQubits
                );
                if (timedSingleToPlace > 0 && timedSingleQSet.length > 0) {
                    let g = formatAngleGateSeeded(timedSingleQSet[Math.floor(timedRng() * timedSingleQSet.length)], timedRng);
                    if (isNonTrivialTimed(g)) { col.push(g); timedSingleToPlace--; placed++; }
                    if (timedSingleToPlace > 0 && state.numQubits >= 2) {
                        let g2 = formatAngleGateSeeded(timedSingleQSet[Math.floor(timedRng() * timedSingleQSet.length)], timedRng);
                        if (canFit(col, g2) && isNonTrivialTimed(g2)) { col.push(g2); timedSingleToPlace--; placed++; }
                    }
                } else {
                    let g = formatAngleGateSeeded(state.activeSet[Math.floor(timedRng() * state.activeSet.length)], timedRng);
                    if (isNonTrivialTimed(g)) { col.push(g); placed++; }
                }
                for (let a = placed; a < state.numQubits; a++) {
                    if (timedRng() > 0.5) {
                        let gNext = formatAngleGateSeeded(state.activeSet[Math.floor(timedRng() * state.activeSet.length)], timedRng);
                        if (canFit(col, gNext) && isNonTrivialTimed(gNext)) col.push(gNext);
                    }
                }
                timedRunningState = computeStateVector([col], state.numQubits, GATE_MATRICES, timedRunningState);
                timedCircuit.push(col);
            } else timedCircuit.push([]);
        }

        // Safety fallback: if all gates were trivial, ensure at least one non-trivial gate
        const timedZeroState = computeStateVector([], state.numQubits, GATE_MATRICES);
        if (statesMatch(computeStateVector(timedCircuit, state.numQubits, GATE_MATRICES), timedZeroState, state.numQubits)) {
            timedCircuit[0] = ['H0'];
        }

        state.secretCircuits = [timedCircuit];

        const diffNames = ['Easy', 'Medium', 'Hard'];
        instructions.innerHTML = `<div class="stage-breadcrumb">Time Collapse</div><div class="stage-level-title">${diffNames[p1 - 1]}</div><div class="stage-subtitle">Solve as many circuits as possible! +20s per solve, −5s per wrong attempt.</div>`;
        targetBox.style.display = 'block';
        liveBox.style.display = 'none';

        if (isContinuingTimedSession) {
            updateTimedStatusBar(state);
        } else {
            state._timedSessionEnded = false;
            state.timerRemaining = state.currentLvl === 3 ? 60 : 30;
            updateTimedStatusBar(state);
            state._timerIntervalId = setInterval(() => {
                state.timerRemaining--;
                updateTimedStatusBar(state);
                if (state.timerRemaining <= 0) {
                    endTimedSession();
                }
            }, 1000);
        }

        state.timedNextPuzzle = () => {
            if (state._timedSessionEnded || state.timerRemaining <= 0) return;
            initGame('TIMED', state.currentLvl);
        };
        state.timedEndSession = endTimedSession;

    } else if (mode === 'FREEPLAY') {
        clearBtn.classList.remove('hidden');
        state.numQubits = p1;
        state.numCols = 8;
        state.activeSet = expandGateSet(['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX'], state.numQubits);
        state.secretCircuits = [[]];
        
        instructions.innerHTML = `<div class="stage-breadcrumb">Sandbox</div><div class="stage-level-title">${state.numQubits} Qubit${state.numQubits>1?'s':''}</div><div class="stage-subtitle">Experiment freely. Click evaluate to take a snapshot of the state!</div>`;
        targetBox.style.display = 'none';
        liveBox.style.display = 'block';

    } else if (mode === 'LAB') {
        clearBtn.classList.add('hidden');
        stageNav.classList.add('hidden');
        const phaseCols = LAB_CONFIGS[p1];
        state.labTargetN = p1;
        state.currentP1 = 9;
        state.currentP2 = 0;
        state.numQubits = 3;
        state.numCols = 5;
        state.activeSet = ['RZ', 'QFT', 'IQFT'];
        state.secretCircuits = [[[], ['QFT'], phaseCols[0], phaseCols[1], ['IQFT']]];

        const numBtns = [1,2,3,4,5,6,7].map(i => {
            const sel = i === p1;
            return `<button class="hint-btn lab-num-btn" data-n="${i}" onclick="window.stopLabPlay(); window.selectLabNumber(${i})" style="background:${sel?'#d97706':'#f59e0b'};color:#0f172a;font-weight:700;${sel?'outline:2px solid #fbbf24;outline-offset:1px;':''}">${i}</button>`;
        }).join('');
        instructions.innerHTML = `
            <div class="stage-breadcrumb">QFT Adder Lab</div>
            <div class="stage-level-title">Add n to |0⟩</div>
            <div class="stage-subtitle">Click a number — the circuit fills with the Fourier encoding:</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin:8px 0 6px;align-items:center;">
                ${numBtns}
                <button id="lab-play-btn" class="hint-btn" style="background:#d97706;color:#0f172a;font-weight:700;" onclick="window.toggleAdderLabPlay()">▶</button>
            </div>
            <div>
                <button class="hint-btn" onclick="document.getElementById('lab-formula-text').classList.toggle('hidden')">Phase Formula</button>
                <button class="hint-btn" style="background:#3b82f6;margin-left:5px;" onclick="document.getElementById('lab-gates-text').classList.toggle('hidden')">Reveal Gates</button>
                <button class="hint-btn" style="background:#475569;margin-left:5px;" onclick="window.labGoBack()">← Back</button>
            </div>
            <div id="lab-formula-text" class="hint-text hidden">Phase for qubit j = 2π × n / 2^(j+1), where j=0 is top qubit (mod 2π).</div>
            <div id="lab-gates-text" class="hint-text hidden">${LAB_HINTS[p1]}</div>`;
        targetBox.style.display = 'block';
        liveBox.style.display = 'none';

    } else if (mode === 'QFT_LAB') {
        clearBtn.classList.add('hidden');
        stageNav.classList.add('hidden');
        state.labTargetN = p1;
        state.currentP1 = 8;
        state.currentP2 = 0;
        state.numQubits = 3;
        state.numCols = 4;
        state.activeSet = ['X', 'QFT'];
        state.secretCircuits = [[QFT_LAB_CONFIGS[p1], ['QFT'], [], []]];

        const numBtns = [0,1,2,3,4,5,6,7].map(i => {
            const sel = i === p1;
            return `<button class="hint-btn lab-num-btn" data-n="${i}" onclick="window.stopLabPlay(); window.selectQftInput(${i})" style="background:${sel?'#d97706':'#f59e0b'};color:#0f172a;font-weight:700;${sel?'outline:2px solid #fbbf24;outline-offset:1px;':''}">${i}</button>`;
        }).join('');
        const qftExplanation = "**The Clock Analogy**\n\nAfter QFT, each qubit sits on the equator of the Bloch sphere in the state (|0⟩ + e^(iφ)|1⟩)/√2. Every qubit is a clock hand pointing at a specific phase angle φ. As n increases by 1, each qubit's hand rotates by a different amount:\n\n* **q₀ (top)** — rotates 45° per step. The slowest clock: 8 different angles across n = 0 → 7.\n* **q₁ (middle)** — rotates 90° per step, for a total of 4 angles per round.\n* **q₂ (bottom)** — rotates 180° per step. The fastest clock, with only 2 cycles.\n\nStep through n = 0 → 7 and watch the Bloch spheres. Each n produces a unique combination of three phase angles — a frequency fingerprint. No two inputs share the same set of clock positions.\n\nThis is why QFT is powerful: it encodes a number into the phase dimension. The IQFT reads the fingerprint back as a binary count — which is exactly what QPE does to measure an eigenphase.";
        instructions.innerHTML = `
            <div class="stage-breadcrumb">QFT Lab</div>
            <div class="stage-level-title">QFT Visualization</div>
            <div class="stage-subtitle">Pick a basis state — see how QFT maps it to the Fourier space:</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin:8px 0 6px;align-items:center;">
                ${numBtns}
                <button id="lab-play-btn" class="hint-btn" style="background:#d97706;color:#0f172a;font-weight:700;" onclick="window.toggleQftLabPlay()">▶</button>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
                <button id="qft-explain-btn" class="hint-btn" style="background:#059669;" onclick="showQftExplanation()">Read Explanation</button>
                <button class="hint-btn" style="background:#475569;" onclick="window.qftLabGoBack()">← Back</button>
            </div>
            <div id="qft-lab-explanation" class="lesson-text hidden">${qftExplanation}</div>`;
        targetBox.style.display = 'none';
        liveBox.style.display = 'none';
    }

    generateMatrices(state.numQubits);
    if (state.numQubits === 3) document.getElementById('board').classList.add('hard-mode');
    else document.getElementById('board').classList.remove('hard-mode');
    
    let hasAngleGate = state.activeSet.some(g => g.startsWith('RZ') || g.startsWith('CP'));
    let angleContainer = document.getElementById('rz-angle-container');
    if(angleContainer) angleContainer.style.display = hasAngleGate ? 'inline-block' : 'none';
    
    if (mode !== 'FREEPLAY' && mode !== 'QFT_LAB') {
        state.targetState = computeStateVector(state.secretCircuits[0], state.numQubits, GATE_MATRICES);
        document.getElementById('target-amplitudes').innerText = "|ψ⟩ = " + stateToString(state.targetState, state.numQubits);

        // --- NEW: Render the Target Bloch Sphere ---
        updateTargetBlochSphere(state.targetState, state.numQubits);
    } else {
        updateTargetBlochSphere(null, state.numQubits);
    }
    
    state.currentGuess = Array(state.numCols).fill().map(() => []);
    if (mode === 'LAB') {
        state.currentGuess[1] = ['QFT'];
        state.currentGuess[4] = ['IQFT'];
    } else if (mode === 'QFT_LAB') {
        state.currentGuess[0] = [...QFT_LAB_CONFIGS[p1]];
        state.currentGuess[1] = ['QFT'];
    }
    state.attempts = 0;
    gameStartTime = Date.now();
    trackGameStart(state.currentMode, state.currentP1, state.currentP2, state.currentLvl,
        (mode !== 'FREEPLAY' && mode !== 'QFT_LAB') ? state.targetState : null,
        state.secretCircuits[0] || null,
        state.activeSet);
    state.gameOver = false;
    document.getElementById('message').innerText = "";
    
    // --- NEW: Force a hard wipe of the DOM for the new game ---
    document.getElementById('board').innerHTML = '';
    const historyBoard = document.getElementById('history-board');
    if (historyBoard) historyBoard.innerHTML = ''; 
    // Use querySelectorAll to catch any and all lingering canonical circuits
    document.querySelectorAll('#reveal-circuit-wrap').forEach(el => el.remove());

    renderDynamicCanvases(state.numQubits);
    renderPalette();
    renderBoard();
    updateBlochSpheres(state.currentGuess, state.numQubits);

    if (!tutorialComplete && !tutorialPromptShown && mode !== 'TIMED' && mode !== 'FREEPLAY' && mode !== 'LAB' && mode !== 'QFT_LAB') {
        tutorialPromptShown = true;
        setTimeout(() => {
            if (state.gameOver) return;
            showTutorialPrompt(
                () => {
                    state.isTutorial = true;
                    state.tutorialPhase = 'SELECT_GATE';
                    setGhostPointer('PALETTE_ANY');
                },
                () => { setTutorialComplete(); }
            );
        }, 400);
    }
}

window.initLabGame = n => initGame('LAB', n);
window.initDailyGame = n => initGame('DAILY', n);

window.selectLabNumber = function(n) {
    if (state.currentMode !== 'LAB') return;
    const phaseCols = LAB_CONFIGS[n];
    state.labTargetN = n;
    state.currentGuess[2] = [...phaseCols[0]];
    state.currentGuess[3] = [...phaseCols[1]];

    const correctCircuit = [[], ['QFT'], phaseCols[0], phaseCols[1], ['IQFT']];
    state.targetState = computeStateVector(correctCircuit, 3, GATE_MATRICES);
    document.getElementById('target-amplitudes').innerText = '|ψ⟩ = ' + stateToString(state.targetState, 3);
    updateTargetBlochSphere(state.targetState, 3);

    state.gameOver = false;
    document.getElementById('submit-btn').classList.remove('hidden');
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('message').innerText = '';
    document.getElementById('row-active')?.querySelectorAll('.amplitudes-result').forEach(el => el.remove());

    renderBoard();
    updateBlochSpheres(state.currentGuess, 3);

    const gatesHint = document.getElementById('lab-gates-text');
    if (gatesHint) gatesHint.innerText = LAB_HINTS[n];

    document.querySelectorAll('.lab-num-btn').forEach(btn => {
        const active = parseInt(btn.dataset.n) === n;
        btn.style.background = active ? '#d97706' : '#f59e0b';
        btn.style.outline = active ? '2px solid #fbbf24' : 'none';
    });
};

window.labGoBack = function() {
    initGame('STAGE', 9, state.labFromP2);
};

window.initQftLab = n => initGame('QFT_LAB', n);

window.selectQftInput = function(n) {
    if (state.currentMode !== 'QFT_LAB') return;
    state.labTargetN = n;
    state.currentGuess[0] = [...QFT_LAB_CONFIGS[n]];
    state.currentGuess[1] = ['QFT'];

    state.gameOver = false;
    document.getElementById('submit-btn').classList.remove('hidden');
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('message').innerText = '';
    document.getElementById('row-active')?.querySelectorAll('.amplitudes-result').forEach(el => el.remove());

    renderBoard();
    updateBlochSpheres(state.currentGuess, 3);

    document.querySelectorAll('.lab-num-btn').forEach(btn => {
        const active = parseInt(btn.dataset.n) === n;
        btn.style.background = active ? '#d97706' : '#f59e0b';
        btn.style.outline = active ? '2px solid #fbbf24' : 'none';
    });
};

window.qftLabGoBack = function() {
    initGame('STAGE', 8, state.qftLabFromP2);
};

// --- Render Core ---

const GATE_TIPS = {
    X:    'Pauli-X (NOT): Flips |0⟩ ↔ |1⟩. The quantum bit flip.',
    Y:    'Pauli-Y: Combines bit flip and phase flip.',
    Z:    'Pauli-Z: Phase flip — leaves |0⟩ unchanged, negates |1⟩.',
    H:    'Hadamard: Creates equal superposition.\n|0⟩ → (|0⟩+|1⟩)/√2',
    SX:   '√X: Half a bit flip. Creates partial superposition.',
    RZ:   'RZ(θ): Rotation around Z-axis by θ. Adds relative phase between |0⟩ and |1⟩.',
    CX:   'CNOT: Flips target qubit only when control is |1⟩. Generates entanglement.',
    CP:   'Controlled Phase: Adds phase to the |11⟩ state. Used in QFT.',
    SWAP: 'SWAP: Exchanges the full states of two qubits.',
    CCX:  'Toffoli: 3-qubit gate. Flips target only when both controls are |1⟩.',
    QFT:  'Quantum Fourier Transform: The quantum analogue of the DFT. Core of many algorithms.',
    IQFT: 'Inverse QFT: Undoes the Quantum Fourier Transform.',
    IQFT2: 'IQFT₂: 2-qubit Inverse QFT on the top two qubits. Used in QPE to decode the eigenphase.',
};

function renderPalette() {
    const palette = document.getElementById('palette');
    palette.innerHTML = '';
    const h = Math.max(60, state.numQubits * 30);

    // Extract unique base gates instead of showing all permutations
    const allBases = ['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX', 'QFT', 'IQFT', 'IQFT2'];
    const exactMatchBases = new Set(['QFT', 'IQFT', 'IQFT2']);
    const uniqueBases = allBases.filter(base =>
        exactMatchBases.has(base)
            ? state.activeSet.includes(base)
            : state.activeSet.some(g => g.startsWith(base))
    );

    uniqueBases.forEach(baseType => {
        const item = document.createElement('div');
        item.className = `palette-item tt ${state.selectedBaseGate === baseType ? 'selected' : ''}`;
        if (GATE_TIPS[baseType]) item.dataset.tooltip = GATE_TIPS[baseType];
        item.style.height = `${h}px`;
        
        // Mock a beautifully formatted gate just for the palette display
        let renderGate = baseType;
        if (baseType.startsWith('RZ')) renderGate = `RZ_${state.currentRzAngle}_0`;
        else if (baseType.startsWith('CP')) renderGate = `CP_${state.currentRzAngle}_01`;
        else if (baseType === 'CX' || baseType === 'SWAP') renderGate = `${baseType}01`;
        else if (baseType === 'CCX') renderGate = `CCX012`;
        else if (baseType === 'QFT' || baseType === 'IQFT' || baseType === 'IQFT2') renderGate = baseType;
        else renderGate = `${baseType}0`;

        // NEW: Force QFT to have mockQubits = 1 so it fits neatly in the menu
        let mockQubits = (baseType === 'QFT' || baseType === 'IQFT' || baseType === 'IQFT2') ? 1 :
                         (baseType === 'CCX' && state.numQubits > 2) ? 3 : 
                         (['CX', 'CP', 'SWAP'].includes(baseType) && state.numQubits > 1) ? 2 : 1;
        
        // FIX: Force the toolbar container wrapper to establish a strict relative context with absolute alignment flex
        item.style.position = 'relative';
        item.style.height = `${h}px`;
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'center';

        // Wrap the standard column HTML generator inside an inner layout anchor that explicitly stretches full-width
        item.innerHTML = `<div style="position: relative; width: 100%; height: 100%;">${getColumnHTML([renderGate], mockQubits)}</div>`;
        
        item.addEventListener('click', () => {
            if(state.gameOver) return;
            state.selectedBaseGate = (state.selectedBaseGate === baseType) ? null : baseType;
            state.placement = { active: false, col: null, controls: [] }; 
            renderPalette(); 

            if (state.isTutorial && state.tutorialPhase === 'SELECT_GATE') {
                state.tutorialPhase = 'PLACE_GATE';
                setGhostPointer('GRID', 0);
            }
        });
        palette.appendChild(item);
    });
}

function renderBoard() {
    const board = document.getElementById('board');
    
    // Only clear history if row-active DOESN'T exist (meaning fresh game)
    let wrap = document.getElementById('row-active');
    if (!wrap) {
        const historyBoard = document.getElementById('history-board');
        if (historyBoard) historyBoard.innerHTML = ''; 
        const oldReveal = document.getElementById('reveal-circuit-wrap');
        if (oldReveal) oldReveal.remove();
        
        wrap = document.createElement('div');
        wrap.className = `row-wrapper active`;
        wrap.id = `row-active`;
        board.appendChild(wrap);
    } else {
        wrap.innerHTML = ''; // Just clear the inside for a redraw
    }

    const attemptsCounter = document.getElementById('attempts-counter');
    const timedBar = document.getElementById('timed-status-bar');
    if (state.currentMode === 'FREEPLAY' || state.currentMode === 'LAB' || state.currentMode === 'QFT_LAB') {
        attemptsCounter.style.display = 'none';
        timedBar.classList.add('hidden');
    } else if (state.currentMode === 'TIMED') {
        attemptsCounter.style.display = 'none';
        timedBar.classList.remove('hidden');
        updateTimedStatusBar(state);
    } else {
        attemptsCounter.style.display = 'block';
        attemptsCounter.innerText = `Attempts Remaining: ${6 - state.attempts}`;
        timedBar.classList.add('hidden');
    }

    const rowHeight = Math.max(60, state.numQubits * 30);
    const sub = ['₀', '₁', '₂'];
    
    const circuitRow = document.createElement('div');
    circuitRow.className = 'circuit-row';
    circuitRow.style.height = `${rowHeight}px`;
    
    const labels = document.createElement('div');
    labels.className = 'qubit-labels';
    let lbls = '';
    for(let q=0; q<state.numQubits; q++) lbls += `<span>q${sub[q]}</span>`;
    labels.innerHTML = lbls;
    circuitRow.appendChild(labels);
    
    // Build the Grid!
    for (let c = 0; c < state.numCols; c++) {
        const slotCol = document.createElement('div');
        slotCol.className = 'slot-column';
        slotCol.id = `slot-active-${c}`; // Validator uses this to lock the board
        
        // Layer 1: The visual gates
        const gatesLayer = document.createElement('div');
        gatesLayer.style.position = 'absolute';
        gatesLayer.style.top = '0'; gatesLayer.style.left = '0'; gatesLayer.style.right = '0'; gatesLayer.style.bottom = '0';
        gatesLayer.innerHTML = getColumnHTML(state.currentGuess[c] || [], state.numQubits);
        slotCol.appendChild(gatesLayer);

        // Layer 2: The invisible interactive tap zones
        if (!state.gameOver) {
            for(let q = 0; q < state.numQubits; q++) {
                const cell = document.createElement('div');
                cell.className = 'cell-zone';
                
                // Highlight yellow if currently placing a multi-qubit gate
                if (state.placement.active && state.placement.col === c && state.placement.controls.includes(q)) {
                    cell.classList.add('pending');
                }
                
                cell.addEventListener('click', () => handleCellTap(c, q, state, renderBoard));
                slotCol.appendChild(cell);
            }
        }
        
        circuitRow.appendChild(slotCol);
    }
    wrap.appendChild(circuitRow);
}

function endTimedSession() {
    if (state._timedSessionEnded) return;
    state._timedSessionEnded = true;
    if (state._timerIntervalId) {
        clearInterval(state._timerIntervalId);
        state._timerIntervalId = null;
    }
    state.gameOver = true;
    document.getElementById('submit-btn').classList.add('hidden');

    const diffNames = ['Easy', 'Medium', 'Hard'];

    if (state.isDuelMode) {
        // Player 2 result: compare against challenger's score
        const won = state.timedScore > state.duelOpponentScore;
        const tied = state.timedScore === state.duelOpponentScore;
        const opName = state.duelOpponentName || 'Challenger';
        const resultTitle = tied ? "It's a Tie!" : (won ? '⚔️ You Win!' : '⚔️ They Win!');
        const resultSub = tied
            ? `Both scored ${state.timedScore} — dead even!`
            : (won
                ? `You beat ${opName}'s score of ${state.duelOpponentScore}!`
                : `${opName} scored ${state.duelOpponentScore} — try again!`);
        if (won && unlockAchievement('win_challenge')) {
            const _a = ACHIEVEMENT_MAP['win_challenge'];
            if (_a) setTimeout(() => showAchievementToast(_a.name, _a.icon), 900);
        }
        setTimeout(() => {
            showVictoryModal(resultTitle, resultSub,
                `Your Score: ${state.timedScore} | ${opName}: ${state.duelOpponentScore}`,
                false, null);
        }, 300);
    } else {
        // Normal session: save best + offer challenge link
        const isNewBest = saveTimedBest(state.currentLvl, state.timedScore);
        const bestScore = timedBest[state.currentLvl - 1];
        const statsText = isNewBest
            ? `Score: ${state.timedScore} 🎉 New Best!`
            : `Score: ${state.timedScore} | Best: ${bestScore}`;

        // Achievement checks for timed session
        const timedAchToasts = [];
        const timedTryUnlock = (id) => {
            if (unlockAchievement(id)) {
                const a = ACHIEVEMENT_MAP[id];
                if (a) timedAchToasts.push({ name: a.name, icon: a.icon });
            }
        };
        if (state.timedScore >= 5)  timedTryUnlock('time_bender');
        if (state.timedScore >= 15) timedTryUnlock('clock_crusher');
        timedAchToasts.forEach((t, i) => setTimeout(() => showAchievementToast(t.name, t.icon), 900 + i * 1700));

        setTimeout(() => {
            showVictoryModal(
                "Time's Up!",
                `${diffNames[state.currentLvl - 1]} — ${state.timedCircuitsSolved} circuit${state.timedCircuitsSolved !== 1 ? 's' : ''} solved`,
                statsText, false, null
            );
            // Inject "Challenge a Friend" button into the modal
            const controls = document.querySelector('#victory-modal .victory-controls');
            if (controls && !document.getElementById('modal-duel-btn')) {
                const duelBtn = document.createElement('button');
                duelBtn.id = 'modal-duel-btn';
                duelBtn.className = 'btn';
                duelBtn.style.background = '#7c3aed';
                duelBtn.innerText = '⚔️ Challenge a Friend';
                duelBtn.addEventListener('click', () => {
                    if (unlockAchievement('challenge_friend')) {
                        const _a = ACHIEVEMENT_MAP['challenge_friend'];
                        if (_a) setTimeout(() => showAchievementToast(_a.name, _a.icon), 200);
                    }
                    const url = `${window.location.origin}${window.location.pathname}?duel=${state.currentLvl}-${state.duelSeed}-${state.timedScore}`;
                    navigator.clipboard.writeText(url).then(() => {
                        duelBtn.innerText = 'Link Copied! ✓';
                        duelBtn.style.background = '#059669';
                        setTimeout(() => {
                            duelBtn.innerText = '⚔️ Challenge a Friend';
                            duelBtn.style.background = '#7c3aed';
                        }, 2500);
                    });
                });
                controls.insertBefore(duelBtn, controls.firstChild);
            }
        }, 300);
    }
}

// --- Attach Static Event Listeners ---

// 1. Menu Accordions
function showModePanel(name) {
    document.getElementById('mode-cards').classList.add('hidden');
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`panel-${name}`).classList.remove('hidden');
    if (name === 'achievements') {
        renderAchievementsPanel(unlockedAchievements, achievementProgress);
    }
}
function showModeCards() {
    document.getElementById('mode-cards').classList.remove('hidden');
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.add('hidden'));
}
document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => showModePanel(card.dataset.mode));
});
document.querySelectorAll('.panel-back-btn').forEach(btn => {
    btn.addEventListener('click', showModeCards);
});

// 2. Play Menu Configurations
document.getElementById('btn-toggle-gates').addEventListener('click', toggleAllGates);
document.getElementById('btn-score-info').addEventListener('click', () => showInfoModal());
document.getElementById('close-info-btn').addEventListener('click', () => hideInfoModal());
document.getElementById('btn-rand-1').addEventListener('click', () => initGame('RANDOM', 1));
document.getElementById('btn-rand-2').addEventListener('click', () => initGame('RANDOM', 2));
document.getElementById('btn-rand-3').addEventListener('click', () => initGame('RANDOM', 3));

// 3. Timed Menu
document.getElementById('btn-timed-1').addEventListener('click', () => initGame('TIMED', 1));
document.getElementById('btn-timed-2').addEventListener('click', () => initGame('TIMED', 2));
document.getElementById('btn-timed-3').addEventListener('click', () => initGame('TIMED', 3));

// 4. Sandbox Menu
document.getElementById('btn-free-1').addEventListener('click', () => initGame('FREEPLAY', 1));
document.getElementById('btn-free-2').addEventListener('click', () => initGame('FREEPLAY', 2));
document.getElementById('btn-free-3').addEventListener('click', () => initGame('FREEPLAY', 3));

// 4. Game Controls
document.getElementById('submit-btn').addEventListener('click', () => submitGuess(state, renderBoard));
document.getElementById('clear-btn').addEventListener('click', () => {
    if (state.gameOver || state.currentMode !== 'FREEPLAY') return;
    state.currentGuess = Array(state.numCols).fill().map(() => []);
    state.placement = { active: false, col: null, controls: [] }; // Reset placement
    
    const wrap = document.getElementById('row-active');
    if (wrap) {
        const results = wrap.querySelectorAll('.amplitudes-result');
        results.forEach(el => el.remove());
    }
    updateActiveRow(state, renderBoard); // Pass the callback!
});
function doRestartCircuit() {
    if (state.currentMode !== 'RANDOM') return;
    state.attempts = 0;
    state.gameOver = false;
    state.currentGuess = Array(state.numCols).fill().map(() => []);
    state.placement = { active: false, col: null, controls: [] };
    state.selectedBaseGate = null;

    document.getElementById('message').innerText = '';
    document.getElementById('again-btn').classList.add('hidden');
    document.getElementById('restart-btn').classList.add('hidden');
    document.getElementById('submit-btn').classList.remove('hidden');
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('board').innerHTML = '';
    document.getElementById('history-board').innerHTML = '';
    document.querySelectorAll('#reveal-circuit-wrap').forEach(el => el.remove());

    renderPalette();
    renderBoard();
    updateBlochSpheres(state.currentGuess, state.numQubits);
}
document.getElementById('restart-btn').addEventListener('click', doRestartCircuit);
document.addEventListener('restart-circuit', () => { hideVictoryModal(); doRestartCircuit(); });

document.getElementById('stage-prev-btn').addEventListener('click', () => {
    if (state.currentP2 > 0) {
        initGame('STAGE', state.currentP1, state.currentP2 - 1);
    } else if (state.currentP1 > 0) {
        const prevStage = state.currentP1 - 1;
        initGame('STAGE', prevStage, STAGES[prevStage].levels.length - 1);
    }
});
document.getElementById('stage-next-btn').addEventListener('click', () => {
    if (state.currentP2 + 1 < STAGES[state.currentP1].levels.length) {
        initGame('STAGE', state.currentP1, state.currentP2 + 1);
    } else if (state.currentP1 + 1 < STAGES.length) {
        initGame('STAGE', state.currentP1 + 1, 0);
    }
});

document.getElementById('next-btn').addEventListener('click', () => {
    if (state.currentP2 + 1 < STAGES[state.currentP1].levels.length) {
        initGame('STAGE', state.currentP1, state.currentP2 + 1);
    } else if (state.currentP1 + 1 < STAGES.length) {
        initGame('STAGE', state.currentP1 + 1, 0); 
    } else {
        showMainMenu(); 
    }
});

// 5. Palette Selectors
const rzSelect = document.getElementById('rz-angle');
if (rzSelect) {
    rzSelect.addEventListener('change', (e) => {
        state.currentRzAngle = e.target.value;
        renderPalette();
    });
}

// 6. Logo + Menu button
function goToMainMenu() {
    state.currentStreak = 0;
    if (state._timerIntervalId) { clearInterval(state._timerIntervalId); state._timerIntervalId = null; }
    showMainMenu();
}
const gameLogo = document.getElementById('game-logo');
if (gameLogo) gameLogo.addEventListener('click', goToMainMenu);
document.getElementById('menu-btn').addEventListener('click', goToMainMenu);
document.getElementById('game-menu-btn').addEventListener('click', goToMainMenu);

// 7. Modal Buttons
document.getElementById('modal-next-btn').addEventListener('click', () => {
    hideVictoryModal();
    if (state.currentP2 + 1 < STAGES[state.currentP1].levels.length) {
        initGame('STAGE', state.currentP1, state.currentP2 + 1);
    } else if (state.currentP1 + 1 < STAGES.length) {
        initGame('STAGE', state.currentP1 + 1, 0); 
    } else {
        showMainMenu(); 
    }
});

document.getElementById('again-btn').addEventListener('click', () => {
    if (state.currentMode === 'RANDOM') initGame('RANDOM', state.currentLvl);
    else if (state.currentMode === 'DAILY') initGame('DAILY', state.currentLvl); // <-- ADDED
    else if (state.currentMode === 'STAGE') initGame('STAGE', state.currentP1, state.currentP2);
});

document.getElementById('modal-again-btn').addEventListener('click', () => {
    hideVictoryModal();
    if (state.currentMode === 'RANDOM') initGame('RANDOM', state.currentLvl);
    else if (state.currentMode === 'DAILY') initGame('DAILY', state.currentLvl);
    else if (state.currentMode === 'STAGE') initGame('STAGE', state.currentP1, state.currentP2);
    else if (state.currentMode === 'TIMED') initGame('TIMED', state.currentLvl);
});

document.getElementById('btn-daily-1')?.addEventListener('click', () => initGame('DAILY', 1));
document.getElementById('btn-daily-2')?.addEventListener('click', () => initGame('DAILY', 2));
document.getElementById('btn-daily-3')?.addEventListener('click', () => initGame('DAILY', 3));

document.getElementById('modal-menu-btn').addEventListener('click', () => {
    hideVictoryModal();
    if (state._timerIntervalId) { clearInterval(state._timerIntervalId); state._timerIntervalId = null; }
    showMainMenu();
});

document.getElementById('tt-next').addEventListener('click', nextTourStep);
document.getElementById('tt-skip').addEventListener('click', () => {
    endTour();
    setTutorialComplete();
    state.isTutorial = false;
    state.tutorialPhase = 'NONE';
});
document.getElementById('btn-replay-tutorial').addEventListener('click', () => {
    showTutorialPrompt(
        () => {
            initGame('RANDOM', 1);
            setTimeout(() => {
                state.isTutorial = true;
                state.tutorialPhase = 'SELECT_GATE';
                setGhostPointer('PALETTE_ANY');
            }, 400);
        },
        () => {}
    );
});

// --- Boot App ---
buildMenu();
trackSessionStart();

// Handle duel challenge acceptance (fired by showDuelChallengeBanner in ui.js)
document.addEventListener('duel-accept', (e) => {
    initGame('TIMED', e.detail.difficulty);
});

document.addEventListener('play-challenge-accept', (e) => {
    const { difficulty, seed, gateMask } = e.detail;
    state.randomSeed = seed;
    state._usePresetSeed = true;
    if (gateMask !== undefined) {
        GATE_MASK_ORDER.forEach((gate, i) => {
            const cb = document.getElementById(GATE_CHECKBOX_IDS[gate]);
            if (cb) cb.checked = !!(gateMask & (1 << i));
        });
    }
    initGame('RANDOM', difficulty);
});

document.addEventListener('daily-challenge-accept', (e) => {
    initGame('DAILY', e.detail.difficulty);
});

// Check for incoming play challenge link
const _playParam = new URLSearchParams(window.location.search).get('play-challenge');
if (_playParam) {
    const _pParts = _playParam.split('-');
    if (_pParts.length >= 2) {
        const _pDiff = parseInt(_pParts[0]);
        const _pSeed = parseInt(_pParts[1]);
        const _pMask = _pParts.length >= 3 ? parseInt(_pParts[2]) : undefined;
        state.randomSeed = _pSeed;
        window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        showPlayChallengeBanner(_pDiff, _pSeed, _pMask);
    }
}

// Check for incoming daily challenge link
const _dailyChallengeParam = new URLSearchParams(window.location.search).get('daily-challenge');
if (_dailyChallengeParam) {
    const _dcDiff = parseInt(_dailyChallengeParam);
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    showDailyChallengeBanner(_dcDiff);
}

// Check for incoming duel challenge link
const _duelParam = new URLSearchParams(window.location.search).get('duel');
if (_duelParam) {
    const _parts = _duelParam.split('-');
    if (_parts.length >= 3) {
        const _diff = parseInt(_parts[0]);
        state.isDuelMode = true;
        state.duelSeed = parseInt(_parts[1]);
        state.duelOpponentScore = parseInt(_parts[2]);
        window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        showDuelChallengeBanner(_diff, state.duelOpponentScore);
    }
}

// Boot: if a route hash is present, navigate directly to it
const _bootHash = window.location.hash;
if (_bootHash && _bootHash !== '#/' && _bootHash.startsWith('#/')) {
    handleRoute(_bootHash);
}

