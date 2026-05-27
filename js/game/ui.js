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

export function renderDynamicCanvases(numQubits) {
    const wrap = document.getElementById('canvas-wrapper');
    wrap.innerHTML = '';
    for(let q=0; q<numQubits; q++){
        wrap.innerHTML += `<canvas id="bloch-${q}" width="160" height="160"></canvas>`;
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

    if (numQubits === 1) {
        wrap.innerHTML = `<canvas id="target-bloch-0" width="160" height="160"></canvas>`;
        drawBlochSphere('target-bloch-0', calcBlochVector(targetState, 0, 1), `Target q${sub[0]}`);
    } else {
        let canvasHTML = '';
        for (let q = 0; q < numQubits; q++) {
            canvasHTML += `<canvas id="target-bloch-${q}" width="160" height="160"></canvas>`;
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
let currentTourStep = 0;
const tourSteps = [
    { sel: '.intro-text', text: "Welcome to Quiver! Let's take a quick 3-step tour of the interface." },
    { sel: '#header-learn', text: "LEARN: A guided curriculum of puzzles to teach you quantum mechanics from scratch." },
    { sel: '#header-sandbox', text: "SANDBOX: A free-play area to experiment with gates and watch the math change instantly." },
    { sel: '#header-play', text: "PLAY: The arcade mode! Expand the Play menu and click 'Easy (1 Qubit)' to continue the interactive tutorial.", hideNext: true }
];

export function startTour() {
    document.getElementById('tutorial-overlay').classList.add('show');
    document.getElementById('tutorial-tooltip').classList.add('show');
    currentTourStep = 0;
    showTourStep();
}

export function showTourStep() {
    // 1. Clean up old spotlights and inline styles
    document.querySelectorAll('.tutorial-spotlight').forEach(el => {
        el.classList.remove('tutorial-spotlight');
        el.style.backgroundColor = ''; 
        el.style.padding = '';
    });
    clearGhostPointer(); // Wipe any lingering ghost text

    const step = tourSteps[currentTourStep];
    const target = document.querySelector(step.sel);

    if (target) {
        // 2. FIX: Spotlight the entire parent wrapper so the buttons aren't trapped in the dark!
        if (step.sel.includes('header-')) {
            const parentSection = target.closest('.menu-section');
            if (parentSection) {
                parentSection.classList.add('tutorial-spotlight');
                parentSection.style.backgroundColor = '#1e293b'; // Adds a solid background so the dark overlay doesn't bleed through
                parentSection.style.padding = '5px 15px 15px 15px'; // Keeps it looking neat
            }
            
            // Auto-expand the accordion
            const contentId = step.sel.replace('header-', '') + '-content';
            const contentEl = document.getElementById(contentId);
            if (contentEl && contentEl.classList.contains('hidden')) {
                target.click(); 
            }

            // 3. FIX: Summon the bouncy Ghost Pointer specifically onto the Easy button!
            if (step.sel === '#header-play') {
                setTimeout(() => setGhostPointer('MENU_EASY'), 350); // Small delay to let the menu slide open first
            }
        } else {
            target.classList.add('tutorial-spotlight');
        }

        const tt = document.getElementById('tutorial-tooltip');
        
        document.getElementById('tt-text').innerText = step.text;
        document.getElementById('tt-next').style.display = step.hideNext ? 'none' : 'block';
        
        tt.classList.add('show'); 
        
        // Measure coordinates based on the header so the tooltip doesn't overlap the buttons
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
        
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

export function nextTourStep() {
    currentTourStep++;
    if (currentTourStep < tourSteps.length) showTourStep();
    else endTour();
}

export function endTour() {
    document.getElementById('tutorial-overlay').classList.remove('show');
    document.getElementById('tutorial-tooltip').classList.remove('show');
    document.querySelectorAll('.tutorial-spotlight').forEach(el => el.classList.remove('tutorial-spotlight'));
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