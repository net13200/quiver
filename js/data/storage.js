export let completedStages = JSON.parse(localStorage.getItem('quarks_completed') || '[]');
export let totalPoints = parseFloat(localStorage.getItem('quiver_points') || '0');
export let highestStreak = parseInt(localStorage.getItem('quiver_streak') || '0');
export let tutorialComplete = JSON.parse(localStorage.getItem('quiver_tutorial') || 'false'); // NEW
export let timedBest = JSON.parse(localStorage.getItem('quiver_timed_best') || '[0,0,0]');

export function setTutorialComplete() {
    tutorialComplete = true;
    localStorage.setItem('quiver_tutorial', 'true');
}

export function markStageCompleted(sIdx, lIdx) {
    let id = `${sIdx}-${lIdx}`;
    if (!completedStages.includes(id)) {
        completedStages.push(id);
        localStorage.setItem('quarks_completed', JSON.stringify(completedStages));
    }
}

export function saveTimedBest(difficulty, score) {
    const idx = difficulty - 1;
    if (score > timedBest[idx]) {
        timedBest[idx] = score;
        localStorage.setItem('quiver_timed_best', JSON.stringify(timedBest));
        return true;
    }
    return false;
}

export function updateStats(pointsEarned, currentStreak) {
    totalPoints += pointsEarned;
    if (currentStreak > highestStreak) highestStreak = currentStreak;
    localStorage.setItem('quiver_points', totalPoints);
    localStorage.setItem('quiver_streak', highestStreak);
}