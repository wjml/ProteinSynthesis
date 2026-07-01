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

  /**
   * Exibe uma notificação informativa não-bloqueante (ex: sequência carregada via link).
   * Silenciosa se o SweetAlert ainda não estiver disponível, para não interromper a carga da página.
   */
  function showInfo(title, text) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ type: 'success', title, text, timer: 2800, showConfirmButton: false });
    }
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

  /** Mapeia o tipo químico do aminoácido (AMINOACIDS_DB) para a classe CSS de cor da célula. */
  function codonCellClass(abbrevName) {
    if (abbrevName === 'STOP') return 'codon-stop';
    const data = AMINOACIDS_DB[abbrevName];
    const type = (data && data.type) || '';
    if (type.includes('Ácido'))  return 'base-acid';
    if (type.includes('Básico')) return 'base-basic';
    if (type.includes('Apolar')) return 'base-apolar';
    return 'base-polar';
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
        const startChar = rnaSequenceChars[c * 3];
        if (!startChar) continue;

        const lbl = document.createElement('div');
        lbl.className   = 'codon-label codon-label-' + kind;
        lbl.textContent = kind === 'start' ? 'INÍCIO' : 'PARADA';
        lbl.style.left  = startChar.offsetLeft + 'px';
        rnaBox.appendChild(lbl);
      }
    }
  }

  /**
   * Traduz a sequência de RNA de uma fita específica em aminoácidos e renderiza no container dado.
   * Generaliza a lógica usada tanto pela fita ativa (live) quanto pela fita de comparação (baseline),
   * permitindo reuso em loadDiseaseExample().
   */
  function translateStrand(rnaChars, outputContainer) {
    outputContainer.innerHTML = '';

    const sequence = readSequence(rnaChars);
    let hasStart = false;

    for (let i = 0; i < sequence.length; i += 3) {
      const codon     = sequence.substr(i, 3);
      const aminoacid = CODON_TABLE[codon];
      if (!aminoacid) continue;

      if (aminoacid.abbrevName === 'MET')  hasStart = true;
      if (aminoacid.abbrevName === 'STOP') hasStart = false;

      outputContainer.appendChild(hasStart ? newAminoacid(aminoacid) : newAminoacid());
    }
  }

  /**
   * Traduz a fita ativa (live, índice 0) e atualiza os contadores da UI.
   * BUGFIX: a variável `aminoacids` não era declarada no original, tornando-se global.
   */
  function translate() {
    translateStrand(rnaSequenceChars, outputAminoacids[0]);
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
        if (next && next.classList.contains('sequenceChar')) next.focus();
      } else {
        const newDna = newSequenceChar(base, 'sequenceChar', 'Base de DNA');
        const newRna = newSequenceChar(transcribe(base), 'sequenceChar', 'Base de RNA mensageiro');
        textboxDna[0].insertBefore(newDna, activeEl.nextElementSibling);
        textboxRna[0].insertBefore(newRna, rnaEl ? rnaEl.nextElementSibling : null);
        newDna.focus();
      }
    } else {
      // Nenhum input focado: anexa ao final
      const newDna = newSequenceChar(base, 'sequenceChar', 'Base de DNA');
      const newRna = newSequenceChar(transcribe(base), 'sequenceChar', 'Base de RNA mensageiro');
      textboxDna[0].insertBefore(newDna, blankSpace);
      textboxRna[0].appendChild(newRna);
      newDna.focus();
    }

    if (!skipRender) {
      translate();
      treatSequence();
    }
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
    if (lastDnaInput) lastDnaInput.focus();

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

    modal.style.display = 'flex';
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

    modal.style.display = 'flex';
    if (input) input.focus();
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
   * Permite que professores distribuam desafios prontos por link.
   */
  function loadSequenceFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('seq');
    if (!raw) return;

    const { clean } = sanitizeDnaInput(raw);
    if (!clean) return;

    const appBtn = document.getElementById('app');
    if (appBtn) appBtn.click();

    loadSequenceFromString(clean);
    showInfo('Sequência carregada!', 'Uma sequência de DNA foi importada automaticamente via link compartilhado.');
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
    let hasStart = false;
    for (let i = 0; i + 3 <= rnaSeq.length; i += 3) {
      const codon     = rnaSeq.substr(i, 3);
      const aminoacid = CODON_TABLE[codon];
      if (!aminoacid) continue;

      if (aminoacid.abbrevName === 'MET') hasStart = true;
      if (aminoacid.abbrevName === 'STOP') { hasStart = false; continue; }
      if (hasStart) chain.push(aminoacid.abbrevName);
    }
    return chain;
  }

  /**
   * Classifica uma mutação comparando duas sequências de DNA (original e mutada),
   * em string puro — mesma regra de negócio de classifyMutation(), mas retornando
   * apenas a chave do tipo ('frameshift'|'silent'|'nonsense'|'missense'), sem
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
    frameshift: { className: 'frameshift', text: 'Deslocamento de Leitura (Frameshift)' },
  };

  /** Estado do Modo Desafio. Vive durante a sessão; só persiste o recorde (localStorage). */
  const quiz = {
    active:  false,
    score:   0,
    best:    0,
    answer:  null,  // valor esperado para a pergunta atual (formato depende do tipo)
    checked: false, // impede clicar em mais de uma opção após já ter respondido
    els:     {},    // cache de elementos da UI, preenchido em initQuizUI()
  };

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

  // ─── Banco de perguntas conceituais ──────────────────────────────────────────
  //
  // Cada objeto segue o contrato { question, correct, distractors[] }.
  // Os distratores são os três incorretos; a ordem das 4 opções é embaralhada
  // em buildConceptualQuestion() antes de renderizar, então não importa a ordem aqui.
  //
  // Categorias cobertas:
  //   • Dogma central e enzimas envolvidas
  //   • Transcrição e processamento do mRNA
  //   • Tradução: ribossomo, tRNA, anticódon, fases
  //   • Função e significado do AUG
  //   • Tipos de mutação por descrição conceitual
  //   • Código genético: degeneração, universalidade
  //   • Casos clínicos (anemia falciforme, beta-talassemia)

  const CONCEPTUAL_QUESTIONS = [
    // ── Dogma central ────────────────────────────────────────────────────────
    {
      question: 'Qual é a sequência correta do dogma central da biologia molecular?',
      correct:  'DNA → RNA → Proteína',
      distractors: ['RNA → DNA → Proteína', 'Proteína → DNA → RNA', 'DNA → Proteína → RNA'],
    },
    {
      question: 'Qual enzima é responsável por sintetizar o mRNA a partir de um molde de DNA?',
      correct:  'RNA polimerase',
      distractors: ['DNA polimerase', 'Ribonuclease', 'DNA ligase'],
    },
    {
      question: 'Durante a tradução, qual molécula transporta os aminoácidos até o ribossomo?',
      correct:  'RNA transportador (tRNA)',
      distractors: ['RNA mensageiro (mRNA)', 'RNA ribossômico (rRNA)', 'DNA complementar (cDNA)'],
    },
    {
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
      question: 'A transcrição produz qual molécula diretamente?',
      correct:  'RNA pré-mensageiro (pré-mRNA)',
      distractors: ['Proteína', 'DNA dupla-fita', 'tRNA maduro'],
    },
    {
      question: 'O que são íntrons?',
      correct:  'Sequências não codificantes do pré-mRNA que são removidas durante o processamento',
      distractors: [
        'Sequências codificantes que permanecem no mRNA maduro',
        'Regiões do DNA que controlam a transcrição',
        'Porções do tRNA que reconhecem o códon',
      ],
    },
    {
      question: 'O que é splicing do RNA?',
      correct:  'Remoção dos íntrons e junção dos éxons para formar o mRNA maduro',
      distractors: [
        'Adição do cap 5\' ao mRNA',
        'Exportação do mRNA do núcleo para o citoplasma',
        'Síntese da cauda poli-A no mRNA',
      ],
    },
    {
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
      question: 'O que é um anticódon?',
      correct:  'Sequência de 3 nucleotídeos no tRNA que é complementar a um códon do mRNA',
      distractors: [
        'Sequência de 3 nucleotídeos no mRNA que codifica um aminoácido',
        'Região do ribossomo que catalisa a ligação peptídica',
        'Sequência do DNA molde lida pela RNA polimerase',
      ],
    },
    {
      question: 'Em qual local celular ocorre a tradução em células eucarióticas?',
      correct:  'No ribossomo (citoplasma ou retículo endoplasmático rugoso)',
      distractors: ['No núcleo', 'Na mitocôndria exclusivamente', 'No aparelho de Golgi'],
    },
    {
      question: 'Qual é a fase final da tradução?',
      correct:  'Terminação — o ribossomo encontra um códon de parada e libera a cadeia polipeptídica',
      distractors: [
        'Elongação — adição sucessiva de aminoácidos',
        'Iniciação — montagem do complexo ribossômico no mRNA',
        'Ativação — ligação do aminoácido ao tRNA',
      ],
    },
    {
      question: 'Quantos nucleotídeos formam um códon?',
      correct:  '3',
      distractors: ['2', '4', '1'],
    },
    {
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
      question: 'Qual é a função do códon AUG na tradução?',
      correct:  'Sinalizar o início da tradução e codificar o aminoácido metionina',
      distractors: [
        'Sinalizar o fim da cadeia polipeptídica',
        'Codificar o aminoácido leucina, que inicia toda proteína',
        'Indicar o local de splicing no pré-mRNA',
      ],
    },
    {
      question: 'Qual aminoácido é sempre o primeiro a ser incorporado na síntese de uma proteína?',
      correct:  'Metionina (Met / M)',
      distractors: ['Alanina (Ala / A)', 'Lisina (Lys / K)', 'Valina (Val / V)'],
    },
    {
      question: 'O que ocorre quando o ribossomo encontra um códon de parada (UAA, UAG ou UGA)?',
      correct:  'Fatores de liberação se ligam ao sítio A e a tradução é encerrada, soltando a proteína',
      distractors: [
        'O ribossomo reinicia a tradução no próximo AUG',
        'Um tRNA especial adiciona um aminoácido de terminação',
        'O mRNA é imediatamente degradado',
      ],
    },
    {
      question: 'Quantos códons de parada existem no código genético padrão?',
      correct:  '3 (UAA, UAG e UGA)',
      distractors: ['1 (UAA apenas)', '2 (UAA e UAG)', '4 (UAA, UAG, UGA e UAC)'],
    },

    // ── Código genético ──────────────────────────────────────────────────────
    {
      question: 'O código genético é dito "degenerado" (ou redundante). O que isso significa?',
      correct:  'Vários códons diferentes podem codificar o mesmo aminoácido',
      distractors: [
        'Genes defeituosos acumulam mutações ao longo do tempo',
        'O código genético varia entre espécies diferentes',
        'Um único códon pode codificar vários aminoácidos distintos',
      ],
    },
    {
      question: 'O código genético é descrito como "quase universal". O que isso significa?',
      correct:  'A grande maioria dos seres vivos usa o mesmo código de códons para aminoácidos',
      distractors: [
        'Todos os organismos têm exatamente o mesmo genoma',
        'Apenas organismos eucarióticos compartilham o código genético',
        'O número de genes é igual em todos os seres vivos',
      ],
    },
    {
      question: 'Quantos aminoácidos distintos são codificados pelo código genético padrão?',
      correct:  '20',
      distractors: ['16', '24', '64'],
    },

    // ── Tipos de mutação — conceituais ───────────────────────────────────────
    {
      question: 'O que define uma mutação missense (sentido trocado)?',
      correct:  'Uma substituição de base que leva à troca de um aminoácido por outro na proteína',
      distractors: [
        'Uma substituição de base que não altera o aminoácido codificado',
        'Uma inserção que desloca o quadro de leitura',
        'Uma substituição que gera um códon de parada prematuro',
      ],
    },
    {
      question: 'O que é uma mutação nonsense (sem sentido)?',
      correct:  'Uma mutação que converte um códon de aminoácido em um códon de parada prematuro',
      distractors: [
        'Uma mutação que troca um aminoácido por outro sem alterar a função da proteína',
        'Uma deleção de múltiplos códons sem deslocar o quadro de leitura',
        'Uma inserção de bases que não altera a sequência de aminoácidos',
      ],
    },
    {
      question: 'Por que uma mutação sinônima (silenciosa) geralmente não altera a proteína?',
      correct:  'Porque o novo códon codifica o mesmo aminoácido, devido à degeneração do código genético',
      distractors: [
        'Porque a mutação ocorre em um íntron que é removido no splicing',
        'Porque a proteína possui mecanismos de autocorreção',
        'Porque a substituição acontece fora da fase de leitura',
      ],
    },
    {
      question: 'Qual tipo de mutação tem maior potencial de alterar completamente a proteína a partir do ponto da mutação?',
      correct:  'Frameshift (deslocamento do quadro de leitura)',
      distractors: ['Missense', 'Silenciosa (sinônima)', 'Nonsense'],
    },
    {
      question: 'Uma deleção de 2 nucleotídeos em uma região codificante provoca qual efeito?',
      correct:  'Deslocamento do quadro de leitura (frameshift), alterando todos os aminoácidos seguintes',
      distractors: [
        'Remoção de um único aminoácido sem alterar o restante da proteína',
        'Inserção de um códon de parada no meio da sequência',
        'Nenhum efeito, pois dois nucleotídeos se compensam mutuamente',
      ],
    },
    {
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
      question: 'Na anemia falciforme, que tipo de mutação ocorre no gene da hemoglobina β?',
      correct:  'Missense — um único nucleotídeo substituído troca ácido glutâmico por valina na posição 6',
      distractors: [
        'Frameshift — deleção de uma base desloca o quadro de leitura',
        'Nonsense — uma substituição gera um códon de parada prematuro',
        'Silenciosa — a sequência de aminoácidos não é alterada',
      ],
    },
    {
      question: 'Por que a anemia falciforme causa a deformação das hemácias em foice?',
      correct:  'A valina (hidrofóbica) no lugar do ácido glutâmico faz as moléculas de HbS se agregarem quando desoxigenadas',
      distractors: [
        'A proteína mutada é produzida em quantidade excessiva, sobrecarregando a hemácia',
        'A mutação impede a ligação do ferro ao grupo heme da hemoglobina',
        'A cadeia β mutada é degradada antes de formar a hemoglobina completa',
      ],
    },
    {
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
      question: 'O que são agentes mutagênicos?',
      correct:  'Agentes físicos, químicos ou biológicos que aumentam a taxa de mutações no DNA',
      distractors: [
        'Enzimas que corrigem erros de replicação do DNA',
        'Proteínas que regulam a expressão gênica',
        'Moléculas que transportam informação genética entre células',
      ],
    },
    {
      question: 'Qual das afirmações sobre mutações germinativas está correta?',
      correct:  'Ocorrem em células germinativas (óvulos ou espermatozoides) e podem ser transmitidas à descendência',
      distractors: [
        'Ocorrem em células somáticas e afetam apenas o indivíduo que as carrega',
        'São sempre letais e eliminadas antes do nascimento',
        'Não alteram a sequência de DNA, apenas a expressão gênica',
      ],
    },
    {
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
      question: 'O que é um promotor em um gene?',
      correct:  'Sequência de DNA onde a RNA polimerase se liga para iniciar a transcrição',
      distractors: [
        'Sequência que codifica os primeiros aminoácidos da proteína',
        'Região não traduzida no final do mRNA (3\' UTR)',
        'Local onde o ribossomo se liga para iniciar a tradução',
      ],
    },
    {
      question: 'Qual é a definição mais precisa de um gene?',
      correct:  'Sequência de DNA que contém informação para síntese de uma proteína funcional ou RNA funcional',
      distractors: [
        'Qualquer sequência de DNA presente no genoma de um organismo',
        'Apenas as regiões do DNA que são transcritas em mRNA',
        'Um fragmento de DNA com pelo menos 100 pares de bases',
      ],
    },
  ];

  /**
   * Sorteia uma pergunta do banco conceitual e a renderiza com 4 opções (1 certa + 3 distratores).
   * Nunca repete a mesma pergunta consecutivamente — guarda o índice da última usada para evitar
   * duas iguais seguidas (mas permite que ela reapareça mais tarde).
   */
  let _lastConceptualIndex = -1;

  function buildConceptualQuestion() {
    let idx;
    do {
      idx = Math.floor(Math.random() * CONCEPTUAL_QUESTIONS.length);
    } while (idx === _lastConceptualIndex && CONCEPTUAL_QUESTIONS.length > 1);
    _lastConceptualIndex = idx;

    const q = CONCEPTUAL_QUESTIONS[idx];
    const options = shuffled([q.correct, ...q.distractors]);

    return {
      type:   'conceptual',
      answer: q.correct,
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

  // Pesos de seleção de tipo de pergunta:
  //   conceptual  → 55 %  (conhecimento teórico que é cobrado em prova)
  //   mutation    → 25 %  (identificação de tipo a partir de sequências)
  //   startstop   →  10 %  (reconhecimento de AUG/stop na fita)
  //   codon       →  10 %  (tradução de códon — mantido, mas com peso reduzido)
  const QUIZ_QUESTION_BUILDERS = [
    buildConceptualQuestion, buildConceptualQuestion, buildConceptualQuestion,
    buildConceptualQuestion, buildConceptualQuestion,                          // 5 × conceptual
    buildMutationQuestion, buildMutationQuestion,                              // 2 × mutation
    buildStartStopQuestion,                                                    // 1 × startstop
    buildCodonQuestion,                                                        // 1 × codon
  ];

  // ─── Máquina de estados do quiz ───────────────────────────────────────────────

  /**
   * Inicializa o cache de elementos do painel do quiz. Chamada em DOMContentLoaded.
   *
   * O quiz agora vive em sua própria página (.content.quiz), navegada pelo sistema
   * do dom.js via li#quiz no sidebar — exatamente como todas as outras páginas.
   * Por isso:
   *   • Não há mais referências a elementos do simulador (simulator-controls,
   *     sequences, mutation-panel) — essas páginas ficam intactas o tempo todo.
   *   • startQuiz() não precisa mais navegar para #app nem manipular display de
   *     outros elementos; só reseta o estado do quiz e renderiza a primeira pergunta.
   *   • exitQuiz() apenas clica em #app no sidebar para navegar de volta.
   */
  function initQuizUI() {
    quiz.els = {
      panel:        document.getElementById('quiz-panel'),
      score:        document.getElementById('quiz-score'),
      best:         document.getElementById('quiz-best'),
      questionArea: document.getElementById('quiz-question-area'),
      feedback:     document.getElementById('quiz-feedback'),
      gameover:     document.getElementById('quiz-gameover'),
      gameoverText: document.getElementById('quiz-gameover-text'),
      exitBtn:      document.getElementById('quiz-exit-btn'),
      retryBtn:     document.getElementById('quiz-retry-btn'),
      backBtn:      document.getElementById('quiz-back-btn'),
    };

    quiz.best = loadQuizBestScore();
    if (quiz.els.best) quiz.els.best.textContent = quiz.best;

    // Clique no item do sidebar (li#quiz) dispara startQuiz() além da navegação de página do dom.js
    const sidebarQuizBtn = document.getElementById('quiz');
    if (sidebarQuizBtn) sidebarQuizBtn.addEventListener('click', startQuiz);

    if (quiz.els.exitBtn)  quiz.els.exitBtn.addEventListener('click', exitQuiz);
    if (quiz.els.retryBtn) quiz.els.retryBtn.addEventListener('click', startQuiz);
    if (quiz.els.backBtn)  quiz.els.backBtn.addEventListener('click', exitQuiz);
  }

  /** Reinicia o placar e renderiza a primeira pergunta da rodada. */
  function startQuiz() {
    quiz.active = true;
    quiz.score  = 0;
    if (quiz.els.score)        quiz.els.score.textContent = '0';
    if (quiz.els.gameover)     quiz.els.gameover.style.display = 'none';
    if (quiz.els.questionArea) quiz.els.questionArea.style.display = 'block';
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

  /** Sorteia um tipo de pergunta, gera e renderiza. */
  function nextQuestion() {
    quiz.checked = false;
    if (quiz.els.feedback) { quiz.els.feedback.textContent = ''; quiz.els.feedback.className = 'quiz-feedback'; }

    const builder  = QUIZ_QUESTION_BUILDERS[Math.floor(Math.random() * QUIZ_QUESTION_BUILDERS.length)];
    const question = builder();
    quiz.answer = question.answer;
    if (quiz.els.questionArea) question.render(quiz.els.questionArea);
  }

  /** Avalia a opção clicada, dá feedback visual e decide se continua ou encerra a sequência. */
  function submitQuizAnswer(value, btnEl) {
    if (quiz.checked) return; // ignora cliques extras após já ter respondido
    quiz.checked = true;

    const isCorrect = value === quiz.answer;
    const optionButtons = quiz.els.questionArea
      ? Array.from(quiz.els.questionArea.querySelectorAll('.quiz-option'))
      : [];
    optionButtons.forEach((btn) => { btn.disabled = true; });
    btnEl.classList.add(isCorrect ? 'quiz-correct' : 'quiz-incorrect');

    if (isCorrect) {
      quiz.score += 1;
      if (quiz.els.score) quiz.els.score.textContent = String(quiz.score);
      if (quiz.score > quiz.best) {
        quiz.best = quiz.score;
        saveQuizBestScore(quiz.best);
        if (quiz.els.best) quiz.els.best.textContent = String(quiz.best);
      }
      if (quiz.els.feedback) {
        quiz.els.feedback.textContent = '✅ Correto! Próxima pergunta…';
        quiz.els.feedback.className = 'quiz-feedback quiz-feedback-correct';
      }
      setTimeout(nextQuestion, 1100);
    } else {
      // Destaca também qual era a opção correta, usando o valor exato (não texto) de cada botão.
      const correctBtn = optionButtons.find((btn) => btn.dataset.quizValue === String(quiz.answer));
      if (correctBtn) correctBtn.classList.add('quiz-correct-reveal');

      if (quiz.els.feedback) {
        quiz.els.feedback.textContent = '❌ Resposta incorreta.';
        quiz.els.feedback.className = 'quiz-feedback quiz-feedback-incorrect';
      }
      setTimeout(() => endQuiz(), 900);
    }
  }

  /** Encerra a sessão de sobrevivência e mostra a tela de fim de jogo com o placar final. */
  function endQuiz() {
    if (quiz.els.questionArea) quiz.els.questionArea.style.display = 'none';
    if (quiz.els.gameover) quiz.els.gameover.style.display = 'block';
    if (quiz.els.gameoverText) {
      const isNewRecord = quiz.score > 0 && quiz.score === quiz.best;
      quiz.els.gameoverText.innerHTML =
        `Você acertou <strong>${quiz.score}</strong> pergunta${quiz.score === 1 ? '' : 's'} seguida${quiz.score === 1 ? '' : 's'}.` +
        (isNewRecord
          ? ' <strong>🏆 Novo recorde!</strong>'
          : ` Recorde atual: <strong>${quiz.best}</strong>.`);
    }
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
    // Gera a tabela de 64 códons a partir de CODON_TABLE antes de vincular os cliques nela
    buildCodonTable();

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
    if (btnClear)  btnClear.addEventListener('click', clearSequence);
    if (btnRandom) btnRandom.addEventListener('click', randomSequence);
    if (btnExport) btnExport.addEventListener('click', openExportModal);
    if (btnImport) btnImport.addEventListener('click', openImportModal);

    // Modais de exportar/importar sequência
    const exportModal = document.getElementById('export-modal');
    const importModal = document.getElementById('import-modal');
    const exportCloseBtn = document.getElementById('export-modal-close');
    const importCloseBtn = document.getElementById('import-modal-close');
    const exportCopySeqBtn  = document.getElementById('export-copy-seq');
    const exportCopyLinkBtn = document.getElementById('export-copy-link');
    const importLoadBtn  = document.getElementById('import-load-btn');
    const importSeqInput = document.getElementById('import-seq-input');

    const closeModal = (modal) => { if (modal) modal.style.display = 'none'; };

    if (exportCloseBtn) exportCloseBtn.addEventListener('click', () => closeModal(exportModal));
    if (importCloseBtn) importCloseBtn.addEventListener('click', () => closeModal(importModal));

    // Fecha ao clicar fora da caixa (no overlay escurecido)
    [exportModal, importModal].forEach((modal) => {
      if (!modal) return;
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal(modal);
      });
    });

    // Fecha ambos os modais com a tecla Esc
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeModal(exportModal);
        closeModal(importModal);
      }
    });

    if (exportCopySeqBtn) {
      exportCopySeqBtn.addEventListener('click', () =>
        copyTextareaContent('export-seq-text', document.getElementById('export-feedback'), 'Sequência copiada!'));
    }
    if (exportCopyLinkBtn) {
      exportCopyLinkBtn.addEventListener('click', () =>
        copyTextareaContent('export-seq-link', document.getElementById('export-feedback'), 'Link copiado!'));
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
    function activateCodonItem() {
      const codon = this.getAttribute('data-codon');
      if (!codon) return;

      // Converte bases do mRNA para DNA molde: A→T, U→A, C→G, G→C
      const dnaBases = codon.split('').map(b => RNA_BASE_TO_DNA[b] || b).join('');

      const appBtn = document.getElementById('app');
      if (appBtn) appBtn.click();

      // PERFORMANCE: insere as 3 bases sem re-renderizar a cada uma (skipRender),
      // e dispara translate()/treatSequence() uma única vez ao final — antes eram
      // 3 ciclos completos de tradução + análise de mutação por clique em um códon.
      for (const base of dnaBases) insertBase(base, { skipRender: true });
      translate();
      treatSequence();
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

    // Carrega automaticamente uma sequência compartilhada via link (?seq=...), se presente
    loadSequenceFromUrl();
  });

  // Nenhuma exportação global é necessária: os cartões de doença e os botões de base
  // agora usam data-attributes + listeners delegados (ver bloco de vinculação de eventos
  // em DOMContentLoaded), em vez de onclick inline no HTML. O IIFE permanece 100% encapsulado.

})();