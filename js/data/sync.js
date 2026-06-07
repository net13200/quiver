import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://gexeorwjxbznkimgeokk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DkPdSor4LJfAHd1bHQwIIA_u4meT_mP';

let _sb = null;
let _userId = null;
let _pushTimer = null;

function sb() {
    if (!_sb) _sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    return _sb;
}

const withTimeout = (p, ms) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// Call once at boot. Resolves after auth + remote merge (or silently on error/timeout).
export async function initSync(applyRemote) {
    try {
        let { data: { session } } = await withTimeout(sb().auth.getSession(), 5000);
        if (!session) {
            const { data } = await withTimeout(sb().auth.signInAnonymously(), 5000);
            session = data?.session;
        }
        if (!session) return;
        _userId = session.user.id;

        const { data: remote } = await withTimeout(
            sb().from('progress').select('*').eq('user_id', _userId).maybeSingle(),
            5000
        );
        if (remote) applyRemote(remote);
    } catch (e) {
        console.info('Sync unavailable:', e.message);
    }
}

// Debounced — call after every local write; fires 1.5s after the last call.
export function schedulePush() {
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(_push, 1500);
}

async function _push() {
    if (!_userId) return;
    try {
        await sb().from('progress').upsert({
            user_id:              _userId,
            completed_stages:     JSON.parse(localStorage.getItem('quarks_completed')   || '[]'),
            completed_quizzes:    JSON.parse(localStorage.getItem('quarks_quizzes')     || '[]'),
            total_points:         parseFloat(localStorage.getItem('quiver_points')      || '0'),
            highest_streak:       parseInt(localStorage.getItem('quiver_streak')        || '0'),
            timed_best:           JSON.parse(localStorage.getItem('quiver_timed_best')  || '[0,0,0]'),
            daily_streak:         parseInt(localStorage.getItem('quiver_daily_streak')  || '0'),
            last_daily_date:      localStorage.getItem('quiver_last_daily_date')        || '',
            tutorial_complete:    JSON.parse(localStorage.getItem('quiver_tutorial')    || 'false'),
            achievements:         JSON.parse(localStorage.getItem('quiver_achievements')|| '[]'),
            achievement_progress: JSON.parse(localStorage.getItem('quiver_ach_progress')|| '{}'),
            updated_at:           new Date().toISOString(),
        }, { onConflict: 'user_id' });
    } catch (e) {
        console.warn('Sync push failed:', e.message);
    }
}
