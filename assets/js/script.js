var textboxDna = document.getElementsByClassName("textbox-dna"),
    textboxRna = document.getElementsByClassName("textbox-rna"),
    outputAminoacids = document.getElementsByClassName("output-aminoacids"),
    blankSpace = document.getElementById("blank-space"),
    dnaSequenceChars = textboxDna[0].getElementsByClassName("sequenceChar"),
    rnaSequenceChars = textboxRna[0].getElementsByClassName("sequenceChar"),
    addButton = document.getElementById("add"),
    deleteButton = document.getElementById("delete"),
    replaceButton = document.getElementById("replace");

blankSpace.addEventListener("click", function () {
    if (dnaSequenceChars.length == 0) {
        textboxDna[0].insertBefore(newSequenceChar(), blankSpace)
        textboxRna[0].appendChild(newSequenceChar())
    }
    this.previousElementSibling.focus()
})

for (let i = 0; i < textboxDna.length; i++) {
    textboxDna[i].addEventListener('scroll', scrollUnique)
    textboxRna[i].addEventListener('scroll', scrollUnique)
    outputAminoacids[i].addEventListener('scroll', scrollUnique)
}
function mutationDifference() {
    if (!document.getElementsByClassName("sequence to-mutate")[0].classList.contains("active")) {
        return
    }
    let aminoacids = outputAminoacids[1].getElementsByClassName("aminoacid")
    let mutatedAminoacids = outputAminoacids[0].getElementsByClassName("aminoacid")
    let rna = textboxRna[1].getElementsByClassName("sequenceChar")
    let mutatedRna = textboxRna[0].getElementsByClassName("sequenceChar")
    let rnaSequence = ""
    let mutatedRnaSequence = ""
    for (let i = 0; i < rna.length; i++) {
        rnaSequence += rna[i].value
    }
    for (let i = 0; i < mutatedRna.length; i++) {
        mutatedRnaSequence += mutatedRna[i].value
    }
    for (let i = 0; i < mutatedRna.length; i++) {
        if (mutatedRnaSequence[i] != rnaSequence[i]) {
            mutatedRna[i].classList.add("mutated")
        } else {
            mutatedRna[i].classList.remove("mutated")
        }
    }
    let length = aminoacids.length
    if (length < mutatedAminoacids) length = mutatedAminoacids.length
    for (let i = 0; i < length; i++) {
        if (aminoacids[i].getElementsByClassName("abbreviated-name")[0].innerHTML !=
            mutatedAminoacids[i].getElementsByClassName("abbreviated-name")[0].innerHTML) {
            mutatedAminoacids[i].classList.add("mutated")
        } else {
            mutatedAminoacids[i].classList.remove("mutated")
        }
    }


}
function scrollUnique() {
    for (let i = 0; i < textboxDna.length; i++) {
        textboxDna[i].scrollLeft = this.scrollLeft
        textboxRna[i].scrollLeft = this.scrollLeft
        outputAminoacids[i].scrollLeft = this.scrollLeft
    }
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
            case "molecule": divAminoacid.lastChild.style.backgroundImage = "url(assets/images/aminoacids/" + aminoacid.abbrevName + ".png)"; break
            case "full-name": divAminoacid.lastChild.innerHTML = aminoacid.name; break
        }
    });
    return divAminoacid
}

//make the input vector acts like one - event: keypress
function charInput() {
    let getRnaEquivalent = textboxRna[0].children[Array.prototype.indexOf.call(textboxDna[0].children, this)]
    event.preventDefault()
    let keys = ["CAPSLOCK", "A", "T", "C", "G"]
    let availlableKeys = false
    keys.forEach(function (key) {
        availlableKeys += event.key.toUpperCase() == key
    })
    if (!availlableKeys) { return }
    switch (this.selectionStart) {
        case 0:
            textboxDna[0].insertBefore(newSequenceChar(event.key), this)
            textboxRna[0].insertBefore(newSequenceChar(transcribe(event.key)), getRnaEquivalent)
            this.previousElementSibling.focus()
            if (replaceButton.classList.contains("active")) {
                textboxDna[0].removeChild(this)
                textboxRna[0].removeChild(getRnaEquivalent)
            }
            break
        case 1:
            if (replaceButton.classList.contains("active")) {
                if (typeof this.nextElementSibling == "object" && this.nextElementSibling.value != "") {
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
function actsLikeUniqueInput() {
    let getRnaEquivalent = textboxRna[0].children[Array.prototype.indexOf.call(textboxDna[0].children, this)]
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
    for (let i = 0; i < dnaSequenceChars.length; i++) {
        dnaSequenceChars[i].className = "sequenceChar"
        switch (i % 3) {
            case 0: dnaSequenceChars[i].className += " codon-start"; break
            case 2: dnaSequenceChars[i].className += " codon-end"; break
        }
    }
    for (let i = 0; i < rnaSequenceChars.length; i++) {
        rnaSequenceChars[i].className = "sequenceChar"
        switch (i % 3) {
            case 0: rnaSequenceChars[i].className += " codon-start"; break
            case 2: rnaSequenceChars[i].className += " codon-end"; break
        }
    }

    mutationDifference()
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
}