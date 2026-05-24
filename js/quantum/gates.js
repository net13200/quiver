import { c, addMat, kron, kronN } from './engine.js';

export const I2 = [[{r:1,i:0},{r:0,i:0}], [{r:0,i:0},{r:1,i:0}]];
export const X2 = [[{r:0,i:0},{r:1,i:0}], [{r:1,i:0},{r:0,i:0}]];
export const Y2 = [[{r:0,i:0},{r:0,i:-1}], [{r:0,i:1},{r:0,i:0}]];
export const Z2 = [[{r:1,i:0},{r:0,i:0}], [{r:0,i:0},{r:-1,i:0}]];
export const H2 = [[{r:c,i:0},{r:c,i:0}], [{r:c,i:0},{r:-c,i:0}]];
export const SX2 = [[{r:0.5,i:0.5},{r:0.5,i:-0.5}], [{r:0.5,i:-0.5},{r:0.5,i:0.5}]];

export const P0 = [[{r:1,i:0},{r:0,i:0}], [{r:0,i:0},{r:0,i:0}]]; 
export const P1 = [[{r:0,i:0},{r:0,i:0}], [{r:0,i:0},{r:1,i:0}]]; 

export const CX2 = [
    [{r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}]
];
export const CX2_REV = [
    [{r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}]
];

export const SWAP2 = [
    [{r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}]
];

export let GATE_MATRICES = {};

export function generateMatrices(N) {
    GATE_MATRICES = {};
    GATE_MATRICES['I'] = kronN(Array(N).fill(I2));
    
    let singleGates = { 'X': X2, 'Y': Y2, 'H': H2, 'Z': Z2, 'SX': SX2 };
    for (let q = 0; q < N; q++) {
        for (let [name, mat] of Object.entries(singleGates)) {
            let mats = Array(N).fill(I2);
            mats[q] = mat;
            GATE_MATRICES[`${name}${q}`] = kronN(mats);
        }
    }
    
    let rzVals = {
        'PI': {r: -1, i: 0},
        'PI2': {r: 0, i: 1},
        'PI4': {r: c, i: c},
        'PI8': {r: Math.cos(Math.PI/8), i: Math.sin(Math.PI/8)},
        'MINUS_PI2': {r: 0, i: -1},
        'MINUS_PI4': {r: c, i: -c},
        'MINUS_PI8': {r: Math.cos(-Math.PI/8), i: Math.sin(-Math.PI/8)}
    };
    for (let q = 0; q < N; q++) {
        for (let [suffix, val] of Object.entries(rzVals)) {
            let mat = [
                [{r:1, i:0}, {r:0, i:0}],
                [{r:0, i:0}, val]
            ];
            let mats = Array(N).fill(I2);
            mats[q] = mat;
            GATE_MATRICES[`RZ_${suffix}_${q}`] = kronN(mats);
        }
    }
    
    if (N >= 2) {
        if (N === 2) {
            GATE_MATRICES['CX01'] = CX2; GATE_MATRICES['CX10'] = CX2_REV;
            GATE_MATRICES['SWAP01'] = SWAP2; GATE_MATRICES['SWAP10'] = SWAP2;
        } else if (N === 3) {
            GATE_MATRICES['CX01'] = kron(CX2, I2); GATE_MATRICES['CX10'] = kron(CX2_REV, I2);
            GATE_MATRICES['CX12'] = kron(I2, CX2); GATE_MATRICES['CX21'] = kron(I2, CX2_REV);
            GATE_MATRICES['CX02'] = addMat(kronN([P0, I2, I2]), kronN([P1, I2, X2]));
            GATE_MATRICES['CX20'] = addMat(kronN([I2, I2, P0]), kronN([X2, I2, P1]));
            
            GATE_MATRICES['SWAP01'] = kron(SWAP2, I2); GATE_MATRICES['SWAP10'] = kron(SWAP2, I2);
            GATE_MATRICES['SWAP12'] = kron(I2, SWAP2); GATE_MATRICES['SWAP21'] = kron(I2, SWAP2);
            
            let SWAP02_mat = Array(8).fill().map(()=>Array(8).fill({r:0,i:0}));
            for(let i=0; i<8; i++) {
                let b0 = (i >> 2) & 1;
                let b1 = (i >> 1) & 1;
                let b2 = i & 1;
                let swapped = (b2 << 2) | (b1 << 1) | b0;
                SWAP02_mat[i][swapped] = {r:1,i:0};
            }
            GATE_MATRICES['SWAP02'] = SWAP02_mat;
            GATE_MATRICES['SWAP20'] = SWAP02_mat;
            
            let CCX012 = Array(8).fill().map((_, i) => {
                let row = Array(8).fill().map(() => ({r:0, i:0}));
                let j = (i === 6) ? 7 : (i === 7) ? 6 : i;
                row[j] = {r:1, i:0}; return row;
            }); GATE_MATRICES['CCX012'] = CCX012;

            let CCX021 = Array(8).fill().map((_, i) => {
                let row = Array(8).fill().map(() => ({r:0, i:0}));
                let j = (i === 5) ? 7 : (i === 7) ? 5 : i;
                row[j] = {r:1, i:0}; return row;
            }); GATE_MATRICES['CCX021'] = CCX021;

            let CCX120 = Array(8).fill().map((_, i) => {
                let row = Array(8).fill().map(() => ({r:0, i:0}));
                let j = (i === 3) ? 7 : (i === 7) ? 3 : i;
                row[j] = {r:1, i:0}; return row;
            }); GATE_MATRICES['CCX120'] = CCX120;
        }
        
        for (let ctrl = 0; ctrl < N; ctrl++) {
            for (let targ = 0; targ < N; targ++) {
                if (ctrl === targ) continue;
                for (let [suffix, val] of Object.entries(rzVals)) {
                    let mat = Array(Math.pow(2,N)).fill().map(() => Array(Math.pow(2,N)).fill({r:0, i:0}));
                    for (let i = 0; i < Math.pow(2,N); i++) {
                        let bitC = (i >> (N - 1 - ctrl)) & 1;
                        let bitT = (i >> (N - 1 - targ)) & 1;
                        if (bitC === 1 && bitT === 1) mat[i][i] = val;
                        else mat[i][i] = {r:1, i:0};
                    }
                    GATE_MATRICES[`CP_${suffix}_${ctrl}${targ}`] = mat;
                }
            }
        }
    }
}

export function formatAngleGate(gNext) {
    if (gNext.startsWith('RZ') || gNext.startsWith('CP')) {
        let angles = ['PI', 'PI2', 'PI4', 'PI8', 'MINUS_PI2', 'MINUS_PI4', 'MINUS_PI8'];
        let randAngle = angles[Math.floor(Math.random() * angles.length)];
        let prefix = gNext.startsWith('RZ') ? 'RZ' : 'CP';
        let qSuffix = gNext.startsWith('RZ') ? gNext.slice(-1) : gNext.slice(-2);
        return `${prefix}_${randAngle}_${qSuffix}`;
    }
    return gNext;
}

export function getOccupiedQubits(gate) {
    if (!gate || gate === 'I') return [];
    if (gate.startsWith('CCX')) {
        let c1 = parseInt(gate[3]), c2 = parseInt(gate[4]), t = parseInt(gate[5]);
        let occ = [];
        for(let i=Math.min(c1, c2, t); i<=Math.max(c1, c2, t); i++) occ.push(i); 
        return occ;
    }
    if (gate.startsWith('CX')) {
        let c = parseInt(gate[2]), t = parseInt(gate[3]);
        let occ = [];
        for(let i=Math.min(c,t); i<=Math.max(c,t); i++) occ.push(i);
        return occ;
    }
    if (gate.startsWith('SWAP')) {
        let parts = gate.replace('SWAP', '');
        let c = parseInt(parts[0]), t = parseInt(parts[1]);
        let occ = [];
        for(let i=Math.min(c,t); i<=Math.max(c,t); i++) occ.push(i);
        return occ;
    }
    if (gate.startsWith('RZ_')) {
        let parts = gate.split('_');
        return [parseInt(parts[parts.length - 1])];
    }
    if (gate.startsWith('CP_')) {
        let parts = gate.split('_');
        let ct = parts[parts.length - 1];
        let c = parseInt(ct[0]), t = parseInt(ct[1]);
        let occ = [];
        for(let i=Math.min(c,t); i<=Math.max(c,t); i++) occ.push(i);
        return occ;
    }
    return [parseInt(gate.slice(-1))];
}

export function canFit(columnGates, newGate) {
    let newOcc = getOccupiedQubits(newGate);
    for(let g of columnGates) {
        let occ = getOccupiedQubits(g);
        for(let q of newOcc) { if(occ.includes(q)) return false; }
    }
    return true;
}

export function addGateToColumn(colArray, newGate) {
    if (!newGate || newGate === 'I') return colArray;
    let newOcc = getOccupiedQubits(newGate);
    let filtered = colArray.filter(g => {
        let occ = getOccupiedQubits(g);
        return !newOcc.some(q => occ.includes(q));
    });
    filtered.push(newGate);
    return filtered;
}

export function getGateMultiset(circuit) {
    let gates = [];
    for(let col of circuit) {
        for(let gate of col) {
            if(gate && gate !== 'I') gates.push(gate);
        }
    }
    return gates.sort().join(',');
}