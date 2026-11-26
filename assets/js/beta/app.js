/**
 * assets/js/beta/app.js
 * Controlador principal do Modo Beta 2.0 (3 Modos Cognitivos + 3 Camadas de Visualização).
 */

import { analyzeDna, fetchDiseases, generateRandomCodingDna } from './bio.js';
import { addRecord, listRecords, getPref, setPref } from './store.js';

const LAYER_GUIDES = {
  basic: 'Camada Básica: exibe o fluxo essencial DNA → RNAm → Proteína, ideal para introdução ao código genético.',
  intermediate: 'Camada Intermediária: adiciona fita complementar antiparalela (5\'→3\'), classes bioquímicas dos aminoácidos e comparação com Wild-Type.',
  advanced: 'Camada Avançada: ativa os 6 quadros de leitura (ORFs), alinhamento nt-a-nt, massa molecular (kDa), pI estimado, carga em pH 7.4 e gráfico de hidropatia Kyte-Doolittle.'
};

const state = {
  diseases: [],
  activeRef: null,
  wildDna: '',
  selectedOrfFrame: '+1',
  currentAnalysis: null,
  wildAnalysis: null
};

const $ = (id) => document.getElementById(id);

function setLayer(layer) {
  document.body.setAttribute('data-layer', layer);
  setPref('proteinSynthesis.betaLayer', layer);
  document.querySelectorAll('.layer-btn').forEach((btn) => {
    const active = btn.dataset.layerTarget === layer;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  const guide = $('wb-layer-guide');
  if (guide) guide.textContent = LAYER_GUIDES[layer] || LAYER_GUIDES.intermediate;
}

function setMode(mode) {
  setPref('proteinSynthesis.betaMode', mode);
  document.querySelectorAll('.beta-mode-btn').forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  ['atlas', 'workbench', 'evaluation'].forEach((m) => {
    const el = $(`view-${m}`);
    if (el) el.hidden = m !== mode;
  });
}

function applyTheme(isDark) {
  document.body.classList.toggle('dark-theme', isDark);
  const btn = $('beta-theme-toggle');
  const icon = $('beta-theme-icon');
  const label = $('beta-theme-label');
  if (btn) btn.setAttribute('aria-pressed', String(isDark));
  if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  if (label) label.textContent = isDark ? 'Claro' : 'Escuro';
  setPref('proteinSynthesis.theme', isDark ? 'dark' : 'light');
}

function makeBaseShape(base, posClass, isMut = false) {
  const wrap = document.createElement('span');
  wrap.className = `nt-wrap${isMut ? ' is-mut' : ''}`;
  const el = document.createElement('span');
  el.className = `nt-shape ${posClass} nt-${base} bg-${base}`;
  el.textContent = base;
  wrap.appendChild(el);
  return wrap;
}

function getOrfRange(analysis, frame) {
  if (!analysis || !analysis.orfs) return null;
  const orf = analysis.orfs.find(o => o.frame === frame);
  if (!orf || !orf.hasOrf || !frame.startsWith('+')) return null;
  const startIdx = orf.startNt - 1;
  const endIdx = startIdx + orf.lengthAa * 3 + (orf.hasStop ? 3 : 0);
  return { startIdx, endIdx };
}

function renderDuplexDna(container, dna, compDna, compareSeq = '', orfRange = null) {
  container.textContent = '';
  for (let i = 0; i < dna.length; i++) {
    const col = document.createElement('div');
    const isCodonEnd = (i + 1) % 3 === 0 && i < dna.length - 1;
    const outOfOrf = orfRange && (i < orfRange.startIdx || i >= orfRange.endIdx);
    col.className = `bp-col has-phosphate-top has-phosphate-bottom${isCodonEnd ? ' codon-end' : ''}${outOfOrf ? ' out-of-orf' : ''}`;

    const bTop = dna[i];
    const bBot = compDna[i] || '';
    const isDiff = Boolean(compareSeq && compareSeq[i] && compareSeq[i] !== bTop);

    col.appendChild(makeBaseShape(bTop, 'nt-top', isDiff));

    const hb = document.createElement('div');
    hb.className = 'hbond-dots';
    hb.setAttribute('data-visible-layers', 'intermediate advanced');
    const bondCount = (bTop === 'G' || bTop === 'C') ? 3 : 2;
    for (let d = 0; d < bondCount; d++) {
      hb.appendChild(document.createElement('span'));
    }
    col.appendChild(hb);

    const botShape = makeBaseShape(bBot, 'nt-bottom', isDiff);
    botShape.setAttribute('data-visible-layers', 'intermediate advanced');
    col.appendChild(botShape);

    container.appendChild(col);
  }
}

function renderMrnaTrack(container, mrna, orfRange = null) {
  container.textContent = '';
  for (let i = 0; i < mrna.length; i++) {
    const col = document.createElement('div');
    const isCodonEnd = (i + 1) % 3 === 0 && i < mrna.length - 1;
    const outOfOrf = orfRange && (i < orfRange.startIdx || i >= orfRange.endIdx);
    col.className = `bp-col has-phosphate-bottom${isCodonEnd ? ' codon-end' : ''}${outOfOrf ? ' out-of-orf' : ''}`;
    col.appendChild(makeBaseShape(mrna[i], 'nt-bottom', false));
    container.appendChild(col);
  }
}

function renderHydropathyChart(profile, wildProfile = null) {
  const host = $('wb-hydropathy-chart');
  const wtLegend = $('wb-hydro-legend-wt');
  if (wtLegend) wtLegend.hidden = !(wildProfile && wildProfile.length);
  if (!host) return;
  host.textContent = '';
  if (!profile || profile.length === 0) {
    host.textContent = 'Insira ao menos 1 códon traduzível para visualizar o perfil.';
    return;
  }
  const colW = 84;
  const gap = 11;
  const maxLen = Math.max(profile.length, wildProfile ? wildProfile.length : 0);
  const totalW = maxLen * colW + Math.max(0, maxLen - 1) * gap;
  const H = 130;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${totalW} ${H}`);
  svg.style.width = `${totalW}px`;
  svg.style.height = `${H}px`;

  const zeroLine = document.createElementNS(svgNS, 'line');
  zeroLine.setAttribute('x1', 0);
  zeroLine.setAttribute('x2', totalW);
  zeroLine.setAttribute('y1', H / 2);
  zeroLine.setAttribute('y2', H / 2);
  zeroLine.setAttribute('stroke', 'currentColor');
  zeroLine.setAttribute('stroke-opacity', '0.25');
  zeroLine.setAttribute('stroke-dasharray', '4 4');
  svg.appendChild(zeroLine);

  const toPts = (arr) => arr.map((p, idx) => ({
    x: idx * (colW + gap) + colW / 2,
    y: H / 2 - (p.kd / 4.5) * (H / 2 - 20),
    ...p
  }));

  const pts = toPts(profile);

  // Guias verticais alinhadas ao centro de cada códon/aminoácido
  pts.forEach((p) => {
    const guide = document.createElementNS(svgNS, 'line');
    guide.setAttribute('x1', p.x.toFixed(1));
    guide.setAttribute('x2', p.x.toFixed(1));
    guide.setAttribute('y1', 6);
    guide.setAttribute('y2', H - 6);
    guide.setAttribute('stroke', 'currentColor');
    guide.setAttribute('stroke-opacity', '0.1');
    svg.appendChild(guide);
  });

  // Linha tracejada Wild-Type quando comparação está ativa
  if (wildProfile && wildProfile.length) {
    const wPts = toPts(wildProfile);
    const wPoly = document.createElementNS(svgNS, 'polyline');
    wPoly.setAttribute('fill', 'none');
    wPoly.setAttribute('stroke', 'var(--muted)');
    wPoly.setAttribute('stroke-width', '1.8');
    wPoly.setAttribute('stroke-dasharray', '5 4');
    wPoly.setAttribute('stroke-opacity', '0.75');
    wPoly.setAttribute('points', wPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
    svg.appendChild(wPoly);
  }

  const poly = document.createElementNS(svgNS, 'polyline');
  poly.setAttribute('fill', 'none');
  poly.setAttribute('stroke', 'var(--accent)');
  poly.setAttribute('stroke-width', '2.2');
  poly.setAttribute('points', pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  svg.appendChild(poly);

  pts.forEach((p) => {
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('cx', p.x.toFixed(1));
    c.setAttribute('cy', p.y.toFixed(1));
    c.setAttribute('r', '4');
    c.setAttribute('fill', p.kd >= 0 ? 'var(--danger)' : 'var(--accent)');
    const title = document.createElementNS(svgNS, 'title');
    title.textContent = `${p.pos} · ${p.abbr}: ${p.kd}`;
    c.appendChild(title);
    svg.appendChild(c);

    const lbl = document.createElementNS(svgNS, 'text');
    lbl.setAttribute('x', p.x.toFixed(1));
    lbl.setAttribute('y', (p.kd >= 0 ? p.y - 8 : p.y + 14).toFixed(1));
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('font-size', '10');
    lbl.setAttribute('font-family', 'IBM Plex Mono, monospace');
    lbl.setAttribute('fill', 'currentColor');
    lbl.setAttribute('fill-opacity', '0.72');
    lbl.textContent = (p.kd > 0 ? '+' : '') + p.kd.toFixed(1);
    svg.appendChild(lbl);
  });

  host.appendChild(svg);
}

function classifyMutation(wild, cur) {
  if (!wild || !cur || wild.dna === cur.dna) {
    return { label: 'Referência (Wild-Type)', isMut: false };
  }
  if (wild.dna.length !== cur.dna.length) {
    return { label: 'Frameshift / Indel', isMut: true };
  }
  const wAa = wild.protein.map(p => p.abbr).join('-');
  const cAa = cur.protein.map(p => p.abbr).join('-');
  if (wAa === cAa) return { label: 'Mutação Silenciosa', isMut: false };
  if (cur.protein.length < wild.protein.length) return { label: 'Mutação Nonsense (Stop Prematuro)', isMut: true };
  return { label: 'Mutação Missense', isMut: true };
}

async function refreshWorkbench() {
  const input = $('wb-dna-input');
  const compareWt = $('wb-compare-wt')?.checked && Boolean(state.wildDna);
  const raw = input.value;
  const cleaned = raw.toUpperCase().replace(/[^ATCGU]/g, '');

  if (!cleaned) {
    state.currentAnalysis = null;
    state.wildAnalysis = null;
    $('wb-seq-header').textContent = 'Nenhuma sequência inserida';
    $('wb-seq-stats').textContent = '0 nt · 0 aa · GC 0%';
    $('wb-duplex-grid').innerHTML = '<span class="empty-track-msg">Digite bases A, T, C, G acima ou escolha uma sequência de referência ao lado.</span>';
    $('wb-track-rna').innerHTML = '<span class="empty-track-msg">Aguardando sequência de DNA molde…</span>';
    $('wb-track-diff').innerHTML = '<span class="empty-track-msg">—</span>';
    $('wb-protein-grid').innerHTML = '<span class="empty-track-msg">Nenhum aminoácido traduzido.</span>';
    $('wb-hydropathy-chart').textContent = 'Insira ao menos 1 códon traduzível para visualizar o perfil.';
    $('wb-orf-list').textContent = '';
    const orfPrev = $('wb-orf-preview');
    if (orfPrev) orfPrev.hidden = true;
    const badge = $('wb-mutation-badge');
    badge.textContent = 'Aguardando sequência';
    badge.classList.remove('is-mut');
    ['ins-length', 'ins-gc', 'ins-mw', 'ins-pi', 'ins-charge', 'ins-gravy'].forEach((id) => {
      const el = $(id);
      if (el) el.textContent = '—';
    });
    return;
  }

  const [cur, wild] = await Promise.all([
    analyzeDna(raw),
    compareWt ? analyzeDna(state.wildDna) : Promise.resolve(null)
  ]);

  state.currentAnalysis = cur;
  state.wildAnalysis = wild;

  $('wb-seq-header').textContent = state.activeRef ? `${state.activeRef.gene} — ${state.activeRef.title}` : cur.header;
  $('wb-seq-stats').textContent = `${cur.lengthNt} nt · ${cur.biochemistry.lengthAa} aa · GC ${cur.gcPercent}%`;

  const cmpDna = compareWt ? state.wildDna : '';
  const isAdv = document.body.getAttribute('data-layer') === 'advanced';
  const orfRange = isAdv ? getOrfRange(cur, state.selectedOrfFrame) : null;
  renderDuplexDna($('wb-duplex-grid'), cur.dna, cur.complementDna, cmpDna, orfRange);
  renderMrnaTrack($('wb-track-rna'), cur.mrna, orfRange);

  const diffEl = $('wb-track-diff');
  diffEl.textContent = '';
  if (compareWt && wild) {
    const maxLen = Math.max(wild.dna.length, cur.dna.length);
    for (let i = 0; i < maxLen; i++) {
      const col = document.createElement('div');
      const isCodonEnd = (i + 1) % 3 === 0 && i < maxLen - 1;
      col.className = `bp-col${isCodonEnd ? ' codon-end' : ''}`;
      const span = document.createElement('span');
      const same = wild.dna[i] === cur.dna[i];
      span.className = `nt-chip ${same ? '' : 'nt-mut'}`;
      span.textContent = same ? '·' : (cur.dna[i] || '-');
      col.appendChild(span);
      diffEl.appendChild(col);
    }
  } else {
    diffEl.textContent = 'Comparação com Wild-Type desativada.';
  }

  const mut = classifyMutation(wild, cur);
  const badge = $('wb-mutation-badge');
  badge.textContent = mut.label;
  badge.classList.toggle('is-mut', mut.isMut);

  const pGrid = $('wb-protein-grid');
  pGrid.textContent = '';
  cur.protein.forEach((aa, idx) => {
    const wAa = wild && wild.protein[idx];
    const changed = compareWt && wAa && wAa.abbr !== aa.abbr;
    const card = document.createElement('div');
    card.className = `aa-card${changed ? ' aa-mut' : ''}`;
    const abbr = document.createElement('div');
    abbr.className = 'aa-card-abbr mono';
    abbr.textContent = changed ? `${aa.position} · ${wAa.abbr}→${aa.abbr}` : `${aa.position} · ${aa.abbr}`;
    const name = document.createElement('div');
    name.className = 'aa-card-name';
    name.textContent = aa.name;
    const type = document.createElement('span');
    type.className = 'aa-card-type';
    type.textContent = aa.type;
    card.append(abbr, name, type);
    pGrid.appendChild(card);
  });

  $('ins-length').textContent = `${cur.biochemistry.lengthAa} aa`;
  $('ins-gc').textContent = `${cur.gcPercent}%`;
  $('ins-mw').textContent = `${cur.biochemistry.mwKda} kDa`;
  $('ins-pi').textContent = String(cur.biochemistry.pI);
  $('ins-charge').textContent = `${cur.biochemistry.netCharge74 >= 0 ? '+' : ''}${cur.biochemistry.netCharge74}`;
  $('ins-gravy').textContent = String(cur.biochemistry.gravy);
  $('wb-gravy-badge').textContent = `GRAVY: ${cur.biochemistry.gravy}`;

  renderHydropathyChart(
    cur.biochemistry.hydropathyProfile,
    compareWt && wild ? wild.biochemistry.hydropathyProfile : null
  );

  const orfList = $('wb-orf-list');
  const orfPrev = $('wb-orf-preview');
  orfList.textContent = '';
  if (orfPrev) orfPrev.hidden = true;
  (cur.orfs || []).forEach((orf, idx) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `orf-item${orf.hasOrf && idx === 0 ? ' active' : ''}`;
    const left = document.createElement('span');
    left.textContent = `${orf.frame} · ${orf.strand}`;
    const right = document.createElement('span');
    right.className = 'mono';
    right.textContent = orf.hasOrf ? `${orf.lengthAa} aa (nt ${orf.startNt})` : 'Sem AUG';
    row.append(left, right);
    row.addEventListener('click', () => {
      state.selectedOrfFrame = orf.frame;
      orfList.querySelectorAll('.orf-item').forEach(el => el.classList.remove('active'));
      row.classList.add('active');
      const r = getOrfRange(cur, orf.frame);
      renderDuplexDna($('wb-duplex-grid'), cur.dna, cur.complementDna, cmpDna, r);
      renderMrnaTrack($('wb-track-rna'), cur.mrna, r);
      if (orfPrev) {
        orfPrev.hidden = false;
        orfPrev.textContent = orf.hasOrf
          ? `Quadro ${orf.frame}: início nt ${orf.startNt} | ${orf.lengthAa} aa | ${orf.hasStop ? 'Stop encontrado' : 'ORF aberto'} | Peptídeo: ${orf.preview}`
          : `Quadro ${orf.frame}: nenhum códon de iniciação (AUG) encontrado nesta leitura.`;
      }
    });
    orfList.appendChild(row);
  });
}

async function renderSnapshots() {
  const list = await listRecords('snapshots');
  const host = $('wb-snapshots-list');
  host.textContent = '';
  if (!list.length) {
    host.textContent = 'Nenhum snapshot salvo ainda.';
    return;
  }
  list.slice(0, 6).forEach((snap) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'snapshot-item';
    const label = document.createElement('span');
    label.textContent = snap.label || 'Snapshot';
    const seq = document.createElement('span');
    seq.className = 'mono';
    seq.textContent = `${snap.dna.slice(0, 9)}…`;
    btn.append(label, seq);
    btn.addEventListener('click', () => {
      $('wb-dna-input').value = snap.dna;
      refreshWorkbench();
    });
    host.appendChild(btn);
  });
}

async function renderNotebook() {
  const notes = await listRecords('notebook');
  const ul = $('notebook-list');
  ul.textContent = '';
  notes.slice(0, 6).forEach((n) => {
    const li = document.createElement('li');
    li.textContent = n.text;
    ul.appendChild(li);
  });
}

function generateDocenteList() {
  const count = Math.max(1, Math.min(10, Number($('docente-count').value) || 3));
  const preview = $('docente-preview');
  preview.textContent = '';
  const title = document.createElement('h3');
  title.textContent = `Lista de Exercícios — Síntese de Proteínas (${count} questões)`;
  preview.appendChild(title);

  const ol = document.createElement('ol');
  const keyOl = document.createElement('ol');
  for (let i = 0; i < count; i++) {
    const dna = generateRandomCodingDna(5);
    const li = document.createElement('li');
    li.textContent = `Transcreva e traduza a fita molde (3'→5'): ${dna}`;
    ol.appendChild(li);

    const kLi = document.createElement('li');
    kLi.className = 'mono';
    kLi.textContent = `DNA ${dna} (${dna.length / 3} códons)`;
    keyOl.appendChild(kLi);
  }
  const keyTitle = document.createElement('h4');
  keyTitle.textContent = 'Gabarito Docente';
  preview.append(ol, keyTitle, keyOl);
}

function exportMarkdownReport() {
  const cur = state.currentAnalysis;
  if (!cur) return;
  const md = [
    `# Relatório Molecular — ${cur.header}`,
    `- **DNA Molde (3'→5'):** \`${cur.dna}\``,
    `- **RNAm (5'→3'):** \`${cur.mrna}\``,
    `- **Comprimento:** ${cur.lengthNt} nt | ${cur.biochemistry.lengthAa} aa | **GC:** ${cur.gcPercent}%`,
    `- **Massa Molecular:** ${cur.biochemistry.mwKda} kDa | **pI:** ${cur.biochemistry.pI} | **GRAVY:** ${cur.biochemistry.gravy}`,
    `- **Proteína:** ${cur.protein.map(p => p.abbr).join('-')}`
  ].join('\n');
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'relatorio-proteinsynthesis.md';
  a.click();
}

async function init() {
  applyTheme(getPref('proteinSynthesis.theme', 'light') === 'dark');
  setLayer(getPref('proteinSynthesis.betaLayer', 'intermediate'));
  setMode(getPref('proteinSynthesis.betaMode', 'workbench'));

  document.querySelectorAll('.layer-btn').forEach((btn) => {
    btn.addEventListener('click', () => setLayer(btn.dataset.layerTarget));
  });
  document.querySelectorAll('.beta-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });
  $('beta-theme-toggle').addEventListener('click', () => {
    applyTheme(!document.body.classList.contains('dark-theme'));
  });
  $('beta-to-classic').addEventListener('click', () => setPref('proteinSynthesis.uiMode', 'classic'));

  state.diseases = await fetchDiseases();
  const refList = $('wb-ref-list');
  state.diseases.forEach((d) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ref-item';
    btn.textContent = `${d.gene} · ${d.title}`;
    btn.addEventListener('click', () => {
      refList.querySelectorAll('.ref-item').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      state.activeRef = d;
      state.wildDna = d.wildDna;
      $('wb-dna-input').value = d.mutDna;
      if ($('wb-compare-wt')) $('wb-compare-wt').checked = true;
      refreshWorkbench();
    });
    refList.appendChild(btn);
  });

  $('wb-dna-input').addEventListener('input', refreshWorkbench);
  $('wb-compare-wt').addEventListener('change', refreshWorkbench);

  // Scroll horizontal sincronizado com barra visível apenas no último campo rolado/em foco
  const scrollEls = [$('wb-scroll-dna'), $('wb-scroll-rna'), $('wb-scroll-diff'), $('wb-scroll-protein'), $('wb-scroll-hydro')].filter(Boolean);
  let syncingScroll = false;
  const setActiveScroller = (activeEl) => {
    scrollEls.forEach(el => el.classList.toggle('scroll-active', el === activeEl));
  };
  scrollEls.forEach((src) => {
    src.addEventListener('mouseenter', () => setActiveScroller(src));
    src.addEventListener('scroll', () => {
      setActiveScroller(src);
      if (syncingScroll) return;
      syncingScroll = true;
      const left = src.scrollLeft;
      scrollEls.forEach((dst) => {
        if (dst !== src) dst.scrollLeft = left;
      });
      syncingScroll = false;
    });
  });
  document.querySelectorAll('.base-insert-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('wb-dna-input').value += btn.dataset.base;
      refreshWorkbench();
    });
  });
  $('wb-random-btn').addEventListener('click', () => {
    const dna = generateRandomCodingDna(6);
    state.activeRef = null;
    state.wildDna = dna;
    $('wb-dna-input').value = dna;
    refreshWorkbench();
  });
  $('wb-snapshot-btn').addEventListener('click', async () => {
    await addRecord('snapshots', { label: state.activeRef ? state.activeRef.gene : 'Custom', dna: $('wb-dna-input').value });
    renderSnapshots();
  });

  // FASTA Modal
  const dialog = $('fasta-dialog');
  $('wb-open-fasta').addEventListener('click', () => dialog.showModal());
  $('fasta-confirm-btn').addEventListener('click', async () => {
    const res = await analyzeDna($('fasta-textarea').value);
    state.activeRef = null;
    state.wildDna = res.dna;
    $('wb-dna-input').value = res.dna;
    dialog.close();
    refreshWorkbench();
  });

  // Atlas Inline Experiment
  document.querySelectorAll('.inline-allele-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.inline-allele-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isMut = btn.dataset.allele === 'mut';
      $('atlas-inline-codon').textContent = isMut ? "3'-CAC-5' → 5'-GUG-3'" : "3'-CTC-5' → 5'-GAG-3'";
      $('atlas-inline-aa').textContent = isMut ? 'Valina (Val · Apolar Hidrofóbico)' : 'Ácido Glutâmico (Glu · Polar Ácido)';
      $('atlas-inline-pheno').textContent = isMut ? 'Polimerização em desoxi-Hb (Foice)' : 'Hemácia bicôncava flexível (Normal)';
      $('atlas-inline-adv').textContent = isMut
        ? 'Val possui índice de hidropatia +4.2 (hidrofóbico), criando ponto de adesão entre tetrâmeros.'
        : 'Glu possui índice de hidropatia -3.5 (hidrofílico), mantendo a superfície da β-globina solúvel.';
    });
  });
  $('atlas-send-to-bench').addEventListener('click', () => setMode('workbench'));

  $('notebook-save-btn').addEventListener('click', async () => {
    const text = $('notebook-input').value.trim();
    if (!text) return;
    await addRecord('notebook', { text });
    $('notebook-input').value = '';
    renderNotebook();
  });

  // Avaliação & Docente
  document.querySelectorAll('.eval-opt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ok = btn.dataset.correct === 'true';
      btn.classList.add(ok ? 'is-right' : 'is-wrong');
      const fb = $('eval-feedback');
      fb.hidden = false;
      fb.textContent = ok
        ? 'Correto! GAG → GUG troca Ácido Glutâmico (polar ácido) por Valina (apolar), caracterizando missense não-conservativa.'
        : 'Incorreto. Observe que houve troca de aminoácido com mudança de classe química (ácido → apolar).';
    });
  });
  $('docente-generate-btn').addEventListener('click', generateDocenteList);
  $('docente-print-btn').addEventListener('click', () => window.print());
  $('docente-export-md').addEventListener('click', exportMarkdownReport);

  await Promise.all([refreshWorkbench(), renderSnapshots(), renderNotebook()]);
  generateDocenteList();
}

document.addEventListener('DOMContentLoaded', init);
