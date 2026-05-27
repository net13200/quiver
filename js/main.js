import { LEVELS, STAGES } from './data/stages.js';
import { completedStages, totalPoints, highestStreak, tutorialComplete, setTutorialComplete, timedBest, saveTimedBest } from './data/storage.js';
import { generateMatrices, formatAngleGate, getOccupiedQubits, canFit, GATE_MATRICES } from './quantum/gates.js';
import { computeStateVector, stateToString } from './quantum/engine.js';
import { toggleMenu, toggleAllGates, getColumnHTML, renderDynamicCanvases, updateBlochSpheres, hideVictoryModal, showVictoryModal, showInfoModal, hideInfoModal, startTour, nextTourStep, endTour, setGhostPointer, clearGhostPointer, parseMarkdownAndMath, updateTargetBlochSphere, startInGameTour, updateTimedStatusBar, showDuelChallengeBanner } from './game/ui.js';
import { handleCellTap, updateActiveRow } from './game/dragdrop.js';
import { submitGuess } from './game/validator.js';

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
    timedNextPuzzle: null,
    timedEndSession: null,
    isDuelMode: false,
    duelSeed: 0,
    duelOpponentScore: 0,
    duelOpponentName: ''
};

// --- Expose Global Hooks for dynamically created DOM elements ---
window.showHint = () => {
    document.getElementById('hint-text').classList.remove('hidden');
    document.getElementById('hint-btn').classList.add('hidden');
};
window.showLesson = () => {
    document.getElementById('lesson-text').classList.remove('hidden');
    document.getElementById('lesson-text').innerHTML = parseMarkdownAndMath(document.getElementById('lesson-text').innerHTML);
    document.getElementById('lesson-btn').classList.add('hidden');
    
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
    document.getElementById('game-view').style.display = 'none';
    state.isDuelMode = false;
    buildMenu();
    document.getElementById('main-menu').style.display = 'flex';

    if (state.tutorialJustCompleted) {
        state.tutorialJustCompleted = false;
        toggleMenu('learn-content');
        setTimeout(() => {
            const learnHeader = document.getElementById('header-learn');
            if (learnHeader) {
                learnHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
                learnHeader.classList.add('ghost-pulse');
                learnHeader.style.position = 'relative';
                const msg = document.createElement('div');
                msg.className = 'ghost-text';
                msg.innerText = 'Start your quantum journey here!';
                learnHeader.appendChild(msg);
                setTimeout(() => {
                    learnHeader.classList.remove('ghost-pulse');
                    learnHeader.style.position = '';
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

    // 2. Build the Stages
    const container = document.getElementById('stages-container');
    container.innerHTML = '';
    
    STAGES.forEach((stage, sIdx) => {
        let box = document.createElement('div');
        box.className = 'stage-box';
        box.innerHTML = `<h3>${stage.title}</h3><p>${stage.desc}</p><div class="menu-row" id="sbg-${sIdx}"></div>`;
        container.appendChild(box);
        
        let bg = document.getElementById(`sbg-${sIdx}`);
        stage.levels.forEach((lvl, lIdx) => {
            let btn = document.createElement('button');
            btn.className = 'menu-btn';
            if (completedStages.includes(`${sIdx}-${lIdx}`)) {
                btn.classList.add('completed');
                btn.innerText = `✓ ${lvl.name.split(':')[0]}`;
            } else {
                btn.innerText = lvl.name.split(':')[0];
            }
            btn.onclick = () => initGame('STAGE', sIdx, lIdx);
            bg.appendChild(btn);
        });
    });
    
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
}

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
    if (mode === 'RANDOM') {
        let selectedBaseGates = Array.from(document.querySelectorAll('#play-gate-selection input:checked')).map(cb => cb.value);
        if (selectedBaseGates.length === 0) {
            alert("Please select at least one gate before starting!");
            return;
        }
    }

    if (!state.isTutorial) state.tutorialJustCompleted = false;

    document.getElementById('main-menu').style.display = 'none';
    hideVictoryModal(); 
    document.getElementById('game-view').style.display = 'flex';
    
    state.currentMode = mode;
    let instructions = document.getElementById('instructions-text');
    let submitBtn = document.getElementById('submit-btn');
    let targetBox = document.getElementById('target-container');
    let liveBox = document.getElementById('live-state-container');
    let clearBtn = document.getElementById('clear-btn');
    
    submitBtn.classList.remove('hidden');
    document.getElementById('next-btn').classList.add('hidden');
    document.getElementById('again-btn').classList.add('hidden');
    submitBtn.disabled = false;
    
    if (mode === 'STAGE') {
        clearBtn.classList.add('hidden');
        state.currentP1 = p1;
        state.currentP2 = p2;
        let stage = STAGES[p1];
        let lvl = stage.levels[p2];
        state.numQubits = lvl.qubits || stage.qubits;
        state.numCols = lvl.cols || stage.cols;
        state.activeSet = lvl.set || stage.set;
        state.secretCircuits = lvl.circuits;
        
        let isStrict = (p1 >= 4); 
        let rulesText = isStrict ? "<br><span style='color:#ef4444; font-size:0.85rem; font-weight:bold;'>Strict Mode: A canonical implementation is required!</span>" : "";
        let lessonHTML = lvl.lesson ? `<button id="lesson-btn" class="hint-btn" style="background:#059669;" onclick="showLesson()">Read Lesson</button><div id="lesson-text" class="lesson-text hidden">${lvl.lesson}</div>` : "";

        instructions.innerHTML = `<b>${stage.title}: ${lvl.name}</b>${rulesText}<br>
                                  <button id="hint-btn" class="hint-btn" onclick="showHint()">Show Hint</button>
                                  ${lessonHTML}
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
            instructions.innerHTML = `<b>Daily Puzzle - Level ${p1}</b><br>Equivalent circuits win! Resets at midnight.`;
        } else {
            rng = Math.random;
            let selectedBaseGates = Array.from(document.querySelectorAll('#play-gate-selection input:checked')).map(cb => cb.value);
            state.activeSet = expandGateSet(selectedBaseGates, state.numQubits);
            
            if (state.activeSet.length === 0) {
                state.activeSet = expandGateSet(['X', 'H'], state.numQubits);
            }
            instructions.innerHTML = `<b>Random Puzzle</b><br>Guess the circuit. Equivalent circuits win!`;
        }
        
        let generatedCircuit = [];
        let activeLength = Math.floor(rng() * (state.numCols - LEVELS[p1].minActive + 1)) + LEVELS[p1].minActive;
        let singleQSet = state.activeSet.filter(g => getOccupiedQubits(g).length === 1);
        let singleGatesToPlace = 2; 

        for (let i = 0; i < state.numCols; i++) {
            if (i < activeLength) {
                let col = [];
                let placedThisCol = 0;

                if (singleGatesToPlace > 0 && singleQSet.length > 0) {
                    let g = singleQSet[Math.floor(rng() * singleQSet.length)];
                    col.push(formatAngleGateSeeded(g, rng));
                    singleGatesToPlace--;
                    placedThisCol++;

                    if (singleGatesToPlace > 0 && state.numQubits >= 2) {
                        let g2 = singleQSet[Math.floor(rng() * singleQSet.length)];
                        g2 = formatAngleGateSeeded(g2, rng);
                        if (canFit(col, g2)) {
                            col.push(g2);
                            singleGatesToPlace--;
                            placedThisCol++;
                        }
                    }
                } else {
                    let baseGate = formatAngleGateSeeded(state.activeSet[Math.floor(rng() * state.activeSet.length)], rng);
                    col.push(baseGate);
                    placedThisCol++;
                }

                for(let a=placedThisCol; a<state.numQubits; a++) {
                    if(rng() > 0.5) {
                        let gNext = formatAngleGateSeeded(state.activeSet[Math.floor(rng() * state.activeSet.length)], rng);
                        if(canFit(col, gNext)) col.push(gNext);
                    }
                }
                generatedCircuit.push(col);
            } else generatedCircuit.push([]);
        }
        state.secretCircuits = [generatedCircuit];
        
        // If the tutorial is active, hardcode a simple 1-gate puzzle and run the in-game tour
        if (state.isTutorial && mode === 'RANDOM') {
            state.activeSet = ['X', 'H'];
            state.secretCircuits = [[['H0'], [], [], []]];
            setTimeout(() => startInGameTour(() => {
                state.tutorialPhase = 'SELECT_GATE';
                setGhostPointer('PALETTE', 'H');
            }), 300);
        }

        targetBox.style.display = 'block';
        liveBox.style.display = 'none';

    } else if (mode === 'TIMED') {
        const isContinuingTimedSession = state._timerIntervalId !== null;

        clearBtn.classList.add('hidden');
        state.currentLvl = p1;
        state.numQubits = LEVELS[p1].q;
        state.numCols = LEVELS[p1].g;
        state.activeSet = expandGateSet(['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX'], state.numQubits);

        const timedRng = state.isDuelMode
            ? getSeededRandom(state.duelSeed * 1000 + state.timedCircuitsSolved)
            : Math.random.bind(Math);
        let timedCircuit = [];
        let timedActiveLength = Math.floor(timedRng() * (state.numCols - LEVELS[p1].minActive + 1)) + LEVELS[p1].minActive;
        let timedSingleQSet = state.activeSet.filter(g => getOccupiedQubits(g).length === 1);
        let timedSingleToPlace = 2;
        for (let i = 0; i < state.numCols; i++) {
            if (i < timedActiveLength) {
                let col = [];
                let placed = 0;
                if (timedSingleToPlace > 0 && timedSingleQSet.length > 0) {
                    let g = timedSingleQSet[Math.floor(timedRng() * timedSingleQSet.length)];
                    col.push(formatAngleGateSeeded(g, timedRng));
                    timedSingleToPlace--; placed++;
                    if (timedSingleToPlace > 0 && state.numQubits >= 2) {
                        let g2 = formatAngleGateSeeded(timedSingleQSet[Math.floor(timedRng() * timedSingleQSet.length)], timedRng);
                        if (canFit(col, g2)) { col.push(g2); timedSingleToPlace--; placed++; }
                    }
                } else {
                    col.push(formatAngleGateSeeded(state.activeSet[Math.floor(timedRng() * state.activeSet.length)], timedRng));
                    placed++;
                }
                for (let a = placed; a < state.numQubits; a++) {
                    if (timedRng() > 0.5) {
                        let gNext = formatAngleGateSeeded(state.activeSet[Math.floor(timedRng() * state.activeSet.length)], timedRng);
                        if (canFit(col, gNext)) col.push(gNext);
                    }
                }
                timedCircuit.push(col);
            } else timedCircuit.push([]);
        }
        state.secretCircuits = [timedCircuit];

        const diffNames = ['Easy', 'Medium', 'Hard'];
        instructions.innerHTML = `<b>Time Collapse — ${diffNames[p1 - 1]}</b><br>Solve as many circuits as possible! +20s per solve, −5s per wrong attempt.`;
        targetBox.style.display = 'block';
        liveBox.style.display = 'none';

        if (isContinuingTimedSession) {
            updateTimedStatusBar(state);
        } else {
            if (!state.isDuelMode) state.duelSeed = Math.floor(Math.random() * 900000) + 100000;
            state.timerRemaining = state.currentLvl === 3 ? 60 : 30;
            state.timedScore = 0;
            state.timedCircuitsSolved = 0;
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
            if (state.timerRemaining <= 0) return;
            initGame('TIMED', state.currentLvl);
        };
        state.timedEndSession = endTimedSession;

    } else if (mode === 'FREEPLAY') {
        clearBtn.classList.remove('hidden');
        state.numQubits = p1;
        state.numCols = 8;
        state.activeSet = expandGateSet(['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX'], state.numQubits);
        state.secretCircuits = [[]];
        
        instructions.innerHTML = `<b>Sandbox Free Play (${state.numQubits} Qubit${state.numQubits>1?'s':''})</b><br>Experiment freely. Click evaluate to take a snapshot of the state!`;
        targetBox.style.display = 'none';
        liveBox.style.display = 'block';
    }
    
    generateMatrices(state.numQubits);
    if (state.numQubits === 3) document.getElementById('board').classList.add('hard-mode');
    else document.getElementById('board').classList.remove('hard-mode');
    
    let hasAngleGate = state.activeSet.some(g => g.startsWith('RZ') || g.startsWith('CP'));
    let angleContainer = document.getElementById('rz-angle-container');
    if(angleContainer) angleContainer.style.display = hasAngleGate ? 'inline-block' : 'none';
    
    if (mode !== 'FREEPLAY') {
        state.targetState = computeStateVector(state.secretCircuits[0], state.numQubits, GATE_MATRICES);
        document.getElementById('target-amplitudes').innerText = "|ψ⟩ = " + stateToString(state.targetState, state.numQubits);
        
        // --- NEW: Render the Target Bloch Sphere ---
        updateTargetBlochSphere(state.targetState, state.numQubits);
    } else {
        // Ensure it hides if switching back to Freeplay
        updateTargetBlochSphere(null, state.numQubits);
    }
    
    state.currentGuess = Array(state.numCols).fill().map(() => []);
    state.attempts = 0;
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
}

// --- Render Core ---
function renderPalette() {
    const palette = document.getElementById('palette');
    palette.innerHTML = '';
    const h = Math.max(60, state.numQubits * 30);
    
    // Extract unique base gates instead of showing all permutations
    const allBases = ['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX', 'QFT', 'IQFT'];
    const uniqueBases = allBases.filter(base => state.activeSet.some(g => g.startsWith(base)));

    uniqueBases.forEach(baseType => {
        const item = document.createElement('div');
        // Add selected glow effect if active
        item.className = `palette-item ${state.selectedBaseGate === baseType ? 'selected' : ''}`;
        item.style.height = `${h}px`;
        
        // Mock a beautifully formatted gate just for the palette display
        let renderGate = baseType;
        if (baseType.startsWith('RZ')) renderGate = `RZ_${state.currentRzAngle}_0`;
        else if (baseType.startsWith('CP')) renderGate = `CP_${state.currentRzAngle}_01`;
        else if (baseType === 'CX' || baseType === 'SWAP') renderGate = `${baseType}01`;
        else if (baseType === 'CCX') renderGate = `CCX012`;
        else if (baseType === 'QFT' || baseType === 'IQFT') renderGate = baseType; 
        else renderGate = `${baseType}0`;

        // NEW: Force QFT to have mockQubits = 1 so it fits neatly in the menu
        let mockQubits = (baseType === 'QFT' || baseType === 'IQFT') ? 1 :
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
    if (state.currentMode === 'FREEPLAY') {
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
    if (state._timerIntervalId) {
        clearInterval(state._timerIntervalId);
        state._timerIntervalId = null;
    }
    if (state.gameOver) return;
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
document.getElementById('header-learn').addEventListener('click', () => toggleMenu('learn-content'));
document.getElementById('header-play').addEventListener('click', () => toggleMenu('play-content'));
document.getElementById('header-sandbox').addEventListener('click', () => toggleMenu('sandbox-content'));
document.getElementById('header-daily').addEventListener('click', () => toggleMenu('daily-content'));
document.getElementById('header-timed').addEventListener('click', () => toggleMenu('timed-content'));

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
document.getElementById('next-btn').addEventListener('click', () => {
    if (state.currentP2 + 1 < STAGES[state.currentP1].levels.length) {
        initGame('STAGE', state.currentP1, state.currentP2 + 1);
    } else if (state.currentP1 + 1 < STAGES.length) {
        initGame('STAGE', state.currentP1 + 1, 0); 
    } else {
        showMainMenu(); 
    }
});

document.getElementById('menu-btn').addEventListener('click', () => {
    state.currentStreak = 0; // Reset streak if you run away!
    if (state._timerIntervalId) { clearInterval(state._timerIntervalId); state._timerIntervalId = null; }
    showMainMenu();
});

// 5. Palette Selectors
const rzSelect = document.getElementById('rz-angle');
if (rzSelect) {
    rzSelect.addEventListener('change', (e) => {
        state.currentRzAngle = e.target.value;
        renderPalette();
    });
}

// 6. Logo Click
const gameLogo = document.getElementById('game-logo');
if (gameLogo) {
    gameLogo.addEventListener('click', () => {
        state.currentStreak = 0;
        if (state._timerIntervalId) { clearInterval(state._timerIntervalId); state._timerIntervalId = null; }
        showMainMenu();
    });
}

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
    showMainMenu();
    state.isTutorial = true;
    state.tutorialPhase = 'NONE';
    state.tutorialJustCompleted = false;
    startTour();
});

document.getElementById('btn-rand-1').addEventListener('click', () => {
    if (state.isTutorial) {
        endTour();
        state.tutorialPhase = 'INTRO'; // In-game overlay tour will set SELECT_GATE when done
    }
    initGame('RANDOM', 1);
});

// --- Boot App ---
buildMenu();

// Handle duel challenge acceptance (fired by showDuelChallengeBanner in ui.js)
document.addEventListener('duel-accept', (e) => {
    initGame('TIMED', e.detail.difficulty);
});

// Check for incoming duel challenge link
const _duelParam = new URLSearchParams(window.location.search).get('duel');
if (_duelParam) {
    const _parts = _duelParam.split('-');
    if (_parts.length >= 3) {
        const _diff = parseInt(_parts[0]);
        state.isDuelMode = true;
        state.duelSeed = parseInt(_parts[1]);
        state.duelOpponentScore = parseInt(_parts[2]);
        state.duelOpponentName = _parts[3] ? decodeURIComponent(_parts[3]) : '';
        window.history.replaceState({}, '', window.location.pathname);
        showDuelChallengeBanner(_diff, state.duelOpponentName, state.duelOpponentScore);
    }
}

// NEW: Auto-start the tutorial if it's their first time
if (!tutorialComplete && !_duelParam) {
    state.isTutorial = true;
    setTimeout(startTour, 500); // Slight delay ensures the DOM is painted
}