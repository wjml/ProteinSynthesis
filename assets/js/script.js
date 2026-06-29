var textboxDna = document.getElementsByClassName("textbox-dna"),
    textboxRna = document.getElementsByClassName("textbox-rna"),
    outputAminoacids = document.getElementsByClassName("output-aminoacids"),
    blankSpace = document.getElementById("blank-space"),
    dnaSequenceChars = textboxDna[0].getElementsByClassName("sequenceChar"),
    rnaSequenceChars = textboxRna[0].getElementsByClassName("sequenceChar"),
    addButton = document.getElementById("add"),
    deleteButton = document.getElementById("delete"),
    replaceButton = document.getElementById("replace");
    mutationWindow = document.getElementsByClassName("sequence to-mutate")

// Shared handler: creates first input or focuses the last existing one
function activateDnaInput() {
    if (dnaSequenceChars.length === 0) {
        var dnaInput = newSequenceChar();
        var rnaInput = newSequenceChar();
        textboxDna[0].insertBefore(dnaInput, blankSpace);
        textboxRna[0].appendChild(rnaInput);
        dnaInput.focus();
    } else {
        var last = dnaSequenceChars[dnaSequenceChars.length - 1];
        last.focus();
        last.selectionStart = 1;
    }
}

// Clicking the blank-space span still works as before
blankSpace.addEventListener("click", activateDnaInput);

// Clicking anywhere in the textbox-dna container that is NOT an existing input
// (e.g. the empty area to the right of all bases) also activates typing
textboxDna[0].addEventListener("click", function (event) {
    // If the click landed on a sequenceChar input, let the input handle focus itself
    if (event.target.classList && event.target.classList.contains("sequenceChar")) return;
    // blank-space already fires activateDnaInput — avoid double-call
    if (event.target === blankSpace) return;
    activateDnaInput();
});


// Only the DNA row shows a scrollbar; RNA and Aminoacids are driven via scrollUnique
for (let i = 0; i < textboxDna.length; i++) {
    textboxDna[i].addEventListener('scroll', scrollUnique)
}
function mutationDifference() {
    let panel = document.querySelector(".mutation-panel");
    let noMutationMsg = panel ? panel.querySelector(".no-mutation-msg") : null;
    let details = panel ? panel.querySelector(".mutation-details") : null;
    let badge = panel ? panel.querySelector(".mutation-type-badge") : null;
    let desc = panel ? panel.querySelector(".mutation-description") : null;

    if (!document.getElementsByClassName("sequence to-mutate")[0].classList.contains("active")) {
        if (panel) panel.style.display = "none";
        return;
    } else {
        if (panel) panel.style.display = "block";
    }

    let aminoacids = outputAminoacids[1].getElementsByClassName("aminoacid");
    let mutatedAminoacids = outputAminoacids[0].getElementsByClassName("aminoacid");
    
    let dna = textboxDna[1].getElementsByClassName("sequenceChar");
    let mutatedDna = textboxDna[0].getElementsByClassName("sequenceChar");
    
    let rna = textboxRna[1].getElementsByClassName("sequenceChar");
    let mutatedRna = textboxRna[0].getElementsByClassName("sequenceChar");

    let dnaSequence = "";
    let mutatedDnaSequence = "";
    let rnaSequence = "";
    let mutatedRnaSequence = "";

    // Gather sequence values
    for (let i = 0; i < dna.length; i++) {
        dnaSequence += dna[i].value;
    }
    for (let i = 0; i < mutatedDna.length; i++) {
        mutatedDnaSequence += mutatedDna[i].value;
    }
    for (let i = 0; i < rna.length; i++) {
        rnaSequence += rna[i].value;
    }
    for (let i = 0; i < mutatedRna.length; i++) {
        mutatedRnaSequence += mutatedRna[i].value;
    }

    // Highlight mutated DNA bases
    let maxDnaLen = Math.max(dna.length, mutatedDna.length);
    for (let i = 0; i < maxDnaLen; i++) {
        if (mutatedDna[i]) {
            if (!dna[i] || mutatedDnaSequence[i] !== dnaSequence[i]) {
                mutatedDna[i].classList.add("mutated");
            } else {
                mutatedDna[i].classList.remove("mutated");
            }
        }
    }

    // Highlight mutated RNA bases
    let maxRnaLen = Math.max(rna.length, mutatedRna.length);
    for (let i = 0; i < maxRnaLen; i++) {
        if (mutatedRna[i]) {
            if (!rna[i] || mutatedRnaSequence[i] !== rnaSequence[i]) {
                mutatedRna[i].classList.add("mutated");
            } else {
                mutatedRna[i].classList.remove("mutated");
            }
        }
    }

    // Highlight mutated amino acids safely
    let maxAALen = Math.max(aminoacids.length, mutatedAminoacids.length);
    for (let i = 0; i < maxAALen; i++) {
        let originalAA = aminoacids[i];
        let mutatedAA = mutatedAminoacids[i];
        
        if (mutatedAA) {
            if (!originalAA) {
                mutatedAA.classList.add("mutated");
            } else {
                let origAbbrev = originalAA.getElementsByClassName("abbreviated-name")[0];
                let mutAbbrev = mutatedAA.getElementsByClassName("abbreviated-name")[0];
                if (origAbbrev && mutAbbrev && origAbbrev.innerHTML !== mutAbbrev.innerHTML) {
                    mutatedAA.classList.add("mutated");
                } else {
                    mutatedAA.classList.remove("mutated");
                }
            }
        }
    }

    // Perform Mutation Classification Analysis
    if (panel && noMutationMsg && details && badge && desc) {
        if (!dnaSequence || !mutatedDnaSequence) {
            noMutationMsg.style.display = "block";
            details.style.display = "none";
            return;
        }

        if (dnaSequence === mutatedDnaSequence) {
            noMutationMsg.style.display = "block";
            details.style.display = "none";
            return;
        }

        noMutationMsg.style.display = "none";
        details.style.display = "flex";

        const origLen  = dnaSequence.length;
        const mutLen   = mutatedDnaSequence.length;
        const diff     = mutLen - origLen;        // positive = insertion, negative = deletion
        const absDiff  = Math.abs(diff);

        // Gather only active amino acids (exclude empty placeholders)
        const getActiveAAs = (container) =>
            Array.from(container.getElementsByClassName("aminoacid"))
                .filter(el => !el.classList.contains("not-availlable"))
                .map(el => { let n = el.querySelector(".abbreviated-name"); return n ? n.textContent.trim() : ""; });

        const origActiveAAs = getActiveAAs(outputAminoacids[1]);
        const mutActiveAAs  = getActiveAAs(outputAminoacids[0]);

        const aaChanged     = origActiveAAs.join(",") !== mutActiveAAs.join(",");
        const hasEarlierStop = mutActiveAAs.length < origActiveAAs.length;

        // ── 1. FRAMESHIFT ────────────────────────────────────────────────────────
        // Only occurs when the number of inserted/deleted bases is NOT a multiple
        // of 3 — this shifts the reading frame for all downstream codons.
        if (diff !== 0 && diff % 3 !== 0) {
            badge.className = "mutation-type-badge frameshift";
            badge.textContent = "Deslocamento de Leitura (Frameshift)";

            const verb    = diff > 0 ? `adição de <strong>${absDiff}</strong>` : `deleção de <strong>${absDiff}</strong>`;
            const stopNote = hasEarlierStop
                ? ` A nova janela de leitura introduziu também um <strong>códon de parada prematuro</strong>, truncando a proteína resultante.`
                : "";

            desc.innerHTML =
                `A ${verb} base(s) — número não múltiplo de 3 — deslocou a janela de leitura de todos os ` +
                `códons a partir do ponto de mutação. Praticamente todos os aminoácidos seguintes são alterados.${stopNote}`;
            return;
        }

        // ── 2–4. SUBSTITUIÇÃO ou INDEL IN-FRAME (diff % 3 = 0) ──────────────────
        // Here diff is 0 (substitution) or a multiple of 3 (in-frame indel).
        // We now classify by comparing the resulting amino acid sequences.

        const mechanism = diff === 0
            ? "substituição de base(s)"
            : diff > 0
                ? `adição de <strong>${absDiff}</strong> base(s) (múltiplo de 3, sem deslocamento de leitura)`
                : `deleção de <strong>${absDiff}</strong> base(s) (múltiplo de 3, sem deslocamento de leitura)`;

        // 2. Silent (Sinônima)
        if (!aaChanged) {
            badge.className = "mutation-type-badge silent";
            badge.textContent = "Silenciosa (Sinônima)";
            desc.innerHTML =
                `A ${mechanism} não alterou a sequência de aminoácidos resultante. ` +
                (diff === 0
                    ? `Isso ocorre porque o código genético é <strong>degenerado</strong>: múltiplos códons diferentes codificam o mesmo aminoácido.`
                    : `A proteína permanece estrutural e funcionalmente equivalente.`);
            return;
        }

        // 3. Nonsense (Sem Sentido) — stop codon introduced prematurely
        if (hasEarlierStop) {
            badge.className = "mutation-type-badge nonsense";
            badge.textContent = "Sem Sentido (Nonsense)";
            desc.innerHTML =
                `A ${mechanism} gerou um <strong>códon de parada prematuro (STOP)</strong>. ` +
                `A tradução é encerrada antes do tempo, produzindo uma proteína truncada que geralmente é instável e não funcional.`;
            return;
        }

        // 4. Missense (Sentido Trocado)
        badge.className = "mutation-type-badge missense";
        badge.textContent = "Sentido Trocado (Missense)";
        desc.innerHTML =
            `A ${mechanism} resultou na incorporação de um ou mais <strong>aminoácidos diferentes</strong> na cadeia ` +
            `polipeptídica. Dependendo da posição e da propriedade físico-química do aminoácido substituído, ` +
            `pode alterar a estrutura tridimensional e comprometer o funcionamento da proteína.`;
    }
}
var _scrollLock = false;
function scrollUnique() {
    if (_scrollLock) return;          // prevent re-entrant calls from sibling scroll events
    _scrollLock = true;
    var sl = this.scrollLeft;
    for (let i = 0; i < textboxDna.length; i++) {
        textboxDna[i].scrollLeft     = sl;
        textboxRna[i].scrollLeft     = sl;
        outputAminoacids[i].scrollLeft = sl;
    }
    _scrollLock = false;
}

// returns a new input
function newSequenceChar(value = "", className = "sequenceChar") {
    let input = document.createElement("input")
    input.className = className
    input.maxLength = 1
    input.value = value.toUpperCase()
    input.addEventListener("keypress", charInput)
    input.addEventListener("keydown", actsLikeUniqueInput)
    return input
}

// returns a new aminoacid output
function newAminoacid(aminoacid = { name: "", abbrevName: "" }) {
    let divAminoacid = document.createElement('div')
    switch (aminoacid.name) {
        case "": divAminoacid.className = "aminoacid not-availlable"; break
        default:
            divAminoacid.className = "aminoacid " + aminoacid.name
    }
    let classesName = ['abbreviated-name', 'molecule', 'full-name']
    classesName.forEach(function (divClassName) {
        divAminoacid.appendChild(document.createElement('div'))
        divAminoacid.lastChild.className = divClassName
        switch (divClassName) {
            case "abbreviated-name": divAminoacid.lastChild.innerHTML = aminoacid.abbrevName; break
            case "molecule": divAminoacid.lastChild.style.backgroundImage = "url('assets/images/aminoacids/" + aminoacid.abbrevName + ".png')"; break
            case "full-name": divAminoacid.lastChild.innerHTML = aminoacid.name; break
        }
    });

    if (aminoacid.abbrevName) {
        divAminoacid.style.cursor = "pointer";
        
        divAminoacid.addEventListener("click", function () {
            openAminoacidDrawer(aminoacid.abbrevName, true);
        });
        
        divAminoacid.addEventListener("mouseenter", function () {
            openAminoacidDrawer(aminoacid.abbrevName, false);
        });

        divAminoacid.addEventListener("mouseleave", function (event) {
            var drawer = document.getElementById("aminoacid-details-drawer");
            if (drawer) {
                var toElement = event.toElement || event.relatedTarget;
                if (toElement && (drawer.contains(toElement) || toElement === drawer)) {
                    return;
                }
                if (!drawer.classList.contains("clicked-open")) {
                    drawer.classList.remove("open");
                }
            }
        });
    }

    return divAminoacid
}

//make the input vector acts like one - event: keypress
function charInput(event) {
    var getRnaEquivalent = textboxRna[0].children[Array.prototype.indexOf.call(textboxDna[0].children, this)]
    event.preventDefault()
    var keys = ["CAPSLOCK", "A", "T", "C", "G"]
    var availlableKeys = false
    keys.forEach(function (key) {
        availlableKeys += event.key.toUpperCase() == key
    })
    if (!availlableKeys) { return }
    switch (this.selectionStart) {
        case 0:
            textboxDna[0].insertBefore(newSequenceChar(event.key), this)
            textboxRna[0].insertBefore(newSequenceChar(transcribe(event.key)), getRnaEquivalent)
            this.previousElementSibling.focus()
            // Remove this input if it's empty (phantom from initial click) or if replace mode
            if (this.value === "" || replaceButton.classList.contains("active")) {
                textboxDna[0].removeChild(this)
                textboxRna[0].removeChild(getRnaEquivalent)
            }
            break
        case 1:
            if (replaceButton.classList.contains("active")) {
                if (typeof this.nextElementSibling == "object" && this.nextElementSibling && this.nextElementSibling.value != "") {
                    textboxDna[0].removeChild(this.nextElementSibling)
                    textboxRna[0].removeChild(getRnaEquivalent.nextElementSibling)
                    textboxDna[0].insertBefore(newSequenceChar(event.key), this.nextElementSibling)
                    textboxRna[0].insertBefore(newSequenceChar(transcribe(event.key)), getRnaEquivalent.nextElementSibling)
                    this.nextElementSibling.focus()
                }
            } else {
                textboxDna[0].insertBefore(newSequenceChar(event.key), this.nextElementSibling)
                textboxRna[0].insertBefore(newSequenceChar(transcribe(event.key)), getRnaEquivalent.nextElementSibling)
                this.nextElementSibling.focus()
            }
            break
    }
    translate()
    treatSequence()
}

//makes the input sequence behave like a unique input tag - event: keydown
function actsLikeUniqueInput(event) {
    var getRnaEquivalent = textboxRna[0].children[Array.prototype.indexOf.call(textboxDna[0].children, this)]
    let keys
    let alert = "O sistema somente permite inserção das letras que representam bases nitrogenas do DNA: A, T, C e G."
    switch (true) {
        case addButton.classList.contains("active"):
            keys = ["CAPSLOCK", "A", "T", "C", "G", "ARROWLEFT", "ARROWRIGHT"]; alert = "A mutação de adição somente permite inserção das letras que representam bases nitrogenas do DNA: A, T, C e G."; break
        case deleteButton.classList.contains("active"):
            keys = ["CAPSLOCK", "BACKSPACE", "DELETE", "ARROWLEFT", "ARROWRIGHT"]; alert = "A mutação de deleção somente permite deletar bases nitrogenadas. \n Utilize a tecla Backspace ou a tecla Del!"; break
        case replaceButton.classList.contains("active"):
            keys = ["CAPSLOCK", "A", "T", "C", "G", "ARROWLEFT", "ARROWRIGHT"]; alert = "A mutação de substituição somente permite inserção das letras que representam bases nitrogenas do DNA: A, T, C e G."; break
        default:
            keys = ["CAPSLOCK", "A", "T", "C", "G", "BACKSPACE", "DELETE"]
    }
    let availlableKeys = false
    keys.forEach(function (key) {
        availlableKeys += event.key.toUpperCase() == key
    })
    if (!availlableKeys) {
        Swal.fire({
            type: 'error',
            title: 'Inserção não permitida!',
            text: alert
          })
        event.preventDefault();
        return
    }
    switch (event.code) {
        case "Backspace":
            event.preventDefault()
            switch (this.selectionStart) {
                case 0:
                    try {
                        textboxDna[0].removeChild(this.previousElementSibling)
                        textboxRna[0].removeChild(getRnaEquivalent.previousElementSibling)
                    } catch (e) { console.log("start reached") } break
                case 1:
                    try {
                        this.previousElementSibling.focus()
                        textboxDna[0].removeChild(this)
                        textboxRna[0].removeChild(getRnaEquivalent)
                    } catch (e) { textboxDna[0].removeChild(this); textboxRna[0].removeChild(getRnaEquivalent) } break
            } break
        case "Delete":
            switch (this.selectionStart) {
                case 0:
                    event.preventDefault()
                    try {
                        this.nextElementSibling.focus()
                        this.nextElementSibling.selectionStart = 0
                        textboxDna[0].removeChild(this)
                        textboxRna[0].removeChild(getRnaEquivalent)
                    } catch (e) { console.log("not a element forward") } break
                case 1:
                    try {
                        this.focus()
                        textboxDna[0].removeChild(this.nextElementSibling)
                        textboxRna[0].removeChild(getRnaEquivalent.nextElementSibling)
                    } catch (e) { console.log("not a element forward") } break

            } break
        case "ArrowLeft":
            switch (this.selectionStart) {
                case 0:
                    try {
                        this.previousElementSibling.focus()
                    } catch (e) { console.log("not a element forward") } break
            } break
        case "ArrowRight":
            switch (this.selectionStart) {
                case 1:
                    try {
                        this.nextElementSibling.focus()
                    } catch (e) { console.log("not a element forward") } break
            } break
        default: return
    }
    translate()
    treatSequence()
}

//transcribe the dna nitrogen base to a rna equivalent base
function transcribe(charValue) {
    switch (charValue.toUpperCase()) {
        case "A": return "U"
        case "T": return "A";
        case "C": return "G";
        case "G": return "C";
    }
}

//  formats in codons
function treatSequence() {
    // Treat first fita (active)
    for (let i = 0; i < dnaSequenceChars.length; i++) {
        let val = dnaSequenceChars[i].value.toUpperCase();
        dnaSequenceChars[i].className = "sequenceChar base-" + val;
        switch (i % 3) {
            case 0: dnaSequenceChars[i].className += " codon-start"; break;
            case 2: dnaSequenceChars[i].className += " codon-end"; break;
        }
    }
    for (let i = 0; i < rnaSequenceChars.length; i++) {
        let val = rnaSequenceChars[i].value.toUpperCase();
        rnaSequenceChars[i].className = "sequenceChar base-" + val;
        switch (i % 3) {
            case 0: rnaSequenceChars[i].className += " codon-start"; break;
            case 2: rnaSequenceChars[i].className += " codon-end"; break;
        }
    }

    // Treat second fita if @ (to ensure dynamic edits or cloning are aligned)
    let secondDna = textboxDna[1].getElementsByClassName("sequenceChar");
    let secondRna = textboxRna[1].getElementsByClassName("sequenceChar");
    for (let i = 0; i < secondDna.length; i++) {
        let val = secondDna[i].value.toUpperCase();
        secondDna[i].className = "sequenceChar base-" + val;
        switch (i % 3) {
            case 0: secondDna[i].className += " codon-start"; break;
            case 2: secondDna[i].className += " codon-end"; break;
        }
    }
    for (let i = 0; i < secondRna.length; i++) {
        let val = secondRna[i].value.toUpperCase();
        secondRna[i].className = "sequenceChar base-" + val;
        switch (i % 3) {
            case 0: secondRna[i].className += " codon-start"; break;
            case 2: secondRna[i].className += " codon-end"; break;
        }
    }

    mutationDifference();
    updateCodonLabels();
}

/**
 * Scans the RNA sequence for the first AUG (start) and all stop codons,
 * then injects small pill labels that float above those codons in textbox-rna.
 *
 * Layout math (normal mode):
 *   padding-left of textbox-rna = 6 px
 *   one base = 40 px
 *   codon-end margin = 8 px
 *   → one codon slot = 3 × 40 + 8 = 128 px
 *   → left of codon c  = 6 + c × 128  px
 */
function updateCodonLabels() {
    var rnaBox = textboxRna[0];

    // Remove all previously generated labels
    var old = rnaBox.getElementsByClassName("codon-label");
    while (old.length > 0) rnaBox.removeChild(old[0]);

    // Build the current RNA string
    var seq = "";
    for (var i = 0; i < rnaSequenceChars.length; i++) seq += rnaSequenceChars[i].value;
    if (seq.length < 3) return;

    var PADDING  = 6;    // px — matches padding-left of .textbox-rna
    var SLOT     = 128;  // px — 3×40 base + 8 codon-end margin

    /**
     * State machine:
     *   inCoding = false  → scanning for next start codon
     *   inCoding = true   → inside an open reading frame
     *
     * AUG while inCoding=false  → label "INÍCIO", set inCoding=true
     * AUG while inCoding=true   → no label (ribosome already running)
     * STOP while inCoding=true  → label "PARADA", set inCoding=false
     * STOP while inCoding=false → label "PARADA" (educational; biologically ignored)
     */
    var inCoding = false;

    for (var c = 0; c < Math.floor(seq.length / 3); c++) {
        var codon  = seq.substr(c * 3, 3);
        var isStop = (codon === "UAA" || codon === "UAG" || codon === "UGA");
        var kind   = null;

        if (!inCoding && codon === "AUG") {
            // New coding region begins
            inCoding = true;
            kind = "start";
        } else if (isStop) {
            // Stop always ends the current coding region (if any)
            inCoding = false;
            kind = "stop";
        }
        // AUG while inCoding=true → intentionally no label

        if (kind) {
            var lbl = document.createElement("div");
            lbl.className = "codon-label codon-label-" + kind;
            lbl.textContent = kind === "start" ? "INÍCIO" : "PARADA";
            lbl.style.left  = (PADDING + c * SLOT) + "px";
            rnaBox.appendChild(lbl);
        }
    }
}

//translate the sequence of rna into aminoacids
function translate() {
    outputAminoacids[0].innerHTML = ""
    let sequence = ""
    let codons = []
    aminoacids = []
    for (let i = 0; i < rnaSequenceChars.length; i++) {
        sequence += rnaSequenceChars[i].value
    }
    for (let i = 0; i < sequence.length; i++) {
        codons.push(sequence.substr(i, 3))
        i = i + 2
    }
    codons.forEach(function (codon) {
        switch (codon) {
            //phenylalanine
            case "UUC": case "UUU":
                aminoacids.push({ name: "Fenilalanina", abbrevName: "PHE" }); break
            //leucine
            case "UUA": case "UUG": case "CUU": case "CUC": case "CUA": case "CUG":
                aminoacids.push({ name: "Leucina", abbrevName: "LEU" }); break
            //serine
            case "UCU": case "UCC": case "UCA": case "UCG": case "AGU": case "AGC":
                aminoacids.push({ name: "Serina", abbrevName: "SER" }); break
            //tyrosine
            case "UAU": case "UAC":
                aminoacids.push({ name: "Tirosina", abbrevName: "TYR" }); break
            //cysteine
            case "UGU": case "UGC":
                aminoacids.push({ name: "Cisteína", abbrevName: "CYS" }); break
            //tryptophan
            case "UGG":
                aminoacids.push({ name: "Triptofano", abbrevName: "TRP" }); break
            //proline
            case "CCU": case "CCC": case "CCA": case "CCG":
                aminoacids.push({ name: "Prolina", abbrevName: "PRO" }); break
            //histidine
            case "CAU": case "CAC":
                aminoacids.push({ name: "Histidina", abbrevName: "HIS" }); break
            //glutamine
            case "CAA": case "CAG":
                aminoacids.push({ name: "Glutamina", abbrevName: "GLN" }); break
            //arginine
            case "CGU": case "CGC": case "CGA": case "CGG": case "AGA": case "AGG":
                aminoacids.push({ name: "Arginina", abbrevName: "ARG" }); break
            //isoleucine
            case "AUU": case "AUC": case "AUA":
                aminoacids.push({ name: "Isoleucina", abbrevName: "ILE" }); break
            //methionine
            case "AUG":
                aminoacids.push({ name: "Metionina", abbrevName: "MET" }); break
            //threonine
            case "ACU": case "ACC": case "ACA": case "ACG":
                aminoacids.push({ name: "Treonina", abbrevName: "THR" }); break
            //asparagine
            case "AAU": case "AAC":
                aminoacids.push({ name: "Asparagina", abbrevName: "ASN" }); break
            //lysine
            case "AAA": case "AAG":
                aminoacids.push({ name: "Lisina", abbrevName: "LYS" }); break
            //valine
            case "GUU": case "GUC": case "GUA": case "GUG":
                aminoacids.push({ name: "Valina", abbrevName: "VAL" }); break
            //alanine
            case "GCU": case "GCC": case "GCA": case "GCG":
                aminoacids.push({ name: "Alanina", abbrevName: "ALA" }); break
            //asparticAcid
            case "GAU": case "GAC":
                aminoacids.push({ name: "Ácido Aspártico", abbrevName: "ASP" }); break
            //glutamicAcid
            case "GAA": case "GAG":
                aminoacids.push({ name: "Ácido Glutâmico", abbrevName: "GLU" }); break
            //glycine
            case "GGU": case "GGC": case "GGA": case "GGG":
                aminoacids.push({ name: "Glicina", abbrevName: "GLY" }); break
            //stop
            case "UAA": case "UAG": case "UGA":
                aminoacids.push({ name: "stop", abbrevName: "STOP" }); break
        }
    })
    let hasStart = false
    aminoacids.forEach(function (aminoacid) {
        switch (aminoacid.abbrevName) {
            case "MET": hasStart = true; break
            case "STOP": hasStart = false; break
        }
        switch (hasStart) {
            case true:
                outputAminoacids[0].appendChild(newAminoacid(aminoacid)); break
            case false:
                outputAminoacids[0].appendChild(newAminoacid()); break
        }
    })

    // Update counters
    updateCounters();
}

function updateCounters() {
    var codonCounter = document.getElementById("codon-counter");
    var aminoacidCounter = document.getElementById("aminoacid-counter");
    if (codonCounter && aminoacidCounter) {
        var totalCodons = Math.floor(rnaSequenceChars.length / 3);
        var activeAminoacids = Array.from(outputAminoacids[0].getElementsByClassName("aminoacid"))
                                      .filter(el => !el.classList.contains("not-availlable")).length;
        codonCounter.textContent = totalCodons;
        aminoacidCounter.textContent = activeAminoacids;
    }
}

// Global base insert function (callable from HTML and JS)
function insertBase(base) {
    base = base.toUpperCase();
    if (!["A", "T", "C", "G"].includes(base)) return;
    
    // Check if there is a currently active DNA input in textboxDna[0]
    var activeElement = document.activeElement;
    var isDnaInput = activeElement && activeElement.classList.contains("sequenceChar") && 
                      textboxDna[0].contains(activeElement);
    
    if (isDnaInput) {
        var getRnaEquivalent = textboxRna[0].children[Array.prototype.indexOf.call(textboxDna[0].children, activeElement)];
        
        if (replaceButton.classList.contains("active")) {
            activeElement.value = base;
            getRnaEquivalent.value = transcribe(base);
            if (activeElement.nextElementSibling && activeElement.nextElementSibling.classList.contains("sequenceChar")) {
                activeElement.nextElementSibling.focus();
            }
        } else {
            var newDna = newSequenceChar(base);
            var newRna = newSequenceChar(transcribe(base));
            textboxDna[0].insertBefore(newDna, activeElement.nextElementSibling);
            textboxRna[0].insertBefore(newRna, getRnaEquivalent.nextElementSibling);
            newDna.focus();
        }
    } else {
        // No input focused, append at the end
        var newDna = newSequenceChar(base);
        var newRna = newSequenceChar(transcribe(base));
        textboxDna[0].insertBefore(newDna, blankSpace);
        textboxRna[0].appendChild(newRna);
        newDna.focus();
    }
    
    translate();
    treatSequence();
}
window.insertBase = insertBase; // Expose globally for HTML onclicks

// Clear all inputs
function clearSequence() {
    // Reset mutation mode
    addButton.classList.remove("active");
    deleteButton.classList.remove("active");
    replaceButton.classList.remove("active");
    mutationWindow[0].classList.remove("active");

    // Clear all sequence inputs
    var chars = Array.from(textboxDna[0].getElementsByClassName("sequenceChar"));
    chars.forEach(function (char) {
        textboxDna[0].removeChild(char);
    });
    var rnaChars = Array.from(textboxRna[0].getElementsByClassName("sequenceChar"));
    rnaChars.forEach(function (char) {
        textboxRna[0].removeChild(char);
    });
    
    // Clear mutated fitas
    if (textboxDna[1]) {
        var charsMut = Array.from(textboxDna[1].getElementsByClassName("sequenceChar"));
        charsMut.forEach(function (char) {
            textboxDna[1].removeChild(char);
        });
    }
    if (textboxRna[1]) {
        var rnaCharsMut = Array.from(textboxRna[1].getElementsByClassName("sequenceChar"));
        rnaCharsMut.forEach(function (char) {
            textboxRna[1].removeChild(char);
        });
    }
    
    outputAminoacids[0].innerHTML = "";
    if (outputAminoacids[1]) {
        outputAminoacids[1].innerHTML = "";
    }
    
    // Reset back to normal simulation mode by clicking the main simulator tab
    var appBtn = document.getElementById("app");
    if (appBtn) {
        appBtn.click();
    }
    
    translate();
    treatSequence();
}

// Generate valid random sequence starting with TAC (AUG) and ending with STOP
function randomSequence() {
    clearSequence();
    var bases = ["A", "T", "C", "G"];
    var numCodons = Math.floor(Math.random() * 4) + 4; // 4 to 7 codons
    var dnaSeq = "TAC"; // Start codon (transcribes to AUG)
    for (var i = 0; i < numCodons - 2; i++) {
        dnaSeq += bases[Math.floor(Math.random() * 4)];
        dnaSeq += bases[Math.floor(Math.random() * 4)];
        dnaSeq += bases[Math.floor(Math.random() * 4)];
    }
    var stopCodons = ["ATT", "ATC", "ACT"]; // Transcribe to UAA, UAG, UGA
    dnaSeq += stopCodons[Math.floor(Math.random() * 3)];
    
    for (var j = 0; j < dnaSeq.length; j++) {
        var charValue = dnaSeq[j];
        var newDna = newSequenceChar(charValue);
        var newRna = newSequenceChar(transcribe(charValue));
        textboxDna[0].insertBefore(newDna, blankSpace);
        textboxRna[0].appendChild(newRna);
    }
    
    translate();
    treatSequence();
}

// Amino acids detailed DB
const aminoacidsDb = {
    "PHE": {
        name: "Fenilalanina",
        abbrevs: "Phe / F",
        codons: "UUU, UUC",
        type: "Apolar (Hidrofóbico)",
        func: "Precursor de tirosina e neurotransmissores importantes como dopamina, noradrenalina e adrenalina."
    },
    "LEU": {
        name: "Leucina",
        abbrevs: "Leu / L",
        codons: "UUA, UUG, CUU, CUC, CUA, CUG",
        type: "Apolar (Hidrofóbico)",
        func: "Essencial para a síntese e regeneração muscular, além de atuar no controle da glicemia."
    },
    "SER": {
        name: "Serina",
        abbrevs: "Ser / S",
        codons: "UCU, UCC, UCA, UCG, AGU, AGC",
        type: "Polar (Não Carregado)",
        func: "Fundamental para o metabolismo das gorduras, funcionamento do sistema imunológico e desenvolvimento da bainha de mielina."
    },
    "TYR": {
        name: "Tirosina",
        abbrevs: "Tyr / Y",
        codons: "UAU, UAC",
        type: "Polar (Não Carregado)",
        func: "Precursor direto da melanina (pigmento da pele) e de hormônios tireoidianos e adrenais."
    },
    "CYS": {
        name: "Cisteína",
        abbrevs: "Cys / C",
        codons: "UGU, UGC",
        type: "Polar (Não Carregado)",
        func: "Forma pontes de dissulfeto cruciais para a estabilização tridimensional das proteínas e possui forte ação antioxidante."
    },
    "TRP": {
        name: "Triptofano",
        abbrevs: "Trp / W",
        codons: "UGG",
        type: "Apolar (Hidrofóbico)",
        func: "Precursor da serotonina (neurotransmissor do bem-estar) e melatonina (regulador do sono)."
    },
    "PRO": {
        name: "Prolina",
        abbrevs: "Pro / P",
        codons: "CCU, CCC, CCA, CCG",
        type: "Apolar (Hidrofóbico)",
        func: "Importante componente estrutural que confere flexibilidade e rigidez, sendo vital para a formação de colágeno."
    },
    "HIS": {
        name: "Histidina",
        abbrevs: "His / H",
        codons: "CAU, CAC",
        type: "Polar Básico (Carregado +)",
        func: "Precursor da histamina (resposta alérgica/imune) e componente chave na hemoglobina e enzimas metabólicas."
    },
    "GLN": {
        name: "Glutamina",
        abbrevs: "Gln / Q",
        codons: "CAA, CAG",
        type: "Polar (Não Carregado)",
        func: "Aminoácido livre mais abundante no sangue; serve de combustível para células de defesa e transporte de nitrogênio."
    },
    "ARG": {
        name: "Arginina",
        abbrevs: "Arg / R",
        codons: "CGU, CGC, CGA, CGG, AGA, AGG",
        type: "Polar Básico (Carregado +)",
        func: "Atua na cicatrização de tecidos, no ciclo da ureia (eliminação de amônia) e estimula a produção de óxido nítrico (vasodilatador)."
    },
    "ILE": {
        name: "Isoleucina",
        abbrevs: "Ile / I",
        codons: "AUU, AUC, AUA",
        type: "Apolar (Hidrofóbico)",
        func: "Participa da síntese de hemoglobina, regulação dos níveis de energia e reparo de tecidos musculares."
    },
    "MET": {
        name: "Metionina",
        abbrevs: "Met / M",
        codons: "AUG",
        type: "Apolar (Hidrofóbico)",
        func: "Aminoácido de iniciação da síntese de proteínas (códon de início) e fonte biológica importante de enxofre."
    },
    "THR": {
        name: "Treonina",
        abbrevs: "Thr / T",
        codons: "ACU, ACC, ACA, ACG",
        type: "Polar (Não Carregado)",
        func: "Essencial para a integridade do esmalte dentário, colágeno, elastina e bom funcionamento digestivo e imune."
    },
    "ASN": {
        name: "Asparagina",
        abbrevs: "Asn / N",
        codons: "AAU, AAC",
        type: "Polar (Não Carregado)",
        func: "Essencial para o desenvolvimento e funcionamento correto das células cerebrais e neurônios."
    },
    "LYS": {
        name: "Lisina",
        abbrevs: "Lys / K",
        codons: "AAA, AAG",
        type: "Polar Básico (Carregado +)",
        func: "Auxilia na absorção de cálcio, formação de anticorpos, produção de colágeno e carnitina."
    },
    "VAL": {
        name: "Valina",
        abbrevs: "Val / V",
        codons: "GUU, GUC, GUA, GUG",
        type: "Apolar (Hidrofóbico)",
        func: "Aminoácido de cadeia ramificada (BCAA) essencial para o crescimento muscular, regeneração celular e foco mental."
    },
    "ALA": {
        name: "Alanina",
        abbrevs: "Ala / A",
        codons: "GCU, GCC, GCA, GCG",
        type: "Apolar (Hidrofóbico)",
        func: "Importante fonte de glicose para energia muscular rápida e remoção de amônia tóxica dos músculos."
    },
    "ASP": {
        name: "Ácido Aspártico",
        abbrevs: "Asp / D",
        codons: "GAU, GAC",
        type: "Polar Ácido (Carregado -)",
        func: "Participa da síntese de outros aminoácidos e do ciclo da ureia; atua também no metabolismo energético."
    },
    "GLU": {
        name: "Ácido Glutâmico",
        abbrevs: "Glu / E",
        codons: "GAA, GAG",
        type: "Polar Ácido (Carregado -)",
        func: "O principal neurotransmissor excitatório do cérebro, central no aprendizado e memória."
    },
    "GLY": {
        name: "Glicina",
        abbrevs: "Gly / G",
        codons: "GGU, GGC, GGA, GGG",
        type: "Apolar (Hidrofóbico)",
        func: "Menor dos aminoácidos. Atua como neurotransmissor inibidor no sistema nervoso central e compõe o colágeno."
    },
    "STOP": {
        name: "Fim (STOP)",
        abbrevs: "STOP / Fim",
        codons: "UAA, UAG, UGA",
        type: "Códon de Parada",
        func: "Sinaliza ao ribossomo o término da tradução da proteína, liberando a cadeia polipeptídica."
    }
};

// Open Drawer function
function openAminoacidDrawer(abbrev, isClick = false) {
    var data = aminoacidsDb[abbrev];
    if (!data) return;
    
    var drawer = document.getElementById("aminoacid-details-drawer");
    if (!drawer) return;
    
    document.getElementById("drawer-title").textContent = data.name;
    document.getElementById("drawer-abbrevs").textContent = data.abbrevs;
    document.getElementById("drawer-codons").textContent = data.codons;
    
    var typeVal = document.getElementById("drawer-type");
    if (typeVal) {
        typeVal.textContent = data.type || "N/A";
    }
    
    var funcVal = document.getElementById("drawer-function");
    if (funcVal) {
        funcVal.textContent = data.func;
    }
    
    var imgEl = document.getElementById("drawer-img");
    if (imgEl) {
        imgEl.style.backgroundImage = "url('assets/images/aminoacids/" + abbrev + ".png')";
    }
    
    drawer.classList.add("open");
    if (isClick) {
        drawer.classList.add("clicked-open");
    }
}

// Bind Simulator and Drawer events on DOM Load
document.addEventListener("DOMContentLoaded", function () {
    // Simulator controls
    var btnClear = document.getElementById("btn-clear");
    if (btnClear) btnClear.addEventListener("click", clearSequence);
    
    var btnRandom = document.getElementById("btn-random");
    if (btnRandom) btnRandom.addEventListener("click", randomSequence);
    
    // Close button of drawer
    var closeBtn = document.querySelector(".drawer-close-btn");
    if (closeBtn) {
        closeBtn.addEventListener("click", function () {
            var drawer = document.getElementById("aminoacid-details-drawer");
            if (drawer) {
                drawer.classList.remove("open");
                drawer.classList.remove("clicked-open");
            }
        });
    }
    
   //Close drawer when mouse leaves it 
   var drawer = document.getElementById("aminoacid-details-drawer"); 
   if (drawer) { 
        drawer.addEventListener("mouseleave", function () { 
            if (!this.classList.contains("clicked-open")){ 
                this.classList.remove("open"); 
            } 
        }); 
    } 
    
    // Interactive Codon Table clicks
document.querySelectorAll(".codon-item").forEach(function (item) {
    item.addEventListener("click", function () {
        var codon = this.getAttribute("data-codon");
        if (codon) {
            // Translate mRNA codon bases to template DNA bases
            // A -> T, U -> A, C -> G, G -> C
            var dnaCodon = "";
            for (var i = 0; i < codon.length; i++) {
                var rnaBase = codon[i];
                if (rnaBase === "A") dnaCodon += "T";
                else if (rnaBase === "U") dnaCodon += "A";
                else if (rnaBase === "C") dnaCodon += "G";
                else if (rnaBase === "G") dnaCodon += "C";
            }
            
            // Switch tab to app
            var appBtn = document.getElementById("app");
            if (appBtn) {
                appBtn.click();
            }
            
            // Insert the three DNA bases sequentially
            for (var j = 0; j < dnaCodon.length; j++) {
                insertBase(dnaCodon[j]);
            }
        }
    });
});
});