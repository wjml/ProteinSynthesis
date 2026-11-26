/**
 * assets/js/beta/bio.js
 * Cliente da API /api/v1 com fallback local para garantir funcionamento offline (PWA).
 */

export const FALLBACK_DISEASES = [
  {
    id: 'sickle',
    gene: 'HBB',
    title: 'Anemia Falciforme (HbS)',
    variant: 'c.20A>T (p.Glu6Val)',
    wildDna: 'TACCACGTGGACTGAGGACTCCTC',
    mutDna: 'TACCACGTGGACTGAGGACACCTC'
  },
  {
    id: 'thalassemia',
    gene: 'HBB',
    title: 'Beta-Talassemia (Stop Prematuro)',
    variant: 'c.16G>T (p.Gly6*)',
    wildDna: 'TACCACGTGGACTGAGGACTCCTC',
    mutDna: 'TACCACGTGGACTGAATCCTCCTC'
  },
  {
    id: 'cftr',
    gene: 'CFTR',
    title: 'Fibrose Cística (ΔF508)',
    variant: 'c.1521_1523delCTT',
    wildDna: 'TACTAGTAGAAACCACAA',
    mutDna: 'TACTAGTAGCCACAA'
  }
];

const CODONS = {
  UUU: { aa: 'F', abbr: 'PHE', name: 'Fenilalanina', type: 'Apolar', mw: 165.19, kd: 2.8 },
  UUC: { aa: 'F', abbr: 'PHE', name: 'Fenilalanina', type: 'Apolar', mw: 165.19, kd: 2.8 },
  UUA: { aa: 'L', abbr: 'LEU', name: 'Leucina', type: 'Apolar', mw: 131.17, kd: 3.8 },
  UUG: { aa: 'L', abbr: 'LEU', name: 'Leucina', type: 'Apolar', mw: 131.17, kd: 3.8 },
  CUU: { aa: 'L', abbr: 'LEU', name: 'Leucina', type: 'Apolar', mw: 131.17, kd: 3.8 },
  CUC: { aa: 'L', abbr: 'LEU', name: 'Leucina', type: 'Apolar', mw: 131.17, kd: 3.8 },
  CUA: { aa: 'L', abbr: 'LEU', name: 'Leucina', type: 'Apolar', mw: 131.17, kd: 3.8 },
  CUG: { aa: 'L', abbr: 'LEU', name: 'Leucina', type: 'Apolar', mw: 131.17, kd: 3.8 },
  AUU: { aa: 'I', abbr: 'ILE', name: 'Isoleucina', type: 'Apolar', mw: 131.17, kd: 4.5 },
  AUC: { aa: 'I', abbr: 'ILE', name: 'Isoleucina', type: 'Apolar', mw: 131.17, kd: 4.5 },
  AUA: { aa: 'I', abbr: 'ILE', name: 'Isoleucina', type: 'Apolar', mw: 131.17, kd: 4.5 },
  AUG: { aa: 'M', abbr: 'MET', name: 'Metionina', type: 'Início / Apolar', mw: 149.21, kd: 1.9 },
  GUU: { aa: 'V', abbr: 'VAL', name: 'Valina', type: 'Apolar', mw: 117.15, kd: 4.2 },
  GUC: { aa: 'V', abbr: 'VAL', name: 'Valina', type: 'Apolar', mw: 117.15, kd: 4.2 },
  GUA: { aa: 'V', abbr: 'VAL', name: 'Valina', type: 'Apolar', mw: 117.15, kd: 4.2 },
  GUG: { aa: 'V', abbr: 'VAL', name: 'Valina', type: 'Apolar', mw: 117.15, kd: 4.2 },
  UCU: { aa: 'S', abbr: 'SER', name: 'Serina', type: 'Polar Neutro', mw: 105.09, kd: -0.8 },
  UCC: { aa: 'S', abbr: 'SER', name: 'Serina', type: 'Polar Neutro', mw: 105.09, kd: -0.8 },
  UCA: { aa: 'S', abbr: 'SER', name: 'Serina', type: 'Polar Neutro', mw: 105.09, kd: -0.8 },
  UCG: { aa: 'S', abbr: 'SER', name: 'Serina', type: 'Polar Neutro', mw: 105.09, kd: -0.8 },
  CCU: { aa: 'P', abbr: 'PRO', name: 'Prolina', type: 'Apolar', mw: 115.13, kd: -1.6 },
  CCC: { aa: 'P', abbr: 'PRO', name: 'Prolina', type: 'Apolar', mw: 115.13, kd: -1.6 },
  CCA: { aa: 'P', abbr: 'PRO', name: 'Prolina', type: 'Apolar', mw: 115.13, kd: -1.6 },
  CCG: { aa: 'P', abbr: 'PRO', name: 'Prolina', type: 'Apolar', mw: 115.13, kd: -1.6 },
  ACU: { aa: 'T', abbr: 'THR', name: 'Treonina', type: 'Polar Neutro', mw: 119.12, kd: -0.7 },
  ACC: { aa: 'T', abbr: 'THR', name: 'Treonina', type: 'Polar Neutro', mw: 119.12, kd: -0.7 },
  ACA: { aa: 'T', abbr: 'THR', name: 'Treonina', type: 'Polar Neutro', mw: 119.12, kd: -0.7 },
  ACG: { aa: 'T', abbr: 'THR', name: 'Treonina', type: 'Polar Neutro', mw: 119.12, kd: -0.7 },
  GCU: { aa: 'A', abbr: 'ALA', name: 'Alanina', type: 'Apolar', mw: 89.09, kd: 1.8 },
  GCC: { aa: 'A', abbr: 'ALA', name: 'Alanina', type: 'Apolar', mw: 89.09, kd: 1.8 },
  GCA: { aa: 'A', abbr: 'ALA', name: 'Alanina', type: 'Apolar', mw: 89.09, kd: 1.8 },
  GCG: { aa: 'A', abbr: 'ALA', name: 'Alanina', type: 'Apolar', mw: 89.09, kd: 1.8 },
  UAU: { aa: 'Y', abbr: 'TYR', name: 'Tirosina', type: 'Polar Neutro', mw: 181.19, kd: -1.3 },
  UAC: { aa: 'Y', abbr: 'TYR', name: 'Tirosina', type: 'Polar Neutro', mw: 181.19, kd: -1.3 },
  UAA: { aa: '*', abbr: 'STOP', name: 'Parada (Ocre)', type: 'Códon de Parada', mw: 0, kd: 0 },
  UAG: { aa: '*', abbr: 'STOP', name: 'Parada (Âmbar)', type: 'Códon de Parada', mw: 0, kd: 0 },
  CAU: { aa: 'H', abbr: 'HIS', name: 'Histidina', type: 'Básico', mw: 155.16, kd: -3.2 },
  CAC: { aa: 'H', abbr: 'HIS', name: 'Histidina', type: 'Básico', mw: 155.16, kd: -3.2 },
  CAA: { aa: 'Q', abbr: 'GLN', name: 'Glutamina', type: 'Polar Neutro', mw: 146.15, kd: -3.5 },
  CAG: { aa: 'Q', abbr: 'GLN', name: 'Glutamina', type: 'Polar Neutro', mw: 146.15, kd: -3.5 },
  AAU: { aa: 'N', abbr: 'ASN', name: 'Asparagina', type: 'Polar Neutro', mw: 132.12, kd: -3.5 },
  AAC: { aa: 'N', abbr: 'ASN', name: 'Asparagina', type: 'Polar Neutro', mw: 132.12, kd: -3.5 },
  AAA: { aa: 'K', abbr: 'LYS', name: 'Lisina', type: 'Básico', mw: 146.19, kd: -3.9 },
  AAG: { aa: 'K', abbr: 'LYS', name: 'Lisina', type: 'Básico', mw: 146.19, kd: -3.9 },
  GAU: { aa: 'D', abbr: 'ASP', name: 'Ác. Aspártico', type: 'Ácido', mw: 133.10, kd: -3.5 },
  GAC: { aa: 'D', abbr: 'ASP', name: 'Ác. Aspártico', type: 'Ácido', mw: 133.10, kd: -3.5 },
  GAA: { aa: 'E', abbr: 'GLU', name: 'Ác. Glutâmico', type: 'Ácido', mw: 147.13, kd: -3.5 },
  GAG: { aa: 'E', abbr: 'GLU', name: 'Ác. Glutâmico', type: 'Ácido', mw: 147.13, kd: -3.5 },
  UGU: { aa: 'C', abbr: 'CYS', name: 'Cisteína', type: 'Polar Neutro', mw: 121.16, kd: 2.5 },
  UGC: { aa: 'C', abbr: 'CYS', name: 'Cisteína', type: 'Polar Neutro', mw: 121.16, kd: 2.5 },
  UGA: { aa: '*', abbr: 'STOP', name: 'Parada (Opala)', type: 'Códon de Parada', mw: 0, kd: 0 },
  UGG: { aa: 'W', abbr: 'TRP', name: 'Triptofano', type: 'Apolar', mw: 204.23, kd: -0.9 },
  CGU: { aa: 'R', abbr: 'ARG', name: 'Arginina', type: 'Básico', mw: 174.20, kd: -4.5 },
  CGC: { aa: 'R', abbr: 'ARG', name: 'Arginina', type: 'Básico', mw: 174.20, kd: -4.5 },
  CGA: { aa: 'R', abbr: 'ARG', name: 'Arginina', type: 'Básico', mw: 174.20, kd: -4.5 },
  CGG: { aa: 'R', abbr: 'ARG', name: 'Arginina', type: 'Básico', mw: 174.20, kd: -4.5 },
  AGU: { aa: 'S', abbr: 'SER', name: 'Serina', type: 'Polar Neutro', mw: 105.09, kd: -0.8 },
  AGC: { aa: 'S', abbr: 'SER', name: 'Serina', type: 'Polar Neutro', mw: 105.09, kd: -0.8 },
  AGA: { aa: 'R', abbr: 'ARG', name: 'Arginina', type: 'Básico', mw: 174.20, kd: -4.5 },
  AGG: { aa: 'R', abbr: 'ARG', name: 'Arginina', type: 'Básico', mw: 174.20, kd: -4.5 },
  GGU: { aa: 'G', abbr: 'GLY', name: 'Glicina', type: 'Apolar', mw: 75.07, kd: -0.4 },
  GGC: { aa: 'G', abbr: 'GLY', name: 'Glicina', type: 'Apolar', mw: 75.07, kd: -0.4 },
  GGA: { aa: 'G', abbr: 'GLY', name: 'Glicina', type: 'Apolar', mw: 75.07, kd: -0.4 },
  GGG: { aa: 'G', abbr: 'GLY', name: 'Glicina', type: 'Apolar', mw: 75.07, kd: -0.4 }
};

function analyzeLocal(rawInput) {
  const dna = String(rawInput).toUpperCase().replace(/U/g, 'T').replace(/[^ATCG]/g, '');
  const compMap = { A: 'T', T: 'A', C: 'G', G: 'C' };
  const rnaMap = { A: 'U', T: 'A', C: 'G', G: 'C' };
  const complementDna = dna.split('').map(b => compMap[b] || b).join('');
  const mrna = dna.split('').map(b => rnaMap[b] || '').join('');
  const protein = [];
  for (let i = 0; i + 2 < mrna.length; i += 3) {
    const c = mrna.slice(i, i + 3);
    const info = CODONS[c];
    if (!info) continue;
    if (info.abbr === 'STOP') break;
    protein.push({ codon: c, ...info, position: protein.length + 1 });
  }
  const gcCount = (dna.match(/[GC]/g) || []).length;
  const gcPercent = dna.length ? Number(((gcCount / dna.length) * 100).toFixed(1)) : 0;
  const mwDa = Number((protein.reduce((a, r) => a + r.mw, 0) - (protein.length > 1 ? (protein.length - 1) * 18.015 : 0)).toFixed(2));
  const gravy = protein.length ? Number((protein.reduce((a, r) => a + r.kd, 0) / protein.length).toFixed(2)) : 0;

  const revComp = complementDna.split('').reverse().join('');
  const revMrna = revComp.split('').map(b => rnaMap[b] || '').join('');
  const orfs = [];
  const scanOrfs = (seqRna, strandLabel, sign, isReverse) => {
    for (let offset = 0; offset < 3; offset++) {
      let best = null;
      for (let i = offset; i + 2 < seqRna.length; i += 3) {
        if (seqRna.slice(i, i + 3) === 'AUG') {
          const p = [];
          let hasStop = false;
          for (let j = i; j + 2 < seqRna.length; j += 3) {
            const info = CODONS[seqRna.slice(j, j + 3)];
            if (!info) continue;
            if (info.abbr === 'STOP') { hasStop = true; break; }
            p.push({ codon: seqRna.slice(j, j + 3), ...info, position: p.length + 1 });
          }
          const ntLen = p.length * 3 + (hasStop ? 3 : 0);
          const fwdStart = isReverse ? Math.max(0, dna.length - (i + ntLen)) : i;
          const fwdEnd = isReverse ? dna.length - i : i + ntLen;
          best = { startNt: i + 1, fwdStart, fwdEnd, lengthAa: p.length, hasStop, mrna: seqRna.slice(i, i + ntLen), protein: p, preview: p.map(x => x.aa).join('') };
          break;
        }
      }
      orfs.push({
        frame: `${sign}${offset + 1}`,
        offset,
        isReverse,
        strand: strandLabel,
        hasOrf: Boolean(best),
        ...(best || { startNt: null, fwdStart: 0, fwdEnd: 0, lengthAa: 0, hasStop: false, mrna: '', protein: [], preview: '' })
      });
    }
  };
  scanOrfs(mrna, "Fita Molde (3'→5')", '+', false);
  scanOrfs(revMrna, "Fita Reversa (5'→3' ←)", '-', true);

  return {
    header: 'Análise Local (Offline)',
    dna,
    complementDna,
    mrna,
    lengthNt: dna.length,
    gcPercent,
    protein,
    biochemistry: {
      lengthAa: protein.length,
      mwDa,
      mwKda: Number((mwDa / 1000).toFixed(2)),
      pI: 6.8,
      netCharge74: 0,
      gravy,
      hydropathyProfile: protein.map(r => ({ pos: r.position, abbr: r.abbr, kd: r.kd }))
    },
    orfs
  };
}

export async function fetchDiseases() {
  try {
    const res = await fetch('/api/v1/catalog/diseases');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items)) return data.items;
    }
  } catch {
    // Offline fallback
  }
  return FALLBACK_DISEASES;
}

export async function analyzeDna(rawSequence) {
  try {
    const res = await fetch('/api/v1/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: rawSequence })
    });
    if (res.ok) return await res.json();
  } catch {
    // Offline fallback
  }
  return analyzeLocal(rawSequence);
}

export function generateRandomCodingDna(codonCount = 6) {
  const sense = Object.keys(CODONS).filter(c => CODONS[c].abbr !== 'STOP');
  const stops = ['UAA', 'UAG', 'UGA'];
  const rnaToDna = { A: 'T', U: 'A', C: 'G', G: 'C' };
  let rna = 'AUG';
  for (let i = 0; i < codonCount - 2; i++) {
    rna += sense[Math.floor(Math.random() * sense.length)];
  }
  rna += stops[Math.floor(Math.random() * stops.length)];
  return rna.split('').map(b => rnaToDna[b]).join('');
}
