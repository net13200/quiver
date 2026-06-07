import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { setAnalyticsUserId } from './analytics.js';

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

// Returns { email } if a session was restored, undefined otherwise.
export async function initSync(applyRemote) {
    try {
        const { data: { session } } = await withTimeout(sb().auth.getSession(), 5000);
        if (!session) return;
        _userId = session.user.id;
        setAnalyticsUserId(_userId);

        const { data: remote } = await withTimeout(
            sb().from('progress').select('*').eq('user_id', _userId).maybeSingle(),
            5000
        );
        if (remote) applyRemote(remote);
        return { email: session.user.email };
    } catch (e) {
        console.info('Sync unavailable:', e.message);
    }
}

// Sign in — merges local progress with the server row.
export async function signIn(email, password, applyRemote) {
    const { data, error } = await sb().auth.signInWithPassword({ email, password });
    if (error) throw error;
    _userId = data.user.id;
    setAnalyticsUserId(_userId);
    await _push();
    const { data: remote } = await sb().from('progress').select('*').eq('user_id', _userId).maybeSingle();
    if (remote) applyRemote(remote);
    return data.user;
}

// Sign up — saves current local progress as the new account's initial data.
// Passwords are hashed with bcrypt by Supabase — never stored in plaintext.
export async function signUp(email, password) {
    const { data, error } = await sb().auth.signUp({ email, password });
    if (error) throw error;
    // Session is present immediately only when email confirmation is disabled.
    if (data.session) {
        _userId = data.user.id;
        setAnalyticsUserId(_userId);
        await _push();
    }
    return data;
}

export async function signOut() {
    await sb().auth.signOut();
    _userId = null;
}

export function isSignedIn() { return !!_userId; }

// Debounced — called after every local write; fires 1.5 s after the last call.
export function schedulePush() {
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(_push, 1500);
}

async function _push() {
    if (!_userId) return;
    try {
        await sb().from('progress').upsert({
            user_id:              _userId,
            completed_stages:     JSON.parse(localStorage.getItem('quarks_completed')    || '[]'),
            completed_quizzes:    JSON.parse(localStorage.getItem('quarks_quizzes')      || '[]'),
            total_points:         parseFloat(localStorage.getItem('quiver_points')       || '0'),
            highest_streak:       parseInt(localStorage.getItem('quiver_streak')         || '0'),
            timed_best:           JSON.parse(localStorage.getItem('quiver_timed_best')   || '[0,0,0]'),
            daily_streak:         parseInt(localStorage.getItem('quiver_daily_streak')   || '0'),
            last_daily_date:      localStorage.getItem('quiver_last_daily_date')         || '',
            tutorial_complete:    JSON.parse(localStorage.getItem('quiver_tutorial')     || 'false'),
            achievements:         JSON.parse(localStorage.getItem('quiver_achievements') || '[]'),
            achievement_progress: JSON.parse(localStorage.getItem('quiver_ach_progress') || '{}'),
            updated_at:           new Date().toISOString(),
        }, { onConflict: 'user_id' });
    } catch (e) {
        console.warn('Sync push failed:', e.message);
    }
}
