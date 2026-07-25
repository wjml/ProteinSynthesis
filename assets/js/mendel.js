/* mendel.js — Mendel Lab (Construtor de Cruzamentos / Epistasia / ABO) + Heredogramas
 * Extraído de script.js, registrado em window.PS. Usa var para compatibilidade.
 */

;(function () {
  'use strict';

  // ─── Constantes (var para evitar conflito com script.js) ────────────────────

  var ABO_ALLELE_ORDER = { IA: 0, IB: 1, i: 2 };
  var ABO_ALLELE_DISPLAY = { IA: 'I<sup>A</sup>', IB: 'I<sup>B</sup>', i: 'i' };
  var ABO_GENOTYPE_OPTIONS = {
    AA: ['IA', 'IA'],
    Ai: ['IA', 'i'],
    BB: ['IB', 'IB'],
    Bi: ['IB', 'i'],
    AB: ['IA', 'IB'],
    ii: ['i', 'i'],
  };

  var MENDEL_PALETTE = ['#1e88e5', '#f57c00', '#43a047', '#e53935', '#8e24aa', '#00897b', '#c0ca33', '#6d4c41', '#5c6bc0'];

  // ─── Funções puras de genética mendeliana ────────────────────────────────────

  function mendelAllelesForGenotype(genotypeClass, dominantLetter) {
    var dom = dominantLetter.toUpperCase();
    var rec = dominantLetter.toLowerCase();
    if (genotypeClass === 'homDom') return [dom, dom];
    if (genotypeClass === 'homRec') return [rec, rec];
    return [dom, rec];
  }

  function mendelGameteList(genes, parentGenotypes) {
    var perGeneAlleles = genes.map(function (g, i) { return mendelAllelesForGenotype(parentGenotypes[i], g.letter); });
    var combos = [[]];
    for (var gi = 0; gi < perGeneAlleles.length; gi++) {
      var alleles = perGeneAlleles[gi];
      var next = [];
      for (var ci = 0; ci < combos.length; ci++) {
        for (var ai = 0; ai < alleles.length; ai++) {
          next.push(combos[ci].concat([alleles[ai]]));
        }
      }
      combos = next;
    }
    return combos;
  }

  function mendelClassifyPair(a1, a2, dominantLetter) {
    var dom = dominantLetter.toUpperCase();
    var isDom1 = a1 === dom, isDom2 = a2 === dom;
    if (isDom1 && isDom2) return 'homDom';
    if (!isDom1 && !isDom2) return 'homRec';
    return 'het';
  }

  function mendelDisplayPair(a1, a2, dominantLetter) {
    var dom = dominantLetter.toUpperCase();
    var pair = [a1, a2];
    pair.sort(function (x, y) { return (x === dom) === (y === dom) ? 0 : (x === dom ? -1 : 1); });
    return pair.join('');
  }

  function mendelPhenotypeLabel(gene, genotypeClass) {
    if (genotypeClass === 'homDom') return gene.domName;
    if (genotypeClass === 'homRec') return gene.recName;
    return gene.pattern === 'complete' ? gene.domName : gene.hetName;
  }

  function buildPunnettSquare(genes, parent1Genotypes, parent2Genotypes) {
    var gametes1 = mendelGameteList(genes, parent1Genotypes);
    var gametes2 = mendelGameteList(genes, parent2Genotypes);
    var cells = [];
    for (var gi = 0; gi < gametes1.length; gi++) {
      var row = [];
      for (var gj = 0; gj < gametes2.length; gj++) {
        var perGene = genes.map(function (gene, i) {
          var cls = mendelClassifyPair(gametes1[gi][i], gametes2[gj][i], gene.letter);
          return {
            class: cls,
            display: mendelDisplayPair(gametes1[gi][i], gametes2[gj][i], gene.letter),
            phenotype: mendelPhenotypeLabel(gene, cls),
          };
        });
        row.push({
          genotypeDisplay:  perGene.map(function (p) { return p.display; }).join(''),
          phenotypeDisplay: perGene.map(function (p) { return p.phenotype; }).join(', '),
        });
      }
      cells.push(row);
    }
    var genotypeTally = new Map();
    var phenotypeTally = new Map();
    var total = 0;
    for (var ri = 0; ri < cells.length; ri++) {
      for (var ci = 0; ci < cells[ri].length; ci++) {
        total++;
        genotypeTally.set(cells[ri][ci].genotypeDisplay, (genotypeTally.get(cells[ri][ci].genotypeDisplay) || 0) + 1);
        phenotypeTally.set(cells[ri][ci].phenotypeDisplay, (phenotypeTally.get(cells[ri][ci].phenotypeDisplay) || 0) + 1);
      }
    }
    return {
      gametes1: gametes1.map(function (g) { return g.join(''); }),
      gametes2: gametes2.map(function (g) { return g.join(''); }),
      cells: cells, total: total, genotypeTally: genotypeTally, phenotypeTally: phenotypeTally,
    };
  }

  function mendelGcdAll(nums) {
    var gcd2 = function (a, b) { return (b === 0 ? a : gcd2(b, a % b)); };
    return nums.reduce(function (a, b) { return gcd2(a, b); });
  }

  function mendelFormatTally(tally, total) {
    var entries = Array.from(tally.entries());
    var divisor = mendelGcdAll(entries.map(function (e) { return e[1]; }));
    return entries.map(function (e) {
      var label = e[0], count = e[1];
      return {
        label: label, count: count,
        ratio: count / divisor,
        percent: Math.round((count / total) * 1000) / 10,
      };
    });
  }

  // ─── Epistasia ───────────────────────────────────────────────────────────────

  var EPISTASIS_GENE_A = { letter: 'A', pattern: 'complete' };
  var EPISTASIS_GENE_B = { letter: 'B', pattern: 'complete' };

  var EPISTASIS_SCENARIOS = {
    recessive: {
      title: 'Epistasia Recessiva (proporção esperada 9 : 3 : 4)',
      example: 'Pelagem de cães (ex: Labradores): o gene E precisa ter ao menos 1 alelo dominante para depositar ' +
        'QUALQUER pigmento na pelagem. Um cão "ee" fica amarelo, não importa o genótipo do gene B (que decide entre ' +
        'preto e chocolate) — por isso eeB_ e eebb caem na MESMA categoria final.',
      classify: function (clsA, clsB) {
        if (clsA === 'homRec') return 'Amarelo (eeB_ ou eebb — gene E mascara o gene B)';
        return clsB === 'homRec' ? 'Chocolate/Marrom (E_bb)' : 'Preto (E_B_)';
      },
    },
    dominant: {
      title: 'Epistasia Dominante (proporção esperada 12 : 3 : 1)',
      example: 'Cor da casca da abóbora: um único alelo dominante W (branco) já basta para mascarar completamente ' +
        'o gene de cor Y — por isso W_Y_ e W_yy caem na MESMA categoria final (branco), sobrando só wwY_ e wwyy ' +
        'para diferenciar amarelo de verde.',
      classify: function (clsA, clsB) {
        if (clsA !== 'homRec') return 'Branco (W_Y_ ou W_yy — gene W mascara o gene Y)';
        return clsB === 'homRec' ? 'Verde (wwyy)' : 'Amarelo (wwY_)';
      },
    },
    duplicate_recessive: {
      title: 'Epistasia Recessiva Duplicada / Complementação Gênica (proporção esperada 9 : 7)',
      example: 'Cor da flor da ervilha-de-cheiro: os dois genes (C e P) codificam enzimas de uma MESMA via ' +
        'metabólica de pigmentação — a cor púrpura só aparece se houver ao menos 1 alelo dominante em CADA um dos ' +
        'dois genes; faltando o dominante em qualquer um deles, a via para e a flor fica branca.',
      classify: function (clsA, clsB) {
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
      classify: function (clsA, clsB) {
        return (clsA !== 'homRec' || clsB !== 'homRec')
          ? 'Triangular (A_B_, A_bb ou aaB_ — dominante em ao menos 1 gene)'
          : 'Ovoide (aabb — recessivo nos 2 genes)';
      },
    },
  };

  function computeEpistasisCross(scenarioKey) {
    var scenario = EPISTASIS_SCENARIOS[scenarioKey];
    if (!scenario) return null;
    var gametes1 = mendelGameteList([EPISTASIS_GENE_A, EPISTASIS_GENE_B], ['het', 'het']);
    var gametes2 = mendelGameteList([EPISTASIS_GENE_A, EPISTASIS_GENE_B], ['het', 'het']);
    var tally = new Map();
    var total = 0;
    for (var gi = 0; gi < gametes1.length; gi++) {
      for (var gj = 0; gj < gametes2.length; gj++) {
        var clsA = mendelClassifyPair(gametes1[gi][0], gametes2[gj][0], 'A');
        var clsB = mendelClassifyPair(gametes1[gi][1], gametes2[gj][1], 'B');
        var label = scenario.classify(clsA, clsB);
        tally.set(label, (tally.get(label) || 0) + 1);
        total++;
      }
    }
    return { scenario: scenario, formatted: mendelFormatTally(tally, total), total: total };
  }

  // ─── Sistema ABO ─────────────────────────────────────────────────────────────

  function aboPhenotypeFromAlleles(pair) {
    var hasA = pair.indexOf('IA') !== -1;
    var hasB = pair.indexOf('IB') !== -1;
    if (hasA && hasB) return 'AB';
    if (hasA) return 'A';
    if (hasB) return 'B';
    return 'O';
  }

  function aboDisplayGenotype(pair) {
    var sorted = pair.slice().sort(function (a, b) { return ABO_ALLELE_ORDER[a] - ABO_ALLELE_ORDER[b]; });
    return sorted.map(function (a) { return ABO_ALLELE_DISPLAY[a]; }).join('');
  }

  function computeAboCross(genotype1Key, genotype2Key) {
    var alleles1 = ABO_GENOTYPE_OPTIONS[genotype1Key];
    var alleles2 = ABO_GENOTYPE_OPTIONS[genotype2Key];
    if (!alleles1 || !alleles2) return null;
    var genotypeTally = new Map();
    var phenotypeTally = new Map();
    var total = 0;
    for (var ai = 0; ai < alleles1.length; ai++) {
      for (var aj = 0; aj < alleles2.length; aj++) {
        var pair = [alleles1[ai], alleles2[aj]];
        var genotypeLabel = aboDisplayGenotype(pair);
        var phenotypeLabel = 'Tipo ' + aboPhenotypeFromAlleles(pair);
        genotypeTally.set(genotypeLabel, (genotypeTally.get(genotypeLabel) || 0) + 1);
        phenotypeTally.set(phenotypeLabel, (phenotypeTally.get(phenotypeLabel) || 0) + 1);
        total++;
      }
    }
    return {
      genotypeFormatted:  mendelFormatTally(genotypeTally, total),
      phenotypeFormatted: mendelFormatTally(phenotypeTally, total),
      total: total,
    };
  }

  // ─── Camada de DOM: formulário, quadro de Punnett e resultados ───────────────

  var mendel = {
    els: {},
    mode: 'mono',
    colorByPhenotype: new Map(),
  };

  function cacheMendelElements() {
    mendel.els = {
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

  function openMendelModal() {
    setMendelLabTab('cross');
  }

  function openEpistasisModal() {
    setMendelLabTab('epistasis');
    renderEpistasisResult();
  }

  function renderEpistasisResult() {
    var select = document.getElementById('epistasis-scenario-select');
    var resultsEl = document.getElementById('epistasis-results');
    var titleEl = document.getElementById('epistasis-results-title');
    var exampleEl = document.getElementById('epistasis-example-text');
    var tallyEl = document.getElementById('epistasis-tally');
    if (!select || !resultsEl) return;
    var result = computeEpistasisCross(select.value);
    if (!result) return;
    if (titleEl) titleEl.textContent = result.scenario.title;
    if (exampleEl) exampleEl.textContent = result.scenario.example;
    if (tallyEl) {
      tallyEl.innerHTML = '';
      result.formatted.forEach(function (f) {
        var li = document.createElement('li');
        li.innerHTML = '<strong>' + f.ratio + '</strong> — ' + f.label + ' <span class="lab-tally-detail">(' + f.count + '/' + result.total + ' · ' + f.percent + '%)</span>';
        tallyEl.appendChild(li);
      });
    }
    resultsEl.style.display = 'block';
  }

  function openAboModal() {
    setMendelLabTab('abo');
    renderAboResult();
  }

  var mendelLab = { els: {}, tab: 'cross' };

  function cacheMendelLabElements() {
    mendelLab.els = {
      tabCrossBtn:    document.getElementById('mendel-lab-tab-cross'),
      tabEpistasisBtn: document.getElementById('mendel-lab-tab-epistasis'),
      tabAboBtn:      document.getElementById('mendel-lab-tab-abo'),
      panelCross:     document.getElementById('mendel-lab-panel-cross'),
      panelEpistasis: document.getElementById('mendel-lab-panel-epistasis'),
      panelAbo:       document.getElementById('mendel-lab-panel-abo'),
    };
  }

  function setMendelLabTab(tab) {
    if (!mendelLab.els.tabCrossBtn) cacheMendelLabElements();
    mendelLab.tab = tab;
    var els = mendelLab.els;
    var buttons = [els.tabCrossBtn, els.tabEpistasisBtn, els.tabAboBtn];
    var panels  = [els.panelCross, els.panelEpistasis, els.panelAbo];
    var idx = tab === 'epistasis' ? 1 : tab === 'abo' ? 2 : 0;
    buttons.forEach(function (btn, i) {
      if (!btn) return;
      var isActive = i === idx;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    panels.forEach(function (panel, i) {
      if (!panel) return;
      panel.style.display = i === idx ? '' : 'none';
    });
  }

  function renderAboResult() {
    var p1Select = document.getElementById('abo-parent1-select');
    var p2Select = document.getElementById('abo-parent2-select');
    var resultsEl = document.getElementById('abo-results');
    var genotypeTallyEl = document.getElementById('abo-genotype-tally');
    var phenotypeTallyEl = document.getElementById('abo-phenotype-tally');
    var explanationEl = document.getElementById('abo-explanation');
    if (!p1Select || !p2Select || !resultsEl) return;
    var result = computeAboCross(p1Select.value, p2Select.value);
    if (!result) return;
    if (genotypeTallyEl) {
      genotypeTallyEl.innerHTML = '';
      result.genotypeFormatted.forEach(function (f) {
        var li = document.createElement('li');
        li.innerHTML = '<strong>' + f.ratio + '</strong> — ' + f.label + ' <span class="lab-tally-detail">(' + f.percent + '%)</span>';
        genotypeTallyEl.appendChild(li);
      });
    }
    if (phenotypeTallyEl) {
      phenotypeTallyEl.innerHTML = '';
      result.phenotypeFormatted.forEach(function (f) {
        var li = document.createElement('li');
        li.innerHTML = '<strong>' + f.ratio + '</strong> — ' + f.label + ' <span class="lab-tally-detail">(' + f.percent + '%)</span>';
        phenotypeTallyEl.appendChild(li);
      });
    }
    if (explanationEl) {
      var phenotypeList = result.phenotypeFormatted.map(function (f) { return f.label.replace('Tipo ', ''); }).join(', ');
      explanationEl.textContent = result.phenotypeFormatted.length > 1
        ? 'Esse casal pode ter filhos dos seguintes tipos sanguíneos: ' + phenotypeList + '.'
        : 'Esse casal só pode ter filhos do tipo sanguíneo ' + phenotypeList + ' — os dois genitores não têm alelos suficientes para gerar outro tipo.';
    }
    resultsEl.style.display = 'block';
  }

  function readMendelGeneConfig(index) {
    var p = 'mendel-g' + (index + 1) + '-';
    var get = function (suffix) { return document.getElementById(p + suffix); };
    var letter  = (get('letter').value || 'A').trim().charAt(0) || 'A';
    var pattern = get('pattern').value;
    var domName = get('domname').value.trim() || (letter.toUpperCase() + letter.toUpperCase());
    var recName = get('recname').value.trim() || (letter.toLowerCase() + letter.toLowerCase());
    var hetRaw  = get('hetname').value.trim();
    var hetName = pattern === 'complete' ? domName : hetRaw;
    return {
      gene: { letter: letter, pattern: pattern, domName: domName, recName: recName, hetName: hetName },
      p1: get('p1').value,
      p2: get('p2').value,
    };
  }

  function updateMendelHetFieldVisibility(index) {
    var p = 'mendel-g' + (index + 1) + '-';
    var pattern = document.getElementById(p + 'pattern').value;
    var wrap = document.getElementById(p + 'het-wrap');
    if (wrap) wrap.style.display = pattern === 'complete' ? 'none' : 'flex';
  }

  function setMendelMode(mode) {
    if (!mendel.els.modeMonoBtn) cacheMendelElements();
    mendel.mode = mode;
    var isDi = mode === 'di';
    mendel.els.gene2Config.style.display = isDi ? 'block' : 'none';
    mendel.els.modeMonoBtn.classList.toggle('active', !isDi);
    mendel.els.modeDiBtn.classList.toggle('active', isDi);
    mendel.els.modeMonoBtn.setAttribute('aria-pressed', String(!isDi));
    mendel.els.modeDiBtn.setAttribute('aria-pressed', String(isDi));
    mendel.els.results.style.display = 'none';
  }

  function colorForPhenotype(label) {
    if (!mendel.colorByPhenotype.has(label)) {
      mendel.colorByPhenotype.set(label, MENDEL_PALETTE[mendel.colorByPhenotype.size % MENDEL_PALETTE.length]);
    }
    return mendel.colorByPhenotype.get(label);
  }

  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  function renderPunnettGrid(result) {
    var table = document.createElement('table');
    table.className = 'mendel-punnett-table';
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    headRow.appendChild(document.createElement('th'));
    result.gametes2.forEach(function (g) {
      var th = document.createElement('th');
      th.textContent = g;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    result.cells.forEach(function (row, i) {
      var tr = document.createElement('tr');
      var rowHeader = document.createElement('th');
      rowHeader.textContent = result.gametes1[i];
      tr.appendChild(rowHeader);
      row.forEach(function (cell) {
        var td = document.createElement('td');
        td.className = 'mendel-cell';
        var color = colorForPhenotype(cell.phenotypeDisplay);
        td.style.backgroundColor = hexToRgba(color, 0.12);
        td.style.borderColor     = hexToRgba(color, 0.45);
        td.title = cell.phenotypeDisplay;
        var span = document.createElement('span');
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

  function renderMendelTallyList(listEl, tally, total, withColor) {
    listEl.innerHTML = '';
    mendelFormatTally(tally, total).forEach(function (item) {
      var label = item.label, count = item.count, ratio = item.ratio, percent = item.percent;
      var li = document.createElement('li');
      if (withColor) {
        var swatch = document.createElement('span');
        swatch.className = 'lab-swatch';
        swatch.style.background = colorForPhenotype(label);
        li.appendChild(swatch);
      }
      var text = document.createElement('span');
      var strong = document.createElement('strong');
      strong.textContent = String(ratio);
      text.appendChild(strong);
      text.append(' parte(s) — ' + label + ' ');
      var detail = document.createElement('span');
      detail.className = 'lab-tally-detail';
      detail.textContent = '(' + count + '/' + total + ' · ' + percent + '%)';
      text.appendChild(detail);
      li.appendChild(text);
      listEl.appendChild(li);
    });
  }

  function generateMendelExplanation(result) {
    var genoClasses  = result.genotypeTally.size;
    var phenoClasses = result.phenotypeTally.size;
    var ratioStr = mendelFormatTally(result.phenotypeTally, result.total).map(function (f) { return f.ratio; }).join(' : ');
    return 'Este cruzamento gera ' + genoClasses + ' classe(s) genotípica(s) e ' + phenoClasses + ' classe(s) ' +
      'fenotípica(s) distintas, na proporção ' + ratioStr + ' (de ' + result.total + ' combinações possíveis no quadro).';
  }

  function generateMendelCross() {
    if (!mendel.els.modeMonoBtn) cacheMendelElements();
    var els = mendel.els;
    var configs = [readMendelGeneConfig(0)];
    if (mendel.mode === 'di') configs.push(readMendelGeneConfig(1));
    for (var ci = 0; ci < configs.length; ci++) {
      var cfg = configs[ci];
      if (cfg.gene.pattern !== 'complete' && !cfg.gene.hetName) {
        showAlert('Campo obrigatório', 'Preencha o nome do fenótipo do heterozigoto (codominância/dominância incompleta) antes de gerar o quadro.');
        return;
      }
    }
    mendel.colorByPhenotype = new Map();
    var genes   = configs.map(function (c) { return c.gene; });
    var parent1 = configs.map(function (c) { return c.p1; });
    var parent2 = configs.map(function (c) { return c.p2; });
    var result  = buildPunnettSquare(genes, parent1, parent2);
    els.punnettWrapper.innerHTML = '';
    els.punnettWrapper.appendChild(renderPunnettGrid(result));
    renderMendelTallyList(els.genotypeTallyList,  result.genotypeTally,  result.total, false);
    renderMendelTallyList(els.phenotypeTallyList, result.phenotypeTally, result.total, true);
    els.explanation.textContent = generateMendelExplanation(result);
    els.results.style.display = 'block';
  }

  // ─── Heredogramas ──────────────────────────────────────────────────────────

  var PEDIGREE_TOPOLOGY = [
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

  var PEDIGREE_LINES = [
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

  function pedigreeRandomAllele(pair) {
    return pair[Math.floor(Math.random() * 2)];
  }

  function pedigreeFoundersForPattern(pattern) {
    switch (pattern) {
      case 'AR': return { g1m: ['A', 'a'],  g1f: ['A', 'a'],  spouseM: ['A', 'A'],   spouseF: ['A', 'A'] };
      case 'AD': return { g1m: ['A', 'a'],  g1f: ['a', 'a'],  spouseM: ['a', 'a'],   spouseF: ['a', 'a'] };
      case 'XR': return { g1m: ['XA', 'Y'], g1f: ['XA', 'Xa'], spouseM: ['XA', 'Y'],  spouseF: ['XA', 'XA'] };
      case 'XD': return { g1m: ['XA', 'Y'], g1f: ['Xa', 'Xa'], spouseM: ['Xa', 'Y'],  spouseF: ['Xa', 'Xa'] };
      default:   return null;
    }
  }

  function pedigreeInheritAutosomal(parentA, parentB) {
    return [pedigreeRandomAllele(parentA), pedigreeRandomAllele(parentB)];
  }

  function pedigreeInheritXLinked(father, mother, sex) {
    var momAllele = pedigreeRandomAllele(mother);
    if (sex === 'M') return [momAllele, 'Y'];
    return [father[0], momAllele];
  }

  function pedigreeCountAllele(genotype, allele) {
    return genotype.filter(function (a) { return a === allele; }).length;
  }

  function pedigreeIsAffected(genotype, pattern) {
    switch (pattern) {
      case 'AR': return pedigreeCountAllele(genotype, 'a') === 2;
      case 'AD': return pedigreeCountAllele(genotype, 'A') >= 1;
      case 'XR': return genotype.indexOf('Y') !== -1 ? genotype[0] === 'Xa' : pedigreeCountAllele(genotype, 'Xa') === 2;
      case 'XD': return genotype.indexOf('Y') !== -1 ? genotype[0] === 'XA' : pedigreeCountAllele(genotype, 'XA') >= 1;
      default:   return false;
    }
  }

  function pedigreeInherit(parentAGenotype, parentBGenotype, childSex, pattern) {
    if (pattern === 'XR' || pattern === 'XD') {
      var father = parentAGenotype.indexOf('Y') !== -1 ? parentAGenotype : parentBGenotype;
      var mother = parentAGenotype.indexOf('Y') !== -1 ? parentBGenotype : parentAGenotype;
      return pedigreeInheritXLinked(father, mother, childSex);
    }
    return pedigreeInheritAutosomal(parentAGenotype, parentBGenotype);
  }

  function generatePedigree(pattern) {
    var founders = pedigreeFoundersForPattern(pattern);
    var genotypes = {
      g1m: founders.g1m, g1f: founders.g1f,
      g2a_sp: founders.spouseM, g2b_sp: founders.spouseF,
    };
    for (var pi = 0; pi < PEDIGREE_TOPOLOGY.length; pi++) {
      var person = PEDIGREE_TOPOLOGY[pi];
      if (person.parents) {
        var pA = person.parents[0], pB = person.parents[1];
        genotypes[person.id] = pedigreeInherit(genotypes[pA], genotypes[pB], person.sex, pattern);
      }
    }
    return PEDIGREE_TOPOLOGY.map(function (p) {
      return { id: p.id, sex: p.sex, gen: p.gen, parents: p.parents, x: p.x, y: p.y, label: p.label,
        genotype: genotypes[p.id], affected: pedigreeIsAffected(genotypes[p.id], pattern) };
    });
  }

  function generateInterestingPedigree(pattern, maxTries) {
    var last = null;
    for (var i = 0; i < maxTries; i++) {
      var individuals = generatePedigree(pattern);
      var affectedCount = individuals.filter(function (p) { return p.affected; }).length;
      last = individuals;
      if (affectedCount >= 1 && affectedCount <= individuals.length - 1) return individuals;
    }
    return last;
  }

  function renderPedigreeSvg(individuals) {
    var R = 16;
    var svg = '<svg viewBox="0 0 600 380" xmlns="http://www.w3.org/2000/svg" role="img" ' +
      'aria-label="Heredograma de 3 gera\u00e7\u00f5es">';
    PEDIGREE_LINES.forEach(function (line) {
      if (line.type === 'h') {
        svg += '<line class="pedigree-line" x1="' + line.x1 + '" y1="' + line.y + '" x2="' + line.x2 + '" y2="' + line.y + '" />';
      } else {
        svg += '<line class="pedigree-line" x1="' + line.x + '" y1="' + line.y1 + '" x2="' + line.x + '" y2="' + line.y2 + '" />';
      }
    });
    individuals.forEach(function (person) {
      var cls = person.affected ? 'pedigree-symbol-affected' : 'pedigree-symbol-unaffected';
      if (person.sex === 'F') {
        svg += '<circle class="' + cls + '" cx="' + person.x + '" cy="' + person.y + '" r="' + R + '" />';
      } else {
        svg += '<rect class="' + cls + '" x="' + (person.x - R) + '" y="' + (person.y - R) + '" width="' + (R * 2) + '" height="' + (R * 2) + '" />';
      }
      svg += '<text class="pedigree-label" x="' + person.x + '" y="' + (person.y + R + 16) + '">' + person.label + '</text>';
    });
    svg += '</svg>';
    return svg;
  }

  var PEDIGREE_PATTERN_NAMES = {
    AD: 'Autoss\u00f4mica Dominante', AR: 'Autoss\u00f4mica Recessiva',
    XR: 'Ligada ao X Recessiva', XD: 'Ligada ao X Dominante',
  };

  var PEDIGREE_PATTERN_EXPLANATIONS = {
    AD: 'A caracter\u00edstica aparece em praticamente toda gera\u00e7\u00e3o, j\u00e1 que basta um alelo dominante para se ' +
      'manifestar. Um indiv\u00edduo afetado geralmente tem pelo menos um dos pais tamb\u00e9m afetado.',
    AR: 'A caracter\u00edstica pode "pular" gera\u00e7\u00f5es: dois pais n\u00e3o afetados (portadores heterozigotos) podem ter ' +
      'filhos afetados, j\u00e1 que s\u00e3o necess\u00e1rios dois alelos recessivos para a manifesta\u00e7\u00e3o.',
    XR: '\u00c9 bem mais comum em homens, j\u00e1 que eles s\u00f3 precisam de uma c\u00f3pia do alelo recessivo (s\u00e3o hemizigotos). ' +
      'Mulheres portadoras (heterozigotas) n\u00e3o s\u00e3o afetadas, mas podem transmitir a caracter\u00edstica aos filhos.',
    XD: 'Um pai afetado transmite a caracter\u00edstica para 100% das filhas (que sempre recebem seu \u00fanico X) e ' +
      'nenhum filho (que recebe o Y dele). Uma m\u00e3e afetada heterozigota transmite para ~50% dos filhos de ambos os sexos.',
  };

  var pedigree = { els: {}, mode: 'study', currentPattern: null, answered: false };

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

  function setPedigreeMode(mode) {
    if (!pedigree.els.modeStudyBtn) cachePedigreeElements();
    pedigree.mode = mode;
    var isQuiz = mode === 'quiz';
    var els = pedigree.els;
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

  function generateStudyPedigree() {
    if (!pedigree.els.modeStudyBtn) cachePedigreeElements();
    var els = pedigree.els;
    var pattern = els.patternSelect.value;
    var individuals = generateInterestingPedigree(pattern, 30);
    pedigree.currentPattern = pattern;
    els.svgWrapper.innerHTML = renderPedigreeSvg(individuals);
    els.infoText.innerHTML = '<strong>' + PEDIGREE_PATTERN_NAMES[pattern] + ':</strong> ' + PEDIGREE_PATTERN_EXPLANATIONS[pattern];
    els.quizAnswersWrap.style.display = 'none';
    els.feedback.style.display = 'none';
  }

  function generateQuizPedigree() {
    if (!pedigree.els.modeStudyBtn) cachePedigreeElements();
    var els = pedigree.els;
    var patterns = ['AD', 'AR', 'XR', 'XD'];
    var pattern = patterns[Math.floor(Math.random() * patterns.length)];
    var individuals = generateInterestingPedigree(pattern, 30);
    pedigree.currentPattern = pattern;
    pedigree.answered = false;
    els.svgWrapper.innerHTML = renderPedigreeSvg(individuals);
    els.infoText.textContent = 'Observe o heredograma e escolha o padr\u00e3o de heran\u00e7a abaixo.';
    els.quizAnswersWrap.style.display = 'block';
    els.feedback.style.display = 'none';
    els.quizAnswersWrap.querySelectorAll('.crispr-pathway-card').forEach(function (btn) {
      btn.classList.remove('pedigree-answer-correct', 'pedigree-answer-wrong');
      btn.disabled = false;
    });
  }

  function answerPedigreeQuiz(chosenPattern) {
    if (pedigree.answered || !pedigree.currentPattern) return;
    pedigree.answered = true;
    var els = pedigree.els;
    var correct = chosenPattern === pedigree.currentPattern;
    els.quizAnswersWrap.querySelectorAll('.crispr-pathway-card').forEach(function (btn) {
      btn.disabled = true;
      if (btn.dataset.answer === pedigree.currentPattern) btn.classList.add('pedigree-answer-correct');
      else if (btn.dataset.answer === chosenPattern)      btn.classList.add('pedigree-answer-wrong');
    });
    els.feedback.className = 'pedigree-feedback ' + (correct ? 'correct' : 'incorrect');
    els.feedback.innerHTML = (correct
        ? '\u2705 Correto! '
        : '\u274C N\u00e3o foi dessa vez. O padr\u00e3o correto \u00e9 <strong>' + PEDIGREE_PATTERN_NAMES[pedigree.currentPattern] + '</strong>. ') +
      PEDIGREE_PATTERN_EXPLANATIONS[pedigree.currentPattern];
    els.feedback.style.display = 'block';
  }

  // ─── Registro no PS ─────────────────────────────────────────────────────────

  window.PS = window.PS || {};

  PS.computeEpistasisCross = computeEpistasisCross;
  PS.computeAboCross = computeAboCross;
  PS.cacheMendelElements = cacheMendelElements;
  PS.setMendelMode = setMendelMode;
  PS.generateMendelCross = generateMendelCross;
  PS.renderPunnettGrid = renderPunnettGrid;
  PS.renderMendelTallyList = renderMendelTallyList;
  PS.generateMendelExplanation = generateMendelExplanation;
  PS.readMendelGeneConfig = readMendelGeneConfig;
  PS.updateMendelHetFieldVisibility = updateMendelHetFieldVisibility;
  PS.cacheMendelLabElements = cacheMendelLabElements;
  PS.setMendelLabTab = setMendelLabTab;
  PS.setPedigreeMode = setPedigreeMode;
  PS.generateStudyPedigree = generateStudyPedigree;
  PS.generateQuizPedigree = generateQuizPedigree;
  PS.answerPedigreeQuiz = answerPedigreeQuiz;

})();
