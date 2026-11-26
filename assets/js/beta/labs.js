/**
 * assets/js/beta/labs.js
 * Laboratórios Nativos do Modo Beta 2.0 (CRISPR-Cas9, Mendel, Populações HW + Deriva)
 * Todos respeitando as 3 camadas de visualização (Básica / Intermediária / Avançada).
 */

export function findPamTargets(dna) {
  const clean = String(dna || '').toUpperCase().replace(/[^ATCG]/g, '');
  const targets = [];
  for (let i = 20; i + 2 < clean.length; i++) {
    if (clean[i + 1] === 'G' && clean[i + 2] === 'G') {
      const protospacer = clean.slice(i - 20, i);
      const pam = clean.slice(i, i + 3);
      const gc = ((protospacer.match(/[GC]/g) || []).length / 20) * 100;
      const score = Math.round(100 - Math.abs(50 - gc) * 0.9);
      targets.push({ index: i - 20, cutPos: i - 3, protospacer, pam, gc: gc.toFixed(0), score });
    }
  }
  return targets;
}

export function simulateCrisprRepair(dna, cutPos, mode, donor = '') {
  const clean = String(dna || '').toUpperCase().replace(/[^ATCG]/g, '');
  if (mode === 'hdr' && donor.trim()) {
    const cleanDonor = donor.toUpperCase().replace(/[^ATCG]/g, '');
    const start = Math.max(0, cutPos - Math.floor(cleanDonor.length / 2));
    return clean.slice(0, start) + cleanDonor + clean.slice(start + cleanDonor.length);
  }
  // NHEJ: inserção ou deleção aleatória de 1-2 nt no sítio de corte
  const bases = ['A', 'T', 'C', 'G'];
  if (Math.random() < 0.5 && clean.length > cutPos + 2) {
    return clean.slice(0, cutPos) + clean.slice(cutPos + 1);
  }
  const ins = bases[Math.floor(Math.random() * 4)];
  return clean.slice(0, cutPos) + ins + clean.slice(cutPos);
}

export function computePunnett(p1, p2) {
  const g1 = [p1[0], p1[1]];
  const g2 = [p2[0], p2[1]];
  const cells = [];
  const counts = {};
  for (const a of g1) {
    for (const b of g2) {
      const geno = [a, b].sort((x, y) => (x === x.toUpperCase() && y === y.toLowerCase() ? -1 : x === x.toLowerCase() && y === y.toUpperCase() ? 1 : x.localeCompare(y))).join('');
      cells.push(geno);
      counts[geno] = (counts[geno] || 0) + 1;
    }
  }
  return { g1, g2, cells, counts };
}

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

export function simulateDrift(p0, ne, generations = 50) {
  const series = [p0];
  let p = p0;
  const alleles = Math.max(10, ne * 2);
  for (let g = 1; g <= generations; g++) {
    let countA = 0;
    for (let i = 0; i < alleles; i++) {
      if (Math.random() < p) countA++;
    }
    p = countA / alleles;
    series.push(Number(p.toFixed(3)));
  }
  return series;
}
