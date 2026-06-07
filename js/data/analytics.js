const SUPABASE_URL  = 'https://gexeorwjxbznkimgeokk.supabase.co';
const SUPABASE_ANON = 'sb_publishable_DkPdSor4LJfAHd1bHQwIIA_u4meT_mP';
const ENDPOINT = `${SUPABASE_URL}/rest/v1/events`;

function getSessionId() {
    const KEY = 'quiver_session_id';
    let id = localStorage.getItem(KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
    return id;
}

async function _send(payload) {
    try {
        await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        SUPABASE_ANON,
                'Authorization': `Bearer ${SUPABASE_ANON}`,
                'Prefer':        'return=minimal'
            },
            body: JSON.stringify({ session_id: getSessionId(), ...payload })
        });
    } catch (_) {}
}

export function trackSessionStart() {
    _send({ event_name: 'session_start' });
}
export function trackGameStart(mode, p1, p2, randomLvl, targetState, secretCircuit, activeGates) {
    _send({ event_name: 'game_start', mode,
            stage: mode === 'STAGE' ? p1 : null,
            level: mode === 'STAGE' ? p2 : null,
            random_lvl: (mode === 'RANDOM' || mode === 'TIMED' || mode === 'DAILY') ? randomLvl : null,
            target_state: targetState ? JSON.stringify(targetState) : null,
            secret_circuit: secretCircuit ? JSON.stringify(secretCircuit) : null,
            active_gates: activeGates ? JSON.stringify(activeGates) : null });
}
export function trackSubmitAttempt(mode, p1, p2, randomLvl, attemptNum, success, submittedCircuit) {
    _send({ event_name: 'submit_attempt', mode, success, attempt_num: attemptNum,
            stage: mode === 'STAGE' ? p1 : null, level: mode === 'STAGE' ? p2 : null,
            random_lvl: (mode === 'RANDOM' || mode === 'TIMED' || mode === 'DAILY') ? randomLvl : null,
            submitted_circuit: submittedCircuit ? JSON.stringify(submittedCircuit) : null });
}
export function trackLevelComplete(mode, p1, p2, randomLvl, attemptsUsed, gameStartTime, submittedCircuit) {
    _send({ event_name: 'level_complete', mode, attempts_used: attemptsUsed,
            time_ms: Date.now() - gameStartTime,
            stage: mode === 'STAGE' ? p1 : null, level: mode === 'STAGE' ? p2 : null,
            random_lvl: (mode === 'RANDOM' || mode === 'TIMED' || mode === 'DAILY') ? randomLvl : null,
            submitted_circuit: submittedCircuit ? JSON.stringify(submittedCircuit) : null });
}
export function trackLevelFail(mode, p1, p2, randomLvl) {
    _send({ event_name: 'level_fail', mode, attempts_used: 6,
            stage: mode === 'STAGE' ? p1 : null, level: mode === 'STAGE' ? p2 : null,
            random_lvl: (mode === 'RANDOM' || mode === 'TIMED' || mode === 'DAILY') ? randomLvl : null });
}
export function trackHintViewed(mode, p1, p2, randomLvl) {
    _send({ event_name: 'hint_viewed', mode,
            stage: mode === 'STAGE' ? p1 : null, level: mode === 'STAGE' ? p2 : null,
            random_lvl: (mode === 'RANDOM' || mode === 'TIMED' || mode === 'DAILY') ? randomLvl : null });
}
export function trackLessonViewed(mode, p1, p2, randomLvl) {
    _send({ event_name: 'lesson_viewed', mode,
            stage: mode === 'STAGE' ? p1 : null, level: mode === 'STAGE' ? p2 : null,
            random_lvl: (mode === 'RANDOM' || mode === 'TIMED' || mode === 'DAILY') ? randomLvl : null });
}
export function trackTutorialComplete() {
    _send({ event_name: 'tutorial_complete' });
}
export function trackTutorialSkipped() {
    _send({ event_name: 'tutorial_skipped' });
}
export function trackSectionComplete(sectionName) {
    _send({ event_name: 'section_complete', section_name: sectionName });
}