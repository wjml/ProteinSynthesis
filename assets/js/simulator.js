(function () {
  "use strict";
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
   * PS.translateStrand()) é acoplado aos elementos .sequenceChar reais da tela.
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
   * Substitui o padrão de limpeza repetido 4 vezes em PS.clearSequence().
   */
  // clearSequenceChars movida para assets/js/simulator.js


  function findFirstStartIndex(rnaSeq) {
    return rnaSeq.indexOf('AUG');
  }

  /**
   * Percorre uma sequência de RNA procurando ORFs (do AUG ao primeiro STOP em
   * fase). A busca pelo AUG escaneia base a base — não fica presa a posições
   * múltiplas de 3 a partir do início da string —, então uma UTR 5' de
   * qualquer comprimento (1, 2, 4 bases...) antes do AUG real é reconhecida
   * corretamente. UNIFICAÇÃO: essa regra existia duplicada em applyCodonClasses(),
   * PS.updateCodonLabels() e translateProteinChainPure(); agora só existe aqui.
   *
   * Depois de encontrar um AUG e percorrer até o STOP correspondente (ou até
   * o fim da sequência, se não houver STOP), a busca recomeça a partir dali —
   * permitindo múltiplas ORFs na mesma sequência, cada uma na fase que seu
   * próprio AUG define (não precisa ser a mesma fase da ORF anterior).
   *
   * Para cada códon dentro de uma ORF, invoca onCodon(codon, aminoacid, isActive, baseIndex).
   * isActive é true para o AUG e todos os códons até (mas não incluindo) o STOP.
   * baseIndex é a posição (em bases) onde aquele códon começa na sequência —
   * usado por PS.updateCodonLabels() para posicionar os rótulos INÍCIO/PARADA.
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
  // como PS.translateStrand() já faz no simulador principal.

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
  // randomSequence movida para assets/js/simulator.js


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
   * localStorage a cada mudança — chamada de dentro de PS.treatSequence(), o
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
   * abbrevNames. Espelha a lógica de PS.translateStrand()/getActiveAAs(), porém
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

  function openRibosomeModal() {
    cacheRibosomeElementsIfNeeded();
    const els = ribosome.els;
    if (!els.modal) return;

    const dnaSeq = readSequence(PS.dnaSequenceChars);
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

  function cacheRibosomeElements() {
    ribosome.els = {
      modal:        document.getElementById('ribosome-modal'),
      emptyMsg:     document.getElementById('ribosome-empty-msg'),
      stage:        document.getElementById('ribo-stage'),
      controls:     document.getElementById('ribo-controls'),
      codonsTrack:  document.getElementById('ribo-codons'),
      marker:       document.getElementById('ribo-PS.ribosome-marker'),
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

  function cacheRibosomeElementsIfNeeded() {
    if (!ribosome.els.modal) cacheRibosomeElements();
  }

  /** Renderiza a trilha de códons (pílulas) e reposiciona o marcador do ribossomo no primeiro códon. */

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
   * ver PS.syncFrameClasses()/PS.translateStrand() acima), a reconciliação usa
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
        // delegação de clique/teclado do PS.drawer registrada 1x em DOMContentLoaded —
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
  // translate movida para assets/js/simulator.js

  // alignSequences movida para assets/js/simulator.js

  // rightAlignInsertions movida para assets/js/simulator.js

  // mutationDifference movida para assets/js/simulator.js


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

  function openReplicationModal() {
    if (!replication.els.modal) cacheReplicationElements();
    if (!replication.els.modal) return;

    const dna = readSequence(PS.dnaSequenceChars);
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

  function animateBasePairing() {
    pairingAnimationTimers.forEach(clearTimeout);
    pairingAnimationTimers = [];

    const total = Math.min(dnaSequenceChars.length, rnaSequenceChars.length);
    if (total === 0) return;

    const STEP_MS  = 65;
    const FLASH_MS = 550;

    for (let i = 0; i < total; i++) {
      const dnaChar = PS.dnaSequenceChars[i];
      const rnaChar = PS.rnaSequenceChars[i];
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
  // translateStrand movida para assets/js/simulator.js


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
   * sem disparar translate()/PS.treatSequence() — que recriam todos os elementos de
   * aminoácido e recalculam a análise de mutação — a cada base individual. Quem
   * chama em lote é responsável por chamar translate()/PS.treatSequence() uma única
   * vez ao final (ver activateCodonItem() e randomSequence(), que já seguia esse padrão).
   */
  // insertBase movida para assets/js/simulator.js


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

  function clearAllStrandsKeepingMode() {
    clearSequenceChars(PS.textboxDna[0]);
    clearSequenceChars(PS.textboxRna[0]);
    clearSequenceChars(PS.textboxDna[1]);
    clearSequenceChars(PS.textboxRna[1]);
    PS.outputAminoacids[0].innerHTML = '';
    if (PS.outputAminoacids[1]) PS.outputAminoacids[1].innerHTML = '';
  }

  /**
   * Preenche uma fita (DNA + RNA correspondente) a partir de uma string de bases de DNA.
   * @param {string} dnaTemplate - sequência de bases A/T/C/G.
   * @param {HTMLElement} dnaContainer - container onde os inputs de DNA serão inseridos.
   * @param {HTMLElement} rnaContainer - container onde os inputs de RNA serão inseridos.
   * @param {Node|null} beforeNode - nó de referência para insertBefore (ex: PS.blankSpace),
   *        ou null para simplesmente usar appendChild (caso da fita de comparação, que não tem blank-space).
   */

  function applyComplementaryStrandVisibility(isOn) {
    document.body.classList.toggle('show-complementary-strand', isOn);
    if (PS.toggleComplementaryBtn) {
      toggleComplementaryBtn.setAttribute('aria-pressed', String(isOn));
      const icon = toggleComplementaryBtn.querySelector('i');
      if (icon) icon.className = isOn ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
  }

  if (PS.toggleComplementaryBtn) {
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
   * (PS.textboxDna[0]) — mesmo escopo de insertBase(), o painel de mutação
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

  /** Aplica o estado atual (PS.codonWheelState) como classes visuais (dimmed/wheel-selected/wheel-completed) e atualiza o miolo. */

  function renderCodonWheelState() {
    const wrapper = document.getElementById('codon-wheel-svg-wrapper');
    if (!wrapper) return;
    const { first, second, third } = PS.codonWheelState;

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
    const { first, second, third } = PS.codonWheelState;
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

      // Preview no PS.drawer ao passar o mouse por um códon completo (anel 3), igual ao hover nos cartões de saída
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

  /** Preenche e abre o PS.drawer lateral com os dados do aminoácido. */

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
      drawer.type.className = 'info-value PS.drawer-type-badge ' + categoryClass;
    }
    if (drawer.func) drawer.func.textContent = data.func;
    if (drawer.img)  drawer.img.style.backgroundImage = `url('assets/images/aminoacids/${abbrev}.png')`;

    drawer.panel.classList.add('open');
    if (isClick) drawer.panel.classList.add('clicked-open');
  }

  /** Fecha o PS.drawer e remove o estado de "fixado por clique". */

  function closeDrawer() {
    if (!drawer.panel) return;
    drawer.panel.classList.remove('open', 'clicked-open');
  }

  /**
   * Registra, uma única vez por container de saída (#output-aminoacids),
   * os listeners delegados que substituem os 3 listeners por elemento
   * que antes eram recriados a cada tecla digitada (ver newAminoacid()).
   *
   * click/keydown (Enter/Espaço) → abre o PS.drawer "fixado".
   * mouseover/mouseout           → abre/fecha o PS.drawer em preview (hover),
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
  // scrollUnique movida para assets/js/simulator.js

  // activateDnaInput movida para assets/js/simulator.js

  // charInput movida para assets/js/simulator.js

  // actsLikeUniqueInput movida para assets/js/simulator.js

  // syncFrameClasses movida para assets/js/simulator.js

  // treatSequence movida para assets/js/simulator.js

  // updateCodonLabels movida para assets/js/simulator.js


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

  function saveSequenceAutosave() {
    try {
      const dnaSeq = readSequence(PS.dnaSequenceChars);
      if (dnaSeq) {
        window.localStorage.setItem(DNA_AUTOSAVE_KEY, dnaSeq);
        window.localStorage.setItem(DNA_AUTOSAVE_TIMESTAMP_KEY, String(Date.now()));
      }
    } catch (e) { /* localStorage indisponível — segue sem persistir */ }
  }

  /** Apaga o autosave — chamada por PS.clearSequence(), pra "Limpar tudo" não voltar sozinho no próximo F5. */

  function clearSequenceAutosave() {
    try {
      window.localStorage.removeItem(DNA_AUTOSAVE_KEY);
      window.localStorage.removeItem(DNA_AUTOSAVE_TIMESTAMP_KEY);
    } catch (e) { /* indisponível, nada a fazer */ }
  }

  /**
   * Restaura a última sequência autosalva, se existir e ainda estiver dentro
   * da janela de DNA_AUTOSAVE_MAX_AGE_MS (30 min) — chamada uma única vez na
   * inicialização, e só quando não há sequência compartilhada via URL (a URL
   * tem prioridade: ver loadSequenceFromUrl()). Mesma sanitização usada pra
   * sequência compartilhada, por segurança (localStorage pode ter sido
   * editado manualmente via devtools).
   *
   * Passado esse prazo o autosave é descartado silenciosamente: o simulador
   * inicia normalmente, sem restaurar e sem exibir "Sequência restaurada" —
   * a recuperação é só pra evitar perda acidental de trabalho recente, não
   * pra reaparecer indefinidamente a cada F5.
   */

  function restoreSequenceAutosave() {
    let raw, rawTimestamp;
    try {
      raw = window.localStorage.getItem(DNA_AUTOSAVE_KEY);
      rawTimestamp = window.localStorage.getItem(DNA_AUTOSAVE_TIMESTAMP_KEY);
    } catch (e) { return false; }
    if (!raw) return false;

    const savedAt = Number(rawTimestamp);
    const isFresh = Number.isFinite(savedAt) && (Date.now() - savedAt) <= DNA_AUTOSAVE_MAX_AGE_MS;
    if (!isFresh) {
      clearSequenceAutosave();
      return false;
    }

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
   * os inputs primeiro e só então dispara translate()/PS.treatSequence() uma única vez.
   */
  // loadSequenceFromString movida para assets/js/simulator.js


  function getRnaEquivalent(dnaInput) {
    const index = Array.prototype.indexOf.call(PS.textboxDna[0].children, dnaInput);
    return PS.textboxRna[0].children[index];
  }

  /**
   * Retorna a sequência concatenada de uma HTMLCollection de inputs.
   * Substitui os 4 loops idênticos espalhados no código original.
   */

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

  PS.textboxDna[0].addEventListener('paste', function (event) {
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
        PS.textboxDna[0].contains(activeEl) && activeEl.value === '') {
      const rnaEl = getRnaEquivalent(activeEl);
      activeEl.remove();
      if (rnaEl) rnaEl.remove();
    }

    for (const base of bases) PS.insertBase(base, { skipRender: true });
    translate();
    PS.treatSequence();

    if (wasTruncated) {
      showInfo('Sequência cortada', `Foram inseridas as ${PASTE_MAX_BASES} primeiras bases — a sequência colada era maior que o limite.`);
    }
  });

  // Scroll sync — apenas a linha de DNA emite; as demais são dirigidas por ela
  for (let i = 0; i < textboxDna.length; i++) {
    PS.textboxDna[i].addEventListener('scroll', scrollUnique);
  }

  // Clique no blank-space ou na área vazia do container ativa o input de DNA
  blankSpace.addEventListener('click', activateDnaInput);
  PS.textboxDna[0].addEventListener('click', function (event) {
    if (event.target.classList && event.target.classList.contains('sequenceChar')) return;
    if (event.target === PS.blankSpace) return;
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

    // Preenche o cache do PS.drawer uma única vez
    drawer.panel   = document.getElementById('aminoacid-details-drawer');
    drawer.title   = document.getElementById('drawer-title');
    drawer.abbrevs = document.getElementById('drawer-abbrevs');
    drawer.codons  = document.getElementById('drawer-codons');
    drawer.type    = document.getElementById('drawer-type');
    drawer.func    = document.getElementById('drawer-function');
    drawer.img     = document.getElementById('drawer-img');

    // Delegação de eventos do PS.drawer de aminoácido — um único par de listeners
    // por container, em vez de 3 listeners recriados a cada aminoácido renderizado
    // (ver newAminoacid() e bindAminoacidOutputEvents()).
    for (let i = 0; i < outputAminoacids.length; i++) {
      bindAminoacidOutputEvents(PS.outputAminoacids[i]);
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
    if (btnClear)      btnClear.addEventListener('click', clearSequence);
    if (btnRandom)     btnRandom.addEventListener('click', randomSequence);
    if (btnExport)     btnExport.addEventListener('click', PS.openExportModal);
    if (btnImport)     btnImport.addEventListener('click', PS.openImportModal);
    if (btnAnimate)    btnAnimate.addEventListener('click', openRibosomeModal);
    if (btnCrispr)     btnCrispr.addEventListener('click', PS.openCrisprModal || openCrisprModal);
    if (btnReplicate)  btnReplicate.addEventListener('click', openReplicationModal);
    if (mLabTabCross)     mLabTabCross.addEventListener('click', () => (PS.setMendelLabTab || setMendelLabTab)('cross'));
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
    if (btnExerciseGenerator) btnExerciseGenerator.addEventListener('click', PS.openExerciseGeneratorModal || openExerciseGeneratorModal);

    const epistasisGenerateBtn = document.getElementById('epistasis-generate-btn');
    const epistasisScenarioSelect = document.getElementById('epistasis-scenario-select');
    if (epistasisGenerateBtn) epistasisGenerateBtn.addEventListener('click', PS.renderEpistasisResult || renderEpistasisResult);
    if (epistasisScenarioSelect) epistasisScenarioSelect.addEventListener('change', PS.renderEpistasisResult || renderEpistasisResult);

    const aboGenerateBtn = document.getElementById('abo-generate-btn');
    if (aboGenerateBtn) aboGenerateBtn.addEventListener('click', PS.renderAboResult || renderAboResult);

    const exerciseGenGenerateBtn = document.getElementById('exercise-gen-generate-btn');
    const exerciseGenActions     = document.getElementById('exercise-gen-actions');
    if (exerciseGenGenerateBtn) {
      exerciseGenGenerateBtn.addEventListener('click', () => {
        const count     = Number(document.getElementById('exercise-gen-count').value) || 10;
        const numCodons = Number(document.getElementById('exercise-gen-length').value) || 7;
        const generate = PS.generateExerciseSet || generateExerciseSet;
        const preview  = PS.renderExercisePreview || renderExercisePreview;
        const printables = PS.renderExercisePrintables || renderExercisePrintables;
        const set = generate(count, numCodons);
        if (typeof PS.exerciseSet !== 'undefined') PS.exerciseSet = set;
        preview(set);
        printables(set);
        if (exerciseGenActions) exerciseGenActions.hidden = false;
      });
    }

    const exerciseGenPrintWorksheetBtn = document.getElementById('exercise-gen-print-worksheet');
    const exerciseGenPrintKeyBtn       = document.getElementById('exercise-gen-print-key');
    const exerciseGenDownloadBtn       = document.getElementById('exercise-gen-download-txt');
    if (exerciseGenPrintWorksheetBtn) {
      exerciseGenPrintWorksheetBtn.addEventListener('click', () => (PS.printExerciseContent || printExerciseContent)('exercise-worksheet-printable'));
    }
    if (exerciseGenPrintKeyBtn) {
      exerciseGenPrintKeyBtn.addEventListener('click', () => (PS.printExerciseContent || printExerciseContent)('exercise-answerkey-printable'));
    }
    if (exerciseGenDownloadBtn) {
      exerciseGenDownloadBtn.addEventListener('click', () => (PS.downloadExercisesAsText || downloadExercisesAsText)(typeof PS.exerciseSet !== 'undefined' ? PS.exerciseSet : exerciseSet));
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
    if (PS.mutationButton) {
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
    if (mendelModeMonoBtn) mendelModeMonoBtn.addEventListener('click', () => (PS.setMendelMode || setMendelMode)('mono'));
    if (mendelModeDiBtn)   mendelModeDiBtn.addEventListener('click', () => (PS.setMendelMode || setMendelMode)('di'));
    if (mendelGenerateBtn) mendelGenerateBtn.addEventListener('click', PS.generateMendelCross || generateMendelCross);
    if (mendelG1Pattern)   mendelG1Pattern.addEventListener('change', () => updateMendelHetFieldVisibility(0));
    if (mendelG2Pattern)   mendelG2Pattern.addEventListener('change', () => updateMendelHetFieldVisibility(1));

    // Controles da ferramenta de Heredogramas
    const pedigreeModeStudyBtn = document.getElementById('pedigree-mode-study');
    const pedigreeModeQuizBtn  = document.getElementById('pedigree-mode-quiz');
    const pedigreeGenerateBtn  = document.getElementById('pedigree-generate-btn');
    const pedigreeQuizGenerateBtn = document.getElementById('pedigree-quiz-generate-btn');
    const pedigreeQuizAnswersWrap = document.getElementById('pedigree-quiz-answers');
    if (pedigreeModeStudyBtn)     pedigreeModeStudyBtn.addEventListener('click', () => (PS.setPedigreeMode || setPedigreeMode)('study'));
    if (pedigreeModeQuizBtn)      pedigreeModeQuizBtn.addEventListener('click', () => (PS.setPedigreeMode || setPedigreeMode)('quiz'));
    if (pedigreeGenerateBtn)      pedigreeGenerateBtn.addEventListener('click', PS.generateStudyPedigree || generateStudyPedigree);
    if (pedigreeQuizGenerateBtn)  pedigreeQuizGenerateBtn.addEventListener('click', PS.generateQuizPedigree || generateQuizPedigree);
    if (pedigreeQuizAnswersWrap) {
      pedigreeQuizAnswersWrap.querySelectorAll('.crispr-pathway-card').forEach((btn) => {
        btn.addEventListener('click', () => (PS.answerPedigreeQuiz || answerPedigreeQuiz)(btn.dataset.answer));
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
    if (karyoViewBtn)      karyoViewBtn.addEventListener('click', PS.viewSelectedKaryotype || viewSelectedKaryotype);
    if (nondisModeMiBtn)   nondisModeMiBtn.addEventListener('click', () => (PS.setNondisMode || setNondisMode)('MI'));
    if (nondisModeMiiBtn)  nondisModeMiiBtn.addEventListener('click', () => (PS.setNondisMode || setNondisMode)('MII'));
    if (nondisSimulateBtn) nondisSimulateBtn.addEventListener('click', PS.runNondisjunctionSimulation || runNondisjunctionSimulation);

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
    if (crisprLoadDemoBtn)    crisprLoadDemoBtn.addEventListener('click', PS.loadCrisprDemoSequence || loadCrisprDemoSequence);
    if (crisprSearchBtn)      crisprSearchBtn.addEventListener('click', PS.searchCrisprTarget || searchCrisprTarget);
    if (crisprPathwayNhejBtn) crisprPathwayNhejBtn.addEventListener('click', () => (PS.selectCrisprPathway || selectCrisprPathway)('nhej'));
    if (crisprPathwayHdrBtn)  crisprPathwayHdrBtn.addEventListener('click', () => (PS.selectCrisprPathway || selectCrisprPathway)('hdr'));
    if (crisprHdrGenerateBtn) crisprHdrGenerateBtn.addEventListener('click', PS.generateCrisprHdrPreview || generateCrisprHdrPreview);
    if (crisprApplyBtn)       crisprApplyBtn.addEventListener('click', PS.applyCrisprEditToSimulator || applyCrisprEditToSimulator);

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
        const dnaSeq = readSequence(PS.dnaSequenceChars);
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

    // Botão de fechar o PS.drawer
    const closeBtn = document.querySelector('.drawer-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    // Fecha o PS.drawer ao sair com o mouse (a menos que esteja fixado por clique)
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
    // e dispara translate()/PS.treatSequence() uma única vez ao final.
    for (const base of dnaBases) PS.insertBase(base, { skipRender: true });
    translate();
    PS.treatSequence();
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

  // ---- Registro no PS ----
  var fnList = ["complementBase","complementStrand","transcribe","translateDnaHeadless","computeGCContent","findFirstStartIndex","walkCodingRegion","anticodonFor","generateRandomCodingDna","sanitizeDnaInput","transcribeSeq","translateProteinChainPure","classifyMutationPure","clearSequenceChars","focusWithoutKeyboard","scrollUnique","activateDnaInput","updateCounters","newSequenceChar","charInput","actsLikeUniqueInput","insertBase","clearSequence","randomSequence","loadSequenceFromString","loadSequenceFromUrl","applyCodonClasses","renderComplementaryStrand","syncFrameClasses","treatSequence","updateCodonLabels","translateStrand","translate","alignSequences","rightAlignInsertions","mutationDifference","openRibosomeModal","cacheRibosomeElements","cacheRibosomeElementsIfNeeded","clearRibosomeTimers","scheduleRibosome","renderRibosomeTrack","positionRibosomeMarker","setPlayButtonState","stepRibosome","playRibosome","pauseRibosome","resetRibosomeAnimation","buildRibosomeSteps","openReplicationModal","resetReplicationAnimation","pauseReplication","stepReplication","animateBasePairing","classifyMutation","fillStrand","clearAllStrandsKeepingMode","applyComplementaryStrandVisibility","buildCodonTable","buildCodonWheel","renderCodonWheelState","handleWheelSegmentActivate","sendCodonWheelSelection","resetCodonWheel","initCodonWheelInteractions","wheelPolarToCartesian","wheelSectorPath","wheelLabelTransform","openAminoacidDrawer","closeDrawer","bindAminoacidOutputEvents","newAminoacid","aminoacidCategoryClass","codonCellClass","codonDisplayName","saveSequenceAutosave","clearSequenceAutosave","restoreSequenceAutosave","getRnaEquivalent","cleanPastedSequence","insertCodonAndTranslate","buildOkazakiFragments","cacheReplicationElements","clearReplicationTimers","scheduleReplication","renderReplicationStaticRow","renderReplicationPendingRow","setReplicationPlayButtonState","positionReplicationFork","finishReplicationLigase","playReplication"];
  for (var i = 0; i < fnList.length; i++) {
    (function(n) { try { PS[n] = eval(n); } catch(e) {} })(fnList[i]);
  }
})();
