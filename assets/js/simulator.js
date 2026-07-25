(function () {
  'use strict';
  var PS = window.PS = window.PS || {};

  function complementBase(base) {
    return DNA_COMPLEMENT[base.toUpperCase()] || base;
  }

  /** Complemento de uma fita inteira, alinhada base a base com o original (visão "escada"). */

  function complementStrand(seq) {
    return seq.toUpperCase().split('').map(complementBase).join('');
  }

  const OKAZAKI_FRAGMENT_SIZE = 4;

  /** Divide o comprimento de uma fita em fragmentos de Okazaki (índices [start,end) de cada um). */

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

  function focusWithoutKeyboard(el) {
    if (!el) return;
    el.setAttribute('readonly', 'readonly');
    el.focus({ preventScroll: true });
    setTimeout(() => el.removeAttribute('readonly'), 100);
  }

  /** Cria e retorna um elemento de aminoácido completo com rótulos e event listeners. */

  function scrollUnique() {
    if (PS._scrollLock) return;
    PS._scrollLock = true;
    const sl = this.scrollLeft;
    for (let i = 0; i < textboxDna.length; i++) {
      PS.textboxDna[i].scrollLeft       = sl;
      PS.textboxRna[i].scrollLeft       = sl;
      PS.outputAminoacids[i].scrollLeft = sl;
      if (PS.complementContainers[i]) PS.complementContainers[i].scrollLeft = sl;
    }
    PS._scrollLock = false;
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
      PS.textboxDna[0].insertBefore(dnaInput, PS.blankSpace);
      PS.textboxRna[0].appendChild(rnaInput);
      dnaInput.focus();
    } else {
      const last = PS.dnaSequenceChars[dnaSequenceChars.length - 1];
      last.focus();
      last.selectionStart = 1;
    }
  }

  // ─── Handlers de teclado ─────────────────────────────────────────────────────

  /** Trata a entrada de caracteres em um sequenceChar (evento keypress). */

  function updateCounters() {
    const codonCounter     = document.getElementById('codon-counter');
    const aminoacidCounter = document.getElementById('aminoacid-counter');
    const gcCounter         = document.getElementById('gc-counter');
    if (!codonCounter || !aminoacidCounter) return;

    const totalCodons = Math.floor(rnaSequenceChars.length / 3);
    const activeAAs   = Array.from(PS.outputAminoacids[0].getElementsByClassName('aminoacid'))
                             .filter(el => !el.classList.contains('not-availlable')).length;

    codonCounter.textContent     = totalCodons;
    aminoacidCounter.textContent = activeAAs;
    // GC é igual em qualquer uma das duas fitas (G sempre pareia com C), então
    // calcular em cima da fita molde já representa a dupla-hélice inteira.
    if (gcCounter) gcCounter.textContent = computeGCContent(PS.dnaSequenceChars) + '%';
  }

  // ─── Análise de mutação ───────────────────────────────────────────────────────

  /**
   * Alinha duas sequências (arrays de itens comparáveis) usando alinhamento
   * com penalidade de gap afim (algoritmo de Gotoh) — a mesma técnica usada
   * em bioinformática pra alinhar sequências com inserções/deleções.
   *
   * Comparar posição-a-posição (`origSeq[i] === mutSeq[i]`) quebra assim que
   * uma base é inserida ou removida: tudo que vem depois passa a ocupar um
   * índice diferente, então bases idênticas acabam marcadas como "diferentes"
   * só por terem se deslocado. Este alinhamento resolve isso identificando
   * corretamente:
   *   - itens que continuam idênticos, mesmo deslocados de posição;
   *   - itens realmente alterados (substituição, no mesmo "lugar" da fita);
   *   - itens inseridos, sem correspondente na sequência original.
   *
   * A penalidade de abrir um gap (GAP_OPEN) é maior que a de estendê-lo
   * (GAP_EXTEND), então o algoritmo prefere UM bloco contíguo de
   * inserção/deleção a vários blocos espalhados — importante pra
   * representar o evento biológico real (ex: a inserção de 4 bases na
   * Doença de Tay-Sachs) como um único evento, e não uma sequência de
   * trocas soltas de base.
   *
   * @param {Array} origItems - itens da sequência original.
   * @param {Array} mutItems  - itens da sequência mutada.
   * @param {function} [equalsFn] - compara dois itens (padrão: ===).
   * @returns {Array<'match'|'sub'|'ins'>} um resultado por item de mutItems —
   *   itens de origItems que foram deletados não geram saída (não há
   *   posição correspondente do lado mutado pra destacar).
   */



  // ─── Grupo C - Sequência e tradução ───────────────────────

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

  function syncFrameClasses() {
    // Cada par DNA/RNA (o do simulador principal e o do painel de mutação) tem
    // seu próprio quadro de leitura — achado uma vez a partir da fita de RNA
    // daquele par, e reaproveitado tanto pra fita de DNA quanto pra fita de RNA
    // (mesma posição, mesma correspondência base a base).
    const mainFrameStart = findFirstStartIndex(readSequence(PS.rnaSequenceChars));
    applyCodonClasses(PS.dnaSequenceChars, mainFrameStart);
    applyCodonClasses(PS.rnaSequenceChars, mainFrameStart);
    renderComplementaryStrand(PS.dnaSequenceChars, PS.complementContainers[0], mainFrameStart);

    const mutRnaChars   = PS.textboxRna[1].getElementsByClassName('sequenceChar');
    const mutDnaChars   = PS.textboxDna[1].getElementsByClassName('sequenceChar');
    const mutFrameStart = findFirstStartIndex(readSequence(mutRnaChars));
    applyCodonClasses(mutDnaChars, mutFrameStart);
    applyCodonClasses(mutRnaChars, mutFrameStart);
    renderComplementaryStrand(mutDnaChars, PS.complementContainers[1], mutFrameStart);
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
    const rnaBox = PS.textboxRna[0];

    // Remove rótulos anteriores
    const stale = rnaBox.getElementsByClassName('codon-label');
    while (stale.length > 0) rnaBox.removeChild(stale[0]);

    const seq = readSequence(PS.rnaSequenceChars);
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

      const startChar = PS.rnaSequenceChars[baseIndex];
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

  function translate() {
    // BUGFIX: garante que .codon-utr/.codon-utr-end já estejam aplicadas
    // ANTES de translateStrand() medir offsetLeft pra montar o spacer da
    // UTR — ver nota em syncFrameClasses(). Sem isso, o spacer é medido com
    // o layout de uma tecla atrás e o aminoácido sai desalinhado do códon.
    syncFrameClasses();
    translateStrand(PS.rnaSequenceChars, PS.outputAminoacids[0]);
    updateCounters();
  }

  /** Atualiza os contadores de códons e aminoácidos ativos na UI. */
  // updateCounters movida para assets/js/simulator.js


  function alignSequences(origItems, mutItems, equalsFn) {
    const eq = equalsFn || function (a, b) { return a === b; };
    const n = origItems.length;
    const m = mutItems.length;

    if (n === 0) return mutItems.map(function () { return 'ins'; });
    if (m === 0) return [];

    const MISMATCH  = 1;
    const GAP_OPEN   = 1;
    const GAP_EXTEND = 0.3;
    const INF = Infinity;

    // M[i][j]  = custo mínimo alinhando origItems[0..i) com mutItems[0..j),
    //            terminando em correspondência (match ou substituição).
    // Ix[i][j] = ...terminando em um item original sem correspondente
    //            (deleção — consome origItems, não gera saída em mutItems).
    // Iy[i][j] = ...terminando em um item mutado sem correspondente
    //            (inserção — gera saída 'ins').
    const M = [], Ix = [], Iy = [];
    for (let i = 0; i <= n; i++) {
      M.push(new Array(m + 1).fill(INF));
      Ix.push(new Array(m + 1).fill(INF));
      Iy.push(new Array(m + 1).fill(INF));
    }

    M[0][0] = 0;
    for (let i = 1; i <= n; i++) Ix[i][0] = GAP_OPEN + (i - 1) * GAP_EXTEND;
    for (let j = 1; j <= m; j++) Iy[0][j] = GAP_OPEN + (j - 1) * GAP_EXTEND;

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = eq(origItems[i - 1], mutItems[j - 1]) ? 0 : MISMATCH;
        M[i][j]  = Math.min(M[i - 1][j - 1], Ix[i - 1][j - 1], Iy[i - 1][j - 1]) + cost;
        Ix[i][j] = Math.min(M[i - 1][j] + GAP_OPEN, Ix[i - 1][j] + GAP_EXTEND);
        Iy[i][j] = Math.min(M[i][j - 1] + GAP_OPEN, Iy[i][j - 1] + GAP_EXTEND);
      }
    }

    const EPS = 1e-9;
    const result = new Array(m);
    let i = n, j = m;
    let state = (M[i][j] <= Ix[i][j] && M[i][j] <= Iy[i][j]) ? 'M' : (Ix[i][j] <= Iy[i][j] ? 'Ix' : 'Iy');

    while (i > 0 || j > 0) {
      if (state === 'M') {
        const isMatch = eq(origItems[i - 1], mutItems[j - 1]);
        result[j - 1] = isMatch ? 'match' : 'sub';
        const cost = isMatch ? 0 : MISMATCH;
        if (Math.abs(M[i][j] - (M[i - 1][j - 1] + cost)) < EPS) state = 'M';
        else if (Math.abs(M[i][j] - (Ix[i - 1][j - 1] + cost)) < EPS) state = 'Ix';
        else state = 'Iy';
        i--; j--;
      } else if (state === 'Ix') {
        state = Math.abs(Ix[i][j] - (M[i - 1][j] + GAP_OPEN)) < EPS ? 'M' : 'Ix';
        i--;
      } else {
        result[j - 1] = 'ins';
        state = Math.abs(Iy[i][j] - (M[i][j - 1] + GAP_OPEN)) < EPS ? 'M' : 'Iy';
        j--;
      }
    }

    // BUGFIX: quando a sequência ao redor de uma inserção/deleção é
    // repetitiva (comum em DNA, alfabeto de só 4 letras — ex.:
    // "...CGACGACGA..."), mais de um alinhamento tem exatamente o MESMO
    // custo mínimo: o bloco inserido pode "deslizar" uma ou mais posições
    // sem gerar nenhuma diferença extra. O traceback do Gotoh acima
    // resolve esse empate de forma arbitrária (só depende da ordem em que
    // os estados são preenchidos), então a mesma inserção digitada em
    // pontos diferentes da fita pode aparecer destacada uma base "pra
    // trás" do ponto real, ou o destaque parecer não seguir nenhum
    // padrão — exatamente o sintoma relatado (funciona na maioria dos
    // casos, mas "buga" e destaca bases que não foram digitadas).
    // rightAlignInsertions() elimina essa ambiguidade adotando a mesma
    // convenção usada em nomenclatura genética (regra 3' do HGVS): entre
    // alinhamentos de custo igual, sempre normaliza para a posição mais
    // à direita — a mesma razão pela qual a inserção da Doença de
    // Tay-Sachs é descrita como "1278insTATC" e não uma posição antes.
    rightAlignInsertions(mutItems, result, eq);
    return result;
  }

  /**
   * Normaliza blocos de inserção ('ins') que podem ser deslocados para a
   * direita sem alterar o custo do alinhamento — ou seja, a base que
   * "sai" do início do bloco é idêntica à base que "entra" logo depois
   * dele. Isso só é possível em trechos de sequência repetitivos, que são
   * exatamente onde o traceback de alignSequences() é ambíguo (mais de um
   * alinhamento igualmente ótimo). Sem essa normalização, o resultado do
   * traceback depende de detalhes de implementação e não de onde a base
   * foi realmente inserida.
   *
   * Ex.: original "TACCGACGACGAATT", mutada "TACTATCCGACGACGAATT"
   * (inserção real de "TATC" logo após "TAC", como na Doença de
   * Tay-Sachs). Sem a normalização, o traceback encontra um bloco de
   * mesmo custo uma posição adiantado ("CTAT" em vez de "TATC"), porque
   * "C" se repete logo depois. Deslocando o bloco pra direita enquanto a
   * base que sai da frente for igual à que entra atrás, chegamos no
   * bloco correto.
   *
   * @param {Array} mutItems - itens da sequência mutada (mesmos passados a alignSequences).
   * @param {Array<'match'|'sub'|'ins'>} tags - resultado de alignSequences, alterado in-place.
   * @param {function} eq - mesma função de comparação usada no alinhamento.
   */

  function rightAlignInsertions(mutItems, tags, eq) {
    const m = tags.length;
    let changed = true;
    while (changed) {
      changed = false;
      let idx = 0;
      while (idx < m) {
        if (tags[idx] !== 'ins') { idx++; continue; }
        let end = idx;
        while (end < m && tags[end] === 'ins') end++;
        // Desliza o bloco [idx, end) pra direita enquanto o item que sai
        // da frente do bloco (mutItems[idx]) for idêntico ao item logo
        // depois do bloco (mutItems[end]) — só então a troca não muda o
        // resultado final da fita mutada nem o custo do alinhamento.
        while (end < m && tags[end] === 'match' && eq(mutItems[idx], mutItems[end])) {
          tags[idx] = 'match';
          tags[end] = 'ins';
          idx++; end++;
          changed = true;
        }
        idx = end;
      }
    }
    return tags;
  }

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

    const isActive = PS.mutationWindow[0] && PS.mutationWindow[0].classList.contains('active');
    if (mutPanel.panel) mutPanel.panel.style.display = isActive ? 'block' : 'none';
    if (!isActive) return;

    const aminoacids        = PS.outputAminoacids[1].getElementsByClassName('aminoacid');
    const mutatedAminoacids = PS.outputAminoacids[0].getElementsByClassName('aminoacid');
    const dna        = PS.textboxDna[1].getElementsByClassName('sequenceChar');
    const mutatedDna = PS.textboxDna[0].getElementsByClassName('sequenceChar');
    const rna        = PS.textboxRna[1].getElementsByClassName('sequenceChar');
    const mutatedRna = PS.textboxRna[0].getElementsByClassName('sequenceChar');

    const dnaSeq        = readSequence(dna);
    const mutatedDnaSeq = readSequence(mutatedDna);
    const rnaSeq        = readSequence(rna);
    const mutatedRnaSeq = readSequence(mutatedRna);

    // Destaca bases mutadas no DNA e no RNA (alinhamento — ver alignSequences()
    // — em vez de comparação posição-a-posição, que erra em inserções/deleções)
    highlightMutated(mutatedDna, dnaSeq, mutatedDnaSeq);
    highlightMutated(mutatedRna, rnaSeq, mutatedRnaSeq);

    // Destaca aminoácidos mutados, com o mesmo alinhamento — assim um
    // aminoácido que só "andou de posição" por causa de uma inserção/deleção
    // anterior não é marcado como se tivesse mudado.
    const origAaTokens = Array.prototype.map.call(aminoacids, function (el) {
      const abbrev = el.querySelector('.abbreviated-name');
      return abbrev ? abbrev.innerHTML : '';
    });
    const mutAaTokens = Array.prototype.map.call(mutatedAminoacids, function (el) {
      const abbrev = el.querySelector('.abbreviated-name');
      return abbrev ? abbrev.innerHTML : '';
    });
    const aaAlignment = alignSequences(origAaTokens, mutAaTokens);
    for (let i = 0; i < mutatedAminoacids.length; i++) {
      const tag = aaAlignment[i];
      mutatedAminoacids[i].classList.toggle('mutated', tag === 'ins' || tag === 'sub');
    }

    classifyMutation(dnaSeq, mutatedDnaSeq);
  }

  /**
   * Adiciona ou remove a classe "mutated" nos elementos da sequência mutada,
   * usando o alinhamento de alignSequences() em vez de comparação
   * posição-a-posição — assim inserções e deleções não desalinham (e
   * portanto não "contaminam" com destaque falso) as bases que vêm depois
   * delas na fita.
   *
   * @param {HTMLCollection} mutated  - Inputs mutados (sequenceChar).
   * @param {string} origSeq  - Sequência original como string.
   * @param {string} mutSeq   - Sequência mutada como string.
   */

  // ─── Registro no PS ───────────────────────────────────────────────────
  var fns = ['complementBase','complementStrand','transcribe','translateDnaHeadless',
    'computeGCContent','findFirstStartIndex','walkCodingRegion','anticodonFor',
    'generateRandomCodingDna','sanitizeDnaInput','transcribeSeq',
    'translateProteinChainPure','classifyMutationPure',
    'clearSequenceChars','focusWithoutKeyboard','scrollUnique',
    'activateDnaInput','updateCounters',
    'applyCodonClasses','renderComplementaryStrand','syncFrameClasses','treatSequence','updateCodonLabels','translateStrand','translate','alignSequences','rightAlignInsertions','mutationDifference']
  for (var i = 0; i < fns.length; i++) {
    (function(n) { try { PS[n] = eval(n); } catch(e) {} })(fns[i]);
  }
})();