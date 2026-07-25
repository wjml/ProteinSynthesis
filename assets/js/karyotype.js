/**
 * karyotype.js — Visualizador de Cariótipo e Simulador de Não-disjunção
 *
 * Módulo para visualização de cariótipos humanos, simulação de erros de
 * não-disjunção na meiose I/II e previsão de condições aneuplóides resultantes.
 */

// ─── Estado ───────────────────────────────────────────────────────────────────

var karyo = { els: {} };

// ─── Constantes de dados ──────────────────────────────────────────────────────

/** Tamanhos relativos aproximados (Mb) dos 22 autossomos + X/Y, só para escala visual das barras. */
var CHROMOSOME_SIZES = {
    1: 249, 2: 243, 3: 198, 4: 190, 5: 182, 6: 171, 7: 159, 8: 145, 9: 138, 10: 134,
    11: 135, 12: 133, 13: 114, 14: 107, 15: 102, 16: 90, 17: 83, 18: 80, 19: 59,
    20: 64, 21: 47, 22: 51, X: 155, Y: 57,
};

/** Classificação clássica de Denver: 7 grupos (A-G) por tamanho decrescente. X entra no fim do grupo C, Y no fim do grupo G. */
var KARYOTYPE_GROUPS = [
    { name: 'A', chromosomes: [1, 2, 3] },
    { name: 'B', chromosomes: [4, 5] },
    { name: 'C', chromosomes: [6, 7, 8, 9, 10, 11, 12] },
    { name: 'D', chromosomes: [13, 14, 15] },
    { name: 'E', chromosomes: [16, 17, 18] },
    { name: 'F', chromosomes: [19, 20] },
    { name: 'G', chromosomes: [21, 22] },
];

var KARYOTYPE_CONDITIONS = {
    normal_f:    { label: 'Cariótipo Normal (Feminino)',  notation: '46,XX',      sexChromosomes: ['X', 'X'],      autosomeAnomaly: null,
        description: 'Cariótipo humano típico, 46 cromossomos em 23 pares, incluindo o par sexual XX.' },
    normal_m:    { label: 'Cariótipo Normal (Masculino)', notation: '46,XY',      sexChromosomes: ['X', 'Y'],      autosomeAnomaly: null,
        description: 'Cariótipo humano típico, 46 cromossomos em 23 pares, incluindo o par sexual XY.' },
    down:        { label: 'Síndrome de Down',             notation: '47,XX,+21', sexChromosomes: ['X', 'X'],      autosomeAnomaly: { chr: 21, count: 3 },
        description: 'Trissomia do 21 — a aneuploidia autossômica mais comum compatível com a vida. Associada a deficiência intelectual de grau variável, hipotonia muscular, características faciais típicas e maior incidência de cardiopatias congênitas.' },
    edwards:     { label: 'Síndrome de Edwards',           notation: '47,XX,+18', sexChromosomes: ['X', 'X'],      autosomeAnomaly: { chr: 18, count: 3 },
        description: 'Trissomia do 18 — quadro clínico grave, com malformações múltiplas; a maioria dos casos não sobrevive além do primeiro ano de vida.' },
    patau:       { label: 'Síndrome de Patau',             notation: '47,XX,+13', sexChromosomes: ['X', 'X'],      autosomeAnomaly: { chr: 13, count: 3 },
        description: 'Trissomia do 13 — quadro clínico grave, com malformações graves do sistema nervoso central e da face; prognóstico reservado, semelhante à Síndrome de Edwards.' },
    turner:      { label: 'Síndrome de Turner',            notation: '45,X',      sexChromosomes: ['X'],           autosomeAnomaly: null,
        description: 'Monossomia do X — afeta apenas indivíduos do sexo feminino. Associada a baixa estatura, infertilidade (disgenesia gonadal) e, em alguns casos, pescoço alado.' },
    klinefelter: { label: 'Síndrome de Klinefelter',       notation: '47,XXY',    sexChromosomes: ['X', 'X', 'Y'], autosomeAnomaly: null,
        description: 'Um cromossomo X extra em indivíduos do sexo masculino. Associada a infertilidade, estatura elevada e, por vezes, ginecomastia.' },
};

// ─── Funções puras (sem DOM) ──────────────────────────────────────────────────

/** Retorna, para cada autossomo 1-22, quantas cópias existem (2 normalmente, ou o valor da anomalia). */
function getAutosomeCounts(condition) {
    var counts = {};
    for (var i = 1; i <= 22; i++) counts[i] = 2;
    if (condition.autosomeAnomaly) counts[condition.autosomeAnomaly.chr] = condition.autosomeAnomaly.count;
    return counts;
}

/** Conta o total de cromossomos de um cariótipo (autossomos + sexuais) — única fonte de verdade da contagem. */
function totalChromosomeCount(condition) {
    var autosomeCounts = getAutosomeCounts(condition);
    var autosomeTotal = Object.values(autosomeCounts).reduce(function(a, b) { return a + b; }, 0);
    return autosomeTotal + condition.sexChromosomes.length;
}

/**
 * Simula não-disjunção: retorna os 4 gametas resultantes com a contagem do
 * cromossomo representativo. Erro na Meiose I afeta a separação dos homólogos
 * e torna TODOS os 4 gametas anormais (2 com n+1, 2 com n−1). Erro na Meiose II
 * afeta a separação das cromátides-irmãs em apenas uma das duas células
 * secundárias, deixando 2 gametas normais e só 1 de cada tipo anormal.
 */
function simulateNondisjunction(stage) {
    if (stage === 'MI') {
        return [
            { count: 2, kind: 'n+1' }, { count: 2, kind: 'n+1' },
            { count: 0, kind: 'n-1' }, { count: 0, kind: 'n-1' },
        ];
    }
    return [
        { count: 1, kind: 'n' }, { count: 1, kind: 'n' },
        { count: 2, kind: 'n+1' }, { count: 0, kind: 'n-1' },
    ];
}

/**
 * Constrói a condição de cariótipo resultante da fertilização de um gameta
 * (normal ou de não-disjunção) com um gameta normal do outro genitor.
 * Reaproveita totalChromosomeCount() para a notação numérica — nunca a
 * recalcula à parte, para não haver risco de os dois números divergirem.
 */
function karyotypeFromFertilization(chr, gameteCount, sex) {
    var totalCount = gameteCount + 1;
    var sexChromosomes = sex === 'F' ? ['X', 'X'] : ['X', 'Y'];
    var condition = { sexChromosomes, autosomeAnomaly: totalCount === 2 ? null : { chr: chr, count: totalCount } };
    var total = totalChromosomeCount(condition);
    var notation = totalCount === 2
        ? '46,' + (sex === 'F' ? 'XX' : 'XY')
        : total + ',' + (sex === 'F' ? 'XX' : 'XY') + ',' + (totalCount > 2 ? '+' : '-') + chr;

    var description;
    if (totalCount === 3) {
        var known = Object.values(KARYOTYPE_CONDITIONS).find(function(c) { return c.autosomeAnomaly && c.autosomeAnomaly.chr === chr; });
        description = known ? known.description : 'Trissomia do cromossomo ' + chr + '.';
    } else if (totalCount === 1) {
        description = 'Monossomia do cromossomo ' + chr + '. Monossomias autossômicas completas são, em geral, ' +
            'incompatíveis com o desenvolvimento até o nascimento — a maioria termina em aborto espontâneo precoce.';
    } else {
        description = 'Cariótipo com número normal de cromossomos para este par.';
    }

    return {
        label: totalCount === 3 ? 'Trissomia do ' + chr : totalCount === 1 ? 'Monossomia do ' + chr : 'Normal',
        notation: notation, sexChromosomes: sexChromosomes, autosomeAnomaly: condition.autosomeAnomaly, description: description,
    };
}

// ─── Camada de DOM: renderização da grade de cariótipo e do simulador ────────

/** Localiza e armazena os elementos da ferramenta de cariótipo (uma única vez). */
function cacheKaryotypeElements() {
    karyo.els = {
        conditionSelect:   document.getElementById('karyo-condition-select'),
        notation:          document.getElementById('karyo-notation'),
        grid:              document.getElementById('karyo-grid'),
        description:       document.getElementById('karyo-description'),
        chrSelect:         document.getElementById('nondis-chr-select'),
        sexSelect:         document.getElementById('nondis-sex-select'),
        modeMiBtn:         document.getElementById('nondis-mode-mi'),
        modeMiiBtn:        document.getElementById('nondis-mode-mii'),
        gametesWrap:       document.getElementById('nondis-gametes'),
        nondisExplanation: document.getElementById('nondis-explanation'),
        karyoResultWrap:   document.getElementById('nondis-karyo-result'),
        karyoResultNotation: document.getElementById('nondis-karyo-notation'),
        karyoResultGrid:     document.getElementById('nondis-karyo-grid'),
        karyoResultDescription: document.getElementById('nondis-karyo-description'),
    };
}

/** Desenha a grade de cariótipo (7 linhas, grupos A-G) num container dado, a partir de uma condição. */
function renderKaryotypeGrid(containerEl, condition) {
    var autosomeCounts = getAutosomeCounts(condition);
    var maxSize = CHROMOSOME_SIZES[1];
    var maxBarHeight = 70;
    var minBarHeight = 16;
    var barHeight = function(size) { return Math.max(minBarHeight, Math.round((size / maxSize) * maxBarHeight)); };

    var buildSlot = function(label, count, sizeKey, isAnomaly, extraClass) {
        var bars = '';
        for (var i = 0; i < count; i++) {
            var cls = 'karyo-bar' + (extraClass ? ' ' + extraClass : '') + (isAnomaly ? ' karyo-bar-anomaly' : '');
            bars += '<div class="' + cls + '" style="height:' + barHeight(CHROMOSOME_SIZES[sizeKey]) + 'px;"></div>';
        }
        return '<div class="karyo-slot"><div class="karyo-slot-bars">' + bars + '</div><span class="karyo-slot-label">' + label + '</span></div>';
    };

    var html = '';
    KARYOTYPE_GROUPS.forEach(function(group) {
        html += '<div class="karyo-row">';
        group.chromosomes.forEach(function(chrNum) {
            var isAnomaly = !!(condition.autosomeAnomaly && condition.autosomeAnomaly.chr === chrNum);
            html += buildSlot(String(chrNum), autosomeCounts[chrNum], chrNum, isAnomaly, '');
        });
        if (group.name === 'C') {
            var xCount = condition.sexChromosomes.filter(function(c) { return c === 'X'; }).length;
            if (xCount > 0) html += buildSlot('X', xCount, 'X', false, 'karyo-bar-x');
        }
        if (group.name === 'G') {
            var yCount = condition.sexChromosomes.filter(function(c) { return c === 'Y'; }).length;
            if (yCount > 0) html += buildSlot('Y', yCount, 'Y', false, 'karyo-bar-y');
        }
        html += '</div>';
    });
    containerEl.innerHTML = html;
}

/** Exibe o cariótipo selecionado no visualizador principal. */
function viewSelectedKaryotype() {
    if (!karyo.els.grid) cacheKaryotypeElements();
    var condition = KARYOTYPE_CONDITIONS[karyo.els.conditionSelect.value];
    karyo.els.notation.textContent = condition.notation + ' — ' + totalChromosomeCount(condition) + ' cromossomos';
    renderKaryotypeGrid(karyo.els.grid, condition);
    karyo.els.description.textContent = condition.description;
}

/** Alterna o modo do simulador (Meiose I / Meiose II) e limpa resultados anteriores. */
function setNondisMode(mode) {
    if (!karyo.els.modeMiBtn) cacheKaryotypeElements();
    karyo.nondisMode = mode;
    karyo.els.modeMiBtn.classList.toggle('active', mode === 'MI');
    karyo.els.modeMiiBtn.classList.toggle('active', mode === 'MII');
    karyo.els.modeMiBtn.setAttribute('aria-pressed', String(mode === 'MI'));
    karyo.els.modeMiiBtn.setAttribute('aria-pressed', String(mode === 'MII'));
}

/** Roda a simulação de não-disjunção e renderiza os 4 gametas resultantes. */
function runNondisjunctionSimulation() {
    if (!karyo.els.modeMiBtn) cacheKaryotypeElements();
    var els = karyo.els;
    var mode = karyo.nondisMode || 'MI';
    var gametes = simulateNondisjunction(mode);

    els.gametesWrap.innerHTML = gametes.map(function(g) {
        var isAbnormal = g.count !== 1;
        var bars = '';
        for (var i = 0; i < g.count; i++) bars += '<div class="karyo-bar" style="height:28px;width:9px;"></div>';
        var btn = isAbnormal
            ? '<button type="button" class="nondis-gamete-btn" data-count="' + g.count + '">Ver cariótipo resultante</button>'
            : '';
        return '<div class="nondis-gamete-card ' + (isAbnormal ? 'abnormal' : '') + '">' +
            '<div class="nondis-gamete-bars">' + bars + '</div>' +
            '<span class="nondis-gamete-label">' + g.kind + ' (' + g.count + ' cópia' + (g.count === 1 ? '' : 's') + ')</span>' + btn + '</div>';
    }).join('');

    els.gametesWrap.querySelectorAll('.nondis-gamete-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { showNondisjunctionResult(Number(btn.dataset.count)); });
    });

    els.nondisExplanation.textContent = mode === 'MI'
        ? 'Erro na Meiose I: os homólogos não se separam, então TODOS os 4 gametas ficam anormais — 2 com uma cópia a mais, 2 sem nenhuma cópia.'
        : 'Erro na Meiose II: as cromátides-irmãs não se separam em apenas uma das duas células secundárias — 2 gametas continuam normais, e só 1 fica com cópia a mais e 1 sem nenhuma.';
    els.gametesWrap.style.display = 'grid';
    els.nondisExplanation.style.display = 'block';
    els.karyoResultWrap.style.display = 'none';
}

/** Mostra o cariótipo resultante da fertilização de um gameta anormal (clicado) com um gameta normal do outro genitor. */
function showNondisjunctionResult(gameteCount) {
    var els = karyo.els;
    var chr = Number(els.chrSelect.value);
    var sex = els.sexSelect.value;
    var result = karyotypeFromFertilization(chr, gameteCount, sex);

    els.karyoResultNotation.textContent = result.notation + ' — ' + totalChromosomeCount(result) + ' cromossomos';
    renderKaryotypeGrid(els.karyoResultGrid, result);
    els.karyoResultDescription.textContent = result.description;
    els.karyoResultWrap.style.display = 'block';
}
