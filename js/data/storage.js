export let completedStages = JSON.parse(localStorage.getItem('quarks_completed') || '[]');
export let totalPoints = parseFloat(localStorage.getItem('quiver_points') || '0');
export let highestStreak = parseInt(localStorage.getItem('quiver_streak') || '0');
export let tutorialComplete = JSON.parse(localStorage.getItem('quiver_tutorial') || 'false');
export let timedBest = JSON.parse(localStorage.getItem('quiver_timed_best') || '[0,0,0]');
export let dailyStreak = parseInt(localStorage.getItem('quiver_daily_streak') || '0');
export let lastDailyDate = localStorage.getItem('quiver_last_daily_date') || '';

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

export function updateDailyStreak() {
    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (lastDailyDate === today) return; // already counted today

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;

    dailyStreak = (lastDailyDate === yStr) ? dailyStreak + 1 : 1;
    lastDailyDate = today;
    localStorage.setItem('quiver_daily_streak', dailyStreak);
    localStorage.setItem('quiver_last_daily_date', lastDailyDate);
}

export function updateStats(pointsEarned, currentStreak) {
    totalPoints += pointsEarned;
    if (currentStreak > highestStreak) highestStreak = currentStreak;
    localStorage.setItem('quiver_points', totalPoints);
    localStorage.setItem('quiver_streak', highestStreak);
}