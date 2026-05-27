import { computeStateVector, stateToString, statesMatch } from '../quantum/engine.js';
import { getGateMultiset, GATE_MATRICES } from '../quantum/gates.js';
import { getColumnHTML, showRevealCircuit, fireQuantumConfetti, showVictoryModal, clearGhostPointer, parseMarkdownAndMath, updateTimedStatusBar } from './ui.js';
import { markStageCompleted, completedStages, updateStats, setTutorialComplete } from '../data/storage.js';
import { STAGES } from '../data/stages.js';
import { updateActiveRow } from './dragdrop.js';

// NEW: Accept the renderBoardCallback from main.js
export function submitGuess(state, renderBoardCallback) {
    if (state.gameOver) return;
    
    if (state.currentMode === 'FREEPLAY') {
        const userState = computeStateVector(state.currentGuess, state.numQubits, GATE_MATRICES);
        const wrap = document.getElementById('row-active');
        
        // NEW: Clear old snapshots before printing a new one so they don't pile up
        wrap.querySelectorAll('.amplitudes-result').forEach(el => el.remove());

        const ampResult = document.createElement('div');
        ampResult.className = 'amplitudes-result';
        ampResult.innerText = "↳ Snapshot |ψ⟩ = " + parseMarkdownAndMath(stateToString(userState, state.numQubits));
        wrap.appendChild(ampResult);
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
        wrap.classList.remove('active');

        fireQuantumConfetti(startX, startY);

        // --- TIMED MODE: skip modal, auto-advance ---
        if (state.currentMode === 'TIMED') {
            const timeBonus = state.currentLvl === 3 ? 30 : 20;
            state.timerRemaining = Math.min(state.timerRemaining + timeBonus, 999);
            state.timedScore += state.currentLvl;
            state.timedCircuitsSolved++;
            updateTimedStatusBar(state);

            const msg = document.getElementById('message');
            msg.innerText = `Solved! +${timeBonus}s`;
            msg.style.color = '#22c55e';
            setTimeout(() => {
                msg.innerText = '';
                state.timedNextPuzzle && state.timedNextPuzzle();
            }, 1500);
            return;
        }

        const wasTutorial = state.isTutorial;
        if (state.isTutorial) {
            state.isTutorial = false;
            state.tutorialJustCompleted = true;
            setTutorialComplete();
            clearGhostPointer();
        }
        
        if (isStrict && matchedMultiset && !matchedCircuit) {
            for (let c = 0; c < state.numCols; c++) {
                const slot = document.getElementById(`slot-active-${c}`);
                let gateStatusMap = {};
                state.currentGuess[c].forEach(g => gateStatusMap[g] = 'correct');
                slot.innerHTML = getColumnHTML(state.currentGuess[c], state.numQubits, gateStatusMap);
            }
        }
        
        let mainTitle = "Stage Cleared!";
        let subTitle = matchedCircuit ? "Perfect Canonical Match!" : "Equivalent Circuit Found!";
        let statsText = null;
        let showNextBtn = false;
        let revealObj = null; 

        if (state.currentMode === 'STAGE') {
            markStageCompleted(state.currentP1, state.currentP2);
            
            let totalLevels = 0;
            STAGES.forEach(s => totalLevels += s.levels.length);
            let allCompleted = (completedStages.length >= totalLevels);
            
            if (state.currentP1 + 1 < STAGES.length || state.currentP2 + 1 < STAGES[state.currentP1].levels.length) {
                showNextBtn = true;
            } 
            
            if (allCompleted) subTitle = "🎉 All Stages Cleared! 🎉";
            else if (state.currentP1 === STAGES.length - 1 && state.currentP2 === STAGES[state.currentP1].levels.length - 1) subTitle = "Final Stage Complete!";
            
            if (!matchedMultiset && !matchedCircuit) {
                revealObj = { revealTitle: "A Canonical Circuit Was:", color: "#3b82f6", targetCircuit: state.secretCircuits[0], numQubits: state.numQubits };
            }
        } else if (state.currentMode === 'RANDOM' || state.currentMode === 'DAILY') {
            if (wasTutorial) {
                mainTitle = "Tutorial Complete!";
                subTitle = "Head to the Learn section to start your quantum journey!";
            } else {
                mainTitle = state.currentMode === 'DAILY' ? "Daily Solved!" : "Puzzle Solved!";
            }
            
            // --- NEW: Save Daily Completion ---
            if (state.currentMode === 'DAILY') {
                const now = new Date();
                const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
                let dailyStatus = JSON.parse(localStorage.getItem('quiver_daily') || '{"date":"","completed":[]}');
                
                // Double check the date, then save the completed level
                if (dailyStatus.date !== today) dailyStatus = { date: today, completed: [] };
                if (!dailyStatus.completed.includes(state.currentLvl)) {
                    dailyStatus.completed.push(state.currentLvl);
                    localStorage.setItem('quiver_daily', JSON.stringify(dailyStatus));
                }
            }

            let userGateCount = state.currentGuess.reduce((sum, col) => sum + col.length, 0);
            let secretGateCount = compareCircuit.reduce((sum, col) => sum + col.length, 0);
            
            let base = 10;
            let penalty = state.attempts; 
            let bonus = 0;
            let complimentHtml = "";

            if (userGateCount < secretGateCount) {
                bonus = 5;
                const compliments = [
                    "Brilliant optimization!",
                    "Quantum efficiency at its finest!",
                    "You beat the algorithm!",
                    "Masterful gate reduction!",
                    "Compiler genius!",
                    "Sleek and highly optimized!"
                ];
                let complimentText = compliments[Math.floor(Math.random() * compliments.length)];
                complimentHtml = `<div style="color: #22c55e; font-weight: bold; margin-top: 10px; font-size: 1.15rem; text-shadow: 0 0 10px rgba(34, 197, 94, 0.4);">⚡ ${complimentText} ⚡</div>`;
            }

            let multi = state.currentLvl === 1 ? 1 : (state.currentLvl === 2 ? 1.5 : 2);
            let pointsEarned = (base - penalty + bonus) * multi;
            state.currentStreak++;
            
            updateStats(pointsEarned, state.currentStreak);
            statsText = `+${pointsEarned} Points! <br><span style="font-size: 1rem; color: #cbd5e1;">🔥 Streak: ${state.currentStreak} &nbsp;&nbsp;|&nbsp;&nbsp; Gates Used: ${userGateCount} / ${secretGateCount}</span>${complimentHtml}`;

            if (!matchedCircuit) {
                revealObj = { revealTitle: "The Original Circuit Was:", color: "#3b82f6", targetCircuit: state.secretCircuits[0], numQubits: state.numQubits };
            }
        }

        setTimeout(() => {
            showVictoryModal(mainTitle, subTitle, statsText, showNextBtn, revealObj);
        }, 500);

    } else {
        state.attempts++;

        // --- TIMED MODE: 3-attempt limit, -5s penalty, auto-advance ---
        if (state.currentMode === 'TIMED') {
            state.timerRemaining = Math.max(0, state.timerRemaining - 5);
            updateTimedStatusBar(state);

            if (state.timerRemaining <= 0) {
                state.timedEndSession && state.timedEndSession();
                return;
            }

            if (state.attempts >= 3) {
                state.gameOver = true;
                wrap.classList.remove('active');
                document.getElementById('submit-btn').classList.add('hidden');
                const msg = document.getElementById('message');
                msg.innerText = 'Out of attempts! Loading next...';
                msg.style.color = '#ef4444';
                setTimeout(() => {
                    msg.innerText = '';
                    state.timedNextPuzzle && state.timedNextPuzzle();
                }, 1500);
                return;
            }

            const attemptsLeft = 3 - state.attempts;
            const msg = document.getElementById('message');
            msg.innerText = `−5s penalty! ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} left.`;
            msg.style.color = '#eab308';
            setTimeout(() => { if (!state.gameOver) msg.innerText = ''; }, 2000);

            // Save amplitude history before the board is rebuilt
            const prevAmps = Array.from(wrap.querySelectorAll('.amplitudes-result')).map(el => el.innerText);

            state.currentGuess = Array(state.numCols).fill().map(() => []);
            updateActiveRow(state, renderBoardCallback);

            // Re-attach saved amplitudes so the player can see all previous attempts
            const newWrap = document.getElementById('row-active');
            prevAmps.forEach(text => {
                const el = document.createElement('div');
                el.className = 'amplitudes-result';
                el.innerText = text;
                newWrap.appendChild(el);
            });

            // After 2nd failure: reveal the first gate as a hint
            if (state.attempts === 2) {
                let hintGates = [];
                for (let c = 0; c < state.numCols; c++) {
                    const col = state.secretCircuits[0][c];
                    if (col && col.length > 0) { hintGates = col; break; }
                }
                if (hintGates.length > 0) {
                    const gateNames = hintGates.map(g => g.replace(/[\d_].*/, '')).join(' + ');
                    const hintEl = document.createElement('div');
                    hintEl.className = 'amplitudes-result';
                    hintEl.style.color = '#38bdf8';
                    hintEl.innerText = `💡 Hint: First gate — ${gateNames}`;
                    newWrap.appendChild(hintEl);
                }
            }
            return;
        }

        document.getElementById('attempts-counter').innerText = `Attempts Remaining: ${6 - state.attempts}`;

        const historyWrap = wrap.cloneNode(true);
        historyWrap.removeAttribute('id');
        historyWrap.classList.remove('active');
        const clonedSlots = historyWrap.querySelectorAll('.slot');
        clonedSlots.forEach(s => s.removeAttribute('id'));
        document.getElementById('history-board').appendChild(historyWrap);

        if (state.attempts === 6) {
            state.gameOver = true;
            state.currentStreak = 0; 
            
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
            state.currentGuess = Array(state.numCols).fill().map(() => []);
            
            // FIXED: Pass the callback here to correctly rebuild the visual grid!
            updateActiveRow(state, renderBoardCallback); 
            
            const activeAmpResult = wrap.querySelector('.amplitudes-result');
            if (activeAmpResult) activeAmpResult.remove();
        }
    }
}