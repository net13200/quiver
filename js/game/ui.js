import { drawBlochSphere, calcBlochVector } from '../quantum/bloch.js';
import { stateToString, computeStateVector } from '../quantum/engine.js';
import { GATE_MATRICES } from '../quantum/gates.js';

export function parseMarkdownAndMath(text) {
    if (!text) return '';

    let html = text;

    // Instantly translate raw backslash commands into clean Unicode characters
    html = html.replace(/\\left|left(?=\s*\||\s*\\)/g, '')
               .replace(/\\right|right(?=\s*⟩|\s*\\rangle|\s*\|)/g, '');
    
    // Target and swap out exact QFT decimal strings with their trig definitions
    html = html.replace(/0\.831/g, 'cos(3π/16)')
               .replace(/0\.556/g, 'sin(3π/16)')
               .replace(/0\.195/g, 'sin(π/16)')
               .replace(/0\.981/g, 'cos(π/16)');

    // Keep your existing loose left/right markers and brackets rules directly below it...
    html = html.replace(/\\left|left(?=\s*\||\s*\\)/g, '')
               .replace(/\\right|right(?=\s*⟩|\s*\\rangle|\s*\|)/g, '');
    
    html = html.replace(/\|0\s*angle/gi, '|0⟩')
               .replace(/\|1\s*angle/gi, '|1⟩')
               .replace(/angle\s*\$/gi, '⟩')
               .replace(/0\s*\$/gi, '0');

    html = html.replace(/\\sqrt\{(.*?)\}/g, '√$1')
               .replace(/\\frac\{1\}\{\\sqrt\{2\}\}/g, '1/1/√2') // Handles overlapping fractions safely
               .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '$1/$2')
               .replace(/\\psi/g, 'ψ')
               .replace(/\\phi/g, 'ϕ')
               .replace(/\\theta/g, 'θ')
               .replace(/\\pi/g, 'π')
               .replace(/\\rangle/g, '⟩')
               .replace(/\\langle/g, '⟨')
               .replace(/\\left\|/g, '|')
               .replace(/\\right\|/g, '|')
               .replace(/\\text\{(.*?)\}/g, '$1')
               .replace(/\\%/g, '%') // Cleans up escaped percentage signs like \%
               .replace(/\\\s/g, ' ');
    
    // 1. Convert Display Math Block: $$ math $$ -> Clean centered block
    html = html.replace(/\$\$(.*?)\$\$/gs, (match, p1) => {
        let math = p1.replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '$1/$2')
                     .replace(/\\left\|/g, '|')
                     .replace(/\\right\\rangle/g, '⟩')
                     .replace(/\\rangle/g, '⟩')
                     .replace(/\\psi/g, 'ψ')
                     .replace(/\\text\{(.*?)\}/g, '$1')
                     .replace(/\\\s/g, ' ');
        return `<div style="text-align: center; margin: 16px 0; font-size: 1.25em; font-weight: bold; color: #22d3ee; font-family: monospace;">${math}</div>`;
    });

    // 2. Convert Inline Math: $ math $ -> Crisp variable highlights
    html = html.replace(/\$(.*?)\$/g, (match, p1) => {
        let math = p1.replace(/\\rangle/g, '⟩')
                     .replace(/\\psi/g, 'ψ')
                     .replace(/\\left\|/g, '|')
                     .replace(/\\right\|/g, '|')
                     .replace(/\^2/g, '²')
                     .replace(/\\frac\{1\}\{\\sqrt\{2\}\}/g, '1/√2');
        return `<span style="font-family: monospace; font-weight: bold; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 2px 6px; border-radius: 4px;">${math}</span>`;
    });

    // 2.5 Convert Horizontal Lines: *** -> Clean divider line
    html = html.replace(/^\*\*\*\s*$/gm, '<hr style="border: 0; height: 1px; background: #334155; margin: 24px 0;">');

    // 3. Convert Headers: ### Header
    html = html.replace(/^###\s+(.*)$/gm, '<h3 style="color: #38bdf8; margin-top: 24px; margin-bottom: 12px; font-size: 1.35em; border-bottom: 1px solid #334155; padding-bottom: 6px; font-weight: 700;">$1</h3>');

    // 4. Convert Bold Text: **text** -> Bold HTML tag
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    // 5. Convert Markdown Bullet Points: * item -> Styled list items
    // First, convert individual bullet lines into HTML list items
    html = html.replace(/^\*\s+(.*)$/gm, '<li style="margin-left: 20px; margin-bottom: 6px; list-style-type: disc;">$1</li>');

    // 6. Convert Newlines into real paragraph breaks
    html = html.replace(/\n\n/g, '<br><br>');

    return html;
}

export function toggleMenu(id) {
    // Dynamically grab EVERY menu on the page! No more hardcoded arrays.
    const allMenus = document.querySelectorAll('.menu-content');
    
    allMenus.forEach(el => {
        const header = el.previousElementSibling;
        
        if (el.id === id) {
            // Toggle the one we clicked
            el.classList.toggle('hidden');
            header.classList.toggle('active');
        } else {
            // Hide all the others
            el.classList.add('hidden');
            header.classList.remove('active');
        }
    });
}

export function toggleAllGates() {
    const checkboxes = document.querySelectorAll('.gate-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
}

export function getColumnHTML(gates, numQubits, gateStatusMap = null) {
    let html = '';
    for(let q=0; q<numQubits; q++) {
        let top = ((q + 0.5) / numQubits * 100) + '%';
        html += `<div class="wire" style="top: ${top}"></div>`;
    }
    for(let type of gates) {
        let statusClass = (gateStatusMap && gateStatusMap[type]) ? (gateStatusMap[type] === 'correct' ? 'eval-correct' : 'eval-absent') : '';
        const rowHeight = Math.max(60, numQubits * 30) / numQubits;
        if (type.startsWith('QFT') || type.startsWith('IQFT')) {
            let cssClass = type === 'IQFT' ? 'iqft-gate' : 'qft-gate';
            let heightPx = (numQubits * rowHeight);
            html += `<div class="gate-box ${cssClass}${statusClass}" style="position: absolute; top: 45px; bottom: 5px; left: 50%; width: calc(100% - 4px); height: ${heightPx}px; display: flex; align-items: center; justify-content: center; z-index: 50; border-radius: 6px; box-sizing: border-box; pointer-events: none;">${type}</div>`;
        } else if (type.startsWith('CCX')) {
            let c1 = parseInt(type[3]), c2 = parseInt(type[4]), t = parseInt(type[5]);
            let c1Top = ((c1 + 0.5) / numQubits * 100) + '%';
            let c2Top = ((c2 + 0.5) / numQubits * 100) + '%';
            let tTop = ((t + 0.5) / numQubits * 100) + '%';
            let minQ = Math.min(c1, c2, t), maxQ = Math.max(c1, c2, t);
            let lineTop = ((minQ + 0.5) / numQubits * 100) + '%';
            let lineHeight = ((maxQ - minQ) / numQubits * 100) + '%';
            
            html += `<div class="ctrl-dot ${statusClass}" style="top: ${c1Top}"></div>`;
            html += `<div class="ctrl-dot ${statusClass}" style="top: ${c2Top}"></div>`;
            html += `<div class="tgt-cross ${statusClass}" style="top: ${tTop}">⊕</div>`;
            html += `<div class="ctrl-line ${statusClass}" style="top: ${lineTop}; height: ${lineHeight}"></div>`;
        } else if (type.startsWith('CX')) {
            let c = parseInt(type[2]), t = parseInt(type[3]);
            let cTop = ((c + 0.5) / numQubits * 100) + '%', tTop = ((t + 0.5) / numQubits * 100) + '%';
            let lineTop = ((Math.min(c, t) + 0.5) / numQubits * 100) + '%';
            let lineHeight = (Math.abs(c - t) / numQubits * 100) + '%';
            
            html += `<div class="ctrl-dot ${statusClass}" style="top: ${cTop}"></div>`;
            html += `<div class="tgt-cross ${statusClass}" style="top: ${tTop}">⊕</div>`;
            html += `<div class="ctrl-line ${statusClass}" style="top: ${lineTop}; height: ${lineHeight}"></div>`;
        } else if (type.startsWith('SWAP')) {
            let parts = type.replace('SWAP', '');
            let c = parseInt(parts[0]), t = parseInt(parts[1]);
            let cTop = ((c + 0.5) / numQubits * 100) + '%';
            let tTop = ((t + 0.5) / numQubits * 100) + '%';
            let minQ = Math.min(c, t), maxQ = Math.max(c, t);
            let lineTop = ((minQ + 0.5) / numQubits * 100) + '%';
            let lineHeight = ((maxQ - minQ) / numQubits * 100) + '%';

            html += `<div class="tgt-cross ${statusClass}" style="top: ${cTop}">×</div>`;
            html += `<div class="tgt-cross ${statusClass}" style="top: ${tTop}">×</div>`;
            html += `<div class="ctrl-line ${statusClass}" style="top: ${lineTop}; height: ${lineHeight}"></div>`;
        } else if (type.startsWith('RZ_')) {
            let parts = type.split('_'); 
            let angleStr = parts.slice(1, -1).join('_');
            let q = parseInt(parts[parts.length - 1]);
            let top = ((q + 0.5) / numQubits * 100) + '%';
            
            let displayAngle = angleStr === 'PI' ? 'π' :
                               angleStr === 'PI2' ? 'π/2' :
                               angleStr === 'PI4' ? 'π/4' : 
                               angleStr === 'PI8' ? 'π/8' :
                               angleStr === 'MINUS_PI2' ? '-π/2' :
                               angleStr === 'MINUS_PI4' ? '-π/4' : '-π/8';
                               
            html += `<div class="gate-box rz-gate ${statusClass}" style="top: ${top};">
                        <span style="font-size: 11px;">Rz</span>
                        <span style="font-size: 8px;">${displayAngle}</span>
                     </div>`;
        } else if (type.startsWith('CP_')) {
            let parts = type.split('_'); 
            let ct = parts[parts.length - 1];
            let angleStr = parts.slice(1, -1).join('_');
            let c = parseInt(ct[0]), t = parseInt(ct[1]);
            let cTop = ((c + 0.5) / numQubits * 100) + '%';
            let tTop = ((t + 0.5) / numQubits * 100) + '%';
            let minQ = Math.min(c, t), maxQ = Math.max(c, t);
            let lineTop = ((minQ + 0.5) / numQubits * 100) + '%';
            let lineHeight = ((maxQ - minQ) / numQubits * 100) + '%';
            
            let displayAngle = angleStr === 'PI' ? 'π' :
                               angleStr === 'PI2' ? 'π/2' :
                               angleStr === 'PI4' ? 'π/4' : 
                               angleStr === 'PI8' ? 'π/8' :
                               angleStr === 'MINUS_PI2' ? '-π/2' :
                               angleStr === 'MINUS_PI4' ? '-π/4' : '-π/8';
                               
            html += `<div class="ctrl-dot ${statusClass}" style="top: ${cTop}"></div>`;
            html += `<div class="gate-box rz-gate cp-gate ${statusClass}" style="top: ${tTop};">
                        <span style="font-size: 11px;">P</span>
                        <span style="font-size: 8px;">${displayAngle}</span>
                     </div>`;
            html += `<div class="ctrl-line ${statusClass}" style="top: ${lineTop}; height: ${lineHeight}"></div>`;
        } else {
            let gateName = type.replace(/\d/g, ''); 
            let q = parseInt(type.slice(-1));
            let top = ((q + 0.5) / numQubits * 100) + '%';
            html += `<div class="gate-box ${statusClass}" style="top: ${top}">${gateName}</div>`;
        }
    }
    return html;
}

const BLOCH_TIP = 'Bloch sphere: maps a qubit\'s state in 3D.\nTop = |0⟩ · Bottom = |1⟩ · Equator = superposition';

export function renderDynamicCanvases(numQubits) {
    const wrap = document.getElementById('canvas-wrapper');
    wrap.innerHTML = '';
    for(let q=0; q<numQubits; q++){
        wrap.innerHTML += `<div class="bloch-wrap tt" data-tooltip="${BLOCH_TIP}"><canvas id="bloch-${q}" width="160" height="160"></canvas></div>`;
    }
}

export function updateBlochSpheres(currentGuess, numQubits) {
    let v = computeStateVector(currentGuess, numQubits, GATE_MATRICES);
    const sub = ['₀', '₁', '₂'];
    for(let q=0; q<numQubits; q++) {
        drawBlochSphere(`bloch-${q}`, calcBlochVector(v, q, numQubits), `Qubit ${q} (q${sub[q]})`);
    }
}

export function updateTargetBlochSphere(targetState, numQubits) {
    const wrap = document.getElementById('target-canvas-wrapper');
    if (!wrap) return;

    wrap.innerHTML = '';

    if (!targetState) return;

    const sub = ['₀', '₁', '₂'];

    const targetTip = 'Target Bloch sphere: the state your circuit must reach.\nTop = |0⟩ · Bottom = |1⟩ · Equator = superposition';
    if (numQubits === 1) {
        wrap.innerHTML = `<div class="bloch-wrap tt" data-tooltip="${targetTip}"><canvas id="target-bloch-0" width="160" height="160"></canvas></div>`;
        drawBlochSphere('target-bloch-0', calcBlochVector(targetState, 0, 1), `Target q${sub[0]}`);
    } else {
        let canvasHTML = '';
        for (let q = 0; q < numQubits; q++) {
            canvasHTML += `<div class="bloch-wrap tt" data-tooltip="${targetTip}"><canvas id="target-bloch-${q}" width="160" height="160"></canvas></div>`;
        }
        wrap.innerHTML = `
            <div style="width:100%; display:flex; justify-content:center;">
                <button id="target-bloch-toggle" class="btn" style="background:#475569; padding:4px 14px; font-size:0.8rem; width:auto;">Show Target Bloch Spheres</button>
            </div>
            <div id="target-bloch-canvases" style="display:none; justify-content:center; gap:15px; flex-wrap:wrap; margin-top:8px;">${canvasHTML}</div>
        `;

        let drawn = false;
        document.getElementById('target-bloch-toggle').addEventListener('click', () => {
            const canvases = document.getElementById('target-bloch-canvases');
            const btn = document.getElementById('target-bloch-toggle');
            const show = canvases.style.display === 'none';
            canvases.style.display = show ? 'flex' : 'none';
            btn.innerText = show ? 'Hide Target Bloch Spheres' : 'Show Target Bloch Spheres';
            if (show && !drawn) {
                for (let q = 0; q < numQubits; q++) {
                    drawBlochSphere(`target-bloch-${q}`, calcBlochVector(targetState, q, numQubits), `Target q${sub[q]}`);
                }
                drawn = true;
            }
        });
    }
}

export function showRevealCircuit(title, color, targetCircuit, numQubits) {
    const finalWrap = document.createElement('div');
    finalWrap.className = 'row-wrapper';
    finalWrap.id = 'reveal-circuit-wrap'; // Added ID so we can clear it on restart
    finalWrap.style.marginTop = '15px';
    finalWrap.style.marginBottom = '10px';
    finalWrap.style.borderColor = color;
    
    const label = document.createElement('div');
    label.className = 'original-label';
    label.style.backgroundColor = color;
    label.innerText = title;
    finalWrap.appendChild(label);
    
    const finalRow = document.createElement('div');
    finalRow.className = 'circuit-row';
    finalRow.style.height = `${Math.max(60, numQubits * 30)}px`;
    
    targetCircuit.forEach(gates => {
        const s = document.createElement('div');
        s.className = 'slot';
        s.innerHTML = getColumnHTML(gates, numQubits);
        finalRow.appendChild(s);
    });
    
    finalWrap.appendChild(finalRow);
    
    // Insert it right below the message div (below the controls)
    const msgDiv = document.getElementById('message');
    msgDiv.parentNode.insertBefore(finalWrap, msgDiv.nextSibling);
}

// --- Quantum Confetti Effect ---
export function fireQuantumConfetti(startX, startY) {
    const gateTypes = [
        { label: 'H', class: 'gate-box', bg: 'var(--gate-bg)' },
        { label: 'X', class: 'gate-box', bg: 'var(--gate-bg)' },
        { label: 'Z', class: 'gate-box', bg: 'var(--gate-bg)' },
        { label: 'P', class: 'confetti-cp' },
        { label: '•', class: 'confetti-cx' },
        { label: '⊕', class: '', bg: 'transparent', color: 'var(--cx-color)', size: '20px' },
        { label: '×', class: '', bg: 'transparent', color: 'var(--cx-color)', size: '20px' }
    ];

    const particles = [];
    const numParticles = 45; 

    for (let i = 0; i < numParticles; i++) {
        const type = gateTypes[Math.floor(Math.random() * gateTypes.length)];
        const el = document.createElement('div');
        el.className = `quantum-confetti ${type.class}`;
        el.innerText = type.label;
        
        if (type.bg) el.style.background = type.bg;
        if (type.color) el.style.color = type.color;
        if (type.size) el.style.fontSize = type.size;

        document.body.appendChild(el);

        particles.push({
            el: el,
            x: startX - 13, 
            y: startY - 13,
            vx: ((Math.random() - 0.5) * 18) * 0.9, // Horizontal explosion spread
            vy: ((Math.random() * -12) - 8) * 0.9,  // Upward velocity
            rot: Math.random() * 360,
            rotSpeed: ((Math.random() - 0.5) * 15) * 0.9 
        });
    }

    let gravity = 0.5;

    function animate() {
        let activeParticles = false;

        particles.forEach(p => {
            if (p.y < window.innerHeight) {
                activeParticles = true;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += gravity; // Pull them down
                p.rot += p.rotSpeed;

                p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
            } else if (p.el.parentElement) {
                p.el.parentElement.removeChild(p.el); // Clean up DOM
            }
        });

        if (activeParticles) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}

// --- Modals ---
export function showVictoryModal(title, subtitle, statsText, showNext, revealObj) {
    const overlay = document.getElementById('victory-modal');
    document.getElementById('victory-title').innerText = title;
    document.getElementById('victory-subtitle').innerText = subtitle;
    
    const statsEl = document.getElementById('victory-stats');
    if (statsText) {
        statsEl.innerHTML = statsText;
        statsEl.style.display = 'block';
    } else {
        statsEl.style.display = 'none';
    }
    
    // NEW: Render the revealed circuit inside the modal
    const circuitContainer = document.getElementById('victory-circuit-container');
    circuitContainer.innerHTML = ''; 
    if (revealObj) {
        const { revealTitle, color, targetCircuit, numQubits } = revealObj;

        const finalWrap = document.createElement('div');
        finalWrap.className = 'row-wrapper';
        finalWrap.style.margin = '0 auto'; // Keeps it perfectly centered
        finalWrap.style.borderColor = color;

        const label = document.createElement('div');
        label.className = 'original-label';
        label.style.backgroundColor = color;
        label.innerText = revealTitle;
        finalWrap.appendChild(label);

        const finalRow = document.createElement('div');
        finalRow.className = 'circuit-row';
        finalRow.style.height = `${Math.max(60, numQubits * 30)}px`;

        targetCircuit.forEach(gates => {
            const s = document.createElement('div');
            s.className = 'slot';
            s.innerHTML = getColumnHTML(gates, numQubits);
            finalRow.appendChild(s);
        });

        finalWrap.appendChild(finalRow);
        circuitContainer.appendChild(finalWrap);
        circuitContainer.style.display = 'flex';
    } else {
        circuitContainer.style.display = 'none';
    }

    // Opt-note lives outside the circuit container so expanding it doesn't resize the circuit block
    const existingNote = document.getElementById('victory-opt-note');
    if (existingNote) existingNote.remove();
    if (revealObj) {
        const note = document.createElement('details');
        note.id = 'victory-opt-note';
        note.className = 'opt-note';
        note.innerHTML = `<summary>💡 Why do multiple circuits produce the same result?</summary>
<div class="opt-note-body">Quantum gates are unitary matrices. Different sequences of gates can multiply together into the exact same overall transformation — so the <em>output state</em> is identical even though the <em>circuits look different</em>.<br><br>
On real quantum hardware, <strong>fewer gates = less noise</strong>. Every gate takes time and introduces errors, so finding the shortest equivalent circuit is one of the core challenges in quantum computing — a field called <strong>circuit optimization</strong>.</div>`;
        circuitContainer.insertAdjacentElement('afterend', note);
    }
    
    if (showNext) {
        document.getElementById('modal-next-btn').classList.remove('hidden');
    } else {
        document.getElementById('modal-next-btn').classList.add('hidden');
    }
    
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('show'), 10);
}

export function hideVictoryModal() {
    const overlay = document.getElementById('victory-modal');
    overlay.classList.remove('show');
    setTimeout(() => overlay.classList.add('hidden'), 400); 
}

export function showInfoModal() {
    const overlay = document.getElementById('info-modal');
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('show'), 10);
}

export function hideInfoModal() {
    const overlay = document.getElementById('info-modal');
    overlay.classList.remove('show');
    setTimeout(() => overlay.classList.add('hidden'), 400); 
}

// --- Tutorial System ---
let tourMode = 'none'; // 'menu' | 'ingame' | 'none'
let currentTourStep = 0;
let currentInGameStep = 0;
let _onInGameTourComplete = null;

const tourSteps = [
    { sel: '#menu-welcome',                    title: 'Welcome!',       text: "Welcome to Quiver! Let's take a quick tour of the main features." },
    { sel: '.mode-card[data-mode="learn"]',    title: 'Learn Mode',     text: "LEARN: A structured curriculum that takes you from zero to mastering quantum algorithms. Start here!" },
    { sel: '.mode-card[data-mode="daily"]',    title: 'Daily Puzzles',  text: "DAILY: Three fresh puzzles every 24 hours — Easy, Medium, and Hard. A great daily challenge once you know the basics!" },
    { sel: '.mode-card[data-mode="sandbox"]',  title: 'Sandbox',        text: "SANDBOX: A free-play area to experiment with any gates and watch the quantum math update in real time." },
    { sel: '.mode-card[data-mode="timed"]',    title: 'Time Collapse',  text: "TIME COLLAPSE: A timed blitz mode! Solve as many circuits as possible before the clock hits zero. Each solve adds +20s — each wrong attempt costs −5s." },
    { sel: '.mode-card[data-mode="play"]',     title: 'Play Mode',      text: "PLAY: The arcade mode! Click this card, then hit 'Easy (1 Qubit)' to try your first puzzle.", hideNext: true }
];

const inGameTourSteps = [
    {
        sel: '#target-container',
        title: 'Your Target',
        text: "This is the Target State — the quantum output your circuit must produce. Win by building a circuit that generates these exact amplitudes!"
    },
    {
        sel: '.right-col',
        title: 'Live Bloch Spheres',
        text: "The Bloch Spheres show your qubits' states as a 3D map, updated live as you place gates. North Pole = |0⟩, South Pole = |1⟩, Equator = superposition!"
    },
    {
        sel: '#palette-container',
        title: 'Gate Palette',
        text: "Select a gate from the palette, then tap a circuit cell to place it. To delete a placed gate, tap it with nothing selected. Now select the H gate to begin!"
    }
];

function cleanupSpotlights() {
    document.querySelectorAll('.tutorial-spotlight').forEach(el => {
        el.classList.remove('tutorial-spotlight');
        el.style.backgroundColor = '';
        el.style.padding = '';
    });
}

function positionTooltip(target) {
    const tt = document.getElementById('tutorial-tooltip');
    const rect = target.getBoundingClientRect();
    const ttRect = tt.getBoundingClientRect();
    const gap = 15;
    let topPos;
    if (rect.bottom + gap + ttRect.height > window.innerHeight) {
        topPos = rect.top + window.scrollY - gap - ttRect.height;
    } else {
        topPos = rect.bottom + window.scrollY + gap;
    }
    tt.style.top = `${topPos}px`;
}

export function startTour() {
    tourMode = 'menu';
    document.getElementById('tutorial-overlay').classList.add('show');
    document.getElementById('tutorial-tooltip').classList.add('show');
    currentTourStep = 0;
    showTourStep();
}

export function showTourStep() {
    cleanupSpotlights();
    clearGhostPointer();

    const step = tourSteps[currentTourStep];
    const target = document.querySelector(step.sel);

    document.getElementById('tt-title').innerText = step.title || 'Tutorial';
    document.getElementById('tt-text').innerText = step.text;
    document.getElementById('tt-next').style.display = step.hideNext ? 'none' : 'block';

    if (target) {
        target.classList.add('tutorial-spotlight');
        document.getElementById('tutorial-tooltip').classList.add('show');
        positionTooltip(target);
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

export function nextTourStep() {
    if (tourMode === 'menu') {
        currentTourStep++;
        if (currentTourStep < tourSteps.length) showTourStep();
        else endTour();
    } else if (tourMode === 'ingame') {
        currentInGameStep++;
        if (currentInGameStep < inGameTourSteps.length) showInGameTourStep();
        else endInGameTour();
    }
}

export function endTour() {
    tourMode = 'none';
    _onInGameTourComplete = null;
    document.getElementById('tutorial-overlay').classList.remove('show');
    document.getElementById('tutorial-tooltip').classList.remove('show');
    cleanupSpotlights();
}

// --- In-Game Tutorial Overlay ---

function showInGameTourStep() {
    cleanupSpotlights();

    const step = inGameTourSteps[currentInGameStep];
    const target = document.querySelector(step.sel);

    document.getElementById('tt-title').innerText = step.title;
    document.getElementById('tt-text').innerText = step.text;
    document.getElementById('tt-next').style.display = 'block';

    const tt = document.getElementById('tutorial-tooltip');
    tt.classList.add('show');

    if (target) {
        target.classList.add('tutorial-spotlight');
        positionTooltip(target);
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function endInGameTour() {
    const cb = _onInGameTourComplete;
    endTour();
    if (cb) cb();
}

export function startInGameTour(onComplete) {
    _onInGameTourComplete = onComplete;
    tourMode = 'ingame';
    currentInGameStep = 0;
    document.getElementById('tutorial-overlay').classList.add('show');
    document.getElementById('tutorial-tooltip').classList.add('show');
    showInGameTourStep();
}

export function setGhostPointer(type, targetId) {
    clearGhostPointer();
    let targetEl;
    let text = "";

    if (type === 'PALETTE') {
        const items = document.querySelectorAll('.palette-item');
        items.forEach(el => { if (el.innerText.includes(targetId)) targetEl = el; });
        text = "Tap to select the Hadamard (H) gate!";
    } else if (type === 'GRID') {
        targetEl = document.querySelector(`#slot-active-${targetId} .cell-zone`);
        text = "Tap the grid to place the gate!";
    } else if (type === 'EVALUATE') {
        targetEl = document.getElementById('submit-btn');
        text = "Hit Evaluate to test it!";
    } else if (type === 'MENU_EASY') { // NEW TARGET ADDED!
        targetEl = document.getElementById('btn-rand-1');
        text = "Tap 'Easy' to start!";
    }

    if (targetEl) {
        targetEl.classList.add('ghost-pulse');
        // Ensure the element supports absolute positioning for the ghost text
        if (window.getComputedStyle(targetEl).position === 'static') {
            targetEl.style.position = 'relative';
        }
        const msg = document.createElement('div');
        msg.className = 'ghost-text';
        msg.innerText = text;
        targetEl.appendChild(msg);
    }
}

export function clearGhostPointer() {
    document.querySelectorAll('.ghost-pulse').forEach(el => {
        el.classList.remove('ghost-pulse');
        const textEl = el.querySelector('.ghost-text');
        if (textEl) textEl.remove();
    });
}

export function showDuelChallengeBanner(difficulty, opponentScore) {
    const diffNames = ['Easy', 'Medium', 'Hard'];
    const diffName = diffNames[difficulty - 1] || 'Easy';

    const overlay = document.createElement('div');
    overlay.id = 'duel-banner-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;';

    overlay.innerHTML = `
        <div style="background:#1e293b;border:2px solid #7c3aed;border-radius:16px;padding:40px 32px;max-width:420px;width:90%;text-align:center;box-shadow:0 0 60px rgba(124,58,237,0.4);">
            <div style="font-size:2.5rem;margin-bottom:12px;">⚔️</div>
            <h2 style="color:#c4b5fd;margin:0 0 12px 0;font-size:1.6rem;">You've Been Challenged!</h2>
            <p style="color:#cbd5e1;font-size:1.05rem;margin:0 0 8px 0;">
                Score to beat:
                <b style="color:#eab308;font-size:1.3rem;"> ${opponentScore}</b>
                points in <b style="color:#f8fafc;">${diffName}</b> Time Collapse.
            </p>
            <p style="color:#94a3b8;margin:0 0 28px 0;">Can you beat it?</p>
            <button id="duel-accept-btn" style="background:#7c3aed;color:white;border:none;border-radius:8px;padding:14px 32px;font-size:1.1rem;font-weight:bold;cursor:pointer;width:100%;transition:background 0.2s;">
                Accept Challenge
            </button>
        </div>`;

    document.body.appendChild(overlay);

    document.getElementById('duel-accept-btn').addEventListener('click', () => {
        overlay.remove();
        // initGame is in main.js — trigger via a custom event to avoid circular import
        document.dispatchEvent(new CustomEvent('duel-accept', { detail: { difficulty } }));
    });
}

export function updateTimedStatusBar(state) {
    const timerEl = document.getElementById('timed-timer');
    const scoreEl = document.getElementById('timed-score');
    const attemptsEl = document.getElementById('timed-attempts');
    if (!timerEl) return;

    const secs = state.timerRemaining % 60;
    const mins = Math.floor(state.timerRemaining / 60);
    timerEl.innerText = `⏱ ${mins}:${secs.toString().padStart(2, '0')}`;
    timerEl.style.color = state.timerRemaining <= 10 ? '#ef4444' : '#eab308';
    if (state.timerRemaining <= 10) {
        timerEl.classList.add('timer-warning');
    } else {
        timerEl.classList.remove('timer-warning');
    }

    scoreEl.innerText = `Score: ${state.timedScore}`;
    attemptsEl.innerText = `Attempts: ${3 - state.attempts}`;
}