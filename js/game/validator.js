import { computeStateVector, stateToString, statesMatch } from '../quantum/engine.js';
import { getGateMultiset, GATE_MATRICES } from '../quantum/gates.js';
import { getColumnHTML, showRevealCircuit, fireQuantumConfetti } from './ui.js';
import { markStageCompleted, completedStages } from '../data/storage.js';
import { STAGES } from '../data/stages.js';
import { updateActiveRow } from './dragdrop.js';

export function submitGuess(state) {
    if (state.gameOver) return;
    
    if (state.currentMode === 'FREEPLAY') {
        const userState = computeStateVector(state.currentGuess, state.numQubits, GATE_MATRICES);
        const ampResult = document.createElement('div');
        ampResult.className = 'amplitudes-result';
        ampResult.innerText = "↳ Snapshot |ψ⟩ = " + stateToString(userState, state.numQubits);
        document.getElementById('row-active').appendChild(ampResult);
        return; 
    }
    
    const wrap = document.getElementById('row-active');
    
    let userMultiset = getGateMultiset(state.currentGuess);
    let validMultisets = state.secretCircuits.map(c => getGateMultiset(c));
    let matchedMultiset = validMultisets.includes(userMultiset);
    
    let matchedCircuit = null;
    let bestMatchScore = -1;
    let bestMatchCircuit = state.secretCircuits[0];

    for (let possibleCircuit of state.secretCircuits) {
        let score = 0;
        let allMatch = true;
        for (let c = 0; c < state.numCols; c++) {
            let guessStr = [...state.currentGuess[c]].sort().join(',');
            let secretStr = possibleCircuit[c] ? [...possibleCircuit[c]].sort().join(',') : "";
            if (guessStr !== secretStr) {
                allMatch = false;
            }
            let targetGates = possibleCircuit[c] || [];
            state.currentGuess[c].forEach(g => {
                if (targetGates.includes(g)) score += 1;
            });
            if (guessStr === secretStr) score += 0.5; 
        }
        if (score > bestMatchScore) {
            bestMatchScore = score;
            bestMatchCircuit = possibleCircuit;
        }
        if (allMatch) {
            matchedCircuit = possibleCircuit;
            break;
        }
    }

    let compareCircuit = matchedCircuit || bestMatchCircuit;
    
    for (let c = 0; c < state.numCols; c++) {
        const slot = document.getElementById(`slot-active-${c}`);
        let guessGates = state.currentGuess[c] || [];
        let targetGates = compareCircuit[c] || [];
        
        let gateStatusMap = {};
        guessGates.forEach(g => {
            if (targetGates.includes(g)) {
                gateStatusMap[g] = 'correct';
            } else {
                gateStatusMap[g] = 'absent';
            }
        });
        
        slot.innerHTML = getColumnHTML(guessGates, state.numQubits, gateStatusMap);
    }
    
    const userState = computeStateVector(state.currentGuess, state.numQubits, GATE_MATRICES);
    let hasWon = statesMatch(userState, state.targetState, state.numQubits);
    
    let isStrict = (state.currentMode === 'STAGE' && state.currentP1 >= 4);
    if (isStrict && hasWon && !matchedMultiset) {
        hasWon = false; 
        let msg = document.getElementById('message');
        msg.innerText = "Equivalent state found, but exact canonical algorithm required!";
        msg.style.color = "#eab308";
        setTimeout(() => { if(!state.gameOver) msg.innerText = ""; }, 2500);
    }
    
    const ampResult = document.createElement('div');
    ampResult.className = 'amplitudes-result';
    ampResult.innerText = "↳ |ψ⟩ = " + stateToString(userState, state.numQubits);
    wrap.appendChild(ampResult);
    
    if (hasWon) {
        const submitBtn = document.getElementById('submit-btn');
        const rect = submitBtn.getBoundingClientRect();
        const startX = rect.left + (rect.width / 2);
        const startY = rect.top;

        state.gameOver = true;
        submitBtn.classList.add('hidden');
        wrap.classList.remove('active'); // Remove active glow since game is won
        
        fireQuantumConfetti(startX, startY);
        
        if (isStrict && matchedMultiset && !matchedCircuit) {
            for (let c = 0; c < state.numCols; c++) {
                const slot = document.getElementById(`slot-active-${c}`);
                let gateStatusMap = {};
                state.currentGuess[c].forEach(g => gateStatusMap[g] = 'correct');
                slot.innerHTML = getColumnHTML(state.currentGuess[c], state.numQubits, gateStatusMap);
            }
        }
        
        if (state.currentMode === 'STAGE') {
            let winMsg = (matchedMultiset || matchedCircuit) ? "Stage Cleared!" : "Equivalent Circuit Found! Stage Cleared!";
            markStageCompleted(state.currentP1, state.currentP2);
            
            let totalLevels = 0;
            STAGES.forEach(s => totalLevels += s.levels.length);
            let allCompleted = (completedStages.length >= totalLevels);
            
            if (state.currentP1 + 1 < STAGES.length || state.currentP2 + 1 < STAGES[state.currentP1].levels.length) {
                document.getElementById('next-btn').classList.remove('hidden');
            } 
            
            if (allCompleted) {
                document.getElementById('message').innerText = winMsg + " 🎉 All Stages Cleared! 🎉";
            } else if (state.currentP1 === STAGES.length - 1 && state.currentP2 === STAGES[state.currentP1].levels.length - 1) {
                document.getElementById('message').innerText = winMsg + " Final Stage Complete!";
            } else {
                document.getElementById('message').innerText = winMsg;
            }
            
            document.getElementById('message').style.color = (matchedMultiset || matchedCircuit) ? "#22c55e" : "#3b82f6";
            
            if (!matchedMultiset && !matchedCircuit) {
                showRevealCircuit("A Canonical Circuit Was:", "#3b82f6", state.secretCircuits[0], state.numQubits);
            }
            
            document.getElementById('again-btn').innerText = "Play Again";
            document.getElementById('again-btn').classList.remove('hidden');
            
        } else if (state.currentMode === 'RANDOM') {
            document.getElementById('message').innerText = matchedCircuit ? "Perfect Match! You won!" : "Equivalent Circuit Found! You won!";
            document.getElementById('message').style.color = matchedCircuit ? "#22c55e" : "#3b82f6";
            if (!matchedCircuit) showRevealCircuit("The Original Circuit Was:", "#3b82f6", state.secretCircuits[0], state.numQubits);
            
            document.getElementById('again-btn').innerText = "Play Again";
            document.getElementById('again-btn').classList.remove('hidden');
        }
    } else {
        // --- FAILED ATTEMPT LOGIC ---
        state.attempts++;
        document.getElementById('attempts-counter').innerText = `Attempts Remaining: ${6 - state.attempts}`;

        // Clone the evaluated row and drop it into history
        const historyWrap = wrap.cloneNode(true);
        historyWrap.removeAttribute('id'); // Remove specific ID to prevent duplicates
        historyWrap.classList.remove('active');
        const clonedSlots = historyWrap.querySelectorAll('.slot');
        clonedSlots.forEach(s => s.removeAttribute('id'));
        document.getElementById('history-board').appendChild(historyWrap);

        if (state.attempts === 6) {
            state.gameOver = true;
            wrap.classList.remove('active');
            document.getElementById('submit-btn').classList.add('hidden');
            document.getElementById('message').innerText = "Measurement collapsed! Game Over.";
            document.getElementById('message').style.color = "#ef4444";
            
            if (state.currentMode === 'STAGE') {
                showRevealCircuit("A Canonical Target Was:", "#ef4444", state.secretCircuits[0], state.numQubits);
                document.getElementById('again-btn').innerText = "Retry Stage";
                document.getElementById('again-btn').classList.remove('hidden');
            } else {
                showRevealCircuit("The Target Circuit Was:", "#ef4444", state.secretCircuits[0], state.numQubits);
                document.getElementById('again-btn').innerText = "Play Again";
                document.getElementById('again-btn').classList.remove('hidden');
            }
        } else {
            // Quietly wipe the active board clean for the next guess
            state.currentGuess = Array(state.numCols).fill().map(() => []);
            updateActiveRow(state);
            const activeAmpResult = wrap.querySelector('.amplitudes-result');
            if (activeAmpResult) activeAmpResult.remove();
        }
    }
}