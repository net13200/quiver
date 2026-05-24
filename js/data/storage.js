export let completedStages = JSON.parse(localStorage.getItem('quarks_completed') || '[]');
export let totalPoints = parseFloat(localStorage.getItem('quiver_points') || '0');
export let highestStreak = parseInt(localStorage.getItem('quiver_streak') || '0');

export function markStageCompleted(sIdx, lIdx) {
    let id = `${sIdx}-${lIdx}`;
    if (!completedStages.includes(id)) {
        completedStages.push(id);
        localStorage.setItem('quarks_completed', JSON.stringify(completedStages));
    }
}

export function updateStats(pointsEarned, currentStreak) {
    totalPoints += pointsEarned;
    if (currentStreak > highestStreak) highestStreak = currentStreak;
    localStorage.setItem('quiver_points', totalPoints);
    localStorage.setItem('quiver_streak', highestStreak);
}