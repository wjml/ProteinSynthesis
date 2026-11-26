/**
 * assets/js/beta/labs_extra.js
 * Heredogramas SVG (AD, AR, XR, XD), Cariótipo (Classificação de Denver + Não-Disjunção)
 * e Gerador de Questões do Modo Desafio multi-categoria.
 */

export const PEDIGREE_PATTERNS = {
  AD: {
    name: 'Autossômica Dominante',
    desc: 'Manifesta-se em todas as gerações (transmissão vertical). Afetados têm ao menos um progenitor afetado; ambos os sexos são igualmente atingidos.',
    recurrence: '50% de chance para cada filho de casal afetado heterozigoto (Aa × aa).',
    affected: new Set(['I-1', 'II-1', 'II-3', 'III-1']),
    carriers: new Set(),
    genotypes: {
      'I-1': 'Aa', 'I-2': 'aa',
      'II-1': 'Aa', 'II-2': 'aa', 'II-3': 'Aa', 'II-4': 'aa',
      'III-1': 'Aa', 'III-2': 'aa', 'III-3': 'aa', 'III-4': 'aa'
    }
  },
  AR: {
    name: 'Autossômica Recessiva',
    desc: 'Pode saltar gerações. Pais fenotipicamente normais e portadores (Aa × Aa) podem ter filhos afetados (aa) de ambos os sexos (25%).',
    recurrence: '25% afetado (aa), 50% portador (Aa), 25% normal (AA) em casal Aa × Aa.',
    affected: new Set(['II-2', 'III-2']),
    carriers: new Set(['I-1', 'I-2', 'II-3', 'II-4']),
    genotypes: {
      'I-1': 'Aa', 'I-2': 'Aa',
      'II-1': 'AA', 'II-2': 'aa', 'II-3': 'Aa', 'II-4': 'Aa',
      'III-1': 'AA', 'III-2': 'aa', 'III-3': 'Aa', 'III-4': 'Aa'
    }
  },
  XR: {
    name: 'Ligada ao X Recessiva',
    desc: 'Predomina em indivíduos do sexo masculino (hemizigotos XᵃY). Não há transmissão pai-para-filho; mães portadoras transmitem a 50% dos filhos homens.',
    recurrence: '50% dos filhos homens afetados e 50% das filhas mulheres portadoras (XᴬXᵃ × XᴬY).',
    affected: new Set(['I-1', 'III-1', 'III-4']),
    carriers: new Set(['II-1', 'II-3']),
    genotypes: {
      'I-1': 'XᵃY', 'I-2': 'XᴬXᴬ',
      'II-1': 'XᴬXᵃ', 'II-2': 'XᴬY', 'II-3': 'XᴬXᵃ', 'II-4': 'XᴬY',
      'III-1': 'XᵃY', 'III-2': 'XᴬXᴬ', 'III-3': 'XᴬY', 'III-4': 'XᵃY'
    }
  },
  XD: {
    name: 'Ligada ao X Dominante',
    desc: 'Homens afetados transmitem o alelo dominante para 100% de suas filhas mulheres e para 0% de seus filhos homens.',
    recurrence: '100% das filhas de pai afetado (XᴬY × XᵃXᵃ) herdam o fenótipo.',
    affected: new Set(['I-1', 'II-1', 'II-3', 'III-2']),
    carriers: new Set(),
    genotypes: {
      'I-1': 'XᴬY', 'I-2': 'XᵃXᵃ',
      'II-1': 'XᴬXᵃ', 'II-2': 'XᵃY', 'II-3': 'XᴬXᵃ', 'II-4': 'XᵃY',
      'III-1': 'XᵃY', 'III-2': 'XᴬXᵃ', 'III-3': 'XᵃY', 'III-4': 'XᵃXᵃ'
    }
  }
};

export function renderPedigreeSvg(patternKey, options = {}) {
  const { showGenotypes = true, showCarriers = true } = options;
  const pat = PEDIGREE_PATTERNS[patternKey] || PEDIGREE_PATTERNS.AR;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 560 280');

  const nodes = [
    { id: 'I-1', x: 180, y: 44, sex: 'M' },
    { id: 'I-2', x: 320, y: 44, sex: 'F' },
    { id: 'II-1', x: 100, y: 136, sex: 'F' },
    { id: 'II-2', x: 190, y: 136, sex: 'M' },
    { id: 'II-3', x: 290, y: 136, sex: 'F' },
    { id: 'II-4', x: 400, y: 136, sex: 'M' },
    { id: 'III-1', x: 220, y: 228, sex: 'M' },
    { id: 'III-2', x: 300, y: 228, sex: 'F' },
    { id: 'III-3', x: 380, y: 228, sex: 'M' },
    { id: 'III-4', x: 460, y: 228, sex: 'M' }
  ];

  const lines = [
    [198, 44, 302, 44],   // I-1 — I-2
    [250, 44, 250, 92],   // descida I
    [100, 92, 290, 92],   // barra II
    [100, 92, 100, 118],
    [190, 92, 190, 118],
    [290, 92, 290, 118],
    [308, 136, 382, 136], // II-3 — II-4
    [345, 136, 345, 184], // descida II
    [220, 184, 460, 184], // barra III
    [220, 184, 220, 210],
    [300, 184, 300, 210],
    [380, 184, 380, 210],
    [460, 184, 460, 210]
  ];

  lines.forEach(([x1, y1, x2, y2]) => {
    const l = document.createElementNS(svgNS, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1);
    l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('stroke', 'currentColor');
    l.setAttribute('stroke-opacity', '0.55');
    l.setAttribute('stroke-width', '2');
    svg.appendChild(l);
  });

  nodes.forEach((n) => {
    const isAff = pat.affected.has(n.id);
    const isCar = showCarriers && pat.carriers.has(n.id);
    if (n.sex === 'M') {
      const r = document.createElementNS(svgNS, 'rect');
      r.setAttribute('x', n.x - 16); r.setAttribute('y', n.y - 16);
      r.setAttribute('width', 32); r.setAttribute('height', 32);
      r.setAttribute('rx', 4);
      r.setAttribute('fill', isAff ? 'var(--accent)' : 'var(--surface)');
      r.setAttribute('stroke', 'currentColor');
      r.setAttribute('stroke-width', '2');
      svg.appendChild(r);
    } else {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', n.x); c.setAttribute('cy', n.y);
      c.setAttribute('r', 16);
      c.setAttribute('fill', isAff ? 'var(--accent)' : 'var(--surface)');
      c.setAttribute('stroke', 'currentColor');
      c.setAttribute('stroke-width', '2');
      svg.appendChild(c);
    }

    if (isCar && !isAff) {
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', n.x); dot.setAttribute('cy', n.y);
      dot.setAttribute('r', 5);
      dot.setAttribute('fill', 'var(--accent)');
      svg.appendChild(dot);
    }

    const lbl = document.createElementNS(svgNS, 'text');
    lbl.setAttribute('x', n.x); lbl.setAttribute('y', n.y + 30);
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('font-size', '10.5');
    lbl.setAttribute('font-family', 'IBM Plex Mono, monospace');
    lbl.setAttribute('fill', 'currentColor');
    lbl.textContent = showGenotypes ? `${n.id} (${pat.genotypes[n.id]})` : n.id;
    svg.appendChild(lbl);
  });

  return svg;
}

export const KARYOTYPE_CONDITIONS = {
  normal_m: { name: 'Normal Masculino', iscn: '46, XY', extra: null, sex: ['X', 'Y'], desc: 'Cariótipo euploide masculino padrão com 22 pares de autossomos e par sexual XY.' },
  normal_f: { name: 'Normal Feminino', iscn: '46, XX', extra: null, sex: ['X', 'X'], desc: 'Cariótipo euploide feminino padrão com 22 pares de autossomos e par sexual XX.' },
  down: { name: 'Síndrome de Down', iscn: '47, XX/XY, +21', extra: 21, sex: ['X', 'Y'], desc: 'Trissomia do cromossomo 21 (Grupo G), geralmente decorrente de não-disjunção na Meiose I materna.' },
  edwards: { name: 'Síndrome de Edwards', iscn: '47, XX/XY, +18', extra: 18, sex: ['X', 'X'], desc: 'Trissomia do cromossomo 18 (Grupo E), associada a alterações cardíacas e neuromotoras severas.' },
  patau: { name: 'Síndrome de Patau', iscn: '47, XX/XY, +13', extra: 13, sex: ['X', 'Y'], desc: 'Trissomia do cromossomo 13 (Grupo D), causada por não-disjunção meiótica.' },
  turner: { name: 'Síndrome de Turner', iscn: '45, X', extra: null, sex: ['X'], desc: 'Monossomia do cromossomo X (única monossomia viável na espécie humana).' },
  klinefelter: { name: 'Síndrome de Klinefelter', iscn: '47, XXY', extra: null, sex: ['X', 'X', 'Y'], desc: 'Trissomia sexual XXY resultante de não-disjunção em gametas paternos ou maternos.' }
};

export const DENVER_GROUPS = [
  { group: 'A', pairs: [1, 2, 3], h: 52 },
  { group: 'B', pairs: [4, 5], h: 46 },
  { group: 'C', pairs: [6, 7, 8, 9, 10, 11, 12], h: 38 },
  { group: 'D', pairs: [13, 14, 15], h: 32 },
  { group: 'E', pairs: [16, 17, 18], h: 27 },
  { group: 'F', pairs: [19, 20], h: 22 },
  { group: 'G', pairs: [21, 22], h: 18 }
];

export function simulateNondisjunction(phase = 'meiosis1') {
  if (phase === 'meiosis1') {
    return {
      gametes: ['n + 1 (Dissômico)', 'n + 1 (Dissômico)', 'n - 1 (Nulissômico)', 'n - 1 (Nulissômico)'],
      zygotes: '50% Trissomia (2n+1) · 50% Monossomia (2n-1) · 0% Normais'
    };
  }
  return {
    gametes: ['n (Normal)', 'n (Normal)', 'n + 1 (Dissômico)', 'n - 1 (Nulissômico)'],
    zygotes: '50% Normais (2n) · 25% Trissomia (2n+1) · 25% Monossomia (2n-1)'
  };
}

export const QUIZ_BANK = [
  { cat: 'molecular', q: 'Um códon UAG surgiu no meio do éxon 2 do gene HBB. Qual o tipo de mutação?', opts: ['Silenciosa', 'Missense', 'Nonsense', 'Stoploss'], ans: 2 },
  { cat: 'molecular', q: 'Na fita molde de DNA 3\'-TAC-5\', qual é o RNAm transcrito e o aminoácido?', opts: ['5\'-AUG-3\' → Metionina', '5\'-UAC-3\' → Tirosina', '5\'-GUA-3\' → Valina', '5\'-CAU-3\' → Histidina'], ans: 0 },
  { cat: 'mendel', q: 'No cruzamento AaBb × AaBb sem epistasia, qual a proporção fenotípica esperada?', opts: ['9:3:4', '9:3:3:1', '12:3:1', '3:1'], ans: 1 },
  { cat: 'mendel', q: 'Qual proporção fenotípica caracteriza a Epistasia Recessiva?', opts: ['15:1', '9:7', '9:3:4', '12:3:1'], ans: 2 },
  { cat: 'pedigree', q: 'Um homem afetado transmite a característica para 100% de suas filhas e 0% de seus filhos. O padrão é:', opts: ['Autossômica Recessiva', 'Ligada ao X Dominante', 'Ligada ao X Recessiva', 'Mitocondrial'], ans: 1 },
  { cat: 'popgen', q: 'Em equilíbrio de Hardy-Weinberg, se q = 0,3, qual a frequência esperada de heterozigotos (2pq)?', opts: ['0,09', '0,21', '0,42', '0,49'], ans: 2 },
  { cat: 'karyotype', q: 'Qual a notação ISCN correta para uma mulher com Síndrome de Turner?', opts: ['47, XX, +21', '45, X', '47, XXY', '46, XY'], ans: 1 }
];
