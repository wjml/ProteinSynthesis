/**
 * script.js — Simulador de Síntese de Proteínas
 *
 * Refatorado para performance, clareza e manutenibilidade.
 * Todo o código está encapsulado em uma IIFE para não poluir o escopo global.
 * Apenas `insertBase` é exposta globalmente (necessário por handlers inline no HTML).
 */

(function () {
  'use strict';

  // ─── Constantes ──────────────────────────────────────────────────────────────

  /** Bases nitrogenadas válidas para inserção no DNA. */
  const VALID_BASES = new Set(['A', 'T', 'C', 'G']);

  /** Códons de parada do mRNA. */
  const STOP_CODONS = new Set(['UAA', 'UAG', 'UGA']);

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

  /** Constantes de layout para posicionamento dos rótulos de códon (devem refletir o CSS). */
  const CODON_LABEL = {
    PADDING_LEFT: 6,   // px — padding-left de .textbox-rna
    SLOT_WIDTH:   128, // px — 3 × 40px (base) + 8px (codon-end margin)
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
   * Aplica as classes CSS de cor de base e posição de códon a uma coleção de inputs.
   * Substitui os 4 loops idênticos em treatSequence().
   */
  function applyCodonClasses(chars) {
    for (let i = 0; i < chars.length; i++) {
      const val = chars[i].value.toUpperCase();
      let cls = 'sequenceChar base-' + val;
      if (i % 3 === 0)      cls += ' codon-start';
      else if (i % 3 === 2) cls += ' codon-end';
      chars[i].className = cls;
    }
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
   * BUGFIX: o SweetAlert é carregado após este script no HTML,
   * portanto não pode ser chamado diretamente no nível de módulo.
   */
  function showAlert(title, text) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ type: 'error', title, text });
    } else {
      window.alert(text);
    }
  }

  // ─── Criação de elementos DOM ─────────────────────────────────────────────────

  /** Cria e retorna um novo input sequenceChar com os event listeners vinculados. */
  function newSequenceChar(value = '', className = 'sequenceChar') {
    const input = document.createElement('input');
    input.className = className;
    input.maxLength = 1;
    input.value = value.toUpperCase();
    input.addEventListener('keypress', charInput);
    input.addEventListener('keydown', actsLikeUniqueInput);
    return input;
  }

  /** Cria e retorna um elemento de aminoácido completo com rótulos e event listeners. */
  function newAminoacid(aminoacid = { name: '', abbrevName: '' }) {
    const div = document.createElement('div');
    div.className = aminoacid.name
      ? 'aminoacid ' + aminoacid.name
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

    // Interações do drawer apenas para aminoácidos reais (não para placeholders vazios)
    if (aminoacid.abbrevName) {
      div.style.cursor = 'pointer';
      div.addEventListener('click',      () => openAminoacidDrawer(aminoacid.abbrevName, true));
      div.addEventListener('mouseenter', () => openAminoacidDrawer(aminoacid.abbrevName, false));
      div.addEventListener('mouseleave', (event) => {
        if (!drawer.panel) return;
        const toEl = event.toElement || event.relatedTarget;
        // Mantém o drawer aberto se o mouse foi para dentro dele
        if (toEl && (drawer.panel.contains(toEl) || toEl === drawer.panel)) return;
        if (!drawer.panel.classList.contains('clicked-open')) {
          drawer.panel.classList.remove('open');
        }
      });
    }

    return div;
  }

  // ─── Drawer de detalhes do aminoácido ────────────────────────────────────────

  /** Preenche e abre o drawer lateral com os dados do aminoácido. */
  function openAminoacidDrawer(abbrev, isClick = false) {
    const data = AMINOACIDS_DB[abbrev];
    if (!data || !drawer.panel) return;

    drawer.title.textContent   = data.name;
    drawer.abbrevs.textContent = data.abbrevs;
    drawer.codons.textContent  = data.codons;
    if (drawer.type) drawer.type.textContent = data.type || 'N/A';
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

  // ─── Sincronização de scroll ──────────────────────────────────────────────────

  let _scrollLock = false;

  /** Sincroniza o scroll horizontal de todas as linhas (DNA, RNA, aminoácidos). */
  function scrollUnique() {
    if (_scrollLock) return;
    _scrollLock = true;
    const sl = this.scrollLeft;
    for (let i = 0; i < textboxDna.length; i++) {
      textboxDna[i].scrollLeft       = sl;
      textboxRna[i].scrollLeft       = sl;
      outputAminoacids[i].scrollLeft = sl;
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
      const dnaInput = newSequenceChar();
      const rnaInput = newSequenceChar();
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
      const newDna = newSequenceChar(key);
      const newRna = newSequenceChar(transcribe(key));
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
          const newDna = newSequenceChar(key);
          const newRna = newSequenceChar(transcribe(key));
          textboxDna[0].insertBefore(newDna, this.nextElementSibling);
          textboxRna[0].insertBefore(newRna, rnaEl ? rnaEl.nextElementSibling : null);
          newDna.focus();
        }
      } else {
        const newDna = newSequenceChar(key);
        const newRna = newSequenceChar(transcribe(key));
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
   * Aplica classes CSS de cor e posição de códon em todas as quatro linhas de sequência,
   * em seguida dispara a análise de mutação e a injeção de rótulos de códon.
   */
  function treatSequence() {
    applyCodonClasses(dnaSequenceChars);
    applyCodonClasses(rnaSequenceChars);
    applyCodonClasses(textboxDna[1].getElementsByClassName('sequenceChar'));
    applyCodonClasses(textboxRna[1].getElementsByClassName('sequenceChar'));
    mutationDifference();
    updateCodonLabels();
  }

  /**
   * Injeta rótulos pill ("INÍCIO" / "PARADA") acima do textbox de RNA
   * para os códons de início e parada, usando uma máquina de estados simples.
   *
   * Constantes de layout (devem espelhar o CSS):
   *   padding-left de .textbox-rna = 6 px
   *   uma base = 40 px | margem codon-end = 8 px → slot por códon = 128 px
   */
  function updateCodonLabels() {
    const rnaBox = textboxRna[0];

    // Remove rótulos anteriores
    const stale = rnaBox.getElementsByClassName('codon-label');
    while (stale.length > 0) rnaBox.removeChild(stale[0]);

    const seq = readSequence(rnaSequenceChars);
    if (seq.length < 3) return;

    let inCoding = false;

    for (let c = 0; c < Math.floor(seq.length / 3); c++) {
      const codon  = seq.substr(c * 3, 3);
      const isStop = STOP_CODONS.has(codon);
      let kind = null;

      if (!inCoding && codon === 'AUG') {
        inCoding = true;
        kind = 'start';
      } else if (isStop) {
        inCoding = false;
        kind = 'stop';
      }
      // AUG enquanto inCoding=true → sem rótulo (ribossomo já em andamento)

      if (kind) {
        const lbl = document.createElement('div');
        lbl.className   = 'codon-label codon-label-' + kind;
        lbl.textContent = kind === 'start' ? 'INÍCIO' : 'PARADA';
        lbl.style.left  = (CODON_LABEL.PADDING_LEFT + c * CODON_LABEL.SLOT_WIDTH) + 'px';
        rnaBox.appendChild(lbl);
      }
    }
  }

  /**
   * Traduz a sequência de RNA atual em aminoácidos e renderiza no DOM.
   * Usa CODON_TABLE (lookup O(1)) no lugar do switch de 60+ casos.
   * BUGFIX: a variável `aminoacids` não era declarada no original, tornando-se global.
   */
  function translate() {
    outputAminoacids[0].innerHTML = '';

    const sequence = readSequence(rnaSequenceChars);
    let hasStart = false;

    for (let i = 0; i < sequence.length; i += 3) {
      const codon     = sequence.substr(i, 3);
      const aminoacid = CODON_TABLE[codon];
      if (!aminoacid) continue;

      if (aminoacid.abbrevName === 'MET')  hasStart = true;
      if (aminoacid.abbrevName === 'STOP') hasStart = false;

      outputAminoacids[0].appendChild(hasStart ? newAminoacid(aminoacid) : newAminoacid());
    }

    updateCounters();
  }

  /** Atualiza os contadores de códons e aminoácidos ativos na UI. */
  function updateCounters() {
    const codonCounter     = document.getElementById('codon-counter');
    const aminoacidCounter = document.getElementById('aminoacid-counter');
    if (!codonCounter || !aminoacidCounter) return;

    const totalCodons = Math.floor(rnaSequenceChars.length / 3);
    const activeAAs   = Array.from(outputAminoacids[0].getElementsByClassName('aminoacid'))
                             .filter(el => !el.classList.contains('not-availlable')).length;

    codonCounter.textContent     = totalCodons;
    aminoacidCounter.textContent = activeAAs;
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

    if (!dnaSeq || !mutatedDnaSeq || dnaSeq === mutatedDnaSeq) {
      noMutationMsg.style.display = 'block';
      details.style.display       = 'none';
      return;
    }

    noMutationMsg.style.display = 'none';
    details.style.display       = 'flex';

    const diff    = mutatedDnaSeq.length - dnaSeq.length;
    const absDiff = Math.abs(diff);

    const getActiveAAs = (container) =>
      Array.from(container.getElementsByClassName('aminoacid'))
        .filter(el => !el.classList.contains('not-availlable'))
        .map(el => { const n = el.querySelector('.abbreviated-name'); return n ? n.textContent.trim() : ''; });

    const origAAs        = getActiveAAs(outputAminoacids[1]);
    const mutAAs         = getActiveAAs(outputAminoacids[0]);
    const aaChanged      = origAAs.join(',') !== mutAAs.join(',');
    const hasEarlierStop = mutAAs.length < origAAs.length;

    // 1. Frameshift — indel não divisível por 3
    if (diff !== 0 && diff % 3 !== 0) {
      const verb     = diff > 0
        ? `adição de <strong>${absDiff}</strong>`
        : `deleção de <strong>${absDiff}</strong>`;
      const stopNote = hasEarlierStop
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
    if (!aaChanged) {
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
    if (hasEarlierStop) {
      badge.className   = 'mutation-type-badge nonsense';
      badge.textContent = 'Sem Sentido (Nonsense)';
      desc.innerHTML    =
        `A ${mechanism} gerou um <strong>códon de parada prematuro (STOP)</strong>. ` +
        `A tradução é encerrada antes do tempo, produzindo uma proteína truncada que geralmente é instável e não funcional.`;
      return;
    }

    // 4. Missense — aminoácido(s) diferente(s) incorporados
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
   * Exposta globalmente via window.insertBase para uso pela tabela de códons e
   * handlers inline no HTML.
   */
  function insertBase(base) {
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
        if (next && next.classList.contains('sequenceChar')) next.focus();
      } else {
        const newDna = newSequenceChar(base);
        const newRna = newSequenceChar(transcribe(base));
        textboxDna[0].insertBefore(newDna, activeEl.nextElementSibling);
        textboxRna[0].insertBefore(newRna, rnaEl ? rnaEl.nextElementSibling : null);
        newDna.focus();
      }
    } else {
      // Nenhum input focado: anexa ao final
      const newDna = newSequenceChar(base);
      const newRna = newSequenceChar(transcribe(base));
      textboxDna[0].insertBefore(newDna, blankSpace);
      textboxRna[0].appendChild(newRna);
      newDna.focus();
    }

    translate();
    treatSequence();
  }

  /** Reinicia o simulador: limpa todas as sequências e desativa o modo de mutação. */
  function clearSequence() {
    addButton.classList.remove('active');
    deleteButton.classList.remove('active');
    replaceButton.classList.remove('active');
    if (mutationWindow[0]) mutationWindow[0].classList.remove('active');

    // clearSequenceChars elimina o padrão repetido 4 vezes no original
    clearSequenceChars(textboxDna[0]);
    clearSequenceChars(textboxRna[0]);
    clearSequenceChars(textboxDna[1]);
    clearSequenceChars(textboxRna[1]);

    outputAminoacids[0].innerHTML = '';
    if (outputAminoacids[1]) outputAminoacids[1].innerHTML = '';

    const appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();

    translate();
    treatSequence();
  }

  /** Gera e insere uma sequência de DNA aleatória válida (início + corpo + parada). */
  function randomSequence() {
    clearSequence();

    const bases      = ['A', 'T', 'C', 'G'];
    const numCodons  = Math.floor(Math.random() * 4) + 4; // 4 a 7 códons
    const stopCodons = ['ATT', 'ATC', 'ACT'];              // transcreve para UAA, UAG, UGA

    let dnaSeq = 'TAC'; // início: transcreve para AUG
    for (let i = 0; i < numCodons - 2; i++) {
      dnaSeq += bases[Math.floor(Math.random() * 4)];
      dnaSeq += bases[Math.floor(Math.random() * 4)];
      dnaSeq += bases[Math.floor(Math.random() * 4)];
    }
    dnaSeq += stopCodons[Math.floor(Math.random() * stopCodons.length)];

    for (const base of dnaSeq) {
      textboxDna[0].insertBefore(newSequenceChar(base), blankSpace);
      textboxRna[0].appendChild(newSequenceChar(transcribe(base)));
    }

    translate();
    treatSequence();
  }

  // ─── Vinculação de eventos ────────────────────────────────────────────────────

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
    // Preenche o cache do drawer uma única vez
    drawer.panel   = document.getElementById('aminoacid-details-drawer');
    drawer.title   = document.getElementById('drawer-title');
    drawer.abbrevs = document.getElementById('drawer-abbrevs');
    drawer.codons  = document.getElementById('drawer-codons');
    drawer.type    = document.getElementById('drawer-type');
    drawer.func    = document.getElementById('drawer-function');
    drawer.img     = document.getElementById('drawer-img');

    // Controles do simulador
    const btnClear  = document.getElementById('btn-clear');
    const btnRandom = document.getElementById('btn-random');
    if (btnClear)  btnClear.addEventListener('click', clearSequence);
    if (btnRandom) btnRandom.addEventListener('click', randomSequence);

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

    // Tabela de códons — clique insere as bases de DNA correspondentes no simulador
    document.querySelectorAll('.codon-item').forEach(function (item) {
      item.addEventListener('click', function () {
        const codon = this.getAttribute('data-codon');
        if (!codon) return;

        // Converte bases do mRNA para DNA molde: A→T, U→A, C→G, G→C
        const dnaBases = codon.split('').map(b => RNA_BASE_TO_DNA[b] || b).join('');

        const appBtn = document.getElementById('app');
        if (appBtn) appBtn.click();

        for (const base of dnaBases) insertBase(base);
      });
    });
  });

  // ─── Exportações globais ──────────────────────────────────────────────────────
  // Expõe apenas o necessário para o HTML; todo o restante permanece encapsulado.
  window.insertBase = insertBase;

})();