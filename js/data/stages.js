export const LEVELS = {
    1: { q: 1, g: 4, minActive: 2 },
    2: { q: 2, g: 6, minActive: 3 },
    3: { q: 3, g: 10, minActive: 4 }
};

// Valid symmetrical CSWAP implementations
const CSWAP_VARIANTS = [
    [['CCX012'], ['CCX021'], ['CCX012']],
    [['CCX021'], ['CCX012'], ['CCX021']],
    [['CX21'], ['CCX012'], ['CX21']],
    [['CX12'], ['CCX021'], ['CX12']]
];

// Valid state preps for Stage 5
const PREP_5 = [
    [['H0', 'X1']],
    [['H0'], ['X1']],
    [['X1'], ['H0']]
];

// Stage 5.3 dynamically handles symmetries
function getStage5_3Circuits() {
    let circuits = [];
    let cxVariants = [
        [['CX21'], ['CCX012'], ['CX21']],
        [['CX12'], ['CCX021'], ['CX12']]
    ];
    cxVariants.forEach(seq => {
        PREP_5.forEach(p => {
            circuits.push([...p, ...seq]);
        });
        let mergedSeq = JSON.parse(JSON.stringify(seq));
        mergedSeq[0].push('H0');
        circuits.push([['X1'], ...mergedSeq]);
    });
    return circuits;
}

// Stage 6 dynamically handles all logical permutations for the Swap Test
function getStage6Circuits(prepGateOnQ1) {
    let circuits = [];
    CSWAP_VARIANTS.forEach(seq => {
        let canMergeOuter = seq[0][0].startsWith('CX');
        
        let prepOptions = [];
        if (prepGateOnQ1) {
            prepOptions.push([['H0'], [prepGateOnQ1]]);
            prepOptions.push([[prepGateOnQ1], ['H0']]);
            prepOptions.push([['H0', prepGateOnQ1]]);
        } else {
            prepOptions.push([['H0']]);
        }
        
        prepOptions.forEach(prep => {
            circuits.push([...prep, ...seq, ['H0']]);
            if (canMergeOuter) {
                let seqEndMerged = JSON.parse(JSON.stringify(seq));
                seqEndMerged[seqEndMerged.length - 1].push('H0');
                circuits.push([...prep, ...seqEndMerged]);
            }
        });
        
        if (canMergeOuter) {
            let startMergedPrep = prepGateOnQ1 ? [[prepGateOnQ1]] : [];
            let seqStartMerged = JSON.parse(JSON.stringify(seq));
            seqStartMerged[0].push('H0');
            circuits.push([...startMergedPrep, ...seqStartMerged, ['H0']]);
            
            let seqBothMerged = JSON.parse(JSON.stringify(seq));
            seqBothMerged[0].push('H0');
            seqBothMerged[seqBothMerged.length - 1].push('H0');
            circuits.push([...startMergedPrep, ...seqBothMerged]);
        }
    });
    return circuits;
}

// Stage 7.1 dynamically handles symmetries for X-Parity
function getStage7_1Circuits() {
    let circuits = [];
    let prefixes = [
        [['X1'], ['H1'], ['CX12'], ['H0']],
        [['X1'], ['H1'], ['H0', 'CX12']],
        [['X1'], ['H0', 'H1'], ['CX12']],
        [['H0', 'X1'], ['H1'], ['CX12']],
        [['H0'], ['X1'], ['H1'], ['CX12']]
    ];
    let cores = [
        [['CX01'], ['CX02']],
        [['CX02'], ['CX01']]
    ];
    prefixes.forEach(p => {
        cores.forEach(c => {
            if (p.length + c.length + 1 <= 8) {
                circuits.push([...p, ...c, ['H0']]);
            }
        });
    });
    return circuits;
}

// Stage 7.2 dynamically handles symmetries for Z-Parity
function getStage7_2Circuits() {
    let circuits = [];
    let preps = [
        [['X2', 'H1'], ['CX12']],
        [['H1'], ['X2'], ['CX12']],
        [['X2'], ['H1'], ['CX12']],
        [['X2', 'H1'], ['H0', 'CX12']],
        [['H1'], ['X2'], ['H0', 'CX12']],
        [['X2'], ['H1'], ['H0', 'CX12']],
        [['H0', 'X2', 'H1'], ['CX12']],
        [['H0', 'H1'], ['X2'], ['CX12']],
        [['H0', 'X2'], ['H1'], ['CX12']],
        [['H1'], ['H0', 'X2'], ['CX12']],
        [['X2'], ['H0', 'H1'], ['CX12']]
    ];
    let cores = [
        [['CX01'], ['CX02']],
        [['CX02'], ['CX01']]
    ];
    let suffixes = [
        [['H0', 'H1', 'H2']],
        [['H0', 'H1'], ['H2']],
        [['H0', 'H2'], ['H1']],
        [['H1', 'H2'], ['H0']],
        [['H0'], ['H1', 'H2']],
        [['H1'], ['H0', 'H2']],
        [['H2'], ['H0', 'H1']]
    ];
    
    circuits.push([['X2'], ['H1'], ['CX12'], ['H0'], ['H1'], ['H2'], ['CX01'], ['CX02'], ['H0'], ['H1'], ['H2']]);
    circuits.push([['X2'], ['H1'], ['CX12'], ['H0', 'H1', 'H2'], ['CX01'], ['CX02'], ['H0', 'H1', 'H2']]);
    
    preps.forEach(p => {
        cores.forEach(c => {
            suffixes.forEach(s => {
                if (p.length + c.length + s.length <= 8) {
                    circuits.push([...p, ...c, ...s]);
                }
            });
        });
    });
    return circuits;
}

// Stage 8.4 dynamically handles symmetries for the Controlled-Phase decomposition
function getStage8_4Circuits() {
    let circuits = [];
    let preps = [
        [['H0', 'H1']],
        [['H0'], ['H1']],
        [['H1'], ['H0']]
    ];
    let cores = [
        [['RZ_PI4_0', 'RZ_PI4_1'], ['CX01'], ['RZ_MINUS_PI4_1'], ['CX01']],
        [['RZ_PI4_0'], ['RZ_PI4_1'], ['CX01'], ['RZ_MINUS_PI4_1'], ['CX01']],
        [['RZ_PI4_1'], ['RZ_PI4_0'], ['CX01'], ['RZ_MINUS_PI4_1'], ['CX01']],
        [['RZ_PI4_0', 'RZ_PI4_1'], ['CX10'], ['RZ_MINUS_PI4_0'], ['CX10']],
        [['RZ_PI4_0'], ['RZ_PI4_1'], ['CX10'], ['RZ_MINUS_PI4_0'], ['CX10']],
        [['RZ_PI4_1'], ['RZ_PI4_0'], ['CX10'], ['RZ_MINUS_PI4_0'], ['CX10']]
    ];
    preps.forEach(p => {
        cores.forEach(c => {
            circuits.push([...p, ...c]);
        });
    });
    return circuits;
}

// Stage 9.2 dynamically handles symmetries for 2-qubit QFT using Native SWAP
function getStage9_2Circuits() {
    return [
        [['H0'], ['CP_PI2_10'], ['H1'], ['SWAP01']],
        [['H0'], ['CP_PI2_01'], ['H1'], ['SWAP01']]
    ];
}

// Stage 9.3 dynamically handles symmetries for 3-qubit QFT using Native SWAP
function getStage9_3Circuits() {
    let circuits = [];
    let cp10 = ['CP_PI2_10', 'CP_PI2_01'];
    let cp20 = ['CP_PI4_20', 'CP_PI4_02'];
    let cp21 = ['CP_PI2_21', 'CP_PI2_12'];
    let swap02 = [
        [['SWAP02']]
    ];
    cp10.forEach(c1 => {
        cp20.forEach(c2 => {
            cp21.forEach(c3 => {
                swap02.forEach(sw => {
                    circuits.push([['H0'], [c1], [c2], ['H1'], [c3], ['H2'], ...sw]);
                    circuits.push([['H0'], [c2], [c1], ['H1'], [c3], ['H2'], ...sw]);
                });
            });
        });
    });
    return circuits;
}

export const STAGES = [
    {
        title: "Stage 0: Quantum Foundations",
        desc: "Master the language of quantum: states, amplitudes, interference, and the six poles of the Bloch Sphere.",
        qubits: 1,
        cols: 4,
        set: ['X0', 'Y0', 'Z0', 'H0', 'SX0'],
        levels: [
            {
                name: "1. Reading the Map",
                hint: "The board starts completely empty. Since it already matches the target state, just hit Evaluate!",
                lesson: "### Welcome to the Quantum Realm!\n\nA quantum circuit is read **left to right**, like a musical score. Each horizontal line represents a **qubit** — a quantum bit.\n\n### Bra-Ket Notation\nIn quantum computing we label states using **Dirac notation**: $|·⟩$ (called a 'ket').\n\n* $|0⟩$ — this qubit will land on 0 when measured.\n* $|1⟩$ — this qubit will land on 1 when measured.\n\n### Amplitudes\nThe number in front of the ket is the **amplitude**. Squaring it gives the measurement probability.\n\nYour target reads:\n$$|ψ⟩ = 1 · |0⟩$$\n\nAmplitude = 1, so probability = 1² = 100%. It will definitely be a 0!\n\nEvery wire starts at $|0⟩$ by default, so an empty board already matches. **Just hit Evaluate!**",
                circuits: [[[]]]
            },
            {
                name: "2. Shattering the Bit",
                hint: "Place a single Hadamard (H) gate on the wire to split the qubit into a 50/50 superposition.",
                lesson: "### Breaking Free From Binary\n\nClassical bits are locked to 0 or 1. Qubits can exist in a **superposition** of both at the same time!\n\nA Hadamard (**H**) gate creates a perfect 50/50 blend:\n$$|ψ⟩ = 1/√2 · |0⟩ + 1/√2 · |1⟩$$\n\n### Where Does 1/√2 Come From?\n**Probabilities = amplitude squared.** For a 50% outcome we need:\n$$amplitude² = 1/2$$\n$$amplitude = √(1/2) = 1/√2 ≈ 0.707$$\n\nSo $1/√2$ is simply *the square root of 50%*.\n\n### The Action Plan\nPlace an **H** gate on the wire. Watch the **Live Bloch Sphere** on the right — the state vector drops from the North Pole to the equator. That's superposition!",
                circuits: [[['H0']]]
            },
            {
                name: "3. The Map of a Qubit's Mind",
                hint: "Combine an H gate with a Z gate to flip the phase of the superposition to negative.",
                lesson: "### Reading the Bloch Sphere\n\nThe **Live Bloch Sphere** on the right is a 3D map of your qubit's state:\n* **North Pole** → $|0⟩$, the qubit is definitely 0.\n* **South Pole** → $|1⟩$, the qubit is definitely 1.\n* **Equator** → 50/50 superposition!\n\n### The Power of Phase\nAmplitudes can be **negative**. Your target has a minus sign:\n$$|ψ⟩ = 1/√2 · |0⟩ − 1/√2 · |1⟩$$\n\nSquaring a negative still gives a positive probability: $(-1/√2)² = 1/2 = 50%$. Measuring it still gives a random 0 or 1. But the **phase shift** flips the qubit to the *opposite side* of the equator.\n\n### Why Phase Matters\nAmplitudes behave like **waves**: positive = crest, negative = trough. By controlling phase, quantum algorithms make wrong answers **cancel out** (destructive interference) and the correct answer **amplify** to 100% (constructive interference)!\n\n### The Goal\nApply **H** to reach the equator, then **Z** to flip the phase.",
                circuits: [[['H0'], ['Z0']]]
            },
            {
                name: "4. The Bit Flip",
                hint: "Flip the qubit entirely to the South Pole.",
                lesson: "<b>The Mechanism:</b> The Pauli-X gate acts as a quantum NOT gate. It rotates the qubit 180 degrees around the X-axis, flipping it from the North Pole (|0⟩) to the South Pole (|1⟩).<br><br><b>Why it matters:</b> Bit-flips are the most basic form of logic. In quantum error correction, identifying and fixing accidental X-flips caused by environmental noise is a major area of research.",
                circuits: [[['X0']]]
            },
            {
                name: "5. Interference",
                hint: "Start at |1⟩, then apply a Hadamard to reach the negative equator.",
                lesson: "<b>The Mechanism:</b> By starting at |1⟩ and applying a Hadamard, we land on the opposite side of the equator. The amplitude of |1⟩ is now negative (-1/√2).<br><br><b>Why it matters:</b> Negative amplitudes are what make quantum mechanics truly different from classical probability. They allow for *Quantum Interference*. Algorithms are designed so that wrong answers interfere destructively (cancel out) and the right answer interferes constructively (amplifies).",
                circuits: [[['X0'], ['H0']]]
            },
            {
                name: "6. Imaginary Amplitudes",
                hint: "Combine a full X flip and a half-X (SX) rotation.",
                lesson: "<b>The Mechanism:</b> The SX (Square-root of X) gate rotates the qubit 90 degrees around the X-axis. By combining gates, we can navigate to the Y-axis, bringing *imaginary numbers* (i) into our amplitudes.<br><br><b>Why it matters:</b> Complex numbers are essential to the Schrödinger equation. Manipulating the imaginary phase of a qubit is required for advanced routines like the Quantum Fourier Transform, a core component of Shor's algorithm for breaking RSA encryption.",
                circuits: [[['X0'], ['SX0']]]
            },
            {
                name: "7. The Sixth Direction",
                hint: "A single half-X rotation from the ground state.",
                lesson: "<b>The Mechanism:</b> A single SX gate on |0⟩ pushes the qubit to the negative Y-axis. Notice how different combinations of rotations can reach different points on the equator.<br><br><b>Why it matters:</b> The X, Y, and Z axes represent non-commuting observables. Navigating precisely between them is exactly how quantum states are calibrated, tested, and manipulated inside physical hardware like superconducting transmon qubits.",
                circuits: [[['SX0']]]
            }
        ]
    },
    {
        title: "Stage 1: Bell Pairs",
        desc: "Create the four maximally entangled 2-qubit states.",
        qubits: 2, cols: 4, set: ['X0', 'X1', 'Z0', 'Z1', 'H0', 'H1', 'CX01', 'CX10'],
        levels: [
            {
                name: "1.1: The Quantum Register",
                hint: "The board now has 2 qubits (q0 top, q1 bottom). Place an X gate on the bottom wire to flip it to |1⟩.",
                lesson: "### Combining Wires\n\nWhen we chain multiple qubits together they form a **register**. We read wires **top to bottom** as a single binary string.\n\nOn this 2-qubit board:\n* Top wire = **q₀** (Qubit 0)\n* Bottom wire = **q₁** (Qubit 1)\n\n### Reading Multi-Qubit States\nThe target $1|01⟩$ means two assignments:\n* **q₀ → 0** (no gate needed)\n* **q₁ → 1** (needs to be flipped!)\n\n### How the X Gate Works\nEvery wire starts at 0. The **X gate** (quantum NOT) flips a qubit from $|0⟩$ to $|1⟩$.\n\nPlace an **X** gate on the bottom wire — watch its Bloch Sphere drop to the South Pole!\n\n### What's Next?\nWith two qubits, an entirely new phenomenon becomes possible: **entanglement**, where qubits become quantum-mechanically inseparable. That's what this stage explores.",
                circuits: [[['X1']]]
            },
            {
                name: "1.2: Φ+ State", circuits: [[['H0'], ['CX01']]], hint: "Entangle |+⟩ on Q0 with |0⟩ on Q1.",
                lesson: "<b>The Mechanism:</b> The CNOT gate is represented on the board by a solid control dot connected vertically to a ⊕ target cross. It flips the target qubit *only* if the control qubit is |1⟩. Because our control qubit is in a superposition of |0⟩ and |1⟩, the target becomes a superposition of flipped and not-flipped. They are now mathematically locked together.<br><br><b>Why it matters:</b> This is maximum entanglement. Measuring one qubit instantly dictates the state of the other, regardless of distance. This is the exact state used in Quantum Teleportation and Superdense Coding."
            },
            {
                name: "1.3: Φ- State", circuits: [[['X0'], ['H0'], ['CX01']]], hint: "Entangle |-⟩ on Q0 with |0⟩ on Q1.",
                lesson: "<b>The Mechanism:</b> By starting the control qubit in the |-⟩ state before entangling, we embed a relative negative phase into the entangled pair.<br><br><b>Why it matters:</b> Entanglement isn't just about perfectly correlated classical data. By manipulating the phase within an entangled pair, quantum networks can encode extra classical bits of information, transferring 2 bits of data using only 1 physical qubit (Superdense coding)."
            },
            {
                name: "1.4: Ψ+ State", circuits: [[['X1'], ['H0'], ['CX01']]], hint: "Flip the target before entangling.",
                lesson: "<b>The Mechanism:</b> Here, the qubits are perfectly *anti-correlated*. If you measure a 0 on Q0, you are guaranteed to find a 1 on Q1, and vice versa.<br><br><b>Why it matters:</b> Anti-correlated Bell states are frequently used in Quantum Key Distribution (like the E91 protocol) to generate perfectly secure, unhackable encryption keys between two distant parties."
            },
            {
                name: "1.5: Ψ- State", circuits: [[['X0', 'X1'], ['H0'], ['CX01']]], hint: "Start with |11⟩ before entangling.",
                lesson: "<b>The Mechanism:</b> Known as the 'Singlet State', this is the most unique of the four. It is rotationally invariant—meaning no matter what axis (X, Y, or Z) you measure these qubits on, they will always yield opposite results.<br><br><b>Why it matters:</b> Because of its perfect symmetry, the Singlet State is highly resistant to certain types of environmental noise, making it a foundational concept for creating Decoherence-Free Subspaces in quantum memory."
            }
        ]
    },
    {
        title: "Stage 2: Controlled-Z (CZ)",
        desc: "Implement a CZ gate using CNOTs and Hadamards.",
        qubits: 2, cols: 5, set: ['X0', 'X1', 'H0', 'H1', 'CX01', 'CX10'],
        levels: [
            { 
                name: "2.1: Build a CZ", circuits: [[['H0', 'H1'], ['H1'], ['CX01'], ['H1']]], hint: "H X H = Z. (The first column places both qubits in |+⟩ so the CZ effect is visible!)",
                lesson: "<b>The Mechanism:</b> A Controlled-Z (CZ) applies a negative phase only when both qubits are |1⟩. Since H turns X into Z (and vice versa), sandwiching the target of a CNOT between two Hadamards transforms the controlled-bit-flip into a controlled-phase-flip.<br><br><b>Why it matters:</b> Real quantum hardware often only supports one type of native 2-qubit gate (like the CX gate on IBM hardware). 'Quantum Compilers' must rewrite advanced algorithms using these basic gate identities to physically run the code on the chip."
            }
        ]
    },
    {
        title: "Stage 3: GHZ State",
        desc: "Entangle three qubits symmetrically.",
        qubits: 3, cols: 5, set: ['X0','X1','X2', 'H0','H1','H2', 'CX01','CX10','CX12','CX21', 'CX02', 'CX20'],
        levels: [
            { 
                name: "3.1: GHZ State", circuits: [[['H0'], ['CX01'], ['CX12']]], hint: "Create a superposition, then chain the CNOTs down the line.",
                lesson: "<b>The Mechanism:</b> The Greenberger–Horne–Zeilinger (GHZ) state entangles three qubits so they are either all |000⟩ or all |111⟩. We build it by creating a standard Bell pair, and then using a second CNOT to 'infect' a third qubit with the entanglement.<br><br><b>Why it matters:</b> GHZ states demonstrate quantum non-locality far more powerfully than 2-qubit Bell pairs. They are incredibly useful in Quantum Metrology (creating hyper-sensitive measurement devices) and Quantum Secret Sharing protocols."
            }
        ]
    },
    {
        title: "Stage 4: Build a SWAP Gate",
        desc: "Construct SWAP and Controlled-SWAP (Fredkin) gates using CNOTs. (Strict Mode)",
        qubits: 3, cols: 5, set: ['X0','X1','X2', 'H0','H1','H2', 'CX01','CX10','CX12','CX21', 'CX02', 'CX20', 'CCX012', 'CCX021', 'CCX120'],
        levels: [
            { 
                name: "4.1: SWAP Gate",
                circuits: [
                    [['X1'], ['CX12'], ['CX21'], ['CX12']],
                    [['X1'], ['CX21'], ['CX12'], ['CX21']]
                ], 
                hint: "Set Q1 to |1⟩, then swap Q1 and Q2 using three alternating CNOT gates.",
                lesson: "<b>The Mechanism:</b> The SWAP gate exchanges the states of two qubits. While it can be implemented as a single hardware operation, it is most often compiled into three alternating CNOT gates. This relies on the XOR logic of CNOT: applying it back-and-forth effectively swaps the amplitudes!<br><br><b>Why it matters:</b> Physical qubits on a microchip are usually only wired to their immediate neighbors. If an algorithm requires entangling two distant qubits on opposite sides of the chip, the compiler *must* route their information through the grid using SWAP networks."
            },
            { 
                name: "4.2: CSWAP (3 CCX)",
                circuits: PREP_5.flatMap(p => [
                    [...p, ['CCX012'], ['CCX021'], ['CCX012']],
                    [...p, ['CCX021'], ['CCX012'], ['CCX021']]
                ]), 
                hint: "Superpose Q0 and flip Q1. Then conditionally swap Q1 & Q2 using three Toffolis.",
                lesson: "<b>The Mechanism:</b> The Controlled-SWAP (Fredkin) gate swaps the target qubits *only* if the control qubit is |1⟩. We can build it directly by taking our 3-CNOT design from the last stage and upgrading all three gates into Toffoli (CCX) gates controlled by Q0.<br><br><b>Why it matters:</b> The Fredkin gate is a 'universal' reversible logic gate. In quantum algorithms, conditionally routing information allows us to compute similarities between complex states without measuring them directly, forming the backbone of Quantum Machine Learning."
            },
            { 
                name: "4.3: CSWAP (1 CCX, 2 CX)",
                circuits: getStage5_3Circuits(), 
                hint: "Wrap a single Toffoli gate in CNOTs to achieve the exact same state!",
                lesson: "<b>The Mechanism:</b> We can optimize the CSWAP gate by noticing that we only need to conditionally flip one qubit based on the other, then use standard CNOTs to cascade the swap. This reduces the cost from 3 Toffolis to just 1 Toffoli and 2 CNOTs.<br><br><b>Why it matters:</b> Every gate you execute introduces a tiny bit of noise. Toffoli gates are notoriously noisy and slow. Compiling circuits to use fewer heavy gates—while achieving the exact same mathematical result—is a massive and vital sub-field of quantum software engineering."
            }
        ]
    },
    {
        title: "Stage 5: The Swap Test",
        desc: "Measure how similar two states are without directly measuring them. (Strict Mode)",
        qubits: 3, cols: 8, set: ['X0','X1','X2', 'H0','H1','H2', 'CX01','CX10','CX12','CX21', 'CX02', 'CX20', 'CCX012', 'CCX021', 'CCX120'],
        levels: [
            {
                name: "5.1: Identical States",
                circuits: getStage6Circuits(null),
                hint: "Superpose the ancilla (Q0), apply a CSWAP across Q1 and Q2, and apply another Hadamard to Q0.",
                lesson: "<b>The Mechanism:</b> The Swap Test algorithm checks how identical two target quantum states are. We superpose an ancilla (Q0), use it to CSWAP the target states (Q1, Q2), and interfere the ancilla again with a final Hadamard. The probability of measuring Q0 as |0⟩ is mathematically exactly P(0) = 0.5 + 0.5|⟨ψ|φ⟩|². Since |0⟩ and |0⟩ are totally identical, the math perfectly returns Q0 to |0⟩!<br><br><b>Why it matters:</b> Comparing massive vectors is the core of classical machine learning (like checking if an image is a cat or a dog). The Swap Test lets us compare massive quantum states using just *one* ancilla measurement, offering a potential exponential speedup for Quantum AI."
            },
            {
                name: "5.2: Orthogonal States",
                circuits: getStage6Circuits('X1'),
                hint: "Flip Q1 to |1⟩. Then run the exact same Swap Test logic as before!",
                lesson: "<b>The Mechanism:</b> Now we test two completely orthogonal (opposite) states: |1⟩ (on Q1) and |0⟩ (on Q2). Their inner product is 0. Following our Swap Test formula: P(0) = 0.5 + 0.5(0) = 0.5. This means the ancilla qubit has exactly a 50% chance of being measured as |0⟩. Look at the Bloch sphere—Q0 is perfectly balanced on the equator!<br><br><b>Why it matters:</b> This demonstrates the lower bounds of the algorithm. When measuring the ancilla, P(0) = 0.5 is the absolute minimum you can get, proving that the datasets encoded in the qubits have absolutely zero overlap."
            },
            {
                name: "5.3: Partial Overlap",
                circuits: getStage6Circuits('H1'),
                hint: "Prep Q1 with a Hadamard to |+⟩. Run the Swap Test again to see what partial overlap looks like.",
                lesson: "<b>The Mechanism:</b> What if the states are only partially similar? Here we compare |+⟩ and |0⟩. Their squared inner product is 0.5. The formula gives P(0) = 0.5 + 0.5(0.5) = 0.75 (or 75%). Look at the statevector amplitudes—by checking Q0, we measured the exact mathematical overlap of our two target states!<br><br><b>Why it matters:</b> This is the real magic of the Swap test. It doesn't just say 'yes' or 'no'; it computes the exact continuous inner product (the quantum equivalent of the classical dot product). This serves as the computational backbone for advanced algorithms like Quantum Support Vector Machines (QSVM)."
            }
        ]
    },
    {
        title: "Stage 6: The Hadamard Test",
        desc: "Differentiate between Bell states by measuring their eigenvalues. (Strict Mode)",
        qubits: 3, cols: 8, set: ['X0','X1','X2', 'H0','H1','H2', 'CX01','CX10','CX12','CX21', 'CX02', 'CX20'],
        levels: [
            {
                name: "6.1: X-Parity (+ vs -)",
                circuits: getStage7_1Circuits(),
                hint: "Prep Φ- on Q1 & Q2. Then H on Q0, apply CX from Q0 to Q1 and Q2, and H on Q0.",
                lesson: "<b>The Mechanism:</b> The Hadamard Test is a general algorithm to measure the expectation value of an operator. However, when the target state is an *eigenstate* of the operator (like Bell states are to Pauli parities), the specific mechanism at play is <b>Phase Kickback</b>.<br><br>In Phase Kickback, applying a controlled operation doesn't change the target eigenstate; instead, its eigenvalue (+1 or -1) is 'kicked back' into the control qubit's phase.<br><br><b>Why it matters:</b> The Φ- state is an eigenstate of X₁X₂ with an eigenvalue of -1. So, the -1 phase is kicked back to Q0, changing its state from |+⟩ to |-⟩. The final Hadamard converts this to |1⟩, allowing us to read the eigenvalue perfectly!<br><br><b>Try it:</b> Remove the first X₁ gate from the board to prepare Φ+ instead. Watch the Live Output—since Φ+ has an eigenvalue of +1, no negative phase is kicked back, and Q0 returns safely to |0⟩!"
            },
            {
                name: "6.2: Z-Parity (Φ vs Ψ)",
                circuits: getStage7_2Circuits(),
                hint: "Prep Ψ+ using X2, H1, CX12. Then wrap CX01 and CX02 in Hadamards to simulate Controlled-Z gates.",
                lesson: "<b>The Mechanism:</b> To differentiate a Φ state from a Ψ state, we must measure their Z-parity (Z₁Z₂). Because we don't have a native Controlled-Z gate on this board, we build them by wrapping CNOTs in Hadamards. This creates a Hadamard test for the Z₁Z₂ operator.<br><br><b>Why it matters:</b> The Ψ+ state is anti-correlated, meaning its Z-parity eigenvalue is -1. This test kicks the -1 phase back, flipping Q0 to |1⟩. In quantum error correction, continuously measuring these X and Z parities (without measuring the actual data qubits) is exactly how we detect errors without collapsing the fragile computation!<br><br><b>Try it:</b> Remove the X₂ gate to test a Φ+ state instead. Q0 will stay at |0⟩ because Φ states are perfectly correlated (eigenvalue +1)!"
            }
        ]
    },
    {
        title: "Stage 7: Phase Rotations",
        desc: "Rotate states around the Z-axis using parameterized RZ gates. (Strict Mode)",
        qubits: 2, cols: 6, set: ['X0', 'X1', 'H0', 'H1', 'CX01', 'CX10', 'RZ0', 'RZ1'],
        levels: [
            {
                name: "7.1: The S Gate (π/2)",
                circuits: [[['H0'], ['RZ_PI2_0']]],
                hint: "Select π/2 from the RZ dropdown in the palette, then apply it after a Hadamard on Q0.",
                lesson: "<b>The Mechanism:</b> The RZ gate applies a specific phase rotation around the Z-axis of the Bloch sphere. When θ = π/2, this is commonly called the <b>S gate</b>. Applying it to |+⟩ rotates the state 90 degrees along the equator.<br><br><b>Why it matters:</b> The S gate introduces complex/imaginary amplitudes into the system, taking us to the |+i⟩ state on the Y-axis. This forms the building blocks for creating robust combinations of non-real quantum states."
            },
            {
                name: "7.2: The T Gate (π/4)",
                circuits: [[['H0'], ['RZ_PI4_0']]],
                hint: "Select π/4 from the dropdown, apply after a Hadamard on Q0.",
                lesson: "<b>The Mechanism:</b> When θ = π/4, the RZ gate is known as the <b>T gate</b>. It rotates the state 45 degrees along the equator. <br><br><b>Why it matters:</b> The T gate is arguably the most important gate in quantum computing. The basic Clifford gates (H, X, CNOT, S) can be efficiently simulated on a classical computer. To achieve true 'Quantum Advantage', you *must* use non-Clifford gates like the T gate. It provides the universal continuous rotation capability needed for complex algorithms."
            },
            {
                name: "7.3: Adding Phases",
                circuits: [[['H0'], ['RZ_PI4_0'], ['RZ_PI4_0'], ['RZ_PI2_0'], ['H0']]],
                hint: "Apply two T gates (π/4) and one S gate (π/2) sequentially between Hadamards on Q0.",
                lesson: "<b>The Mechanism:</b> Z-rotations commute, meaning their angles simply add together! π/4 + π/4 + π/2 exactly equals π. An RZ(π) gate is equivalent to a Pauli-Z gate. So H -> (T + T + S) -> H is exactly mathematically identical to H -> Z -> H, which equals X!<br><br><b>Why it matters:</b> Because T gates are highly susceptible to noise, advanced quantum error correction schemes spend massive resources on 'Magic State Distillation' just to execute a single reliable T gate. Knowing how to combine and compile these phase rotations optimally determines how fast a quantum program can run before decoherence destroys it."
            },
            {
                name: "7.4: The Controlled-Phase Gate",
                circuits: getStage8_4Circuits(),
                hint: "Prep Q0 and Q1 with H. Add RZ(π/4) to both, CX(0,1), RZ(-π/4) on Q1, and CX(0,1).",
                lesson: "<b>The Mechanism:</b> A Controlled-Phase gate CP(θ) can be beautifully decomposed into standard CNOTs and single-qubit RZ gates! By adding fractional phases to both qubits, toggling the target with a CNOT, subtracting the phase, and toggling back, the phases mathematically cancel out for all states EXCEPT |11⟩.<br><br><b>Why it matters:</b> This exact trick is how quantum computers compile complex multi-qubit entanglements down to native hardware instructions. Every CP gate you use in algorithms like the Quantum Fourier Transform (Stage 8) is physically executed inside the microchip using this exact CNOT-sandwich technique!"
            }
        ]
    },
    {
        title: "Stage 8: Quantum Fourier Transform",
        desc: "Shift into the phase basis (XY plane) to encode data as angles. (Strict Mode)",
        qubits: 3, cols: 9, set: ['X0','X1','X2', 'H0','H1','H2', 'CP01', 'CP10', 'CP12', 'CP21', 'CP02', 'CP20', 'SWAP01', 'SWAP12', 'SWAP02'],
        levels: [
            {
                name: "8.1: 1-Qubit QFT (Phase Basis)",
                circuits: [[['X0'], ['H0']]],
                hint: "Start with |1⟩ (using an X gate), then apply a 1-qubit QFT, which is literally just a single Hadamard gate.",
                lesson: "<b>The Mechanism:</b> The Quantum Fourier Transform converts data from the computational (Z) basis into the phase (XY) basis. For a single qubit, this is exactly what the Hadamard gate does! It maps |0⟩ to |+⟩ (phase 0) and |1⟩ to |-⟩ (phase π).<br><br><b>Intuition:</b> In the normal Z-basis, information is stored as pure probabilities (0 or 1). In the XY-plane (Fourier regime), information is encoded as <i>angles of rotation</i> around the equator. This allows us to use phase-shifts to do powerful math!"
            },
            {
                name: "8.2: 2-Qubit QFT",
                circuits: getStage9_2Circuits(),
                hint: "Apply H to Q0, then a Controlled-Phase (π/2) from Q1 to Q0. Apply H to Q1, then use the SWAP gate!",
                lesson: "<b>The Mechanism:</b> To QFT multiple qubits, we apply H to the first qubit to put it in the XY plane, then use Controlled-Phase (CP) gates from the lower qubits to add fractional phase rotations. Finally, we SWAP the qubits because the QFT naturally outputs the binary fractions in reverse order.<br><br><b>Intuition:</b> Think of the qubits as hands on a clock. The least significant bit spins the fastest. By shifting to the Fourier regime, algorithms like Shor's Algorithm can find the 'period' (or frequency) of a mathematical function by watching how fast these phases spin!"
            },
            {
                name: "8.3: 3-Qubit QFT",
                circuits: getStage9_3Circuits(),
                hint: "H on Q0, CP(π/2) Q1->Q0, CP(π/4) Q2->Q0. Then H on Q1, CP(π/2) Q2->Q1. Finally H on Q2, and SWAP Q0 and Q2.",
                lesson: "<b>The Mechanism:</b> The full QFT cascades H and increasingly smaller CP gates. Each subsequent qubit adds a finer and finer angle (π/2, π/4, π/8...) to the target. It perfectly maps a binary number |x⟩ into a phase state where each qubit's angle represents a fraction of a full circle.<br><br><b>Why it matters:</b> This is the heart of Quantum Phase Estimation and Shor's Algorithm. By working in this Fourier regime (the XY plane), a quantum computer can evaluate the global properties of a function exponentially faster than any classical supercomputer ever could!"
            }
        ]
    },
    {
        title: "Stage 9: The QFT Adder",
        desc: "Master Draper's addition algorithm in the Fourier domain.",
        qubits: 3,
        cols: 6,
        set: ['X', 'QFT', 'IQFT', 'RZ'],
        levels: [
            {
                name: "Fourier Addition (+1)",
                hint: "Use an X gate on q2 to prepare |1>. Apply QFT. Add phase for +1 (RZ(π/4) on q2, RZ(π/2) on q1, RZ(π) on q0). Apply IQFT.",
                lesson: "Classical computers need extra 'scratchpad' bits to handle carry-overs when adding numbers. In 2000, Thomas Draper showed we can add numbers using **zero** extra space by computing in the Fourier domain!\n\n**1. Transform:** The QFT shifts our state into the frequency domain. Numbers are now encoded as phase shifts.\n\n**2. Rotate:** To add $+1$, we rotate the least significant qubit (q2) by $\\pi/4$, the middle (q1) by $\\pi/2$, and the most significant (q0) by $\\pi$.\n\n**3. Return:** The Inverse QFT (IQFT) brings us back to standard binary.\n\nPrepare the state $|1\\rangle$ using an X gate on q2, add $1$ to it in the Fourier domain, and bring it back!",
                circuits: [
                    [
                        ['X2'], 
                        ['QFT'],
                        ['RZ_PI4_2', 'RZ_PI2_1', 'RZ_PI_0'], 
                        ['IQFT'],
                        []
                    ]
                ]
            },
            {
                name: "Fourier Addition (+2)",
                hint: "Prepare |1> on q2. Apply QFT. To add +2, double the phase shifts from the previous level! Apply IQFT.",
                lesson: "Now let's add $+2$ to our initial state of $|1\\rangle$.\n\nIn the Fourier domain, adding a larger number simply multiplies the phase shift. If adding $+1$ applied a $\\pi/4$ rotation to the lowest qubit, adding $+2$ will require $2 \\times \\pi/4 = \\pi/2$.\n\nCalculate the doubled phase shifts for q1 and q2 (a $2\\pi$ shift on q0 acts like a full rotation and can be skipped). Apply the math, and hit evaluate to see $1 + 2 = 3$!",
                circuits: [
                    [
                        ['X2'], 
                        ['QFT'],
                        ['RZ_PI2_2', 'RZ_PI_1'], 
                        ['IQFT'],
                        []
                    ]
                ]
            }
        ]
    }
];