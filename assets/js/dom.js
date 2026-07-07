/**
 * dom.js — Navegação e estrutura do menu lateral
 *
 * Encapsulado em uma IIFE, no mesmo padrão de script.js: nada é exposto no
 * escopo global. Antes deste ajuste, `buttons` e `collapsibles` viviam
 * soltos em `window`, enquanto script.js já seguia o padrão de
 * zero-exposição — essa era a maior divergência de estilo entre os dois
 * arquivos JS do projeto.
 *
 * Responsabilidade deste arquivo: alternar páginas visíveis, abrir/fechar
 * os submenus colapsáveis do menu lateral, o menu "Mais ações" do
 * simulador e o alternador de tema claro/escuro. Comportamento específico
 * de cada simulador (ex.: `cloneSequencePrimary`) mora em script.js, não
 * aqui — a linha divisória é "chrome de UI genérico" vs. "lógica de
 * domínio de um simulador".
 */
(function () {
  'use strict';

  const buttons = Array.from(document.getElementsByClassName('button'));
  const collapsibles = Array.from(document.getElementsByClassName('collapsible'));

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {

      // Um botão pode ser (a) um item de navegação normal — mostra uma
      // página de conteúdo — ou (b) um gatilho PURO de submenu colapsável
      // (o "LABORATÓRIO VIRTUAL"), que só abre/fecha a lista de
      // ferramentas e não corresponde a nenhuma página própria.
      const ownSubmenuId = this.getAttribute('data-collapsible');
      const ownSubmenu = ownSubmenuId ? document.getElementById(ownSubmenuId) : null;

      if (!ownSubmenu) {
        const targetPage = this.getAttribute('data-page') || this.id;
        setVisiblePage(targetPage);
      }

      // Um botão também pode morar DENTRO do submenu colapsável de outro
      // botão. Isso precisa manter aquele submenu visível e destacar o
      // botão "pai" correspondente, para a seção parecer "aberta" mesmo
      // quando o item ativo é um dos filhos.
      const parentSubmenu = this.closest('.collapsible');

      // Fecha qualquer OUTRO submenu que não tenha relação com este clique
      // (generalizado para N submenus independentes, não só o primeiro).
      collapsibles.forEach(function (submenu) {
        if (submenu !== ownSubmenu && submenu !== parentSubmenu) {
          submenu.classList.remove('active');
        }
      });

      buttons.forEach(function (btn) {
        btn.classList.remove('active');
      });

      if (ownSubmenu || parentSubmenu) {
        document.getElementsByClassName('empty')[0].classList.add('active');
        if (ownSubmenu) {
          ownSubmenu.classList.add('active');
        }
        if (parentSubmenu) {
          parentSubmenu.classList.add('active');
          const owner = document.querySelector('[data-collapsible="' + parentSubmenu.id + '"]');
          if (owner) owner.classList.add('active');
        }
      } else {
        document.getElementsByClassName('empty')[0].classList.remove('active');
      }

      this.classList.add('active');
    });
  });

  function setVisiblePage(id) {
    document.getElementById('visible-page').getElementsByClassName('active')[0].classList.remove('active');
    document.getElementById('visible-page').getElementsByClassName(id)[0].classList.add('active');
  }

  /**
   * Modo Escuro — alternador no rodapé da barra lateral (antes: Modo
   * Professor, removido). Preferência salva em localStorage; na ausência
   * de uma escolha explícita, respeita prefers-color-scheme do sistema.
   */
  const THEME_STORAGE_KEY = 'proteinSynthesis.theme';
  const themeToggle = document.getElementById('theme-toggle');
  const themeToggleIcon = document.getElementById('theme-toggle-icon');
  const themeToggleLabel = document.getElementById('theme-toggle-label');

  function applyTheme(isDark) {
    document.body.classList.toggle('dark-theme', isDark);
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isDark));
    if (themeToggleIcon) themeToggleIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    // O rótulo descreve a AÇÃO do clique (o tema que você vai ativar), não o estado atual.
    if (themeToggleLabel) themeToggleLabel.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
  }

  let storedTheme = null;
  try {
    storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  } catch (e) {
    // localStorage pode estar indisponível (modo privado, cookies bloqueados); segue sem persistir.
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(storedTheme ? storedTheme === 'dark' : prefersDark);

  if (themeToggle) {
    const toggleTheme = function () {
      const isDark = !document.body.classList.contains('dark-theme');
      applyTheme(isDark);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
      } catch (e) {
        // Sem persistência disponível — o tema ainda funciona nesta sessão.
      }
    };
    themeToggle.addEventListener('click', toggleTheme);
    // <li> não é focável/ativável por teclado por padrão como um <button> seria;
    // role="button" + tabindex já estão no HTML, falta só o Enter/Espaço.
    themeToggle.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleTheme();
      }
    });
  }

  /**
   * Menu "Mais ações" da barra do simulador — comportamento genérico de
   * dropdown (abrir/fechar, clique fora, Esc). Fica aqui, não em script.js,
   * porque não é lógica do simulador: é chrome de UI, igual aos submenus
   * colapsáveis do menu lateral.
   */
  const moreActionsWrap = document.getElementById('more-actions');
  const moreActionsToggle = document.getElementById('more-actions-toggle');
  const moreActionsMenu = document.getElementById('more-actions-menu');

  if (moreActionsWrap && moreActionsToggle && moreActionsMenu) {
    const closeMoreActions = function () {
      moreActionsMenu.hidden = true;
      moreActionsToggle.setAttribute('aria-expanded', 'false');
    };

    moreActionsToggle.addEventListener('click', function (event) {
      event.stopPropagation();
      const willOpen = moreActionsMenu.hidden;
      moreActionsMenu.hidden = !willOpen;
      moreActionsToggle.setAttribute('aria-expanded', String(willOpen));
    });

    // Fecha ao escolher qualquer item, para não cobrir o modal que acabou de abrir.
    moreActionsMenu.addEventListener('click', function (event) {
      if (event.target.closest('.more-actions-item')) closeMoreActions();
    });

    document.addEventListener('click', function (event) {
      if (!moreActionsWrap.contains(event.target)) closeMoreActions();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMoreActions();
    });
  }

})();