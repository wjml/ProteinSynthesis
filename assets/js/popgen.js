/**
 * popgen.js — Calculadora de Genética Populacional (Hardy-Weinberg)
 *
 * Módulo independente registrado em window.PS.
 * Carregado APÓS script.js.
 */

(function () {
  'use strict';

  var PS = window.PS = window.PS || {};
  var Swal = window.Swal;

  // ─── Lógica pura (Hardy-Weinberg) ────────────────────────────────────

  function hwFromQSquared(qSquared) {
    var q = Math.sqrt(qSquared);
    var p = 1 - q;
    return { p: p, q: q, pSquared: p * p, twoPQ: 2 * p * q, qSquared: q * q };
  }

  function hwFromP(p) {
    var q = 1 - p;
    return { p: p, q: q, pSquared: p * p, twoPQ: 2 * p * q, qSquared: q * q };
  }

  function hwObservedFrequencies(countAA, countAa, countaa) {
    var total = countAA + countAa + countaa;
    var p = (2 * countAA + countAa) / (2 * total);
    var q = (2 * countaa + countAa) / (2 * total);
    return { total: total, p: p, q: q };
  }

  function hwChiSquare(countAA, countAa, countaa) {
    var r = hwObservedFrequencies(countAA, countAa, countaa);
    var expectedAA = r.p * r.p * r.total;
    var expectedAa = 2 * r.p * r.q * r.total;
    var expectedaa = r.q * r.q * r.total;
    var chiSquare =
      Math.pow(countAA - expectedAA, 2) / expectedAA +
      Math.pow(countAa - expectedAa, 2) / expectedAa +
      Math.pow(countaa - expectedaa, 2) / expectedaa;
    return {
      expectedAA: expectedAA, expectedAa: expectedAa, expectedaa: expectedaa,
      chiSquare: chiSquare, criticalValue: 3.841,
      inEquilibrium: chiSquare <= 3.841,
      p: r.p, q: r.q, total: r.total
    };
  }

  // ─── Camada de DOM ───────────────────────────────────────────────────

  var popgen = { els: {}, mode: 'qsquared' };

  function cachePopgenElements() {
    popgen.els = {
      modeQsquaredBtn: document.getElementById('popgen-mode-qsquared'),
      modePBtn: document.getElementById('popgen-mode-p'),
      modeTestBtn: document.getElementById('popgen-mode-test'),
      panelQsquared: document.getElementById('popgen-panel-qsquared'),
      panelP: document.getElementById('popgen-panel-p'),
      panelTest: document.getElementById('popgen-panel-test'),
      results: document.getElementById('popgen-results'),
      alleleFreqs: document.getElementById('popgen-allele-freqs'),
      bar: document.getElementById('popgen-bar'),
      barLegend: document.getElementById('popgen-bar-legend'),
      tableWrap: document.getElementById('popgen-table-wrap'),
      explanation: document.getElementById('popgen-explanation'),
    };
  }

  function setPopgenMode(mode) {
    if (!popgen.els.modeQsquaredBtn) cachePopgenElements();
    popgen.mode = mode;
    var els = popgen.els;
    els.modeQsquaredBtn.classList.toggle('active', mode === 'qsquared');
    els.modePBtn.classList.toggle('active', mode === 'p');
    els.modeTestBtn.classList.toggle('active', mode === 'test');
    els.modeQsquaredBtn.setAttribute('aria-pressed', String(mode === 'qsquared'));
    els.modePBtn.setAttribute('aria-pressed', String(mode === 'p'));
    els.modeTestBtn.setAttribute('aria-pressed', String(mode === 'test'));
    els.panelQsquared.style.display = mode === 'qsquared' ? 'block' : 'none';
    els.panelP.style.display        = mode === 'p' ? 'block' : 'none';
    els.panelTest.style.display     = mode === 'test' ? 'block' : 'none';
    els.results.style.display = 'none';
  }

  function renderPopgenAlleleFreqs(p, q) {
    popgen.els.alleleFreqs.innerHTML =
      '<div class="popgen-stat-card">' +
        '<span class="popgen-stat-label">Alelo dominante (p)</span>' +
        '<span class="popgen-stat-value">' + (p * 100).toFixed(2) + '%</span>' +
      '</div>' +
      '<div class="popgen-stat-card">' +
        '<span class="popgen-stat-label">Alelo recessivo (q)</span>' +
        '<span class="popgen-stat-value">' + (q * 100).toFixed(2) + '%</span>' +
      '</div>';
  }

  function renderPopgenBar(pSquared, twoPQ, qSquared) {
    var segments = [
      { pct: pSquared * 100, color: '#1e88e5', label: 'p\u00B2 \u2014 Homozigoto dominante (AA)' },
      { pct: twoPQ * 100, color: '#f59e0b', label: '2pq \u2014 Heterozigoto, portador (Aa)' },
      { pct: qSquared * 100, color: '#e53935', label: 'q\u00B2 \u2014 Homozigoto recessivo (aa)' }
    ];
    popgen.els.bar.innerHTML = segments.map(function (s) {
      return '<div class="popgen-bar-segment" style="width:' + s.pct + '%;background:' + s.color + ';">' +
        (s.pct >= 8 ? s.pct.toFixed(1) + '%' : '') + '</div>';
    }).join('');
    popgen.els.barLegend.innerHTML = segments.map(function (s) {
      return '<span class="legend-item"><span class="lab-swatch" style="background:' + s.color + ';"></span>' +
        s.label + ' (' + s.pct.toFixed(2) + '%)</span>';
    }).join('');
  }

  function renderPopgenGenotypeTable(pSquared, twoPQ, qSquared, n) {
    var hasN = n && n > 0;
    var html = '<table><thead><tr><th>Gen\u00F3tipo</th><th>Frequ\u00EAncia</th>' +
      (hasN ? '<th>Indiv\u00EDduos esperados</th>' : '') + '</tr></thead><tbody>';
    var rows = [
      ['AA (homozigoto dominante)', pSquared],
      ['Aa (heterozigoto)', twoPQ],
      ['aa (homozigoto recessivo)', qSquared]
    ];
    rows.forEach(function (row) {
      html += '<tr><td>' + row[0] + '</td><td>' + (row[1] * 100).toFixed(2) + '%</td>' +
        (hasN ? '<td>' + Math.round(row[1] * n) + '</td>' : '') + '</tr>';
    });
    html += '</tbody></table>';
    popgen.els.tableWrap.innerHTML = html;
  }

  function calcPopgenFromQSquared() {
    if (!popgen.els.alleleFreqs) cachePopgenElements();
    var n = Number(document.getElementById('popgen-n').value) || 0;
    var affected = Number(document.getElementById('popgen-affected').value) || 0;
    if (n <= 0 || affected < 0 || affected > n) {
      if (typeof Swal !== 'undefined') Swal.fire({ type: 'error', title: 'Valores inv\u00E1lidos', text: 'Confira o tamanho da popula\u00E7\u00E3o e o n\u00FAmero de afetados.' });
      return;
    }
    var qSquared = affected / n;
    var r = hwFromQSquared(qSquared);
    renderPopgenAlleleFreqs(r.p, r.q);
    renderPopgenBar(r.pSquared, r.twoPQ, r.qSquared);
    renderPopgenGenotypeTable(r.pSquared, r.twoPQ, r.qSquared, n);
    var carrierCount = Math.round(r.twoPQ * n);
    popgen.els.explanation.innerHTML = 'Com <strong>' + affected + '</strong> afetados em <strong>' + n + '</strong> ' +
      'indiv\u00EDduos, q\u00B2 = ' + qSquared.toFixed(6) + ', logo q = ' + r.q.toFixed(4) + ' e p = ' + r.p.toFixed(4) + '. ' +
      'Aproximadamente <strong>' + carrierCount + '</strong> indiv\u00EDduos (' + (r.twoPQ * 100).toFixed(2) + '%) devem ser ' +
      'portadores heterozigotos \u2014 n\u00E3o afetados, mas capazes de transmitir o alelo recessivo.';
    popgen.els.results.style.display = 'block';
  }

  function calcPopgenFromP() {
    if (!popgen.els.alleleFreqs) cachePopgenElements();
    var p = Number(document.getElementById('popgen-p-input').value);
    var n = Number(document.getElementById('popgen-n2').value) || 0;
    if (isNaN(p) || p < 0 || p > 1) {
      if (typeof Swal !== 'undefined') Swal.fire({ type: 'error', title: 'Valor inv\u00E1lido', text: 'A frequ\u00EAncia al\u00E9lica p deve ser um n\u00FAmero entre 0 e 1.' });
      return;
    }
    var r = hwFromP(p);
    renderPopgenAlleleFreqs(r.p, r.q);
    renderPopgenBar(r.pSquared, r.twoPQ, r.qSquared);
    renderPopgenGenotypeTable(r.pSquared, r.twoPQ, r.qSquared, n);
    popgen.els.explanation.innerHTML = 'Com p = ' + r.p.toFixed(4) + ', a frequ\u00EAncia do alelo recessivo \u00E9 ' +
      'q = 1 \u2212 p = ' + r.q.toFixed(4) + '. As frequ\u00EAncias genot\u00EDpicas esperadas seguem diretamente de ' +
      'p\u00B2 + 2pq + q\u00B2 = 1.';
    popgen.els.results.style.display = 'block';
  }

  function testPopgenEquilibrium() {
    if (!popgen.els.alleleFreqs) cachePopgenElements();
    var countAA = Number(document.getElementById('popgen-count-aa').value);
    var countAa = Number(document.getElementById('popgen-count-het').value);
    var countaa = Number(document.getElementById('popgen-count-rec').value);
    if ([countAA, countAa, countaa].some(function(v) { return isNaN(v) || v < 0; }) || (countAA + countAa + countaa) === 0) {
      if (typeof Swal !== 'undefined') Swal.fire({ type: 'error', title: 'Valores inv\u00E1lidos', text: 'Digite contagens genot\u00EDpicas v\u00E1lidas.' });
      return;
    }
    var r = hwChiSquare(countAA, countAa, countaa);
    renderPopgenAlleleFreqs(r.p, r.q);
    renderPopgenBar(r.p * r.p, 2 * r.p * r.q, r.q * r.q);
    var html = '<table><thead><tr><th>Gen\u00F3tipo</th><th>Observado</th><th>Esperado (HW)</th></tr></thead><tbody>';
    html += '<tr><td>AA</td><td>' + countAA + '</td><td>' + r.expectedAA.toFixed(1) + '</td></tr>';
    html += '<tr><td>Aa</td><td>' + countAa + '</td><td>' + r.expectedAa.toFixed(1) + '</td></tr>';
    html += '<tr><td>aa</td><td>' + countaa + '</td><td>' + r.expectedaa.toFixed(1) + '</td></tr>';
    html += '<tr><td>Total</td><td>' + r.total + '</td><td>' + r.total + '</td></tr>';
    html += '</tbody></table>';
    popgen.els.tableWrap.innerHTML = html;
    var verdictText = r.inEquilibrium
      ? 'CONSISTENTE com o equil\u00EDbrio de Hardy-Weinberg'
      : 'N\u00C3O CONSISTENTE com o equil\u00EDbrio de Hardy-Weinberg (qui-quadrado = ' + r.chiSquare.toFixed(4) + ' > ' + r.criticalValue + ')';
    popgen.els.explanation.innerHTML = '<span class="' + (r.inEquilibrium ? 'in-equilibrium' : 'out-equilibrium') + '">' + verdictText + '</span>';
    popgen.els.results.style.display = 'block';
  }

  // ─── Registro no PS (sobrescreve as versões do script.js) ─────────────

  PS.setPopgenMode = setPopgenMode;
  PS.calcPopgenFromQSquared = calcPopgenFromQSquared;
  PS.calcPopgenFromP = calcPopgenFromP;
  PS.testPopgenEquilibrium = testPopgenEquilibrium;

})();