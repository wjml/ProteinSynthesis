/**
 * script.js — Simulador de Síntese de Proteínas
 *
 * Refatorado para performance, clareza e manutenibilidade.
 * Todo o código está encapsulado em uma IIFE e nada é exposto no escopo global:
 * o HTML se comunica com este script via data-attributes (data-base, data-disease,
 * data-codon, data-abbrev) lidos por listeners delegados, não por onclick inline.
 *
 * Módulos externos (exercises.js, quiz.js, etc.) registram-se em window.PS
 * e compartilham funções/estado através deste namespace.
 */

// Namespace compartilhado entre módulos
window.PS = window.PS || {};

(function () {
  'use strict';

  // ─── Constantes ──────────────────────────────────────────────────────────────

  /** Bases nitrogenadas válidas para inserção no DNA. */
  const VALID_BASES = new Set(['A', 'T', 'C', 'G']);

  /**
   * Chave de localStorage onde a sequência de DNA atual é salva automaticamente
   * a cada mudança — pra sobreviver a um F5/fechar aba sem querer. Ver
   * saveSequenceAutosave()/restoreSequenceAutosave()/clearSequenceAutosave().
   */
  const DNA_AUTOSAVE_KEY = 'proteinSynthesis.dnaAutosave';

  /**
   * Chave de localStorage onde guardamos o timestamp (Date.now()) do último
   * autosave — usada por restoreSequenceAutosave() pra saber se o autosave
   * ainda está "fresco" o suficiente pra valer a pena restaurar. Ver
   * DNA_AUTOSAVE_MAX_AGE_MS logo abaixo.
   */
  const DNA_AUTOSAVE_TIMESTAMP_KEY = 'proteinSynthesis.dnaAutosaveTimestamp';

  /**
   * Tempo máximo (30 minutos) que um autosave é considerado válido pra
   * restauração automática. Depois disso o simulador simplesmente inicia em
   * branco, sem restaurar e sem avisar — o autosave existe só pra evitar
   * perda acidental de trabalho recente, não pra virar um "salvar sessão"
   * permanente.
   */
  const DNA_AUTOSAVE_MAX_AGE_MS = 30 * 60 * 1000;

  /**
   * Chave de localStorage pra lembrar se a pessoa deixou a fita complementar
   * ligada — mesmo padrão do tema escuro (THEME_STORAGE_KEY em dom.js):
   * preferência de exibição, persiste entre sessões. Ver o listener de
   * #toggle-complementary-strand mais abaixo.
   */
  const SHOW_COMPLEMENTARY_STRAND_KEY = 'proteinSynthesis.showComplementaryStrand';

  /**
   * Transcrição: base do DNA molde → base equivalente no mRNA.
   * Substitui a função transcribe() com switch.
   */
  const DNA_TO_RNA = { A: 'U', T: 'A', C: 'G', G: 'C' };

  /**
   * Base do mRNA → base equivalente no DNA molde.
   * Usado ao clicar na tabela de códons para inserir as bases no simulador.
   */
  const RNA_BASE_TO_DNA = { A: 'T', U: 'A', C: 'G', G: 'C' };

  /**
   * Complemento de DNA-DNA (pareamento de bases padrão, A-T e C-G) — não
   * confundir com DNA_TO_RNA acima, que modela TRANSCRIÇÃO (DNA→RNA). Esta
   * aqui é a 2ª fita da dupla-hélice de verdade: a fita complementar,
   * antiparalela à fita molde que a pessoa digita. Usado por
   * renderComplementaryStrand().
   */
  const COMPLEMENT_DNA = { A: 'T', T: 'A', C: 'G', G: 'C' };

  /**
   * Tabela de tradução: códon mRNA → aminoácido.
   * Substitui o switch de 60+ casos em translate().
   */
  const CODON_TABLE = {
    UUU: { name: 'Fenilalanina',    abbrevName: 'PHE' },
    UUC: { name: 'Fenilalanina',    abbrevName: 'PHE' },
    UUA: { name: 'Leucina',         abbrevName: 'LEU' },
    UUG: { name: 'Leucina',         abbrevName: 'LEU' },
    CUU: { name: 'Leucina',         abbrevName: 'LEU' },
    CUC: { name: 'Leucina',         abbrevName: 'LEU' },
    CUA: { name: 'Leucina',         abbrevName: 'LEU' },
    CUG: { name: 'Leucina',         abbrevName: 'LEU' },
    UCU: { name: 'Serina',          abbrevName: 'SER' },
    UCC: { name: 'Serina',          abbrevName: 'SER' },
    UCA: { name: 'Serina',          abbrevName: 'SER' },
    UCG: { name: 'Serina',          abbrevName: 'SER' },
    AGU: { name: 'Serina',          abbrevName: 'SER' },
    AGC: { name: 'Serina',          abbrevName: 'SER' },
    UAU: { name: 'Tirosina',        abbrevName: 'TYR' },
    UAC: { name: 'Tirosina',        abbrevName: 'TYR' },
    UGU: { name: 'Cisteína',        abbrevName: 'CYS' },
    UGC: { name: 'Cisteína',        abbrevName: 'CYS' },
    UGG: { name: 'Triptofano',      abbrevName: 'TRP' },
    CCU: { name: 'Prolina',         abbrevName: 'PRO' },
    CCC: { name: 'Prolina',         abbrevName: 'PRO' },
    CCA: { name: 'Prolina',         abbrevName: 'PRO' },
    CCG: { name: 'Prolina',         abbrevName: 'PRO' },
    CAU: { name: 'Histidina',       abbrevName: 'HIS' },
    CAC: { name: 'Histidina',       abbrevName: 'HIS' },
    CAA: { name: 'Glutamina',       abbrevName: 'GLN' },
    CAG: { name: 'Glutamina',       abbrevName: 'GLN' },
    CGU: { name: 'Arginina',        abbrevName: 'ARG' },
    CGC: { name: 'Arginina',        abbrevName: 'ARG' },
    CGA: { name: 'Arginina',        abbrevName: 'ARG' },
    CGG: { name: 'Arginina',        abbrevName: 'ARG' },
    AGA: { name: 'Arginina',        abbrevName: 'ARG' },
    AGG: { name: 'Arginina',        abbrevName: 'ARG' },
    AUU: { name: 'Isoleucina',      abbrevName: 'ILE' },
    AUC: { name: 'Isoleucina',      abbrevName: 'ILE' },
    AUA: { name: 'Isoleucina',      abbrevName: 'ILE' },
    AUG: { name: 'Metionina',       abbrevName: 'MET' },
    ACU: { name: 'Treonina',        abbrevName: 'THR' },
    ACC: { name: 'Treonina',        abbrevName: 'THR' },
    ACA: { name: 'Treonina',        abbrevName: 'THR' },
    ACG: { name: 'Treonina',        abbrevName: 'THR' },
    AAU: { name: 'Asparagina',      abbrevName: 'ASN' },
    AAC: { name: 'Asparagina',      abbrevName: 'ASN' },
    AAA: { name: 'Lisina',          abbrevName: 'LYS' },
    AAG: { name: 'Lisina',          abbrevName: 'LYS' },
    GUU: { name: 'Valina',          abbrevName: 'VAL' },
    GUC: { name: 'Valina',          abbrevName: 'VAL' },
    GUA: { name: 'Valina',          abbrevName: 'VAL' },
    GUG: { name: 'Valina',          abbrevName: 'VAL' },
    GCU: { name: 'Alanina',         abbrevName: 'ALA' },
    GCC: { name: 'Alanina',         abbrevName: 'ALA' },
    GCA: { name: 'Alanina',         abbrevName: 'ALA' },
    GCG: { name: 'Alanina',         abbrevName: 'ALA' },
    GAU: { name: 'Ácido Aspártico', abbrevName: 'ASP' },
    GAC: { name: 'Ácido Aspártico', abbrevName: 'ASP' },
    GAA: { name: 'Ácido Glutâmico', abbrevName: 'GLU' },
    GAG: { name: 'Ácido Glutâmico', abbrevName: 'GLU' },
    GGU: { name: 'Glicina',         abbrevName: 'GLY' },
    GGC: { name: 'Glicina',         abbrevName: 'GLY' },
    GGA: { name: 'Glicina',         abbrevName: 'GLY' },
    GGG: { name: 'Glicina',         abbrevName: 'GLY' },
    UAA: { name: 'stop',            abbrevName: 'STOP' },
    UAG: { name: 'stop',            abbrevName: 'STOP' },
    UGA: { name: 'stop',            abbrevName: 'STOP' },
  };

  /** Mensagem de alerta para teclas não permitidas na edição da sequência. */
  const MUTATION_ALERTS = {
    default: 'O sistema somente permite inserção das letras que representam bases nitrogenadas do DNA: A, T, C e G.',
  };

  // ─── Banco de dados de aminoácidos ───────────────────────────────────────────

  const AMINOACIDS_DB = {
    PHE:  { name: 'Fenilalanina',    abbrevs: 'Phe / F',    codons: 'UUU, UUC',                     type: 'Apolar (Hidrofóbico)',       func: 'Precursor de tirosina e neurotransmissores importantes como dopamina, noradrenalina e adrenalina.' },
    LEU:  { name: 'Leucina',         abbrevs: 'Leu / L',    codons: 'UUA, UUG, CUU, CUC, CUA, CUG', type: 'Apolar (Hidrofóbico)',       func: 'Essencial para a síntese e regeneração muscular, além de atuar no controle da glicemia.' },
    SER:  { name: 'Serina',          abbrevs: 'Ser / S',    codons: 'UCU, UCC, UCA, UCG, AGU, AGC', type: 'Polar (Não Carregado)',      func: 'Fundamental para o metabolismo das gorduras, funcionamento do sistema imunológico e desenvolvimento da bainha de mielina.' },
    TYR:  { name: 'Tirosina',        abbrevs: 'Tyr / Y',    codons: 'UAU, UAC',                     type: 'Polar (Não Carregado)',      func: 'Precursor direto da melanina (pigmento da pele) e de hormônios tireoidianos e adrenais.' },
    CYS:  { name: 'Cisteína',        abbrevs: 'Cys / C',    codons: 'UGU, UGC',                     type: 'Polar (Não Carregado)',      func: 'Forma pontes de dissulfeto cruciais para a estabilização tridimensional das proteínas e possui forte ação antioxidante.' },
    TRP:  { name: 'Triptofano',      abbrevs: 'Trp / W',    codons: 'UGG',                          type: 'Apolar (Hidrofóbico)',       func: 'Precursor da serotonina (neurotransmissor do bem-estar) e melatonina (regulador do sono).' },
    PRO:  { name: 'Prolina',         abbrevs: 'Pro / P',    codons: 'CCU, CCC, CCA, CCG',           type: 'Apolar (Hidrofóbico)',       func: 'Importante componente estrutural que confere flexibilidade e rigidez, sendo vital para a formação de colágeno.' },
    HIS:  { name: 'Histidina',       abbrevs: 'His / H',    codons: 'CAU, CAC',                     type: 'Polar Básico (Carregado +)', func: 'Precursor da histamina (resposta alérgica/imune) e componente chave na hemoglobina e enzimas metabólicas.' },
    GLN:  { name: 'Glutamina',       abbrevs: 'Gln / Q',    codons: 'CAA, CAG',                     type: 'Polar (Não Carregado)',      func: 'Aminoácido livre mais abundante no sangue; serve de combustível para células de defesa e transporte de nitrogênio.' },
    ARG:  { name: 'Arginina',        abbrevs: 'Arg / R',    codons: 'CGU, CGC, CGA, CGG, AGA, AGG', type: 'Polar Básico (Carregado +)', func: 'Atua na cicatrização de tecidos, no ciclo da ureia (eliminação de amônia) e estimula a produção de óxido nítrico (vasodilatador).' },
    ILE:  { name: 'Isoleucina',      abbrevs: 'Ile / I',    codons: 'AUU, AUC, AUA',                type: 'Apolar (Hidrofóbico)',       func: 'Participa da síntese de hemoglobina, regulação dos níveis de energia e reparo de tecidos musculares.' },
    MET:  { name: 'Metionina',       abbrevs: 'Met / M',    codons: 'AUG',                          type: 'Apolar (Hidrofóbico)',       func: 'Aminoácido de iniciação da síntese de proteínas (códon de início) e fonte biológica importante de enxofre.' },
    THR:  { name: 'Treonina',        abbrevs: 'Thr / T',    codons: 'ACU, ACC, ACA, ACG',           type: 'Polar (Não Carregado)',      func: 'Essencial para a integridade do esmalte dentário, colágeno, elastina e bom funcionamento digestivo e imune.' },
    ASN:  { name: 'Asparagina',      abbrevs: 'Asn / N',    codons: 'AAU, AAC',                     type: 'Polar (Não Carregado)',      func: 'Essencial para o desenvolvimento e funcionamento correto das células cerebrais e neurônios.' },
    LYS:  { name: 'Lisina',          abbrevs: 'Lys / K',    codons: 'AAA, AAG',                     type: 'Polar Básico (Carregado +)', func: 'Auxilia na absorção de cálcio, formação de anticorpos, produção de colágeno e carnitina.' },
    VAL:  { name: 'Valina',          abbrevs: 'Val / V',    codons: 'GUU, GUC, GUA, GUG',           type: 'Apolar (Hidrofóbico)',       func: 'Aminoácido de cadeia ramificada (BCAA) essencial para o crescimento muscular, regeneração celular e foco mental.' },
    ALA:  { name: 'Alanina',         abbrevs: 'Ala / A',    codons: 'GCU, GCC, GCA, GCG',           type: 'Apolar (Hidrofóbico)',       func: 'Importante fonte de glicose para energia muscular rápida e remoção de amônia tóxica dos músculos.' },
    ASP:  { name: 'Ácido Aspártico', abbrevs: 'Asp / D',    codons: 'GAU, GAC',                     type: 'Polar Ácido (Carregado -)',  func: 'Participa da síntese de outros aminoácidos e do ciclo da ureia; atua também no metabolismo energético.' },
    GLU:  { name: 'Ácido Glutâmico', abbrevs: 'Glu / E',    codons: 'GAA, GAG',                     type: 'Polar Ácido (Carregado -)',  func: 'O principal neurotransmissor excitatório do cérebro, central no aprendizado e memória.' },
    GLY:  { name: 'Glicina',         abbrevs: 'Gly / G',    codons: 'GGU, GGC, GGA, GGG',           type: 'Apolar (Hidrofóbico)',       func: 'Menor dos aminoácidos. Atua como neurotransmissor inibidor no sistema nervoso central e compõe o colágeno.' },
    STOP: { name: 'Fim (STOP)',       abbrevs: 'STOP / Fim', codons: 'UAA, UAG, UGA',                type: 'Códon de Parada',            func: 'Sinaliza ao ribossomo o término da tradução da proteína, liberando a cadeia polipeptídica.' },
  };

  // ─── Cache de elementos DOM ───────────────────────────────────────────────────

  // Coleções vivas (HTMLCollection) — atualizadas automaticamente com as mudanças no DOM
  const textboxDna       = document.getElementsByClassName('textbox-dna');
  const textboxRna       = document.getElementsByClassName('textbox-rna');
  const outputAminoacids = document.getElementsByClassName('output-aminoacids');
  const blankSpace       = document.getElementById('blank-space');
  const dnaSequenceChars = textboxDna[0].getElementsByClassName('sequenceChar');
  const rnaSequenceChars = textboxRna[0].getElementsByClassName('sequenceChar');
  // [0] = simulador principal, [1] = painel de mutação — mesma indexação de
  // textboxDna/textboxRna/outputAminoacids. Ver renderComplementaryStrand().
  const complementContainers = [
    document.getElementById('textbox-dna-complement-0'),
    document.getElementById('textbox-dna-complement-1'),
  ];
  const mutationButton   = document.getElementById('mutation-toggle');
  // BUGFIX: era global implícita no original (ponto-e-vírgula separava do bloco var anterior)
  const mutationWindow   = document.getElementsByClassName('sequence to-mutate');

  /**
   * Referências ao drawer de detalhes do aminoácido.
   * Preenchidas em DOMContentLoaded para garantir que o DOM esteja pronto.
   */
  const drawer = {
    panel:   null,
    title:   null,
    abbrevs: null,
    codons:  null,
    type:    null,
    func:    null,
    img:     null,
  };

  /**
   * Referências ao painel de mutação.
   * Inicializadas de forma lazy na primeira chamada de mutationDifference().
   */
  const mutPanel = {
    panel:         null,
    noMutationMsg: null,
    details:       null,
    badge:         null,
    desc:          null,
  };

  // ─── Utilitários ─────────────────────────────────────────────────────────────

  /**
   * Retorna o input de RNA em textboxRna[0] que corresponde ao input de DNA fornecido.
   * Substitui o padrão Array.prototype.indexOf.call() repetido em vários lugares.
   */
  function getRnaEquivalent(dnaInput) {
    const index = Array.prototype.indexOf.call(textboxDna[0].children, dnaInput);
    return textboxRna[0].children[index];
  }

  /**
   * Retorna a sequência concatenada de uma HTMLCollection de inputs.
   * Substitui os 4 loops idênticos espalhados no código original.
   */
  function readSequence(chars) {
    let seq = '';
    for (let i = 0; i < chars.length; i++) seq += chars[i].value;
    return seq;
  }

  /** Converte uma base do DNA molde para a base equivalente no mRNA. */
  function transcribe(base) {
    return DNA_TO_RNA[base.toUpperCase()] || '';
  }

  /**
   * Traduz uma string de DNA molde inteira (DNA → RNAm → proteína) sem tocar
   * no DOM — todo o resto do motor de tradução do app (translate(),
   * translateStrand()) é acoplado aos elementos .sequenceChar reais da tela.
   * Usada pelo Gerador de Exercícios, que precisa calcular o gabarito de
   * várias sequências de uma vez, nenhuma delas necessariamente a que está
   * no simulador no momento.
   *
   * Assume uma DNA já válida (como as geradas por generateRandomCodingDna():
   * começa em TAC=AUG, sempre um múltiplo de 3 bases). Para além disso, para
   * no primeiro STOP encontrado — mesma regra de leitura do resto do app.
   */
  function translateDnaHeadless(dnaSeq) {
    let rna = '';
    for (const base of dnaSeq) rna += transcribe(base);

    const codons = [];
    const aminoAcids = [];
    for (let i = 0; i + 3 <= rna.length; i += 3) {
      const codon = rna.slice(i, i + 3);
      const info = CODON_TABLE[codon];
      codons.push(codon);
      if (!info) break; // não deveria acontecer com sequência gerada por generateRandomCodingDna()
      if (info.abbrevName === 'STOP') break;
      aminoAcids.push(info);
    }

    return { dnaSeq, rna, codons, aminoAcids };
  }

  // Geração de exercícios (generateExerciseSet) movida para assets/js/exercises.js

  /**
   * Aplica as classes CSS de cor de base e posição de códon a uma coleção de inputs.
   * Substitui os 4 loops idênticos em treatSequence().
   *
   * `frameStart` é a posição (em bases) onde o AUG de verdade começa nessa
   * sequência (achado via findFirstStartIndex() na fita de RNA correspondente,
   * e reaproveitado tanto pra fita de DNA quanto pra fita de RNA, já que as
   * duas têm o mesmo comprimento e a mesma correspondência posição a posição).
   * Bases ANTES do frameStart são a UTR 5' — não fazem parte de nenhum códon,
   * então recebem a classe 'codon-utr' em vez de agrupamento em trincas.
   * Se frameStart for -1 (nenhum AUG na sequência), agrupa a partir da
   * posição 0 como um recurso puramente visual (não há tradução de verdade
   * pra alinhar de qualquer forma).
   */
  function applyCodonClasses(chars, frameStart) {
    const hasFrame = typeof frameStart === 'number' && frameStart >= 0;
    for (let i = 0; i < chars.length; i++) {
      const val = chars[i].value.toUpperCase();
      let cls = 'sequenceChar base-' + val;

      if (hasFrame && i < frameStart) {
        cls += ' codon-utr';
        if (i === frameStart - 1) cls += ' codon-utr-end'; // último da UTR: respiro antes do 1º códon real
      } else {
        const rel = hasFrame ? i - frameStart : i;
        if (rel % 3 === 0)      cls += ' codon-start';
        else if (rel % 3 === 2) cls += ' codon-end';
      }
      chars[i].className = cls;
    }
  }

  /**
   * Renderiza a fita complementar de DNA — a 2ª fita da dupla-hélice, derivada
   * da fita molde por pareamento padrão (A-T, C-G; ver COMPLEMENT_DNA acima).
   * Cada base entra na MESMA posição de índice da base molde correspondente
   * (é um "emparelhamento direto", igual ao já usado pra gerar a fita de RNA
   * — não inverte a ordem). Reaproveita o mesmo frameStart de
   * applyCodonClasses() pra manter o agrupamento visual por códon (as
   * margens de 8px entre trincas) idêntico ao da fita molde acima, senão as
   * duas fileiras iriam desalinhando conforme a sequência cresce.
   *
   * Usa <span>, não <input>: é conteúdo só de leitura, sempre derivado da
   * fita molde, e por isso nunca deve entrar em nenhuma coleção
   * .sequenceChar usada pra tradução/mutação em outras funções — daí a
   * classe própria .complementChar (ver app.css).
   */
  function renderComplementaryStrand(dnaChars, container, frameStart) {
    if (!container) return;
    const hasFrame = typeof frameStart === 'number' && frameStart >= 0;
    const frag = document.createDocumentFragment();

    for (let i = 0; i < dnaChars.length; i++) {
      const val  = dnaChars[i].value.toUpperCase();
      const comp = COMPLEMENT_DNA[val] || '';
      const span = document.createElement('span');
      let cls = 'complementChar' + (comp ? ' base-' + comp : '');

      if (hasFrame && i < frameStart) {
        cls += ' codon-utr';
        if (i === frameStart - 1) cls += ' codon-utr-end';
      } else {
        const rel = hasFrame ? i - frameStart : i;
        if (rel % 3 === 0)      cls += ' codon-start';
        else if (rel % 3 === 2) cls += ' codon-end';
      }
      span.className = cls;
      span.textContent = comp;
      frag.appendChild(span);
    }

    container.innerHTML = '';
    container.appendChild(frag);
  }

  /**
   * Percentual de Guanina + Citosina numa coleção de bases (DNA ou RNA — G e C
   * significam a mesma coisa nos dois alfabetos, então a mesma função serve
   * pras duas fitas). Usado no contador "GC:" da barra de estatísticas.
   */
  function computeGCContent(chars) {
    if (!chars.length) return 0;
    let gcCount = 0;
    for (let i = 0; i < chars.length; i++) {
      const val = chars[i].value.toUpperCase();
      if (val === 'G' || val === 'C') gcCount++;
    }
    return Math.round((gcCount / chars.length) * 100);
  }

  /**
   * Remove todos os filhos com classe sequenceChar de um container.
   * Substitui o padrão de limpeza repetido 4 vezes em clearSequence().
   */
  function clearSequenceChars(container) {
    if (!container) return;
    Array.from(container.getElementsByClassName('sequenceChar'))
      .forEach(el => container.removeChild(el));
  }

  /**
   * Exibe um alerta de erro.
   * Usa SweetAlert se disponível; caso contrário, usa o alert nativo.
   * O <script> do SweetAlert2 agora carrega ANTES de dom.js/script.js no HTML,
   * então esse fallback só entra em ação se o CDN falhar (rede instável,
   * bloqueador de conteúdo etc.) — deixado por segurança, não como caminho
   * esperado.
   */
  function showAlert(title, text) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ type: 'error', title, text });
    } else {
      window.alert(text);
    }
  }

  /**
   * Exibe uma notificação informativa não-bloqueante (ex: sequência carregada via link).
   * Silenciosa se o SweetAlert ainda não estiver disponível, para não interromper a carga da página.
   */
  function showInfo(title, text) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ type: 'success', title, text, timer: 2800, showConfirmButton: false });
    }
  }

  /** Elemento que tinha o foco antes do modal atual abrir — usado para devolver o foco ao fechar. */
  let modalOpenerElement = null;

  /**
   * Abre um modal seq-modal-overlay (Exportar, Importar, Ribossomo, Mendel, CRISPR, Replicação):
   * lembra quem tinha o foco para restaurar ao fechar (ver closeModal, na vinculação de eventos)
   * e move o foco para dentro do modal — para `focusTarget`, se informado, ou para o botão de
   * fechar como alvo padrão. Sem isso, o foco do teclado ficava "preso" atrás do modal, numa
   * página que o usuário não consegue mais ver.
   */
  function openModalDialog(modal, focusTarget) {
    if (!modal) return;
    modalOpenerElement = document.activeElement;
    modal.style.display = 'flex';
    const target = focusTarget || modal.querySelector('.seq-modal-close');
    if (target) target.focus();
  }

  // ─── Criação de elementos DOM ─────────────────────────────────────────────────

  /**
   * Cria e retorna um novo input sequenceChar com os event listeners vinculados.
   * @param {string} value - base inicial (opcional).
   * @param {string} className - classe CSS do input (default 'sequenceChar').
   * @param {string} ariaLabel - rótulo acessível para leitores de tela, ex: 'Base de DNA' ou 'Base de RNA mensageiro'.
   */
 

  // Código do Simulador Molecular movido para assets/js/simulator.js
// ─── Vinculação de eventos ────────────────────────────────────────────────────

  // Botão "Fita complementar" — mostra/esconde a 2ª fita da dupla-hélice
  // (ver renderComplementaryStrand() e body.show-complementary-strand em app.css).
  // Um único toggle controla as duas fileiras (simulador principal + painel de
  // mutação) de uma vez: se a pessoa quer ver a fita complementar, faz sentido
  // ver nas duas, não só numa.
  //
  // BUGFIX: preferência agora persiste entre sessões (localStorage), igual o
  // tema escuro (ver THEME_STORAGE_KEY em dom.js) — antes resetava pra
  // desligado a cada F5, inconsistente com o resto do app.
  const toggleComplementaryBtn = document.getElementById('toggle-complementary-strand');

  function applyComplementaryStrandVisibility(isOn) {
    document.body.classList.toggle('show-complementary-strand', isOn);
    if (toggleComplementaryBtn) {
      toggleComplementaryBtn.setAttribute('aria-pressed', String(isOn));
      const icon = toggleComplementaryBtn.querySelector('i');
      if (icon) icon.className = isOn ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
  }

  if (toggleComplementaryBtn) {
    toggleComplementaryBtn.addEventListener('click', function () {
      const isOn = !document.body.classList.contains('show-complementary-strand');
      PS.applyComplementaryStrandVisibility(isOn);
      try {
        localStorage.setItem(SHOW_COMPLEMENTARY_STRAND_KEY, isOn ? '1' : '0');
      } catch (e) {
        // localStorage indisponível (modo privado etc.) — funciona só nesta sessão.
      }
    });
  }

  /**
   * Colar uma sequência inteira na caixa de DNA — antes só dava pra digitar
   * base por base, o que não faz sentido pra sequências vindas de fora
   * (NCBI, um livro, outra ferramenta). Só liga na fita molde principal
   * (textboxDna[0]) — mesmo escopo de insertBase(), o painel de mutação
   * não é editável diretamente.
   *
   * Limpeza aplicada ao texto colado, nessa ordem:
   *   1) remove linha(s) de cabeçalho FASTA (">accession descrição...") —
   *      sem isso, letras A/T/C/G incidentais no próprio texto do
   *      cabeçalho (ex.: "beta" tem A e T) vazariam pra sequência.
   *   2) maiúsculas, e U→T — trata RNA colado por engano como DNA
   *      equivalente, em vez de simplesmente descartar essas bases.
   *   3) descarta qualquer caractere que não seja A/T/C/G (espaços,
   *      números de posição, quebras de linha internas etc.).
   *
   * PASTE_MAX_BASES existe só pra proteger a UI: colar um cromossomo
   * inteiro por engano (milhões de caracteres) inseriria um DOM element
   * por base, um de cada vez — sem limite isso poderia travar a aba.
   */
  const PASTE_MAX_BASES = 600;

  function cleanPastedSequence(raw) {
    const withoutHeaders = raw
      .split('\n')
      .filter(line => !line.trim().startsWith('>'))
      .join('');
    const upper = withoutHeaders.toUpperCase().replace(/U/g, 'T');
    const bases = upper.replace(/[^ATCG]/g, '');
    // Conta as letras do texto original (A-Z, já sem o cabeçalho FASTA) pra
    // medir que FRAÇÃO delas virou base válida — não basta ter ENCONTRADO
    // alguma base, texto qualquer ("mUndo" tem um U, que vira T) pode
    // acidentalmente "achar" uma ou duas. Uma sequência de verdade deve ser
    // quase 100% A/T/C/G; texto solto normalmente fica bem abaixo disso.
    const totalLetters = (upper.match(/[A-Z]/g) || []).length;
    return { bases, totalLetters };
  }

  textboxDna[0].addEventListener('paste', function (event) {
    event.preventDefault();
    const raw = (event.clipboardData || window.clipboardData).getData('text');
    if (!raw) return;

    const { bases: cleaned, totalLetters } = cleanPastedSequence(raw);
    const looksLikeSequence = cleaned.length > 0 && (cleaned.length / totalLetters) >= 0.7;
    if (!looksLikeSequence) {
      showAlert('Nada para colar', 'O texto colado não parece ser uma sequência de DNA/RNA válida.');
      return;
    }
    let bases = cleaned;

    const wasTruncated = bases.length > PASTE_MAX_BASES;
    if (wasTruncated) bases = bases.slice(0, PASTE_MAX_BASES);

    // BUGFIX: clicar numa caixa de DNA vazia já cria uma caixinha vazia (ver
    // activateDnaInput()) só pra ter algo focado — sem isso, colar direto
    // deixava essa caixa vazia sobrando no meio da sequência, ANTES das
    // bases coladas. Se é isso que está focado agora, remove antes de inserir.
    const activeEl = document.activeElement;
    if (activeEl && activeEl.classList.contains('sequenceChar') &&
        textboxDna[0].contains(activeEl) && activeEl.value === '') {
      const rnaEl = getRnaEquivalent(activeEl);
      activeEl.remove();
      if (rnaEl) rnaEl.remove();
    }

    for (const base of bases) PS.insertBase(base, { skipRender: true });
    PS.translate();
    PS.treatSequence();

    if (wasTruncated) {
      showInfo('Sequência cortada', `Foram inseridas as ${PASTE_MAX_BASES} primeiras bases — a sequência colada era maior que o limite.`);
    }
  });

  // Scroll sync — apenas a linha de DNA emite; as demais são dirigidas por ela
  for (let i = 0; i < textboxDna.length; i++) {
    textboxDna[i].addEventListener('scroll', scrollUnique);
  }

  // Clique no blank-space ou na área vazia do container ativa o input de DNA
  blankSpace.addEventListener('click', activateDnaInput);
  textboxDna[0].addEventListener('click', function (event) {
    if (event.target.classList && event.target.classList.contains('sequenceChar')) return;
    if (event.target === blankSpace) return;
    activateDnaInput();
  });

  // DOMContentLoaded — vincula controles que dependem de elementos renderizados após este script
  document.addEventListener('DOMContentLoaded', function () {
    // Gera a tabela de 64 códons a partir de CODON_TABLE antes de vincular os cliques nela
    buildCodonTable();

    // Roda de Códons interativa (mesma fonte de dados da tabela acima)
    buildCodonWheel();
    initCodonWheelInteractions();

    // Inicializa o Modo Desafio (Quiz)
    initQuizUI();

    // Preenche o cache do drawer uma única vez
    drawer.panel   = document.getElementById('aminoacid-details-drawer');
    drawer.title   = document.getElementById('drawer-title');
    drawer.abbrevs = document.getElementById('drawer-abbrevs');
    drawer.codons  = document.getElementById('drawer-codons');
    drawer.type    = document.getElementById('drawer-type');
    drawer.func    = document.getElementById('drawer-function');
    drawer.img     = document.getElementById('drawer-img');

    // Delegação de eventos do drawer de aminoácido — um único par de listeners
    // por container, em vez de 3 listeners recriados a cada aminoácido renderizado
    // (ver newAminoacid() e bindAminoacidOutputEvents()).
    for (let i = 0; i < outputAminoacids.length; i++) {
      bindAminoacidOutputEvents(outputAminoacids[i]);
    }

    // Botões de inserção de base (A/T/C/G) — antes eram onclick="insertBase('A')" inline no HTML
    document.querySelectorAll('.btn-base[data-base]').forEach((btn) => {
      // mousedown com preventDefault() evita que o navegador mova o foco pro
      // próprio botão ao ser clicado. Sem isso, o clique "rouba" o foco do
      // sequenceChar que a pessoa tinha selecionado (por exemplo, ao escolher
      // onde aplicar uma mutação de adição/substituição) — e, no momento em
      // que insertBase() lê document.activeElement, ele já não é mais aquele
      // input, e sim o próprio botão. O resultado, sem essa correção, é a base
      // sempre acabar inserida no final da sequência, ignorando a posição
      // selecionada. Como isso acontece no mousedown (antes do click), o
      // clique em si continua dispachando insertBase() normalmente.
      btn.addEventListener('mousedown', (event) => event.preventDefault());
      btn.addEventListener('click', () => PS.insertBase(btn.dataset.base));
    });

    // Cartões de doenças genéticas — antes eram onclick="loadDiseaseExample('sickle')" inline no HTML
    document.querySelectorAll('.disease-load-btn[data-disease]').forEach((btn) => {
      btn.addEventListener('click', () => loadDiseaseExample(btn.dataset.disease));
    });

    // Controles do simulador
    const btnClear  = document.getElementById('btn-clear');
    const btnRandom = document.getElementById('btn-random');
    const btnExport = document.getElementById('btn-export');
    const btnImport = document.getElementById('btn-import');
    const btnAnimate = document.getElementById('btn-animate');
    const btnCrispr = document.getElementById('btn-crispr');
    const btnReplicate = document.getElementById('btn-replicate');
    const mLabTabCross    = document.getElementById('mendel-lab-tab-cross');
    const mLabTabEpistasis = document.getElementById('mendel-lab-tab-epistasis');
    const mLabTabAbo      = document.getElementById('mendel-lab-tab-abo');
    if (btnClear)      btnClear.addEventListener('click', PS.clearSequence);
    if (btnRandom)     btnRandom.addEventListener('click', PS.randomSequence);
    if (btnExport)     btnExport.addEventListener('click', PS.openExportModal);
    if (btnImport)     btnImport.addEventListener('click', PS.openImportModal);
    if (btnAnimate)    btnAnimate.addEventListener('click', PS.openRibosomeModal);
    if (btnCrispr)     btnCrispr.addEventListener('click', PS.openCrisprModal);
    if (btnReplicate)  btnReplicate.addEventListener('click', PS.openReplicationModal);
    if (mLabTabCross)     mLabTabCross.addEventListener('click', function () { PS.setMendelLabTab('cross'); });
    if (mLabTabEpistasis) mLabTabEpistasis.addEventListener('click', openEpistasisModal);
    if (mLabTabAbo)       mLabTabAbo.addEventListener('click', openAboModal);

    // Hierarquia Visual do Dogma Central — .dogma-stepper (topo da barra de
    // ferramentas) navega direto pra ação de cada módulo: Replicação abre o
    // modal de replicação, Transcrição toca a animação leve de pareamento de
    // bases e rola até o RNAm, Tradução abre o modal do ribossomo. O botão ▶
    // dentro do próprio rótulo RNAm dispara a mesma animação de pareamento.
    const dogmaStepReplication   = document.getElementById('dogma-step-replication');
    const dogmaStepTranscription = document.getElementById('dogma-step-transcription');
    const dogmaStepTranslation   = document.getElementById('dogma-step-translation');
    const btnPlayPairing         = document.getElementById('btn-play-pairing');
    const transcriptionProcessBox = document.getElementById('transcription-process-box');

    if (dogmaStepReplication) dogmaStepReplication.addEventListener('click', PS.openReplicationModal);
    if (dogmaStepTranslation) dogmaStepTranslation.addEventListener('click', PS.openRibosomeModal);
    if (dogmaStepTranscription) {
      dogmaStepTranscription.addEventListener('click', () => {
        if (transcriptionProcessBox && transcriptionProcessBox.scrollIntoView) {
          transcriptionProcessBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        PS.animateBasePairing();
      });
    }
    if (btnPlayPairing) {
      btnPlayPairing.addEventListener('click', (event) => {
        event.stopPropagation();
        PS.animateBasePairing();
      });
    }

    const btnExerciseGenerator = document.getElementById('btn-exercise-generator');
    if (btnExerciseGenerator) btnExerciseGenerator.addEventListener('click', PS.openExerciseGeneratorModal);

    const epistasisGenerateBtn = document.getElementById('epistasis-generate-btn');
    const epistasisScenarioSelect = document.getElementById('epistasis-scenario-select');
    if (epistasisGenerateBtn) epistasisGenerateBtn.addEventListener('click', PS.renderEpistasisResult);
    if (epistasisScenarioSelect) epistasisScenarioSelect.addEventListener('change', PS.renderEpistasisResult);

    const aboGenerateBtn = document.getElementById('abo-generate-btn');
    if (aboGenerateBtn) aboGenerateBtn.addEventListener('click', PS.renderAboResult);

    const exerciseGenGenerateBtn = document.getElementById('exercise-gen-generate-btn');
    const exerciseGenActions     = document.getElementById('exercise-gen-actions');
    if (exerciseGenGenerateBtn) {
      exerciseGenGenerateBtn.addEventListener('click', function () {
        var count = Number(document.getElementById('exercise-gen-count').value) || 10;
        var numCodons = Number(document.getElementById('exercise-gen-length').value) || 7;
        var set = PS.generateExerciseSet(count, numCodons);
        PS.exerciseSet = set;
        PS.renderExercisePreview(set);
        PS.renderExercisePrintables(set);
        if (exerciseGenActions) exerciseGenActions.hidden = false;
      });
    }

    const exerciseGenPrintWorksheetBtn = document.getElementById('exercise-gen-print-worksheet');
    const exerciseGenPrintKeyBtn       = document.getElementById('exercise-gen-print-key');
    const exerciseGenDownloadBtn       = document.getElementById('exercise-gen-download-txt');
    if (exerciseGenPrintWorksheetBtn) {
      exerciseGenPrintWorksheetBtn.addEventListener('click', function () { PS.printExerciseContent('exercise-worksheet-printable'); });
    }
    if (exerciseGenPrintKeyBtn) {
      exerciseGenPrintKeyBtn.addEventListener('click', function () { PS.printExerciseContent('exercise-answerkey-printable'); });
    }
    if (exerciseGenDownloadBtn) {
      exerciseGenDownloadBtn.addEventListener('click', function () { PS.downloadExercisesAsText(PS.exerciseSet); });
    }

    // Modais de exportar/importar/animar sequência/CRISPR/replicação
    // (Mendel/Epistasia/ABO migraram para painel com abas — não são mais modais)
    const exportModal = document.getElementById('export-modal');
    const importModal = document.getElementById('import-modal');
    const ribosomeModal = document.getElementById('ribosome-modal');
    const crisprModal = document.getElementById('crispr-modal');
    const replicationModal = document.getElementById('replication-modal');
    const exerciseGeneratorModal = document.getElementById('exercise-generator-modal');
    const exportCloseBtn = document.getElementById('export-modal-close');
    const importCloseBtn = document.getElementById('import-modal-close');
    const ribosomeCloseBtn = document.getElementById('ribosome-modal-close');
    const crisprCloseBtn = document.getElementById('crispr-modal-close');
    const replicationCloseBtn = document.getElementById('replication-modal-close');
    const exerciseGeneratorCloseBtn = document.getElementById('exercise-generator-modal-close');
    const exportCopySeqBtn  = document.getElementById('export-copy-seq');
    const exportCopyLinkBtn = document.getElementById('export-copy-link');
    const exportImageBtn    = document.getElementById('export-image-btn');
    const importLoadBtn  = document.getElementById('import-load-btn');
    const importSeqInput = document.getElementById('import-seq-input');

    // A animação do ribossomo e a de replicação precisam parar seus timers ao
    // fechar; os demais modais não têm estado de animação e só precisam de display:none.
    // Também devolve o foco a quem abriu o modal (ver openModalDialog, nos Utilitários) —
    // com uma ressalva: Exportar/Importar/CRISPR/Replicar vivem dentro do menu "Mais
    // ações", que já se escondeu (dom.js fecha o dropdown assim que um item é escolhido,
    // ver closeMoreActions) quando o modal é fechado depois. Um elemento display:none
    // não é focável, então nesses casos cai para o próprio botão "Mais ações".
    const closeModal = (modal) => {
      if (!modal) return;
      if (modal === ribosomeModal) { pauseRibosome(); }
      if (modal === replicationModal) { pauseReplication(); }
      modal.style.display = 'none';

      const isFocusable = (el) => !!el && typeof el.focus === 'function' && el.offsetParent !== null;
      const fallback = document.getElementById('more-actions-toggle');
      const focusTarget = isFocusable(modalOpenerElement) ? modalOpenerElement : fallback;
      if (isFocusable(focusTarget)) focusTarget.focus();
      modalOpenerElement = null;
    };
    PS.closeModal = closeModal;

    if (exportCloseBtn)      exportCloseBtn.addEventListener('click', () => closeModal(exportModal));
    if (importCloseBtn)      importCloseBtn.addEventListener('click', () => closeModal(importModal));
    if (ribosomeCloseBtn)    ribosomeCloseBtn.addEventListener('click', () => closeModal(ribosomeModal));
    if (crisprCloseBtn)      crisprCloseBtn.addEventListener('click', () => closeModal(crisprModal));
    if (replicationCloseBtn) replicationCloseBtn.addEventListener('click', () => closeModal(replicationModal));
    if (exerciseGeneratorCloseBtn) exerciseGeneratorCloseBtn.addEventListener('click', () => closeModal(exerciseGeneratorModal));

    // Fecha ao clicar fora da caixa (no overlay escurecido)
    const allSeqModals = [exportModal, importModal, ribosomeModal, crisprModal, replicationModal, exerciseGeneratorModal];
    allSeqModals.forEach((modal) => {
      if (!modal) return;
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal(modal);
      });
    });

    // Seletor de elementos focáveis, para prender o Tab dentro do modal aberto (ver abaixo).
    const FOCUSABLE_IN_MODAL = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // Esc fecha só o modal que estiver aberto no momento; Tab/Shift+Tab ficam presos
    // dentro dele enquanto estiver aberto, para o foco do teclado não escapar para
    // a página por trás (WCAG 2.4.3 — ordem de foco / dialog pattern).
    document.addEventListener('keydown', (event) => {
      const activeModal = allSeqModals.find((modal) => modal && modal.style.display !== 'none');
      if (!activeModal) return;

      if (event.key === 'Escape') {
        closeModal(activeModal);
        return;
      }

      if (event.key === 'Tab') {
        const focusable = Array.from(activeModal.querySelectorAll(FOCUSABLE_IN_MODAL));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    // Controles de reprodução da animação do ribossomo
    const riboPlayBtn  = document.getElementById('ribo-play-pause');
    const riboResetBtn = document.getElementById('ribo-reset');
    if (riboPlayBtn) {
      riboPlayBtn.addEventListener('click', () => {
        if (ribosome.playing) pauseRibosome(); else playRibosome();
      });
    }
    if (riboResetBtn) riboResetBtn.addEventListener('click', resetRibosomeAnimation);

    // Controles de reprodução da animação de replicação do DNA
    const replPlayBtn  = document.getElementById('repl-play-pause');
    const replResetBtn = document.getElementById('repl-reset');
    if (replPlayBtn) {
      replPlayBtn.addEventListener('click', () => {
        if (replication.playing) pauseReplication(); else playReplication();
      });
    }
    if (replResetBtn) replResetBtn.addEventListener('click', resetReplicationAnimation);

    // Controle de Mutação (Genética Molecular) — botão único, liga/desliga
    // a edição livre da fita mutada (ver setMutationMode()).
    if (mutationButton) {
      mutationButton.addEventListener('click', () => {
        setMutationMode(!mutationButton.classList.contains('active'));
      });
    }

    // Controles do construtor de cruzamentos (Genética Mendeliana)
    const mendelModeMonoBtn = document.getElementById('mendel-mode-mono');
    const mendelModeDiBtn   = document.getElementById('mendel-mode-di');
    const mendelGenerateBtn = document.getElementById('mendel-generate-btn');
    const mendelG1Pattern   = document.getElementById('mendel-g1-pattern');
    const mendelG2Pattern   = document.getElementById('mendel-g2-pattern');
    if (mendelModeMonoBtn) mendelModeMonoBtn.addEventListener('click', function () { PS.setMendelMode('mono'); });
    if (mendelModeDiBtn)   mendelModeDiBtn.addEventListener('click', function () { PS.setMendelMode('di'); });
    if (mendelGenerateBtn) mendelGenerateBtn.addEventListener('click', PS.generateMendelCross);
    if (mendelG1Pattern)   mendelG1Pattern.addEventListener('change', () => updateMendelHetFieldVisibility(0));
    if (mendelG2Pattern)   mendelG2Pattern.addEventListener('change', () => updateMendelHetFieldVisibility(1));

    // Controles da ferramenta de Heredogramas
    const pedigreeModeStudyBtn = document.getElementById('pedigree-mode-study');
    const pedigreeModeQuizBtn  = document.getElementById('pedigree-mode-quiz');
    const pedigreeGenerateBtn  = document.getElementById('pedigree-generate-btn');
    const pedigreeQuizGenerateBtn = document.getElementById('pedigree-quiz-generate-btn');
    const pedigreeQuizAnswersWrap = document.getElementById('pedigree-quiz-answers');
if (pedigreeModeStudyBtn)     pedigreeModeStudyBtn.addEventListener('click', function () { PS.setPedigreeMode('study'); });
    if (pedigreeModeQuizBtn)      pedigreeModeQuizBtn.addEventListener('click', function () { PS.setPedigreeMode('quiz'); });
    if (pedigreeGenerateBtn)      pedigreeGenerateBtn.addEventListener('click', PS.generateStudyPedigree);
    if (pedigreeQuizGenerateBtn)  pedigreeQuizGenerateBtn.addEventListener('click', PS.generateQuizPedigree);
    if (pedigreeQuizAnswersWrap) {
      pedigreeQuizAnswersWrap.querySelectorAll('.crispr-pathway-card').forEach(function (btn) {
        btn.addEventListener('click', function () { PS.answerPedigreeQuiz(btn.dataset.answer); });
      });
    }

    // Controles da calculadora de Genética Populacional (Hardy-Weinberg)
    const popgenModeQsquaredBtn = document.getElementById('popgen-mode-qsquared');
    const popgenModePBtn        = document.getElementById('popgen-mode-p');
    const popgenModeTestBtn     = document.getElementById('popgen-mode-test');
    const popgenCalcQsquaredBtn = document.getElementById('popgen-calc-qsquared-btn');
    const popgenCalcPBtn        = document.getElementById('popgen-calc-p-btn');
    const popgenTestBtn         = document.getElementById('popgen-test-btn');
    if (popgenModeQsquaredBtn) popgenModeQsquaredBtn.addEventListener('click', function () { PS.setPopgenMode('qsquared'); });
    if (popgenModePBtn)        popgenModePBtn.addEventListener('click', function () { PS.setPopgenMode('p'); });
    if (popgenModeTestBtn)     popgenModeTestBtn.addEventListener('click', function () { PS.setPopgenMode('test'); });
    if (popgenCalcQsquaredBtn) popgenCalcQsquaredBtn.addEventListener('click', PS.calcPopgenFromQSquared);
    if (popgenCalcPBtn)        popgenCalcPBtn.addEventListener('click', PS.calcPopgenFromP);
    if (popgenTestBtn)         popgenTestBtn.addEventListener('click', PS.testPopgenEquilibrium);

    // Controles do Visualizador de Cariótipo e do Simulador de Não-disjunção
    const karyoViewBtn      = document.getElementById('karyo-view-btn');
    const nondisModeMiBtn   = document.getElementById('nondis-mode-mi');
    const nondisModeMiiBtn  = document.getElementById('nondis-mode-mii');
    const nondisSimulateBtn = document.getElementById('nondis-simulate-btn');
    if (karyoViewBtn)      karyoViewBtn.addEventListener('click', PS.viewSelectedKaryotype);
    if (nondisModeMiBtn)   nondisModeMiBtn.addEventListener('click', function () { PS.setNondisMode('MI'); });
    if (nondisModeMiiBtn)  nondisModeMiiBtn.addEventListener('click', function () { PS.setNondisMode('MII'); });
    if (nondisSimulateBtn) nondisSimulateBtn.addEventListener('click', PS.runNondisjunctionSimulation);

    // Exportação como PNG (Heredograma e Cariótipo)
    const pedigreeExportBtn = document.getElementById('pedigree-export-btn');
    const karyoExportBtn    = document.getElementById('karyo-export-btn');
    if (pedigreeExportBtn) {
      pedigreeExportBtn.addEventListener('click', () => {
        const svg = document.querySelector('#pedigree-svg-wrapper svg');
        if (!svg) {
          if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'info', title: 'Gere um heredograma primeiro para poder exportá-lo.' });
          }
          return;
        }
        (PS.exportNodeAsPng)(svg, 'heredograma.png');
      });
    }
    if (karyoExportBtn) {
      karyoExportBtn.addEventListener('click', () => {
        const grid = document.getElementById('karyo-grid');
        if (!grid || !grid.children.length) {
          if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'info', title: 'Visualize um cariótipo primeiro para poder exportá-lo.' });
          }
          return;
        }
        PS.exportNodeAsPng(grid, 'cariotipo.svg');
      });
    }

    // Controles do editor CRISPR-Cas9
    const crisprLoadDemoBtn    = document.getElementById('crispr-load-demo');
    const crisprSearchBtn      = document.getElementById('crispr-search-btn');
    const crisprPathwayNhejBtn = document.getElementById('crispr-pathway-nhej');
    const crisprPathwayHdrBtn  = document.getElementById('crispr-pathway-hdr');
    const crisprHdrGenerateBtn = document.getElementById('crispr-hdr-generate-btn');
    const crisprApplyBtn       = document.getElementById('crispr-apply-btn');
    if (crisprLoadDemoBtn)    crisprLoadDemoBtn.addEventListener('click', PS.loadCrisprDemoSequence);
    if (crisprSearchBtn)      crisprSearchBtn.addEventListener('click', PS.searchCrisprTarget);
    if (crisprPathwayNhejBtn) crisprPathwayNhejBtn.addEventListener('click', function () { PS.selectCrisprPathway('nhej'); });
    if (crisprPathwayHdrBtn)  crisprPathwayHdrBtn.addEventListener('click', function () { PS.selectCrisprPathway('hdr'); });
    if (crisprHdrGenerateBtn) crisprHdrGenerateBtn.addEventListener('click', PS.generateCrisprHdrPreview);
    if (crisprApplyBtn)       crisprApplyBtn.addEventListener('click', PS.applyCrisprEditToSimulator);

    if (exportCopySeqBtn) {
      exportCopySeqBtn.addEventListener('click', () =>
        PS.copyTextareaContent('export-seq-text', document.getElementById('export-feedback'), 'Sequência copiada!'));
    }
    if (exportCopyLinkBtn) {
      exportCopyLinkBtn.addEventListener('click', () =>
        PS.copyTextareaContent('export-seq-link', document.getElementById('export-feedback'), 'Link copiado!'));
    }
    if (exportImageBtn) {
      exportImageBtn.addEventListener('click', () => {
        const feedback = document.getElementById('export-feedback');
        const dnaSeq = readSequence(dnaSequenceChars);
        if (!dnaSeq) {
          if (feedback) {
            feedback.textContent = 'A sequência está vazia — insira bases no simulador antes de exportar.';
            feedback.classList.add('error');
          }
          return;
        }
        const panel = document.getElementById('main-sequence-panel');
        PS.exportNodeAsPng(panel, 'simulador-genetica.svg');
        if (feedback) {
          feedback.textContent = 'Imagem baixada!';
          feedback.classList.remove('error');
        }
      });
    }

    if (importLoadBtn) importLoadBtn.addEventListener('click', PS.handleImportSubmit);
    if (importSeqInput) {
      // Atalho Ctrl/Cmd+Enter para carregar sem precisar clicar no botão
      importSeqInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) PS.handleImportSubmit();
      });
    }

    // Botão de fechar o drawer
    const closeBtn = document.querySelector('.drawer-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    // Fecha o drawer ao sair com o mouse (a menos que esteja fixado por clique)
    if (drawer.panel) {
      drawer.panel.addEventListener('mouseleave', function () {
        if (!this.classList.contains('clicked-open')) {
          this.classList.remove('open');
        }
      });
    }

    // Tabela de códons — clique (ou Enter/Espaço, via teclado) insere as bases de DNA correspondentes no simulador
    // (insertCodonAndTranslate() é compartilhada com a Roda de Códons — ver definição perto de buildCodonTable()).
    function activateCodonItem() {
      const codon = this.getAttribute('data-codon');
      if (!codon) return;
      insertCodonAndTranslate(codon);
    }

    document.querySelectorAll('.codon-item').forEach(function (item) {
      item.addEventListener('click', activateCodonItem);
      // Os itens são focáveis (tabindex="0", role="button") para navegação por teclado;
      // Enter e Espaço replicam o comportamento de clique.
      item.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activateCodonItem.call(this);
        }
      });
    });

    // Restaura a preferência de "fita complementar" ANTES da sequência ser
    // renderizada pela 1ª vez (linha abaixo) — assim, se estava ligada, a
    // fita já nasce visível e preenchida, sem piscar entre estados.
    try {
      PS.applyComplementaryStrandVisibility(localStorage.getItem(SHOW_COMPLEMENTARY_STRAND_KEY) === '1');
    } catch (e) {
      // localStorage indisponível — fica no padrão (desligado).
    }

    // Carrega automaticamente uma sequência compartilhada via link (?seq=...), se presente;
    // senão, tenta restaurar a última sequência autosalva localmente (ver DNA_AUTOSAVE_KEY).
    // A URL tem prioridade — um link de desafio não deve ser ofuscado pelo autosave de uma
    // sessão anterior no mesmo navegador.
    if (!loadSequenceFromUrl()) restoreSequenceAutosave();
  });

  // Nenhuma exportação global é necessária: os cartões de doença e os botões de base
  // agora usam data-attributes + listeners delegados (ver bloco de vinculação de eventos
  // em DOMContentLoaded), em vez de onclick inline no HTML. O IIFE permanece 100% encapsulado.

  // ─── Exportação para módulos externos (exercises.js, quiz.js, etc.) ──────
  PS.showAlert = showAlert;
  PS.openModalDialog = openModalDialog;
  PS.generateRandomCodingDna = generateRandomCodingDna;
  PS.translateDnaHeadless = translateDnaHeadless;
  PS.shuffled = shuffled;

  // ─── Quiz ─────────────────────────────────────────────────────────────
  PS.quiz = quiz;
  PS.initQuizUI = initQuizUI;
  PS.startQuiz = startQuiz;
  PS.exitQuiz = exitQuiz;
  PS.endQuiz = endQuiz;
  PS.nextQuestion = nextQuestion;
  PS.submitQuizAnswer = submitQuizAnswer;
  PS.showQuestion = showQuestion;
  PS.renderPracticeStats = renderPracticeStats;
  PS.buildQuestionPool = buildQuestionPool;
  PS.showFeedback = showFeedback;

  // ─── Export / Import — código em assets/js/export.js ─────────────────
  PS.exportNodeAsPng = exportNodeAsPng;
  PS.downloadSvgBlob = downloadSvgBlob;
  PS.readSequence = readSequence;
  PS.sanitizeDnaInput = sanitizeDnaInput;
  PS.loadSequenceFromString = loadSequenceFromString;

  // ─── Estado do simulador molecular ───────────────────────────────────
  PS.dnaSequenceChars = dnaSequenceChars;
  PS.rnaSequenceChars = rnaSequenceChars;
  PS.textboxDna = textboxDna;
  PS.textboxRna = textboxRna;
  PS.outputAminoacids = outputAminoacids;
  PS.blankSpace = blankSpace;
  PS.complementContainers = complementContainers;
  PS.mutationButton = mutationButton;
  PS.mutationWindow = mutationWindow;
  PS.drawer = drawer;

  // ─── Registros adicionais para funções do simulador ──────────────────
  PS.showInfo = showInfo;
  PS.insertCodonAndTranslate = insertCodonAndTranslate;
  PS.applyComplementaryStrandVisibility = applyComplementaryStrandVisibility;
  PS.saveSequenceAutosave = saveSequenceAutosave;
  PS.clearSequenceAutosave = clearSequenceAutosave;
  PS.clearAllStrandsKeepingMode = clearAllStrandsKeepingMode;
  PS.fillStrand = fillStrand;

  // ─── CRISPR — código em assets/js/crispr.js ──────────────────────────

  // ─── Cariótipo — código em assets/js/karyotype.js ────────────────────

  // ─── PopGen — código em assets/js/popgen.js ─────────────────────────

  // ─── Mendel / Epistasia / ABO / Pedigree — código em assets/js/mendel.js ─

})();