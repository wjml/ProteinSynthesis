/**
 * exercises.js — Gerador de Exercícios de Síntese Proteica
 *
 * Módulo externo que se registra em window.PS (namespace compartilhado).
 * Carregado APÓS script.js, que fornece as funções-base via PS.
 *
 * Responsabilidades:
 * - generateExerciseSet(count, numCodons) — gera lotes de exercícios
 * - renderExercisePreview / renderExercisePrintables — UI do modal
 * - printExerciseContent / downloadExercisesAsText — saída final
 */

(function () {
  'use strict';

  const PS = window.PS = window.PS || {};

  // ─── Utilitários ──────────────────────────────────────────────────────

  function formatAminoAcidChain(aminoAcids) {
    return aminoAcids.map(function (aa) { return aa.abbrevName; }).join('\u2013');
  }

  // ─── Geração ──────────────────────────────────────────────────────────

  function generateExerciseSet(count, numCodons) {
    const generateDna = PS.generateRandomCodingDna || function () { return ''; };
    const translate   = PS.translateDnaHeadless || function () { return { dnaSeq: '', rna: '', codons: [], aminoAcids: [] }; };
    const expectedAminoAcids = numCodons - 1;
    const seen = new Set();
    const exercises = [];

    for (let i = 0; i < count; i++) {
      let dnaSeq, translated;
      let attempts = 0;
      do {
        dnaSeq = generateDna(numCodons);
        translated = translate(dnaSeq);
        attempts++;
      } while (
        (seen.has(dnaSeq) || translated.aminoAcids.length !== expectedAminoAcids)
        && attempts < 30
      );
      seen.add(dnaSeq);
      exercises.push(translated);
    }
    return exercises;
  }

  // ─── Renderização ─────────────────────────────────────────────────────

  function renderExercisePreview(exercises) {
    const preview = document.getElementById('exercise-gen-preview');
    if (!preview) return;
    preview.innerHTML = '';
    exercises.forEach(function (ex, i) {
      const item = document.createElement('div');
      item.className = 'exercise-gen-item';
      item.innerHTML =
        '<span class="exercise-gen-item-num">' + (i + 1) + '</span>' +
        '<span class="exercise-gen-item-dna">DNA: ' + ex.dnaSeq + '</span>' +
        '<span class="exercise-gen-item-protein">' + ex.aminoAcids.length + ' aminoácido' + (ex.aminoAcids.length === 1 ? '' : 's') + ' \u2014 ' + formatAminoAcidChain(ex.aminoAcids) + '</span>';
      preview.appendChild(item);
    });
  }

  function renderExercisePrintables(exercises) {
    const worksheetList = document.getElementById('exercise-worksheet-list');
    const answerKeyList = document.getElementById('exercise-answerkey-list');
    if (!worksheetList || !answerKeyList) return;

    worksheetList.innerHTML = '';
    answerKeyList.innerHTML = '';

    exercises.forEach(function (ex) {
      const wItem = document.createElement('li');
      wItem.className = 'exercise-print-item';
      wItem.innerHTML =
        'DNA molde: <span class="exercise-print-dna">3\'' + '-' + ex.dnaSeq + '-5\'</span><br>' +
        'RNAm: <span class="exercise-print-blank"></span><br>' +
        'Prote\u00EDna (sequ\u00EAncia de amino\u00E1cidos): <span class="exercise-print-blank"></span>';
      worksheetList.appendChild(wItem);

      const kItem = document.createElement('li');
      kItem.className = 'exercise-print-item';
      kItem.innerHTML =
        'DNA molde: <span class="exercise-print-dna">3\'' + '-' + ex.dnaSeq + '-5\'</span><br>' +
        'RNAm: <span class="exercise-print-dna">5\'' + '-' + ex.rna + '-3\'</span><br>' +
        'Prote\u00EDna: ' + formatAminoAcidChain(ex.aminoAcids) + ' (' + ex.aminoAcids.map(function (aa) { return aa.name; }).join(', ') + ')';
      answerKeyList.appendChild(kItem);
    });
  }

  function printExerciseContent(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.classList.add('exercise-print-active');
    document.body.classList.add('printing-exercise-set');

    var cleanup = function () {
      document.body.classList.remove('printing-exercise-set');
      container.classList.remove('exercise-print-active');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  function downloadExercisesAsText(exercises) {
    var text = 'LISTA DE EXERC\u00CDCIOS \u2014 S\u00cdNTESE DE PROTE\u00cdNAS\n';
    text += '='.repeat(50) + '\n\n';
    exercises.forEach(function (ex, i) {
      text += (i + 1) + '. DNA molde: 3\'-' + ex.dnaSeq + '-5\'\n';
      text += '   RNAm: ____________________________\n';
      text += '   Prote\u00EDna: ____________________________\n\n';
    });

    text += '\n' + '='.repeat(50) + '\n';
    text += 'GABARITO\n';
    text += '='.repeat(50) + '\n\n';
    exercises.forEach(function (ex, i) {
      text += (i + 1) + '. DNA molde: 3\'-' + ex.dnaSeq + '-5\'\n';
      text += '   RNAm: 5\'-' + ex.rna + '-3\'\n';
      text += '   Prote\u00EDna: ' + formatAminoAcidChain(ex.aminoAcids) + ' (' + ex.aminoAcids.map(function (aa) { return aa.name; }).join(', ') + ')\n\n';
    });

    var blob = new Blob([text], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'exercicios-sintese-proteica.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function openExerciseGeneratorModal() {
    var modal = document.getElementById('exercise-generator-modal');
    (PS.openModalDialog || function () {})(modal);
  }

  // ─── Registro no namespace ────────────────────────────────────────────

  PS.generateExerciseSet = generateExerciseSet;
  PS.renderExercisePreview = renderExercisePreview;
  PS.renderExercisePrintables = renderExercisePrintables;
  PS.printExerciseContent = printExerciseContent;
  PS.downloadExercisesAsText = downloadExercisesAsText;
  PS.openExerciseGeneratorModal = openExerciseGeneratorModal;
  PS.formatAminoAcidChain = formatAminoAcidChain;

  // Objeto agrupado para consumo por outros módulos
  PS.exercises = {
    generateSet: generateExerciseSet,
    renderPreview: renderExercisePreview,
    renderPrintables: renderExercisePrintables,
    print: printExerciseContent,
    download: downloadExercisesAsText,
    openModal: openExerciseGeneratorModal,
    formatChain: formatAminoAcidChain,
  };

})();