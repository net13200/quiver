import { drawBlochSphere, calcBlochVector } from '../quantum/bloch.js';
import { stateToString, computeStateVector } from '../quantum/engine.js';
import { GATE_MATRICES } from '../quantum/gates.js';

export function toggleMenu(id) {
    ['learn-content', 'play-content', 'sandbox-content'].forEach(menuId => {
        const el = document.getElementById(menuId);
        const header = el.previousElementSibling;
        if (menuId === id) {
            el.classList.toggle('hidden');
            header.classList.toggle('active');
        } else {
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
        
        if (type.startsWith('CCX')) {
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