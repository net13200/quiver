export let completedStages = JSON.parse(localStorage.getItem('quarks_completed') || '[]');
export let totalPoints = parseFloat(localStorage.getItem('quiver_points') || '0');
export let highestStreak = parseInt(localStorage.getItem('quiver_streak') || '0');
export let tutorialComplete = JSON.parse(localStorage.getItem('quiver_tutorial') || 'false');
export let timedBest = JSON.parse(localStorage.getItem('quiver_timed_best') || '[0,0,0]');
export let dailyStreak = parseInt(localStorage.getItem('quiver_daily_streak') || '0');
export let lastDailyDate = localStorage.getItem('quiver_last_daily_date') || '';

export let unlockedAchievements = new Set(JSON.parse(localStorage.getItem('quiver_achievements') || '[]'));
export let achievementProgress = JSON.parse(localStorage.getItem('quiver_ach_progress') || '{}');

// Registered by sync.js after init so storage doesn't import sync.
let _syncHook = null;
export function setSyncHook(fn) { _syncHook = fn; }

export function setTutorialComplete() {
    tutorialComplete = true;
    localStorage.setItem('quiver_tutorial', 'true');
    _syncHook?.();
}

export function markStageCompleted(sIdx, lIdx) {
    const id = `${sIdx}-${lIdx}`;
    if (!completedStages.includes(id)) {
        completedStages.push(id);
        localStorage.setItem('quarks_completed', JSON.stringify(completedStages));
        _syncHook?.();
    }
}

export function saveTimedBest(difficulty, score) {
    const idx = difficulty - 1;
    if (score > timedBest[idx]) {
        timedBest[idx] = score;
        localStorage.setItem('quiver_timed_best', JSON.stringify(timedBest));
        _syncHook?.();
        return true;
    }
    return false;
}

export function updateDailyStreak() {
    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (lastDailyDate === today) return;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;

    dailyStreak = (lastDailyDate === yStr) ? dailyStreak + 1 : 1;
    lastDailyDate = today;
    localStorage.setItem('quiver_daily_streak', dailyStreak);
    localStorage.setItem('quiver_last_daily_date', lastDailyDate);
    _syncHook?.();
}

export function updateStats(pointsEarned, currentStreak) {
    totalPoints += pointsEarned;
    if (currentStreak > highestStreak) highestStreak = currentStreak;
    localStorage.setItem('quiver_points', totalPoints);
    localStorage.setItem('quiver_streak', highestStreak);
    _syncHook?.();
}

export function unlockAchievement(id) {
    if (unlockedAchievements.has(id)) return false;
    unlockedAchievements.add(id);
    localStorage.setItem('quiver_achievements', JSON.stringify([...unlockedAchievements]));
    _syncHook?.();
    return true;
}

export function setAchievementProgress(key, value) {
    achievementProgress[key] = value;
    localStorage.setItem('quiver_ach_progress', JSON.stringify(achievementProgress));
    _syncHook?.();
}

// Called after remote data is fetched — merges into local state (union/max everywhere).
export function applyRemoteProgress(remote) {
    // completed_stages: union
    const merged = [...new Set([...completedStages, ...(remote.completed_stages || [])])];
    if (merged.length !== completedStages.length) {
        completedStages = merged;
        localStorage.setItem('quarks_completed', JSON.stringify(completedStages));
    }

    // completed_quizzes: union
    const localQ  = JSON.parse(localStorage.getItem('quarks_quizzes') || '[]');
    const mergedQ = [...new Set([...localQ, ...(remote.completed_quizzes || [])])];
    if (mergedQ.length !== localQ.length)
        localStorage.setItem('quarks_quizzes', JSON.stringify(mergedQ));

    // points + streak: max
    if ((remote.total_points || 0) > totalPoints) {
        totalPoints = remote.total_points;
        localStorage.setItem('quiver_points', totalPoints);
    }
    if ((remote.highest_streak || 0) > highestStreak) {
        highestStreak = remote.highest_streak;
        localStorage.setItem('quiver_streak', highestStreak);
    }

    // timed best: element-wise max
    const remoteBest = remote.timed_best || [0, 0, 0];
    let bestChanged = false;
    remoteBest.forEach((v, i) => { if (v > timedBest[i]) { timedBest[i] = v; bestChanged = true; } });
    if (bestChanged) localStorage.setItem('quiver_timed_best', JSON.stringify(timedBest));

    // daily streak: keep whichever device has the more recent date; ties → take max streak
    const remoteDate = remote.last_daily_date || '';
    if (remoteDate > lastDailyDate ||
        (remoteDate === lastDailyDate && (remote.daily_streak || 0) > dailyStreak)) {
        dailyStreak    = remote.daily_streak || 0;
        lastDailyDate  = remoteDate;
        localStorage.setItem('quiver_daily_streak',    String(dailyStreak));
        localStorage.setItem('quiver_last_daily_date', lastDailyDate);
    }

    // tutorial: OR
    if (!tutorialComplete && remote.tutorial_complete) {
        tutorialComplete = true;
        localStorage.setItem('quiver_tutorial', 'true');
    }

    // achievements: union
    let achChanged = false;
    (remote.achievements || []).forEach(a => {
        if (!unlockedAchievements.has(a)) { unlockedAchievements.add(a); achChanged = true; }
    });
    if (achChanged) localStorage.setItem('quiver_achievements', JSON.stringify([...unlockedAchievements]));

    // achievement progress: max per key
    let achProgChanged = false;
    Object.entries(remote.achievement_progress || {}).forEach(([k, v]) => {
        if (!(k in achievementProgress) || v > achievementProgress[k]) {
            achievementProgress[k] = v;
            achProgChanged = true;
        }
    });
    if (achProgChanged) localStorage.setItem('quiver_ach_progress', JSON.stringify(achievementProgress));
}