/**
 * quiz.js — Modo Desafio (Quiz) de Genética
 *
 * Módulo externo registrado em window.PS.
 * Carregado APÓS script.js, que fornece funções-base e estado via PS.
 *
 * Responsabilidades:
 * - Gerenciamento do ciclo de vida do quiz (iniciar, responder, encerrar)
 * - Geração de perguntas (8 tipos)
 * - UI do painel de quiz e feedback
 */

(function () {
  'use strict';

  var PS = window.PS = window.PS || {};
  var Q = PS.quiz || {}; // estado compartilhado

  // ─── Funções-facade (delegam ao script.js via PS) ────────────────────

  function initQuizUI()           { if (PS.initQuizUI) PS.initQuizUI(); }
  function startQuiz()            { if (PS.startQuiz) PS.startQuiz(); }
  function exitQuiz()             { if (PS.exitQuiz) PS.exitQuiz(); }
  function endQuiz()              { if (PS.endQuiz) PS.endQuiz(); }
  function nextQuestion()         { if (PS.nextQuestion) PS.nextQuestion(); }
  function submitQuizAnswer(v, b) { if (PS.submitQuizAnswer) PS.submitQuizAnswer(v, b); }
  function showQuestion(q)        { if (PS.showQuestion) PS.showQuestion(q); }
  function showFeedback(c)        { if (PS.showFeedback) PS.showFeedback(c); }
  function renderPracticeStats(l) { if (PS.renderPracticeStats) PS.renderPracticeStats(l); }
  function buildQuestionPool(c,d) { return PS.buildQuestionPool ? PS.buildQuestionPool(c, d) : []; }

  // ─── Registro no namespace ────────────────────────────────────────────

  PS.quizFacade = {
    init: initQuizUI,
    start: startQuiz,
    exit: exitQuiz,
    end: endQuiz,
    next: nextQuestion,
    submit: submitQuizAnswer,
    show: showQuestion,
    feedback: showFeedback,
    practiceStats: renderPracticeStats,
    pool: buildQuestionPool,
  };

})();