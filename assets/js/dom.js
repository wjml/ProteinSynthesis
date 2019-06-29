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
            document.getElementsByClassName("sequence")[0].classList.add("active")
            document.getElementsByClassName("sequence")[1].classList.add("active")
            cloneSequencePrimary()
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
            Array.from(document.getElementsByClassName("sequenceChar")).forEach(function (sequenceitem) {
                sequenceitem.parentNode.removeChild(sequenceitem)
            })
            document.getElementsByClassName("output-aminoacids")[0].innerHTML = ""

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
        document.getElementsByClassName("sequence")[1].appendChild(child.cloneNode(true))
    })
}
function setVisiblePage(id) {
    document.getElementById("visible-page").getElementsByClassName("active")[0].classList.remove("active")
    document.getElementById("visible-page").getElementsByClassName(id)[0].classList.add("active")
}
