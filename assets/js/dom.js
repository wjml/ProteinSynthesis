var buttons = Array.from(document.getElementsByClassName("button"))
buttons.forEach(function (button) {
    button.addEventListener("click", function () {
        if (!this.parentNode.classList.contains("collapsible")) {
            setVisiblePage(this.id)
        }
        Array.from(buttons).forEach(function (button) {
            button.classList.remove("active")
        })
        if (this.id == "add" || this.id == "delete" || this.id == "replace") {
            var sequencePrimary = document.getElementsByClassName("sequence")[0]
            var sequenceToMutate = document.getElementsByClassName("sequence")[1]
            // BUGFIX: antes, o snapshot do baseline era refeito a CADA clique em
            // Adicionar/Deletar/Substituir. Isso fazia o aluno perder a sequência
            // original ao alternar entre ferramentas no meio de uma mutação, pois
            // o baseline virava uma cópia do estado já mutado.
            // Agora só tiramos o snapshot ao ENTRAR no modo mutação (quando a fita
            // de comparação ainda não estava ativa); trocar de ferramenta dentro do
            // modo mutação preserva a comparação "antes x depois".
            var enteringMutationMode = !sequenceToMutate.classList.contains("active")
            sequencePrimary.classList.add("active")
            sequenceToMutate.classList.add("active")
            if (enteringMutationMode) {
                cloneSequencePrimary()
            }
        }
        if (this.id == "app" || this.parentNode.classList.contains("collapsible")) {
            document.getElementsByClassName("collapsible")[0].classList.add("active")
            document.getElementsByClassName("empty")[0].classList.add("active")
            document.getElementById("app").classList.add("active")
        } else {
            document.getElementsByClassName("collapsible")[0].classList.remove("active")
            document.getElementsByClassName("empty")[0].classList.remove("active")
            document.getElementsByClassName("sequence")[0].classList.remove("active")
            document.getElementsByClassName("sequence")[1].classList.remove("active")
        }
        this.classList.add("active")

    })
})
function cloneSequencePrimary() {
    document.getElementsByClassName("sequence")[1].innerHTML = ""
    Array.from(document.getElementsByClassName("sequence")[0].children).forEach(function (child) {
        if (child.classList.contains("output-aminoacids") || child.classList.contains("textbox-rna")) {
            Array.from(child.getElementsByClassName("aminoacid")).forEach(function (aminoacid) {
                aminoacid.classList.remove("mutated")
            })
            Array.from(child.getElementsByClassName("sequenceChar")).forEach(function (sequenceChar) {
                sequenceChar.classList.remove("mutated")
            })
        }
        // Skip cloning the blank-space element to avoid extra empty input
        if (!child.id || child.id !== 'blank-space') {
            document.getElementsByClassName("sequence")[1].appendChild(child.cloneNode(true));
        }
    })
}
function setVisiblePage(id) {
    document.getElementById("visible-page").getElementsByClassName("active")[0].classList.remove("active")
    document.getElementById("visible-page").getElementsByClassName(id)[0].classList.add("active")
}

// Lógica do Modo Professor
var toggleProfessor = document.getElementById("toggle-professor");
if (toggleProfessor) {
    toggleProfessor.addEventListener("click", function () {
        document.body.classList.toggle("presentation-mode");
        this.classList.toggle("active");
    });
}