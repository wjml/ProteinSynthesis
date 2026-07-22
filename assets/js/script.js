/**
 * script.js — Simulador de Síntese de Proteínas
 *
 * Refatorado para performance, clareza e manutenibilidade.
 * Todo o código está encapsulado em uma IIFE e nada é exposto no escopo global:
 * o HTML se comunica com este script via data-attributes (data-base, data-disease,
 * data-codon, data-abbrev) lidos por listeners delegados, não por onclick inline.
 */

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

  /** Mensagens de alerta por modo de mutação. */
  const MUTATION_ALERTS = {
    add:     'A mutação de adição somente permite inserção das letras que representam bases nitrogenadas do DNA: A, T, C e G.',
    delete:  'A mutação de deleção somente permite deletar bases nitrogenadas.\nUtilize a tecla Backspace ou a tecla Del!',
    replace: 'A mutação de substituição somente permite inserção das letras que representam bases nitrogenadas do DNA: A, T, C e G.',
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
  const addButton        = document.getElementById('add');
  const deleteButton     = document.getElementById('delete');
  const replaceButton    = document.getElementById('replace');
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

  /**
   * Gera `count` exercícios distintos — cada um uma sequência de DNA válida
   * de `numCodons` códons, já traduzida (ver translateDnaHeadless() acima).
   * "Distintos" na prática, não garantido matematicamente: com sequências de
   * 4+ códons aleatórios, a chance de colisão é desprezível pro tamanho de
   * turma que esse recurso é pensado pra atender (até ~40) — mas ainda
   * assim tenta algumas vezes antes de desistir e aceitar uma repetição, só
   * pra não travar em looping infinito num caso extremo (numCodons muito
   * pequeno).
   *
   * BUGFIX (sequência mais curta que o pedido): generateRandomCodingDna()
   * sorteia os códons do meio livremente, sem evitar que um deles caia por
   * acaso num padrão de parada (ATT/ATC/ACT em DNA) — ~4,7% de chance por
   * códon do meio. Pra uma sequência "Sequência aleatória" avulsa isso é
   * até interessante (mutação sem querer gerando parada precoce, cenário
   * biológico real), mas aqui a pessoa escolheu um tamanho específico
   * ("Longo, 11 códons") esperando um exercício daquele tamanho de verdade
   * — por isso essa função tenta de novo até a tradução render exatamente
   * numCodons-2 aminoácidos (o -2 é o INÍCIO e o STOP final, que não
   * contam como aminoácido).
   */
  function generateExerciseSet(count, numCodons) {
    // -1: desconta só o códon de PARADA final. O de início (TAC/AUG) conta
    // como aminoácido de verdade (Metionina) na proteína — só é "especial"
    // por sinalizar onde a leitura começa, não deixa de ser traduzido.
    const expectedAminoAcids = numCodons - 1;
    const seen = new Set();
    const exercises = [];
    for (let i = 0; i < count; i++) {
      let dnaSeq, translated;
      let attempts = 0;
      do {
        dnaSeq = generateRandomCodingDna(numCodons);
        translated = translateDnaHeadless(dnaSeq);
        attempts++;
      } while (
        (seen.has(dnaSeq) || translated.aminoAcids.length !== expectedAminoAcids)
        && attempts < 30
      );
      seen.add(dnaSeq);
      exercises.push(translated);
    }
    return exercises;
  }

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
  function newSequenceChar(value = '', className = 'sequenceChar', ariaLabel = 'Base da sequência') {
    const input = document.createElement('input');
    input.className = className;
    input.maxLength = 1;
    input.value = value.toUpperCase();
    input.setAttribute('aria-label', ariaLabel);
    // inputmode="none" pede pro navegador não abrir o teclado virtual ao focar este
    // campo — a ideia é que a pessoa monte a sequência clicando nos botões A/T/C/G
    // (ver insertBase()), não digitando num teclado na tela. Não afeta teclado físico/
    // bluetooth, nem os listeners de keypress/keydown abaixo, que continuam funcionando
    // normalmente para quem realmente quiser digitar (ex.: no desktop).
    input.setAttribute('inputmode', 'none');
    input.addEventListener('keypress', charInput);
    input.addEventListener('keydown', actsLikeUniqueInput);
    return input;
  }

  /**
   * Move o foco para `el` sem deixar o navegador abrir o teclado virtual —
   * usado nos pontos em que o foco é só "lembrete de posição" após um clique em
   * botão (inserir base, carregar exemplo, sequência aleatória etc.), não uma
   * intenção real de digitar. inputmode="none" (ver newSequenceChar()) já resolve
   * a maioria dos casos, mas alguns navegadores (principalmente versões mais
   * antigas do Safari iOS) ainda abrem o teclado num focus() disparado por script,
   * ignorando o inputmode. Marcar o campo como readonly no instante do focus() é o
   * truque clássico e mais confiável pra evitar isso — o teclado só aparece quando o
   * SO decide mostrá-lo no momento do foco, então removê-lo logo em seguida não
   * reabre nada.
   */
  function focusWithoutKeyboard(el) {
    if (!el) return;
    el.setAttribute('readonly', 'readonly');
    el.focus({ preventScroll: true });
    setTimeout(() => el.removeAttribute('readonly'), 100);
  }

  /** Cria e retorna um elemento de aminoácido completo com rótulos e event listeners. */
  function newAminoacid(aminoacid = { name: '', abbrevName: '' }) {
    const div = document.createElement('div');
    // Codificação por cor química: cada cartão real (não os placeholders vazios)
    // recebe a classe de categoria físico-química do aminoácido (base-apolar/
    // base-polar/base-basic/base-acid), que estiliza a faixa colorida no topo
    // do cartão — ver .aminoacid::before em app.css.
    const categoryClass = aminoacid.abbrevName ? aminoacidCategoryClass(aminoacid.abbrevName) : '';
    div.className = aminoacid.name
      ? 'aminoacid ' + aminoacid.name + (categoryClass ? ' ' + categoryClass : '')
      : 'aminoacid not-availlable';

    const abbrevEl = document.createElement('div');
    abbrevEl.className = 'abbreviated-name';
    abbrevEl.innerHTML = aminoacid.abbrevName;

    const moleculeEl = document.createElement('div');
    moleculeEl.className = 'molecule';
    if (aminoacid.abbrevName) {
      moleculeEl.style.backgroundImage = `url('assets/images/aminoacids/${aminoacid.abbrevName}.png')`;
    }

    const nameEl = document.createElement('div');
    nameEl.className = 'full-name';
    nameEl.innerHTML = aminoacid.name;

    div.appendChild(abbrevEl);
    div.appendChild(moleculeEl);
    div.appendChild(nameEl);

    // Interações do drawer apenas para aminoácidos reais (não para placeholders vazios).
    // PERFORMANCE + A11Y: nenhum listener é registrado aqui — cada tecla digitada recriaria
    // 3 listeners por aminoácido. Em vez disso, expomos `data-abbrev` + atributos de teclado/ARIA
    // e um único par de listeners delegados no container (ver bindAminoacidOutputEvents(),
    // registrado uma única vez em DOMContentLoaded) cuida de clique, hover e teclado para
    // todos os aminoácidos presentes e futuros.
    if (aminoacid.abbrevName) {
      div.style.cursor = 'pointer';
      div.dataset.abbrev = aminoacid.abbrevName;
      div.tabIndex = 0;
      div.setAttribute('role', 'button');
      div.setAttribute('aria-label', `Ver detalhes do aminoácido ${aminoacid.name}`);
    }

    return div;
  }

  // ─── Tabela de códons (gerada dinamicamente) ─────────────────────────────────

  /**
   * Mapeia o tipo químico de um aminoácido (AMINOACIDS_DB) para a classe CSS
   * de cor compartilhada por TODO o app: tabela de códons, roda de códons,
   * cartões de aminoácido (newAminoacid()) e o selo do drawer de detalhes —
   * uma única taxonomia visual (ver os blocos .base-apolar/.base-polar/
   * .base-basic/.base-acid em pages.css) em vez de cada componente decidir
   * suas próprias cores.
   */
  function aminoacidCategoryClass(abbrevName) {
    const data = AMINOACIDS_DB[abbrevName];
    const type = (data && data.type) || '';
    if (type.includes('Ácido'))  return 'base-acid';
    if (type.includes('Básico')) return 'base-basic';
    if (type.includes('Apolar')) return 'base-apolar';
    return 'base-polar';
  }

  /** Mapeia o tipo químico do aminoácido (AMINOACIDS_DB) para a classe CSS de cor da célula, incluindo STOP. */
  function codonCellClass(abbrevName) {
    if (abbrevName === 'STOP') return 'codon-stop';
    return aminoacidCategoryClass(abbrevName);
  }

  /** Formata o nome abreviado do aminoácido para exibição (ex: 'PHE' → 'Phe'; 'STOP' permanece 'STOP'). */
  function codonDisplayName(abbrevName) {
    if (abbrevName === 'STOP') return 'STOP';
    return abbrevName.charAt(0) + abbrevName.slice(1).toLowerCase();
  }

  /**
   * Gera a tabela de 64 códons (#codon-matrix-body) inteiramente a partir de
   * CODON_TABLE e AMINOACIDS_DB, que já são a fonte de verdade usada pelo
   * simulador para tradução.
   *
   * REFATORAÇÃO: antes, essa tabela existia duplicada como ~250 linhas de HTML
   * estático em index.html, mantidas manualmente em sincronia com CODON_TABLE.
   * Qualquer correção feita em um lugar e esquecida no outro fazia a tabela
   * visual divergir silenciosamente da lógica real de tradução. Agora há uma
   * única fonte de dados.
   */
  function buildCodonTable() {
    const tbody = document.getElementById('codon-matrix-body');
    if (!tbody) return;

    const BASES = ['U', 'C', 'A', 'G'];
    tbody.innerHTML = '';

    for (const first of BASES) {
      const tr = document.createElement('tr');

      const firstCell = document.createElement('td');
      firstCell.className = 'first-base-cell';
      firstCell.textContent = first;
      tr.appendChild(firstCell);

      for (const second of BASES) {
        const td = document.createElement('td');
        const group = document.createElement('div');
        group.className = 'codon-cell-group';

        for (const third of BASES) {
          const codon = first + second + third;
          const aminoacid = CODON_TABLE[codon];
          if (!aminoacid) continue;

          const item = document.createElement('div');
          item.className = 'codon-item ' + codonCellClass(aminoacid.abbrevName);
          item.setAttribute('data-codon', codon);
          item.setAttribute('role', 'button');
          item.setAttribute('tabindex', '0');
          item.setAttribute('aria-label',
            `Códon ${codon}, ${aminoacid.name}. Clique para inserir no simulador.`);

          const nameSpan = document.createElement('span');
          nameSpan.className = 'codon-name';
          nameSpan.textContent = codon;

          const aaSpan = document.createElement('span');
          aaSpan.className = 'codon-aa';
          aaSpan.textContent = codonDisplayName(aminoacid.abbrevName);

          item.appendChild(nameSpan);
          item.appendChild(document.createTextNode(' '));
          item.appendChild(aaSpan);
          group.appendChild(item);
        }

        td.appendChild(group);
        tr.appendChild(td);
      }

      // Coluna de legenda da 3ª base — uma por linha, igual ao layout original
      const thirdBaseCell = document.createElement('td');
      const list = document.createElement('div');
      list.className = 'third-base-list';
      for (const b of BASES) {
        const div = document.createElement('div');
        div.textContent = b;
        list.appendChild(div);
      }
      thirdBaseCell.appendChild(list);
      tr.appendChild(thirdBaseCell);

      tbody.appendChild(tr);
    }
  }

  /**
   * Insere as 3 bases de DNA correspondentes a um códon de RNAm no simulador
   * e força uma nova tradução — lógica compartilhada entre o clique na
   * tabela de códons (activateCodonItem(), abaixo) e o clique num códon
   * completo na Roda de Códons (handleWheelSegmentActivate()).
   */
  function insertCodonAndTranslate(codon) {
    // Converte bases do mRNA para DNA molde: A→T, U→A, C→G, G→C
    const dnaBases = codon.split('').map(b => RNA_BASE_TO_DNA[b] || b).join('');

    const appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();

    // A Roda de Códons abre o drawer de detalhes ao completar um códon (ver
    // handleWheelSegmentActivate()); como acabamos de navegar para a página
    // do simulador, o drawer — inclusive seu estado "fixado por clique" —
    // precisa ser fechado aqui, senão ele fica visível por cima da página
    // errada até o usuário passar o mouse por fora dele.
    closeDrawer();

    // PERFORMANCE: insere as 3 bases sem re-renderizar a cada uma (skipRender),
    // e dispara translate()/treatSequence() uma única vez ao final.
    for (const base of dnaBases) insertBase(base, { skipRender: true });
    translate();
    treatSequence();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Visualizador Dinâmico da Roda de Códons (Codon Wheel)
  // ═══════════════════════════════════════════════════════════════════════
  // Substitui a tabela estática como visão PADRÃO da aba "Roda de Códons"
  // (a tabela em grade continua disponível via o alternador Roda/Tabela, ver
  // HTML). Um SVG de 3 anéis + miolo, gerado 100% a partir de CODON_TABLE/
  // AMINOACIDS_DB (mesma fonte de verdade da tabela) — nunca hardcoded, então
  // as duas visões nunca podem divergir. Interação: cada anel representa uma
  // posição do tripleto (1ª/2ª/3ª base); o aminoácido correspondente vai
  // sendo destacado progressivamente à medida que cada base é escolhida, e o
  // 3º clique (ou um clique direto no anel externo) completa o códon, insere
  // no simulador e abre o drawer de detalhes — mesma ação da tabela.

  const codonWheelState = { first: null, second: null, third: null };

  /** Converte coordenadas polares (ângulo em graus, 0° = topo, sentido horário) em cartesianas. */
  function wheelPolarToCartesian(cx, cy, r, angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  /** Gera o "d" de um path SVG para um setor anular (anel parcial) entre dois raios e dois ângulos. */
  function wheelSectorPath(cx, cy, rInner, rOuter, startAngle, endAngle) {
    const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
    const p1 = wheelPolarToCartesian(cx, cy, rOuter, startAngle);
    const p2 = wheelPolarToCartesian(cx, cy, rOuter, endAngle);
    const p3 = wheelPolarToCartesian(cx, cy, rInner, endAngle);
    const p4 = wheelPolarToCartesian(cx, cy, rInner, startAngle);
    return [
      `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
      `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
      'Z',
    ].join(' ');
  }

  /** transform="translate(...) rotate(...)" para um rótulo radial que permanece sempre legível (nunca de cabeça pra baixo). */
  function wheelLabelTransform(cx, cy, r, midAngle) {
    const pos = wheelPolarToCartesian(cx, cy, r, midAngle);
    const normalized = ((midAngle % 360) + 360) % 360;
    const rotation = (normalized > 90 && normalized < 270) ? midAngle + 180 : midAngle;
    return `translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)}) rotate(${rotation.toFixed(2)})`;
  }

  /** Constrói o SVG da roda de códons inteiro a partir de CODON_TABLE, uma única vez. */
  function buildCodonWheel() {
    const wrapper = document.getElementById('codon-wheel-svg-wrapper');
    if (!wrapper) return;

    const BASES = ['U', 'C', 'A', 'G'];
    const cx = 300, cy = 300;
    const r0 = 34, r1 = 108, r2 = 175, r3 = 235, r4 = 288;

    let svg = '<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" role="img" ' +
      'aria-label="Roda de códons interativa: escolha a 1ª, depois a 2ª e a 3ª base do RNAm ' +
      'para descobrir o aminoácido correspondente" class="codon-wheel-svg">';

    // Anel 1 — 1ª base (4 setores de 90°)
    BASES.forEach((first, i) => {
      const start = i * 90, end = start + 90, mid = start + 45;
      const d  = wheelSectorPath(cx, cy, r0, r1, start, end);
      const lp = wheelPolarToCartesian(cx, cy, (r0 + r1) / 2, mid);
      svg += `<g class="codon-wheel-segment codon-wheel-ring1 codon-wheel-nt-${first}" ` +
        `data-wheel-ring="1" data-first="${first}" tabindex="0" role="button" ` +
        `aria-label="1ª base do códon: ${first}">` +
        `<path d="${d}"/>` +
        `<text x="${lp.x.toFixed(1)}" y="${lp.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${first}</text>` +
        `</g>`;
    });

    // Anel 2 — 2ª base (16 setores de 22.5°)
    BASES.forEach((first, i) => {
      BASES.forEach((second, j) => {
        const start = i * 90 + j * 22.5, end = start + 22.5, mid = start + 11.25;
        const d  = wheelSectorPath(cx, cy, r1, r2, start, end);
        const lp = wheelPolarToCartesian(cx, cy, (r1 + r2) / 2, mid);
        svg += `<g class="codon-wheel-segment codon-wheel-ring2 codon-wheel-nt-${second}" ` +
          `data-wheel-ring="2" data-first="${first}" data-second="${second}" tabindex="0" role="button" ` +
          `aria-label="2ª base do códon: ${second}, com 1ª base ${first}">` +
          `<path d="${d}"/>` +
          `<text x="${lp.x.toFixed(1)}" y="${lp.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${second}</text>` +
          `</g>`;
      });
    });

    // Anel 3 — 3ª base + aminoácido (até 64 setores de 5.625°), colorido pela
    // mesma taxonomia química da tabela/cartões (ver codonCellClass()).
    BASES.forEach((first, i) => {
      BASES.forEach((second, j) => {
        BASES.forEach((third, k) => {
          const codon     = first + second + third;
          const aminoacid = CODON_TABLE[codon];
          if (!aminoacid) return;

          const start = i * 90 + j * 22.5 + k * 5.625, end = start + 5.625, mid = start + 2.8125;
          const d = wheelSectorPath(cx, cy, r2, r3, start, end);
          const labelTransform  = wheelLabelTransform(cx, cy, (r3 + r4) / 2, mid);
          const categoryClass  = codonCellClass(aminoacid.abbrevName);
          const label = aminoacid.abbrevName === 'STOP' ? '■' : aminoacid.abbrevName;
          // Letrinha da 3ª base (U/C/A/G), no centro da própria faixa do anel 3
          // (r2–r3) — mesmo padrão de "letra no centro da faixa" dos anéis 1 e 2.
          // Fica com opacity:0 por padrão (ver CSS) e só aparece quando o
          // segmento está em foco (não .dimmed), pedido do usuário: ajuda a
          // enxergar de cara qual 3ª base cada fatia representa assim que ela
          // deixa de estar apagada, sem poluir a roda inteira com 64 letrinhas
          // de uma vez.
          const baseLabelPos = wheelPolarToCartesian(cx, cy, (r2 + r3) / 2, mid);

          svg += `<g class="codon-wheel-segment codon-wheel-ring3 ${categoryClass}" ` +
            `data-wheel-ring="3" data-codon="${codon}" data-abbrev="${aminoacid.abbrevName}" ` +
            `tabindex="0" role="button" ` +
            `aria-label="Códon ${codon}: ${aminoacid.name}. Clique para inserir no simulador.">` +
            `<path d="${d}"/>` +
            `<text x="${baseLabelPos.x.toFixed(1)}" y="${baseLabelPos.y.toFixed(1)}" text-anchor="middle" ` +
            `dominant-baseline="middle" class="codon-wheel-ring3-base-label">${third}</text>` +
            `<text transform="${labelTransform}" text-anchor="middle" dominant-baseline="middle" ` +
            `class="codon-wheel-ring3-label">${label}</text>` +
            `</g>`;
        });
      });
    });

    // Miolo central — mostra o tripleto sendo montado ("_ _ _" → "A U G") e o resultado
    svg += `<circle cx="${cx}" cy="${cy}" r="${r0}" class="codon-wheel-hub"/>` +
      `<text x="${cx}" y="${cy - 6}" text-anchor="middle" dominant-baseline="middle" ` +
      `class="codon-wheel-hub-codon" id="codon-wheel-hub-codon">_ _ _</text>` +
      `<text x="${cx}" y="${cy + 15}" text-anchor="middle" dominant-baseline="middle" ` +
      `class="codon-wheel-hub-hint" id="codon-wheel-hub-hint">Toque numa base</text>`;

    svg += '</svg>';
    wrapper.innerHTML = svg;
    renderCodonWheelState();
  }

  /** Aplica o estado atual (codonWheelState) como classes visuais (dimmed/wheel-selected/wheel-completed) e atualiza o miolo. */
  function renderCodonWheelState() {
    const wrapper = document.getElementById('codon-wheel-svg-wrapper');
    if (!wrapper) return;
    const { first, second, third } = codonWheelState;

    wrapper.querySelectorAll('.codon-wheel-ring1').forEach((el) => {
      const f = el.getAttribute('data-first');
      el.classList.toggle('dimmed', !!first && f !== first);
      el.classList.toggle('wheel-selected', !!first && f === first);
    });

    wrapper.querySelectorAll('.codon-wheel-ring2').forEach((el) => {
      const f = el.getAttribute('data-first');
      const s = el.getAttribute('data-second');
      const matchesFirst = !first || f === first;
      const isSelected = !!(first && second) && f === first && s === second;
      el.classList.toggle('dimmed', !matchesFirst || (!!second && !isSelected));
      el.classList.toggle('wheel-selected', isSelected);
    });

    wrapper.querySelectorAll('.codon-wheel-ring3').forEach((el) => {
      const codon = el.getAttribute('data-codon');
      const f = codon.charAt(0), s = codon.charAt(1), t = codon.charAt(2);
      const matchesFirst  = !first  || f === first;
      const matchesSecond = !second || s === second;
      const isComplete = !!(first && second && third) && f === first && s === second && t === third;
      el.classList.toggle('dimmed', !matchesFirst || !matchesSecond);
      el.classList.toggle('wheel-completed', isComplete);
    });

    const hubCodon = document.getElementById('codon-wheel-hub-codon');
    const hubHint  = document.getElementById('codon-wheel-hub-hint');
    const status   = document.getElementById('codon-wheel-status');
    if (hubCodon) hubCodon.textContent = `${first || '_'} ${second || '_'} ${third || '_'}`;

    let hintText = 'Toque numa base';
    if (first && second && third) {
      const aminoacid = CODON_TABLE[first + second + third];
      hintText = aminoacid ? aminoacid.name : '';
    } else if (first && second) {
      hintText = 'Escolha a 3ª base';
    } else if (first) {
      hintText = 'Escolha a 2ª base';
    }
    if (hubHint) hubHint.textContent = hintText;
    if (status)  status.textContent = hintText;

    const sendBtn = document.getElementById('codon-wheel-send-btn');
    if (sendBtn) sendBtn.disabled = !(first && second && third);
  }

  /** Aplica a seleção de um segmento clicado/ativado ao estado da roda; um anel 3 completo insere o códon no simulador. */
  function handleWheelSegmentActivate(el) {
    const ring = el.getAttribute('data-wheel-ring');

    if (ring === '1') {
      codonWheelState.first  = el.getAttribute('data-first');
      codonWheelState.second = null;
      codonWheelState.third  = null;
    } else if (ring === '2') {
      codonWheelState.first  = el.getAttribute('data-first');
      codonWheelState.second = el.getAttribute('data-second');
      codonWheelState.third  = null;
    } else if (ring === '3') {
      const codon = el.getAttribute('data-codon');
      codonWheelState.first  = codon.charAt(0);
      codonWheelState.second = codon.charAt(1);
      codonWheelState.third  = codon.charAt(2);
    } else {
      return;
    }

    renderCodonWheelState();

    if (ring === '3') {
      // Antes o clique no anel 3 já inseria o códon e navegava direto pro
      // simulador. Agora ele só "estaciona" o códon completo (mostra o
      // preview no drawer) — quem efetivamente insere é o botão #codon-
      // wheel-send-btn (ver sendCodonWheelSelection()), pra dar chance da
      // pessoa conferir o aminoácido antes de mandar pro simulador.
      const abbrev = el.getAttribute('data-abbrev');
      openAminoacidDrawer(abbrev, true);
    }
  }

  /** Insere no simulador o códon atualmente "estacionado" na roda (botão "Enviar para o simulador") e limpa a seleção. */
  function sendCodonWheelSelection() {
    const { first, second, third } = codonWheelState;
    if (!first || !second || !third) return;
    insertCodonAndTranslate(first + second + third);
    resetCodonWheel();
  }

  /** Limpa a seleção da roda de volta para "_ _ _". */
  function resetCodonWheel() {
    codonWheelState.first  = null;
    codonWheelState.second = null;
    codonWheelState.third  = null;
    renderCodonWheelState();
  }

  /** Vincula os listeners delegados da roda (1 clique + 1 mouseover, em vez de um por segmento) e o alternador Roda/Tabela. */
  function initCodonWheelInteractions() {
    const wrapper = document.getElementById('codon-wheel-svg-wrapper');
    if (wrapper) {
      wrapper.addEventListener('click', (event) => {
        const el = event.target.closest('[data-wheel-ring]');
        if (el) handleWheelSegmentActivate(el);
      });

      wrapper.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const el = event.target.closest('[data-wheel-ring]');
        if (!el) return;
        event.preventDefault();
        handleWheelSegmentActivate(el);
      });

      // Preview no drawer ao passar o mouse por um códon completo (anel 3), igual ao hover nos cartões de saída
      wrapper.addEventListener('mouseover', (event) => {
        const el = event.target.closest('.codon-wheel-ring3[data-abbrev]');
        if (el) openAminoacidDrawer(el.getAttribute('data-abbrev'), false);
      });
    }

    const resetBtn = document.getElementById('codon-wheel-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetCodonWheel);

    const sendBtn = document.getElementById('codon-wheel-send-btn');
    if (sendBtn) sendBtn.addEventListener('click', sendCodonWheelSelection);

    // Alternador "Roda" / "Tabela" dentro da mesma aba de referência
    const viewToggleButtons = document.querySelectorAll('.codon-view-toggle-btn');
    viewToggleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        viewToggleButtons.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        const target     = btn.getAttribute('data-view-target');
        const wheelView   = document.getElementById('codon-wheel-view');
        const tableView   = document.getElementById('codon-table-view');
        if (wheelView) wheelView.hidden = target !== 'wheel';
        if (tableView) tableView.hidden = target !== 'table';
      });
    });
  }

  // ─── Drawer de detalhes do aminoácido ────────────────────────────────────────

  /** Preenche e abre o drawer lateral com os dados do aminoácido. */
  function openAminoacidDrawer(abbrev, isClick = false) {
    const data = AMINOACIDS_DB[abbrev];
    if (!data || !drawer.panel) return;

    drawer.title.textContent   = data.name;
    drawer.abbrevs.textContent = data.abbrevs;
    drawer.codons.textContent  = data.codons;
    if (drawer.type) {
      drawer.type.textContent = data.type || 'N/A';
      // Selo colorido pela mesma taxonomia química da tabela/roda de códons
      // e dos cartões (ver aminoacidCategoryClass()) — codon de parada (STOP)
      // usa a cor "codon-stop" em vez de uma categoria físico-química real.
      const categoryClass = abbrev === 'STOP' ? 'codon-stop' : aminoacidCategoryClass(abbrev);
      drawer.type.className = 'info-value drawer-type-badge ' + categoryClass;
    }
    if (drawer.func) drawer.func.textContent = data.func;
    if (drawer.img)  drawer.img.style.backgroundImage = `url('assets/images/aminoacids/${abbrev}.png')`;

    drawer.panel.classList.add('open');
    if (isClick) drawer.panel.classList.add('clicked-open');
  }

  /** Fecha o drawer e remove o estado de "fixado por clique". */
  function closeDrawer() {
    if (!drawer.panel) return;
    drawer.panel.classList.remove('open', 'clicked-open');
  }

  /**
   * Registra, uma única vez por container de saída (#output-aminoacids),
   * os listeners delegados que substituem os 3 listeners por elemento
   * que antes eram recriados a cada tecla digitada (ver newAminoacid()).
   *
   * click/keydown (Enter/Espaço) → abre o drawer "fixado".
   * mouseover/mouseout           → abre/fecha o drawer em preview (hover),
   *                                 usando `closest('[data-abbrev]')` para
   *                                 emular o comportamento de mouseenter/mouseleave
   *                                 (que não fazem bubbling) via delegação.
   */
  function bindAminoacidOutputEvents(container) {
    if (!container) return;

    container.addEventListener('click', (event) => {
      const el = event.target.closest('[data-abbrev]');
      if (el) openAminoacidDrawer(el.dataset.abbrev, true);
    });

    container.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const el = event.target.closest('[data-abbrev]');
      if (!el) return;
      event.preventDefault();
      openAminoacidDrawer(el.dataset.abbrev, true);
    });

    container.addEventListener('mouseover', (event) => {
      const el = event.target.closest('[data-abbrev]');
      if (el) openAminoacidDrawer(el.dataset.abbrev, false);
    });

    container.addEventListener('mouseout', (event) => {
      const el = event.target.closest('[data-abbrev]');
      if (!el || !drawer.panel) return;
      const toEl = event.relatedTarget;
      // Mantém o preview se o mouse ainda está sobre o mesmo aminoácido,
      // ou se foi para dentro do próprio drawer.
      if (toEl && (el.contains(toEl) || drawer.panel.contains(toEl) || toEl === drawer.panel)) return;
      if (!drawer.panel.classList.contains('clicked-open')) {
        drawer.panel.classList.remove('open');
      }
    });
  }

  // ─── Sincronização de scroll ──────────────────────────────────────────────────

  let _scrollLock = false;

  /** Sincroniza o scroll horizontal de todas as linhas (DNA, RNA, aminoácidos, fita complementar). */
  function scrollUnique() {
    if (_scrollLock) return;
    _scrollLock = true;
    const sl = this.scrollLeft;
    for (let i = 0; i < textboxDna.length; i++) {
      textboxDna[i].scrollLeft       = sl;
      textboxRna[i].scrollLeft       = sl;
      outputAminoacids[i].scrollLeft = sl;
      if (complementContainers[i]) complementContainers[i].scrollLeft = sl;
    }
    _scrollLock = false;
  }

  // ─── Ativação do input DNA ───────────────────────────────────────────────────

  /**
   * Cria o primeiro input de DNA se não existir nenhum,
   * ou foca no último existente. Compartilhado entre clique no blank-space
   * e clique na área vazia do container textbox-dna.
   */
  function activateDnaInput() {
    if (dnaSequenceChars.length === 0) {
      const dnaInput = newSequenceChar('', 'sequenceChar', 'Base de DNA');
      const rnaInput = newSequenceChar('', 'sequenceChar', 'Base de RNA mensageiro');
      textboxDna[0].insertBefore(dnaInput, blankSpace);
      textboxRna[0].appendChild(rnaInput);
      dnaInput.focus();
    } else {
      const last = dnaSequenceChars[dnaSequenceChars.length - 1];
      last.focus();
      last.selectionStart = 1;
    }
  }

  // ─── Handlers de teclado ─────────────────────────────────────────────────────

  /** Trata a entrada de caracteres em um sequenceChar (evento keypress). */
  function charInput(event) {
    event.preventDefault();
    const key = event.key.toUpperCase();
    if (key === 'CAPSLOCK' || !VALID_BASES.has(key)) return;

    const rnaEl = getRnaEquivalent(this);

    if (this.selectionStart === 0) {
      // Inserir antes da posição atual
      const newDna = newSequenceChar(key, 'sequenceChar', 'Base de DNA');
      const newRna = newSequenceChar(transcribe(key), 'sequenceChar', 'Base de RNA mensageiro');
      textboxDna[0].insertBefore(newDna, this);
      textboxRna[0].insertBefore(newRna, rnaEl);
      newDna.focus();

      // Remove o input atual se vazio ou em modo substituição
      if (this.value === '' || replaceButton.classList.contains('active')) {
        textboxDna[0].removeChild(this);
        textboxRna[0].removeChild(rnaEl);
      }
    } else {
      // Inserir após a posição atual
      if (replaceButton.classList.contains('active')) {
        const nextDna = this.nextElementSibling;
        const nextRna = rnaEl ? rnaEl.nextElementSibling : null;
        if (nextDna && nextDna.value !== '') {
          textboxDna[0].removeChild(nextDna);
          if (nextRna) textboxRna[0].removeChild(nextRna);
          const newDna = newSequenceChar(key, 'sequenceChar', 'Base de DNA');
          const newRna = newSequenceChar(transcribe(key), 'sequenceChar', 'Base de RNA mensageiro');
          textboxDna[0].insertBefore(newDna, this.nextElementSibling);
          textboxRna[0].insertBefore(newRna, rnaEl ? rnaEl.nextElementSibling : null);
          newDna.focus();
        }
      } else {
        const newDna = newSequenceChar(key, 'sequenceChar', 'Base de DNA');
        const newRna = newSequenceChar(transcribe(key), 'sequenceChar', 'Base de RNA mensageiro');
        textboxDna[0].insertBefore(newDna, this.nextElementSibling);
        textboxRna[0].insertBefore(newRna, rnaEl ? rnaEl.nextElementSibling : null);
        newDna.focus();
      }
    }

    translate();
    treatSequence();
  }

  /** Trata teclas de navegação e deleção em um sequenceChar (evento keydown). */
  function actsLikeUniqueInput(event) {
    const rnaEl = getRnaEquivalent(this);

    // Determina teclas permitidas e mensagem de alerta conforme o modo ativo
    let allowedKeys;
    let alertMsg;

    if (addButton.classList.contains('active')) {
      allowedKeys = new Set(['CAPSLOCK', 'A', 'T', 'C', 'G', 'ARROWLEFT', 'ARROWRIGHT']);
      alertMsg = MUTATION_ALERTS.add;
    } else if (deleteButton.classList.contains('active')) {
      allowedKeys = new Set(['CAPSLOCK', 'BACKSPACE', 'DELETE', 'ARROWLEFT', 'ARROWRIGHT']);
      alertMsg = MUTATION_ALERTS.delete;
    } else if (replaceButton.classList.contains('active')) {
      allowedKeys = new Set(['CAPSLOCK', 'A', 'T', 'C', 'G', 'ARROWLEFT', 'ARROWRIGHT']);
      alertMsg = MUTATION_ALERTS.replace;
    } else {
      allowedKeys = new Set(['CAPSLOCK', 'A', 'T', 'C', 'G', 'BACKSPACE', 'DELETE']);
      alertMsg = MUTATION_ALERTS.default;
    }

    if (!allowedKeys.has(event.key.toUpperCase())) {
      showAlert('Inserção não permitida!', alertMsg);
      event.preventDefault();
      return;
    }

    switch (event.code) {
      case 'Backspace':
        event.preventDefault();
        if (this.selectionStart === 0) {
          try {
            textboxDna[0].removeChild(this.previousElementSibling);
            textboxRna[0].removeChild(rnaEl.previousElementSibling);
          } catch (e) { console.log('Início da sequência atingido.'); }
        } else {
          try {
            this.previousElementSibling.focus();
            textboxDna[0].removeChild(this);
            textboxRna[0].removeChild(rnaEl);
          } catch (e) {
            textboxDna[0].removeChild(this);
            textboxRna[0].removeChild(rnaEl);
          }
        }
        break;

      case 'Delete':
        if (this.selectionStart === 0) {
          event.preventDefault();
          try {
            this.nextElementSibling.focus();
            this.nextElementSibling.selectionStart = 0;
            textboxDna[0].removeChild(this);
            textboxRna[0].removeChild(rnaEl);
          } catch (e) { console.log('Sem elemento à frente.'); }
        } else {
          try {
            textboxDna[0].removeChild(this.nextElementSibling);
            textboxRna[0].removeChild(rnaEl.nextElementSibling);
          } catch (e) { console.log('Sem elemento à frente.'); }
        }
        break;

      case 'ArrowLeft':
        if (this.selectionStart === 0) {
          try { this.previousElementSibling.focus(); }
          catch (e) { /* início da sequência */ }
        }
        break;

      case 'ArrowRight':
        if (this.selectionStart === 1) {
          try { this.nextElementSibling.focus(); }
          catch (e) { /* fim da sequência */ }
        }
        break;

      default:
        return;
    }

    translate();
    treatSequence();
  }

  // ─── Processamento de sequência ───────────────────────────────────────────────

  /**
   * Aplica as classes CSS de cor e posição de códon nas quatro linhas de sequência
   * (DNA/RNA principal + DNA/RNA do painel de mutação).
   *
   * BUGFIX (alinhamento aminoácido × códon): isolada de treatSequence() porque
   * translateStrand() precisa dessas classes JÁ aplicadas antes de medir
   * offsetLeft (o .codon-utr-end tem margin-right:8px que desloca a posição
   * de todo mundo depois da UTR). Antes, todo call site fazia
   * `translate(); treatSequence();` nessa ordem — ou seja, translateStrand()
   * sempre lia o offsetLeft com as classes ainda da tecla ANTERIOR, um passo
   * atrasado. Isso só não quebrava por acaso quando o comprimento da UTR não
   * mudava de uma tecla pra outra; ao digitar algo como "AATACGGG", no
   * instante em que o AUG se completa o quadro de leitura muda e o spacer
   * fica com a largura errada — o aminoácido sai desalinhado do códon.
   * Ver a chamada em translate() logo abaixo.
   */
  function syncFrameClasses() {
    // Cada par DNA/RNA (o do simulador principal e o do painel de mutação) tem
    // seu próprio quadro de leitura — achado uma vez a partir da fita de RNA
    // daquele par, e reaproveitado tanto pra fita de DNA quanto pra fita de RNA
    // (mesma posição, mesma correspondência base a base).
    const mainFrameStart = findFirstStartIndex(readSequence(rnaSequenceChars));
    applyCodonClasses(dnaSequenceChars, mainFrameStart);
    applyCodonClasses(rnaSequenceChars, mainFrameStart);
    renderComplementaryStrand(dnaSequenceChars, complementContainers[0], mainFrameStart);

    const mutRnaChars   = textboxRna[1].getElementsByClassName('sequenceChar');
    const mutDnaChars   = textboxDna[1].getElementsByClassName('sequenceChar');
    const mutFrameStart = findFirstStartIndex(readSequence(mutRnaChars));
    applyCodonClasses(mutDnaChars, mutFrameStart);
    applyCodonClasses(mutRnaChars, mutFrameStart);
    renderComplementaryStrand(mutDnaChars, complementContainers[1], mutFrameStart);
  }

  /**
   * Garante as classes de códon em dia (syncFrameClasses) e então dispara a
   * análise de mutação e a injeção de rótulos de códon. Chamada depois de
   * translate() em todo call site — mutationDifference() lê os cards de
   * aminoácido que só existem depois que translateStrand() rodou.
   */
  function treatSequence() {
    syncFrameClasses();
    mutationDifference();
    updateCodonLabels();
    saveSequenceAutosave();
  }

  /**
   * Injeta rótulos pill ("INÍCIO" / "PARADA") acima do textbox de RNA
   * para os códons de início e parada, usando uma máquina de estados simples.
   *
   * BUGFIX: a versão anterior calculava a posição horizontal com constantes
   * fixas em pixels (padding + largura de slot) espelhando o CSS manualmente.
   * Isso quebrava silenciosamente sempre que o CSS responsivo mudava o
   * tamanho da fonte/input em telas menores. Agora a posição é lida
   * diretamente do `offsetLeft` do input real que inicia o códon, então o
   * rótulo sempre acompanha o layout de verdade, não uma cópia dele.
   */
  function updateCodonLabels() {
    const rnaBox = textboxRna[0];

    // Remove rótulos anteriores
    const stale = rnaBox.getElementsByClassName('codon-label');
    while (stale.length > 0) rnaBox.removeChild(stale[0]);

    const seq = readSequence(rnaSequenceChars);
    if (seq.length < 3) return;

    // Reaproveita walkCodingRegion() em vez de reimplementar a busca de AUG/STOP
    // aqui — essa duplicação era justamente uma das duas cópias que carregavam
    // o bug de quadro de leitura fixo na posição 0. Uma só fonte de verdade agora.
    let wasActive = false;
    walkCodingRegion(seq, (codon, aminoacid, isActive, baseIndex) => {
      let kind = null;
      if (isActive && !wasActive) kind = 'start';
      else if (!isActive && wasActive) kind = 'stop';
      wasActive = isActive;
      if (!kind) return;

      const startChar = rnaSequenceChars[baseIndex];
      if (!startChar) return;

      const lbl = document.createElement('div');
      lbl.className   = 'codon-label codon-label-' + kind;
      lbl.textContent = kind === 'start' ? 'INÍCIO' : 'PARADA';
      lbl.style.left  = startChar.offsetLeft + 'px';
      rnaBox.appendChild(lbl);
    });
  }

  /**
   * Encontra a posição do primeiro AUG na sequência de RNA — em QUALQUER
   * posição, não necessariamente múltipla de 3 (a UTR 5' pode ter qualquer
   * comprimento). Retorna -1 se não houver nenhum AUG.
   */
  function findFirstStartIndex(rnaSeq) {
    return rnaSeq.indexOf('AUG');
  }

  /**
   * Percorre uma sequência de RNA procurando ORFs (do AUG ao primeiro STOP em
   * fase). A busca pelo AUG escaneia base a base — não fica presa a posições
   * múltiplas de 3 a partir do início da string —, então uma UTR 5' de
   * qualquer comprimento (1, 2, 4 bases...) antes do AUG real é reconhecida
   * corretamente. UNIFICAÇÃO: essa regra existia duplicada em applyCodonClasses(),
   * updateCodonLabels() e translateProteinChainPure(); agora só existe aqui.
   *
   * Depois de encontrar um AUG e percorrer até o STOP correspondente (ou até
   * o fim da sequência, se não houver STOP), a busca recomeça a partir dali —
   * permitindo múltiplas ORFs na mesma sequência, cada uma na fase que seu
   * próprio AUG define (não precisa ser a mesma fase da ORF anterior).
   *
   * Para cada códon dentro de uma ORF, invoca onCodon(codon, aminoacid, isActive, baseIndex).
   * isActive é true para o AUG e todos os códons até (mas não incluindo) o STOP.
   * baseIndex é a posição (em bases) onde aquele códon começa na sequência —
   * usado por updateCodonLabels() para posicionar os rótulos INÍCIO/PARADA.
   *
   * Bases antes do primeiro AUG, ou fora de qualquer ORF, NÃO disparam onCodon.
   */
  function walkCodingRegion(rnaSeq, onCodon) {
    let i = 0;
    while (i <= rnaSeq.length - 3) {
      const startIdx = rnaSeq.indexOf('AUG', i);
      if (startIdx === -1) break;

      let j = startIdx;
      while (j + 3 <= rnaSeq.length) {
        const codon     = rnaSeq.substr(j, 3);
        const aminoacid = CODON_TABLE[codon];
        if (!aminoacid) break; // não deveria ocorrer com RNA válido, mas defensivo

        const isStop = aminoacid.abbrevName === 'STOP';
        onCodon(codon, aminoacid, !isStop, j);
        j += 3;
        if (isStop) break;
      }
      i = j;
    }
  }
  /**
   * Animações de Síntese Proteica — pareamento de bases (leve, sem modal).
   * Percorre a fita molde de DNA e o RNAm em sincronia, base a base, e pisca
   * cada par correspondente (mesmo índice) em sequência — uma onda visual da
   * esquerda pra direita que ilustra a transcrição acontecendo. Só adiciona/
   * remove a classe .pairing-flash (CSS puro, ver @keyframes pairingFlash em
   * app.css); não recalcula nem altera nenhum estado real de tradução, então
   * pode ser chamada a qualquer momento sem risco de desincronizar a UI.
   * Disparada pelo passo "Transcrição" do .dogma-stepper e pelo botão ▶
   * dentro do rótulo RNAm (#btn-play-pairing).
   */
  let pairingAnimationTimers = [];
  function animateBasePairing() {
    pairingAnimationTimers.forEach(clearTimeout);
    pairingAnimationTimers = [];

    const total = Math.min(dnaSequenceChars.length, rnaSequenceChars.length);
    if (total === 0) return;

    const STEP_MS  = 65;
    const FLASH_MS = 550;

    for (let i = 0; i < total; i++) {
      const dnaChar = dnaSequenceChars[i];
      const rnaChar = rnaSequenceChars[i];
      pairingAnimationTimers.push(setTimeout(() => {
        [dnaChar, rnaChar].forEach((el) => {
          if (!el) return;
          // Reinicia a animação mesmo se .pairing-flash já estiver presente
          // (ex.: cliques repetidos no botão ▶ antes da onda terminar).
          el.classList.remove('pairing-flash');
          void el.offsetWidth; // força reflow pra reiniciar a keyframe animation
          el.classList.add('pairing-flash');
        });
        pairingAnimationTimers.push(setTimeout(() => {
          if (dnaChar) dnaChar.classList.remove('pairing-flash');
          if (rnaChar) rnaChar.classList.remove('pairing-flash');
        }, FLASH_MS));
      }, i * STEP_MS));
    }
  }

  /**
   * Traduz a sequência de RNA de uma fita específica em aminoácidos e renderiza no container dado.
   * Generaliza a lógica usada tanto pela fita ativa (live) quanto pela fita de comparação (baseline),
   * permitindo reuso em loadDiseaseExample().
   */
  function translateStrand(rnaChars, outputContainer) {
    outputContainer.innerHTML = '';

    const sequence   = readSequence(rnaChars);
    const frameStart = findFirstStartIndex(sequence);

    // A fileira de aminoácidos não tem um "slot" pra UTR 5' (não faz sentido
    // mostrar um card vazio pra bases que nunca chegam a ser lidas). Mas pra
    // ela continuar alinhada embaixo da fileira de RNA — que SIM mostra a
    // UTR, só que com um estilo apagado — precisamos de um espaço reservado
    // do mesmo tamanho antes do primeiro slot de verdade.
    //
    // BUGFIX (alinhamento aminoácido × códon): a versão anterior usava
    // rnaChars[frameStart].offsetLeft direto como largura do spacer. Isso
    // erra de dois jeitos:
    //   1) offsetLeft já embute o padding-left da PRÓPRIA fileira de RNA —
    //      mas o spacer nasce dentro de .output-aminoacids, que tem seu
    //      PRÓPRIO padding-left/border independente. Usar offsetLeft como
    //      largura do spacer conta esse padding duas vezes.
    //   2) .output-aminoacids usa `gap: 8px` no flexbox pra separar os
    //      cards de aminoácido entre si — gap insere esse espaço entre TODO
    //      par de itens adjacentes, inclusive entre o spacer (1º filho) e o
    //      primeiro card real, sem equivalente na fileira de RNA (lá o
    //      respiro UTR→1º códon vem só da margem pontual de
    //      .codon-utr-end).
    // A correção mede em qual posição X (relativa à borda esquerda de CADA
    // fileira) o AUG começa, e calcula o quanto falta preencher no OUTRO
    // container pra chegar nessa mesma posição X — descontando o que o
    // border/padding/gap PRÓPRIOS de .output-aminoacids já empurram de
    // graça. Assim funciona não importa se os dois containers têm
    // padding/border iguais ou não, e não quebra se o CSS responsivo mudar
    // esses valores em telas menores.
    if (frameStart > 0 && rnaChars[frameStart]) {
      const rnaBox = rnaChars[frameStart].parentElement;
      const targetX = rnaChars[frameStart].getBoundingClientRect().left - rnaBox.getBoundingClientRect().left;

      const outCS          = getComputedStyle(outputContainer);
      const outBorderLeft  = parseFloat(outCS.borderLeftWidth) || 0;
      const outPaddingLeft = parseFloat(outCS.paddingLeft) || 0;
      const outGap         = parseFloat(outCS.columnGap) || 0;

      const spacer = document.createElement('div');
      spacer.className = 'output-aminoacids-utr-spacer';
      spacer.style.width = Math.max(0, targetX - outBorderLeft - outPaddingLeft - outGap) + 'px';
      outputContainer.appendChild(spacer);
    }

    walkCodingRegion(sequence, (codon, aminoacid, isActive) => {
      outputContainer.appendChild(isActive ? newAminoacid(aminoacid) : newAminoacid());
    });
  }

  /**
   * Constrói a lista de passos para a animação do ribossomo: um item por códon
   * dentro da primeira ORF encontrada (do AUG ao primeiro STOP em fase, inclusive),
   * na ordem em que o ribossomo os seria percorrer. Reaproveita walkCodingRegion() —
   * a mesma regra de fase de leitura usada pelo simulador e pelo quiz.
   *
   * Limitado à primeira ORF de propósito: animar múltiplas ORFs na mesma sequência
   * confundiria o aluno sobre qual proteína está sendo montada.
   *
   * @param {string} rnaSeq
   * @returns {Array<{codon:string, aminoacid:object, kind:'start'|'add'|'stop'}>}
   */
  function buildRibosomeSteps(rnaSeq) {
    const steps = [];
    let inOrf = false;
    let done  = false; // trava depois da 1ª ORF completa — necessário agora que
                        // walkCodingRegion() encontra ORFs em qualquer fase, não
                        // só na mesma fase da primeira
    walkCodingRegion(rnaSeq, (codon, aminoacid, isActive) => {
      if (done) return;
      if (isActive) {
        steps.push({ codon, aminoacid, kind: inOrf ? 'add' : 'start' });
        inOrf = true;
      } else if (inOrf && aminoacid.abbrevName === 'STOP') {
        steps.push({ codon, aminoacid, kind: 'stop' });
        inOrf = false; // encerra após a primeira ORF completa
        done  = true;
      }
    });
    return steps;
  }

  /** Complemento de base RNA-RNA (para calcular o anticódon do tRNA a partir do códon do mRNA). */
  const RNA_COMPLEMENT = { A: 'U', U: 'A', C: 'G', G: 'C' };

  /**
   * Calcula o anticódon do tRNA que pareia com um códon de mRNA dado, já na
   * convenção padrão de escrita 5'→3' (a mesma usada para o próprio códon).
   *
   * O pareamento códon-anticódon é ANTIPARALELO: a 1ª base do códon (5')
   * pareia com a ÚLTIMA base do anticódon (3'), não com a primeira. Por
   * isso não basta trocar cada base pela complementar mantendo a ordem —
   * é preciso complementar E inverter (reverse complement). Ex.: códon
   * AUG → anticódon CAU (não UAC).
   */
  function anticodonFor(codon) {
    return codon.split('').map(b => RNA_COMPLEMENT[b] || b).reverse().join('');
  }

  // ─── Animação do Ribossomo ("Ribossomo em Ação") ─────────────────────────────
  //
  // Modo opcional (não afeta o modo instantâneo padrão do simulador): percorre
  // a mesma lista de passos de buildRibosomeSteps() um de cada vez, mostrando
  // visualmente o tRNA entrando, pareando com o mRNA e entregando o aminoácido
  // à cadeia em formação — em vez de renderizar a proteína inteira de uma vez
  // como translateStrand() já faz no simulador principal.

  const ribosome = {
    steps: [],
    index: 0,
    playing: false,
    timers: [],
    els: {}, // preenchido em cacheRibosomeElements()
  };

  /** Localiza e armazena os elementos do DOM do modal do ribossomo (uma única vez). */
  function cacheRibosomeElements() {
    ribosome.els = {
      modal:        document.getElementById('ribosome-modal'),
      emptyMsg:     document.getElementById('ribosome-empty-msg'),
      stage:        document.getElementById('ribo-stage'),
      controls:     document.getElementById('ribo-controls'),
      codonsTrack:  document.getElementById('ribo-codons'),
      marker:       document.getElementById('ribo-ribosome-marker'),
      stageArea:    document.getElementById('ribo-stage-area'),
      trna:         document.getElementById('ribo-trna'),
      trnaAnticodon:document.getElementById('ribo-trna-anticodon'),
      trnaCargo:    document.getElementById('ribo-trna-cargo'),
      chain:        document.getElementById('ribo-chain'),
      status:       document.getElementById('ribo-status'),
      playBtn:      document.getElementById('ribo-play-pause'),
      playIcon:     document.getElementById('ribo-play-icon'),
      playLabel:    document.getElementById('ribo-play-label'),
      resetBtn:     document.getElementById('ribo-reset'),
      speedSelect:  document.getElementById('ribo-speed'),
    };
  }

  /** Cancela todos os timers de animação pendentes — usado por pause/reset/close. */
  function clearRibosomeTimers() {
    ribosome.timers.forEach(clearTimeout);
    ribosome.timers = [];
  }

  /** Agenda uma função para daqui a `delay` ms, registrando o timer para poder cancelá-lo depois. */
  function scheduleRibosome(fn, delay) {
    const id = setTimeout(fn, delay);
    ribosome.timers.push(id);
    return id;
  }

  /** Abre o modal, monta os passos a partir da sequência de DNA atual e prepara o palco inicial. */
  function openRibosomeModal() {
    cacheRibosomeElementsIfNeeded();
    const els = ribosome.els;
    if (!els.modal) return;

    const dnaSeq = readSequence(dnaSequenceChars);
    const rnaSeq = transcribeSeq(dnaSeq);
    ribosome.steps   = buildRibosomeSteps(rnaSeq);
    ribosome.index   = 0;
    ribosome.playing = false;
    clearRibosomeTimers();

    const hasSteps = ribosome.steps.length > 0;
    els.emptyMsg.style.display = hasSteps ? 'none' : 'block';
    els.stage.style.display    = hasSteps ? 'flex'  : 'none';
    els.controls.style.display = hasSteps ? 'flex'  : 'none';

    if (hasSteps) renderRibosomeTrack();

    openModalDialog(els.modal);
  }

  /** Garante que os elementos do modal já foram cacheados (defensivo, caso a ordem de init mude). */
  function cacheRibosomeElementsIfNeeded() {
    if (!ribosome.els.modal) cacheRibosomeElements();
  }

  /** Renderiza a trilha de códons (pílulas) e reposiciona o marcador do ribossomo no primeiro códon. */
  function renderRibosomeTrack() {
    const els = ribosome.els;
    els.codonsTrack.querySelectorAll('.ribo-codon').forEach(el => el.remove());
    els.chain.innerHTML = '';

    ribosome.steps.forEach((step) => {
      const pill = document.createElement('div');
      pill.className = 'ribo-codon' + (step.kind === 'stop' ? ' is-stop' : '');
      pill.textContent = step.codon;
      els.codonsTrack.appendChild(pill); // marker é o primeiro filho; pílulas entram depois dele
    });

    els.trna.classList.remove('is-visible', 'is-leaving');
    els.status.textContent = 'Pronto para iniciar.';
    positionRibosomeMarker(0);
    setPlayButtonState(false);
  }

  /** Move o marcador do ribossomo para centralizá-lo sobre a pílula de códon no índice dado. */
  /**
   * Posiciona o marcador do ribossomo em cima do códon atual — e, desde a
   * correção abaixo, também alinha o palco do tRNA horizontalmente com ele.
   *
   * BUGFIX #1 (marcador perdia a linha): .ribo-codons quebra linha em
   * sequências longas (flex-wrap:wrap — necessário pra caber num modal
   * estreito). O marcador só ajustava `left`, nunca `top`; ao passar pra
   * 2ª linha, o códon atual descia mas o marcador ficava preso na 1ª linha,
   * flutuando longe de onde deveria estar. Agora também lê pill.offsetTop.
   *
   * BUGFIX #2 (tRNA sempre no centro): o palco onde o tRNA entra
   * (.ribo-stage-area) é um elemento IRMÃO de .ribo-codons, não um filho —
   * antes ele só usava `justify-content:center` no CSS, sempre no meio,
   * não importa onde o ribossomo estivesse na trilha. Isso quebrava a
   * ilusão de que o tRNA está entregando o aminoácido bem ali. Como os
   * dois elementos têm sistemas de coordenadas locais DIFERENTES (mesmo
   * problema de fundo da correção de alinhamento do simulador principal —
   * ver syncFrameClasses()/translateStrand() acima), a reconciliação usa
   * getBoundingClientRect() dos dois lados em vez de offsetLeft cru.
   */
  function positionRibosomeMarker(stepIndex) {
    const els  = ribosome.els;
    const pill = els.codonsTrack.querySelectorAll('.ribo-codon')[stepIndex];
    if (!pill) return;

    const left = pill.offsetLeft + pill.offsetWidth / 2 - els.marker.offsetWidth / 2;
    els.marker.style.left = Math.max(0, left) + 'px';
    els.marker.style.top = pill.offsetTop + 'px';

    if (els.stageArea && els.trna) {
      const pillRect  = pill.getBoundingClientRect();
      const stageRect = els.stageArea.getBoundingClientRect();
      const pillCenterInStage = (pillRect.left + pillRect.width / 2) - stageRect.left;
      const trnaWidth = els.trna.offsetWidth || 60;
      const clamped = Math.min(
        Math.max(pillCenterInStage - trnaWidth / 2, 0),
        Math.max(stageRect.width - trnaWidth, 0)
      );
      els.trna.style.left = clamped + 'px';
    }
  }

  /** Atualiza o texto/ícone do botão Play/Pause conforme o estado atual. */
  function setPlayButtonState(isPlaying) {
    const els = ribosome.els;
    ribosome.playing = isPlaying;
    els.playIcon.className  = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    els.playLabel.textContent = isPlaying ? 'Pause' : 'Play';
  }

  /** Executa um único passo (um códon) da animação: tRNA entra, pareia, entrega a carga, sai. */
  function stepRibosome() {
    const els = ribosome.els;
    if (ribosome.index >= ribosome.steps.length) {
      setPlayButtonState(false);
      els.status.textContent = 'Tradução concluída — a proteína foi liberada do ribossomo!';
      return;
    }

    const step  = ribosome.steps[ribosome.index];
    const speed = Number(els.speedSelect.value) || 950;
    const pills = els.codonsTrack.querySelectorAll('.ribo-codon');

    pills.forEach(p => p.classList.remove('is-current'));
    const currentPill = pills[ribosome.index];
    if (currentPill) currentPill.classList.add('is-current');
    positionRibosomeMarker(ribosome.index);

    // 1) tRNA entra com o anticódon e a carga corretos
    els.trnaAnticodon.textContent = anticodonFor(step.codon);
    els.trnaCargo.textContent     = step.kind === 'stop' ? 'Fator de liberação' : step.aminoacid.name;
    els.trna.classList.remove('is-leaving');
    els.trna.classList.add('is-visible');

    els.status.textContent = step.kind === 'stop'
      ? `Códon de parada ${step.codon} reconhecido — nenhum tRNA se encaixa aqui.`
      : `tRNA com anticódon ${anticodonFor(step.codon)} pareia com o códon ${step.codon} do mRNA.`;

    // 2) "Pareamento": entrega o aminoácido à cadeia (ou libera a proteína, se for STOP)
    scheduleRibosome(() => {
      if (currentPill) currentPill.classList.add('is-done');
      if (step.kind === 'stop') {
        els.status.textContent = 'A proteína é liberada do ribossomo!';
      } else {
        // A cadeia (#ribo-chain) tem class="output-aminoacids", então já herda a
        // delegação de clique/teclado do drawer registrada 1x em DOMContentLoaded —
        // nenhum listener novo precisa ser adicionado aqui por aminoácido.
        els.chain.appendChild(newAminoacid(step.aminoacid));
        els.status.textContent = `${step.aminoacid.name} adicionado à cadeia polipeptídica.`;
      }
    }, speed * 0.45);

    // 3) tRNA sai
    scheduleRibosome(() => {
      els.trna.classList.remove('is-visible');
      els.trna.classList.add('is-leaving');
    }, speed * 0.75);

    // 4) Avança para o próximo passo (se ainda estiver tocando)
    scheduleRibosome(() => {
      ribosome.index++;
      if (ribosome.playing) stepRibosome();
    }, speed);
  }

  /** Inicia (ou retoma) a reprodução automática da animação. */
  function playRibosome() {
    if (ribosome.index >= ribosome.steps.length) resetRibosomeAnimation();
    setPlayButtonState(true);
    stepRibosome();
  }

  /**
   * Pausa a animação, mantendo o progresso atual.
   * DEFENSIVO: pode ser chamada pelo handler global de Esc (via closeModal()) mesmo que o
   * modal do ribossomo nunca tenha sido aberto nesta sessão — nesse caso ribosome.els ainda
   * está vazio, então simplesmente não há nada a pausar.
   */
  function pauseRibosome() {
    clearRibosomeTimers();
    if (!ribosome.els.playIcon) return;
    setPlayButtonState(false);
  }

  /** Reinicia a animação do zero, sem fechar o modal. */
  function resetRibosomeAnimation() {
    clearRibosomeTimers();
    ribosome.index = 0;
    renderRibosomeTrack();
  }

  /**
   * Traduz a fita ativa (live, índice 0) e atualiza os contadores da UI.
   * BUGFIX: a variável `aminoacids` não era declarada no original, tornando-se global.
   */
  function translate() {
    // BUGFIX: garante que .codon-utr/.codon-utr-end já estejam aplicadas
    // ANTES de translateStrand() medir offsetLeft pra montar o spacer da
    // UTR — ver nota em syncFrameClasses(). Sem isso, o spacer é medido com
    // o layout de uma tecla atrás e o aminoácido sai desalinhado do códon.
    syncFrameClasses();
    translateStrand(rnaSequenceChars, outputAminoacids[0]);
    updateCounters();
  }

  /** Atualiza os contadores de códons e aminoácidos ativos na UI. */
  function updateCounters() {
    const codonCounter     = document.getElementById('codon-counter');
    const aminoacidCounter = document.getElementById('aminoacid-counter');
    const gcCounter         = document.getElementById('gc-counter');
    if (!codonCounter || !aminoacidCounter) return;

    const totalCodons = Math.floor(rnaSequenceChars.length / 3);
    const activeAAs   = Array.from(outputAminoacids[0].getElementsByClassName('aminoacid'))
                             .filter(el => !el.classList.contains('not-availlable')).length;

    codonCounter.textContent     = totalCodons;
    aminoacidCounter.textContent = activeAAs;
    // GC é igual em qualquer uma das duas fitas (G sempre pareia com C), então
    // calcular em cima da fita molde já representa a dupla-hélice inteira.
    if (gcCounter) gcCounter.textContent = computeGCContent(dnaSequenceChars) + '%';
  }

  // ─── Análise de mutação ───────────────────────────────────────────────────────

  /**
   * Compara a sequência mutada com a original, destaca as diferenças
   * e classifica o tipo de mutação.
   */
  function mutationDifference() {
    // Inicialização lazy das referências ao painel (evita querySelector a cada chamada)
    if (!mutPanel.panel) {
      mutPanel.panel         = document.querySelector('.mutation-panel');
      mutPanel.noMutationMsg = mutPanel.panel && mutPanel.panel.querySelector('.no-mutation-msg');
      mutPanel.details       = mutPanel.panel && mutPanel.panel.querySelector('.mutation-details');
      mutPanel.badge         = mutPanel.panel && mutPanel.panel.querySelector('.mutation-type-badge');
      mutPanel.desc          = mutPanel.panel && mutPanel.panel.querySelector('.mutation-description');
    }

    const isActive = mutationWindow[0] && mutationWindow[0].classList.contains('active');
    if (mutPanel.panel) mutPanel.panel.style.display = isActive ? 'block' : 'none';
    if (!isActive) return;

    const aminoacids        = outputAminoacids[1].getElementsByClassName('aminoacid');
    const mutatedAminoacids = outputAminoacids[0].getElementsByClassName('aminoacid');
    const dna        = textboxDna[1].getElementsByClassName('sequenceChar');
    const mutatedDna = textboxDna[0].getElementsByClassName('sequenceChar');
    const rna        = textboxRna[1].getElementsByClassName('sequenceChar');
    const mutatedRna = textboxRna[0].getElementsByClassName('sequenceChar');

    const dnaSeq        = readSequence(dna);
    const mutatedDnaSeq = readSequence(mutatedDna);
    const rnaSeq        = readSequence(rna);
    const mutatedRnaSeq = readSequence(mutatedRna);

    // Destaca bases mutadas no DNA e no RNA
    highlightMutated(dna, mutatedDna, dnaSeq, mutatedDnaSeq);
    highlightMutated(rna, mutatedRna, rnaSeq, mutatedRnaSeq);

    // Destaca aminoácidos mutados
    const maxAALen = Math.max(aminoacids.length, mutatedAminoacids.length);
    for (let i = 0; i < maxAALen; i++) {
      const original = aminoacids[i];
      const mutated  = mutatedAminoacids[i];
      if (!mutated) continue;

      if (!original) {
        mutated.classList.add('mutated');
      } else {
        const origAbbrev = original.querySelector('.abbreviated-name');
        const mutAbbrev  = mutated.querySelector('.abbreviated-name');
        const changed = origAbbrev && mutAbbrev && origAbbrev.innerHTML !== mutAbbrev.innerHTML;
        // classList.toggle substitui o par add/remove em if-else
        mutated.classList.toggle('mutated', changed);
      }
    }

    classifyMutation(dnaSeq, mutatedDnaSeq);
  }

  /**
   * Adiciona ou remove a classe "mutated" comparando dois conjuntos de sequências.
   * Extraído de mutationDifference() para eliminar o código duplicado de DNA e RNA.
   *
   * @param {HTMLCollection} original - Inputs originais (sequenceChar).
   * @param {HTMLCollection} mutated  - Inputs mutados (sequenceChar).
   * @param {string} origSeq  - Sequência original como string.
   * @param {string} mutSeq   - Sequência mutada como string.
   */
  function highlightMutated(original, mutated, origSeq, mutSeq) {
    const maxLen = Math.max(original.length, mutated.length);
    for (let i = 0; i < maxLen; i++) {
      if (!mutated[i]) continue;
      const isDifferent = !original[i] || mutSeq[i] !== origSeq[i];
      mutated[i].classList.toggle('mutated', isDifferent);
    }
  }

  /**
   * Classifica e exibe o tipo de mutação (frameshift, silenciosa, nonsense, missense).
   * Extraído de mutationDifference() para separar responsabilidades.
   *
   * @param {string} dnaSeq        - Sequência DNA original.
   * @param {string} mutatedDnaSeq - Sequência DNA mutada.
   */
  function classifyMutation(dnaSeq, mutatedDnaSeq) {
    const { panel, noMutationMsg, details, badge, desc } = mutPanel;
    if (!panel || !noMutationMsg || !details || !badge || !desc) return;

    // UNIFICAÇÃO: a regra de decisão (frameshift → silenciosa → nonsense → missense)
    // vive em um único lugar, classifyMutationPure(), também usada pelo quiz.
    // classifyMutation() cuida apenas de exibir/formatar o resultado no DOM.
    const type = classifyMutationPure(dnaSeq, mutatedDnaSeq);

    if (!type) {
      noMutationMsg.style.display = 'block';
      details.style.display       = 'none';
      return;
    }

    noMutationMsg.style.display = 'none';
    details.style.display       = 'flex';

    const diff    = mutatedDnaSeq.length - dnaSeq.length;
    const absDiff = Math.abs(diff);

    // 1. Frameshift — indel não divisível por 3
    if (type === 'frameshift') {
      const verb = diff > 0
        ? `adição de <strong>${absDiff}</strong>`
        : `deleção de <strong>${absDiff}</strong>`;

      const origChain = translateProteinChainPure(transcribeSeq(dnaSeq));
      const mutChain  = translateProteinChainPure(transcribeSeq(mutatedDnaSeq));
      const stopNote  = mutChain.length < origChain.length
        ? ` A nova janela de leitura introduziu também um <strong>códon de parada prematuro</strong>, truncando a proteína resultante.`
        : '';

      badge.className   = 'mutation-type-badge frameshift';
      badge.textContent = 'Deslocamento de Leitura (Frameshift)';
      desc.innerHTML    =
        `A ${verb} base(s) — número não múltiplo de 3 — deslocou a janela de leitura de todos os ` +
        `códons a partir do ponto de mutação. Praticamente todos os aminoácidos seguintes são alterados.${stopNote}`;
      return;
    }

    // Descrição do mecanismo para substituição / indel in-frame
    const mechanism = diff === 0
      ? 'substituição de base(s)'
      : diff > 0
        ? `adição de <strong>${absDiff}</strong> base(s) (múltiplo de 3, sem deslocamento de leitura)`
        : `deleção de <strong>${absDiff}</strong> base(s) (múltiplo de 3, sem deslocamento de leitura)`;

    // 2. Silenciosa — sequência de aminoácidos inalterada
    if (type === 'silent') {
      badge.className   = 'mutation-type-badge silent';
      badge.textContent = 'Silenciosa (Sinônima)';
      desc.innerHTML    =
        `A ${mechanism} não alterou a sequência de aminoácidos resultante. ` +
        (diff === 0
          ? `Isso ocorre porque o código genético é <strong>degenerado</strong>: múltiplos códons diferentes codificam o mesmo aminoácido.`
          : `A proteína permanece estrutural e funcionalmente equivalente.`);
      return;
    }

    // 3. Nonsense — códon de parada prematuro introduzido
    if (type === 'nonsense') {
      badge.className   = 'mutation-type-badge nonsense';
      badge.textContent = 'Sem Sentido (Nonsense)';
      desc.innerHTML    =
        `A ${mechanism} gerou um <strong>códon de parada prematuro (STOP)</strong>. ` +
        `A tradução é encerrada antes do tempo, produzindo uma proteína truncada que geralmente é instável e não funcional.`;
      return;
    }

    // 4. Stop-loss — o próprio códon de parada foi alterado e deixou de sinalizar o fim
    if (type === 'stoploss') {
      badge.className   = 'mutation-type-badge stoploss';
      badge.textContent = 'Perda do Stop (Stop-Loss)';
      desc.innerHTML    =
        `A ${mechanism} alterou justamente o <strong>códon de parada original</strong>, transformando-o em um ` +
        `códon comum. A tradução deixa de parar onde deveria e continua incorporando aminoácidos de uma região ` +
        `que originalmente não fazia parte da proteína — o resultado é uma proteína mais longa e, com frequência, ` +
        `disfuncional ou instável.`;
      return;
    }

    // 5. Missense — aminoácido(s) diferente(s) incorporados
    badge.className   = 'mutation-type-badge missense';
    badge.textContent = 'Sentido Trocado (Missense)';
    desc.innerHTML    =
      `A ${mechanism} resultou na incorporação de um ou mais <strong>aminoácidos diferentes</strong> na cadeia ` +
      `polipeptídica. Dependendo da posição e da propriedade físico-química do aminoácido substituído, ` +
      `pode alterar a estrutura tridimensional e comprometer o funcionamento da proteína.`;
  }

  // ─── Ações sobre a sequência ─────────────────────────────────────────────────

  /**
   * Insere uma base de DNA na posição do cursor (ou no final da sequência).
   *
   * PERFORMANCE: `skipRender` permite inserir várias bases em sequência (ex.: os 3
   * nucleotídeos de um códon clicado na tabela de referência, em activateCodonItem())
   * sem disparar translate()/treatSequence() — que recriam todos os elementos de
   * aminoácido e recalculam a análise de mutação — a cada base individual. Quem
   * chama em lote é responsável por chamar translate()/treatSequence() uma única
   * vez ao final (ver activateCodonItem() e randomSequence(), que já seguia esse padrão).
   */
  function insertBase(base, { skipRender = false } = {}) {
    base = base.toUpperCase();
    if (!VALID_BASES.has(base)) return;

    const activeEl   = document.activeElement;
    const isDnaInput = activeEl &&
                       activeEl.classList.contains('sequenceChar') &&
                       textboxDna[0].contains(activeEl);

    if (isDnaInput) {
      const rnaEl = getRnaEquivalent(activeEl);
      if (replaceButton.classList.contains('active')) {
        activeEl.value = base;
        if (rnaEl) rnaEl.value = transcribe(base);
        const next = activeEl.nextElementSibling;
        if (next && next.classList.contains('sequenceChar')) focusWithoutKeyboard(next);
      } else {
        const newDna = newSequenceChar(base, 'sequenceChar', 'Base de DNA');
        const newRna = newSequenceChar(transcribe(base), 'sequenceChar', 'Base de RNA mensageiro');
        textboxDna[0].insertBefore(newDna, activeEl.nextElementSibling);
        textboxRna[0].insertBefore(newRna, rnaEl ? rnaEl.nextElementSibling : null);
        focusWithoutKeyboard(newDna);
      }
    } else {
      // Nenhum input focado: anexa ao final
      const newDna = newSequenceChar(base, 'sequenceChar', 'Base de DNA');
      const newRna = newSequenceChar(transcribe(base), 'sequenceChar', 'Base de RNA mensageiro');
      textboxDna[0].insertBefore(newDna, blankSpace);
      textboxRna[0].appendChild(newRna);
      focusWithoutKeyboard(newDna);
    }

    if (!skipRender) {
      translate();
      treatSequence();
    }
  }

  /**
   * Clona a fita primária (DNA/RNA/proteína) para a fita de comparação, no
   * momento em que o usuário entra no modo de mutação. Migrada de dom.js:
   * a função só existia ali porque os botões de mutação eram itens do menu
   * lateral; agora que são controles da própria página do simulador, ela
   * mora junto do resto do comportamento de mutação, em vez de ser a única
   * função do arquivo de navegação exposta especificamente para este script.
   */
  function cloneSequencePrimary() {
    const sequenceToMutate = document.getElementsByClassName('sequence')[1];
    sequenceToMutate.innerHTML = '';
    Array.from(document.getElementsByClassName('sequence')[0].children).forEach(function (child) {
      if (child.classList.contains('output-aminoacids') || child.classList.contains('textbox-rna')) {
        Array.from(child.getElementsByClassName('aminoacid')).forEach(function (aminoacid) {
          aminoacid.classList.remove('mutated');
        });
        Array.from(child.getElementsByClassName('sequenceChar')).forEach(function (sequenceChar) {
          sequenceChar.classList.remove('mutated');
        });
      }
      // Não clona o elemento de espaço em branco, para não duplicar um input vazio.
      if (!child.id || child.id !== 'blank-space') {
        sequenceToMutate.appendChild(child.cloneNode(true));
      }
    });
  }

  /**
   * Ativa um modo de mutação (Adição/Deleção/Substituição) na Genética Molecular.
   * Antes esta lógica vivia dentro do manipulador de clique genérico do menu
   * (dom.js), porque os 3 botões eram itens da barra lateral. Agora que viraram
   * controles dentro da própria página do simulador — igual aos seletores de
   * modo do Heredograma, da Genética Populacional e dos Cruzamentos — a lógica
   * mora aqui, junto com o resto do comportamento específico desta página.
   */
  function setMutationMode(mode) {
    const modeButtons = { add: addButton, delete: deleteButton, replace: replaceButton };
    Object.keys(modeButtons).forEach(function (key) {
      const isActive = key === mode;
      modeButtons[key].classList.toggle('active', isActive);
      modeButtons[key].setAttribute('aria-pressed', String(isActive));
    });

    const sequencePrimary  = document.getElementsByClassName('sequence')[0];
    const sequenceToMutate = document.getElementsByClassName('sequence')[1];
    // BUGFIX (preservado do dom.js original): o snapshot do baseline só é
    // refeito ao ENTRAR no modo mutação pela primeira vez (quando a fita de
    // comparação ainda não estava ativa). Trocar entre Adição/Deleção/
    // Substituição com o modo já ativo preserva a comparação "antes x depois"
    // em vez de recomeçar do estado já mutado.
    const enteringMutationMode = !sequenceToMutate.classList.contains('active');
    sequencePrimary.classList.add('active');
    sequenceToMutate.classList.add('active');
    if (enteringMutationMode) {
      cloneSequencePrimary();
    }
  }

  /** Reinicia o simulador: limpa todas as sequências e desativa o modo de mutação. */
  function clearSequence() {
    addButton.classList.remove('active');
    deleteButton.classList.remove('active');
    replaceButton.classList.remove('active');
    addButton.setAttribute('aria-pressed', 'false');
    deleteButton.setAttribute('aria-pressed', 'false');
    replaceButton.setAttribute('aria-pressed', 'false');
    if (mutationWindow[0]) mutationWindow[0].classList.remove('active');

    // clearSequenceChars elimina o padrão repetido 4 vezes no original
    clearSequenceChars(textboxDna[0]);
    clearSequenceChars(textboxRna[0]);
    clearSequenceChars(textboxDna[1]);
    clearSequenceChars(textboxRna[1]);

    outputAminoacids[0].innerHTML = '';
    if (outputAminoacids[1]) outputAminoacids[1].innerHTML = '';

    clearSequenceAutosave();

    const appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();

    translate();
    treatSequence();
  }

  /**
   * Gera uma string de DNA molde válida (início TAC=AUG + corpo aleatório + um dos três
   * stop codons), sem tocar no DOM. Extraída de randomSequence() para ser reaproveitada
   * tanto pela inserção no simulador quanto pelo gerador de perguntas do Modo Desafio.
   * @param {number} [numCodons] - total de códons desejado (incluindo início e parada).
   *        Se omitido, sorteia entre 4 e 7.
   */
  function generateRandomCodingDna(numCodons) {
    const bases      = ['A', 'T', 'C', 'G'];
    const stopCodons = ['ATT', 'ATC', 'ACT']; // transcrevem para UAA, UAG, UGA
    const total = numCodons || (Math.floor(Math.random() * 4) + 4); // 4 a 7 códons

    let dnaSeq = 'TAC'; // início: transcreve para AUG
    for (let i = 0; i < total - 2; i++) {
      dnaSeq += bases[Math.floor(Math.random() * 4)];
      dnaSeq += bases[Math.floor(Math.random() * 4)];
      dnaSeq += bases[Math.floor(Math.random() * 4)];
    }
    dnaSeq += stopCodons[Math.floor(Math.random() * stopCodons.length)];
    return dnaSeq;
  }

  /** Gera e insere uma sequência de DNA aleatória válida (início + corpo + parada). */
  function randomSequence() {
    clearSequence();

    const dnaSeq = generateRandomCodingDna();

    for (const base of dnaSeq) {
      textboxDna[0].insertBefore(newSequenceChar(base, 'sequenceChar', 'Base de DNA'), blankSpace);
      textboxRna[0].appendChild(newSequenceChar(transcribe(base), 'sequenceChar', 'Base de RNA mensageiro'));
    }

    translate();
    treatSequence();
  }

  // ─── Exportação / Importação de sequência ────────────────────────────────────

  /**
   * Remove espaços, vírgulas e outros separadores comuns de uma string colada,
   * e isola apenas as bases válidas (A, T, C, G). Sinaliza se algum caractere
   * desconhecido (não-base, não-separador) foi descartado.
   */
  function sanitizeDnaInput(raw) {
    const upper = String(raw || '').toUpperCase();
    let clean = '';
    let hadInvalid = false;

    for (const ch of upper) {
      if (VALID_BASES.has(ch)) {
        clean += ch;
      } else if (!/[\s,;|\-_/\\]/.test(ch)) {
        hadInvalid = true;
      }
    }

    return { clean, hadInvalid };
  }

  /**
   * Salva a sequência de DNA atual (fita ativa do simulador principal) no
   * localStorage a cada mudança — chamada de dentro de treatSequence(), o
   * mesmo ponto único que já recalcula todo o resto após qualquer edição.
   * Graciosa se localStorage estiver indisponível (modo privado, cookies
   * bloqueados etc.), mesmo padrão de saveQuizBestScore(). Sequência vazia
   * não é salva — não faz sentido "restaurar" um simulador em branco, e
   * assim uma sessão nova não sobrescreve silenciosamente um autosave válido
   * de uma aba anterior.
   */
  function saveSequenceAutosave() {
    try {
      const dnaSeq = readSequence(dnaSequenceChars);
      if (dnaSeq) window.localStorage.setItem(DNA_AUTOSAVE_KEY, dnaSeq);
    } catch (e) { /* localStorage indisponível — segue sem persistir */ }
  }

  /** Apaga o autosave — chamada por clearSequence(), pra "Limpar tudo" não voltar sozinho no próximo F5. */
  function clearSequenceAutosave() {
    try { window.localStorage.removeItem(DNA_AUTOSAVE_KEY); } catch (e) { /* indisponível, nada a fazer */ }
  }

  /**
   * Restaura a última sequência autosalva, se existir — chamada uma única vez
   * na inicialização, e só quando não há sequência compartilhada via URL (a
   * URL tem prioridade: ver loadSequenceFromUrl()). Mesma sanitização usada
   * pra sequência compartilhada, por segurança (localStorage pode ter sido
   * editado manualmente via devtools).
   */
  function restoreSequenceAutosave() {
    let raw;
    try { raw = window.localStorage.getItem(DNA_AUTOSAVE_KEY); } catch (e) { return false; }
    if (!raw) return false;

    const { clean } = sanitizeDnaInput(raw);
    if (!clean) return false;

    const appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();

    loadSequenceFromString(clean);
    showInfo('Sequência restaurada', 'Continuamos de onde você parou — a última sequência editada foi recuperada automaticamente.');
    return true;
  }

  /**
   * Carrega uma sequência de DNA já validada no simulador, substituindo a sequência atual.
   * Reaproveita a mesma estratégia de inserção em lote de randomSequence(): insere todos
   * os inputs primeiro e só então dispara translate()/treatSequence() uma única vez.
   */
  function loadSequenceFromString(dnaSeq) {
    clearSequence();

    let lastDnaInput = null;
    for (const base of dnaSeq) {
      lastDnaInput = newSequenceChar(base, 'sequenceChar', 'Base de DNA');
      textboxDna[0].insertBefore(lastDnaInput, blankSpace);
      textboxRna[0].appendChild(newSequenceChar(transcribe(base), 'sequenceChar', 'Base de RNA mensageiro'));
    }
    if (lastDnaInput) focusWithoutKeyboard(lastDnaInput);

    translate();
    treatSequence();
  }

  /** Preenche e abre o modal de exportação com a sequência atual e um link de compartilhamento. */
  function openExportModal() {
    const modal    = document.getElementById('export-modal');
    const seqText  = document.getElementById('export-seq-text');
    const linkText = document.getElementById('export-seq-link');
    const feedback = document.getElementById('export-feedback');
    if (!modal || !seqText || !linkText) return;

    const dnaSeq = readSequence(dnaSequenceChars);
    seqText.value = dnaSeq;

    const url = new URL(window.location.href);
    url.search = '';
    if (dnaSeq) url.searchParams.set('seq', dnaSeq);
    linkText.value = url.toString();

    if (feedback) {
      feedback.textContent = dnaSeq ? '' : 'A sequência está vazia — insira bases no simulador antes de exportar.';
      feedback.classList.toggle('error', !dnaSeq);
    }

    openModalDialog(modal);
  }

  /**
   * Copia o conteúdo de um textarea para a área de transferência, com feedback visual.
   * Usa a Clipboard API moderna com fallback para document.execCommand em navegadores antigos.
   */
  function copyTextareaContent(textareaId, feedbackEl, successMsg) {
    const el = document.getElementById(textareaId);
    if (!el || !el.value) return;

    const reportResult = (ok) => {
      if (!feedbackEl) return;
      feedbackEl.textContent = ok
        ? successMsg
        : 'Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.';
      feedbackEl.classList.toggle('error', !ok);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(el.value).then(() => reportResult(true)).catch(() => reportResult(false));
    } else {
      el.select();
      try {
        document.execCommand('copy');
        reportResult(true);
      } catch (e) {
        reportResult(false);
      }
    }
  }

  /** Limpa e abre o modal de importação, pronto para receber uma nova sequência colada. */
  function openImportModal() {
    const modal    = document.getElementById('import-modal');
    const input    = document.getElementById('import-seq-input');
    const feedback = document.getElementById('import-feedback');
    if (!modal) return;

    if (input) input.value = '';
    if (feedback) {
      feedback.textContent = '';
      feedback.classList.remove('error');
    }

    openModalDialog(modal, input);
  }

  /** Valida o texto colado no modal de importação e, se houver bases válidas, carrega a sequência. */
  function handleImportSubmit() {
    const modal    = document.getElementById('import-modal');
    const input    = document.getElementById('import-seq-input');
    const feedback = document.getElementById('import-feedback');
    if (!input) return;

    const { clean, hadInvalid } = sanitizeDnaInput(input.value);

    if (!clean) {
      if (feedback) {
        feedback.textContent = 'Digite ao menos uma base válida (A, T, C ou G).';
        feedback.classList.add('error');
      }
      return;
    }

    loadSequenceFromString(clean);

    if (feedback) {
      feedback.classList.remove('error');
      feedback.textContent = hadInvalid
        ? `Sequência carregada (${clean.length} bases). Caracteres inválidos foram ignorados.`
        : `Sequência carregada com sucesso (${clean.length} bases).`;
    }

    // Fecha o modal após um curto intervalo para que o aluno veja a confirmação
    setTimeout(() => { if (modal) modal.style.display = 'none'; }, hadInvalid ? 1800 : 900);
  }

  /**
   * Verifica se a URL atual contém uma sequência compartilhada (?seq=...) e,
   * em caso positivo, navega para o simulador e a carrega automaticamente.
   * Permite que professores distribuam desafios prontos por link. Retorna
   * true/false pra quem chama saber se deve tentar restoreSequenceAutosave()
   * em seguida — o link da URL tem prioridade sobre o autosave local.
   */
  function loadSequenceFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('seq');
    if (!raw) return false;

    const { clean } = sanitizeDnaInput(raw);
    if (!clean) return false;

    const appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();

    loadSequenceFromString(clean);
    showInfo('Sequência carregada!', 'Uma sequência de DNA foi importada automaticamente via link compartilhado.');
    return true;
  }

  // ─── Doenças genéticas reais ─────────────────────────────────────────────────

  /**
   * Exemplos didáticos de mutações reais bem documentadas na literatura.
   * As sequências de DNA são versões simplificadas (poucos códons) construídas
   * para que o códon exato da mutação real apareça na posição correta — a base
   * trocada/inserida e seu efeito sobre o aminoácido correspondem à mutação
   * verdadeira, mesmo que o gene completo seja muito mais longo na realidade.
   *
   * wildDna  = sequência original (saudável), carregada na fita de comparação (baseline).
   * mutDna   = sequência com a mutação real, carregada na fita ativa do simulador.
   */
  const DISEASE_EXAMPLES = {
    sickle: {
      name: 'Anemia Falciforme',
      gene: 'HBB (Hemoglobina Beta) — códon 6',
      wildDna: 'TACCTCATT',
      mutDna:  'TACCACATT',
    },
    thalassemia: {
      name: 'Beta-Talassemia (Códon 39)',
      gene: 'HBB (Hemoglobina Beta) — códon 39',
      wildDna: 'TACGTCGTCGTCATT',
      mutDna:  'TACATCGTCGTCATT',
    },
    taysachs: {
      name: 'Doença de Tay-Sachs',
      gene: 'HEXA (Hexosaminidase A) — inserção 1278insTATC',
      wildDna: 'TACCGACGACGAATT',
      mutDna:  'TACTATCCGACGACGAATT',
    },
    silentDemo: {
      name: 'Mutação Silenciosa (Exemplo Ilustrativo)',
      gene: 'HBB — variação hipotética no mesmo códon 6',
      wildDna: 'TACCTCATT',
      mutDna:  'TACCTTATT',
    },
  };

  /**
   * Esvazia as quatro linhas de sequência (DNA/RNA × fita ativa/baseline) sem alterar
   * o estado dos botões de mutação. Usado internamente por loadDiseaseExample(), que
   * precisa de um estado limpo mas quer manter o modo de mutação ativo logo em seguida.
   */
  function clearAllStrandsKeepingMode() {
    clearSequenceChars(textboxDna[0]);
    clearSequenceChars(textboxRna[0]);
    clearSequenceChars(textboxDna[1]);
    clearSequenceChars(textboxRna[1]);
    outputAminoacids[0].innerHTML = '';
    if (outputAminoacids[1]) outputAminoacids[1].innerHTML = '';
  }

  /**
   * Preenche uma fita (DNA + RNA correspondente) a partir de uma string de bases de DNA.
   * @param {string} dnaTemplate - sequência de bases A/T/C/G.
   * @param {HTMLElement} dnaContainer - container onde os inputs de DNA serão inseridos.
   * @param {HTMLElement} rnaContainer - container onde os inputs de RNA serão inseridos.
   * @param {Node|null} beforeNode - nó de referência para insertBefore (ex: blankSpace),
   *        ou null para simplesmente usar appendChild (caso da fita de comparação, que não tem blank-space).
   */
  function fillStrand(dnaTemplate, dnaContainer, rnaContainer, beforeNode) {
    for (const base of dnaTemplate) {
      const dnaInput = newSequenceChar(base, 'sequenceChar', 'Base de DNA');
      const rnaInput = newSequenceChar(transcribe(base), 'sequenceChar', 'Base de RNA mensageiro');
      if (beforeNode) dnaContainer.insertBefore(dnaInput, beforeNode);
      else dnaContainer.appendChild(dnaInput);
      rnaContainer.appendChild(rnaInput);
    }
  }

  /**
   * Carrega um exemplo de doença genética real no simulador: a sequência original
   * (saudável) vai para a fita de comparação (baseline) e a sequência com a mutação
   * real vai para a fita ativa, com o modo de mutação já habilitado para que a
   * análise automática (Missense/Nonsense/Frameshift/Silenciosa) apareça imediatamente.
   * Chamada pelos cartões de doença via listener delegado (data-disease), ver DOMContentLoaded.
   */
  function loadDiseaseExample(key) {
    const disease = DISEASE_EXAMPLES[key];
    if (!disease) return;

    // Garante que a navegação está na aba do simulador antes de mexer no DOM dele
    const appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();

    clearAllStrandsKeepingMode();

    // As ferramentas de Adicionar/Deletar/Substituir não se aplicam aqui — a mutação já vem pronta
    addButton.classList.remove('active');
    deleteButton.classList.remove('active');
    replaceButton.classList.remove('active');

    // Fita 1 (.to-mutate) = baseline "antes" | Fita 0 (ativa) = versão "depois", com a mutação real
    fillStrand(disease.wildDna, textboxDna[1], textboxRna[1], null);
    fillStrand(disease.mutDna,  textboxDna[0], textboxRna[0], blankSpace);

    mutationWindow[0].classList.add('active');

    translate();
    translateStrand(textboxRna[1].getElementsByClassName('sequenceChar'), outputAminoacids[1]);
    treatSequence();

    showInfo(disease.name, `Sequência carregada: ${disease.gene}. Veja a análise de mutação abaixo, no Simulador.`);
  }

  // ─── Genética Mendeliana (Construtor de Cruzamentos / Quadro de Punnett) ─────
  //
  // Módulo independente do simulador molecular: modela cruzamentos mono e
  // di-híbridos com os três padrões de dominância (completa, codominância,
  // dominância incompleta), gera o quadro de Punnett e as proporções
  // genotípica/fenotípica resultantes. Segue o mesmo padrão pure-function +
  // camada de DOM usado no resto do app (ex.: classifyMutationPure/classifyMutation),
  // para que o motor de cálculo possa ser testado isoladamente, sem tocar no DOM.

  const MENDEL_PALETTE = ['#1e88e5', '#f57c00', '#43a047', '#e53935', '#8e24aa', '#00897b', '#c0ca33', '#6d4c41', '#5c6bc0'];

  /** Retorna os dois alelos (ex: ['R','R'], ['R','r'] ou ['r','r']) de um genitor para um gene. */
  function mendelAllelesForGenotype(genotypeClass, dominantLetter) {
    const dom = dominantLetter.toUpperCase();
    const rec = dominantLetter.toLowerCase();
    if (genotypeClass === 'homDom') return [dom, dom];
    if (genotypeClass === 'homRec') return [rec, rec];
    return [dom, rec];
  }

  /** Gera a lista de gametas de um genitor para 1+ genes independentes (produto cartesiano dos alelos). */
  function mendelGameteList(genes, parentGenotypes) {
    const perGeneAlleles = genes.map((g, i) => mendelAllelesForGenotype(parentGenotypes[i], g.letter));
    let combos = [[]];
    for (const alleles of perGeneAlleles) {
      const next = [];
      for (const combo of combos) for (const a of alleles) next.push([...combo, a]);
      combos = next;
    }
    return combos;
  }

  /** Classifica um par de alelos como homozigoto dominante, heterozigoto ou homozigoto recessivo. */
  function mendelClassifyPair(a1, a2, dominantLetter) {
    const dom = dominantLetter.toUpperCase();
    const isDom1 = a1 === dom, isDom2 = a2 === dom;
    if (isDom1 && isDom2) return 'homDom';
    if (!isDom1 && !isDom2) return 'homRec';
    return 'het';
  }

  /** Formata um par de alelos para exibição, sempre com o dominante primeiro (ex: sempre "Rr", nunca "rR"). */
  function mendelDisplayPair(a1, a2, dominantLetter) {
    const dom = dominantLetter.toUpperCase();
    const pair = [a1, a2];
    pair.sort((x, y) => (x === dom) === (y === dom) ? 0 : (x === dom ? -1 : 1));
    return pair.join('');
  }

  /** Retorna o nome do fenótipo de um gene para uma classe genotípica, respeitando o padrão de dominância. */
  function mendelPhenotypeLabel(gene, genotypeClass) {
    if (genotypeClass === 'homDom') return gene.domName;
    if (genotypeClass === 'homRec') return gene.recName;
    return gene.pattern === 'complete' ? gene.domName : gene.hetName;
  }

  /**
   * Monta o quadro de Punnett completo para 1 ou mais genes independentes (sem ligação gênica).
   * @param {Array<{letter, pattern, domName, hetName, recName}>} genes
   * @param {Array<'homDom'|'het'|'homRec'>} parent1Genotypes — um valor por gene, mesma ordem de `genes`
   * @param {Array<'homDom'|'het'|'homRec'>} parent2Genotypes
   */
  function buildPunnettSquare(genes, parent1Genotypes, parent2Genotypes) {
    const gametes1 = mendelGameteList(genes, parent1Genotypes);
    const gametes2 = mendelGameteList(genes, parent2Genotypes);
    const cells = [];
    for (const g1 of gametes1) {
      const row = [];
      for (const g2 of gametes2) {
        const perGene = genes.map((gene, i) => {
          const cls = mendelClassifyPair(g1[i], g2[i], gene.letter);
          return {
            class: cls,
            display: mendelDisplayPair(g1[i], g2[i], gene.letter),
            phenotype: mendelPhenotypeLabel(gene, cls),
          };
        });
        row.push({
          genotypeDisplay:  perGene.map(p => p.display).join(''),
          phenotypeDisplay: perGene.map(p => p.phenotype).join(', '),
        });
      }
      cells.push(row);
    }

    const genotypeTally = new Map();
    const phenotypeTally = new Map();
    let total = 0;
    for (const row of cells) {
      for (const cell of row) {
        total++;
        genotypeTally.set(cell.genotypeDisplay, (genotypeTally.get(cell.genotypeDisplay) || 0) + 1);
        phenotypeTally.set(cell.phenotypeDisplay, (phenotypeTally.get(cell.phenotypeDisplay) || 0) + 1);
      }
    }

    return {
      gametes1: gametes1.map(g => g.join('')),
      gametes2: gametes2.map(g => g.join('')),
      cells, total, genotypeTally, phenotypeTally,
    };
  }

  /** Maior divisor comum de uma lista de inteiros positivos (simplifica proporções, ex.: 12:4 → 3:1). */
  function mendelGcdAll(nums) {
    const gcd2 = (a, b) => (b === 0 ? a : gcd2(b, a % b));
    return nums.reduce((a, b) => gcd2(a, b));
  }

  /** Formata um Map de contagens como lista com proporção simplificada + porcentagem. */
  function mendelFormatTally(tally, total) {
    const entries = [...tally.entries()];
    const divisor = mendelGcdAll(entries.map(([, count]) => count));
    return entries.map(([label, count]) => ({
      label, count,
      ratio:   count / divisor,
      percent: Math.round((count / total) * 1000) / 10,
    }));
  }

  // ─── Epistasia (interação gênica): reaproveita as MESMAS funções puras do
  // Punnett genérico acima (mendelGameteList, mendelClassifyPair,
  // mendelFormatTally) — só a etapa final de "genótipo combinado → fenótipo"
  // muda por cenário, então a proporção nunca pode divergir do que o
  // cruzamento realmente produz. ─────────────────────────────────────────────

  const EPISTASIS_GENE_A = { letter: 'A', pattern: 'complete' };
  const EPISTASIS_GENE_B = { letter: 'B', pattern: 'complete' };

  const EPISTASIS_SCENARIOS = {
    recessive: {
      title: 'Epistasia Recessiva (proporção esperada 9 : 3 : 4)',
      example: 'Pelagem de cães (ex: Labradores): o gene E precisa ter ao menos 1 alelo dominante para depositar ' +
        'QUALQUER pigmento na pelagem. Um cão "ee" fica amarelo, não importa o genótipo do gene B (que decide entre ' +
        'preto e chocolate) — por isso eeB_ e eebb caem na MESMA categoria final.',
      classify(clsA, clsB) {
        if (clsA === 'homRec') return 'Amarelo (eeB_ ou eebb — gene E mascara o gene B)';
        return clsB === 'homRec' ? 'Chocolate/Marrom (E_bb)' : 'Preto (E_B_)';
      },
    },
    dominant: {
      title: 'Epistasia Dominante (proporção esperada 12 : 3 : 1)',
      example: 'Cor da casca da abóbora: um único alelo dominante W (branco) já basta para mascarar completamente ' +
        'o gene de cor Y — por isso W_Y_ e W_yy caem na MESMA categoria final (branco), sobrando só wwY_ e wwyy ' +
        'para diferenciar amarelo de verde.',
      classify(clsA, clsB) {
        if (clsA !== 'homRec') return 'Branco (W_Y_ ou W_yy — gene W mascara o gene Y)';
        return clsB === 'homRec' ? 'Verde (wwyy)' : 'Amarelo (wwY_)';
      },
    },
    duplicate_recessive: {
      title: 'Epistasia Recessiva Duplicada / Complementação Gênica (proporção esperada 9 : 7)',
      example: 'Cor da flor da ervilha-de-cheiro: os dois genes (C e P) codificam enzimas de uma MESMA via ' +
        'metabólica de pigmentação — a cor púrpura só aparece se houver ao menos 1 alelo dominante em CADA um dos ' +
        'dois genes; faltando o dominante em qualquer um deles, a via para e a flor fica branca.',
      classify(clsA, clsB) {
        return (clsA !== 'homRec' && clsB !== 'homRec')
          ? 'Púrpura (C_P_ — dominante presente nos 2 genes)'
          : 'Branca (falta o dominante em ao menos 1 dos 2 genes)';
      },
    },
    duplicate_dominant: {
      title: 'Epistasia Dominante Duplicada (proporção esperada 15 : 1)',
      example: 'Formato da cápsula da bolsa-de-pastor: os dois genes (A e B) têm efeito equivalente e cumulativo — ' +
        'um único alelo dominante em QUALQUER um dos dois (ou em ambos) já é suficiente para produzir a cápsula ' +
        'triangular; só o duplo-recessivo (aabb) produz a forma ovoide.',
      classify(clsA, clsB) {
        return (clsA !== 'homRec' || clsB !== 'homRec')
          ? 'Triangular (A_B_, A_bb ou aaB_ — dominante em ao menos 1 gene)'
          : 'Ovoide (aabb — recessivo nos 2 genes)';
      },
    },
  };

  /**
   * Calcula a proporção fenotípica de um cruzamento di-híbrido F1 × F1 fixo
   * (AaBb × AaBb, dominância completa nos 2 genes) reinterpretado segundo um
   * dos 4 tipos clássicos de epistasia.
   */
  function computeEpistasisCross(scenarioKey) {
    const scenario = EPISTASIS_SCENARIOS[scenarioKey];
    if (!scenario) return null;

    const gametes1 = mendelGameteList([EPISTASIS_GENE_A, EPISTASIS_GENE_B], ['het', 'het']);
    const gametes2 = mendelGameteList([EPISTASIS_GENE_A, EPISTASIS_GENE_B], ['het', 'het']);
    const tally = new Map();
    let total = 0;
    for (const g1 of gametes1) {
      for (const g2 of gametes2) {
        const clsA = mendelClassifyPair(g1[0], g2[0], 'A');
        const clsB = mendelClassifyPair(g1[1], g2[1], 'B');
        const label = scenario.classify(clsA, clsB);
        tally.set(label, (tally.get(label) || 0) + 1);
        total++;
      }
    }
    return { scenario, formatted: mendelFormatTally(tally, total), total };
  }

  // ─── Sistema ABO (alelos múltiplos): mesmo princípio — as combinações de
  // gametas são geradas e classificadas por regras puras, nunca hardcoded. ────

  /** Prioridade de exibição dos alelos (IA e IB sempre aparecem antes de i, IA antes de IB por convenção alfabética). */
  const ABO_ALLELE_ORDER = { IA: 0, IB: 1, i: 2 };
  const ABO_ALLELE_DISPLAY = { IA: 'I<sup>A</sup>', IB: 'I<sup>B</sup>', i: 'i' };

  /** As 6 combinações genotípicas possíveis do sistema ABO, com seus 2 alelos. */
  const ABO_GENOTYPE_OPTIONS = {
    AA: ['IA', 'IA'],
    Ai: ['IA', 'i'],
    BB: ['IB', 'IB'],
    Bi: ['IB', 'i'],
    AB: ['IA', 'IB'],
    ii: ['i', 'i'],
  };

  /** Determina o tipo sanguíneo (fenótipo) a partir de um par de alelos ABO — IA e IB são codominantes, ambos dominam i. */
  function aboPhenotypeFromAlleles(pair) {
    const hasA = pair.includes('IA');
    const hasB = pair.includes('IB');
    if (hasA && hasB) return 'AB';
    if (hasA) return 'A';
    if (hasB) return 'B';
    return 'O';
  }

  /** Formata um par de alelos ABO para exibição em HTML, sempre na mesma ordem (IA, depois IB, depois i). */
  function aboDisplayGenotype(pair) {
    const sorted = pair.slice().sort((a, b) => ABO_ALLELE_ORDER[a] - ABO_ALLELE_ORDER[b]);
    return sorted.map(a => ABO_ALLELE_DISPLAY[a]).join('');
  }

  /**
   * Calcula o cruzamento ABO completo entre 2 genótipos escolhidos: todas as
   * combinações de gametas possíveis, com genótipo e fenótipo (tipo sanguíneo)
   * resultante de cada uma.
   */
  function computeAboCross(genotype1Key, genotype2Key) {
    const alleles1 = ABO_GENOTYPE_OPTIONS[genotype1Key];
    const alleles2 = ABO_GENOTYPE_OPTIONS[genotype2Key];
    if (!alleles1 || !alleles2) return null;

    const genotypeTally = new Map();
    const phenotypeTally = new Map();
    let total = 0;
    for (const a1 of alleles1) {
      for (const a2 of alleles2) {
        const pair = [a1, a2];
        const genotypeLabel = aboDisplayGenotype(pair);
        const phenotypeLabel = 'Tipo ' + aboPhenotypeFromAlleles(pair);
        genotypeTally.set(genotypeLabel, (genotypeTally.get(genotypeLabel) || 0) + 1);
        phenotypeTally.set(phenotypeLabel, (phenotypeTally.get(phenotypeLabel) || 0) + 1);
        total++;
      }
    }
    return {
      genotypeFormatted:  mendelFormatTally(genotypeTally, total),
      phenotypeFormatted: mendelFormatTally(phenotypeTally, total),
      total,
    };
  }

  // ─── Camada de DOM: formulário, quadro de Punnett e resultados ───────────────

  const mendel = {
    els: {},
    mode: 'mono', // 'mono' | 'di'
    colorByPhenotype: new Map(),
  };

  /** Localiza e armazena os elementos do modal do construtor de cruzamentos (uma única vez). */
  function cacheMendelElements() {
    mendel.els = {
      modal:              document.getElementById('mendel-modal'),
      modeMonoBtn:        document.getElementById('mendel-mode-mono'),
      modeDiBtn:          document.getElementById('mendel-mode-di'),
      gene2Config:        document.getElementById('mendel-gene-2'),
      generateBtn:        document.getElementById('mendel-generate-btn'),
      results:            document.getElementById('mendel-results'),
      punnettWrapper:     document.getElementById('mendel-punnett-wrapper'),
      genotypeTallyList:  document.getElementById('mendel-genotype-tally'),
      phenotypeTallyList: document.getElementById('mendel-phenotype-tally'),
      explanation:        document.getElementById('mendel-explanation'),
    };
  }

  /** Abre o modal do construtor de cruzamentos. */
  function openMendelModal() {
    if (!mendel.els.modal) cacheMendelElements();
    if (!mendel.els.modal) return;
    openModalDialog(mendel.els.modal);
  }

  /** Abre o modal de Epistasia e já gera o exemplo selecionado no dropdown, para a tela nunca abrir vazia. */
  function openEpistasisModal() {
    const modal = document.getElementById('epistasis-modal');
    if (!modal) return;
    openModalDialog(modal);
    renderEpistasisResult();
  }

  /** Recalcula (via computeEpistasisCross) e renderiza o cenário de epistasia selecionado no dropdown. */
  function renderEpistasisResult() {
    const select = document.getElementById('epistasis-scenario-select');
    const resultsEl = document.getElementById('epistasis-results');
    const titleEl = document.getElementById('epistasis-results-title');
    const exampleEl = document.getElementById('epistasis-example-text');
    const tallyEl = document.getElementById('epistasis-tally');
    if (!select || !resultsEl) return;

    const result = computeEpistasisCross(select.value);
    if (!result) return;

    if (titleEl) titleEl.textContent = result.scenario.title;
    if (exampleEl) exampleEl.textContent = result.scenario.example;
    if (tallyEl) {
      tallyEl.innerHTML = '';
      result.formatted.forEach((f) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${f.ratio}</strong> — ${f.label} <span class="lab-tally-detail">(${f.count}/${result.total} · ${f.percent}%)</span>`;
        tallyEl.appendChild(li);
      });
    }
    resultsEl.style.display = 'block';
  }

  /** Abre o modal do Sistema ABO e já calcula o cruzamento com os genótipos padrão selecionados. */
  function openAboModal() {
    const modal = document.getElementById('abo-modal');
    if (!modal) return;
    openModalDialog(modal);
    renderAboResult();
  }

  /** Recalcula (via computeAboCross) e renderiza o cruzamento ABO para os 2 genótipos escolhidos nos selects. */
  function renderAboResult() {
    const p1Select = document.getElementById('abo-parent1-select');
    const p2Select = document.getElementById('abo-parent2-select');
    const resultsEl = document.getElementById('abo-results');
    const genotypeTallyEl = document.getElementById('abo-genotype-tally');
    const phenotypeTallyEl = document.getElementById('abo-phenotype-tally');
    const explanationEl = document.getElementById('abo-explanation');
    if (!p1Select || !p2Select || !resultsEl) return;

    const result = computeAboCross(p1Select.value, p2Select.value);
    if (!result) return;

    if (genotypeTallyEl) {
      genotypeTallyEl.innerHTML = '';
      result.genotypeFormatted.forEach((f) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${f.ratio}</strong> — ${f.label} <span class="lab-tally-detail">(${f.percent}%)</span>`;
        genotypeTallyEl.appendChild(li);
      });
    }
    if (phenotypeTallyEl) {
      phenotypeTallyEl.innerHTML = '';
      result.phenotypeFormatted.forEach((f) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${f.ratio}</strong> — ${f.label} <span class="lab-tally-detail">(${f.percent}%)</span>`;
        phenotypeTallyEl.appendChild(li);
      });
    }
    if (explanationEl) {
      const phenotypeList = result.phenotypeFormatted.map(f => f.label.replace('Tipo ', '')).join(', ');
      explanationEl.textContent = result.phenotypeFormatted.length > 1
        ? `Esse casal pode ter filhos dos seguintes tipos sanguíneos: ${phenotypeList}.`
        : `Esse casal só pode ter filhos do tipo sanguíneo ${phenotypeList} — os dois genitores não têm alelos suficientes para gerar outro tipo.`;
    }
    resultsEl.style.display = 'block';
  }

  /** Lê a configuração de um gene (índice 0 ou 1) a partir dos campos do formulário. */
  function readMendelGeneConfig(index) {
    const p = 'mendel-g' + (index + 1) + '-';
    const get = (suffix) => document.getElementById(p + suffix);

    const letter  = (get('letter').value || 'A').trim().charAt(0) || 'A';
    const pattern = get('pattern').value;
    const domName = get('domname').value.trim() || (letter.toUpperCase() + letter.toUpperCase());
    const recName = get('recname').value.trim() || (letter.toLowerCase() + letter.toLowerCase());
    const hetRaw  = get('hetname').value.trim();
    const hetName = pattern === 'complete' ? domName : hetRaw;

    return {
      gene: { letter, pattern, domName, recName, hetName },
      p1: get('p1').value,
      p2: get('p2').value,
    };
  }

  /** Mostra/esconde o campo de nome do heterozigoto conforme o padrão de dominância escolhido para o gene. */
  function updateMendelHetFieldVisibility(index) {
    const p = 'mendel-g' + (index + 1) + '-';
    const pattern = document.getElementById(p + 'pattern').value;
    const wrap = document.getElementById(p + 'het-wrap');
    if (wrap) wrap.style.display = pattern === 'complete' ? 'none' : 'flex';
  }

  /** Alterna entre cruzamento mono-híbrido e di-híbrido, mostrando/escondendo a configuração do 2º gene. */
  function setMendelMode(mode) {
    if (!mendel.els.modal) cacheMendelElements();
    mendel.mode = mode;
    const isDi = mode === 'di';
    mendel.els.gene2Config.style.display = isDi ? 'block' : 'none';
    mendel.els.modeMonoBtn.classList.toggle('active', !isDi);
    mendel.els.modeDiBtn.classList.toggle('active', isDi);
    mendel.els.modeMonoBtn.setAttribute('aria-pressed', String(!isDi));
    mendel.els.modeDiBtn.setAttribute('aria-pressed', String(isDi));
    mendel.els.results.style.display = 'none';
  }

  /** Retorna (criando se necessário) a cor consistente atribuída a um rótulo de fenótipo, para a grade e a legenda. */
  function colorForPhenotype(label) {
    if (!mendel.colorByPhenotype.has(label)) {
      mendel.colorByPhenotype.set(label, MENDEL_PALETTE[mendel.colorByPhenotype.size % MENDEL_PALETTE.length]);
    }
    return mendel.colorByPhenotype.get(label);
  }

  /**
   * Converte uma cor hex (#rrggbb) para rgba() com a opacidade dada.
   * Calculado em JS em vez de usar CSS color-mix() para evitar dependência de
   * suporte de navegador mais recente para uma função puramente decorativa.
   */
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ─── Exportação de visualizações (Heredograma/Cariótipo/Simulador) como PNG ──
  //
  // Função genérica, sem dependências externas: funciona tanto para o SVG real
  // do heredograma quanto para containers de <div>s comuns (cariótipo, o
  // simulador de DNA/RNA/proteína). Como o PNG é rasterizado a partir de um
  // <img> carregando um SVG serializado (via canvas), as regras CSS externas
  // (classes como .pedigree-line) não se aplicam dentro dessa renderização
  // isolada — por isso cada elemento clonado recebe seus estilos computados
  // (cor, largura etc.) copiados diretamente para o atributo style,
  // "congelando" a aparência atual (tema claro/escuro incluso) antes de
  // serializar.
  //
  // BUGFIX (canvas contaminado): o link do Google Fonts no <head> não tem
  // crossorigin — então "IBM Plex Mono"/"Work Sans"/"IBM Plex Serif" (as
  // fontes usadas em quase todo o app, via --font-mono/--font-sans/
  // --font-serif) carregam em modo opaco (no-cors). Um <canvas> que rasteriza
  // QUALQUER texto usando uma fonte carregada assim fica "contaminado" —
  // toBlob()/toDataURL() passam a lançar erro de segurança, mesmo o texto
  // sendo 100% conteúdo local. Não rolava com o heredograma/cariótipo (pouco
  // ou nenhum texto com fonte customizada), mas quebrava a exportação do
  // simulador (a fita inteira usa --font-mono). A correção troca essas 3
  // fontes web por equivalentes de sistema SÓ na cópia usada pra exportar —
  // a página real e as fontes carregadas nela não mudam em nada.

  const WEB_FONT_TO_SYSTEM_FALLBACK = [
    { match: /IBM Plex Mono|Roboto Mono/i, fallback: 'ui-monospace, "SFMono-Regular", Consolas, monospace' },
    { match: /IBM Plex Serif/i,            fallback: 'Georgia, "Times New Roman", serif' },
    { match: /Work Sans/i,                 fallback: '"Segoe UI", Arial, sans-serif' },
  ];

  /** Se `fontFamilyValue` referencia uma das fontes web do Google Fonts, troca por um equivalente de sistema. */
  function sanitizeFontFamilyForExport(fontFamilyValue) {
    for (const { match, fallback } of WEB_FONT_TO_SYSTEM_FALLBACK) {
      if (match.test(fontFamilyValue)) return fallback;
    }
    return fontFamilyValue;
  }

  /**
   * Copia, em profundidade, o estilo computado de cada nó de `sourceEl` para o nó correspondente em `targetEl`.
   *
   * BUGFIX (caixas de sequência exportadas em branco): cloneNode(true) NÃO
   * copia a propriedade .value viva de <input>/<textarea> quando ela foi
   * setada via JS (como todo sequenceChar é preenchido) — só preserva o
   * atributo value="" estático original. O clone saía com todas as letras
   * em branco, apesar do resto do estilo estar certo. Aqui, além do estilo,
   * copia .value pro clone como ATRIBUTO de verdade (setAttribute, não só
   * a propriedade JS) — só assim ele sobrevive à serialização XML que vem
   * a seguir.
   */
  function inlineComputedStylesDeep(sourceEl, targetEl) {
    const sourceAll = [sourceEl, ...sourceEl.querySelectorAll('*')];
    const targetAll = [targetEl, ...targetEl.querySelectorAll('*')];
    for (let i = 0; i < sourceAll.length; i++) {
      if (!targetAll[i]) continue;
      const cs = window.getComputedStyle(sourceAll[i]);
      let cssText = '';
      for (let j = 0; j < cs.length; j++) {
        const prop = cs[j];
        let value = cs.getPropertyValue(prop);
        if (prop === 'font-family') value = sanitizeFontFamilyForExport(value);
        cssText += `${prop}:${value};`;
      }
      targetAll[i].style.cssText = cssText;

      const tag = sourceAll[i].tagName;
      if (tag === 'INPUT') {
        targetAll[i].setAttribute('value', sourceAll[i].value);
      } else if (tag === 'TEXTAREA') {
        // <textarea> ignora o atributo value pra exibição — precisa do
        // conteúdo de texto de verdade.
        targetAll[i].textContent = sourceAll[i].value;
      }
    }
  }

  /**
   * Exporta um nó do DOM (um <svg> real, como o do heredograma, OU um container
   * de <div>s comuns, como a grade do cariótipo) como um arquivo PNG baixável.
   * @param {Element} sourceNode Nó a exportar — deve estar atualmente visível na página.
   * @param {string} filename Nome do arquivo baixado (com extensão .png).
   */
  /**
   * BUGFIX (canvas contaminado — afetava cariótipo e agora também o
   * simulador): SVG com <foreignObject> embutindo HTML é tratado como
   * "inseguro" pelo navegador na hora de LER os pixels de volta do canvas
   * (toBlob/toDataURL) — mesmo o conteúdo sendo 100% local, sem nenhum
   * recurso de origem cruzada de verdade envolvido. Isso não é uma falha de
   * rede nem de fonte: é assim que o navegador trata QUALQUER
   * SVG+foreignObject por padrão, sempre. Descobri isso tentando exportar o
   * simulador — e ao investigar, achei que o export de cariótipo (que já
   * existia antes, mesmo mecanismo) tinha o mesmo problema, silenciosamente
   * quebrado.
   *
   * O heredograma nunca teve esse problema porque é SVG NATIVO de verdade
   * (sem foreignObject) — por isso esse caminho continua rasterizando via
   * canvas normalmente, é comprovadamente confiável.
   *
   * Para conteúdo baseado em <div> (cariótipo, simulador), a correção evita
   * o canvas por completo: baixa o SVG serializado diretamente como arquivo
   * .svg. Abre normal em qualquer navegador/leitor de imagem moderno, e dá
   * pra inserir direto no Google Slides/Docs e no Word (2016+) — não é um
   * PNG raster de verdade, mas é 100% confiável, o que vale mais aqui.
   */
  function downloadSvgBlob(svgMarkup, filename) {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename.replace(/\.png$/i, '.svg');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  function exportNodeAsPng(sourceNode, filename) {
    if (!sourceNode) return;
    const isSvg = sourceNode.tagName && sourceNode.tagName.toLowerCase() === 'svg';
    const rect = sourceNode.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width)) || 600;
    const height = Math.max(1, Math.round(rect.height)) || 400;
    const scale = 2; // exporta em resolução dobrada (nítido em telas retina/impressão)
    const bgColor = getComputedStyle(document.body).getPropertyValue('background-color') || '#ffffff';

    let clone;
    try {
      clone = sourceNode.cloneNode(true);
      inlineComputedStylesDeep(sourceNode, clone);
    } catch (e) {
      console.error('Erro ao clonar/estilizar nó para exportação:', e);
      return;
    }

    const svgNS = 'http://www.w3.org/2000/svg';
    let svgEl;
    if (isSvg) {
      svgEl = clone;
      svgEl.setAttribute('width', width);
      svgEl.setAttribute('height', height);
      svgEl.setAttribute('xmlns', svgNS);
      const bgRect = document.createElementNS(svgNS, 'rect');
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
      bgRect.setAttribute('fill', bgColor);
      svgEl.insertBefore(bgRect, svgEl.firstChild);
    } else {
      svgEl = document.createElementNS(svgNS, 'svg');
      svgEl.setAttribute('xmlns', svgNS);
      svgEl.setAttribute('width', width);
      svgEl.setAttribute('height', height);
      const bgRect = document.createElementNS(svgNS, 'rect');
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
      bgRect.setAttribute('fill', bgColor);
      svgEl.appendChild(bgRect);
      const fo = document.createElementNS(svgNS, 'foreignObject');
      fo.setAttribute('width', '100%');
      fo.setAttribute('height', '100%');
      clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      fo.appendChild(clone);
      svgEl.appendChild(fo);
    }

    let svgMarkup;
    try {
      svgMarkup = new XMLSerializer().serializeToString(svgEl);
    } catch (e) {
      console.error('Erro ao serializar SVG para exportação:', e);
      return;
    }

    // Conteúdo com foreignObject (isSvg === false) baixa direto como .svg —
    // ver bloco de comentário grande acima. Só SVG nativo de verdade segue
    // pro canvas/PNG, que continua confiável nesse caso.
    if (!isSvg) {
      downloadSvgBlob(svgMarkup, filename);
      return;
    }

    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }, 'image/png');
    };
    img.onerror = (e) => {
      console.error('Erro ao carregar SVG serializado para exportação:', e);
      URL.revokeObjectURL(svgUrl);
      if (typeof Swal !== 'undefined') {
        Swal.fire({ icon: 'error', title: 'Não foi possível exportar a imagem.' });
      }
    };
    img.src = svgUrl;
  }

  /** Constrói a tabela HTML do quadro de Punnett (gametas nas bordas, genótipos nas células, coloridas por fenótipo). */
  function renderPunnettGrid(result) {
    const table = document.createElement('table');
    table.className = 'mendel-punnett-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.appendChild(document.createElement('th')); // canto vazio
    result.gametes2.forEach((g) => {
      const th = document.createElement('th');
      th.textContent = g;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    result.cells.forEach((row, i) => {
      const tr = document.createElement('tr');
      const rowHeader = document.createElement('th');
      rowHeader.textContent = result.gametes1[i];
      tr.appendChild(rowHeader);

      row.forEach((cell) => {
        const td = document.createElement('td');
        td.className = 'mendel-cell';
        const color = colorForPhenotype(cell.phenotypeDisplay);
        td.style.backgroundColor = hexToRgba(color, 0.12);
        td.style.borderColor     = hexToRgba(color, 0.45);
        td.title = cell.phenotypeDisplay;
        const span = document.createElement('span');
        span.className = 'mendel-cell-genotype';
        span.style.color = color;
        span.textContent = cell.genotypeDisplay;
        td.appendChild(span);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  /** Preenche uma lista <ul> com a proporção (genotípica ou fenotípica) já formatada e, opcionalmente, colorida. */
  function renderMendelTallyList(listEl, tally, total, withColor) {
    listEl.innerHTML = '';
    mendelFormatTally(tally, total).forEach(({ label, count, ratio, percent }) => {
      const li = document.createElement('li');
      if (withColor) {
        const swatch = document.createElement('span');
        swatch.className = 'lab-swatch';
        swatch.style.background = colorForPhenotype(label);
        li.appendChild(swatch);
      }
      const text = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = String(ratio);
      text.appendChild(strong);
      text.append(` parte(s) — ${label} `);
      const detail = document.createElement('span');
      detail.className = 'lab-tally-detail';
      detail.textContent = `(${count}/${total} · ${percent}%)`;
      text.appendChild(detail);
      li.appendChild(text);
      listEl.appendChild(li);
    });
  }

  /** Gera uma frase curta e genérica descrevendo o resultado (nº de classes, proporção simplificada). */
  function generateMendelExplanation(result) {
    const genoClasses  = result.genotypeTally.size;
    const phenoClasses = result.phenotypeTally.size;
    const ratioStr = mendelFormatTally(result.phenotypeTally, result.total).map(f => f.ratio).join(' : ');
    return `Este cruzamento gera ${genoClasses} classe(s) genotípica(s) e ${phenoClasses} classe(s) ` +
      `fenotípica(s) distintas, na proporção ${ratioStr} (de ${result.total} combinações possíveis no quadro).`;
  }

  /** Lê o formulário completo, calcula o quadro de Punnett e renderiza a grade + as proporções. */
  function generateMendelCross() {
    const els = mendel.els;
    const configs = [readMendelGeneConfig(0)];
    if (mendel.mode === 'di') configs.push(readMendelGeneConfig(1));

    for (const cfg of configs) {
      if (cfg.gene.pattern !== 'complete' && !cfg.gene.hetName) {
        showAlert('Campo obrigatório', 'Preencha o nome do fenótipo do heterozigoto (codominância/dominância incompleta) antes de gerar o quadro.');
        return;
      }
    }

    mendel.colorByPhenotype = new Map(); // recalcula as cores a cada novo cruzamento
    const genes   = configs.map(c => c.gene);
    const parent1 = configs.map(c => c.p1);
    const parent2 = configs.map(c => c.p2);
    const result  = buildPunnettSquare(genes, parent1, parent2);

    els.punnettWrapper.innerHTML = '';
    els.punnettWrapper.appendChild(renderPunnettGrid(result));
    renderMendelTallyList(els.genotypeTallyList,  result.genotypeTally,  result.total, false);
    renderMendelTallyList(els.phenotypeTallyList, result.phenotypeTally, result.total, true);
    els.explanation.textContent = generateMendelExplanation(result);
    els.results.style.display = 'block';
  }

  // ─── Heredogramas ──────────────────────────────────────────────────────────
  //
  // Gera heredogramas de 3 gerações, geneticamente consistentes, para os 4
  // padrões clássicos de herança (autossômica dominante/recessiva, ligada ao X
  // dominante/recessiva). A topologia da árvore é fixa (sempre a mesma forma),
  // então as coordenadas do desenho SVG também são fixas — só o genótipo/status
  // de afetado de cada indivíduo muda a cada geração aleatória.

  /** Sorteia um dos dois alelos de um par (transmissão mendeliana 50/50). */
  function pedigreeRandomAllele(pair) {
    return pair[Math.floor(Math.random() * 2)];
  }

  /** Genótipos dos fundadores (geração I) e dos cônjuges que entram por casamento, por padrão de herança. */
  function pedigreeFoundersForPattern(pattern) {
    switch (pattern) {
      case 'AR': return { g1m: ['A', 'a'],  g1f: ['A', 'a'],  spouseM: ['A', 'A'],   spouseF: ['A', 'A'] };
      case 'AD': return { g1m: ['A', 'a'],  g1f: ['a', 'a'],  spouseM: ['a', 'a'],   spouseF: ['a', 'a'] };
      case 'XR': return { g1m: ['XA', 'Y'], g1f: ['XA', 'Xa'], spouseM: ['XA', 'Y'],  spouseF: ['XA', 'XA'] };
      case 'XD': return { g1m: ['XA', 'Y'], g1f: ['Xa', 'Xa'], spouseM: ['Xa', 'Y'],  spouseF: ['Xa', 'Xa'] };
      default:   return null;
    }
  }

  /** Herança autossômica: o filho recebe 1 alelo aleatório de cada um dos 2 pais. */
  function pedigreeInheritAutosomal(parentA, parentB) {
    return [pedigreeRandomAllele(parentA), pedigreeRandomAllele(parentB)];
  }

  /** Herança ligada ao X: filhos recebem Y do pai + 1 X aleatório da mãe; filhas sempre recebem o único X do pai + 1 X aleatório da mãe. */
  function pedigreeInheritXLinked(father, mother, sex) {
    const momAllele = pedigreeRandomAllele(mother);
    if (sex === 'M') return [momAllele, 'Y'];
    return [father[0], momAllele];
  }

  function pedigreeCountAllele(genotype, allele) {
    return genotype.filter(a => a === allele).length;
  }

  /** Determina se um genótipo resulta em fenótipo afetado, de acordo com o padrão de herança. */
  function pedigreeIsAffected(genotype, pattern) {
    switch (pattern) {
      case 'AR': return pedigreeCountAllele(genotype, 'a') === 2;
      case 'AD': return pedigreeCountAllele(genotype, 'A') >= 1;
      case 'XR': return genotype.includes('Y') ? genotype[0] === 'Xa' : pedigreeCountAllele(genotype, 'Xa') === 2;
      case 'XD': return genotype.includes('Y') ? genotype[0] === 'XA' : pedigreeCountAllele(genotype, 'XA') >= 1;
      default:   return false;
    }
  }

  /**
   * Topologia fixa da árvore (3 gerações: 1 casal → 2 filhos que casam com
   * cônjuges externos → 4 netos) já com as coordenadas de desenho (viewBox
   * 0 0 600 380) e a numeração padrão de heredogramas (geração-posição).
   */
  const PEDIGREE_TOPOLOGY = [
    { id: 'g1m',    sex: 'M', gen: 1, parents: null,                  x: 250, y: 50,  label: 'I-1' },
    { id: 'g1f',    sex: 'F', gen: 1, parents: null,                  x: 330, y: 50,  label: 'I-2' },
    { id: 'g2a_sp', sex: 'M', gen: 2, parents: null,                  x: 90,  y: 190, label: 'II-1' },
    { id: 'g2a',    sex: 'F', gen: 2, parents: ['g1m', 'g1f'],        x: 170, y: 190, label: 'II-2' },
    { id: 'g2b',    sex: 'M', gen: 2, parents: ['g1m', 'g1f'],        x: 430, y: 190, label: 'II-3' },
    { id: 'g2b_sp', sex: 'F', gen: 2, parents: null,                  x: 510, y: 190, label: 'II-4' },
    { id: 'g3a1',   sex: 'M', gen: 3, parents: ['g2a_sp', 'g2a'],     x: 130, y: 330, label: 'III-1' },
    { id: 'g3a2',   sex: 'F', gen: 3, parents: ['g2a_sp', 'g2a'],     x: 210, y: 330, label: 'III-2' },
    { id: 'g3b1',   sex: 'F', gen: 3, parents: ['g2b', 'g2b_sp'],     x: 390, y: 330, label: 'III-3' },
    { id: 'g3b2',   sex: 'M', gen: 3, parents: ['g2b', 'g2b_sp'],     x: 470, y: 330, label: 'III-4' },
  ];

  /** Linhas de conexão fixas (casamento + descendência) — sempre as mesmas, a topologia nunca muda. */
  const PEDIGREE_LINES = [
    { type: 'h', x1: 250, x2: 330, y: 50 },
    { type: 'v', x: 290, y1: 50,  y2: 120 },
    { type: 'h', x1: 170, x2: 430, y: 120 },
    { type: 'v', x: 170, y1: 120, y2: 190 },
    { type: 'v', x: 430, y1: 120, y2: 190 },
    { type: 'h', x1: 90,  x2: 170, y: 190 },
    { type: 'h', x1: 430, x2: 510, y: 190 },
    { type: 'v', x: 130, y1: 190, y2: 260 },
    { type: 'h', x1: 130, x2: 210, y: 260 },
    { type: 'v', x: 130, y1: 260, y2: 330 },
    { type: 'v', x: 210, y1: 260, y2: 330 },
    { type: 'v', x: 470, y1: 190, y2: 260 },
    { type: 'h', x1: 390, x2: 470, y: 260 },
    { type: 'v', x: 390, y1: 260, y2: 330 },
    { type: 'v', x: 470, y1: 260, y2: 330 },
  ];

  /** Calcula o genótipo de um filho a partir dos dois genótipos dos pais, de acordo com o padrão de herança. */
  function pedigreeInherit(parentAGenotype, parentBGenotype, childSex, pattern) {
    if (pattern === 'XR' || pattern === 'XD') {
      const father = parentAGenotype.includes('Y') ? parentAGenotype : parentBGenotype;
      const mother = parentAGenotype.includes('Y') ? parentBGenotype : parentAGenotype;
      return pedigreeInheritXLinked(father, mother, childSex);
    }
    return pedigreeInheritAutosomal(parentAGenotype, parentBGenotype);
  }

  /** Gera uma árvore genética completa (genótipo + status afetado de cada indivíduo) para um padrão de herança. */
  function generatePedigree(pattern) {
    const founders = pedigreeFoundersForPattern(pattern);
    const genotypes = {
      g1m: founders.g1m, g1f: founders.g1f,
      g2a_sp: founders.spouseM, g2b_sp: founders.spouseF,
    };

    for (const person of PEDIGREE_TOPOLOGY) {
      if (person.parents) {
        const [pA, pB] = person.parents;
        genotypes[person.id] = pedigreeInherit(genotypes[pA], genotypes[pB], person.sex, pattern);
      }
    }

    return PEDIGREE_TOPOLOGY.map(p => ({
      ...p, genotype: genotypes[p.id], affected: pedigreeIsAffected(genotypes[p.id], pattern),
    }));
  }

  /**
   * Gera heredogramas repetidamente (até maxTries vezes) até achar um que seja
   * pedagogicamente interessante — com pelo menos 1 indivíduo afetado E 1 não
   * afetado. Evita o caso raro (mas possível) de uma árvore totalmente uniforme,
   * que não ilustra bem o padrão de herança.
   */
  function generateInterestingPedigree(pattern, maxTries) {
    let last = null;
    for (let i = 0; i < maxTries; i++) {
      const individuals = generatePedigree(pattern);
      const affectedCount = individuals.filter(p => p.affected).length;
      last = individuals;
      if (affectedCount >= 1 && affectedCount <= individuals.length - 1) return individuals;
    }
    return last;
  }

  /** Desenha o heredograma como SVG: linhas de conexão fixas + símbolos (quadrado=M, círculo=F) coloridos por status. */
  function renderPedigreeSvg(individuals) {
    const R = 16;
    let svg = '<svg viewBox="0 0 600 380" xmlns="http://www.w3.org/2000/svg" role="img" ' +
      'aria-label="Heredograma de 3 gerações">';

    PEDIGREE_LINES.forEach((line) => {
      if (line.type === 'h') {
        svg += `<line class="pedigree-line" x1="${line.x1}" y1="${line.y}" x2="${line.x2}" y2="${line.y}" />`;
      } else {
        svg += `<line class="pedigree-line" x1="${line.x}" y1="${line.y1}" x2="${line.x}" y2="${line.y2}" />`;
      }
    });

    individuals.forEach((person) => {
      const cls = person.affected ? 'pedigree-symbol-affected' : 'pedigree-symbol-unaffected';
      if (person.sex === 'F') {
        svg += `<circle class="${cls}" cx="${person.x}" cy="${person.y}" r="${R}" />`;
      } else {
        svg += `<rect class="${cls}" x="${person.x - R}" y="${person.y - R}" width="${R * 2}" height="${R * 2}" />`;
      }
      svg += `<text class="pedigree-label" x="${person.x}" y="${person.y + R + 16}">${person.label}</text>`;
    });

    svg += '</svg>';
    return svg;
  }

  // ─── Camada de DOM: alternância estudo/quiz e feedback das respostas ─────────

  const PEDIGREE_PATTERN_NAMES = {
    AD: 'Autossômica Dominante', AR: 'Autossômica Recessiva',
    XR: 'Ligada ao X Recessiva', XD: 'Ligada ao X Dominante',
  };

  const PEDIGREE_PATTERN_EXPLANATIONS = {
    AD: 'A característica aparece em praticamente toda geração, já que basta um alelo dominante para se ' +
      'manifestar. Um indivíduo afetado geralmente tem pelo menos um dos pais também afetado.',
    AR: 'A característica pode "pular" gerações: dois pais não afetados (portadores heterozigotos) podem ter ' +
      'filhos afetados, já que são necessários dois alelos recessivos para a manifestação.',
    XR: 'É bem mais comum em homens, já que eles só precisam de uma cópia do alelo recessivo (são hemizigotos). ' +
      'Mulheres portadoras (heterozigotas) não são afetadas, mas podem transmitir a característica aos filhos.',
    XD: 'Um pai afetado transmite a característica para 100% das filhas (que sempre recebem seu único X) e ' +
      'nenhum filho (que recebe o Y dele). Uma mãe afetada heterozigota transmite para ~50% dos filhos de ambos os sexos.',
  };

  const pedigree = { els: {}, mode: 'study', currentPattern: null, answered: false };

  /** Localiza e armazena os elementos da ferramenta de heredogramas (uma única vez). */
  function cachePedigreeElements() {
    pedigree.els = {
      modeStudyBtn:    document.getElementById('pedigree-mode-study'),
      modeQuizBtn:     document.getElementById('pedigree-mode-quiz'),
      studyControls:   document.getElementById('pedigree-study-controls'),
      quizControls:    document.getElementById('pedigree-quiz-controls'),
      patternSelect:   document.getElementById('pedigree-pattern-select'),
      quizAnswersWrap: document.getElementById('pedigree-quiz-answers'),
      svgWrapper:      document.getElementById('pedigree-svg-wrapper'),
      infoText:        document.getElementById('pedigree-info-text'),
      feedback:        document.getElementById('pedigree-feedback'),
    };
  }

  /** Alterna entre Modo Estudo (padrão escolhido, revelado) e Modo Quiz (padrão sorteado, escondido até responder). */
  function setPedigreeMode(mode) {
    if (!pedigree.els.modeStudyBtn) cachePedigreeElements();
    pedigree.mode = mode;
    const isQuiz = mode === 'quiz';
    const els = pedigree.els;

    els.modeStudyBtn.classList.toggle('active', !isQuiz);
    els.modeQuizBtn.classList.toggle('active', isQuiz);
    els.modeStudyBtn.setAttribute('aria-pressed', String(!isQuiz));
    els.modeQuizBtn.setAttribute('aria-pressed', String(isQuiz));
    els.studyControls.style.display = isQuiz ? 'none' : 'flex';
    els.quizControls.style.display  = isQuiz ? 'flex' : 'none';
    els.quizAnswersWrap.style.display = 'none';
    els.feedback.style.display = 'none';
    els.svgWrapper.innerHTML = '';
    els.infoText.textContent = '';
  }

  /** Gera um heredograma no Modo Estudo: padrão escolhido pelo usuário, revelado imediatamente. */
  function generateStudyPedigree() {
    if (!pedigree.els.modeStudyBtn) cachePedigreeElements();
    const els = pedigree.els;
    const pattern = els.patternSelect.value;
    const individuals = generateInterestingPedigree(pattern, 30);

    pedigree.currentPattern = pattern;
    els.svgWrapper.innerHTML = renderPedigreeSvg(individuals);
    els.infoText.innerHTML = `<strong>${PEDIGREE_PATTERN_NAMES[pattern]}:</strong> ${PEDIGREE_PATTERN_EXPLANATIONS[pattern]}`;
    els.quizAnswersWrap.style.display = 'none';
    els.feedback.style.display = 'none';
  }

  /** Gera um heredograma no Modo Quiz: padrão sorteado aleatoriamente, escondido até o usuário responder. */
  function generateQuizPedigree() {
    if (!pedigree.els.modeStudyBtn) cachePedigreeElements();
    const els = pedigree.els;
    const patterns = ['AD', 'AR', 'XR', 'XD'];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const individuals = generateInterestingPedigree(pattern, 30);

    pedigree.currentPattern = pattern;
    pedigree.answered = false;
    els.svgWrapper.innerHTML = renderPedigreeSvg(individuals);
    els.infoText.textContent = 'Observe o heredograma e escolha o padrão de herança abaixo.';
    els.quizAnswersWrap.style.display = 'block';
    els.feedback.style.display = 'none';
    els.quizAnswersWrap.querySelectorAll('.crispr-pathway-card').forEach((btn) => {
      btn.classList.remove('pedigree-answer-correct', 'pedigree-answer-wrong');
      btn.disabled = false;
    });
  }

  /** Processa a resposta do usuário no Modo Quiz: marca certo/errado nos botões e mostra o feedback explicativo. */
  function answerPedigreeQuiz(chosenPattern) {
    if (pedigree.answered || !pedigree.currentPattern) return;
    pedigree.answered = true;
    const els = pedigree.els;
    const correct = chosenPattern === pedigree.currentPattern;

    els.quizAnswersWrap.querySelectorAll('.crispr-pathway-card').forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.answer === pedigree.currentPattern) btn.classList.add('pedigree-answer-correct');
      else if (btn.dataset.answer === chosenPattern)      btn.classList.add('pedigree-answer-wrong');
    });

    els.feedback.className = 'pedigree-feedback ' + (correct ? 'correct' : 'incorrect');
    els.feedback.innerHTML = (correct
        ? '✅ Correto! '
        : `❌ Não foi dessa vez. O padrão correto é <strong>${PEDIGREE_PATTERN_NAMES[pedigree.currentPattern]}</strong>. `) +
      PEDIGREE_PATTERN_EXPLANATIONS[pedigree.currentPattern];
    els.feedback.style.display = 'block';
  }

  // ─── Genética Populacional (Hardy-Weinberg) ──────────────────────────────────
  //
  // Calculadora de frequências alélicas/genotípicas sob o Princípio de
  // Hardy-Weinberg, com 3 modos: a partir da frequência do fenótipo recessivo
  // (q²), a partir da frequência alélica (p), e um teste de equilíbrio via
  // qui-quadrado comparando genótipos observados numa amostra contra os
  // esperados sob Hardy-Weinberg (útil com marcadores codominantes, onde os
  // 3 genótipos são distinguíveis por fenótipo — ex.: grupos sanguíneos MN).

  /** Calcula p, q e as frequências genotípicas a partir da frequência do fenótipo recessivo (q²). */
  function hwFromQSquared(qSquared) {
    const q = Math.sqrt(qSquared);
    const p = 1 - q;
    return { p, q, pSquared: p * p, twoPQ: 2 * p * q, qSquared: q * q };
  }

  /** Calcula q e as frequências genotípicas a partir da frequência do alelo dominante (p). */
  function hwFromP(p) {
    const q = 1 - p;
    return { p, q, pSquared: p * p, twoPQ: 2 * p * q, qSquared: q * q };
  }

  /** Calcula as frequências alélicas REAIS (contagem direta de alelos) a partir das contagens genotípicas observadas. */
  function hwObservedFrequencies(countAA, countAa, countaa) {
    const total = countAA + countAa + countaa;
    const p = (2 * countAA + countAa) / (2 * total);
    const q = (2 * countaa + countAa) / (2 * total);
    return { total, p, q };
  }

  /**
   * Testa se uma amostra está em equilíbrio de Hardy-Weinberg: calcula as frequências
   * alélicas observadas, as frequências genotípicas ESPERADAS sob HW, e compara com
   * as contagens observadas via teste de qui-quadrado (1 grau de liberdade: 3 classes
   * genotípicas − 1 − 1 parâmetro estimado (p); valor crítico 3,841 para α=0,05).
   */
  function hwChiSquare(countAA, countAa, countaa) {
    const { total, p, q } = hwObservedFrequencies(countAA, countAa, countaa);
    const expectedAA = p * p * total;
    const expectedAa = 2 * p * q * total;
    const expectedaa = q * q * total;
    const chiSquare =
      Math.pow(countAA - expectedAA, 2) / expectedAA +
      Math.pow(countAa - expectedAa, 2) / expectedAa +
      Math.pow(countaa - expectedaa, 2) / expectedaa;
    const criticalValue = 3.841;
    return {
      expectedAA, expectedAa, expectedaa, chiSquare, criticalValue,
      inEquilibrium: chiSquare <= criticalValue, p, q, total,
    };
  }

  // ─── Camada de DOM: alternância de modos, cálculo e renderização dos resultados ─

  const popgen = { els: {}, mode: 'qsquared' };

  /** Localiza e armazena os elementos da calculadora de genética populacional (uma única vez). */
  function cachePopgenElements() {
    popgen.els = {
      modeQsquaredBtn: document.getElementById('popgen-mode-qsquared'),
      modePBtn:        document.getElementById('popgen-mode-p'),
      modeTestBtn:     document.getElementById('popgen-mode-test'),
      panelQsquared:   document.getElementById('popgen-panel-qsquared'),
      panelP:          document.getElementById('popgen-panel-p'),
      panelTest:       document.getElementById('popgen-panel-test'),
      results:         document.getElementById('popgen-results'),
      alleleFreqs:     document.getElementById('popgen-allele-freqs'),
      bar:             document.getElementById('popgen-bar'),
      barLegend:       document.getElementById('popgen-bar-legend'),
      tableWrap:       document.getElementById('popgen-table-wrap'),
      explanation:     document.getElementById('popgen-explanation'),
    };
  }

  /** Alterna entre os 3 modos da calculadora, mostrando o painel de entrada correspondente. */
  function setPopgenMode(mode) {
    if (!popgen.els.modeQsquaredBtn) cachePopgenElements();
    popgen.mode = mode;
    const els = popgen.els;

    els.modeQsquaredBtn.classList.toggle('active', mode === 'qsquared');
    els.modePBtn.classList.toggle('active', mode === 'p');
    els.modeTestBtn.classList.toggle('active', mode === 'test');
    els.modeQsquaredBtn.setAttribute('aria-pressed', String(mode === 'qsquared'));
    els.modePBtn.setAttribute('aria-pressed', String(mode === 'p'));
    els.modeTestBtn.setAttribute('aria-pressed', String(mode === 'test'));

    els.panelQsquared.style.display = mode === 'qsquared' ? 'block' : 'none';
    els.panelP.style.display        = mode === 'p' ? 'block' : 'none';
    els.panelTest.style.display     = mode === 'test' ? 'block' : 'none';
    els.results.style.display = 'none';
  }

  /** Renderiza os dois cartões de frequência alélica (p e q) em destaque. */
  function renderPopgenAlleleFreqs(p, q) {
    popgen.els.alleleFreqs.innerHTML = `
      <div class="popgen-stat-card">
        <span class="popgen-stat-label">Alelo dominante (p)</span>
        <span class="popgen-stat-value">${(p * 100).toFixed(2)}%</span>
      </div>
      <div class="popgen-stat-card">
        <span class="popgen-stat-label">Alelo recessivo (q)</span>
        <span class="popgen-stat-value">${(q * 100).toFixed(2)}%</span>
      </div>`;
  }

  /** Renderiza a barra de proporção empilhada (p² / 2pq / q²) e sua legenda. */
  function renderPopgenBar(pSquared, twoPQ, qSquared) {
    const segments = [
      { pct: pSquared * 100, color: '#1e88e5', label: 'p² — Homozigoto dominante (AA)' },
      { pct: twoPQ * 100,    color: '#f59e0b', label: '2pq — Heterozigoto, portador (Aa)' },
      { pct: qSquared * 100, color: '#e53935', label: 'q² — Homozigoto recessivo (aa)' },
    ];
    popgen.els.bar.innerHTML = segments.map(s =>
      `<div class="popgen-bar-segment" style="width:${s.pct}%;background:${s.color};">` +
      `${s.pct >= 8 ? s.pct.toFixed(1) + '%' : ''}</div>`
    ).join('');
    popgen.els.barLegend.innerHTML = segments.map(s =>
      `<span class="legend-item"><span class="lab-swatch" style="background:${s.color};"></span>${s.label} (${s.pct.toFixed(2)}%)</span>`
    ).join('');
  }

  /** Renderiza a tabela simples de frequências genotípicas (modos 1 e 2), com contagens esperadas se N for dado. */
  function renderPopgenGenotypeTable(pSquared, twoPQ, qSquared, n) {
    const hasN = n && n > 0;
    let html = '<table><thead><tr><th>Genótipo</th><th>Frequência</th>' + (hasN ? '<th>Indivíduos esperados</th>' : '') + '</tr></thead><tbody>';
    const rows = [
      ['AA (homozigoto dominante)', pSquared],
      ['Aa (heterozigoto)', twoPQ],
      ['aa (homozigoto recessivo)', qSquared],
    ];
    rows.forEach(([label, freq]) => {
      html += `<tr><td>${label}</td><td>${(freq * 100).toFixed(2)}%</td>` +
        (hasN ? `<td>${Math.round(freq * n)}</td>` : '') + '</tr>';
    });
    html += '</tbody></table>';
    popgen.els.tableWrap.innerHTML = html;
  }

  /** Calcula e exibe o resultado a partir da frequência do fenótipo recessivo (Modo 1). */
  function calcPopgenFromQSquared() {
    if (!popgen.els.alleleFreqs) cachePopgenElements();
    const n = Number(document.getElementById('popgen-n').value) || 0;
    const affected = Number(document.getElementById('popgen-affected').value) || 0;
    if (n <= 0 || affected < 0 || affected > n) {
      showAlert('Valores inválidos', 'Confira o tamanho da população e o número de afetados (não pode ser maior que a população).');
      return;
    }
    const qSquared = affected / n;
    const r = hwFromQSquared(qSquared);

    renderPopgenAlleleFreqs(r.p, r.q);
    renderPopgenBar(r.pSquared, r.twoPQ, r.qSquared);
    renderPopgenGenotypeTable(r.pSquared, r.twoPQ, r.qSquared, n);

    const carrierCount = Math.round(r.twoPQ * n);
    popgen.els.explanation.innerHTML = `Com <strong>${affected}</strong> afetados em <strong>${n}</strong> ` +
      `indivíduos, q² = ${qSquared.toFixed(6)}, logo q = ${r.q.toFixed(4)} e p = ${r.p.toFixed(4)}. ` +
      `Aproximadamente <strong>${carrierCount}</strong> indivíduos (${(r.twoPQ * 100).toFixed(2)}%) devem ser ` +
      `portadores heterozigotos — não afetados, mas capazes de transmitir o alelo recessivo.`;
    popgen.els.results.style.display = 'block';
  }

  /** Calcula e exibe o resultado a partir da frequência alélica p informada diretamente (Modo 2). */
  function calcPopgenFromP() {
    if (!popgen.els.alleleFreqs) cachePopgenElements();
    const p = Number(document.getElementById('popgen-p-input').value);
    const n = Number(document.getElementById('popgen-n2').value) || 0;
    if (isNaN(p) || p < 0 || p > 1) {
      showAlert('Valor inválido', 'A frequência alélica p deve ser um número entre 0 e 1.');
      return;
    }
    const r = hwFromP(p);

    renderPopgenAlleleFreqs(r.p, r.q);
    renderPopgenBar(r.pSquared, r.twoPQ, r.qSquared);
    renderPopgenGenotypeTable(r.pSquared, r.twoPQ, r.qSquared, n);

    popgen.els.explanation.innerHTML = `Com p = ${r.p.toFixed(4)}, a frequência do alelo recessivo é ` +
      `q = 1 − p = ${r.q.toFixed(4)}. As frequências genotípicas esperadas seguem diretamente de ` +
      `p² + 2pq + q² = 1.`;
    popgen.els.results.style.display = 'block';
  }

  /** Testa o equilíbrio de Hardy-Weinberg a partir de contagens genotípicas observadas (Modo 3). */
  function testPopgenEquilibrium() {
    if (!popgen.els.alleleFreqs) cachePopgenElements();
    const countAA = Number(document.getElementById('popgen-count-aa').value);
    const countAa = Number(document.getElementById('popgen-count-het').value);
    const countaa = Number(document.getElementById('popgen-count-rec').value);
    if ([countAA, countAa, countaa].some(v => isNaN(v) || v < 0) || (countAA + countAa + countaa) === 0) {
      showAlert('Valores inválidos', 'Digite contagens genotípicas válidas (números não-negativos, soma maior que zero).');
      return;
    }

    const r = hwChiSquare(countAA, countAa, countaa);
    renderPopgenAlleleFreqs(r.p, r.q);
    renderPopgenBar(r.p * r.p, 2 * r.p * r.q, r.q * r.q);

    let html = '<table><thead><tr><th>Genótipo</th><th>Observado</th><th>Esperado (HW)</th></tr></thead><tbody>';
    html += `<tr><td>AA</td><td>${countAA}</td><td>${r.expectedAA.toFixed(1)}</td></tr>`;
    html += `<tr><td>Aa</td><td>${countAa}</td><td>${r.expectedAa.toFixed(1)}</td></tr>`;
    html += `<tr><td>aa</td><td>${countaa}</td><td>${r.expectedaa.toFixed(1)}</td></tr>`;
    html += `<tr><td>Total</td><td>${r.total}</td><td>${r.total}</td></tr>`;
    html += '</tbody></table>';
    popgen.els.tableWrap.innerHTML = html;

    const verdictClass = r.inEquilibrium ? 'in-equilibrium' : 'out-equilibrium';
    const verdictText = r.inEquilibrium
      ? 'CONSISTENTE com o equilíbrio de Hardy-Weinberg'
      : 'FORA do equilíbrio de Hardy-Weinberg';
    popgen.els.explanation.innerHTML = `Qui-quadrado (χ²) = <strong>${r.chiSquare.toFixed(3)}</strong>, valor ` +
      `crítico = 3,841 (1 grau de liberdade, α = 0,05). Como ${r.chiSquare.toFixed(3)} ` +
      `${r.inEquilibrium ? '≤' : '>'} 3,841, essa amostra é ` +
      `<span class="popgen-verdict ${verdictClass}">${verdictText}</span>. ` +
      (r.inEquilibrium
        ? 'As diferenças entre observado e esperado são pequenas o bastante para serem atribuídas ao acaso.'
        : 'As diferenças são grandes demais para serem só acaso — algo está violando as condições de equilíbrio (seleção, deriva, migração, acasalamento não-aleatório ou mutação).');
    popgen.els.results.style.display = 'block';
  }

  // ─── Cariótipo e Não-disjunção ────────────────────────────────────────────────
  //
  // Visualizador de cariótipo (normal e aneuploidias clássicas) + simulador de
  // não-disjunção meiótica. A "não-disjunção" gera gametas com número anormal
  // de cromossomos (n+1 ou n−1); ao fertilizar com um gameta normal do outro
  // genitor, o zigoto resultante é uma trissomia ou monossomia — o mesmo motor
  // de contagem de cromossomos é reaproveitado tanto para os cariótipos
  // pré-definidos (Down, Turner...) quanto para os gerados pela simulação.

  /** Tamanhos relativos aproximados (Mb) dos 22 autossomos + X/Y, só para escala visual das barras. */
  const CHROMOSOME_SIZES = {
    1: 249, 2: 243, 3: 198, 4: 190, 5: 182, 6: 171, 7: 159, 8: 145, 9: 138, 10: 134,
    11: 135, 12: 133, 13: 114, 14: 107, 15: 102, 16: 90, 17: 83, 18: 80, 19: 59,
    20: 64, 21: 47, 22: 51, X: 155, Y: 57,
  };

  /** Classificação clássica de Denver: 7 grupos (A-G) por tamanho decrescente. X entra no fim do grupo C, Y no fim do G. */
  const KARYOTYPE_GROUPS = [
    { name: 'A', chromosomes: [1, 2, 3] },
    { name: 'B', chromosomes: [4, 5] },
    { name: 'C', chromosomes: [6, 7, 8, 9, 10, 11, 12] },
    { name: 'D', chromosomes: [13, 14, 15] },
    { name: 'E', chromosomes: [16, 17, 18] },
    { name: 'F', chromosomes: [19, 20] },
    { name: 'G', chromosomes: [21, 22] },
  ];

  const KARYOTYPE_CONDITIONS = {
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

  /** Retorna, para cada autossomo 1-22, quantas cópias existem (2 normalmente, ou o valor da anomalia). */
  function getAutosomeCounts(condition) {
    const counts = {};
    for (let i = 1; i <= 22; i++) counts[i] = 2;
    if (condition.autosomeAnomaly) counts[condition.autosomeAnomaly.chr] = condition.autosomeAnomaly.count;
    return counts;
  }

  /** Conta o total de cromossomos de um cariótipo (autossomos + sexuais) — única fonte de verdade da contagem. */
  function totalChromosomeCount(condition) {
    const autosomeCounts = getAutosomeCounts(condition);
    const autosomeTotal = Object.values(autosomeCounts).reduce((a, b) => a + b, 0);
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
    const totalCount = gameteCount + 1;
    const sexChromosomes = sex === 'F' ? ['X', 'X'] : ['X', 'Y'];
    const condition = { sexChromosomes, autosomeAnomaly: totalCount === 2 ? null : { chr, count: totalCount } };
    const total = totalChromosomeCount(condition);
    const notation = totalCount === 2
      ? `46,${sex === 'F' ? 'XX' : 'XY'}`
      : `${total},${sex === 'F' ? 'XX' : 'XY'},${totalCount > 2 ? '+' : '-'}${chr}`;

    let description;
    if (totalCount === 3) {
      const known = Object.values(KARYOTYPE_CONDITIONS).find(c => c.autosomeAnomaly && c.autosomeAnomaly.chr === chr);
      description = known ? known.description : `Trissomia do cromossomo ${chr}.`;
    } else if (totalCount === 1) {
      description = `Monossomia do cromossomo ${chr}. Monossomias autossômicas completas são, em geral, ` +
        `incompatíveis com o desenvolvimento até o nascimento — a maioria termina em aborto espontâneo precoce.`;
    } else {
      description = 'Cariótipo com número normal de cromossomos para este par.';
    }

    return {
      label: totalCount === 3 ? `Trissomia do ${chr}` : totalCount === 1 ? `Monossomia do ${chr}` : 'Normal',
      notation, sexChromosomes, autosomeAnomaly: condition.autosomeAnomaly, description,
    };
  }

  // ─── Camada de DOM: renderização da grade de cariótipo e do simulador ────────

  const karyo = { els: {} };

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
    const autosomeCounts = getAutosomeCounts(condition);
    const maxSize = CHROMOSOME_SIZES[1];
    const maxBarHeight = 70;
    const minBarHeight = 16;
    const barHeight = (size) => Math.max(minBarHeight, Math.round((size / maxSize) * maxBarHeight));

    const buildSlot = (label, count, sizeKey, isAnomaly, extraClass) => {
      let bars = '';
      for (let i = 0; i < count; i++) {
        const cls = 'karyo-bar' + (extraClass ? ' ' + extraClass : '') + (isAnomaly ? ' karyo-bar-anomaly' : '');
        bars += `<div class="${cls}" style="height:${barHeight(CHROMOSOME_SIZES[sizeKey])}px;"></div>`;
      }
      return `<div class="karyo-slot"><div class="karyo-slot-bars">${bars}</div><span class="karyo-slot-label">${label}</span></div>`;
    };

    let html = '';
    KARYOTYPE_GROUPS.forEach((group) => {
      html += '<div class="karyo-row">';
      group.chromosomes.forEach((chrNum) => {
        const isAnomaly = !!(condition.autosomeAnomaly && condition.autosomeAnomaly.chr === chrNum);
        html += buildSlot(String(chrNum), autosomeCounts[chrNum], chrNum, isAnomaly, '');
      });
      if (group.name === 'C') {
        const xCount = condition.sexChromosomes.filter(c => c === 'X').length;
        if (xCount > 0) html += buildSlot('X', xCount, 'X', false, 'karyo-bar-x');
      }
      if (group.name === 'G') {
        const yCount = condition.sexChromosomes.filter(c => c === 'Y').length;
        if (yCount > 0) html += buildSlot('Y', yCount, 'Y', false, 'karyo-bar-y');
      }
      html += '</div>';
    });
    containerEl.innerHTML = html;
  }

  /** Exibe o cariótipo selecionado no visualizador principal. */
  function viewSelectedKaryotype() {
    if (!karyo.els.grid) cacheKaryotypeElements();
    const condition = KARYOTYPE_CONDITIONS[karyo.els.conditionSelect.value];
    karyo.els.notation.textContent = `${condition.notation} — ${totalChromosomeCount(condition)} cromossomos`;
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
    const els = karyo.els;
    const mode = karyo.nondisMode || 'MI';
    const gametes = simulateNondisjunction(mode);

    els.gametesWrap.innerHTML = gametes.map((g) => {
      const isAbnormal = g.count !== 1;
      let bars = '';
      for (let i = 0; i < g.count; i++) bars += '<div class="karyo-bar" style="height:28px;width:9px;"></div>';
      const btn = isAbnormal
        ? `<button type="button" class="nondis-gamete-btn" data-count="${g.count}">Ver cariótipo resultante</button>`
        : '';
      return `<div class="nondis-gamete-card ${isAbnormal ? 'abnormal' : ''}">` +
        `<div class="nondis-gamete-bars">${bars}</div>` +
        `<span class="nondis-gamete-label">${g.kind} (${g.count} cópia${g.count === 1 ? '' : 's'})</span>${btn}</div>`;
    }).join('');

    els.gametesWrap.querySelectorAll('.nondis-gamete-btn').forEach((btn) => {
      btn.addEventListener('click', () => showNondisjunctionResult(Number(btn.dataset.count)));
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
    const els = karyo.els;
    const chr = Number(els.chrSelect.value);
    const sex = els.sexSelect.value;
    const result = karyotypeFromFertilization(chr, gameteCount, sex);

    els.karyoResultNotation.textContent = `${result.notation} — ${totalChromosomeCount(result)} cromossomos`;
    renderKaryotypeGrid(els.karyoResultGrid, result);
    els.karyoResultDescription.textContent = result.description;
    els.karyoResultWrap.style.display = 'block';
  }

  // ─── Edição Gênica com CRISPR-Cas9 ────────────────────────────────────────────
  //
  // Módulo independente: busca um alvo (protoespaçador + PAM "NGG") na sequência
  // de DNA atual do simulador, "corta" nesse ponto e aplica uma de duas vias de
  // reparo — NHEJ (indel aleatório, tipicamente frameshift) ou HDR (inserção
  // precisa de um molde). O resultado é aplicado como uma mutação no simulador
  // principal, reaproveitando 100% do motor de análise já existente
  // (fillStrand/translate/treatSequence/classifyMutation) — o mesmo caminho
  // usado por loadDiseaseExample().

  /** Sequência de exemplo com um alvo CRISPR garantidamente válido (protoespaçador = wildDna da anemia falciforme). */
  const CRISPR_DEMO_DNA   = 'TACCTCATTTGGACCGATCGTAA';
  const CRISPR_DEMO_GUIDE = 'TACCTCATT';

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
      for (let i = 0; i < size; i++) inserted += crisprRandomBase();
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

  const crispr = {
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
      crispr.els.seqDisplay.innerHTML = `<span class="crispr-seq-plain">${escapeHtml(dnaSeq) || '(sequência vazia)'}</span>`;
      return;
    }
    const before  = dnaSeq.slice(0, target.start);
    const preCut  = dnaSeq.slice(target.start, target.cutIndex);
    const postCut = dnaSeq.slice(target.cutIndex, target.protospacerEnd);
    const pam     = dnaSeq.slice(target.protospacerEnd, target.pamEnd);
    const after   = dnaSeq.slice(target.pamEnd);

    crispr.els.seqDisplay.innerHTML =
      `<span class="crispr-seq-plain">${escapeHtml(before)}</span>` +
      `<span class="crispr-protospacer">${escapeHtml(preCut)}</span>` +
      `<span class="crispr-cut-marker" title="Ponto de corte">✂</span>` +
      `<span class="crispr-protospacer">${escapeHtml(postCut)}</span>` +
      `<span class="crispr-pam">${escapeHtml(pam)}</span>` +
      `<span class="crispr-seq-plain">${escapeHtml(after)}</span>`;
  }

  /** Reseta a busca de alvo, a escolha de via e a prévia — sem fechar o modal. */
  function resetCrisprDownstreamState() {
    const els = crispr.els;
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
    crispr.currentDna = readSequence(dnaSequenceChars);
    resetCrisprDownstreamState();
    openModalDialog(crispr.els.modal);
  }

  /** Carrega a sequência de exemplo (com alvo CRISPR garantidamente válido) no simulador. */
  function loadCrisprDemoSequence() {
    const appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();
    clearSequence();
    for (const base of CRISPR_DEMO_DNA) insertBase(base, { skipRender: true });
    translate();
    treatSequence();

    crispr.currentDna = CRISPR_DEMO_DNA;
    crispr.els.guideInput.value = CRISPR_DEMO_GUIDE;
    resetCrisprDownstreamState();
  }

  /** Busca o alvo Cas9 na sequência atual usando o RNA guia informado e atualiza a UI de resultado. */
  function searchCrisprTarget() {
    const els = crispr.els;
    resetCrisprDownstreamState();

    const guide = els.guideInput.value.trim();
    if (guide.length < 4) {
      els.result.className = 'crispr-result error';
      els.result.textContent = 'Digite um RNA guia com pelo menos 4 bases.';
      els.result.style.display = 'block';
      return;
    }

    const target = findCrisprTarget(crispr.currentDna, guide);
    if (!target) {
      els.result.className = 'crispr-result error';
      els.result.textContent = `Nenhum alvo válido encontrado. A Cas9 precisa do protoespaçador seguido ` +
        `imediatamente por um PAM no formato "NGG" (2 últimas bases = G). Tente outro guia ou carregue a ` +
        `sequência de exemplo.`;
      els.result.style.display = 'block';
      return;
    }

    crispr.target = target;
    renderCrisprSequenceDisplay(crispr.currentDna, target);
    els.result.className = 'crispr-result success';
    els.result.textContent = `Alvo encontrado! PAM "${target.pam}" reconhecido. O corte ocorrerá 3 pares de ` +
      `base a montante do PAM (marcado com ✂ acima). Escolha a via de reparo abaixo.`;
    els.result.style.display = 'block';
    els.pathways.style.display = 'block';
  }

  /** Constrói o HTML da prévia do reparo, destacando a região inserida ou deletada. */
  function renderCrisprPreview(repair, pathwayLabel) {
    const cut = crispr.target.cutIndex;
    const original = crispr.currentDna;
    let beforeHtml, afterHtml;

    if (repair.kind === 'insert') {
      beforeHtml = escapeHtml(original.slice(0, cut)) + escapeHtml(original.slice(cut));
      afterHtml  = escapeHtml(original.slice(0, cut)) +
        `<span class="crispr-diff-add">${escapeHtml(repair.changed)}</span>` +
        escapeHtml(original.slice(cut));
    } else {
      beforeHtml = escapeHtml(original.slice(0, cut)) +
        `<span class="crispr-diff-remove">${escapeHtml(repair.changed)}</span>` +
        escapeHtml(original.slice(cut + repair.size));
      afterHtml = escapeHtml(repair.edited);
    }

    const frameshiftNote = repair.size % 3 !== 0
      ? 'Como o número de bases alteradas não é múltiplo de 3, isso deve deslocar a fase de leitura (frameshift) a partir daqui.'
      : 'Como o número de bases alteradas é múltiplo de 3, a fase de leitura deve se manter intacta.';

    crispr.els.preview.innerHTML =
      `<strong>${pathwayLabel}</strong> — ${repair.kind === 'insert' ? 'inserção' : 'deleção'} de ${repair.size} base(s) no ponto de corte.<br>` +
      `Antes: <span class="crispr-preview-seq">${beforeHtml}</span>` +
      `Depois: <span class="crispr-preview-seq">${afterHtml}</span>` +
      `<em>${frameshiftNote}</em>`;
    crispr.els.preview.style.display = 'block';
    crispr.els.applyBtn.style.display = 'block';
  }

  /** Chamado ao escolher uma via de reparo (NHEJ dispara a prévia na hora; HDR pede o molde primeiro). */
  function selectCrisprPathway(pathway) {
    const els = crispr.els;
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
    const donor = crispr.els.donorInput.value.trim();
    if (donor.length < 1) {
      showAlert('Molde vazio', 'Digite uma sequência-molde (donor) para simular o reparo por HDR.');
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
    const original = crispr.currentDna;
    const edited   = crispr.pendingRepair.edited;
    const pathwayName = crispr.pathway === 'nhej' ? 'NHEJ' : 'HDR';

    const appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();

    clearAllStrandsKeepingMode();
    addButton.classList.remove('active');
    deleteButton.classList.remove('active');
    replaceButton.classList.remove('active');

    fillStrand(original, textboxDna[1], textboxRna[1], null);
    fillStrand(edited,   textboxDna[0], textboxRna[0], blankSpace);

    mutationWindow[0].classList.add('active');

    translate();
    translateStrand(textboxRna[1].getElementsByClassName('sequenceChar'), outputAminoacids[1]);
    treatSequence();

    crispr.els.modal.style.display = 'none';
    showInfo(`Edição CRISPR aplicada (${pathwayName})`, 'Veja a análise de mutação abaixo, no Simulador.');
  }

  // ─── Replicação do DNA (bolha de replicação, fita líder vs. tardia) ──────────
  //
  // Módulo independente: abre a fita de DNA atual em duas fitas-molde
  // complementares e anima a "bolha de replicação" — o garfo avançando enquanto
  // a fita líder cresce continuamente (mesmo sentido do garfo) e a fita tardia
  // cresce em fragmentos de Okazaki, depois unidos pela DNA ligase — demonstrando
  // a natureza semiconservativa da replicação (cada molécula-filha herda uma
  // fita original + uma fita nova).

  const DNA_COMPLEMENT = { A: 'T', T: 'A', C: 'G', G: 'C' };

  /** Complemento de uma única base de DNA (A↔T, C↔G) — usado para montar a fita antiparalela. */
  function complementBase(base) {
    return DNA_COMPLEMENT[base.toUpperCase()] || base;
  }

  /** Complemento de uma fita inteira, alinhada base a base com o original (visão "escada"). */
  function complementStrand(seq) {
    return seq.toUpperCase().split('').map(complementBase).join('');
  }

  const OKAZAKI_FRAGMENT_SIZE = 4;

  /** Divide o comprimento de uma fita em fragmentos de Okazaki (índices [start,end) de cada um). */
  function buildOkazakiFragments(length, fragmentSize) {
    const fragments = [];
    for (let start = 0; start < length; start += fragmentSize) {
      fragments.push({ start, end: Math.min(start + fragmentSize, length) });
    }
    return fragments;
  }

  // ─── Camada de DOM: renderização da "escada" e animação do garfo de replicação ─

  const replication = {
    els: {},
    strand1: '',
    strand2: '',
    index: 0,
    playing: false,
    timers: [],
  };

  /** Localiza e armazena os elementos do modal de replicação (uma única vez). */
  function cacheReplicationElements() {
    replication.els = {
      modal:          document.getElementById('replication-modal'),
      rowNewLagging:  document.getElementById('repl-row-new-lagging'),
      rowTemplate2:   document.getElementById('repl-row-template2'),
      forkMarker:     document.getElementById('repl-fork-marker'),
      rowTemplate1:   document.getElementById('repl-row-template1'),
      rowNewLeading:  document.getElementById('repl-row-new-leading'),
      captionTop:     document.getElementById('repl-daughter-caption-2'),
      captionBottom:  document.getElementById('repl-daughter-caption-1'),
      status:         document.getElementById('repl-status'),
      playIcon:       document.getElementById('repl-play-icon'),
      playLabel:      document.getElementById('repl-play-label'),
      speedSelect:    document.getElementById('repl-speed'),
    };
  }

  /** Cancela todos os timers de animação pendentes — usado por pause/reset/close. */
  function clearReplicationTimers() {
    replication.timers.forEach(clearTimeout);
    replication.timers = [];
  }

  /** Agenda uma função para daqui a `delay` ms, registrando o timer para poder cancelá-lo depois. */
  function scheduleReplication(fn, delay) {
    const id = setTimeout(fn, delay);
    replication.timers.push(id);
    return id;
  }

  /** Preenche uma linha com spans de base já definidos (usado pelas fitas-molde, sempre visíveis desde o início). */
  function renderReplicationStaticRow(container, seq) {
    container.innerHTML = '';
    seq.split('').forEach((base) => {
      const span = document.createElement('span');
      span.className = 'repl-base';
      span.textContent = base;
      container.appendChild(span);
    });
  }

  /** Preenche uma linha com spans vazios ("pendentes") — usado pelas fitas novas, reveladas conforme o garfo avança. */
  function renderReplicationPendingRow(container, length) {
    container.innerHTML = '';
    for (let i = 0; i < length; i++) {
      const span = document.createElement('span');
      span.className = 'repl-base repl-pending';
      span.textContent = '•';
      container.appendChild(span);
    }
  }

  /** Atualiza o texto/ícone do botão Play/Pause conforme o estado atual. */
  function setReplicationPlayButtonState(isPlaying) {
    const els = replication.els;
    replication.playing = isPlaying;
    els.playIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    els.playLabel.textContent = isPlaying ? 'Pause' : 'Play';
  }

  /** Move o marcador do garfo de replicação para a posição correspondente ao índice de base dado. */
  function positionReplicationFork(index) {
    const els = replication.els;
    const bases = els.rowTemplate1.querySelectorAll('.repl-base');
    if (bases.length === 0) return;
    if (index <= 0) {
      els.forkMarker.style.left = '-4px';
    } else if (index >= bases.length) {
      const last = bases[bases.length - 1];
      els.forkMarker.style.left = (last.offsetLeft + last.offsetWidth) + 'px';
    } else {
      els.forkMarker.style.left = (bases[index].offsetLeft - 2) + 'px';
    }
  }

  /** Reinicia a animação do zero (fitas-molde redesenhadas, fitas novas esvaziadas), sem fechar o modal. */
  function resetReplicationAnimation() {
    clearReplicationTimers();
    replication.index = 0;
    const els = replication.els;

    renderReplicationStaticRow(els.rowTemplate1, replication.strand1);
    renderReplicationStaticRow(els.rowTemplate2, replication.strand2);
    renderReplicationPendingRow(els.rowNewLeading, replication.strand1.length);
    renderReplicationPendingRow(els.rowNewLagging, replication.strand1.length);

    els.captionTop.style.display = 'none';
    els.captionBottom.style.display = 'none';
    els.captionTop.classList.remove('visible');
    els.captionBottom.classList.remove('visible');

    positionReplicationFork(0);
    els.status.textContent = 'Pronto para iniciar.';
    setReplicationPlayButtonState(false);
  }

  /** Abre o modal, lendo a sequência de DNA atualmente ativa no simulador como a fita-molde 1. */
  function openReplicationModal() {
    if (!replication.els.modal) cacheReplicationElements();
    if (!replication.els.modal) return;

    const dna = readSequence(dnaSequenceChars);
    if (!dna) {
      showAlert('Sequência vazia', 'Digite uma sequência de DNA no simulador antes de replicar.');
      return;
    }

    replication.strand1 = dna.toUpperCase();
    replication.strand2 = complementStrand(replication.strand1);
    resetReplicationAnimation();
    openModalDialog(replication.els.modal);
  }

  // ─── Gerador de Exercícios com Gabarito ──────────────────────────────────────
  //
  // Diferente dos outros modais de "mais ações", não depende da sequência
  // atualmente no simulador — gera as suas próprias, do zero, cada vez que
  // "Gerar" é clicado. Guarda o último lote gerado em memória (variável
  // `exerciseSet` abaixo) pra imprimir/baixar reaproveitarem sem regenerar
  // (regenerar mudaria o gabarito sem a pessoa pedir).

  let exerciseSet = [];

  function openExerciseGeneratorModal() {
    const modal = document.getElementById('exercise-generator-modal');
    openModalDialog(modal);
  }

  /** MET, PRO, PHE... → "MET–PRO–PHE" (travessão, não hífen, pra não confundir com códons negativos/intervalos). */
  function formatAminoAcidChain(aminoAcids) {
    return aminoAcids.map(aa => aa.abbrevName).join('–');
  }

  /** Preenche a prévia dentro do modal (o que a pessoa vê na tela antes de imprimir/baixar). */
  function renderExercisePreview(exercises) {
    const preview = document.getElementById('exercise-gen-preview');
    if (!preview) return;
    preview.innerHTML = '';
    exercises.forEach((ex, i) => {
      const item = document.createElement('div');
      item.className = 'exercise-gen-item';
      item.innerHTML = `
        <span class="exercise-gen-item-num">${i + 1}</span>
        <span class="exercise-gen-item-dna">DNA: ${ex.dnaSeq}</span>
        <span class="exercise-gen-item-protein">${ex.aminoAcids.length} aminoácido${ex.aminoAcids.length === 1 ? '' : 's'} — ${formatAminoAcidChain(ex.aminoAcids)}</span>
      `;
      preview.appendChild(item);
    });
  }

  /** Preenche os dois containers só-de-impressão (lista em branco pro aluno + gabarito preenchido). */
  function renderExercisePrintables(exercises) {
    const worksheetList = document.getElementById('exercise-worksheet-list');
    const answerKeyList = document.getElementById('exercise-answerkey-list');
    if (!worksheetList || !answerKeyList) return;

    worksheetList.innerHTML = '';
    answerKeyList.innerHTML = '';

    exercises.forEach((ex) => {
      const wItem = document.createElement('li');
      wItem.className = 'exercise-print-item';
      wItem.innerHTML = `
        DNA molde: <span class="exercise-print-dna">3'-${ex.dnaSeq}-5'</span><br>
        RNAm: <span class="exercise-print-blank"></span><br>
        Proteína (sequência de aminoácidos): <span class="exercise-print-blank"></span>
      `;
      worksheetList.appendChild(wItem);

      const kItem = document.createElement('li');
      kItem.className = 'exercise-print-item';
      kItem.innerHTML = `
        DNA molde: <span class="exercise-print-dna">3'-${ex.dnaSeq}-5'</span><br>
        RNAm: <span class="exercise-print-dna">5'-${ex.rna}-3'</span><br>
        Proteína: ${formatAminoAcidChain(ex.aminoAcids)}
        (${ex.aminoAcids.map(aa => aa.name).join(', ')})
      `;
      answerKeyList.appendChild(kItem);
    });
  }

  /**
   * Imprime SÓ o container `containerId` (lista de exercícios OU gabarito) —
   * ver truque de "imprimir só este elemento" em @media print, pages.css.
   * afterprint desfaz a marcação depois, disparado uma única vez por chamada
   * (não empilha listeners a cada clique).
   */
  function printExerciseContent(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.classList.add('exercise-print-active');
    document.body.classList.add('printing-exercise-set');

    const cleanup = () => {
      document.body.classList.remove('printing-exercise-set');
      container.classList.remove('exercise-print-active');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  /** Baixa lista de exercícios + gabarito juntos num único .txt — cópia rápida pra colar em outro editor. */
  function downloadExercisesAsText(exercises) {
    let text = 'LISTA DE EXERCÍCIOS — SÍNTESE DE PROTEÍNAS\n';
    text += '='.repeat(50) + '\n\n';
    exercises.forEach((ex, i) => {
      text += `${i + 1}. DNA molde: 3'-${ex.dnaSeq}-5'\n`;
      text += `   RNAm: ____________________________\n`;
      text += `   Proteína: ____________________________\n\n`;
    });

    text += '\n' + '='.repeat(50) + '\n';
    text += 'GABARITO\n';
    text += '='.repeat(50) + '\n\n';
    exercises.forEach((ex, i) => {
      text += `${i + 1}. DNA molde: 3'-${ex.dnaSeq}-5'\n`;
      text += `   RNAm: 5'-${ex.rna}-3'\n`;
      text += `   Proteína: ${formatAminoAcidChain(ex.aminoAcids)} (${ex.aminoAcids.map(aa => aa.name).join(', ')})\n\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'exercicios-sintese-proteinas.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  /**
   * Executa um único passo do garfo (uma base): revela a base nova na fita líder
   * (imediatamente, contínua) e na fita tardia (também revelada, mas colorida por
   * fragmento de Okazaki — a alternância de tom entre fragmentos vizinhos é o que
   * comunica a descontinuidade, já que a diferença real está na direção/tempo de
   * síntese de cada fragmento, difícil de representar sem uma view molecular 3D).
   */
  function stepReplication() {
    const els = replication.els;
    const length = replication.strand1.length;

    if (replication.index >= length) {
      finishReplicationLigase();
      return;
    }

    const i = replication.index;
    const speed = Number(els.speedSelect.value) || 250;

    const leadingSpan = els.rowNewLeading.children[i];
    leadingSpan.textContent = complementBase(replication.strand1[i]);
    leadingSpan.className = 'repl-base';

    const laggingSpan = els.rowNewLagging.children[i];
    laggingSpan.textContent = complementBase(replication.strand2[i]);
    const fragmentIndex = Math.floor(i / OKAZAKI_FRAGMENT_SIZE);
    laggingSpan.className = 'repl-base' + (fragmentIndex % 2 === 1 ? ' repl-fragment-alt' : '');

    positionReplicationFork(i + 1);
    els.status.textContent = `Helicase abrindo a hélice — base ${i + 1}/${length}. A fita líder cresce sem ` +
      `interrupção; a fita tardia inicia um novo fragmento de Okazaki a cada ${OKAZAKI_FRAGMENT_SIZE} bases.`;

    replication.index++;
    scheduleReplication(() => { if (replication.playing) stepReplication(); }, speed);
  }

  /** Chamado quando o garfo termina de percorrer toda a fita: une os fragmentos e revela as moléculas-filhas. */
  function finishReplicationLigase() {
    const els = replication.els;
    els.status.textContent = 'DNA ligase uniu os fragmentos de Okazaki — a fita tardia agora é uma molécula ' +
      'contínua, e a replicação está completa!';

    els.rowNewLagging.querySelectorAll('.repl-base').forEach((span) => {
      span.classList.remove('repl-fragment-alt');
      span.classList.add('repl-joined');
    });

    setReplicationPlayButtonState(false);
    els.captionTop.style.display = 'block';
    els.captionBottom.style.display = 'block';
    scheduleReplication(() => {
      els.captionTop.classList.add('visible');
      els.captionBottom.classList.add('visible');
    }, 50);
  }

  /** Inicia (ou retoma) a reprodução automática da animação do garfo de replicação. */
  function playReplication() {
    if (replication.index >= replication.strand1.length) resetReplicationAnimation();
    setReplicationPlayButtonState(true);
    stepReplication();
  }

  /**
   * Pausa a animação, mantendo o progresso atual.
   * DEFENSIVO: pode ser chamada pelo handler global de Esc mesmo que o modal de
   * replicação nunca tenha sido aberto nesta sessão — nesse caso replication.els
   * ainda está vazio, então simplesmente não há nada a pausar (mesmo padrão de
   * proteção aplicado em pauseRibosome(), depois que um bug real nesse sentido
   * foi encontrado e corrigido nessa função irmã).
   */
  function pauseReplication() {
    clearReplicationTimers();
    if (!replication.els.playIcon) return;
    setReplicationPlayButtonState(false);
  }

  // ─── Modo Desafio (Quiz) ──────────────────────────────────────────────────────
  //
  // Reaproveita CODON_TABLE/AMINOACIDS_DB e a MESMA regra de classificação de
  // mutação usada no simulador (frameshift > silenciosa > nonsense > missense),
  // mas em versões "puras" (sem tocar o DOM), para gerar perguntas e corrigi-las
  // automaticamente sem precisar de gabarito hardcoded.

  /** Transcreve uma string de DNA inteira para RNA (versão pura de transcribe(), sem DOM). */
  function transcribeSeq(dnaSeq) {
    let rna = '';
    for (const base of dnaSeq) rna += transcribe(base);
    return rna;
  }

  /**
   * Traduz uma string de RNA para a cadeia de aminoácidos REALMENTE ativa
   * (a partir do primeiro AUG até o STOP, exclusive), como uma lista de
   * abbrevNames. Espelha a lógica de translateStrand()/getActiveAAs(), porém
   * sem criar nenhum elemento no DOM — usada apenas para gerar/corrigir
   * perguntas do quiz.
   */
  function translateProteinChainPure(rnaSeq) {
    const chain = [];
    walkCodingRegion(rnaSeq, (codon, aminoacid, isActive) => {
      if (isActive) chain.push(aminoacid.abbrevName);
    });
    return chain;
  }

  /**
   * Classifica uma mutação comparando duas sequências de DNA (original e mutada),
   * em string puro — mesma regra de negócio de classifyMutation(), mas retornando
   * apenas a chave do tipo ('frameshift'|'silent'|'nonsense'|'stoploss'|'missense'), sem
   * mexer em nenhum elemento da UI real.
   * @returns {string|null} null se as sequências forem idênticas (sem mutação).
   */
  function classifyMutationPure(origDnaSeq, mutDnaSeq) {
    if (!origDnaSeq || !mutDnaSeq || origDnaSeq === mutDnaSeq) return null;

    const diff    = mutDnaSeq.length - origDnaSeq.length;
    const absDiff = Math.abs(diff);

    if (diff !== 0 && diff % 3 !== 0) return 'frameshift';

    const origChain = translateProteinChainPure(transcribeSeq(origDnaSeq));
    const mutChain  = translateProteinChainPure(transcribeSeq(mutDnaSeq));
    const aaChanged = origChain.join(',') !== mutChain.join(',');

    if (!aaChanged) return 'silent';

    // Perda do stop (stop-loss/nonstop): só faz sentido como conceito quando o
    // comprimento em BASES não mudou (diff===0) — o códon de parada foi
    // TROCADO por outro códon, não inserido/deletado — e a proteína resultante
    // ficou mais LONGA, porque a tradução deixou de parar onde parava antes.
    // Sem a checagem diff===0, uma inserção in-frame comum (que não toca o
    // stop) também alongaria a proteína e seria confundida com stop-loss.
    if (diff === 0 && mutChain.length > origChain.length) return 'stoploss';

    if (mutChain.length < origChain.length) return 'nonsense';
    return 'missense';
  }

  /** Embaralha uma cópia do array (Fisher-Yates). Não muta o array original. */
  function shuffled(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const QUIZ_BEST_SCORE_KEY = 'proteinSynthesis.quizBestScore';
  const QUIZ_TYPE_LABELS = {
    silent:     { className: 'silent',     text: 'Silenciosa (Sinônima)' },
    missense:   { className: 'missense',   text: 'Sentido Trocado (Missense)' },
    nonsense:   { className: 'nonsense',   text: 'Sem Sentido (Nonsense)' },
    stoploss:   { className: 'stoploss',   text: 'Perda do Stop (Stop-Loss)' },
    frameshift: { className: 'frameshift', text: 'Deslocamento de Leitura (Frameshift)' },
  };

  /** Nomes amigáveis das 5 categorias do quiz, usados no painel de desempenho do Modo Prática. */
  const QUIZ_CATEGORY_LABELS = {
    molecular:  'Genética Molecular',
    mendelian:  'Genética Mendeliana',
    population: 'Genética Populacional',
    pedigree:   'Heredograma',
    karyotype:  'Cariótipo',
  };

  /** Estado do Modo Desafio. Vive durante a sessão; só persiste o recorde (localStorage). */
  const quiz = {
    active:  false,
    score:   0,
    best:    0,
    answer:  null,       // valor esperado para a pergunta atual (formato depende do tipo)
    explanation: null,   // 1-2 frases explicando o gabarito da pergunta atual, mostradas após responder
    currentCategory: null, // categoria da pergunta atual, usada para atualizar categoryStats no Modo Prática
    checked: false,      // impede clicar em mais de uma opção após já ter respondido
    lastPoolKey: null,   // evita repetir a mesma pergunta duas vezes seguidas
    els:     {},         // cache de elementos da UI, preenchido em initQuizUI()
    // Estatísticas de acertos/erros por categoria da sessão atual de Modo Prática
    // (zerado a cada startQuiz()). Não existe no Modo Sobrevivência, que só usa
    // pontuação/recorde de sequência.
    categoryStats: {},
    // Configuração escolhida na tela de setup (#quiz-setup). 'todas' = qualquer dificuldade.
    // Todas as 5 categorias começam selecionadas por padrão. mode: 'survival' | 'practice'.
    settings: {
      mode: 'survival',
      difficulty: 'todas',
      categories: new Set(['molecular', 'mendelian', 'population', 'pedigree', 'karyotype']),
    },
  };

  /** Zera as estatísticas por categoria (chamado no início de cada sessão). */
  function resetQuizCategoryStats() {
    quiz.categoryStats = {};
    Object.keys(QUIZ_CATEGORY_LABELS).forEach((cat) => {
      quiz.categoryStats[cat] = { correct: 0, wrong: 0 };
    });
  }

  /** Lê o recorde salvo no localStorage (gracioso se indisponível, ex: modo privado). */
  function loadQuizBestScore() {
    try {
      return Number(window.localStorage.getItem(QUIZ_BEST_SCORE_KEY)) || 0;
    } catch (e) {
      return 0;
    }
  }

  /** Salva um novo recorde no localStorage, se suportado. */
  function saveQuizBestScore(value) {
    try {
      window.localStorage.setItem(QUIZ_BEST_SCORE_KEY, String(value));
    } catch (e) { /* localStorage indisponível — recorde fica só na sessão */ }
  }

  // ─── Geradores de pergunta ────────────────────────────────────────────────────

  /** Frases curtas (1-2 sentenças) explicando o gabarito de cada tipo de mutação — mostradas após responder. */
  const MUTATION_EXPLANATIONS = {
    silent:     'É silenciosa (sinônima) porque, apesar da base trocada, o novo códon ainda especifica o mesmo aminoácido — uma consequência da degeneração do código genético.',
    missense:   'É missense (sentido trocado) porque a substituição gera um códon que codifica um aminoácido DIFERENTE do original, alterando a proteína a partir desse ponto.',
    nonsense:   'É nonsense (sem sentido) porque a mudança transforma um códon de aminoácido em um códon de PARADA prematuro, truncando a proteína.',
    stoploss:   'É perda do stop (stop-loss) porque a mudança atinge justamente o códon de PARADA original, transformando-o num códon comum — a tradução "vaza" para além de onde deveria parar, produzindo uma proteína mais longa que a original.',
    frameshift: 'É frameshift porque o número de bases inseridas/deletadas NÃO é múltiplo de 3 — isso desloca a fase de leitura de todos os códons seguintes ao ponto da mutação.',
  };

  /**
   * Pergunta tipo "mutação": gera uma sequência codificante aleatória, aplica uma
   * mutação aleatória (substituição, inserção ou deleção de 1 ou 3 bases) e pede
   * para classificar o tipo resultante. A resposta certa é sempre calculada pela
   * mesma regra usada no simulador — nunca fixada manualmente — então é impossível
   * a pergunta e o gabarito divergirem.
   */
  function buildMutationQuestion() {
    let origDna, mutDna, trueType;

    // Tenta algumas vezes até cair numa mutação válida (sequências diferentes).
    for (let attempt = 0; attempt < 15; attempt++) {
      origDna = generateRandomCodingDna();
      const kind = shuffled(['sub', 'ins1', 'del1', 'ins3', 'del3'])[0];
      const pos  = 3 + Math.floor(Math.random() * Math.max(1, origDna.length - 6)); // evita mexer no AUG inicial

      if (kind === 'sub') {
        const bases = ['A', 'T', 'C', 'G'].filter(b => b !== origDna[pos]);
        const newBase = bases[Math.floor(Math.random() * bases.length)];
        mutDna = origDna.slice(0, pos) + newBase + origDna.slice(pos + 1);
      } else if (kind === 'ins1' || kind === 'ins3') {
        const n = kind === 'ins1' ? 1 : 3;
        let inserted = '';
        for (let i = 0; i < n; i++) inserted += ['A', 'T', 'C', 'G'][Math.floor(Math.random() * 4)];
        mutDna = origDna.slice(0, pos) + inserted + origDna.slice(pos);
      } else {
        const n = kind === 'del1' ? 1 : 3;
        mutDna = origDna.slice(0, pos) + origDna.slice(pos + n);
      }

      trueType = classifyMutationPure(origDna, mutDna);
      if (trueType) break;
    }
    if (!trueType) return null; // extremamente improvável, mas evita travar

    return {
      type:   'mutation',
      answer: trueType,
      category: 'molecular',
      explanation: MUTATION_EXPLANATIONS[trueType],
      render(container) {
        container.innerHTML = `
          <p class="quiz-prompt">Que tipo de mutação ocorreu nesta sequência?</p>
          <div class="quiz-seq-compare">
            <div class="quiz-seq-row"><span class="quiz-seq-label">DNA original</span><span class="quiz-seq-value">${origDna}</span></div>
            <div class="quiz-seq-row"><span class="quiz-seq-label">DNA mutado</span><span class="quiz-seq-value">${mutDna}</span></div>
          </div>
          <div class="quiz-options" id="quiz-options"></div>
        `;
        const optionsEl = container.querySelector('#quiz-options');
        shuffled(Object.keys(QUIZ_TYPE_LABELS)).forEach((key) => {
          const meta = QUIZ_TYPE_LABELS[key];
          const btn = document.createElement('button');
          btn.className = 'quiz-option mutation-type-badge ' + meta.className;
          btn.textContent = meta.text;
          btn.dataset.quizValue = key;
          btn.addEventListener('click', () => submitQuizAnswer(key, btn));
          optionsEl.appendChild(btn);
        });
      },
    };
  }

  /**
   * Pergunta tipo "tradução de códon": sorteia um códon (excluindo STOP, que não
   * codifica aminoácido) e pede o aminoácido correspondente, com 3 distratores
   * sorteados entre os outros 19 aminoácidos reais.
   */
  function buildCodonQuestion() {
    const senseCodons = Object.keys(CODON_TABLE).filter(c => CODON_TABLE[c].abbrevName !== 'STOP');
    const codon  = senseCodons[Math.floor(Math.random() * senseCodons.length)];
    const correct = CODON_TABLE[codon];

    const otherNames = Object.values(AMINOACIDS_DB)
      .filter(aa => aa.abbrevs !== 'STOP / Fim' && aa.name !== correct.name)
      .map(aa => aa.name);
    const distractors = shuffled(otherNames).slice(0, 3);
    const options = shuffled([correct.name, ...distractors]);

    return {
      type:   'codon',
      answer: correct.name,
      category: 'molecular',
      explanation: `Consultando a tabela do código genético, o códon ${codon} corresponde a ${correct.name} — cada um dos 20 aminoácidos costuma ter mais de um códon (degeneração do código).`,
      render(container) {
        container.innerHTML = `
          <p class="quiz-prompt">Qual aminoácido este códon de RNAm codifica?</p>
          <div class="quiz-codon-display">${codon}</div>
          <div class="quiz-options" id="quiz-options"></div>
        `;
        const optionsEl = container.querySelector('#quiz-options');
        options.forEach((name) => {
          const btn = document.createElement('button');
          btn.className = 'quiz-option btn-control';
          btn.textContent = name;
          btn.dataset.quizValue = name;
          btn.addEventListener('click', () => submitQuizAnswer(name, btn));
          optionsEl.appendChild(btn);
        });
      },
    };
  }

  /**
   * Pergunta tipo "início/parada": mostra 4 códons lado a lado (1 alvo + 3
   * distratores neutros) e pede para clicar no códon de INÍCIO (AUG) ou em um
   * dos códons de PARADA, alternando aleatoriamente entre os dois.
   */
  function buildStartStopQuestion() {
    const asksStart = Math.random() < 0.5;
    const target = asksStart ? 'AUG' : shuffled(['UAA', 'UAG', 'UGA'])[0];

    const neutralCodons = Object.keys(CODON_TABLE)
      .filter(c => CODON_TABLE[c].abbrevName !== 'MET' && CODON_TABLE[c].abbrevName !== 'STOP');
    const distractors = shuffled(neutralCodons).slice(0, 3);
    const options = shuffled([target, ...distractors]);

    return {
      type:   'startstop',
      answer: target,
      category: 'molecular',
      explanation: asksStart
        ? `${target} é o único códon de início da tradução — além de sinalizar onde o ribossomo começa, ele também codifica o aminoácido metionina.`
        : `${target} é um dos 3 códons de parada (UAA, UAG, UGA) — nenhum deles codifica aminoácido, eles apenas encerram a tradução.`,
      render(container) {
        container.innerHTML = `
          <p class="quiz-prompt">Qual destes é o códon de ${asksStart ? 'INÍCIO' : 'PARADA'} da tradução?</p>
          <div class="quiz-options quiz-options-codons" id="quiz-options"></div>
        `;
        const optionsEl = container.querySelector('#quiz-options');
        options.forEach((codon) => {
          const btn = document.createElement('button');
          btn.className = 'quiz-option codon-item';
          btn.innerHTML = `<span class="codon-name">${codon}</span>`;
          btn.dataset.quizValue = codon;
          btn.addEventListener('click', () => submitQuizAnswer(codon, btn));
          optionsEl.appendChild(btn);
        });
      },
    };
  }

  // ─── Banco de perguntas: Genética Molecular ──────────────────────────────────
  //
  // O Modo Desafio agora cobre 5 categorias de conteúdo (molecular, mendeliana,
  // populacional, heredograma e cariótipo), cada pergunta conceitual marcada com
  // `category` + `difficulty`, para que a tela de configuração (#quiz-setup) possa
  // filtrar exatamente o que o usuário escolheu antes de começar a rodada.
  //
  // Categorias cobertas neste banco (Genética Molecular):
  //   • Dogma central e enzimas envolvidas
  //   • Transcrição e processamento do mRNA
  //   • Tradução: ribossomo, tRNA, anticódon, fases
  //   • Função e significado do AUG
  //   • Tipos de mutação por descrição conceitual
  //   • Código genético: degeneração, universalidade
  //   • Casos clínicos (anemia falciforme, beta-talassemia)

  const MOLECULAR_QUESTIONS = [
    // ── Dogma central ────────────────────────────────────────────────────────
    {
      category: 'molecular', difficulty: 'facil',
      question: 'Qual é a sequência correta do dogma central da biologia molecular?',
      correct:  'DNA → RNA → Proteína',
      distractors: ['RNA → DNA → Proteína', 'Proteína → DNA → RNA', 'DNA → Proteína → RNA'],
    },
    {
      category: 'molecular', difficulty: 'facil',
      question: 'Qual enzima é responsável por sintetizar o mRNA a partir de um molde de DNA?',
      correct:  'RNA polimerase',
      distractors: ['DNA polimerase', 'Ribonuclease', 'DNA ligase'],
    },
    {
      category: 'molecular', difficulty: 'facil',
      question: 'Durante a tradução, qual molécula transporta os aminoácidos até o ribossomo?',
      correct:  'RNA transportador (tRNA)',
      distractors: ['RNA mensageiro (mRNA)', 'RNA ribossômico (rRNA)', 'DNA complementar (cDNA)'],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'O RNA ribossômico (rRNA) tem qual função principal na síntese proteica?',
      correct:  'Compor a estrutura do ribossomo e catalisar a formação de ligações peptídicas',
      distractors: [
        'Transportar aminoácidos até o sítio ativo',
        'Ser o molde para a síntese da proteína',
        'Sinalizar o início da transcrição',
      ],
    },

    // ── Transcrição ──────────────────────────────────────────────────────────
    {
      category: 'molecular', difficulty: 'facil',
      question: 'A transcrição produz qual molécula diretamente?',
      correct:  'RNA pré-mensageiro (pré-mRNA)',
      distractors: ['Proteína', 'DNA dupla-fita', 'tRNA maduro'],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'O que são íntrons?',
      correct:  'Sequências não codificantes do pré-mRNA que são removidas durante o processamento',
      distractors: [
        'Sequências codificantes que permanecem no mRNA maduro',
        'Regiões do DNA que controlam a transcrição',
        'Porções do tRNA que reconhecem o códon',
      ],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'O que é splicing do RNA?',
      correct:  'Remoção dos íntrons e junção dos éxons para formar o mRNA maduro',
      distractors: [
        'Adição do cap 5\' ao mRNA',
        'Exportação do mRNA do núcleo para o citoplasma',
        'Síntese da cauda poli-A no mRNA',
      ],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'Qual das modificações abaixo ocorre no pré-mRNA de eucariotos, mas NÃO em procariotos?',
      correct:  'Remoção de íntrons por splicing',
      distractors: [
        'Início da tradução com metionina',
        'Uso de códons de parada (UAA, UAG, UGA)',
        'Transcrição pela RNA polimerase',
      ],
    },

    // ── Tradução ─────────────────────────────────────────────────────────────
    {
      category: 'molecular', difficulty: 'medio',
      question: 'O que é um anticódon?',
      correct:  'Sequência de 3 nucleotídeos no tRNA que é complementar a um códon do mRNA',
      distractors: [
        'Sequência de 3 nucleotídeos no mRNA que codifica um aminoácido',
        'Região do ribossomo que catalisa a ligação peptídica',
        'Sequência do DNA molde lida pela RNA polimerase',
      ],
    },
    {
      category: 'molecular', difficulty: 'facil',
      question: 'Em qual local celular ocorre a tradução em células eucarióticas?',
      correct:  'No ribossomo (citoplasma ou retículo endoplasmático rugoso)',
      distractors: ['No núcleo', 'Na mitocôndria exclusivamente', 'No aparelho de Golgi'],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'Qual é a fase final da tradução?',
      correct:  'Terminação — o ribossomo encontra um códon de parada e libera a cadeia polipeptídica',
      distractors: [
        'Elongação — adição sucessiva de aminoácidos',
        'Iniciação — montagem do complexo ribossômico no mRNA',
        'Ativação — ligação do aminoácido ao tRNA',
      ],
    },
    {
      category: 'molecular', difficulty: 'facil',
      question: 'Quantos nucleotídeos formam um códon?',
      correct:  '3',
      distractors: ['2', '4', '1'],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'O que é uma ligação peptídica?',
      correct:  'Ligação covalente entre o grupo amino de um aminoácido e o grupo carboxila do anterior',
      distractors: [
        'Ligação de hidrogênio entre as bases nitrogenadas do DNA',
        'Ligação entre um nucleotídeo e o próximo na fita de RNA',
        'Interação entre o tRNA e o ribossomo',
      ],
    },

    // ── AUG e códons de parada ───────────────────────────────────────────────
    {
      category: 'molecular', difficulty: 'facil',
      question: 'Qual é a função do códon AUG na tradução?',
      correct:  'Sinalizar o início da tradução e codificar o aminoácido metionina',
      distractors: [
        'Sinalizar o fim da cadeia polipeptídica',
        'Codificar o aminoácido leucina, que inicia toda proteína',
        'Indicar o local de splicing no pré-mRNA',
      ],
    },
    {
      category: 'molecular', difficulty: 'facil',
      question: 'Qual aminoácido é sempre o primeiro a ser incorporado na síntese de uma proteína?',
      correct:  'Metionina (Met / M)',
      distractors: ['Alanina (Ala / A)', 'Lisina (Lys / K)', 'Valina (Val / V)'],
    },
    {
      category: 'molecular', difficulty: 'dificil',
      question: 'O que ocorre quando o ribossomo encontra um códon de parada (UAA, UAG ou UGA)?',
      correct:  'Fatores de liberação se ligam ao sítio A e a tradução é encerrada, soltando a proteína',
      distractors: [
        'O ribossomo reinicia a tradução no próximo AUG',
        'Um tRNA especial adiciona um aminoácido de terminação',
        'O mRNA é imediatamente degradado',
      ],
    },
    {
      category: 'molecular', difficulty: 'facil',
      question: 'Quantos códons de parada existem no código genético padrão?',
      correct:  '3 (UAA, UAG e UGA)',
      distractors: ['1 (UAA apenas)', '2 (UAA e UAG)', '4 (UAA, UAG, UGA e UAC)'],
    },

    // ── Código genético ──────────────────────────────────────────────────────
    {
      category: 'molecular', difficulty: 'medio',
      question: 'O código genético é dito "degenerado" (ou redundante). O que isso significa?',
      correct:  'Vários códons diferentes podem codificar o mesmo aminoácido',
      distractors: [
        'Genes defeituosos acumulam mutações ao longo do tempo',
        'O código genético varia entre espécies diferentes',
        'Um único códon pode codificar vários aminoácidos distintos',
      ],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'O código genético é descrito como "quase universal". O que isso significa?',
      correct:  'A grande maioria dos seres vivos usa o mesmo código de códons para aminoácidos',
      distractors: [
        'Todos os organismos têm exatamente o mesmo genoma',
        'Apenas organismos eucarióticos compartilham o código genético',
        'O número de genes é igual em todos os seres vivos',
      ],
    },
    {
      category: 'molecular', difficulty: 'facil',
      question: 'Quantos aminoácidos distintos são codificados pelo código genético padrão?',
      correct:  '20',
      distractors: ['16', '24', '64'],
    },

    // ── Tipos de mutação — conceituais ───────────────────────────────────────
    {
      category: 'molecular', difficulty: 'medio',
      question: 'O que define uma mutação missense (sentido trocado)?',
      correct:  'Uma substituição de base que leva à troca de um aminoácido por outro na proteína',
      distractors: [
        'Uma substituição de base que não altera o aminoácido codificado',
        'Uma inserção que desloca o quadro de leitura',
        'Uma substituição que gera um códon de parada prematuro',
      ],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'O que é uma mutação nonsense (sem sentido)?',
      correct:  'Uma mutação que converte um códon de aminoácido em um códon de parada prematuro',
      distractors: [
        'Uma mutação que troca um aminoácido por outro sem alterar a função da proteína',
        'Uma deleção de múltiplos códons sem deslocar o quadro de leitura',
        'Uma inserção de bases que não altera a sequência de aminoácidos',
      ],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'Por que uma mutação sinônima (silenciosa) geralmente não altera a proteína?',
      correct:  'Porque o novo códon codifica o mesmo aminoácido, devido à degeneração do código genético',
      distractors: [
        'Porque a mutação ocorre em um íntron que é removido no splicing',
        'Porque a proteína possui mecanismos de autocorreção',
        'Porque a substituição acontece fora da fase de leitura',
      ],
    },
    {
      category: 'molecular', difficulty: 'facil',
      question: 'Qual tipo de mutação tem maior potencial de alterar completamente a proteína a partir do ponto da mutação?',
      correct:  'Frameshift (deslocamento do quadro de leitura)',
      distractors: ['Missense', 'Silenciosa (sinônima)', 'Nonsense'],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'Uma deleção de 2 nucleotídeos em uma região codificante provoca qual efeito?',
      correct:  'Deslocamento do quadro de leitura (frameshift), alterando todos os aminoácidos seguintes',
      distractors: [
        'Remoção de um único aminoácido sem alterar o restante da proteína',
        'Inserção de um códon de parada no meio da sequência',
        'Nenhum efeito, pois dois nucleotídeos se compensam mutuamente',
      ],
    },
    {
      category: 'molecular', difficulty: 'dificil',
      question: 'Uma inserção de 3 nucleotídeos em fase (in-frame) em uma região codificante resulta em:',
      correct:  'Adição de um aminoácido extra na proteína, sem deslocar o quadro de leitura',
      distractors: [
        'Deslocamento do quadro de leitura a partir do ponto de inserção',
        'Eliminação de um aminoácido da cadeia polipeptídica',
        'Interrupção prematura da tradução',
      ],
    },

    // ── Casos clínicos ───────────────────────────────────────────────────────
    {
      category: 'molecular', difficulty: 'dificil',
      question: 'Na anemia falciforme, que tipo de mutação ocorre no gene da hemoglobina β?',
      correct:  'Missense — um único nucleotídeo substituído troca ácido glutâmico por valina na posição 6',
      distractors: [
        'Frameshift — deleção de uma base desloca o quadro de leitura',
        'Nonsense — uma substituição gera um códon de parada prematuro',
        'Silenciosa — a sequência de aminoácidos não é alterada',
      ],
    },
    {
      category: 'molecular', difficulty: 'dificil',
      question: 'Por que a anemia falciforme causa a deformação das hemácias em foice?',
      correct:  'A valina (hidrofóbica) no lugar do ácido glutâmico faz as moléculas de HbS se agregarem quando desoxigenadas',
      distractors: [
        'A proteína mutada é produzida em quantidade excessiva, sobrecarregando a hemácia',
        'A mutação impede a ligação do ferro ao grupo heme da hemoglobina',
        'A cadeia β mutada é degradada antes de formar a hemoglobina completa',
      ],
    },
    {
      category: 'molecular', difficulty: 'dificil',
      question: 'A beta-talassemia é causada principalmente por mutações que afetam qual processo?',
      correct:  'A produção ou estabilidade do mRNA da cadeia β da hemoglobina, reduzindo ou eliminando sua síntese',
      distractors: [
        'A estrutura do grupo heme, impedindo a ligação do oxigênio',
        'A sequência de aminoácidos da cadeia α da hemoglobina',
        'A degradação das hemácias no baço',
      ],
    },

    // ── Replicação e reparo ──────────────────────────────────────────────────
    {
      category: 'molecular', difficulty: 'facil',
      question: 'O que são agentes mutagênicos?',
      correct:  'Agentes físicos, químicos ou biológicos que aumentam a taxa de mutações no DNA',
      distractors: [
        'Enzimas que corrigem erros de replicação do DNA',
        'Proteínas que regulam a expressão gênica',
        'Moléculas que transportam informação genética entre células',
      ],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'Qual das afirmações sobre mutações germinativas está correta?',
      correct:  'Ocorrem em células germinativas (óvulos ou espermatozoides) e podem ser transmitidas à descendência',
      distractors: [
        'Ocorrem em células somáticas e afetam apenas o indivíduo que as carrega',
        'São sempre letais e eliminadas antes do nascimento',
        'Não alteram a sequência de DNA, apenas a expressão gênica',
      ],
    },
    {
      category: 'molecular', difficulty: 'medio',
      question: 'O que é o polimorfismo de nucleotídeo único (SNP)?',
      correct:  'Uma variação em um único nucleotídeo que ocorre em pelo menos 1% da população',
      distractors: [
        'Uma deleção de um fragmento inteiro de cromossomo',
        'A duplicação de um gene inteiro no genoma',
        'Uma inversão de um segmento de DNA que afeta todos os indivíduos da espécie',
      ],
    },

    // ── Estrutura do gene / expressão gênica ─────────────────────────────────
    {
      category: 'molecular', difficulty: 'medio',
      question: 'O que é um promotor em um gene?',
      correct:  'Sequência de DNA onde a RNA polimerase se liga para iniciar a transcrição',
      distractors: [
        'Sequência que codifica os primeiros aminoácidos da proteína',
        'Região não traduzida no final do mRNA (3\' UTR)',
        'Local onde o ribossomo se liga para iniciar a tradução',
      ],
    },
    {
      category: 'molecular', difficulty: 'facil',
      question: 'Qual é a definição mais precisa de um gene?',
      correct:  'Sequência de DNA que contém informação para síntese de uma proteína funcional ou RNA funcional',
      distractors: [
        'Qualquer sequência de DNA presente no genoma de um organismo',
        'Apenas as regiões do DNA que são transcritas em mRNA',
        'Um fragmento de DNA com pelo menos 100 pares de bases',
      ],
    },
  ];


  // ─── Banco de perguntas: Genética Mendeliana ─────────────────────────────────
  const MENDELIAN_QUESTIONS = [
    {
      category: 'mendelian', difficulty: 'facil',
      question: 'O que é um alelo?',
      correct:  'Cada uma das formas alternativas de um mesmo gene, que podem ocupar o mesmo lócus em cromossomos homólogos',
      distractors: [
        'A localização física de um gene no cromossomo',
        'O conjunto completo de genes de um organismo',
        'Uma versão mutada de uma proteína',
      ],
    },
    {
      category: 'mendelian', difficulty: 'facil',
      question: 'Qual a diferença entre genótipo e fenótipo?',
      correct:  'Genótipo é a constituição genética de um indivíduo; fenótipo é a característica observável resultante dessa constituição',
      distractors: [
        'Genótipo é a característica observável; fenótipo é a constituição genética',
        'São sinônimos, ambos se referem à aparência física do indivíduo',
        'Genótipo se refere apenas a características dominantes; fenótipo, às recessivas',
      ],
    },
    {
      category: 'mendelian', difficulty: 'facil',
      question: 'O que caracteriza um indivíduo heterozigoto para um gene?',
      correct:  'Possui dois alelos diferentes para aquele gene (ex.: Aa)',
      distractors: [
        'Possui dois alelos idênticos para aquele gene (ex.: AA ou aa)',
        'Possui apenas uma cópia do gene, por estar no cromossomo X',
        'Não expressa nenhum fenótipo observável',
      ],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'A Primeira Lei de Mendel (Lei da Segregação) estabelece que:',
      correct:  'Os dois alelos de um gene se separam durante a formação dos gametas, e cada gameta recebe apenas um deles',
      distractors: [
        'Genes de cromossomos diferentes são sempre herdados juntos',
        'O alelo dominante elimina o alelo recessivo ao longo das gerações',
        'Cada gameta recebe sempre os dois alelos de um gene',
      ],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'A Segunda Lei de Mendel (Lei da Segregação Independente) se aplica a:',
      correct:  'Genes localizados em cromossomos diferentes (ou distantes no mesmo cromossomo), que segregam de forma independente',
      distractors: [
        'Genes muito próximos no mesmo cromossomo, que são sempre herdados juntos',
        'Apenas genes ligados ao cromossomo X',
        'Apenas características com dominância incompleta',
      ],
    },
    {
      category: 'mendelian', difficulty: 'facil',
      question: 'Em um cruzamento entre dois heterozigotos (Aa × Aa), com dominância completa, qual a proporção genotípica esperada na prole?',
      correct:  '1 AA : 2 Aa : 1 aa',
      distractors: ['3 AA : 1 aa', '1 AA : 1 aa', '9 AA : 3 Aa : 3 aa : 1'],
    },
    {
      category: 'mendelian', difficulty: 'facil',
      question: 'Em um cruzamento entre dois heterozigotos (Aa × Aa), com dominância completa, qual a proporção fenotípica esperada na prole?',
      correct:  '3 : 1 (dominante : recessivo)',
      distractors: ['1 : 1', '1 : 2 : 1', '9 : 3 : 3 : 1'],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'O que é um cruzamento-teste (testcross)?',
      correct:  'O cruzamento de um indivíduo de fenótipo dominante e genótipo desconhecido com um homozigoto recessivo, para descobrir seu genótipo',
      distractors: [
        'O cruzamento entre dois indivíduos homozigotos dominantes',
        'Um cruzamento hipotético usado apenas em simulações computacionais',
        'O cruzamento entre um indivíduo e ele mesmo (autofecundação)',
      ],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'Em um cruzamento di-híbrido (AaBb × AaBb), com genes em cromossomos diferentes e dominância completa, qual a proporção fenotípica esperada?',
      correct:  '9 : 3 : 3 : 1',
      distractors: ['3 : 1', '1 : 2 : 1', '1 : 1 : 1 : 1'],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'O que é dominância incompleta?',
      correct:  'Padrão em que o heterozigoto apresenta um fenótipo intermediário entre os dois homozigotos',
      distractors: [
        'Padrão em que os dois alelos se expressam simultaneamente e de forma distinta no heterozigoto',
        'Padrão em que um alelo domina completamente o outro',
        'Padrão exclusivo de genes ligados ao sexo',
      ],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'O que é codominância?',
      correct:  'Padrão em que os dois alelos do heterozigoto se expressam plenamente e de forma simultânea, sem se misturar',
      distractors: [
        'Padrão em que o heterozigoto apresenta um fenótipo intermediário, misturando as duas características',
        'Padrão em que o alelo recessivo nunca se manifesta',
        'Padrão em que um dos alelos é sempre letal em homozigose',
      ],
    },
    {
      category: 'mendelian', difficulty: 'dificil',
      question: 'O sistema sanguíneo ABO é um exemplo clássico de qual fenômeno genético?',
      correct:  'Alelos múltiplos (IA, IB, i) combinados com codominância entre IA e IB, e recessividade de i',
      distractors: [
        'Dominância incompleta simples entre dois alelos',
        'Herança poligênica sem influência ambiental',
        'Herança ligada ao cromossomo X',
      ],
    },
    {
      category: 'mendelian', difficulty: 'dificil',
      question: 'Uma pessoa com tipo sanguíneo AB é filha de um pai tipo A (IAi) e uma mãe tipo B (IBi). Qual o genótipo dessa pessoa?',
      correct:  'IAIB',
      distractors: ['IAi', 'IBi', 'ii'],
    },
    {
      category: 'mendelian', difficulty: 'facil',
      question: 'O que significa dizer que um alelo é recessivo?',
      correct:  'Sua característica só se manifesta no fenótipo quando o indivíduo é homozigoto para esse alelo',
      distractors: [
        'Ele nunca é transmitido para a geração seguinte',
        'Sua característica se manifesta sempre que presente, mesmo em heterozigose',
        'Ele está sempre localizado no cromossomo Y',
      ],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'O que é herança poligênica?',
      correct:  'Quando uma característica é determinada por vários genes atuando em conjunto, gerando variação contínua no fenótipo (ex.: altura, cor da pele)',
      distractors: [
        'Quando um único gene determina múltiplas características não relacionadas',
        'Quando um gene tem apenas dois alelos possíveis na população',
        'Quando a característica é determinada exclusivamente por fatores ambientais',
      ],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'O que são genes ligados (linkage)?',
      correct:  'Genes localizados próximos no mesmo cromossomo, que tendem a ser herdados juntos, violando a segregação independente',
      distractors: [
        'Genes que codificam a mesma proteína em cromossomos diferentes',
        'Genes que só se expressam quando o indivíduo é heterozigoto',
        'Genes localizados no cromossomo X que afetam apenas machos',
      ],
    },
    {
      category: 'mendelian', difficulty: 'dificil',
      question: 'O que é epistasia?',
      correct:  'Interação em que um gene mascara ou modifica a expressão fenotípica de outro gene não-alelo',
      distractors: [
        'A ocorrência de dois alelos dominantes para o mesmo gene',
        'A perda completa da função de um gene por mutação',
        'A expressão simultânea de dois alelos de um mesmo gene',
      ],
    },
    {
      category: 'mendelian', difficulty: 'facil',
      question: 'Qual o genótipo de um indivíduo homozigoto dominante para um gene com alelos R (dominante) e r (recessivo)?',
      correct:  'RR',
      distractors: ['Rr', 'rr', 'rR'],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'Por que características ligadas ao cromossomo X recessivas são mais comuns em homens do que em mulheres?',
      correct:  'Homens são hemizigotos para o X (têm apenas uma cópia), então um único alelo recessivo já causa o fenótipo',
      distractors: [
        'Porque o cromossomo Y contém os mesmos genes recessivos do X',
        'Porque mulheres não podem herdar alelos recessivos ligados ao X',
        'Porque homens têm dois cromossomos X ativos ao mesmo tempo',
      ],
    },
    // ─── Epistasia (interação gênica entre 2 genes não-alelos) ─────────────────
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'Qual é a principal diferença entre epistasia e dominância?',
      correct:  'Dominância é a relação entre 2 alelos do MESMO gene; epistasia é a interação entre genes DIFERENTES (não-alelos), em que um mascara o efeito do outro',
      distractors: [
        'Não há diferença — são dois nomes para o mesmo fenômeno',
        'Epistasia só ocorre em genes ligados ao X, dominância só em autossomos',
        'Dominância envolve 2 genes; epistasia envolve apenas 1 alelo',
      ],
    },
    {
      category: 'mendelian', difficulty: 'dificil',
      question: 'Na epistasia recessiva (proporção 9:3:4), o que precisa acontecer para o fenótipo do "gene epistático" mascarar o do outro gene?',
      correct:  'O indivíduo precisa ser homozigoto recessivo (aa) para o gene epistático — nesse caso, o genótipo do segundo gene (B_ ou bb) deixa de importar para o fenótipo final',
      distractors: [
        'Basta ter um único alelo recessivo em qualquer um dos dois genes',
        'O indivíduo precisa ser heterozigoto para os dois genes ao mesmo tempo',
        'O gene epistático precisa estar no cromossomo X',
      ],
    },
    {
      category: 'mendelian', difficulty: 'dificil',
      question: 'Em um di-híbrido F1 × F1 (AaBb × AaBb) com epistasia DOMINANTE (o alelo A mascara o gene B sempre que presente), qual proporção fenotípica aparece na prole, na ordem "mascarado : B dominante visível : bb visível"?',
      correct:  '12 : 3 : 1',
      distractors: ['9 : 3 : 4', '9 : 7', '9 : 3 : 3 : 1'],
    },
    {
      category: 'mendelian', difficulty: 'dificil',
      question: 'A proporção 9:7 na F2 de um di-híbrido é a marca registrada de qual tipo de interação gênica?',
      correct:  'Epistasia recessiva duplicada — um fenótipo só aparece se houver ao menos um alelo dominante em CADA um dos dois genes (complementação gênica); qualquer homozigose recessiva num dos dois já basta para o outro fenótipo',
      distractors: [
        'Epistasia dominante simples',
        'Codominância entre os dois genes',
        'Herança poligênica com 3 genes',
      ],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'A cor da pelagem de labradores é um exemplo clássico de epistasia recessiva: o gene E (preto/marrom) só se expressa se houver ao menos um alelo dominante em outro gene, "B". Um cão "ee" (não deposita nenhum pigmento na pelagem, ficando amarelo) é um exemplo de quê?',
      correct:  'O genótipo ee no gene epistático mascara completamente o gene B, independente de este ser BB, Bb ou bb',
      distractors: [
        'Uma mutação nova, sem relação com os genes B e E',
        'Um erro de dominância incompleta entre os alelos E e e',
        'Um exemplo de herança ligada ao sexo',
      ],
    },
    // ─── Alelos múltiplos: Sistema ABO ─────────────────────────────────────────
    {
      category: 'mendelian', difficulty: 'facil',
      question: 'O sistema sanguíneo ABO é o exemplo clássico de qual conceito genético, além da codominância?',
      correct:  'Alelos múltiplos — existem 3 alelos possíveis para o gene (IA, IB, i) na população, embora cada indivíduo diploide só carregue 2 deles',
      distractors: [
        'Herança poligênica, com muitos genes diferentes contribuindo igualmente',
        'Herança citoplasmática, transmitida apenas pela mãe',
        'Herança ligada ao Y, transmitida apenas de pai para filho',
      ],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'Qual é a relação de dominância entre os 3 alelos do sistema ABO?',
      correct:  'IA e IB são codominantes entre si, e ambos são dominantes sobre i (que é recessivo)',
      distractors: [
        'IA é dominante sobre IB, que por sua vez é dominante sobre i',
        'Os 3 alelos são igualmente recessivos entre si',
        'i é dominante sobre IA e IB',
      ],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'Um indivíduo com genótipo IAi tem qual tipo sanguíneo (fenótipo)?',
      correct:  'Tipo A (o alelo IA é dominante sobre i, que não se expressa)',
      distractors: ['Tipo AB', 'Tipo O', 'Tipo B'],
    },
    {
      category: 'mendelian', difficulty: 'medio',
      question: 'Quantos genótipos ABO diferentes produzem o fenótipo tipo O?',
      correct:  'Apenas 1: ii (homozigoto recessivo) — é o único jeito de não expressar nenhum antígeno A ou B',
      distractors: [
        '2 genótipos, como acontece com os tipos A e B',
        '3 genótipos, um para cada combinação possível',
        'O tipo O não tem genótipo definido, é sempre uma mutação nova',
      ],
    },
    {
      category: 'mendelian', difficulty: 'dificil',
      question: 'Um casal com tipos sanguíneos A (genótipo IAi) e B (genótipo IBi) pode ter um filho de qual(is) tipo(s) sanguíneo(s)?',
      correct:  'Qualquer um dos 4: A, B, AB ou O — já que cada pai pode passar seu alelo I ou o alelo i',
      distractors: [
        'Só A ou B, nunca AB ou O',
        'Só AB, porque um pai é A e o outro é B',
        'Só O, porque IA e IB se anulariam',
      ],
    },
    {
      category: 'mendelian', difficulty: 'dificil',
      question: 'Por que o tipo sanguíneo ABO sozinho não é suficiente para provar ou excluir uma paternidade com certeza total, mas ainda pode EXCLUIR um suposto pai em certos casos?',
      correct:  'Porque, mesmo com poucos alelos possíveis, um filho tipo O (ii) não pode ter um pai homozigoto IAIA ou IBIB — casos assim excluem a paternidade, mas compatibilidade não a comprova (por isso o teste de DNA é usado para confirmação)',
      distractors: [
        'Porque o tipo sanguíneo muda ao longo da vida da pessoa',
        'Porque o sistema ABO tem centenas de alelos possíveis, tornando qualquer combinação compatível',
        'Porque o tipo sanguíneo do pai não segue nenhuma regra de herança',
      ],
    },
  ];

  // ─── Banco de perguntas: Genética Populacional ───────────────────────────────
  const POPULATION_QUESTIONS = [
    {
      category: 'population', difficulty: 'facil',
      question: 'O que o Princípio de Hardy-Weinberg descreve?',
      correct:  'As frequências alélicas e genotípicas esperadas em uma população que não está evoluindo, geração após geração',
      distractors: [
        'A velocidade com que uma mutação se espalha por uma população',
        'A proporção de machos e fêmeas em uma população',
        'O número máximo de alelos que um gene pode ter',
      ],
    },
    {
      category: 'population', difficulty: 'facil',
      question: 'Na equação de Hardy-Weinberg (p² + 2pq + q² = 1), o que representa o termo q²?',
      correct:  'A frequência esperada de indivíduos homozigotos recessivos (aa)',
      distractors: [
        'A frequência esperada de indivíduos homozigotos dominantes (AA)',
        'A frequência esperada de indivíduos heterozigotos (Aa)',
        'A frequência do alelo dominante na população',
      ],
    },
    {
      category: 'population', difficulty: 'facil',
      question: 'Na equação de Hardy-Weinberg, o que representa o termo 2pq?',
      correct:  'A frequência esperada de indivíduos heterozigotos (Aa)',
      distractors: [
        'A frequência esperada de indivíduos homozigotos recessivos (aa)',
        'A soma das frequências dos dois alelos',
        'A frequência de mutação na população',
      ],
    },
    {
      category: 'population', difficulty: 'medio',
      question: 'Se p representa a frequência do alelo dominante e q a do recessivo, qual relação é sempre verdadeira em um gene com dois alelos?',
      correct:  'p + q = 1',
      distractors: ['p × q = 1', 'p − q = 1', 'p² + q² = 1'],
    },
    {
      category: 'population', difficulty: 'medio',
      question: 'Quais são as condições necessárias para uma população estar em equilíbrio de Hardy-Weinberg?',
      correct:  'População grande, acasalamento ao acaso, ausência de mutação, migração e seleção natural',
      distractors: [
        'População pequena, acasalamento seletivo e alta taxa de mutação',
        'Presença constante de migração e deriva genética',
        'Apenas a ausência de predadores naturais',
      ],
    },
    {
      category: 'population', difficulty: 'medio',
      question: 'O que é deriva genética?',
      correct:  'Mudança aleatória nas frequências alélicas de uma população, com efeito mais forte em populações pequenas',
      distractors: [
        'Mudança nas frequências alélicas causada exclusivamente pela seleção natural',
        'O movimento de indivíduos entre populações diferentes',
        'A troca de material genético entre cromossomos homólogos',
      ],
    },
    {
      category: 'population', difficulty: 'medio',
      question: 'O que é o efeito fundador?',
      correct:  'A redução da variabilidade genética quando uma nova população é formada por um pequeno número de indivíduos',
      distractors: [
        'O aumento da variabilidade genética por cruzamento entre populações distintas',
        'A eliminação de alelos recessivos por seleção natural',
        'O surgimento espontâneo de uma nova espécie sem isolamento geográfico',
      ],
    },
    {
      category: 'population', difficulty: 'medio',
      question: 'O que é o efeito gargalo (bottleneck)?',
      correct:  'Redução drástica e súbita no tamanho de uma população, diminuindo sua variabilidade genética',
      distractors: [
        'O crescimento exponencial de uma população em um novo ambiente',
        'A migração constante de indivíduos entre duas populações',
        'O aumento da frequência de heterozigotos por acasalamento não aleatório',
      ],
    },
    {
      category: 'population', difficulty: 'facil',
      question: 'O que é fluxo gênico?',
      correct:  'A transferência de alelos entre populações diferentes por meio da migração de indivíduos',
      distractors: [
        'A transferência de informação genética de uma célula para outra dentro do mesmo indivíduo',
        'A perda de alelos por mutações prejudiciais',
        'O aumento da frequência de um alelo por seleção natural',
      ],
    },
    {
      category: 'population', difficulty: 'dificil',
      question: 'Em uma população em equilíbrio de Hardy-Weinberg, 16% dos indivíduos nascem com uma doença autossômica recessiva. Qual é a frequência do alelo recessivo (q)?',
      correct:  '0,4 (ou 40%)',
      distractors: ['0,16 (ou 16%)', '0,84 (ou 84%)', '0,8 (ou 80%)'],
    },
    {
      category: 'population', difficulty: 'dificil',
      question: 'Considerando a mesma população do exemplo anterior (q = 0,4), qual é a frequência de indivíduos heterozigotos (portadores)?',
      correct:  '0,48 (ou 48%)',
      distractors: ['0,4 (ou 40%)', '0,16 (ou 16%)', '0,6 (ou 60%)'],
    },
    {
      category: 'population', difficulty: 'medio',
      question: 'Qual é o papel da seleção natural nas frequências alélicas de uma população, do ponto de vista da genética populacional?',
      correct:  'Altera as frequências alélicas ao favorecer a reprodução de indivíduos com determinados genótipos/fenótipos',
      distractors: [
        'Mantém as frequências alélicas sempre constantes ao longo das gerações',
        'Atua exclusivamente sobre alelos recessivos, nunca sobre dominantes',
        'É a única força capaz de introduzir novos alelos em uma população',
      ],
    },
    {
      category: 'population', difficulty: 'facil',
      question: 'Qual é a principal fonte de novos alelos em uma população?',
      correct:  'Mutação',
      distractors: ['Migração', 'Seleção natural', 'Acasalamento ao acaso'],
    },
    {
      category: 'population', difficulty: 'medio',
      question: 'O que significa dizer que uma população está "fora" do equilíbrio de Hardy-Weinberg?',
      correct:  'Que as frequências genotípicas observadas diferem significativamente das esperadas sob p² + 2pq + q², indicando que forças evolutivas estão atuando',
      distractors: [
        'Que a população está extinta',
        'Que todos os indivíduos possuem o mesmo genótipo',
        'Que não é mais possível calcular as frequências alélicas',
      ],
    },
    {
      category: 'population', difficulty: 'dificil',
      question: 'Por que o acasalamento não aleatório (como a endogamia) por si só NÃO altera as frequências alélicas de uma população, mas altera as frequências genotípicas?',
      correct:  'Porque a endogamia redistribui os mesmos alelos existentes em mais homozigotos e menos heterozigotos, sem adicionar ou remover alelos da população',
      distractors: [
        'Porque a endogamia sempre introduz novos alelos por mutação',
        'Porque a endogamia elimina fisicamente os alelos recessivos da população',
        'Porque a endogamia é equivalente à seleção natural',
      ],
    },
  ];

  // ─── Banco de perguntas: Heredogramas ────────────────────────────────────────
  const PEDIGREE_QUESTIONS = [
    {
      category: 'pedigree', difficulty: 'facil',
      question: 'Em um heredograma, o que representa um quadrado?',
      correct:  'Um indivíduo do sexo masculino',
      distractors: ['Um indivíduo do sexo feminino', 'Um casal', 'Um indivíduo falecido'],
    },
    {
      category: 'pedigree', difficulty: 'facil',
      question: 'Em um heredograma, o que representa um círculo?',
      correct:  'Um indivíduo do sexo feminino',
      distractors: ['Um indivíduo do sexo masculino', 'Um indivíduo não afetado', 'Um casamento consanguíneo'],
    },
    {
      category: 'pedigree', difficulty: 'facil',
      question: 'Em um heredograma, o que indica um símbolo (quadrado ou círculo) totalmente preenchido?',
      correct:  'Um indivíduo afetado pela característica ou condição em estudo',
      distractors: [
        'Um indivíduo não afetado, mas portador do alelo recessivo',
        'Um indivíduo do sexo indeterminado',
        'Um indivíduo falecido, independentemente de ser afetado',
      ],
    },
    {
      category: 'pedigree', difficulty: 'medio',
      question: 'Qual evidência em um heredograma sugere fortemente um padrão de herança autossômica recessiva?',
      correct:  'Dois pais não afetados têm um filho afetado (a característica "pula" gerações)',
      distractors: [
        'Todo indivíduo afetado tem pelo menos um dos pais também afetado',
        'A característica afeta exclusivamente indivíduos do sexo masculino',
        'Um pai afetado transmite a característica para todas as filhas',
      ],
    },
    {
      category: 'pedigree', difficulty: 'medio',
      question: 'Qual evidência em um heredograma sugere fortemente um padrão de herança autossômica dominante?',
      correct:  'A característica aparece em praticamente toda geração, e um indivíduo afetado costuma ter um dos pais também afetado',
      distractors: [
        'Dois pais não afetados podem ter filhos afetados',
        'A característica é muito mais comum em homens do que em mulheres',
        'Apenas filhas de pais afetados manifestam a característica',
      ],
    },
    {
      category: 'pedigree', difficulty: 'medio',
      question: 'Qual evidência sugere um padrão de herança ligada ao X recessiva?',
      correct:  'A condição é bem mais comum em homens, e mulheres portadoras (heterozigotas) não são afetadas',
      distractors: [
        'A condição afeta igualmente homens e mulheres em todas as gerações',
        'Um pai afetado transmite a condição para 100% dos filhos homens',
        'A condição nunca aparece em filhos de mães não afetadas',
      ],
    },
    {
      category: 'pedigree', difficulty: 'dificil',
      question: 'Em um heredograma com herança ligada ao X dominante, o que se espera de um pai afetado?',
      correct:  'Ele transmite a condição para 100% das filhas (que sempre recebem seu único X), mas para nenhum filho homem (que recebe o Y)',
      distractors: [
        'Ele transmite a condição para 100% dos filhos, independente do sexo',
        'Ele nunca transmite a condição para as filhas',
        'Ele transmite a condição apenas para os filhos homens',
      ],
    },
    {
      category: 'pedigree', difficulty: 'facil',
      question: 'O que significa "geração I", "geração II" etc. na numeração padrão de um heredograma?',
      correct:  'Cada algarismo romano identifica uma geração distinta da família, da mais antiga (I) para a mais recente',
      distractors: [
        'Indica o número de filhos afetados em cada família',
        'Indica a ordem de nascimento de cada indivíduo, sem relação com gerações',
        'É usado apenas quando há gêmeos na família',
      ],
    },
    {
      category: 'pedigree', difficulty: 'medio',
      question: 'O que é um indivíduo "portador" (carrier) no contexto de heredogramas?',
      correct:  'Um indivíduo heterozigoto que carrega um alelo recessivo associado a uma condição, mas não manifesta o fenótipo',
      distractors: [
        'Um indivíduo que manifesta a condição de forma leve',
        'Um indivíduo homozigoto recessivo, sempre afetado',
        'Qualquer indivíduo do sexo feminino em uma família com herança ligada ao X',
      ],
    },
    {
      category: 'pedigree', difficulty: 'medio',
      question: 'Por que casamentos consanguíneos (entre parentes) aumentam o risco de filhos com doenças autossômicas recessivas raras?',
      correct:  'Parentes têm maior probabilidade de carregar os mesmos alelos recessivos raros herdados de um ancestral comum',
      distractors: [
        'Porque a consanguinidade causa mutações novas no DNA dos filhos',
        'Porque parentes sempre têm o mesmo grupo sanguíneo',
        'Porque a consanguinidade converte alelos dominantes em recessivos',
      ],
    },
    {
      category: 'pedigree', difficulty: 'facil',
      question: 'Em um heredograma, uma linha horizontal conectando um quadrado e um círculo representa:',
      correct:  'Uma união/casamento entre os dois indivíduos',
      distractors: [
        'Uma relação de irmãos entre os dois indivíduos',
        'Uma condição genética compartilhada',
        'Um erro de diagnóstico a ser corrigido',
      ],
    },
    {
      category: 'pedigree', difficulty: 'dificil',
      question: 'Em uma árvore genealógica, todas as filhas de um homem afetado por uma condição ligada ao X recessiva serão, no mínimo:',
      correct:  'Portadoras (heterozigotas), pois recebem obrigatoriamente o X afetado do pai',
      distractors: [
        'Afetadas pela condição, independente do genótipo da mãe',
        'Livres da condição e não portadoras',
        'Portadoras apenas se a mãe também for portadora',
      ],
    },
  ];

  // ─── Banco de perguntas: Cariótipo ───────────────────────────────────────────
  const KARYOTYPE_QUESTIONS = [
    {
      category: 'karyotype', difficulty: 'facil',
      question: 'O que é um cariótipo?',
      correct:  'O conjunto completo de cromossomos de uma célula, organizado por tamanho e forma',
      distractors: [
        'A sequência completa de nucleotídeos do genoma de um indivíduo',
        'O conjunto de genes ativos em um determinado tecido',
        'O mapa de proteínas expressas por uma célula',
      ],
    },
    {
      category: 'karyotype', difficulty: 'facil',
      question: 'Quantos cromossomos possui uma célula humana somática normal?',
      correct:  '46 (23 pares)',
      distractors: ['44 (22 pares)', '48 (24 pares)', '23 (par único)'],
    },
    {
      category: 'karyotype', difficulty: 'facil',
      question: 'Qual é o cariótipo normal de uma mulher, em notação padrão?',
      correct:  '46,XX',
      distractors: ['46,XY', '47,XX,+21', '45,X'],
    },
    {
      category: 'karyotype', difficulty: 'facil',
      question: 'Qual é o cariótipo normal de um homem, em notação padrão?',
      correct:  '46,XY',
      distractors: ['46,XX', '47,XXY', '45,Y'],
    },
    {
      category: 'karyotype', difficulty: 'medio',
      question: 'O que é não-disjunção meiótica?',
      correct:  'A falha na separação de cromossomos homólogos (Meiose I) ou cromátides-irmãs (Meiose II), gerando gametas com número anormal de cromossomos',
      distractors: [
        'A duplicação completa do genoma antes da meiose',
        'A fusão de dois cromossomos diferentes em um só',
        'A destruição de um cromossomo inteiro durante a mitose',
      ],
    },
    {
      category: 'karyotype', difficulty: 'facil',
      question: 'O que é trissomia?',
      correct:  'A presença de 3 cópias de um cromossomo em vez das 2 habituais',
      distractors: [
        'A presença de apenas 1 cópia de um cromossomo em vez das 2 habituais',
        'A ausência completa de um par de cromossomos',
        'A troca de posição entre dois cromossomos não-homólogos',
      ],
    },
    {
      category: 'karyotype', difficulty: 'facil',
      question: 'O que é monossomia?',
      correct:  'A presença de apenas 1 cópia de um cromossomo em vez das 2 habituais',
      distractors: [
        'A presença de 3 cópias de um cromossomo em vez das 2 habituais',
        'A duplicação de um segmento dentro do mesmo cromossomo',
        'A perda de um gene específico, sem afetar o cromossomo inteiro',
      ],
    },
    {
      category: 'karyotype', difficulty: 'medio',
      question: 'A Síndrome de Down é causada por qual alteração cromossômica?',
      correct:  'Trissomia do cromossomo 21 (47,XX ou XY,+21)',
      distractors: [
        'Monossomia do cromossomo X (45,X)',
        'Trissomia do cromossomo 18',
        'Um cromossomo X extra em indivíduos do sexo masculino (47,XXY)',
      ],
    },
    {
      category: 'karyotype', difficulty: 'medio',
      question: 'A Síndrome de Turner é causada por qual alteração cromossômica?',
      correct:  'Monossomia do X (45,X), afetando apenas indivíduos do sexo feminino',
      distractors: [
        'Trissomia do cromossomo 21',
        'Um cromossomo X extra em indivíduos do sexo masculino (47,XXY)',
        'Trissomia do cromossomo 13',
      ],
    },
    {
      category: 'karyotype', difficulty: 'medio',
      question: 'A Síndrome de Klinefelter é causada por qual alteração cromossômica?',
      correct:  'Um cromossomo X extra em indivíduos do sexo masculino (47,XXY)',
      distractors: [
        'Monossomia do X (45,X)',
        'Trissomia do cromossomo 21',
        'Trissomia do cromossomo 18',
      ],
    },
    {
      category: 'karyotype', difficulty: 'dificil',
      question: 'Qual é a diferença entre um erro de não-disjunção na Meiose I e na Meiose II?',
      correct:  'Na Meiose I, TODOS os 4 gametas resultantes ficam anormais; na Meiose II, apenas 2 dos 4 ficam anormais (2 permanecem normais)',
      distractors: [
        'Na Meiose I, nenhum gameta é afetado; na Meiose II, todos são afetados',
        'Não há diferença prática entre os dois casos',
        'Erros na Meiose II são sempre letais para o embrião, ao contrário dos da Meiose I',
      ],
    },
    {
      category: 'karyotype', difficulty: 'dificil',
      question: 'Por que trissomias e monossomias autossômicas completas (fora dos cromossomos 13, 18 e 21) são raramente observadas em nascidos vivos?',
      correct:  'Porque o desequilíbrio na dosagem gênica de autossomos maiores costuma ser incompatível com o desenvolvimento, levando a aborto espontâneo precoce',
      distractors: [
        'Porque esses cromossomos não participam da meiose',
        'Porque o corpo humano possui mecanismos que corrigem automaticamente qualquer trissomia',
        'Porque esses cromossomos são eliminados durante a fecundação',
      ],
    },
    {
      category: 'karyotype', difficulty: 'facil',
      question: 'Como as células são geralmente preparadas para a obtenção de um cariótipo?',
      correct:  'Cultivando células (geralmente linfócitos do sangue) e interrompendo-as em metáfase, quando os cromossomos estão mais condensados e visíveis',
      distractors: [
        'Sequenciando diretamente o DNA extraído de qualquer tecido',
        'Fotografando o núcleo celular durante a interfase',
        'Analisando apenas o RNA mensageiro extraído da célula',
      ],
    },
    {
      category: 'karyotype', difficulty: 'medio',
      question: 'O que diferencia um cromossomo autossômico de um cromossomo sexual?',
      correct:  'Autossomos (1 a 22 em humanos) são iguais em ambos os sexos; os cromossomos sexuais (X e Y) determinam o sexo e diferem entre homens e mulheres',
      distractors: [
        'Autossomos só existem em células somáticas; cromossomos sexuais só em gametas',
        'Autossomos carregam genes; cromossomos sexuais não carregam genes funcionais',
        'Não há diferença real entre os dois tipos',
      ],
    },
    {
      category: 'karyotype', difficulty: 'medio',
      question: 'O que é aneuploidia?',
      correct:  'Qualquer alteração no número de cromossomos que não seja um múltiplo exato do número haploide (ex.: trissomias, monossomias)',
      distractors: [
        'A duplicação completa de todo o conjunto cromossômico (ex.: triploidia)',
        'A quebra física de um cromossomo em dois fragmentos',
        'A perda de um gene específico sem alterar o número de cromossomos',
      ],
    },
  ];


  const CONCEPTUAL_QUESTIONS = [
    ...MOLECULAR_QUESTIONS,
    ...MENDELIAN_QUESTIONS,
    ...POPULATION_QUESTIONS,
    ...PEDIGREE_QUESTIONS,
    ...KARYOTYPE_QUESTIONS,
  ];

  /**
   * Sorteia uma pergunta do banco conceitual pelo índice já filtrado em
   * buildQuestionPool() e a renderiza com 4 opções (1 certa + 3 distratores).
   */
  function buildConceptualQuestionFromIndex(idx) {
    const q = CONCEPTUAL_QUESTIONS[idx];
    const options = shuffled([q.correct, ...q.distractors]);

    return {
      type:   'conceptual',
      answer: q.correct,
      category: q.category,
      // O texto do gabarito já costuma trazer o "porquê" embutido (não é só um
      // rótulo curto) — por isso é reaproveitado como explicação em vez de exigir
      // um campo novo em cada uma das ~100 perguntas do banco.
      explanation: q.correct,
      render(container) {
        container.innerHTML = `
          <p class="quiz-prompt">${q.question}</p>
          <div class="quiz-options quiz-options-conceptual" id="quiz-options"></div>
        `;
        const optionsEl = container.querySelector('#quiz-options');
        options.forEach((opt) => {
          const btn = document.createElement('button');
          btn.className = 'quiz-option quiz-option-text btn-control';
          btn.textContent = opt;
          btn.dataset.quizValue = opt;
          btn.addEventListener('click', () => submitQuizAnswer(opt, btn));
          optionsEl.appendChild(btn);
        });
      },
    };
  }

  // ─── Geradores dinâmicos adicionais (um por categoria nova) ──────────────────
  //
  // Seguem o mesmo princípio dos geradores moleculares (buildMutationQuestion
  // etc.): reaproveitam as MESMAS funções puras já usadas pelos simuladores
  // (buildPunnettSquare, hwFromQSquared, generateInterestingPedigree,
  // renderKaryotypeGrid...), então a pergunta e o gabarito nunca podem divergir
  // — o "gabarito" é sempre calculado, nunca hardcoded à parte da pergunta.

  /** Pares de características usados para sortear cruzamentos mendelianos com nomes variados. */
  const MENDEL_QUIZ_TRAITS = [
    { letter: 'V', domName: 'Semente amarela', recName: 'Semente verde',   hetName: 'Semente amarelo-esverdeada' },
    { letter: 'R', domName: 'Flor vermelha',    recName: 'Flor branca',    hetName: 'Flor rosa' },
    { letter: 'P', domName: 'Pelagem preta',    recName: 'Pelagem branca', hetName: 'Pelagem cinza' },
    { letter: 'L', domName: 'Semente lisa',     recName: 'Semente rugosa', hetName: 'Semente semirrugosa' },
  ];

  /**
   * Pergunta tipo "cruzamento mendeliano": monta um quadro de Punnett real
   * (via buildPunnettSquare, a mesma função usada no Construtor de Cruzamentos)
   * para um cruzamento monoíbrido sorteado — F2 com dominância completa,
   * cruzamento-teste, ou F2 com dominância incompleta — e pede a proporção
   * fenotípica resultante. A ordem de inserção no Map de fenótipos já respeita
   * a convenção genética (dominante → intermediário → recessivo), então a
   * proporção é lida diretamente do resultado, nunca recalculada à mão.
   */
  function buildMendelianCrossQuestion() {
    const trait = MENDEL_QUIZ_TRAITS[Math.floor(Math.random() * MENDEL_QUIZ_TRAITS.length)];
    const scenario = shuffled(['complete_f2', 'complete_test', 'incomplete_f2'])[0];

    let pattern, parent1Class, parent2Class, crossLabel;
    if (scenario === 'complete_f2') {
      pattern = 'complete'; parent1Class = 'het'; parent2Class = 'het';
      crossLabel = 'dominância completa, cruzando dois heterozigotos (F1 × F1)';
    } else if (scenario === 'complete_test') {
      pattern = 'complete'; parent1Class = 'het'; parent2Class = 'homRec';
      crossLabel = 'dominância completa, em um cruzamento-teste (heterozigoto × homozigoto recessivo)';
    } else {
      pattern = 'incomplete'; parent1Class = 'het'; parent2Class = 'het';
      crossLabel = 'dominância incompleta, cruzando dois heterozigotos (F1 × F1)';
    }

    const gene = {
      letter: trait.letter, pattern,
      domName: trait.domName, recName: trait.recName, hetName: trait.hetName,
    };
    const square = buildPunnettSquare([gene], [parent1Class], [parent2Class]);
    const formatted = mendelFormatTally(square.phenotypeTally, square.total);
    const correctRatio = formatted.map(f => f.ratio).join(' : ');

    const RATIO_POOL = ['3 : 1', '1 : 1', '1 : 2 : 1', '9 : 3 : 3 : 1', '1 : 3'];
    const distractors = shuffled(RATIO_POOL.filter(r => r !== correctRatio)).slice(0, 3);
    const options = shuffled([correctRatio, ...distractors]);

    const parent1Display = mendelDisplayPair(...mendelAllelesForGenotype(parent1Class, gene.letter), gene.letter);
    const parent2Display = mendelDisplayPair(...mendelAllelesForGenotype(parent2Class, gene.letter), gene.letter);

    return {
      type:   'mendelian',
      answer: correctRatio,
      category: 'mendelian',
      explanation: `No quadro de Punnett para esse cruzamento (${crossLabel}), a proporção ${correctRatio} sai diretamente ` +
        `da contagem das ${square.total} combinações possíveis de gametas — ${formatted.map(f => `${f.ratio} ${f.label}`).join(', ')}.`,
      render(container) {
        container.innerHTML = `
          <p class="quiz-prompt">Cruzamento para o gene "${gene.domName} / ${gene.recName}", com ${crossLabel}:
            <strong>${parent1Display} × ${parent2Display}</strong>. Qual é a proporção fenotípica esperada na prole?</p>
          <div class="quiz-options quiz-options-conceptual" id="quiz-options"></div>
        `;
        const optionsEl = container.querySelector('#quiz-options');
        options.forEach((opt) => {
          const btn = document.createElement('button');
          btn.className = 'quiz-option quiz-option-text btn-control';
          btn.textContent = opt;
          btn.dataset.quizValue = opt;
          btn.addEventListener('click', () => submitQuizAnswer(opt, btn));
          optionsEl.appendChild(btn);
        });
      },
    };
  }

  /** Cenários usados para "vestir" a pergunta de Hardy-Weinberg com um contexto biológico plausível. */
  const HW_QUIZ_SCENARIOS = [
    'uma doença genética autossômica recessiva rara',
    'a incapacidade de sentir o sabor amargo de certas substâncias (traço recessivo)',
    'o albinismo, uma condição autossômica recessiva',
    'a fibrose cística, uma doença autossômica recessiva',
  ];

  /**
   * Pergunta tipo "Hardy-Weinberg": dado q² (incidência do fenótipo recessivo)
   * como porcentagem "redonda", pede a frequência do alelo recessivo (q).
   * Os distratores incluem os erros clássicos de quem confunde q² com q, ou
   * q com p ou 2pq — mas nunca são calculados por engano no lugar do gabarito.
   */
  function buildHardyWeinbergQuestion() {
    const qPool = [10, 20, 30, 40, 50, 5, 25];
    const qPct = qPool[Math.floor(Math.random() * qPool.length)];
    const q = qPct / 100;
    const pPct = Math.round((1 - q) * 10000) / 100;
    const qSquaredPct = Math.round(q * q * 10000) / 100;
    const twoPqPct = Math.round(2 * q * (1 - q) * 10000) / 100;
    const scenario = HW_QUIZ_SCENARIOS[Math.floor(Math.random() * HW_QUIZ_SCENARIOS.length)];

    const correct = qPct + '%';
    const usedValues = new Set([qPct]);
    const distractorValues = [];
    [qSquaredPct, pPct, twoPqPct, 15, 35, 45, 55, 65, 75, 85, 95, 5, 60, 70, 80].forEach((v) => {
      if (distractorValues.length >= 3) return;
      if (usedValues.has(v)) return;
      usedValues.add(v);
      distractorValues.push(v);
    });

    const options = shuffled([correct, ...distractorValues.map(v => v + '%')]);

    return {
      type:   'hardyweinberg',
      answer: correct,
      category: 'population',
      explanation: `Como q² = ${qSquaredPct}%, basta tirar a raiz quadrada para achar q: q = √${qSquaredPct}% = ${qPct}%.`,
      render(container) {
        container.innerHTML = `
          <p class="quiz-prompt">Numa população em equilíbrio de Hardy-Weinberg, ${qSquaredPct}% dos indivíduos nascem com
            ${scenario} (genótipo homozigoto recessivo, aa). Qual é a frequência do alelo recessivo (q) nessa população?</p>
          <div class="quiz-options quiz-options-conceptual" id="quiz-options"></div>
        `;
        const optionsEl = container.querySelector('#quiz-options');
        options.forEach((opt) => {
          const btn = document.createElement('button');
          btn.className = 'quiz-option quiz-option-text btn-control';
          btn.textContent = opt;
          btn.dataset.quizValue = opt;
          btn.addEventListener('click', () => submitQuizAnswer(opt, btn));
          optionsEl.appendChild(btn);
        });
      },
    };
  }

  /**
   * Pergunta tipo "heredograma": gera uma árvore genealógica REAL (mesma
   * geradora usada no Modo Quiz da ferramenta de Heredogramas) para um dos 4
   * padrões de herança, desenha o SVG e pede para identificar o padrão.
   */
  function buildPedigreeQuestion() {
    const patterns = Object.keys(PEDIGREE_PATTERN_NAMES);
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const individuals = generateInterestingPedigree(pattern, 30);
    const svg = renderPedigreeSvg(individuals);
    const correct = PEDIGREE_PATTERN_NAMES[pattern];
    const options = shuffled(Object.values(PEDIGREE_PATTERN_NAMES));

    return {
      type:   'pedigree',
      answer: correct,
      category: 'pedigree',
      explanation: PEDIGREE_PATTERN_EXPLANATIONS[pattern],
      render(container) {
        container.innerHTML = `
          <p class="quiz-prompt">Observe o heredograma abaixo (quadrados = sexo masculino, círculos = sexo feminino;
            símbolos preenchidos = indivíduos afetados). Qual é o padrão de herança mais compatível com esta árvore genealógica?</p>
          <div class="pedigree-svg-wrapper quiz-pedigree-display">${svg}</div>
          <div class="quiz-options quiz-options-conceptual" id="quiz-options"></div>
        `;
        const optionsEl = container.querySelector('#quiz-options');
        options.forEach((opt) => {
          const btn = document.createElement('button');
          btn.className = 'quiz-option quiz-option-text btn-control';
          btn.textContent = opt;
          btn.dataset.quizValue = opt;
          btn.addEventListener('click', () => submitQuizAnswer(opt, btn));
          optionsEl.appendChild(btn);
        });
      },
    };
  }

  /**
   * Pergunta tipo "cariótipo": sorteia uma das condições já catalogadas em
   * KARYOTYPE_CONDITIONS (mesmas usadas no Visualizador de Cariótipo), desenha
   * a grade de cromossomos com renderKaryotypeGrid() e pede para identificar a
   * condição a partir da notação e do padrão visual.
   */
  function buildKaryotypeQuestion() {
    const keys = Object.keys(KARYOTYPE_CONDITIONS);
    const key = keys[Math.floor(Math.random() * keys.length)];
    const condition = KARYOTYPE_CONDITIONS[key];
    const correct = condition.label;
    const distractorKeys = shuffled(keys.filter(k => k !== key)).slice(0, 3);
    const options = shuffled([correct, ...distractorKeys.map(k => KARYOTYPE_CONDITIONS[k].label)]);

    return {
      type:   'karyotype',
      answer: correct,
      category: 'karyotype',
      explanation: condition.description,
      render(container) {
        container.innerHTML = `
          <p class="quiz-prompt">Observe o cariótipo abaixo (notação: <strong>${condition.notation}</strong>).
            A qual condição ele corresponde?</p>
          <div class="karyo-grid quiz-karyo-display" id="quiz-karyo-grid"></div>
          <div class="quiz-options quiz-options-conceptual" id="quiz-options"></div>
        `;
        const gridEl = container.querySelector('#quiz-karyo-grid');
        if (gridEl) renderKaryotypeGrid(gridEl, condition);
        const optionsEl = container.querySelector('#quiz-options');
        options.forEach((opt) => {
          const btn = document.createElement('button');
          btn.className = 'quiz-option quiz-option-text btn-control';
          btn.textContent = opt;
          btn.dataset.quizValue = opt;
          btn.addEventListener('click', () => submitQuizAnswer(opt, btn));
          optionsEl.appendChild(btn);
        });
      },
    };
  }

  // ─── Seleção de perguntas: pool filtrado por categoria + dificuldade ─────────
  //
  // Cada categoria contribui com (a) todo o seu banco de perguntas conceituais
  // filtrado por dificuldade, e (b) N cópias do(s) seu(s) gerador(es) dinâmico(s)
  // — repetidas `weight` vezes para dar peso equivalente a um banco de perguntas
  // essencialmente infinito (cada chamada gera uma variante nova). O `weight` foi
  // calibrado para manter, por categoria, uma proporção parecida com a que já
  // existia entre "conceitual" e "gerado dinamicamente" no Modo Desafio original.
  const DYNAMIC_QUESTION_BUILDERS = [
    { builder: buildMutationQuestion,       category: 'molecular',  difficulty: 'dificil', weight: 3 },
    { builder: buildCodonQuestion,          category: 'molecular',  difficulty: 'facil',   weight: 2 },
    { builder: buildStartStopQuestion,      category: 'molecular',  difficulty: 'facil',   weight: 2 },
    { builder: buildMendelianCrossQuestion, category: 'mendelian',  difficulty: 'medio',   weight: 5 },
    { builder: buildHardyWeinbergQuestion,  category: 'population', difficulty: 'dificil', weight: 5 },
    { builder: buildPedigreeQuestion,       category: 'pedigree',   difficulty: 'medio',   weight: 5 },
    { builder: buildKaryotypeQuestion,      category: 'karyotype',  difficulty: 'facil',   weight: 5 },
  ];

  /** Monta o pool de perguntas elegíveis (índices conceituais + geradores dinâmicos) para as categorias/dificuldade escolhidas. */
  function buildQuestionPool(categories, difficulty) {
    const pool = [];

    CONCEPTUAL_QUESTIONS.forEach((q, idx) => {
      if (!categories.has(q.category)) return;
      if (difficulty !== 'todas' && q.difficulty !== difficulty) return;
      pool.push({ kind: 'conceptual', index: idx });
    });

    DYNAMIC_QUESTION_BUILDERS.forEach((entry) => {
      if (!categories.has(entry.category)) return;
      if (difficulty !== 'todas' && entry.difficulty !== difficulty) return;
      for (let i = 0; i < entry.weight; i++) pool.push({ kind: 'dynamic', builder: entry.builder });
    });

    return pool;
  }

  /** Chave única de uma entrada do pool, usada só para evitar repetir a MESMA pergunta duas vezes seguidas. */
  function poolEntryKey(entry) {
    return entry.kind === 'conceptual' ? 'c' + entry.index : 'd' + entry.builder.name;
  }

  // ─── Máquina de estados do quiz ───────────────────────────────────────────────

  /**
   * Inicializa o cache de elementos do painel do quiz. Chamada em DOMContentLoaded.
   *
   * O quiz vive em sua própria página (.content.quiz), navegada pelo sistema do
   * dom.js via li#quiz no sidebar — exatamente como todas as outras páginas.
   * Antes de começar a jogar, o usuário passa por uma tela de configuração
   * (#quiz-setup) onde escolhe a dificuldade e os tipos de conteúdo desejados;
   * só então startQuiz() é chamado.
   */
  function initQuizUI() {
    quiz.els = {
      panel:               document.getElementById('quiz-panel'),
      modeTitle:           document.getElementById('quiz-mode-title'),
      modeSubtitle:        document.getElementById('quiz-mode-subtitle'),
      scoreboardSurvival:  document.getElementById('quiz-scoreboard-survival'),
      scoreboardPractice:  document.getElementById('quiz-scoreboard-practice'),
      score:               document.getElementById('quiz-score'),
      best:                document.getElementById('quiz-best'),
      practiceCorrect:     document.getElementById('quiz-practice-correct'),
      practiceTotal:       document.getElementById('quiz-practice-total'),
      setup:               document.getElementById('quiz-setup'),
      modeChipsWrap:       document.getElementById('quiz-mode-chips'),
      difficultyChipsWrap: document.getElementById('quiz-difficulty-chips'),
      categoryChipsWrap:   document.getElementById('quiz-category-chips'),
      setupHint:           document.getElementById('quiz-setup-hint'),
      startBtn:            document.getElementById('quiz-start-btn'),
      questionArea:        document.getElementById('quiz-question-area'),
      feedback:            document.getElementById('quiz-feedback'),
      explanation:         document.getElementById('quiz-explanation'),
      practiceStats:       document.getElementById('quiz-practice-stats'),
      practiceStatsList:   document.getElementById('quiz-practice-stats-list'),
      finishPracticeBtn:   document.getElementById('quiz-finish-practice-btn'),
      gameover:            document.getElementById('quiz-gameover'),
      gameoverText:        document.getElementById('quiz-gameover-text'),
      gameoverStatsList:   document.getElementById('quiz-gameover-stats-list'),
      exitBtn:              document.getElementById('quiz-exit-btn'),
      retryBtn:             document.getElementById('quiz-retry-btn'),
      backBtn:              document.getElementById('quiz-back-btn'),
    };

    quiz.best = loadQuizBestScore();
    if (quiz.els.best) quiz.els.best.textContent = quiz.best;

    // Clique no item do sidebar (li#quiz) mostra a tela de configuração, além da navegação de página do dom.js
    const sidebarQuizBtn = document.getElementById('quiz');
    if (sidebarQuizBtn) sidebarQuizBtn.addEventListener('click', showQuizSetup);

    if (quiz.els.exitBtn)  quiz.els.exitBtn.addEventListener('click', exitQuiz);
    if (quiz.els.retryBtn) quiz.els.retryBtn.addEventListener('click', startQuiz);
    if (quiz.els.backBtn)  quiz.els.backBtn.addEventListener('click', exitQuiz);
    if (quiz.els.finishPracticeBtn) quiz.els.finishPracticeBtn.addEventListener('click', () => endQuiz());

    // Chips de modo de jogo (Sobrevivência / Prática) — seleção única
    const modeChips = quiz.els.modeChipsWrap
      ? Array.from(quiz.els.modeChipsWrap.querySelectorAll('.quiz-chip')) : [];
    modeChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        modeChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        quiz.settings.mode = chip.getAttribute('data-mode');
        applyQuizModeToSetupUI();
      });
    });

    // Chips de dificuldade — seleção única (só um pode estar "active" por vez)
    const difficultyChips = quiz.els.difficultyChipsWrap
      ? Array.from(quiz.els.difficultyChipsWrap.querySelectorAll('.quiz-chip')) : [];
    difficultyChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        difficultyChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        quiz.settings.difficulty = chip.getAttribute('data-difficulty');
      });
    });

    // Chips de conteúdo — seleção múltipla, mas nunca permite zero categorias selecionadas
    const categoryChips = quiz.els.categoryChipsWrap
      ? Array.from(quiz.els.categoryChipsWrap.querySelectorAll('.quiz-chip')) : [];
    categoryChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const cat = chip.getAttribute('data-category');
        if (chip.classList.contains('active')) {
          const activeCount = categoryChips.filter((c) => c.classList.contains('active')).length;
          if (activeCount <= 1) {
            setQuizSetupHint('Selecione ao menos um tipo de conteúdo.');
            return;
          }
          chip.classList.remove('active');
          quiz.settings.categories.delete(cat);
        } else {
          chip.classList.add('active');
          quiz.settings.categories.add(cat);
        }
        setQuizSetupHint('');
      });
    });

    if (quiz.els.startBtn) {
      quiz.els.startBtn.addEventListener('click', () => {
        if (quiz.settings.categories.size === 0) {
          setQuizSetupHint('Selecione ao menos um tipo de conteúdo.');
          return;
        }
        startQuiz();
      });
    }

    applyQuizModeToSetupUI();
  }

  /** Ajusta título, subtítulo e placar visíveis (Sobrevivência vs. Prática) conforme o modo escolhido na tela de setup. */
  function applyQuizModeToSetupUI() {
    const isPractice = quiz.settings.mode === 'practice';
    if (quiz.els.modeTitle) quiz.els.modeTitle.textContent = isPractice ? 'Prática' : 'Sobrevivência';
    if (quiz.els.modeSubtitle) {
      quiz.els.modeSubtitle.textContent = isPractice
        ? 'Responda no seu ritmo: errar não encerra a sessão. Cada pergunta mostra uma explicação, e seu desempenho é acompanhado por assunto.'
        : 'Responda o máximo de perguntas seguidas que conseguir. Um erro encerra a rodada — escolha abaixo a dificuldade e os assuntos que vão cair no desafio.';
    }
    if (quiz.els.scoreboardSurvival) quiz.els.scoreboardSurvival.style.display = isPractice ? 'none' : 'flex';
    if (quiz.els.scoreboardPractice) quiz.els.scoreboardPractice.style.display = isPractice ? 'flex' : 'none';
  }

  /** Exibe uma mensagem de aviso na tela de configuração (ex.: "selecione ao menos uma categoria"). */
  function setQuizSetupHint(message) {
    if (quiz.els.setupHint) quiz.els.setupHint.textContent = message;
  }

  /** Volta para a tela de configuração (dificuldade + categorias), escondendo pergunta/fim de jogo. */
  function showQuizSetup() {
    quiz.active = false;
    if (quiz.els.setup)          quiz.els.setup.style.display = 'block';
    if (quiz.els.questionArea)   quiz.els.questionArea.style.display = 'none';
    if (quiz.els.gameover)       quiz.els.gameover.style.display = 'none';
    if (quiz.els.practiceStats)  quiz.els.practiceStats.style.display = 'none';
    if (quiz.els.feedback)       { quiz.els.feedback.textContent = ''; quiz.els.feedback.className = 'quiz-feedback'; }
    if (quiz.els.explanation)    { quiz.els.explanation.style.display = 'none'; quiz.els.explanation.textContent = ''; }
    setQuizSetupHint('');
  }

  /** Reinicia o placar (e, no Modo Prática, as estatísticas por categoria) e renderiza a primeira pergunta. */
  function startQuiz() {
    quiz.active = true;
    quiz.score  = 0;
    quiz.lastPoolKey = null;
    resetQuizCategoryStats();
    if (quiz.els.score)          quiz.els.score.textContent = '0';
    if (quiz.els.practiceCorrect) quiz.els.practiceCorrect.textContent = '0';
    if (quiz.els.practiceTotal)   quiz.els.practiceTotal.textContent = '0';
    if (quiz.els.setup)          quiz.els.setup.style.display = 'none';
    if (quiz.els.gameover)       quiz.els.gameover.style.display = 'none';
    if (quiz.els.questionArea)   quiz.els.questionArea.style.display = 'block';
    const isPractice = quiz.settings.mode === 'practice';
    if (quiz.els.practiceStats) quiz.els.practiceStats.style.display = isPractice ? 'block' : 'none';
    if (isPractice) renderPracticeStats(quiz.els.practiceStatsList);
    nextQuestion();
  }

  /**
   * Navega de volta ao Simulador clicando em #app no sidebar.
   * dom.js cuida de remover a classe .active da página de quiz e ativar .content.app.
   */
  function exitQuiz() {
    quiz.active = false;
    const appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();
  }

  /**
   * Monta o pool de perguntas elegíveis para a configuração atual e sorteia uma,
   * evitando repetir a mesma pergunta duas vezes seguidas quando há alternativa.
   * Se a combinação categoria+dificuldade escolhida não render nenhuma pergunta
   * (situação rara, já que toda categoria cobre as 3 dificuldades), a dificuldade
   * é ignorada nessa rodada específica para nunca deixar o usuário travado.
   */
  function nextQuestion() {
    quiz.checked = false;
    if (quiz.els.feedback)    { quiz.els.feedback.textContent = ''; quiz.els.feedback.className = 'quiz-feedback'; }
    if (quiz.els.explanation) { quiz.els.explanation.style.display = 'none'; quiz.els.explanation.textContent = ''; }

    let pool = buildQuestionPool(quiz.settings.categories, quiz.settings.difficulty);
    if (pool.length === 0) pool = buildQuestionPool(quiz.settings.categories, 'todas');
    if (pool.length === 0) return; // não deveria acontecer: nenhuma categoria selecionada

    let question = null;
    for (let attempt = 0; attempt < 6 && !question; attempt++) {
      let pick = pool[Math.floor(Math.random() * pool.length)];
      if (pool.length > 1 && poolEntryKey(pick) === quiz.lastPoolKey) {
        pick = pool[Math.floor(Math.random() * pool.length)];
      }
      question = pick.kind === 'conceptual'
        ? buildConceptualQuestionFromIndex(pick.index)
        : pick.builder();
      if (question) quiz.lastPoolKey = poolEntryKey(pick);
    }
    if (!question) return; // extremamente improvável (ex.: buildMutationQuestion falhou repetidamente)

    quiz.answer = question.answer;
    quiz.explanation = question.explanation || null;
    quiz.currentCategory = question.category || null;
    if (quiz.els.questionArea) question.render(quiz.els.questionArea);
  }

  /** Mostra a explicação de 1-2 frases do gabarito da pergunta atual (se houver uma cadastrada). */
  function showQuizExplanation() {
    if (!quiz.els.explanation) return;
    if (!quiz.explanation) { quiz.els.explanation.style.display = 'none'; return; }
    quiz.els.explanation.innerHTML = `<i class="fas fa-lightbulb"></i> <strong>Por quê:</strong> ${quiz.explanation}`;
    quiz.els.explanation.style.display = 'block';
  }

  /**
   * Constrói a lista de <li> com a barra de acerto por categoria, usada tanto no
   * painel ao vivo do Modo Prática quanto no resumo final da sessão.
   */
  function renderPracticeStats(listEl) {
    if (!listEl) return;
    listEl.innerHTML = '';
    Object.keys(QUIZ_CATEGORY_LABELS).forEach((cat) => {
      if (!quiz.settings.categories.has(cat)) return;
      const stat = quiz.categoryStats[cat] || { correct: 0, wrong: 0 };
      const total = stat.correct + stat.wrong;
      const pct = total > 0 ? Math.round((stat.correct / total) * 100) : 0;
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${QUIZ_CATEGORY_LABELS[cat]}</span>
        <span class="quiz-practice-stats-bar-wrap"><span class="quiz-practice-stats-bar" style="width:${pct}%"></span></span>
        <span>${stat.correct}/${total || 0}${total > 0 ? ` (${pct}%)` : ''}</span>
      `;
      listEl.appendChild(li);
    });
  }

  /** Avalia a opção clicada, dá feedback visual, mostra a explicação e decide se continua ou encerra a sequência. */
  function submitQuizAnswer(value, btnEl) {
    if (quiz.checked) return; // ignora cliques extras após já ter respondido
    quiz.checked = true;

    const isCorrect = value === quiz.answer;
    const isPractice = quiz.settings.mode === 'practice';
    const optionButtons = quiz.els.questionArea
      ? Array.from(quiz.els.questionArea.querySelectorAll('.quiz-option'))
      : [];
    optionButtons.forEach((btn) => { btn.disabled = true; });
    btnEl.classList.add(isCorrect ? 'quiz-correct' : 'quiz-incorrect');

    // No Modo Prática, contabiliza o acerto/erro por categoria, independente do resultado geral.
    if (isPractice && quiz.currentCategory && quiz.categoryStats[quiz.currentCategory]) {
      quiz.categoryStats[quiz.currentCategory][isCorrect ? 'correct' : 'wrong'] += 1;
      renderPracticeStats(quiz.els.practiceStatsList);
    }

    if (isCorrect) {
      quiz.score += 1;
      if (quiz.els.score) quiz.els.score.textContent = String(quiz.score);
      if (quiz.els.practiceCorrect) quiz.els.practiceCorrect.textContent = String(quiz.score);
      if (!isPractice && quiz.score > quiz.best) {
        quiz.best = quiz.score;
        saveQuizBestScore(quiz.best);
        if (quiz.els.best) quiz.els.best.textContent = String(quiz.best);
      }
      if (quiz.els.feedback) {
        quiz.els.feedback.textContent = '✅ Correto! Próxima pergunta…';
        quiz.els.feedback.className = 'quiz-feedback quiz-feedback-correct';
      }
    } else {
      // Destaca também qual era a opção correta, usando o valor exato (não texto) de cada botão.
      const correctBtn = optionButtons.find((btn) => btn.dataset.quizValue === String(quiz.answer));
      if (correctBtn) correctBtn.classList.add('quiz-correct-reveal');

      if (quiz.els.feedback) {
        quiz.els.feedback.textContent = '❌ Resposta incorreta.';
        quiz.els.feedback.className = 'quiz-feedback quiz-feedback-incorrect';
      }
    }

    showQuizExplanation();

    if (isPractice) {
      // Modo Prática: nunca encerra por errar. Total de "respondidas" conta certas + erradas.
      const totalAnswered = Object.values(quiz.categoryStats).reduce((sum, s) => sum + s.correct + s.wrong, 0);
      if (quiz.els.practiceTotal) quiz.els.practiceTotal.textContent = String(totalAnswered);
      setTimeout(nextQuestion, isCorrect ? 1400 : 2600); // erro fica mais tempo na tela para dar tempo de ler a explicação
    } else if (isCorrect) {
      setTimeout(nextQuestion, 1400);
    } else {
      setTimeout(() => endQuiz(), 2600);
    }
  }

  /** Encerra a sessão (sobrevivência OU prática) e mostra a tela de fim de jogo com o resumo correspondente. */
  function endQuiz() {
    quiz.active = false;
    if (quiz.els.questionArea)  quiz.els.questionArea.style.display = 'none';
    if (quiz.els.practiceStats) quiz.els.practiceStats.style.display = 'none';
    if (quiz.els.gameover)      quiz.els.gameover.style.display = 'block';

    const isPractice = quiz.settings.mode === 'practice';
    if (quiz.els.gameoverText) {
      if (isPractice) {
        const totalAnswered = Object.values(quiz.categoryStats).reduce((sum, s) => sum + s.correct + s.wrong, 0);
        quiz.els.gameoverText.innerHTML = totalAnswered > 0
          ? `Sessão de prática encerrada. Você acertou <strong>${quiz.score}</strong> de <strong>${totalAnswered}</strong> pergunta${totalAnswered === 1 ? '' : 's'} respondida${totalAnswered === 1 ? '' : 's'}. Confira abaixo seu desempenho por assunto:`
          : 'Sessão de prática encerrada antes de responder qualquer pergunta.';
      } else {
        const isNewRecord = quiz.score > 0 && quiz.score === quiz.best;
        quiz.els.gameoverText.innerHTML =
          `Você acertou <strong>${quiz.score}</strong> pergunta${quiz.score === 1 ? '' : 's'} seguida${quiz.score === 1 ? '' : 's'}.` +
          (isNewRecord
            ? ' <strong>🏆 Novo recorde!</strong>'
            : ` Recorde atual: <strong>${quiz.best}</strong>.`);
      }
    }
    if (quiz.els.gameoverStatsList) {
      if (isPractice) renderPracticeStats(quiz.els.gameoverStatsList);
      else quiz.els.gameoverStatsList.innerHTML = '';
    }
  }

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
      applyComplementaryStrandVisibility(isOn);
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

    for (const base of bases) insertBase(base, { skipRender: true });
    translate();
    treatSequence();

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
      btn.addEventListener('click', () => insertBase(btn.dataset.base));
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
    const btnOpenMendel = document.getElementById('btn-open-mendel');
    const btnOpenEpistasis = document.getElementById('btn-open-epistasis');
    const btnOpenAbo = document.getElementById('btn-open-abo');
    if (btnClear)      btnClear.addEventListener('click', clearSequence);
    if (btnRandom)     btnRandom.addEventListener('click', randomSequence);
    if (btnExport)     btnExport.addEventListener('click', openExportModal);
    if (btnImport)     btnImport.addEventListener('click', openImportModal);
    if (btnAnimate)    btnAnimate.addEventListener('click', openRibosomeModal);
    if (btnCrispr)     btnCrispr.addEventListener('click', openCrisprModal);
    if (btnReplicate)  btnReplicate.addEventListener('click', openReplicationModal);
    if (btnOpenMendel) btnOpenMendel.addEventListener('click', openMendelModal);
    if (btnOpenEpistasis) btnOpenEpistasis.addEventListener('click', openEpistasisModal);
    if (btnOpenAbo)       btnOpenAbo.addEventListener('click', openAboModal);

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

    if (dogmaStepReplication) dogmaStepReplication.addEventListener('click', openReplicationModal);
    if (dogmaStepTranslation) dogmaStepTranslation.addEventListener('click', openRibosomeModal);
    if (dogmaStepTranscription) {
      dogmaStepTranscription.addEventListener('click', () => {
        if (transcriptionProcessBox && transcriptionProcessBox.scrollIntoView) {
          transcriptionProcessBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        animateBasePairing();
      });
    }
    if (btnPlayPairing) {
      btnPlayPairing.addEventListener('click', (event) => {
        event.stopPropagation();
        animateBasePairing();
      });
    }

    const btnExerciseGenerator = document.getElementById('btn-exercise-generator');
    if (btnExerciseGenerator) btnExerciseGenerator.addEventListener('click', openExerciseGeneratorModal);

    const epistasisGenerateBtn = document.getElementById('epistasis-generate-btn');
    const epistasisScenarioSelect = document.getElementById('epistasis-scenario-select');
    if (epistasisGenerateBtn) epistasisGenerateBtn.addEventListener('click', renderEpistasisResult);
    if (epistasisScenarioSelect) epistasisScenarioSelect.addEventListener('change', renderEpistasisResult);

    const aboGenerateBtn = document.getElementById('abo-generate-btn');
    if (aboGenerateBtn) aboGenerateBtn.addEventListener('click', renderAboResult);

    const exerciseGenGenerateBtn = document.getElementById('exercise-gen-generate-btn');
    const exerciseGenActions     = document.getElementById('exercise-gen-actions');
    if (exerciseGenGenerateBtn) {
      exerciseGenGenerateBtn.addEventListener('click', () => {
        const count     = Number(document.getElementById('exercise-gen-count').value) || 10;
        const numCodons = Number(document.getElementById('exercise-gen-length').value) || 7;
        exerciseSet = generateExerciseSet(count, numCodons);
        renderExercisePreview(exerciseSet);
        renderExercisePrintables(exerciseSet);
        if (exerciseGenActions) exerciseGenActions.hidden = false;
      });
    }

    const exerciseGenPrintWorksheetBtn = document.getElementById('exercise-gen-print-worksheet');
    const exerciseGenPrintKeyBtn       = document.getElementById('exercise-gen-print-key');
    const exerciseGenDownloadBtn       = document.getElementById('exercise-gen-download-txt');
    if (exerciseGenPrintWorksheetBtn) {
      exerciseGenPrintWorksheetBtn.addEventListener('click', () => printExerciseContent('exercise-worksheet-printable'));
    }
    if (exerciseGenPrintKeyBtn) {
      exerciseGenPrintKeyBtn.addEventListener('click', () => printExerciseContent('exercise-answerkey-printable'));
    }
    if (exerciseGenDownloadBtn) {
      exerciseGenDownloadBtn.addEventListener('click', () => downloadExercisesAsText(exerciseSet));
    }

    // Modais de exportar/importar/animar sequência/construir cruzamento/CRISPR/replicação
    const exportModal = document.getElementById('export-modal');
    const importModal = document.getElementById('import-modal');
    const ribosomeModal = document.getElementById('ribosome-modal');
    const mendelModal = document.getElementById('mendel-modal');
    const epistasisModal = document.getElementById('epistasis-modal');
    const aboModal = document.getElementById('abo-modal');
    const crisprModal = document.getElementById('crispr-modal');
    const replicationModal = document.getElementById('replication-modal');
    const exerciseGeneratorModal = document.getElementById('exercise-generator-modal');
    const exportCloseBtn = document.getElementById('export-modal-close');
    const importCloseBtn = document.getElementById('import-modal-close');
    const ribosomeCloseBtn = document.getElementById('ribosome-modal-close');
    const mendelCloseBtn = document.getElementById('mendel-modal-close');
    const epistasisCloseBtn = document.getElementById('epistasis-modal-close');
    const aboCloseBtn = document.getElementById('abo-modal-close');
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

    if (exportCloseBtn)      exportCloseBtn.addEventListener('click', () => closeModal(exportModal));
    if (importCloseBtn)      importCloseBtn.addEventListener('click', () => closeModal(importModal));
    if (ribosomeCloseBtn)    ribosomeCloseBtn.addEventListener('click', () => closeModal(ribosomeModal));
    if (mendelCloseBtn)      mendelCloseBtn.addEventListener('click', () => closeModal(mendelModal));
    if (epistasisCloseBtn)   epistasisCloseBtn.addEventListener('click', () => closeModal(epistasisModal));
    if (aboCloseBtn)         aboCloseBtn.addEventListener('click', () => closeModal(aboModal));
    if (crisprCloseBtn)      crisprCloseBtn.addEventListener('click', () => closeModal(crisprModal));
    if (replicationCloseBtn) replicationCloseBtn.addEventListener('click', () => closeModal(replicationModal));
    if (exerciseGeneratorCloseBtn) exerciseGeneratorCloseBtn.addEventListener('click', () => closeModal(exerciseGeneratorModal));

    // Fecha ao clicar fora da caixa (no overlay escurecido)
    const allSeqModals = [exportModal, importModal, ribosomeModal, mendelModal, epistasisModal, aboModal, crisprModal, replicationModal, exerciseGeneratorModal];
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

    // Controles de Mutação (Genética Molecular) — Adição / Deleção / Substituição
    if (addButton)     addButton.addEventListener('click', () => setMutationMode('add'));
    if (deleteButton)  deleteButton.addEventListener('click', () => setMutationMode('delete'));
    if (replaceButton) replaceButton.addEventListener('click', () => setMutationMode('replace'));

    // Controles do construtor de cruzamentos (Genética Mendeliana)
    const mendelModeMonoBtn = document.getElementById('mendel-mode-mono');
    const mendelModeDiBtn   = document.getElementById('mendel-mode-di');
    const mendelGenerateBtn = document.getElementById('mendel-generate-btn');
    const mendelG1Pattern   = document.getElementById('mendel-g1-pattern');
    const mendelG2Pattern   = document.getElementById('mendel-g2-pattern');
    if (mendelModeMonoBtn) mendelModeMonoBtn.addEventListener('click', () => setMendelMode('mono'));
    if (mendelModeDiBtn)   mendelModeDiBtn.addEventListener('click', () => setMendelMode('di'));
    if (mendelGenerateBtn) mendelGenerateBtn.addEventListener('click', generateMendelCross);
    if (mendelG1Pattern)   mendelG1Pattern.addEventListener('change', () => updateMendelHetFieldVisibility(0));
    if (mendelG2Pattern)   mendelG2Pattern.addEventListener('change', () => updateMendelHetFieldVisibility(1));

    // Controles da ferramenta de Heredogramas
    const pedigreeModeStudyBtn = document.getElementById('pedigree-mode-study');
    const pedigreeModeQuizBtn  = document.getElementById('pedigree-mode-quiz');
    const pedigreeGenerateBtn  = document.getElementById('pedigree-generate-btn');
    const pedigreeQuizGenerateBtn = document.getElementById('pedigree-quiz-generate-btn');
    const pedigreeQuizAnswersWrap = document.getElementById('pedigree-quiz-answers');
    if (pedigreeModeStudyBtn)     pedigreeModeStudyBtn.addEventListener('click', () => setPedigreeMode('study'));
    if (pedigreeModeQuizBtn)      pedigreeModeQuizBtn.addEventListener('click', () => setPedigreeMode('quiz'));
    if (pedigreeGenerateBtn)      pedigreeGenerateBtn.addEventListener('click', generateStudyPedigree);
    if (pedigreeQuizGenerateBtn)  pedigreeQuizGenerateBtn.addEventListener('click', generateQuizPedigree);
    if (pedigreeQuizAnswersWrap) {
      pedigreeQuizAnswersWrap.querySelectorAll('.crispr-pathway-card').forEach((btn) => {
        btn.addEventListener('click', () => answerPedigreeQuiz(btn.dataset.answer));
      });
    }

    // Controles da calculadora de Genética Populacional (Hardy-Weinberg)
    const popgenModeQsquaredBtn = document.getElementById('popgen-mode-qsquared');
    const popgenModePBtn        = document.getElementById('popgen-mode-p');
    const popgenModeTestBtn     = document.getElementById('popgen-mode-test');
    const popgenCalcQsquaredBtn = document.getElementById('popgen-calc-qsquared-btn');
    const popgenCalcPBtn        = document.getElementById('popgen-calc-p-btn');
    const popgenTestBtn         = document.getElementById('popgen-test-btn');
    if (popgenModeQsquaredBtn) popgenModeQsquaredBtn.addEventListener('click', () => setPopgenMode('qsquared'));
    if (popgenModePBtn)        popgenModePBtn.addEventListener('click', () => setPopgenMode('p'));
    if (popgenModeTestBtn)     popgenModeTestBtn.addEventListener('click', () => setPopgenMode('test'));
    if (popgenCalcQsquaredBtn) popgenCalcQsquaredBtn.addEventListener('click', calcPopgenFromQSquared);
    if (popgenCalcPBtn)        popgenCalcPBtn.addEventListener('click', calcPopgenFromP);
    if (popgenTestBtn)         popgenTestBtn.addEventListener('click', testPopgenEquilibrium);

    // Controles do Visualizador de Cariótipo e do Simulador de Não-disjunção
    const karyoViewBtn      = document.getElementById('karyo-view-btn');
    const nondisModeMiBtn   = document.getElementById('nondis-mode-mi');
    const nondisModeMiiBtn  = document.getElementById('nondis-mode-mii');
    const nondisSimulateBtn = document.getElementById('nondis-simulate-btn');
    if (karyoViewBtn)      karyoViewBtn.addEventListener('click', viewSelectedKaryotype);
    if (nondisModeMiBtn)   nondisModeMiBtn.addEventListener('click', () => setNondisMode('MI'));
    if (nondisModeMiiBtn)  nondisModeMiiBtn.addEventListener('click', () => setNondisMode('MII'));
    if (nondisSimulateBtn) nondisSimulateBtn.addEventListener('click', runNondisjunctionSimulation);

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
        exportNodeAsPng(svg, 'heredograma.png');
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
        exportNodeAsPng(grid, 'cariotipo.svg');
      });
    }

    // Controles do editor CRISPR-Cas9
    const crisprLoadDemoBtn    = document.getElementById('crispr-load-demo');
    const crisprSearchBtn      = document.getElementById('crispr-search-btn');
    const crisprPathwayNhejBtn = document.getElementById('crispr-pathway-nhej');
    const crisprPathwayHdrBtn  = document.getElementById('crispr-pathway-hdr');
    const crisprHdrGenerateBtn = document.getElementById('crispr-hdr-generate-btn');
    const crisprApplyBtn       = document.getElementById('crispr-apply-btn');
    if (crisprLoadDemoBtn)    crisprLoadDemoBtn.addEventListener('click', loadCrisprDemoSequence);
    if (crisprSearchBtn)      crisprSearchBtn.addEventListener('click', searchCrisprTarget);
    if (crisprPathwayNhejBtn) crisprPathwayNhejBtn.addEventListener('click', () => selectCrisprPathway('nhej'));
    if (crisprPathwayHdrBtn)  crisprPathwayHdrBtn.addEventListener('click', () => selectCrisprPathway('hdr'));
    if (crisprHdrGenerateBtn) crisprHdrGenerateBtn.addEventListener('click', generateCrisprHdrPreview);
    if (crisprApplyBtn)       crisprApplyBtn.addEventListener('click', applyCrisprEditToSimulator);

    if (exportCopySeqBtn) {
      exportCopySeqBtn.addEventListener('click', () =>
        copyTextareaContent('export-seq-text', document.getElementById('export-feedback'), 'Sequência copiada!'));
    }
    if (exportCopyLinkBtn) {
      exportCopyLinkBtn.addEventListener('click', () =>
        copyTextareaContent('export-seq-link', document.getElementById('export-feedback'), 'Link copiado!'));
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
        exportNodeAsPng(panel, 'simulador-genetica.svg');
        if (feedback) {
          feedback.textContent = 'Imagem baixada!';
          feedback.classList.remove('error');
        }
      });
    }

    if (importLoadBtn) importLoadBtn.addEventListener('click', handleImportSubmit);
    if (importSeqInput) {
      // Atalho Ctrl/Cmd+Enter para carregar sem precisar clicar no botão
      importSeqInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) handleImportSubmit();
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
      applyComplementaryStrandVisibility(localStorage.getItem(SHOW_COMPLEMENTARY_STRAND_KEY) === '1');
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

})();