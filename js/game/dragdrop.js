import { updateBlochSpheres, setGhostPointer } from './ui.js';
import { getOccupiedQubits, GATE_MATRICES } from '../quantum/gates.js';
import { computeStateVector, stateToString } from '../quantum/engine.js';

export function handleCellTap(c, q, state, renderBoardCallback) {
    if (state.gameOver) return;

    // 1. DELETE MODE (If no gate is selected in the palette, tapping acts as an eraser)
    if (!state.selectedBaseGate) {
        let gateToRemove = null;
        for (let g of state.currentGuess[c]) {
            if (getOccupiedQubits(g).includes(q)) {
                gateToRemove = g; break;
            }
        }
        if (gateToRemove) {
            state.currentGuess[c] = state.currentGuess[c].filter(g => g !== gateToRemove);
            state.placement = { active: false, col: null, controls: [] };
            updateActiveRow(state, renderBoardCallback);
        }
        return;
    }

    // 2. TOGGLE / PLACE MODE (A gate is selected)
    let base = state.selectedBaseGate;
    let isAngle = base === 'RZ' || base === 'CP';
    let angleStr = isAngle ? `_${state.currentRzAngle}_` : '';
    
    // Determine how many taps this specific gate needs
    let reqClicks = 1;
    if (base === 'CX' || base === 'CP' || base === 'SWAP') reqClicks = 2;
    if (base === 'CCX') reqClicks = 3;

    if (reqClicks === 1) {
        let fullGate;
        
        if (base === 'QFT' || base === 'IQFT') {
            fullGate = base; 
        } else {
            fullGate = isAngle ? `RZ${angleStr}${q}` : `${base}${q}`;
        }
        
        // Check if the exact gate we are trying to place already exists on this wire
        let gateAlreadyExists = false;
        
        if (fullGate === 'QFT' || fullGate === 'IQFT') {
            // For column commands, just check if it's already in the column
            gateAlreadyExists = state.currentGuess[c].includes(fullGate);
            state.currentGuess[c] = []; // Clear the column either way to make room or remove it
        } else {
            // For standard gates, check if it exists AND clear any overlapping gates
            state.currentGuess[c] = state.currentGuess[c].filter(g => {
                if (g === 'QFT' || g === 'IQFT') return false; 
                
                // If we found the exact gate we are holding, mark it!
                if (g === fullGate) {
                    gateAlreadyExists = true;
                    return false; // Remove it (Toggle OFF)
                }
                
                const occupied = getOccupiedQubits(g).map(Number);
                return !occupied.includes(Number(q)); // Remove any *other* gates on this wire
            });
        }
        
        // Only push the new gate if we DIDN'T just toggle it off
        if (!gateAlreadyExists) {
            state.currentGuess[c].push(fullGate);
        }
        // ------------------------------

        updateActiveRow(state, renderBoardCallback);
        
        // Advance the Tutorial Pointer
        if (state.isTutorial && state.tutorialPhase === 'PLACE_GATE' && !gateAlreadyExists) {
            state.tutorialPhase = 'EVALUATE';
            setGhostPointer('EVALUATE');
        }
        
    } else {
        // Multi-qubit Placement Logic
        if (!state.placement.active || state.placement.col !== c) {
            // Start fresh placement in this column
            state.placement = { active: true, col: c, controls: [q] };
            updateActiveRow(state, renderBoardCallback); 
        } else {
            // Add the next tap
            if (!state.placement.controls.includes(q)) {
                state.placement.controls.push(q);
            }
            
            // If we have enough taps, build the actual gate!
            if (state.placement.controls.length === reqClicks) {
                let fullGate = '';
                let c1 = state.placement.controls[0];
                let c2 = state.placement.controls[1];
                
                if (reqClicks === 2) {
                    if (base === 'CP') fullGate = `CP${angleStr}${c1}${c2}`;
                    else fullGate = `${base}${c1}${c2}`; // CX or SWAP
                } else if (reqClicks === 3) {
                    let c3 = state.placement.controls[2];
                    fullGate = `CCX${c1}${c2}${c3}`;
                }

                // --- NEW MULTI-QUBIT TOGGLE LOGIC ---
                let gateAlreadyExists = false;
                const requiredQubits = getOccupiedQubits(fullGate);
                
                state.currentGuess[c] = state.currentGuess[c].filter(g => {
                    if (g === fullGate) {
                        gateAlreadyExists = true;
                        return false; // Remove exact match
                    }
                    const existingQubits = getOccupiedQubits(g);
                    return !existingQubits.some(eq => requiredQubits.includes(eq)); // Clear overlapping
                });

                if (!gateAlreadyExists) {
                    state.currentGuess[c].push(fullGate);
                }
                // ------------------------------------
                
                // Reset placement state
                state.placement = { active: false, col: null, controls: [] };
                updateActiveRow(state, renderBoardCallback);
            } else {
                updateActiveRow(state, renderBoardCallback); // Highlight the intermediate tap
            }
        }
    }
}

export function updateActiveRow(state, renderBoardCallback) {
    renderBoardCallback(); 
    updateBlochSpheres(state.currentGuess, state.numQubits);
    
    if (state.currentMode === 'FREEPLAY') {
        let v = computeStateVector(state.currentGuess, state.numQubits, GATE_MATRICES);
        document.getElementById('live-state-amplitudes').innerText = "|ψ⟩ = " + stateToString(v, state.numQubits);
    }
}