import { computeStateVector, stateToString, statesMatch } from '../quantum/engine.js';
import { getGateMultiset, normalizeGate, GATE_MATRICES } from '../quantum/gates.js';
import { trackSubmitAttempt, trackLevelComplete, trackLevelFail, trackTutorialComplete } from '../data/analytics.js';
import { parseMarkdownAndMath } from './ui.js';
import { markStageCompleted, completedStages, updateStats, setTutorialComplete, updateDailyStreak, updateLearnStreak, unlockAchievement, setAchievementProgress, achievementProgress } from '../data/storage.js';
import { ACHIEVEMENT_MAP } from '../data/achievements.js';
import { STAGES } from '../data/stages.js';

// Returns the minimum number of gate insertions/deletions needed to turn
// the user's circuit into any of the valid circuits (multiset edit distance).
function minGateEditDistance(guess, secretCircuits) {
    const userGates = [];
    for (const col of guess) for (const g of col) if (g && g !== 'I') userGates.push(normalizeGate(g));

    let minDist = Infinity;
    for (const circuit of secretCircuits) {
        const targetGates = [];
        for (const col of circuit) for (const g of col) if (g && g !== 'I') targetGates.push(normalizeGate(g));

        const countU = {}, countT = {};
        for (const g of userGates)  countU[g] = (countU[g] || 0) + 1;
        for (const g of targetGates) countT[g] = (countT[g] || 0) + 1;
        const keys = new Set([...Object.keys(countU), ...Object.keys(countT)]);
        let dist = 0;
        for (const g of keys) dist += Math.abs((countU[g] || 0) - (countT[g] || 0));
        if (dist < minDist) minDist = dist;
    }
    return minDist;
}

// Returns a result object describing what UI to show; all DOM work is done by
// applySubmitResult() in main.js. State mutations and analytics stay here.
export function submitGuess(state, renderBoardCallback, gameStartTime) {
    if (state.gameOver) return null;

    // --- FREEPLAY: snapshot only ---
    if (state.currentMode === 'FREEPLAY') {
        const userState = computeStateVector(state.currentGuess, state.numQubits, GATE_MATRICES);
        return {
            type: 'FREEPLAY_SNAPSHOT',
            ampText: "↳ Snapshot |ψ⟩ = " + parseMarkdownAndMath(stateToString(userState, state.numQubits)),
        };
    }

    // --- LAB ---
    if (state.currentMode === 'LAB') {
        const userState = computeStateVector(state.currentGuess, state.numQubits, GATE_MATRICES);
        const hasWon = statesMatch(userState, state.targetState, state.numQubits);
        const ampText = "↳ |ψ⟩ = " + stateToString(userState, state.numQubits);
        if (hasWon) {
            // DOM read before any mutation — needed for confetti origin
            const submitBtnEl = document.getElementById('submit-btn');
            const btnRect = submitBtnEl.getBoundingClientRect();
            state.gameOver = true;
            return {
                type: 'LAB_WIN',
                ampText,
                labTargetN: state.labTargetN,
                btnRect: { left: btnRect.left, top: btnRect.top, width: btnRect.width },
            };
        }
        return { type: 'LAB_LOSE', ampText, labTargetN: state.labTargetN };
    }

    // --- QFT_LAB ---
    if (state.currentMode === 'QFT_LAB') {
        const userState = computeStateVector(state.currentGuess, state.numQubits, GATE_MATRICES);
        return {
            type: 'QFT_LAB_SNAPSHOT',
            ampText: "↳ QFT|" + state.labTargetN + "⟩ = " + stateToString(userState, state.numQubits),
        };
    }

    // --- Main path ---
    if (!state.secretCircuits || state.secretCircuits.length === 0) return null;

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
            if (guessStr !== secretStr) allMatch = false;
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

    // Build column status maps (DOM coloring applied by applySubmitResult)
    const colStatusMaps = [];
    for (let c = 0; c < state.numCols; c++) {
        let guessGates = state.currentGuess[c] || [];
        let targetGates = compareCircuit[c] || [];
        let gateStatusMap = {};
        guessGates.forEach(g => { gateStatusMap[g] = targetGates.includes(g) ? 'correct' : 'absent'; });
        colStatusMaps.push({ guessGates: [...guessGates], gateStatusMap });
    }

    const userState = computeStateVector(state.currentGuess, state.numQubits, GATE_MATRICES);
    let hasWon = statesMatch(userState, state.targetState, state.numQubits);

    let isStrict = false;
    if (state.currentMode === 'STAGE') {
        isStrict = state.currentP1 >= 4;
    } else if (state.currentMode === 'QUIZ') {
        const _strictSrc = state.currentP1 === -1 ? (state._quizCurrentSIdx ?? 0) : state.currentP1;
        isStrict = _strictSrc >= 4;
    }

    let strictMsg = null;
    if (isStrict && hasWon && !matchedMultiset) {
        hasWon = false;
        strictMsg = "Correct quantum state, but this stage requires a specific gate sequence!";
    }

    const ampText = "↳ |ψ⟩ = " + stateToString(userState, state.numQubits);

    if (hasWon) {
        // DOM read before any mutation — needed for confetti origin
        const submitBtn = document.getElementById('submit-btn');
        const rect = submitBtn.getBoundingClientRect();
        const confettiOrigin = { x: rect.left + rect.width / 2, y: rect.top };

        trackSubmitAttempt(state.currentMode, state.currentP1, state.currentP2, state.currentLvl, state.attempts + 1, true, state.currentGuess);
        trackLevelComplete(state.currentMode, state.currentP1, state.currentP2, state.currentLvl, state.attempts, gameStartTime, state.currentGuess);
        state.gameOver = true;

        // --- TIMED WIN ---
        if (state.currentMode === 'TIMED') {
            const timeBonus = state.currentLvl === 3 ? 30 : 20;
            state.timerRemaining = Math.min(state.timerRemaining + timeBonus, 60);
            state.timedScore += state.currentLvl;
            state.timedCircuitsSolved++;
            state.timedCircuitIndex++;
            return { type: 'WIN', winMode: 'TIMED', colStatusMaps, ampText, confettiOrigin, timeBonus };
        }

        // --- QUIZ WIN ---
        if (state.currentMode === 'QUIZ') {
            state.quizScore++;
            return {
                type: 'WIN',
                winMode: 'QUIZ',
                colStatusMaps,
                ampText,
                confettiOrigin,
                quizFinal: state.quizScore >= state.quizTotal,
            };
        }

        // --- STAGE / RANDOM / DAILY WIN ---
        const wasTutorial = state.isTutorial;
        if (state.isTutorial) {
            state.isTutorial = false;
            state.tutorialJustCompleted = true;
            setTutorialComplete();
            trackTutorialComplete();
        }

        // Strict color-fix: user matched multiset but not exact circuit → show all green
        let strictColorFixMaps = null;
        if (isStrict && matchedMultiset && !matchedCircuit) {
            strictColorFixMaps = state.currentGuess.map(col => {
                const gateStatusMap = {};
                col.forEach(g => { gateStatusMap[g] = 'correct'; });
                return { guessGates: [...col], gateStatusMap };
            });
        }

        let mainTitle = "Stage Cleared!";
        let subTitle = matchedCircuit ? "Perfect Match!" : "Valid Circuit Found!";
        let statsText = null;
        let showNextBtn = false;
        let revealObj = null;

        if (state.currentMode === 'STAGE') {
            markStageCompleted(state.currentP1, state.currentP2);
            updateLearnStreak();

            let totalLevels = 0;
            STAGES.forEach(s => totalLevels += s.levels.length);
            let allCompleted = (completedStages.length >= totalLevels);

            if (state.currentP1 + 1 < STAGES.length || state.currentP2 + 1 < STAGES[state.currentP1].levels.length) {
                showNextBtn = true;
            }

            if (allCompleted) subTitle = "🎉 All Stages Cleared! 🎉";
            else if (state.currentP1 === STAGES.length - 1 && state.currentP2 === STAGES[state.currentP1].levels.length - 1) subTitle = "Final Stage Complete!";

            if (!matchedMultiset && !matchedCircuit) {
                revealObj = { revealTitle: "One Valid Circuit Is:", color: "#3b82f6", targetCircuit: state.secretCircuits[0], numQubits: state.numQubits };
            }
        } else if (state.currentMode === 'RANDOM' || state.currentMode === 'DAILY') {
            if (wasTutorial) {
                mainTitle = "Tutorial Complete!";
                subTitle = "Head to the Learn section to start your quantum journey!";
            } else {
                mainTitle = state.currentMode === 'DAILY' ? "Daily Solved!" : "Puzzle Solved!";
            }

            if (state.currentMode === 'DAILY') {
                const now = new Date();
                const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
                let dailyStatus = JSON.parse(localStorage.getItem('quiver_daily') || '{"date":"","completed":[]}');
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

        // Achievement checks
        const achToasts = [];
        {
            const tryUnlock = (id) => {
                if (unlockAchievement(id)) {
                    const a = ACHIEVEMENT_MAP[id];
                    if (a) achToasts.push({ name: a.name, icon: a.icon });
                }
            };

            tryUnlock('hello_quantum');
            if (wasTutorial) tryUnlock('tutorial_graduate');

            if (state.currentMode === 'STAGE') {
                tryUnlock('superposition');
                const stageIdx = state.currentP1;
                const stageData = STAGES[stageIdx];
                if (stageData) {
                    const stageComplete = stageData.levels.every((_, lIdx) => completedStages.includes(`${stageIdx}-${lIdx}`));
                    if (stageComplete) tryUnlock(`stage_${stageIdx}_complete`);
                }
                const allStageIds = [];
                STAGES.forEach((s, sIdx) => s.levels.forEach((_, lIdx) => allStageIds.push(`${sIdx}-${lIdx}`)));
                if (allStageIds.every(id => completedStages.includes(id))) tryUnlock('quantum_literate');
                if (state.activeSet.some(g => g.startsWith('QFT'))) tryUnlock('algorithm_architect');
                const ls = parseInt(localStorage.getItem('quiver_learn_streak') || '0');
                if (ls >= 7)  tryUnlock('learn_streak_7');
                if (ls >= 30) tryUnlock('learn_streak_30');
            }

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

            if (state.numQubits === 3) tryUnlock('three_body');
            if (state.attempts === 0) tryUnlock('first_try');
            if (state.attempts === 5) tryUnlock('clutch');

            if (state.currentMode === 'RANDOM' || state.currentMode === 'DAILY') {
                const achUser = state.currentGuess.reduce((s, c) => s + c.length, 0);
                const achSecret = compareCircuit.reduce((s, c) => s + c.length, 0);
                if (achUser < achSecret) {
                    tryUnlock('optimizer');
                    const n = (achievementProgress['optimizer_count'] || 0) + 1;
                    setAchievementProgress('optimizer_count', n);
                    if (n >= 5) tryUnlock('compiler_genius');
                }
                if (state.currentMode === 'DAILY') {
                    tryUnlock('daily_habit');
                    const ds = parseInt(localStorage.getItem('quiver_daily_streak') || '0');
                    setAchievementProgress('daily_streak', ds);
                    if (ds >= 7)  tryUnlock('week_warrior');
                    if (ds >= 30) tryUnlock('monthly_master');
                }
            }
        }

        const isFinalSubstage = state.currentMode === 'STAGE' &&
            state.currentP2 === STAGES[state.currentP1].levels.length - 1 &&
            (() => {
                const completedQuizzes = JSON.parse(localStorage.getItem('quarks_quizzes') || '[]');
                let ownerIdx = state.currentP1;
                while (ownerIdx + 1 < STAGES.length &&
                       STAGES[ownerIdx].levels.length === 1 &&
                       STAGES[ownerIdx + 1].levels.length === 1) {
                    ownerIdx++;
                }
                return !completedQuizzes.includes(ownerIdx);
            })();

        return {
            type: 'WIN',
            winMode: 'STAGE_RANDOM_DAILY',
            colStatusMaps,
            ampText,
            confettiOrigin,
            strictColorFixMaps,
            mainTitle,
            subTitle,
            statsText,
            showNextBtn,
            revealObj,
            menuBtnLabel: (state.currentMode === 'STAGE' || state.currentMode === 'QUIZ') ? 'Back to Section' : 'Main Menu',
            isFinalSubstage,
            currentMode: state.currentMode,
            currentP1: state.currentP1,
            currentLvl: state.currentLvl,
            randomSeed: state.randomSeed,
            randomGateMask: state.randomGateMask,
            wasTutorial,
            achToasts,
        };

    } else {
        // --- LOSE path ---
        state.attempts++;
        trackSubmitAttempt(state.currentMode, state.currentP1, state.currentP2, state.currentLvl, state.attempts, false, state.currentGuess);

        // --- TIMED LOSE ---
        if (state.currentMode === 'TIMED') {
            state.timerRemaining = Math.max(0, state.timerRemaining - 5);

            if (state.timerRemaining <= 0) {
                state.timedEndSession && state.timedEndSession();
                return { type: 'TIMED_EXPIRED', colStatusMaps, ampText };
            }

            if (state.attempts >= 3) {
                state.gameOver = true;
                state.timedCircuitIndex++;
                return { type: 'LOSE', loseMode: 'TIMED_OUT_OF_ATTEMPTS', colStatusMaps, ampText };
            }

            const attemptsLeft = 3 - state.attempts;

            // DOM read: capture amplitude history BEFORE board reset
            const wrap = document.getElementById('row-active');
            const prevAmps = Array.from(wrap.querySelectorAll('.amplitudes-result')).map(el => el.innerText);

            state.currentGuess = Array(state.numCols).fill().map(() => []);

            let hintText = null;
            if (state.attempts === 2) {
                let hintGates = [];
                for (let c = 0; c < state.numCols; c++) {
                    const col = state.secretCircuits[0][c];
                    if (col && col.length > 0) { hintGates = col; break; }
                }
                if (hintGates.length > 0) {
                    const gateNames = hintGates.map(g => g.replace(/[\d_].*/, '')).join(' + ');
                    hintText = `💡 Hint: First gate — ${gateNames}`;
                }
            }

            return {
                type: 'LOSE',
                loseMode: 'TIMED',
                colStatusMaps,
                ampText,
                timedPenaltyMsg: `−5s penalty! ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} left.`,
                prevAmps,
                hintText,
            };
        }

        // --- TUTORIAL LOSE ---
        if (state.isTutorial) {
            state.currentGuess = Array(state.numCols).fill(null).map((_, c) => [...(state.secretCircuits[0][c] || [])]);
            state.tutorialPhase = 'EVALUATE';
            return { type: 'LOSE', loseMode: 'TUTORIAL', colStatusMaps, ampText };
        }

        // --- QUIZ LOSE ---
        if (state.currentMode === 'QUIZ') {
            if (state.attempts >= 3) {
                state.quizLives--;
                state.gameOver = true;

                const _almostDist = minGateEditDistance(state.currentGuess, state.secretCircuits);
                if (state.quizLives <= 0) {
                    const _almostSuffix = _almostDist === 1 ? ' So close — just 1 gate off!' : '';
                    return {
                        type: 'LOSE',
                        loseMode: 'QUIZ_OUT_OF_LIVES',
                        colStatusMaps,
                        ampText,
                        quizMsg: `💔 Out of lives — quiz failed!${_almostSuffix}`,
                    };
                } else {
                    const l = state.quizLives;
                    const _almostPrefix = _almostDist === 1 ? 'So close! Just 1 gate off. ' : '';
                    const sIdx = state._quizCurrentSIdx ?? state._quizSIdx;
                    const lIdx = state._quizCurrentLevelIdx ?? 0;
                    return {
                        type: 'LOSE',
                        loseMode: 'QUIZ_QUESTION_FAILED_LIVES_REMAIN',
                        colStatusMaps,
                        ampText,
                        quizMsg: `${_almostPrefix}Circuit failed! ${l} ${l === 1 ? 'life' : 'lives'} remaining.`,
                        quizMsgColor: _almostDist === 1 ? '#22c55e' : '#eab308',
                        quizFailLevelLabel: `${sIdx}.${lIdx + 1}`,
                    };
                }
            }

            const left = 3 - state.attempts;
            const dist = minGateEditDistance(state.currentGuess, state.secretCircuits);
            state.currentGuess = Array(state.numCols).fill().map(() => []);

            return {
                type: 'LOSE',
                loseMode: 'QUIZ_PARTIAL',
                colStatusMaps,
                ampText,
                quizMsg: dist === 1 ? `So close! You're just 1 gate away!` : `Not quite — ${left} attempt${left !== 1 ? 's' : ''} left.`,
                quizMsgColor: dist === 1 ? '#22c55e' : '#eab308',
            };
        }

        // --- STAGE / RANDOM / DAILY LOSE ---
        const attemptsRemaining = 6 - state.attempts;

        if (state.attempts === 6) {
            state.gameOver = true;
            trackLevelFail(state.currentMode, state.currentP1, state.currentP2, state.currentLvl);
            state.currentStreak = 0;
            return {
                type: 'LOSE',
                loseMode: 'STAGE_GAME_OVER',
                colStatusMaps,
                ampText,
                attemptsRemaining,
                gameOverMode: state.currentMode,
                againBtnLabel: state.currentMode === 'STAGE' ? 'Retry Stage' : 'Play Again',
                showRestartBtn: state.currentMode === 'RANDOM',
                revealCircuit: { color: "#ef4444", targetCircuit: state.secretCircuits[0], numQubits: state.numQubits },
                strictMsg,
            };
        } else {
            state.currentGuess = Array(state.numCols).fill().map(() => []);
            return {
                type: 'LOSE',
                loseMode: 'STAGE_WRONG',
                colStatusMaps,
                ampText,
                attemptsRemaining,
                strictMsg,
            };
        }
    }
}
