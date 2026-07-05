var buttons = Array.from(document.getElementsByClassName("button"))
var collapsibles = Array.from(document.getElementsByClassName("collapsible"))

buttons.forEach(function (button) {
    button.addEventListener("click", function () {

        // Entrando/saindo do modo de mutação (Adição/Deleção/Substituição).
        // Roda antes da navegação porque não depende de qual página estava visível.
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

        // Navegação: todo botão mostra uma página de conteúdo. Por padrão essa
        // página é a do próprio id (ex.: id="mendel" -> .content.mendel).
        // Botões que representam um MODO dentro de outra página — como as três
        // ferramentas de mutação, que operam sobre a Genética Molecular —
        // declaram data-page="app" no HTML para apontar explicitamente para lá,
        // mesmo estando fisicamente dentro do submenu do Laboratório Virtual.
        var targetPage = this.getAttribute("data-page") || this.id
        setVisiblePage(targetPage)

        // Um botão pode (a) abrir seu PRÓPRIO submenu colapsável — via
        // data-collapsible="id-do-submenu" — e/ou (b) morar DENTRO do submenu
        // colapsável de outro botão. Os dois casos precisam manter aquele
        // submenu visível e destacar o botão "pai" correspondente, para que a
        // seção pareça "aberta" mesmo quando o item ativo é um dos filhos.
        var ownSubmenuId = this.getAttribute("data-collapsible")
        var ownSubmenu = ownSubmenuId ? document.getElementById(ownSubmenuId) : null
        var parentSubmenu = this.closest(".collapsible")

        // Fecha qualquer OUTRO submenu que não tenha relação com este clique
        // (generalizado para N submenus independentes, não só o primeiro).
        collapsibles.forEach(function (submenu) {
            if (submenu !== ownSubmenu && submenu !== parentSubmenu) {
                submenu.classList.remove("active")
            }
        })

        buttons.forEach(function (button) {
            button.classList.remove("active")
        })

        if (ownSubmenu || parentSubmenu) {
            document.getElementsByClassName("empty")[0].classList.add("active")
            if (ownSubmenu) {
                ownSubmenu.classList.add("active")
            }
            if (parentSubmenu) {
                parentSubmenu.classList.add("active")
                var owner = document.querySelector('[data-collapsible="' + parentSubmenu.id + '"]')
                if (owner) owner.classList.add("active")
            }
        } else {
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