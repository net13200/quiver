export let completedStages = JSON.parse(localStorage.getItem('quarks_completed') || '[]');

export function markStageCompleted(sIdx, lIdx) {
    let id = `${sIdx}-${lIdx}`;
    if (!completedStages.includes(id)) {
        completedStages.push(id);
        localStorage.setItem('quarks_completed', JSON.stringify(completedStages));
    }
}