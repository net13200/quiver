export function calcBlochVector(v, q, N) {
    let z = 0, x = 0, y = 0;
    let numStates = Math.pow(2, N);
    for (let i = 0; i < numStates; i++) {
        let bit = (i >> (N - 1 - q)) & 1;
        if (bit === 0) {
            let j = i ^ (1 << (N - 1 - q));
            z += (v[i].r**2 + v[i].i**2) - (v[j].r**2 + v[j].i**2);
            x += 2 * (v[i].r * v[j].r + v[i].i * v[j].i);
            y += 2 * (v[i].r * v[j].i - v[i].i * v[j].r);
        }
    }
    return {x, y, z};
}

export function drawBlochSphere(canvasId, vec, label) {
    const canvas = document.getElementById(canvasId);
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const cx = canvas.width / 2, cy = canvas.height / 2 - 10, R = 55;
    
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2*Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    
    ctx.beginPath(); ctx.ellipse(cx, cy, R, R*0.35, 0, 0, 2*Math.PI); ctx.stroke();
    
    const proj = (x, y, z) => ({ x: cx + R * (y - 0.5 * x), y: cy + R * (-z + 0.35 * x) });
    
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    const drawAxis = (p1, p2, txt, pTxt) => {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px sans-serif'; ctx.fillText(txt, pTxt.x, pTxt.y);
    };
    
    let pZ1 = proj(0,0,-1), pZ2 = proj(0,0,1);
    drawAxis(pZ1, pZ2, '|0⟩', {x: pZ2.x - 8, y: pZ2.y - 5}); ctx.fillText('|1⟩', pZ1.x - 8, pZ1.y + 12);
    
    let pY1 = proj(0,-1,0), pY2 = proj(0,1,0);
    drawAxis(pY1, pY2, 'y', {x: pY2.x + 4, y: pY2.y + 4});
    
    let pX1 = proj(-1,0,0), pX2 = proj(1,0,0);
    drawAxis(pX1, pX2, 'x', {x: pX2.x - 12, y: pX2.y + 12});
    
    let pv = proj(vec.x, vec.y, vec.z);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(pv.x, pv.y);
    
    let len = Math.sqrt(vec.x**2 + vec.y**2 + vec.z**2);
    ctx.strokeStyle = len < 0.95 ? '#eab308' : '#ec4899'; 
    ctx.lineWidth = 3; ctx.stroke();
    
    ctx.beginPath(); ctx.arc(pv.x, pv.y, 4, 0, 2*Math.PI); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    
    ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, cx, canvas.height - 10);
}