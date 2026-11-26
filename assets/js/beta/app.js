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
  customTitle: '',
  wildDna: '',
  selectedOrfFrame: null,
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

function getActiveOrfMeta(analysis, frame) {
  if (!analysis || !analysis.orfs || !frame) return null;
  return analysis.orfs.find(o => o.frame === frame) || null;
}

function isCodonBoundary(i, len, orfMeta) {
  if (i >= len - 1) return false;
  if (!orfMeta) return (i + 1) % 3 === 0;
  const offset = orfMeta.offset || 0;
  if (orfMeta.isReverse) {
    const revIdx = len - 1 - i;
    return revIdx >= offset && (revIdx - offset + 1) % 3 === 0;
  }
  return i >= offset && (i - offset + 1) % 3 === 0;
}

function renderDuplexDna(container, dna, compDna, compareSeq = '', orfMeta = null) {
  container.textContent = '';
  const hasOrf = orfMeta && orfMeta.hasOrf;
  for (let i = 0; i < dna.length; i++) {
    const col = document.createElement('div');
    const isCodonEnd = isCodonBoundary(i, dna.length, orfMeta);
    const outOfOrf = hasOrf && (i < orfMeta.fwdStart || i >= orfMeta.fwdEnd);
    col.className = `bp-col has-phosphate-top has-phosphate-bottom${isCodonEnd ? ' codon-end' : ''}${outOfOrf ? ' out-of-orf' : ''}`;

    const bTop = dna[i];
    const bBot = compDna[i] || '';
    const isDiff = Boolean(compareSeq && compareSeq[i] && compareSeq[i] !== bTop);

    const topEl = makeBaseShape(bTop, 'nt-top', isDiff);
    if (orfMeta && orfMeta.isReverse) topEl.style.opacity = '0.55';
    col.appendChild(topEl);

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

function renderMrnaTrack(container, mrna, orfMeta = null) {
  container.textContent = '';
  const hasOrf = orfMeta && orfMeta.hasOrf;
  for (let i = 0; i < mrna.length; i++) {
    const col = document.createElement('div');
    const isCodonEnd = isCodonBoundary(i, mrna.length, orfMeta);
    const outOfOrf = hasOrf && (i < orfMeta.fwdStart || i >= orfMeta.fwdEnd);
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

  const poly = document.createElementNS(svgNS, 'polyline');
  poly.setAttribute('fill', 'none');
  poly.setAttribute('stroke', 'var(--accent)');
  poly.setAttribute('stroke-width', '3');
  poly.setAttribute('stroke-opacity', '0.85');
  poly.setAttribute('points', pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  svg.appendChild(poly);

  // Linha tracejada + marcadores Wild-Type limitados à extensão comparável (ou proteína WT completa)
  if (wildProfile && wildProfile.length) {
    const wSlice = wildProfile.slice(0, Math.max(profile.length, wildProfile.length));
    const wPts = toPts(wSlice).map(p => ({ ...p, y: p.y + 1.5 }));
    const wPoly = document.createElementNS(svgNS, 'polyline');
    wPoly.setAttribute('fill', 'none');
    wPoly.setAttribute('stroke', 'var(--base-t)');
    wPoly.setAttribute('stroke-width', '2');
    wPoly.setAttribute('stroke-dasharray', '5 4');
    wPoly.setAttribute('points', wPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
    svg.appendChild(wPoly);

    wPts.forEach((p, idx) => {
      const m = document.createElementNS(svgNS, 'polygon');
      const s = 3.5;
      m.setAttribute('points', `${p.x},${p.y - s} ${p.x + s},${p.y} ${p.x},${p.y + s} ${p.x - s},${p.y}`);
      m.setAttribute('fill', 'var(--bg)');
      m.setAttribute('stroke', 'var(--base-t)');
      m.setAttribute('stroke-width', '1.6');
      const title = document.createElementNS(svgNS, 'title');
      title.textContent = `WT ${p.pos} · ${p.abbr}: ${p.kd}`;
      m.appendChild(title);
      svg.appendChild(m);

      // Se a proteína atual terminou antes (stop prematuro / deleção), rotular valor WT excedente
      if (idx >= profile.length) {
        const wLbl = document.createElementNS(svgNS, 'text');
        wLbl.setAttribute('x', p.x.toFixed(1));
        wLbl.setAttribute('y', (p.kd >= 0 ? p.y - 8 : p.y + 14).toFixed(1));
        wLbl.setAttribute('text-anchor', 'middle');
        wLbl.setAttribute('font-size', '9.5');
        wLbl.setAttribute('font-family', 'IBM Plex Mono, monospace');
        wLbl.setAttribute('fill', 'var(--base-t)');
        wLbl.textContent = `WT ${(p.kd > 0 ? '+' : '') + p.kd.toFixed(1)}`;
        svg.appendChild(wLbl);
      }
    });
  }

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
  if (!state.wildDna && cur.dna) state.wildDna = cur.dna;

  state.currentAnalysis = cur;
  state.wildAnalysis = wild;

  const titleText = state.customTitle || (state.activeRef ? `${state.activeRef.gene} — ${state.activeRef.title}` : cur.header);
  $('wb-seq-header').textContent = titleText;
  $('wb-seq-stats').textContent = `${cur.lengthNt} nt · ${cur.biochemistry.lengthAa} aa · GC ${cur.gcPercent}%`;

  const cmpDna = compareWt ? state.wildDna : '';
  const isAdv = document.body.getAttribute('data-layer') === 'advanced';
  const orfMeta = isAdv ? getActiveOrfMeta(cur, state.selectedOrfFrame) : null;
  const orfBanner = $('wb-orf-banner');
  if (orfBanner) {
    if (isAdv && orfMeta) {
      orfBanner.hidden = false;
      orfBanner.textContent = orfMeta.isReverse
        ? `Quadro ${orfMeta.frame} · Reverso (5'→3' ←)`
        : `Quadro ${orfMeta.frame} · Direto (5'→3' →)`;
    } else {
      orfBanner.hidden = true;
    }
  }
  renderDuplexDna($('wb-duplex-grid'), cur.dna, cur.complementDna, cmpDna, orfMeta);
  renderMrnaTrack($('wb-track-rna'), cur.mrna, orfMeta);

  const diffEl = $('wb-track-diff');
  diffEl.textContent = '';
  if (compareWt && wild) {
    const maxLen = Math.max(wild.dna.length, cur.dna.length);
    for (let i = 0; i < maxLen; i++) {
      const col = document.createElement('div');
      const isCodonEnd = isCodonBoundary(i, maxLen, orfMeta);
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
  const activeProtein = (orfMeta && orfMeta.hasOrf) ? orfMeta.protein : (orfMeta && !orfMeta.hasOrf ? [] : cur.protein);
  const leadPx = (orfMeta && orfMeta.hasOrf) ? orfMeta.fwdStart * 29 : 0;
  pGrid.style.paddingLeft = `${leadPx}px`;
  pGrid.style.flexDirection = (orfMeta && orfMeta.isReverse) ? 'row-reverse' : 'row';

  if (orfMeta && !orfMeta.hasOrf) {
    const msg = document.createElement('span');
    msg.className = 'empty-track-msg';
    msg.textContent = `Nenhum códon de iniciação (AUG) encontrado no quadro ${orfMeta.frame}.`;
    pGrid.appendChild(msg);
  } else {
    activeProtein.forEach((aa, idx) => {
      const wAa = wild && wild.protein[idx];
      const changed = compareWt && !orfMeta && wAa && wAa.abbr !== aa.abbr;
      const card = document.createElement('div');
      card.className = `aa-card${changed ? ' aa-mut' : ''}`;
      const abbr = document.createElement('div');
      abbr.className = 'aa-card-abbr mono';
      abbr.textContent = `${aa.position} · ${aa.abbr}`;
      const name = document.createElement('div');
      name.className = 'aa-card-name';
      name.textContent = aa.name;
      card.append(abbr, name);
      if (changed) {
        const detail = document.createElement('div');
        detail.className = 'aa-mut-detail';
        detail.textContent = `Antes: ${wAa.abbr}`;
        card.appendChild(detail);
      }
      const type = document.createElement('span');
      type.className = 'aa-card-type';
      type.textContent = aa.type;
      card.appendChild(type);
      pGrid.appendChild(card);
    });
  }

  $('ins-length').textContent = `${cur.biochemistry.lengthAa} aa`;
  $('ins-gc').textContent = `${cur.gcPercent}%`;
  $('ins-mw').textContent = `${cur.biochemistry.mwKda} kDa`;
  $('ins-pi').textContent = String(cur.biochemistry.pI);
  $('ins-charge').textContent = `${cur.biochemistry.netCharge74 >= 0 ? '+' : ''}${cur.biochemistry.netCharge74}`;
  $('ins-gravy').textContent = String(cur.biochemistry.gravy);
  $('wb-gravy-badge').textContent = `GRAVY: ${cur.biochemistry.gravy}`;

  const activeHydro = (orfMeta && orfMeta.hasOrf)
    ? activeProtein.map(p => ({ pos: p.position, abbr: p.abbr, kd: p.kd }))
    : cur.biochemistry.hydropathyProfile;
  renderHydropathyChart(
    activeHydro,
    compareWt && !orfMeta && wild ? wild.biochemistry.hydropathyProfile : null
  );

  const orfList = $('wb-orf-list');
  const orfPrev = $('wb-orf-preview');
  orfList.textContent = '';
  const selectedOrfObj = (cur.orfs || []).find(o => o.frame === state.selectedOrfFrame);
  if (orfPrev) {
    if (selectedOrfObj) {
      orfPrev.hidden = false;
      orfPrev.textContent = selectedOrfObj.hasOrf
        ? `Quadro ${selectedOrfObj.frame} (${selectedOrfObj.isReverse ? 'Reverso ←' : 'Direto →'}): início nt ${selectedOrfObj.startNt} | ${selectedOrfObj.lengthAa} aa | ${selectedOrfObj.hasStop ? 'Stop encontrado' : 'ORF aberto'} | Peptídeo: ${selectedOrfObj.preview}`
        : `Quadro ${selectedOrfObj.frame}: nenhum códon de iniciação (AUG) encontrado nesta leitura.`;
    } else {
      orfPrev.hidden = true;
    }
  }
  (cur.orfs || []).forEach((orf) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `orf-item${state.selectedOrfFrame === orf.frame ? ' active' : ''}`;
    const left = document.createElement('span');
    left.textContent = `${orf.frame} · ${orf.strand}`;
    const right = document.createElement('span');
    right.className = 'mono';
    right.textContent = orf.hasOrf ? `${orf.lengthAa} aa (nt ${orf.startNt})` : 'Sem AUG';
    row.append(left, right);
    row.addEventListener('click', () => {
      state.selectedOrfFrame = (state.selectedOrfFrame === orf.frame) ? null : orf.frame;
      refreshWorkbench();
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

  // Renomear título da sequência com duplo clique
  const seqHeaderEl = $('wb-seq-header');
  if (seqHeaderEl) {
    seqHeaderEl.addEventListener('dblclick', () => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'wb-title-input';
      inp.value = seqHeaderEl.textContent;
      const commitTitle = () => {
        const val = inp.value.trim();
        if (val) state.customTitle = val;
        inp.replaceWith(seqHeaderEl);
        seqHeaderEl.textContent = state.customTitle || (state.activeRef ? `${state.activeRef.gene} — ${state.activeRef.title}` : 'Sequência Sem Título');
      };
      inp.addEventListener('blur', commitTitle);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') inp.blur();
        if (e.key === 'Escape') { inp.value = seqHeaderEl.textContent; inp.blur(); }
      });
      seqHeaderEl.replaceWith(inp);
      inp.focus();
      inp.select();
    });
  }

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
