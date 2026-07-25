/**
 * crispr.js — Editor CRISPR-Cas9
 *
 * Módulo para busca de alvos CRISPR, simulação de reparo por NHEJ/HDR
 * e aplicação de edições no simulador principal.
 */

/**
 * Busca um alvo de Cas9 (protoespaçador + PAM "NGG") na sequência de DNA dada.
 * Percorre TODAS as ocorrências do guia na sequência até achar uma seguida de
 * um PAM válido (nem toda ocorrência do protoespaçador necessariamente tem um
 * PAM logo depois).
 * @param {string} dnaSeq  - sequência de DNA onde buscar (a fita ativa do simulador)
 * @param {string} guideSeq - sequência-alvo do RNA guia, escrita em bases de DNA
 * @returns {{start:number, protospacerEnd:number, pamEnd:number, pam:string, cutIndex:number} | null}
 */
function findCrisprTarget(dnaSeq, guideSeq) {
    const seq   = dnaSeq.toUpperCase();
    const guide = guideSeq.toUpperCase().replace(/[^ATCG]/g, '');
    if (guide.length < 4) return null;

    let idx = seq.indexOf(guide);
    while (idx !== -1) {
        const protospacerEnd = idx + guide.length;
        const pam = seq.substr(protospacerEnd, 3);
        if (pam.length === 3 && pam[1] === 'G' && pam[2] === 'G') {
            return { start: idx, protospacerEnd, pamEnd: protospacerEnd + 3, pam, cutIndex: protospacerEnd - 3 };
        }
        idx = seq.indexOf(guide, idx + 1);
    }
    return null;
}

const CRISPR_BASES = ['A', 'T', 'C', 'G'];
function crisprRandomBase() { return CRISPR_BASES[Math.floor(Math.random() * CRISPR_BASES.length)]; }

/**
 * Simula o reparo por NHEJ: insere ou deleta 1-2 bases (nunca múltiplo de 3, de
 * propósito) exatamente no ponto de corte — o resultado mais comum e didaticamente
 * mais claro do NHEJ real, que alimenta direto o classificador de frameshift já existente.
 */
function applyNhejRepair(dnaSeq, cutIndex) {
    const insert = Math.random() < 0.5;
    const size = 1 + Math.floor(Math.random() * 2);
    if (insert) {
        let inserted = '';
        for (var i = 0; i < size; i++) inserted += crisprRandomBase();
        return { edited: dnaSeq.slice(0, cutIndex) + inserted + dnaSeq.slice(cutIndex), kind: 'insert', size, changed: inserted };
    }
    const actualSize = Math.min(size, dnaSeq.length - cutIndex);
    return {
        edited: dnaSeq.slice(0, cutIndex) + dnaSeq.slice(cutIndex + actualSize),
        kind: 'delete', size: actualSize, changed: dnaSeq.slice(cutIndex, cutIndex + actualSize),
    };
}

/**
 * Simula o reparo por HDR: insere a sequência-molde fornecida pelo usuário exatamente
 * no ponto de corte — uma edição precisa e planejada, em contraste com a aleatoriedade do NHEJ.
 */
function applyHdrRepair(dnaSeq, cutIndex, donorSeq) {
    const donor = donorSeq.toUpperCase().replace(/[^ATCG]/g, '');
    return { edited: dnaSeq.slice(0, cutIndex) + donor + dnaSeq.slice(cutIndex), kind: 'insert', size: donor.length, changed: donor };
}

// ─── Camada de DOM: busca de alvo, escolha de via de reparo e prévia ─────────

var crispr = {
    els: {},
    currentDna: '',
    target: null,
    pathway: null,
};

/** Localiza e armazena os elementos do modal de CRISPR (uma única vez). */
function cacheCrisprElements() {
    crispr.els = {
        modal:          document.getElementById('crispr-modal'),
        seqDisplay:     document.getElementById('crispr-sequence-display'),
        loadDemoBtn:    document.getElementById('crispr-load-demo'),
        guideInput:     document.getElementById('crispr-guide-input'),
        searchBtn:      document.getElementById('crispr-search-btn'),
        result:         document.getElementById('crispr-result'),
        pathways:       document.getElementById('crispr-pathways'),
        pathwayNhej:    document.getElementById('crispr-pathway-nhej'),
        pathwayHdr:     document.getElementById('crispr-pathway-hdr'),
        hdrDonorWrap:   document.getElementById('crispr-hdr-donor'),
        donorInput:     document.getElementById('crispr-donor-input'),
        hdrGenerateBtn: document.getElementById('crispr-hdr-generate-btn'),
        preview:        document.getElementById('crispr-preview'),
        applyBtn:       document.getElementById('crispr-apply-btn'),
    };
}

/** Escapa caracteres HTML especiais (a sequência é sempre A/T/C/G, mas por segurança). */
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Renderiza a sequência de DNA, destacando o protoespaçador, o PAM e o ponto de corte (se houver um alvo). */
function renderCrisprSequenceDisplay(dnaSeq, target) {
    if (!target) {
        crispr.els.seqDisplay.innerHTML = '<span class="crispr-seq-plain">' + escapeHtml(dnaSeq) + (dnaSeq ? '' : '(sequência vazia)') + '</span>';
        return;
    }
    var before  = dnaSeq.slice(0, target.start);
    var preCut  = dnaSeq.slice(target.start, target.cutIndex);
    var postCut = dnaSeq.slice(target.cutIndex, target.protospacerEnd);
    var pam     = dnaSeq.slice(target.protospacerEnd, target.pamEnd);
    var after   = dnaSeq.slice(target.pamEnd);

    crispr.els.seqDisplay.innerHTML =
        '<span class="crispr-seq-plain">' + escapeHtml(before) + '</span>' +
        '<span class="crispr-protospacer">' + escapeHtml(preCut) + '</span>' +
        '<span class="crispr-cut-marker" title="Ponto de corte">✂</span>' +
        '<span class="crispr-protospacer">' + escapeHtml(postCut) + '</span>' +
        '<span class="crispr-pam">' + escapeHtml(pam) + '</span>' +
        '<span class="crispr-seq-plain">' + escapeHtml(after) + '</span>';
}

/** Reseta a busca de alvo, a escolha de via e a prévia — sem fechar o modal. */
function resetCrisprDownstreamState() {
    var els = crispr.els;
    crispr.target = null;
    crispr.pathway = null;
    els.result.style.display = 'none';
    els.pathways.style.display = 'none';
    els.pathwayNhej.classList.remove('selected');
    els.pathwayHdr.classList.remove('selected');
    els.hdrDonorWrap.style.display = 'none';
    els.preview.style.display = 'none';
    els.applyBtn.style.display = 'none';
    renderCrisprSequenceDisplay(crispr.currentDna, null);
}

/** Abre o modal, lendo a sequência de DNA atualmente ativa no simulador. */
function openCrisprModal() {
    if (!crispr.els.modal) cacheCrisprElements();
    if (!crispr.els.modal) return;
    crispr.currentDna = PS.readSequence(dnaSequenceChars);
    resetCrisprDownstreamState();
    PS.openModalDialog(crispr.els.modal);
}

/** Carrega a sequência de exemplo (com alvo CRISPR garantidamente válido) no simulador. */
function loadCrisprDemoSequence() {
    var appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();
    PS.clearSequence();
    for (var i = 0; i < CRISPR_DEMO_DNA.length; i++) PS.insertBase(CRISPR_DEMO_DNA.charAt(i), { skipRender: true });
    PS.translate();
    PS.treatSequence();

    crispr.currentDna = CRISPR_DEMO_DNA;
    crispr.els.guideInput.value = CRISPR_DEMO_GUIDE;
    resetCrisprDownstreamState();
}

/** Busca o alvo Cas9 na sequência atual usando o RNA guia informado e atualiza a UI de resultado. */
function searchCrisprTarget() {
    var els = crispr.els;
    resetCrisprDownstreamState();

    var guide = els.guideInput.value.trim();
    if (guide.length < 4) {
        els.result.className = 'crispr-result error';
        els.result.textContent = 'Digite um RNA guia com pelo menos 4 bases.';
        els.result.style.display = 'block';
        return;
    }

    var target = findCrisprTarget(crispr.currentDna, guide);
    if (!target) {
        els.result.className = 'crispr-result error';
        els.result.textContent = 'Nenhum alvo válido encontrado. A Cas9 precisa do protoespaçador seguido ' +
            'imediatamente por um PAM no formato "NGG" (2 últimas bases = G). Tente outro guia ou carregue a ' +
            'sequência de exemplo.';
        els.result.style.display = 'block';
        return;
    }

    crispr.target = target;
    renderCrisprSequenceDisplay(crispr.currentDna, target);
    els.result.className = 'crispr-result success';
    els.result.textContent = 'Alvo encontrado! PAM "' + target.pam + '" reconhecido. O corte ocorrerá 3 pares de ' +
        'base a montante do PAM (marcado com ✂ acima). Escolha a via de reparo abaixo.';
    els.result.style.display = 'block';
    els.pathways.style.display = 'block';
}

/** Constrói o HTML da prévia do reparo, destacando a região inserida ou deletada. */
function renderCrisprPreview(repair, pathwayLabel) {
    var cut = crispr.target.cutIndex;
    var original = crispr.currentDna;
    var beforeHtml, afterHtml;

    if (repair.kind === 'insert') {
        beforeHtml = escapeHtml(original.slice(0, cut)) + escapeHtml(original.slice(cut));
        afterHtml  = escapeHtml(original.slice(0, cut)) +
            '<span class="crispr-diff-add">' + escapeHtml(repair.changed) + '</span>' +
            escapeHtml(original.slice(cut));
    } else {
        beforeHtml = escapeHtml(original.slice(0, cut)) +
            '<span class="crispr-diff-remove">' + escapeHtml(repair.changed) + '</span>' +
            escapeHtml(original.slice(cut + repair.size));
        afterHtml = escapeHtml(repair.edited);
    }

    var frameshiftNote = repair.size % 3 !== 0
        ? 'Como o número de bases alteradas não é múltiplo de 3, isso deve deslocar a fase de leitura (frameshift) a partir daqui.'
        : 'Como o número de bases alteradas é múltiplo de 3, a fase de leitura deve se manter intacta.';

    crispr.els.preview.innerHTML =
        '<strong>' + pathwayLabel + '</strong> — ' + (repair.kind === 'insert' ? 'inserção' : 'deleção') + ' de ' + repair.size + ' base(s) no ponto de corte.<br>' +
        'Antes: <span class="crispr-preview-seq">' + beforeHtml + '</span>' +
        'Depois: <span class="crispr-preview-seq">' + afterHtml + '</span>' +
        '<em>' + frameshiftNote + '</em>';
    crispr.els.preview.style.display = 'block';
    crispr.els.applyBtn.style.display = 'block';
}

/** Chamado ao escolher uma via de reparo (NHEJ dispara a prévia na hora; HDR pede o molde primeiro). */
function selectCrisprPathway(pathway) {
    var els = crispr.els;
    crispr.pathway = pathway;
    els.pathwayNhej.classList.toggle('selected', pathway === 'nhej');
    els.pathwayHdr.classList.toggle('selected', pathway === 'hdr');
    els.preview.style.display = 'none';
    els.applyBtn.style.display = 'none';

    if (pathway === 'nhej') {
        els.hdrDonorWrap.style.display = 'none';
        crispr.pendingRepair = applyNhejRepair(crispr.currentDna, crispr.target.cutIndex);
        renderCrisprPreview(crispr.pendingRepair, 'NHEJ');
    } else {
        els.hdrDonorWrap.style.display = 'block';
    }
}

/** Gera a prévia do reparo por HDR a partir do molde informado pelo usuário. */
function generateCrisprHdrPreview() {
    var donor = crispr.els.donorInput.value.trim();
    if (donor.length < 1) {
        PS.showAlert('Molde vazio', 'Digite uma sequência-molde (donor) para simular o reparo por HDR.');
        return;
    }
    crispr.pendingRepair = applyHdrRepair(crispr.currentDna, crispr.target.cutIndex, donor);
    renderCrisprPreview(crispr.pendingRepair, 'HDR');
}

/**
 * Aplica a edição no simulador principal: a sequência ORIGINAL vira a fita de
 * comparação (baseline) e a sequência EDITADA vira a fita ativa — o mesmo padrão
 * de loadDiseaseExample(), reaproveitando 100% do motor de análise de mutação já
 * existente (o aluno vê Missense/Nonsense/Frameshift/Silenciosa automaticamente).
 */
function applyCrisprEditToSimulator() {
    if (!crispr.target || !crispr.pendingRepair) return;
    var original = crispr.currentDna;
    var edited   = crispr.pendingRepair.edited;
    var pathwayName = crispr.pathway === 'nhej' ? 'NHEJ' : 'HDR';

    var appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();

    PS.clearAllStrandsKeepingMode();
    // A edição já vem pronta, mas deixamos o botão "Mutação" marcado como
    // ativo — reflete o estado real na tela e permite continuar editando
    // livremente a fita resultante a partir daqui, se quiser.
    mutationButton.classList.add('active');
    mutationButton.setAttribute('aria-pressed', 'true');

    PS.fillStrand(original, textboxDna[1], textboxRna[1], null);
    PS.fillStrand(edited,   textboxDna[0], textboxRna[0], blankSpace);

    mutationWindow[0].classList.add('active');

    PS.translate();
    PS.translateStrand(textboxRna[1].getElementsByClassName('sequenceChar'), outputAminoacids[1]);
    PS.treatSequence();

    crispr.els.modal.style.display = 'none';
    PS.showInfo('Edição CRISPR aplicada (' + pathwayName + ')', 'Veja a análise de mutação abaixo, no Simulador.');
}

// Sequência de exemplo com um alvo CRISPR garantidamente válido (protoespaçador = wildDna da anemia falciforme).
var CRISPR_DEMO_DNA = 'TACCTCATTTGGACCGATCGTAA';
var CRISPR_DEMO_GUIDE = 'TACCTCATT';
