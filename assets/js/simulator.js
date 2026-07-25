/**
 * simulator.js — Simulador Molecular (DNA/RNA, transcrição, tradução)
 * Funções acessam estado via PS (compartilhado com script.js).
 */
(function () {
  'use strict';
  var PS = window.PS = window.PS || {};

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
   * Abre um modal seq-modal-overlay (Exportar, Importar, Ribossomo, Mendel, PS.crispr, Replicação):
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

    // Interações do PS.drawer apenas para aminoácidos reais (não para placeholders vazios).
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
   * cartões de aminoácido (newAminoacid()) e o selo do PS.drawer de detalhes —
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

    // A Roda de Códons abre o PS.drawer de detalhes ao completar um códon (ver
    // handleWheelSegmentActivate()); como acabamos de navegar para a página
    // do simulador, o PS.drawer — inclusive seu estado "fixado por clique" —
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
  // no simulador e abre o PS.drawer de detalhes — mesma ação da tabela.

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
      // preview no PS.drawer) — quem efetivamente insere é o botão #codon-
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

  /**

  // ─── Registro no PS ───────────────────────────────────────────────────
  var simFns = ['readSequence','transcribe','applyCodonClasses','renderComplementaryStrand',
    'clearSequenceChars','newSequenceChar','insertCodonAndTranslate','charInput',
    'actsLikeUniqueInput','treatSequence','animateBasePairing','translateStrand',
    'openRibosomeModal','pauseRibosome','resetRibosomeAnimation','translate',
    'classifyMutation','insertBase','clearSequence','generateRandomCodingDna',
    'randomSequence','saveSequenceAutosave','clearSequenceAutosave',
    'restoreSequenceAutosave','loadSequenceFromString','loadSequenceFromUrl',
    'clearAllStrandsKeepingMode','fillStrand','complementStrand',
    'resetReplicationAnimation','openReplicationModal','pauseReplication',
    'transcribeSeq','translateProteinChainPure','classifyMutationPure',
    'applyComplementaryStrandVisibility','sanitizeDnaInput','showInfo',
    'syncFrameClasses','mutationDifference','updateCodonLabels','updateCounters',
    'findFirstStartIndex','walkCodingRegion','computeGCContent',
    'alignSequences','rightAlignInsertions','buildRibosomeSteps','anticodonFor',
    'cacheRibosomeElements','clearRibosomeTimers','scheduleRibosome',
    'renderRibosomeTrack','positionRibosomeMarker','setPlayButtonState',
    'stepRibosome','playRibosome','focusWithoutKeyboard','newAminoacid',
    'aminoacidCategoryClass','codonCellClass','codonDisplayName',
    'buildCodonTable','buildCodonWheel','renderCodonWheelState',
    'handleWheelSegmentActivate','sendCodonWheelSelection','resetCodonWheel',
    'initCodonWheelInteractions','openAminoacidDrawer','closeDrawer',
    'bindAminoacidOutputEvents','scrollUnique','activateDnaInput',
    'wheelPolarToCartesian','wheelSectorPath','wheelLabelTransform',
    'getRnaEquivalent','cacheRibosomeElementsIfNeeded'];;
  simFns.forEach(function(fnName) {
    if (typeof eval(fnName) === 'function') {
      PS[fnName] = eval(fnName);
    }
  });

})();