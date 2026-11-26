/**
 * assets/js/beta/labs.js
 * Motor completo dos laboratórios nativos do Modo Beta 2.0:
 * - CRISPR-Cas9 (PAM NGG/NAG, filtro gRNA, risco Pol III/seed, NHEJ/HDR + Diff)
 * - Genética Mendeliana (Monoíbrido 2x2, Diíbrido 4x4, Sistema ABO, 4 tipos de Epistasia)
 * - Genética Populacional (HW por p ou q², χ² + barras Obs vs Esp, Deriva + Seleção Monte Carlo)
 */

// ─── CRISPR-Cas9 ─────────────────────────────────────────────────────────────

export function findPamTargets(dna, options = {}) {
  const { includeNag = false, grnaFilter = '' } = options;
  const clean = String(dna || '').toUpperCase().replace(/[^ATCG]/g, '');
  const filter = String(grnaFilter || '').toUpperCase().replace(/U/g, 'T').replace(/[^ATCG]/g, '');
  const targets = [];

  for (let i = 20; i + 2 < clean.length; i++) {
    const pam = clean.slice(i, i + 3);
    const isNgg = pam[1] === 'G' && pam[2] === 'G';
    const isNag = includeNag && pam[1] === 'A' && pam[2] === 'G';
    if (!isNgg && !isNag) continue;

    const protospacer = clean.slice(i - 20, i);
    if (filter && !protospacer.includes(filter)) continue;

    const gc = ((protospacer.match(/[GC]/g) || []).length / 20) * 100;
    const seedGc = ((protospacer.slice(-8).match(/[GC]/g) || []).length / 8) * 100;
    const hasPolyT = protospacer.includes('TTTT');
    let score = 100 - Math.abs(50 - gc) * 0.8;
    if (!isNgg) score -= 25;
    if (hasPolyT) score -= 20;
    if (seedGc < 25 || seedGc > 85) score -= 10;

    targets.push({
      index: i - 20,
      cutPos: i - 3,
      protospacer,
      pam,
      pamType: isNgg ? 'NGG' : 'NAG',
      gc: Math.round(gc),
      seedGc: Math.round(seedGc),
      hasPolyT,
      score: Math.max(5, Math.min(99, Math.round(score)))
    });
  }
  return targets.sort((a, b) => b.score - a.score);
}

export function simulateCrisprRepair(dna, cutPos, mode, donor = '') {
  const clean = String(dna || '').toUpperCase().replace(/[^ATCG]/g, '');
  if (mode === 'hdr' && donor.trim()) {
    const cleanDonor = donor.toUpperCase().replace(/[^ATCG]/g, '');
    const start = Math.max(0, cutPos - Math.floor(cleanDonor.length / 2));
    return clean.slice(0, start) + cleanDonor + clean.slice(start + cleanDonor.length);
  }
  const bases = ['A', 'T', 'C', 'G'];
  if (Math.random() < 0.5 && clean.length > cutPos + 2) {
    return clean.slice(0, cutPos) + clean.slice(cutPos + 1);
  }
  const ins = bases[Math.floor(Math.random() * 4)];
  return clean.slice(0, cutPos) + ins + clean.slice(cutPos);
}

// ─── Genética Mendeliana ─────────────────────────────────────────────────────

function sortAlleles(a, b) {
  if (a === a.toUpperCase() && b === b.toLowerCase()) return -1;
  if (a === a.toLowerCase() && b === b.toUpperCase()) return 1;
  return a.localeCompare(b);
}

export function computePunnett(p1, p2) {
  const g1 = [p1[0], p1[1]];
  const g2 = [p2[0], p2[1]];
  const cells = [];
  const counts = {};
  for (const a of g1) {
    for (const b of g2) {
      const geno = [a, b].sort(sortAlleles).join('');
      cells.push(geno);
      counts[geno] = (counts[geno] || 0) + 1;
    }
  }
  return { g1, g2, cells, counts };
}

function getDihybridGametes(geno) {
  const a = [geno[0], geno[1]];
  const b = [geno[2], geno[3]];
  const out = [];
  for (const x of a) for (const y of b) out.push(x + y);
  return out;
}

export function computeDihybrid(p1, p2) {
  const g1 = getDihybridGametes(p1);
  const g2 = getDihybridGametes(p2);
  const cells = [];
  const counts = {};
  const phenoCounts = { 'A_B_': 0, 'A_bb': 0, 'aaB_': 0, 'aabb': 0 };

  for (const gam1 of g1) {
    for (const gam2 of g2) {
      const pairA = [gam1[0], gam2[0]].sort(sortAlleles).join('');
      const pairB = [gam1[1], gam2[1]].sort(sortAlleles).join('');
      const full = pairA + pairB;
      cells.push(full);
      counts[full] = (counts[full] || 0) + 1;
      const domA = pairA.includes('A');
      const domB = pairB.includes('B');
      const pk = `${domA ? 'A_' : 'aa'}${domB ? 'B_' : 'bb'}`;
      phenoCounts[pk]++;
    }
  }
  return { g1, g2, cells, counts, phenoCounts };
}

export const EPISTASIS_SCENARIOS = {
  recessive: {
    name: 'Epistasia Recessiva (9:3:4)',
    desc: 'Homozigose recessiva (aa) mascara o locus B — ex.: pelagem de labradores (B=preto, b=marrom, aa=dourado).',
    classify: (domA, domB) => (!domA ? 'Epistático (aa)' : domB ? 'Dominante A_B_' : 'Recessivo B (A_bb)')
  },
  dominant: {
    name: 'Epistasia Dominante (12:3:1)',
    desc: 'Alelo dominante A_ mascara a expressão do locus B — ex.: cor de abóboras.',
    classify: (domA, domB) => (domA ? 'Epistático (A_)' : domB ? 'Recessivo A + Dom B' : 'Duplo Recessivo (aabb)')
  },
  dup_recessive: {
    name: 'Epistasia Dupla Recessiva (9:7)',
    desc: 'Ambos os loci precisam de ao menos um alelo dominante (A_B_) para produzir o fenótipo funcional.',
    classify: (domA, domB) => (domA && domB ? 'Funcional (A_B_)' : 'Sem Produto (aa ou bb)')
  },
  dup_dominant: {
    name: 'Epistasia Dupla Dominante (15:1)',
    desc: 'Basta um alelo dominante em qualquer um dos dois loci (A_ ou B_) para gerar o fenótipo.',
    classify: (domA, domB) => (domA || domB ? 'Dominante (A_ ou B_)' : 'Duplo Recessivo (aabb)')
  }
};

export function computeEpistasis(scenarioKey = 'recessive') {
  const sc = EPISTASIS_SCENARIOS[scenarioKey] || EPISTASIS_SCENARIOS.recessive;
  const base = computeDihybrid('AaBb', 'AaBb');
  const phenos = {};
  const labeledCells = base.cells.map((g) => {
    const domA = g.slice(0, 2).includes('A');
    const domB = g.slice(2, 4).includes('B');
    const label = sc.classify(domA, domB);
    phenos[label] = (phenos[label] || 0) + 1;
    return { geno: g, label };
  });
  return { ...base, scenario: sc, labeledCells, phenos };
}

const ABO_GAMETES = {
  IAIA: ['IA', 'IA'],
  IAi: ['IA', 'i'],
  IBIB: ['IB', 'IB'],
  IBi: ['IB', 'i'],
  IAIB: ['IA', 'IB'],
  ii: ['i', 'i']
};

function aboPhenotype(g) {
  if (g === 'IAIB') return 'AB';
  if (g.includes('IA')) return 'A';
  if (g.includes('IB')) return 'B';
  return 'O';
}

export function computeAbo(p1Key, p2Key) {
  const g1 = ABO_GAMETES[p1Key] || ['IA', 'i'];
  const g2 = ABO_GAMETES[p2Key] || ['IB', 'i'];
  const phenos = { A: 0, B: 0, AB: 0, O: 0 };
  const cells = [];
  for (const a of g1) {
    for (const b of g2) {
      const order = { IA: 1, IB: 2, i: 3 };
      const geno = [a, b].sort((x, y) => order[x] - order[y]).join('');
      const ph = aboPhenotype(geno);
      cells.push({ geno, ph });
      phenos[ph]++;
    }
  }
  return { g1, g2, cells, phenos };
}

// ─── Genética Populacional ───────────────────────────────────────────────────

export function computeHardyWeinberg(pVal, totalN, obsAA, obsAa, obaa) {
  const p = Math.max(0, Math.min(1, Number(pVal)));
  const q = Number((1 - p).toFixed(4));
  const expAA = p * p * totalN;
  const expAa = 2 * p * q * totalN;
  const expaa = q * q * totalN;
  const chi2 =
    (expAA > 0 ? Math.pow(obsAA - expAA, 2) / expAA : 0) +
    (expAa > 0 ? Math.pow(obsAa - expAa, 2) / expAa : 0) +
    (expaa > 0 ? Math.pow(obaa - expaa, 2) / expaa : 0);
  return {
    p: Number(p.toFixed(3)),
    q: Number(q.toFixed(3)),
    p2: Number((p * p).toFixed(3)),
    pq2: Number((2 * p * q).toFixed(3)),
    q2: Number((q * q).toFixed(3)),
    expAA: Number(expAA.toFixed(1)),
    expAa: Number(expAa.toFixed(1)),
    expaa: Number(expaa.toFixed(1)),
    chi2: Number(chi2.toFixed(3)),
    inEquilibrium: chi2 < 3.841
  };
}

export function simulateDriftAndSelection(p0, ne, generations = 50, fitness = { wAA: 1, wAa: 1, waa: 1 }, replicates = 5) {
  const runs = [];
  const alleles = Math.max(10, ne * 2);
  for (let r = 0; r < replicates; r++) {
    const series = [p0];
    let p = p0;
    for (let g = 1; g <= generations; g++) {
      const q = 1 - p;
      const wBar = p * p * fitness.wAA + 2 * p * q * fitness.wAa + q * q * fitness.waa;
      const pSel = wBar > 0 ? (p * p * fitness.wAA + p * q * fitness.wAa) / wBar : p;
      let countA = 0;
      for (let i = 0; i < alleles; i++) {
        if (Math.random() < pSel) countA++;
      }
      p = countA / alleles;
      series.push(Number(p.toFixed(3)));
    }
    runs.push(series);
  }
  return runs;
}
