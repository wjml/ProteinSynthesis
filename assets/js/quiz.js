/**
 * quiz.js — Modo Desafio (Quiz) de Genética
 * Código completo extraído de script.js
 */

(function () {
  'use strict';
  var PS = window.PS = window.PS || {};

var QUIZ_BEST_SCORE_KEY = 'proteinSynthesis.quizBestScore';
  var QUIZ_TYPE_LABELS = {
    silent:     { className: 'silent',     text: 'Silenciosa (Sinônima)' },
    missense:   { className: 'missense',   text: 'Sentido Trocado (Missense)' },
    nonsense:   { className: 'nonsense',   text: 'Sem Sentido (Nonsense)' },
    stoploss:   { className: 'stoploss',   text: 'Perda do Stop (Stop-Loss)' },
    frameshift: { className: 'frameshift', text: 'Deslocamento de Leitura (Frameshift)' },
  };

  /** Nomes amigáveis das 5 categorias do quiz, usados no painel de desempenho do Modo Prática. */
  var QUIZ_CATEGORY_LABELS = {
    molecular:  'Genética Molecular',
    mendelian:  'Genética Mendeliana',
    population: 'Genética Populacional',
    pedigree:   'Heredograma',
    karyotype:  'Cariótipo',
  };

  /** Estado do Modo Desafio. Vive durante a sessão; só persiste o recorde (localStorage). */
  var quiz = {
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
  var MUTATION_EXPLANATIONS = {
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

  var MOLECULAR_QUESTIONS = [
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
  var MENDELIAN_QUESTIONS = [
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
  var POPULATION_QUESTIONS = [
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
  var PEDIGREE_QUESTIONS = [
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
  var KARYOTYPE_QUESTIONS = [
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
  var MENDEL_QUIZ_TRAITS = [
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
  var HW_QUIZ_SCENARIOS = [
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

    if (quiz.els.exitBtn)  quiz.els.exitBtn.addEventListener('click', PS.exitQuiz);
    if (quiz.els.retryBtn) quiz.els.retryBtn.addEventListener('click', PS.startQuiz);
    if (quiz.els.backBtn)  quiz.els.backBtn.addEventListener('click', PS.exitQuiz);
    if (quiz.els.finishPracticeBtn) quiz.els.finishPracticeBtn.addEventListener('click', function () { PS.endQuiz(); });

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
        (PS.startQuiz)();
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
        : 'Escolha abaixo o modo, a dificuldade e os assuntos que vão cair no desafio.';
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

  // ─── Registro no PS ───────────────────────────────────────────────────
  PS.quiz = quiz;
  PS.initQuizUI = initQuizUI;
  PS.startQuiz = startQuiz;
  PS.exitQuiz = exitQuiz;
  PS.endQuiz = endQuiz;
  PS.nextQuestion = nextQuestion;
  PS.submitQuizAnswer = submitQuizAnswer;
  PS.renderPracticeStats = renderPracticeStats;
  PS.buildQuestionPool = buildQuestionPool;
  PS.showQuizSetup = showQuizSetup;
  PS.applyQuizModeToSetupUI = applyQuizModeToSetupUI;
  PS.setQuizSetupHint = setQuizSetupHint;
  PS.resetQuizCategoryStats = resetQuizCategoryStats;
  PS.loadQuizBestScore = loadQuizBestScore;
  PS.saveQuizBestScore = saveQuizBestScore;

})();
