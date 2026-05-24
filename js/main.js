import { LEVELS, STAGES } from './data/stages.js';
import { completedStages } from './data/storage.js';
import { generateMatrices, formatAngleGate, getOccupiedQubits, canFit, GATE_MATRICES } from './quantum/gates.js';
import { computeStateVector, stateToString } from './quantum/engine.js';
import { toggleMenu, toggleAllGates, getColumnHTML, renderDynamicCanvases, updateBlochSpheres } from './game/ui.js';
import { attachDragDropHandlers, updateActiveRow } from './game/dragdrop.js';
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
    currentRzAngle: 'PI'
};

// Expose these highly specific dynamic DOM hooks
window.showHint = () => {
    document.getElementById('hint-text').classList.remove('hidden');
    document.getElementById('hint-btn').classList.add('hidden');
};

window.showLesson = () => {
    document.getElementById('lesson-text').classList.remove('hidden');
    document.getElementById('lesson-btn').classList.add('hidden');
};

function showMainMenu() {
    document.getElementById('game-view').style.display = 'none';
    buildMenu(); 
    document.getElementById('main-menu').style.display = 'flex';
}

// --- Main Menu Initialization ---
function buildMenu() {
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
    // 1. Selector Failsafe
    if (mode === 'RANDOM') {
        let selectedBaseGates = Array.from(document.querySelectorAll('#play-gate-selection input:checked')).map(cb => cb.value);
        if (selectedBaseGates.length === 0) {
            alert("Please select at least one gate before starting!");
            return;
        }
    }

    document.getElementById('main-menu').style.display = 'none';
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
        state.numQubits = stage.qubits;
        state.numCols = stage.cols;
        state.activeSet = stage.set;
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
        
        // Final fallback just in case the active pool doesn't fit the board 
        if (state.activeSet.length === 0) {
            state.activeSet = expandGateSet(['X', 'H'], state.numQubits);
        }
        
        let generatedCircuit = [];
        let activeLength = Math.floor(Math.random() * (state.numCols - LEVELS[p1].minActive + 1)) + LEVELS[p1].minActive;
        let singleQSet = state.activeSet.filter(g => getOccupiedQubits(g).length === 1);
        let singleGatesToPlace = 2; // Target 2 explicit single qubit gates

        for (let i = 0; i < state.numCols; i++) {
            if (i < activeLength) {
                let col = [];
                let placedThisCol = 0;

                // Force 2 single-qubit gates into the generated circuit early
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
    
    state.activeSet.forEach(baseType => {
        let type = baseType;
        if (baseType.startsWith('RZ')) {
            let q = baseType.slice(-1);
            type = `RZ_${state.currentRzAngle}_${q}`;
        } else if (baseType.startsWith('CP')) {
            let ct = baseType.slice(-2);
            type = `CP_${state.currentRzAngle}_${ct}`;
        }
        
        const item = document.createElement('div');
        item.className = 'palette-item';
        item.style.height = `${h}px`;
        item.draggable = true;
        item.innerHTML = getColumnHTML([type], state.numQubits);
        
        item.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', type));
        item.addEventListener('click', () => {
            if(state.gameOver) return;
            let reqQubits = getOccupiedQubits(type);
            let latestCol = -1;
            
            for (let c = 0; c < state.numCols; c++) {
                for (let g of state.currentGuess[c]) {
                    if (reqQubits.some(q => getOccupiedQubits(g).includes(q))) latestCol = c;
                }
            }
            
            let targetCol = latestCol + 1;
            if (targetCol < state.numCols) {
                state.currentGuess[targetCol].push(type);
                updateActiveRow(state);
            } else {
                let msg = document.getElementById('message');
                msg.innerText = "No space left for this gate!";
                msg.style.color = "#ef4444";
                setTimeout(() => { if(!state.gameOver) msg.innerText = ""; }, 1500);
            }
        });
        palette.appendChild(item);
    });
}

function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = ''; 
    const historyBoard = document.getElementById('history-board');
    if (historyBoard) historyBoard.innerHTML = ''; // Clear history on new game
    
    // NEW: Clean up the old canonical circuit if you hit Play Again
    const oldReveal = document.getElementById('reveal-circuit-wrap');
    if (oldReveal) oldReveal.remove();

    // Manage Attempts Counter Display
    const attemptsCounter = document.getElementById('attempts-counter');
    if (state.currentMode === 'FREEPLAY') {
        attemptsCounter.style.display = 'none';
    } else {
        attemptsCounter.style.display = 'block';
        attemptsCounter.innerText = `Attempts Remaining: ${6 - state.attempts}`;
    }

    const rowHeight = Math.max(60, state.numQubits * 30);
    const sub = ['₀', '₁', '₂'];
    
    // Create the single Active Row
    const wrap = document.createElement('div');
    wrap.className = `row-wrapper active`;
    wrap.id = `row-active`;
    
    const circuitRow = document.createElement('div');
    circuitRow.className = 'circuit-row';
    circuitRow.style.height = `${rowHeight}px`;
    
    const labels = document.createElement('div');
    labels.className = 'qubit-labels';
    let lbls = '';
    for(let q=0; q<state.numQubits; q++) lbls += `<span>q${sub[q]}</span>`;
    labels.innerHTML = lbls;
    circuitRow.appendChild(labels);
    
    for (let c = 0; c < state.numCols; c++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.id = `slot-active-${c}`; // Simplified active ID
        
        slot.innerHTML = getColumnHTML([], state.numQubits); 
        attachDragDropHandlers(slot, c, state); // Removed the 'r' loop parameter
        circuitRow.appendChild(slot);
    }
    wrap.appendChild(circuitRow);
    board.appendChild(wrap);
}

// --- Attach Static Event Listeners ---

// 1. Menu Accordions
document.getElementById('header-learn').addEventListener('click', () => toggleMenu('learn-content'));
document.getElementById('header-play').addEventListener('click', () => toggleMenu('play-content'));
document.getElementById('header-sandbox').addEventListener('click', () => toggleMenu('sandbox-content'));

// 2. Play Menu Configurations
document.getElementById('btn-toggle-gates').addEventListener('click', toggleAllGates);
document.getElementById('btn-rand-1').addEventListener('click', () => initGame('RANDOM', 1));
document.getElementById('btn-rand-2').addEventListener('click', () => initGame('RANDOM', 2));
document.getElementById('btn-rand-3').addEventListener('click', () => initGame('RANDOM', 3));

// 3. Sandbox Menu
document.getElementById('btn-free-1').addEventListener('click', () => initGame('FREEPLAY', 1));
document.getElementById('btn-free-2').addEventListener('click', () => initGame('FREEPLAY', 2));
document.getElementById('btn-free-3').addEventListener('click', () => initGame('FREEPLAY', 3));

// 4. Game Controls
document.getElementById('submit-btn').addEventListener('click', () => submitGuess(state));
document.getElementById('clear-btn').addEventListener('click', () => {
    if (state.gameOver || state.currentMode !== 'FREEPLAY') return;
    state.currentGuess = Array(state.numCols).fill().map(() => []);
    const wrap = document.getElementById('row-active');
    if (wrap) {
        const results = wrap.querySelectorAll('.amplitudes-result');
        results.forEach(el => el.remove());
    }
    updateActiveRow(state);
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
document.getElementById('menu-btn').addEventListener('click', () => showMainMenu());

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
    gameLogo.addEventListener('click', () => window.showMainMenu());
}

// --- Boot App ---
buildMenu();