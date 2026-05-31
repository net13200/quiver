// Pure data — no imports.

export const ACHIEVEMENTS = [
    // Getting Started
    { id: 'hello_quantum',      name: 'Hello, Quantum!',      icon: '👋', desc: 'Complete your first puzzle of any kind',                                  category: 'Getting Started' },
    { id: 'tutorial_graduate',  name: 'Tutorial Graduate',    icon: '🎓', desc: 'Finish the interactive tutorial',                                          category: 'Getting Started' },
    { id: 'superposition',      name: 'Superposition',        icon: '🌊', desc: 'Complete your first Learn stage',                                          category: 'Getting Started' },

    // Learning — per-stage
    { id: 'stage_0_complete',   name: 'Quantum Foundations',  icon: '🌱', desc: 'Complete Stage 0: Quantum Foundations',   category: 'Learning' },
    { id: 'stage_1_complete',   name: 'Entangler',            icon: '🔔', desc: 'Complete Stage 1: Bell Pairs',             category: 'Learning' },
    { id: 'stage_2_complete',   name: 'Phase Flip',           icon: '🎯', desc: 'Complete Stage 2: Controlled-Z',           category: 'Learning' },
    { id: 'stage_3_complete',   name: 'Multipartite',         icon: '🔗', desc: 'Complete Stage 3: GHZ State',              category: 'Learning' },
    { id: 'stage_4_complete',   name: 'Swap Artist',          icon: '🔄', desc: 'Complete Stage 4: Build a SWAP Gate',      category: 'Learning' },
    { id: 'stage_5_complete',   name: 'Test Pilot',           icon: '🧪', desc: 'Complete Stage 5: The Swap Test',          category: 'Learning' },
    { id: 'stage_6_complete',   name: 'Interference Lab',     icon: '⚗️', desc: 'Complete Stage 6: The Hadamard Test',      category: 'Learning' },
    { id: 'stage_7_complete',   name: 'Phase Rotations',      icon: '🌀', desc: 'Complete Stage 7: Phase Rotations',        category: 'Learning' },
    { id: 'stage_8_complete',   name: 'Fourier Transform',    icon: '🎵', desc: 'Complete Stage 8: Quantum Fourier Transform', category: 'Learning' },
    { id: 'stage_9_complete',   name: 'Draper Adder',         icon: '➕', desc: 'Complete Stage 9: The QFT Adder',          category: 'Learning' },
    { id: 'stage_10_complete',  name: 'Phase Estimator',      icon: '📐', desc: 'Complete Stage 10: Quantum Phase Estimation', category: 'Learning' },
    { id: 'quantum_literate',   name: 'Quantum Literate',     icon: '📖', desc: 'Complete all Learn stages',                category: 'Learning' },
    { id: 'algorithm_architect',name: 'Algorithm Architect',  icon: '🏗️', desc: 'Complete a stage involving the Quantum Fourier Transform', category: 'Learning' },

    // Gates
    { id: 'phase_wizard',       name: 'Phase Wizard',         icon: '🌀', desc: 'Solve a puzzle using an RZ or CP gate',                                    category: 'Gates' },
    { id: 'toffoli_triumph',    name: 'Toffoli Triumph',      icon: '🔱', desc: 'Solve a puzzle using the Toffoli (CCX) gate',                              category: 'Gates' },
    { id: 'gate_collector',     name: 'Gate Collector',       icon: '🗂️', desc: 'Use all 10 gate types at least once', type: 'collection', target: ['X','Y','Z','H','SX','RZ','CX','CP','SWAP','CCX'], progressKey: 'gates_used', category: 'Gates' },

    // Skill
    { id: 'three_body',         name: 'Three-Body Problem',   icon: '🔮', desc: 'Solve a 3-qubit puzzle',                                                   category: 'Skill' },
    { id: 'first_try',          name: 'First Try!',           icon: '🎯', desc: 'Solve a puzzle on the very first attempt',                                 category: 'Skill' },
    { id: 'optimizer',          name: 'Optimizer',            icon: '⚡', desc: 'Solve a puzzle using fewer gates than the target circuit',                 category: 'Skill' },
    { id: 'compiler_genius',    name: 'Compiler Genius',      icon: '🧠', desc: 'Achieve the optimizer bonus 5 times', type: 'count',     target: 5,   progressKey: 'optimizer_count', category: 'Skill' },
    { id: 'clutch',             name: 'Clutch',               icon: '😤', desc: 'Solve a puzzle on the very last attempt (6th)',                            category: 'Skill' },

    // Streaks
    { id: 'on_a_roll',          name: 'On a Roll',            icon: '🔥', desc: 'Reach a solve streak of 5',                                                category: 'Streaks' },
    { id: 'hot_streak',         name: 'Hot Streak',           icon: '🌋', desc: 'Reach a solve streak of 15',                                               category: 'Streaks' },

    // Daily
    { id: 'daily_habit',        name: 'Daily Habit',          icon: '📅', desc: 'Complete a daily puzzle',                                                  category: 'Daily' },
    { id: 'week_warrior',       name: 'Week Warrior',         icon: '🗓️', desc: 'Complete daily puzzles 7 days in a row',  type: 'count',  target: 7,   progressKey: 'daily_streak', category: 'Daily' },
    { id: 'monthly_master',     name: 'Monthly Master',       icon: '🏆', desc: 'Complete daily puzzles 30 days in a row', type: 'count',  target: 30,  progressKey: 'daily_streak', category: 'Daily' },

    // Time Collapse
    { id: 'time_bender',        name: 'Time Bender',          icon: '⏱️', desc: 'Score 5 points in a single Time Collapse session',                        category: 'Time Collapse' },
    { id: 'clock_crusher',      name: 'Clock Crusher',        icon: '💥', desc: 'Score 15 points in a single Time Collapse session',                       category: 'Time Collapse' },

    // Social
    { id: 'challenge_friend',   name: 'Challenge Friend',     icon: '⚔️', desc: 'Share a challenge link with a friend',                                    category: 'Social' },
    { id: 'win_challenge',      name: 'Win Challenge',        icon: '🏅', desc: "Beat a friend's score in a Time Collapse duel",                           category: 'Social' },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

export const ACHIEVEMENT_CATEGORIES = [...new Set(ACHIEVEMENTS.map(a => a.category))];
