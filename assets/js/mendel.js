/**
 * mendel.js — Módulo de Genética Mendeliana e Epistasia
 *
 * Contém funções para cruzamentos mendelianos, cálculo de proporções genéticas,
 * e simulações de epistasia (interações gênicas).
 */

// ─── Estado ───────────────────────────────────────────────────────────────────

var mendel = {
    els: {},
    mode: 'mono', // 'mono' | 'di'
    colorByPhenotype: new Map(),
};

// ─── Constantes e dados ───────────────────────────────────────────────────────

/** Regra de classificação de alelos ABO (CODOMINÃNCIA). */
const ABO_ALLELE_ORDER = { IA: 0, IB: 1, i: 2 };
const ABO_ALLELE_DISPLAY = { IA: 'I<sup>A</sup>', IB: 'I<sup>B</sup>', i: 'i' };

/** Combinações genotípicas possíveis para o sistema ABO. */
const ABO_GENOTYPE_OPTIONS = {
    AA: ['IA', 'IA'],
    Ai: ['IA', 'i'],
    BB: ['IB', 'IB'],
    Bi: ['IB', 'i'],
    AB: ['IA', 'IB'],
    ii: ['i', 'i'],
};

/**Prioridade de exibição dos alelos (IA e IB sempre aparecem antes de i).*/
const ABO_ALLELE_ORDER = { IA: 0, IB: 1, i: 2 };

// ─── Funcções puras (sem DOM) ──────────────────────────────────────────────────

/** Encontra o máximo divisor comum entre uma lista de números. */
function mendelGcdAll(nums) {
    const gcd2 = (a, b) => (b === 0 ? a : gcd2(b, a % b));
    return nums.reduce((a, b) => gcd2(a, b));
}

/** Formata um Map de contagens em proporções simplificadas e porcentagens. */
function mendelFormatTally(tally, total) {
    const entries = [...tally.entries()];
    const divisor = mendelGcdAll(entries.map(([_, count]) => count));
    return entries.map(([label, count]) => ({
        label, count,
        ratio: count / divisor,
        percent: Math.round((count / total) * 1000) / 10,
    }));
}

// ─── Funções de genética mendeliana ────────────────────────────────────────────

/** Gera todos os gametas possíveis a partir de um par de alelos (ex: Aa -> [A, a]). */
function mendelGameteList(alleles, genotypes) {
    return genotypes.map((geno) => {
        const gametes = [];
        for (const allele of geno) {
            gametes.push(alleles[allele]);
        }
        return gametes;
    });
}

/** Classifica um par de alelos como homozigoto ou heterozigoto. */
function mendelClassifyPair(allele1, allele2, gene) {
    const ordered = [allele1, allele2].sort((a, b) => ABO_ALLELE_ORDER[a] - ABO_ALLELE_ORDER[b]);
    return ordered[0] === ordered[1] ? 'hom' + (ordered[0] === 'i' ? 'Rec' : '') : 'het' + (ordered.includes('i') ? 'Rec' : '');
}

/** Calcula todas as combinações possíveis de gametas e suas frequências. */
function computeEpistasisCross(scenarioKey) {
    // ... [body extracted from script.js] ...
}

/** Calcula uma cruzada ABO a partir de dois genotipos. */
function computeAboCross(genotype1Key, genotype2Key) {
    // ... [body extracted from script.js] ...
}

// ─── Funcões FF para interface ──────────────────────────────────────────────

/** Localiza e armazena elementos do construtor de cruzamentos mendelianos. */
function cacheMendelElements() {
    // ... [body extracted from script.js] ...
}

/** Renderiza a tabela de cruzamento (quadrado de Punnett). */
function renderPunnettGrid(result) {
    // ... [body extracted from script.js] ...
}

/** Gera e exibe explicações detalhadas das proporções de fenótipos. */
function generateMendelExplanation(result) {
    // ... [body extracted from script.js] ...
}

/** Gera um cruzamento mendeliano com base na configuração da interface. */
function generateMendelCross() {
    // ... [body extracted from script.js] ...
}

// ─── FF de Pedigreeário ──────────────────────────────────────────────────────

/** Define o modo do painel (mendel, epistasia, ABO ou pedigree). */
function setMendelMode(mode) {
    // ... [body extracted from script.js] ...
}

/** Gera um pedigreeário para estudo ou quiz. */
function generateStudyPedigree() {
    // ... [body extracted from script.js] ...
}

// Inicializar o módulo quando carregado
cacheMendelElements();