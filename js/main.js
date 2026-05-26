import { LEVELS, STAGES } from './data/stages.js';
import { completedStages, totalPoints, highestStreak, tutorialComplete, setTutorialComplete } from './data/storage.js';
import { generateMatrices, formatAngleGate, getOccupiedQubits, canFit, GATE_MATRICES } from './quantum/gates.js';
import { computeStateVector, stateToString } from './quantum/engine.js';
import { toggleMenu, toggleAllGates, getColumnHTML, renderDynamicCanvases, updateBlochSpheres, hideVictoryModal, showInfoModal, hideInfoModal, startTour, nextTourStep, endTour, setGhostPointer, clearGhostPointer, parseMarkdownAndMath } from './game/ui.js';
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
    isTutorial: false,     // NEW
    tutorialPhase: 'NONE'  // NEW
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

function showMainMenu() {
    document.getElementById('game-view').style.display = 'none';
    buildMenu(); 
    document.getElementById('main-menu').style.display = 'flex';
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
        
    } else if (mode === 'RANDOM') {
        clearBtn.classList.add('hidden');
        state.currentLvl = p1;
        state.numQubits = LEVELS[p1].q;
        state.numCols = LEVELS[p1].g;
        
        let selectedBaseGates = Array.from(document.querySelectorAll('#play-gate-selection input:checked')).map(cb => cb.value);
        state.activeSet = expandGateSet(selectedBaseGates, state.numQubits);
        
        if (state.activeSet.length === 0) {
            state.activeSet = expandGateSet(['X', 'H'], state.numQubits);
        }
        
        let generatedCircuit = [];
        let activeLength = Math.floor(Math.random() * (state.numCols - LEVELS[p1].minActive + 1)) + LEVELS[p1].minActive;
        let singleQSet = state.activeSet.filter(g => getOccupiedQubits(g).length === 1);
        let singleGatesToPlace = 2; 

        for (let i = 0; i < state.numCols; i++) {
            if (i < activeLength) {
                let col = [];
                let placedThisCol = 0;

                if (singleGatesToPlace > 0 && singleQSet.length > 0) {
                    let g = singleQSet[Math.floor(Math.random() * singleQSet.length)];
                    col.push(formatAngleGate(g));
                    singleGatesToPlace--;
                    placedThisCol++;

                    if (singleGatesToPlace > 0 && state.numQubits >= 2) {
                        let g2 = singleQSet[Math.floor(Math.random() * singleQSet.length)];
                        g2 = formatAngleGate(g2);
                        if (canFit(col, g2)) {
                            col.push(g2);
                            singleGatesToPlace--;
                            placedThisCol++;
                        }
                    }
                } else {
                    let baseGate = formatAngleGate(state.activeSet[Math.floor(Math.random() * state.activeSet.length)]);
                    col.push(baseGate);
                    placedThisCol++;
                }

                for(let a=placedThisCol; a<state.numQubits; a++) {
                    if(Math.random() > 0.5) {
                        let gNext = formatAngleGate(state.activeSet[Math.floor(Math.random() * state.activeSet.length)]);
                        if(canFit(col, gNext)) col.push(gNext);
                    }
                }
                generatedCircuit.push(col);
            } else generatedCircuit.push([]);
        }
        state.secretCircuits = [generatedCircuit];
        
        // NEW: If the tutorial is active, hardcode the perfect Easy puzzle!
        if (state.isTutorial) {
            state.activeSet = ['X', 'H'];
            state.secretCircuits = [[['H0'], [], [], []]];
            // Fire the Ghost pointer at the Palette after the UI builds
            setTimeout(() => setGhostPointer('PALETTE', 'H'), 300);
        }

        instructions.innerHTML = `<b>Random Puzzle</b><br>Guess the circuit. Equivalent circuits win!`;
        targetBox.style.display = 'block';
        liveBox.style.display = 'none';
        
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
    if (state.currentMode === 'FREEPLAY') {
        attemptsCounter.style.display = 'none';
    } else {
        attemptsCounter.style.display = 'block';
        attemptsCounter.innerText = `Attempts Remaining: ${6 - state.attempts}`;
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

// --- Attach Static Event Listeners ---

// 1. Menu Accordions
document.getElementById('header-learn').addEventListener('click', () => toggleMenu('learn-content'));
document.getElementById('header-play').addEventListener('click', () => toggleMenu('play-content'));
document.getElementById('header-sandbox').addEventListener('click', () => toggleMenu('sandbox-content'));

// 2. Play Menu Configurations
document.getElementById('btn-toggle-gates').addEventListener('click', toggleAllGates);
document.getElementById('btn-score-info').addEventListener('click', () => showInfoModal());
document.getElementById('close-info-btn').addEventListener('click', () => hideInfoModal());
document.getElementById('btn-rand-1').addEventListener('click', () => initGame('RANDOM', 1));
document.getElementById('btn-rand-2').addEventListener('click', () => initGame('RANDOM', 2));
document.getElementById('btn-rand-3').addEventListener('click', () => initGame('RANDOM', 3));

// 3. Sandbox Menu
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
document.getElementById('again-btn').addEventListener('click', () => {
    if (state.currentMode === 'RANDOM') initGame('RANDOM', state.currentLvl);
    else if (state.currentMode === 'STAGE') initGame('STAGE', state.currentP1, state.currentP2);
});
document.getElementById('menu-btn').addEventListener('click', () => {
    state.currentStreak = 0; // Reset streak if you run away!
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

document.getElementById('modal-again-btn').addEventListener('click', () => {
    hideVictoryModal();
    if (state.currentMode === 'RANDOM') initGame('RANDOM', state.currentLvl);
    else if (state.currentMode === 'STAGE') initGame('STAGE', state.currentP1, state.currentP2);
});

document.getElementById('modal-menu-btn').addEventListener('click', () => {
    hideVictoryModal();
    showMainMenu();
});

document.getElementById('tt-next').addEventListener('click', nextTourStep);
document.getElementById('tt-skip').addEventListener('click', () => {
    endTour();
    setTutorialComplete();
    state.isTutorial = false;
});
document.getElementById('btn-replay-tutorial').addEventListener('click', () => {
    showMainMenu();
    state.isTutorial = true;
    startTour();
});

document.getElementById('btn-rand-1').addEventListener('click', () => {
    // Intercept the click if we are in the middle of the Tour
    if (state.isTutorial) {
        endTour();
        state.tutorialPhase = 'SELECT_GATE';
    }
    initGame('RANDOM', 1);
});

// --- Boot App ---
buildMenu();

// NEW: Auto-start the tutorial if it's their first time
if (!tutorialComplete) {
    state.isTutorial = true;
    setTimeout(startTour, 500); // Slight delay ensures the DOM is painted
}