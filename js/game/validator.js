import { computeStateVector, stateToString, statesMatch } from '../quantum/engine.js';
import { getGateMultiset, normalizeGate, GATE_MATRICES } from '../quantum/gates.js';
import { trackSubmitAttempt, trackLevelComplete, trackLevelFail } from '../data/analytics.js';
import { gameStartTime } from '../main.js';
import { getColumnHTML, showRevealCircuit, fireQuantumConfetti, showVictoryModal, hideVictoryModal, clearGhostPointer, setGhostPointer, parseMarkdownAndMath, updateTimedStatusBar, showAchievementToast } from './ui.js';
import { markStageCompleted, completedStages, updateStats, setTutorialComplete, updateDailyStreak, unlockAchievement, setAchievementProgress, achievementProgress } from '../data/storage.js';
import { ACHIEVEMENT_MAP } from '../data/achievements.js';
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

    if (state.currentMode === 'LAB') {
        const wrap = document.getElementById('row-active');
        wrap.querySelectorAll('.amplitudes-result').forEach(el => el.remove());
        const userState = computeStateVector(state.currentGuess, state.numQubits, GATE_MATRICES);
        const hasWon = statesMatch(userState, state.targetState, state.numQubits);
        const ampResult = document.createElement('div');
        ampResult.className = 'amplitudes-result';
        ampResult.innerText = "↳ |ψ⟩ = " + stateToString(userState, state.numQubits);
        wrap.appendChild(ampResult);
        if (hasWon) {
            const submitBtnEl = document.getElementById('submit-btn');
            const btnRect = submitBtnEl.getBoundingClientRect();
            state.gameOver = true;
            submitBtnEl.classList.add('hidden');
            wrap.classList.remove('active');
            fireQuantumConfetti(btnRect.left + btnRect.width / 2, btnRect.top);
            setTimeout(() => {
                const n = state.labTargetN;
                showVictoryModal('Fourier Encoded!', `|0⟩ → |${n}⟩ — you encoded +${n} in the Fourier basis!`, null, false, null);
                const controls = document.querySelector('#victory-modal .victory-controls');
                if (controls && !document.getElementById('modal-lab-next-btn')) {
                    const tryBtn = document.createElement('button');
                    tryBtn.id = 'modal-lab-next-btn';
                    tryBtn.className = 'btn';
                    tryBtn.style.background = '#f59e0b';
                    tryBtn.innerText = 'Try Another Number';
                    tryBtn.addEventListener('click', () => hideVictoryModal());
                    controls.insertBefore(tryBtn, controls.firstChild);
                }
            }, 500);
        } else {
            wrap.classList.add('wrong-attempt');
            wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });
            const msg = document.getElementById('message');
            msg.style.color = '#eab308';
            msg.innerText = `Not |${state.labTargetN}⟩ yet — check the state vector and adjust the phases!`;
            setTimeout(() => { if (!state.gameOver) msg.innerText = ''; }, 3000);
        }
        return;
    }

    if (state.currentMode === 'QFT_LAB') {
        const wrap = document.getElementById('row-active');
        wrap.querySelectorAll('.amplitudes-result').forEach(el => el.remove());
        const userState = computeStateVector(state.currentGuess, state.numQubits, GATE_MATRICES);
        const ampResult = document.createElement('div');
        ampResult.className = 'amplitudes-result';
        ampResult.innerText = "↳ QFT|" + state.labTargetN + "⟩ = " + stateToString(userState, state.numQubits);
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
            let guessStr = [...state.currentGuess[c]].map(normalizeGate).sort().join(',');
            let secretStr = possibleCircuit[c] ? [...possibleCircuit[c]].map(normalizeGate).sort().join(',') : "";
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

        trackSubmitAttempt(state.currentMode, state.currentP1, state.currentP2, state.currentLvl, state.attempts + 1, true, state.currentGuess);
        trackLevelComplete(state.currentMode, state.currentP1, state.currentP2, state.currentLvl, state.attempts, gameStartTime, state.currentGuess);
        state.gameOver = true;
        submitBtn.classList.add('hidden');
        wrap.classList.remove('active');

        fireQuantumConfetti(startX, startY);

        // --- TIMED MODE: skip modal, auto-advance ---
        if (state.currentMode === 'TIMED') {
            const timeBonus = state.currentLvl === 3 ? 30 : 20;
            state.timerRemaining = Math.min(state.timerRemaining + timeBonus, 60);
            state.timedScore += state.currentLvl;
            state.timedCircuitsSolved++;
            state.timedCircuitIndex++;
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
                    updateDailyStreak();
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

        // --- Achievement Checks ---
        {
            const achToasts = [];
            const tryUnlock = (id) => {
                if (unlockAchievement(id)) {
                    const a = ACHIEVEMENT_MAP[id];
                    if (a) achToasts.push({ name: a.name, icon: a.icon });
                }
            };

            // Universal
            tryUnlock('hello_quantum');
            if (wasTutorial) tryUnlock('tutorial_graduate');

            // STAGE-specific
            if (state.currentMode === 'STAGE') {
                tryUnlock('superposition');
                setAchievementProgress('learn_count', completedStages.length);
                if (completedStages.length >= 10) tryUnlock('wave_function');
                if (completedStages.length >= 25) tryUnlock('interference');
                const allStageIds = [];
                STAGES.forEach((s, sIdx) => s.levels.forEach((_, lIdx) => allStageIds.push(`${sIdx}-${lIdx}`)));
                if (allStageIds.every(id => completedStages.includes(id))) tryUnlock('quantum_literate');
                if (state.activeSet.some(g => g.startsWith('QFT'))) tryUnlock('algorithm_architect');
            }

            // Gate-based (all modes)
            const GATE_PREFIXES = ['IQFT','QFT','CCX','SWAP','RZ','CP','CX','SX','X','Y','Z','H'];
            const usedBases = new Set();
            state.currentGuess.flat().forEach(g => {
                for (const base of GATE_PREFIXES) { if (g.startsWith(base)) { usedBases.add(base); break; } }
            });
            if (usedBases.has('RZ') || usedBases.has('CP')) tryUnlock('phase_wizard');
            if (usedBases.has('CCX')) tryUnlock('toffoli_triumph');
            const collected = new Set(achievementProgress['gates_used'] || []);
            usedBases.forEach(g => collected.add(g));
            setAchievementProgress('gates_used', [...collected]);
            const COLLECTOR_GATES = ['X','Y','Z','H','SX','RZ','CX','CP','SWAP','CCX'];
            if (COLLECTOR_GATES.every(g => collected.has(g))) tryUnlock('gate_collector');

            // Skill
            if (state.numQubits === 3) tryUnlock('three_body');
            if (state.attempts === 0) tryUnlock('first_try');
            if (state.attempts === 5) tryUnlock('clutch');

            // RANDOM/DAILY-specific
            if (state.currentMode === 'RANDOM' || state.currentMode === 'DAILY') {
                const achUser = state.currentGuess.reduce((s,c) => s+c.length, 0);
                const achSecret = compareCircuit.reduce((s,c) => s+c.length, 0);
                if (achUser < achSecret) {
                    tryUnlock('optimizer');
                    const n = (achievementProgress['optimizer_count'] || 0) + 1;
                    setAchievementProgress('optimizer_count', n);
                    if (n >= 5) tryUnlock('compiler_genius');
                }
                if (state.currentStreak >= 5)  tryUnlock('on_a_roll');
                if (state.currentStreak >= 15) tryUnlock('hot_streak');
                if (state.currentMode === 'DAILY') {
                    tryUnlock('daily_habit');
                    const ds = parseInt(localStorage.getItem('quiver_daily_streak') || '0');
                    setAchievementProgress('daily_streak', ds);
                    if (ds >= 7)  tryUnlock('week_warrior');
                    if (ds >= 30) tryUnlock('monthly_master');
                }
            }

            // Staggered toasts
            achToasts.forEach((t, i) => setTimeout(() => showAchievementToast(t.name, t.icon), 900 + i * 1700));
        }

        setTimeout(() => {
            showVictoryModal(mainTitle, subTitle, statsText, showNextBtn, revealObj);
            if (state.currentMode === 'RANDOM') {
                const controls = document.querySelector('#victory-modal .victory-controls');
                if (controls && !document.getElementById('modal-restart-btn')) {
                    const retryBtn = document.createElement('button');
                    retryBtn.id = 'modal-restart-btn';
                    retryBtn.className = 'btn';
                    retryBtn.style.background = '#3b82f6';
                    retryBtn.innerText = 'Retry Same Circuit';
                    retryBtn.addEventListener('click', () => {
                        document.dispatchEvent(new CustomEvent('restart-circuit'));
                    });
                    controls.insertBefore(retryBtn, controls.firstChild);
                }
                if (controls && !document.getElementById('modal-play-challenge-btn')) {
                    const challengeBtn = document.createElement('button');
                    challengeBtn.id = 'modal-play-challenge-btn';
                    challengeBtn.className = 'btn';
                    challengeBtn.style.background = '#7c3aed';
                    challengeBtn.innerText = '⚔️ Challenge a Friend';
                    challengeBtn.addEventListener('click', () => {
                        if (unlockAchievement('challenge_friend')) {
                            const _a = ACHIEVEMENT_MAP['challenge_friend'];
                            if (_a) setTimeout(() => showAchievementToast(_a.name, _a.icon), 200);
                        }
                        const url = `${window.location.origin}${window.location.pathname}?play-challenge=${state.currentLvl}-${state.randomSeed}-${state.randomGateMask}`;
                        navigator.clipboard.writeText(url).then(() => {
                            challengeBtn.innerText = 'Link Copied! ✓';
                            challengeBtn.style.background = '#059669';
                            setTimeout(() => {
                                challengeBtn.innerText = '⚔️ Challenge a Friend';
                                challengeBtn.style.background = '#7c3aed';
                            }, 2500);
                        });
                    });
                    controls.insertBefore(challengeBtn, controls.firstChild);
                }
            } else if (state.currentMode === 'DAILY') {
                const controls = document.querySelector('#victory-modal .victory-controls');
                if (controls && !document.getElementById('modal-daily-challenge-btn')) {
                    const challengeBtn = document.createElement('button');
                    challengeBtn.id = 'modal-daily-challenge-btn';
                    challengeBtn.className = 'btn';
                    challengeBtn.style.background = '#059669';
                    challengeBtn.innerText = '📅 Challenge a Friend';
                    challengeBtn.addEventListener('click', () => {
                        if (unlockAchievement('challenge_friend')) {
                            const _a = ACHIEVEMENT_MAP['challenge_friend'];
                            if (_a) setTimeout(() => showAchievementToast(_a.name, _a.icon), 200);
                        }
                        const url = `${window.location.origin}${window.location.pathname}?daily-challenge=${state.currentLvl}`;
                        navigator.clipboard.writeText(url).then(() => {
                            challengeBtn.innerText = 'Link Copied! ✓';
                            challengeBtn.style.background = '#7c3aed';
                            setTimeout(() => {
                                challengeBtn.innerText = '📅 Challenge a Friend';
                                challengeBtn.style.background = '#059669';
                            }, 2500);
                        });
                    });
                    controls.insertBefore(challengeBtn, controls.firstChild);
                }
            }
            if (state.currentMode === 'STAGE' && state.currentP1 === 9) {
                const controls = document.querySelector('#victory-modal .victory-controls');
                if (controls && !document.getElementById('modal-lab-btn')) {
                    const labBtn = document.createElement('button');
                    labBtn.id = 'modal-lab-btn';
                    labBtn.className = 'btn';
                    labBtn.style.background = '#f59e0b';
                    labBtn.innerText = '🧪 Try the QFT Adder';
                    labBtn.addEventListener('click', () => {
                        state.labFromP2 = state.currentP2;
                        hideVictoryModal();
                        window.initLabGame(1);
                    });
                    controls.insertBefore(labBtn, controls.firstChild);
                }
            }
            if (state.currentMode === 'STAGE' && state.currentP1 === 8) {
                const controls = document.querySelector('#victory-modal .victory-controls');
                if (controls && !document.getElementById('modal-qft-lab-btn')) {
                    const labBtn = document.createElement('button');
                    labBtn.id = 'modal-qft-lab-btn';
                    labBtn.className = 'btn';
                    labBtn.style.background = '#f59e0b';
                    labBtn.innerText = '🔬 Try the QFT';
                    labBtn.addEventListener('click', () => {
                        state.qftLabFromP2 = state.currentP2;
                        hideVictoryModal();
                        window.initQftLab(0);
                    });
                    controls.insertBefore(labBtn, controls.firstChild);
                }
            }
        }, 500);

    } else {
        state.attempts++;
        trackSubmitAttempt(state.currentMode, state.currentP1, state.currentP2, state.currentLvl, state.attempts, false, state.currentGuess);

        // --- TIMED MODE: 3-attempt limit, -5s penalty, auto-advance ---
        if (state.currentMode === 'TIMED') {
            wrap.classList.add('wrong-attempt');
            wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });

            state.timerRemaining = Math.max(0, state.timerRemaining - 5);
            updateTimedStatusBar(state);

            if (state.timerRemaining <= 0) {
                state.timedEndSession && state.timedEndSession();
                return;
            }

            if (state.attempts >= 3) {
                state.gameOver = true;
                state.timedCircuitIndex++;
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

        if (state.isTutorial) {
            wrap.classList.add('wrong-attempt');
            wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });
            state.currentGuess = Array(state.numCols).fill(null).map((_, c) => [...(state.secretCircuits[0][c] || [])]);
            updateActiveRow(state, renderBoardCallback);
            clearGhostPointer();
            state.tutorialPhase = 'EVALUATE';
            setGhostPointer('EVALUATE');
            const msg = document.getElementById('message');
            msg.style.color = '#38bdf8';
            msg.innerText = "Here's the correct circuit — hit Evaluate to complete the tutorial!";
            return;
        }

        document.getElementById('attempts-counter').innerText = `Attempts Remaining: ${6 - state.attempts}`;

        wrap.classList.add('wrong-attempt');
        wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });

        const historyWrap = wrap.cloneNode(true);
        historyWrap.removeAttribute('id');
        historyWrap.classList.remove('active', 'wrong-attempt');
        const clonedSlots = historyWrap.querySelectorAll('.slot');
        clonedSlots.forEach(s => s.removeAttribute('id'));
        document.getElementById('history-board').appendChild(historyWrap);

        if (state.attempts === 6) {
            state.gameOver = true;
            trackLevelFail(state.currentMode, state.currentP1, state.currentP2, state.currentLvl);
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
                if (state.currentMode === 'RANDOM') {
                    document.getElementById('restart-btn').classList.remove('hidden');
                }
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