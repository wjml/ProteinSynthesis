/**
 * src/api/bioinformatics.js
 * Motor científico compartilhado para análise molecular no backend (/api/v1).
 * Projetado como módulo puro e escalável (sem estado global).
 */

export const CODON_TABLE = {
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

export const DISEASE_CATALOG = [
  {
    id: 'sickle',
    gene: 'HBB',
    title: 'Anemia Falciforme (HbS)',
    variant: 'c.20A>T (p.Glu6Val)',
    inheritance: 'Autossômica Recessiva',
    wildDna: 'TACCACGTGGACTGAGGACTCCTC',
    mutDna: 'TACCACGTGGACTGAGGACACCTC',
    summary: 'Transversão pontual no códon 6 do gene HBB substitui Ácido Glutâmico (polar ácido) por Valina (apolar), expondo um sítio hidrofóbico que promove polimerização da desoxi-hemoglobina.'
  },
  {
    id: 'thalassemia',
    gene: 'HBB',
    title: 'Beta-Talassemia (Stop Prematuro)',
    variant: 'c.118C>T (p.Gln39*)',
    inheritance: 'Autossômica Recessiva',
    wildDna: 'TACGTGCACCTGACTCCTGAG',
    mutDna: 'TACGTGCACCTGACTATTAG',
    summary: 'Mutação nonsense converte um códon codificante em códon de parada prematuro (UAA/UAG), truncando a síntese da cadeia beta-globina.'
  },
  {
    id: 'cftr',
    gene: 'CFTR',
    title: 'Fibrose Cística (ΔF508)',
    variant: 'c.1521_1523delCTT (p.Phe508del)',
    inheritance: 'Autossômica Recessiva',
    wildDna: 'TACAAAGAAAATATCATT',
    mutDna: 'TACAAAGAAAATATT',
    summary: 'Deleção in-frame de 3 nucleotídeos remove a Fenilalanina na posição 508 do canal de cloreto CFTR, prejudicando seu dobramento no retículo endoplasmático.'
  }
];

const DNA_COMP = { A: 'T', T: 'A', C: 'G', G: 'C' };
const DNA_TO_RNA = { A: 'U', T: 'A', C: 'G', G: 'C' };

export function parseFasta(rawInput = '') {
  const lines = String(rawInput).split(/\r?\n/);
  let header = 'Sequência Sem Título';
  const seqParts = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('>')) {
      header = trimmed.slice(1).trim() || header;
    } else {
      seqParts.push(trimmed.toUpperCase().replace(/U/g, 'T').replace(/[^ATCG]/g, ''));
    }
  }
  return { header, sequence: seqParts.join('') };
}

export function complementDna(dna) {
  return dna.split('').map(b => DNA_COMP[b] || b).join('');
}

export function reverseComplementDna(dna) {
  return complementDna(dna).split('').reverse().join('');
}

export function transcribeTemplate(dna) {
  return dna.split('').map(b => DNA_TO_RNA[b] || '').join('');
}

export function translateRna(rna, offset = 0) {
  const codons = [];
  const protein = [];
  for (let i = offset; i + 2 < rna.length; i += 3) {
    const codon = rna.slice(i, i + 3);
    const info = CODON_TABLE[codon];
    if (!info) continue;
    codons.push({ codon, ...info, startNt: i + 1 });
    if (info.abbr === 'STOP') break;
    protein.push({ codon, ...info, position: protein.length + 1 });
  }
  return { codons, protein };
}

export function findSixFrameOrfs(dna) {
  const fwdRna = transcribeTemplate(dna);
  const revDna = reverseComplementDna(dna);
  const revRna = transcribeTemplate(revDna);
  const frames = [];

  const scan = (rna, strandLabel, sign) => {
    for (let offset = 0; offset < 3; offset++) {
      let bestOrf = null;
      for (let i = offset; i + 2 < rna.length; i += 3) {
        if (rna.slice(i, i + 3) === 'AUG') {
          const { protein, codons } = translateRna(rna, i);
          const hasStop = codons.some(c => c.abbr === 'STOP');
          const lengthAa = protein.length;
          if (!bestOrf || lengthAa > bestOrf.lengthAa) {
            bestOrf = { startNt: i + 1, lengthAa, hasStop, preview: protein.map(p => p.aa).join('') };
          }
          break;
        }
      }
      frames.push({
        frame: `${sign}${offset + 1}`,
        strand: strandLabel,
        hasOrf: Boolean(bestOrf),
        ...(bestOrf || { startNt: null, lengthAa: 0, hasStop: false, preview: '' })
      });
    }
  };

  scan(fwdRna, "Fita Molde (3'→5')", '+');
  scan(revRna, "Fita Reversa", '-');
  return frames;
}

const PKA = {
  N_TERM: 9.69,
  C_TERM: 2.34,
  D: 3.65,
  E: 4.25,
  C: 8.18,
  Y: 10.07,
  H: 6.0,
  K: 10.53,
  R: 12.48
};

export function computeNetCharge(protein, pH = 7.4) {
  if (!protein.length) return 0;
  let charge = 1 / (1 + Math.pow(10, pH - PKA.N_TERM)) - 1 / (1 + Math.pow(10, PKA.C_TERM - pH));
  for (const res of protein) {
    if (res.aa === 'D' || res.aa === 'E' || res.aa === 'C' || res.aa === 'Y') {
      charge -= 1 / (1 + Math.pow(10, PKA[res.aa] - pH));
    } else if (res.aa === 'H' || res.aa === 'K' || res.aa === 'R') {
      charge += 1 / (1 + Math.pow(10, pH - PKA[res.aa]));
    }
  }
  return Number(charge.toFixed(2));
}

export function estimatePI(protein) {
  if (!protein.length) return 0;
  let low = 0;
  let high = 14;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    const c = computeNetCharge(protein, mid);
    if (c > 0) low = mid;
    else high = mid;
  }
  return Number(((low + high) / 2).toFixed(2));
}

export function analyzeSequence(rawInput) {
  const { header, sequence: dna } = parseFasta(rawInput);
  const compDna = complementDna(dna);
  const mrna = transcribeTemplate(dna);
  const { codons, protein } = translateRna(mrna, 0);
  const gcCount = (dna.match(/[GC]/g) || []).length;
  const gcPercent = dna.length ? Number(((gcCount / dna.length) * 100).toFixed(1)) : 0;

  // Massa molecular do peptídeo descontando H2O das ligações peptídicas
  const waterLoss = protein.length > 1 ? (protein.length - 1) * 18.015 : 0;
  const mwDa = Number((protein.reduce((acc, r) => acc + r.mw, 0) - waterLoss).toFixed(2));
  const gravy = protein.length
    ? Number((protein.reduce((acc, r) => acc + r.kd, 0) / protein.length).toFixed(2))
    : 0;

  return {
    header,
    dna,
    complementDna: compDna,
    mrna,
    lengthNt: dna.length,
    gcPercent,
    codons,
    protein,
    biochemistry: {
      lengthAa: protein.length,
      mwDa,
      mwKda: Number((mwDa / 1000).toFixed(2)),
      pI: estimatePI(protein),
      netCharge74: computeNetCharge(protein, 7.4),
      gravy,
      hydropathyProfile: protein.map(r => ({ pos: r.position, abbr: r.abbr, kd: r.kd }))
    },
    orfs: findSixFrameOrfs(dna)
  };
}
