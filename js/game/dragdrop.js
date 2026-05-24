import { getColumnHTML, updateBlochSpheres } from './ui.js';
import { getOccupiedQubits, addGateToColumn, GATE_MATRICES } from '../quantum/gates.js';
import { computeStateVector, stateToString } from '../quantum/engine.js';

// We inject the state directly from main.js into this function to keep it modular
export function attachDragDropHandlers(slot, r, c, state) {
    
    slot.addEventListener('dragover', (e) => {
        if (r === state.attempts && !state.gameOver) { 
            e.preventDefault(); 
            slot.classList.add('drag-over'); 
        }
    });

    slot.addEventListener('dragleave', () => {
        if (r === state.attempts && !state.gameOver) {
            slot.classList.remove('drag-over');
        }
    });

    slot.addEventListener('drop', (e) => {
        if (r === state.attempts && !state.gameOver) {
            e.preventDefault();
            slot.classList.remove('drag-over');
            const type = e.dataTransfer.getData('text/plain');
            if (type) {
                state.currentGuess[c] = addGateToColumn(state.currentGuess[c], type);
                updateActiveRow(state);
            }
        }
    });

    slot.addEventListener('click', () => {
        if (r === state.attempts && !state.gameOver && state.currentGuess[c].length > 0) {
            state.currentGuess[c].pop(); 
            updateActiveRow(state);
        }
    });
}

// Handles updating the immediate row whenever a gate is dropped or clicked
export function updateActiveRow(state) {
    for (let c = 0; c < state.numCols; c++) {
        const slot = document.getElementById(`slot-${state.attempts}-${c}`);
        if(slot) slot.innerHTML = getColumnHTML(state.currentGuess[c], state.numQubits);
    }
    
    updateBlochSpheres(state.currentGuess, state.numQubits);
    
    if (state.currentMode === 'FREEPLAY') {
        let v = computeStateVector(state.currentGuess, state.numQubits, GATE_MATRICES);
        document.getElementById('live-state-amplitudes').innerText = "|ψ⟩ = " + stateToString(v, state.numQubits);
    }
}