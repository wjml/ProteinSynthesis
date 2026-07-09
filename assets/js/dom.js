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

      // No mobile, o menu é uma gaveta retrátil — depois de escolher uma
      // página, fecha a gaveta automaticamente (função definida mais abaixo).
      // IMPORTANTE: só fecha quando o clique realmente navegou para uma
      // página (!ownSubmenu). Se o botão é um gatilho PURO de submenu
      // colapsável (ex.: "LABORATÓRIO VIRTUAL"), o clique serve só para
      // abrir/fechar a lista de opções — fechar a gaveta aqui bloquearia
      // o usuário de ver e tocar nos itens que acabaram de aparecer.
      if (!ownSubmenu) {
        closeMobileDrawer();
      }
    });

    button.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.click();
      }
    });
  });

  const PAGE_TITLES = {
    'dna': 'DNA',
    'rna': 'RNA',
    'aminoacids': 'Proteínas e Tradução',
    'diseases': 'Doenças Genéticas',
    'app': 'Simulador Molecular',
    'mendel-theory': 'Genética Mendeliana (Teoria)',
    'mendel-lab': 'Genética Mendeliana (Simulador)',
    'pedigree-theory': 'Heredogramas (Teoria)',
    'pedigree-lab': 'Heredogramas (Simulador)',
    'popgen-theory': 'Genética Populacional (Teoria)',
    'popgen-lab': 'Genética Populacional (Simulador)',
    'karyotype-theory': 'Cariótipo (Teoria)',
    'karyotype-lab': 'Cariótipo (Simulador)',
    'quiz': 'Modo Desafio',
    'app-info': 'Sobre & Tutorial',
    'feedback': 'Feedback'
  };

  // Guarda a transição de página pendente (setTimeout do fade). Precisa
  // viver fora de setVisiblePage() para poder ser cancelada por uma
  // chamada seguinte — ver comentário dentro da função.
  let pageTransitionTimer = null;

  function setVisiblePage(id) {
    const container = document.getElementById('visible-page');
    const targetPage = container.querySelector(':scope > .content.' + id);

    // #4 Título dinâmico por página
    const friendlyTitle = PAGE_TITLES[id] || id.replace('-', ' ');
    document.title = friendlyTitle + ' | Protein Synthesis';

    // Cancela uma transição anterior ainda pendente. Sem isso, clicar em
    // dois itens do menu mais rápido do que os 200ms do fade (bem comum
    // navegando normalmente, não só em duplo-clique) fazia o setTimeout do
    // PRIMEIRO clique ativar a página do primeiro clique DEPOIS do
    // setTimeout do segundo já ter ativado a página do segundo — as duas
    // ficavam com .active ao mesmo tempo, sobrepostas na tela.
    if (pageTransitionTimer) {
      clearTimeout(pageTransitionTimer);
      pageTransitionTimer = null;
    }

    // Sempre parte das páginas REALMENTE ativas no DOM neste instante (nunca
    // de uma referência guardada de uma chamada anterior), incluindo
    // qualquer uma que tenha ficado em .page-out por causa do cancelamento
    // acima. Assim, não importa quantos cliques aconteçam em sequência: só a
    // página do clique mais recente termina marcada como .active.
    const otherPages = Array.from(
      container.querySelectorAll(':scope > .content.active, :scope > .content.page-out')
    ).filter(function (page) { return page !== targetPage; });

    // #6 Transição suave (fade)
    if (otherPages.length) {
      otherPages.forEach(function (page) { page.classList.add('page-out'); });
      pageTransitionTimer = setTimeout(function () {
        otherPages.forEach(function (page) { page.classList.remove('active', 'page-out'); });
        if (targetPage) {
          targetPage.classList.add('active');
          // #1 Scroll to top ao trocar de página
          container.scrollTop = 0;
          if (typeof window.observeNewCards === 'function') {
            window.observeNewCards();
          }
        }
        pageTransitionTimer = null;
      }, 200);
    } else {
      if (targetPage) {
        targetPage.classList.add('active');
        container.scrollTop = 0;
        if (typeof window.observeNewCards === 'function') {
          window.observeNewCards();
        }
      }
    }
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
  // Modo claro é o padrão do app. Só entra no modo escuro se o usuário já
  // tiver escolhido isso explicitamente antes (preferência salva). Não
  // seguimos mais prefers-color-scheme do sistema para a primeira visita.
  applyTheme(storedTheme === 'dark');

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

  /**
   * Menu retrátil no mobile — a <nav> inteira (logo + sidebar) desliza como
   * uma gaveta (off-canvas), acionada por um botão de hambúrguer fixo e
   * fechada por um backdrop escurecido, pela tecla Esc, ou ao escolher
   * qualquer item do menu (ver closeMobileDrawer() chamada acima).
   */
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const appNav = document.getElementById('app-sidebar-nav');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');

  function closeMobileDrawer() {
    if (!appNav) return;
    appNav.classList.remove('nav-open');
    if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'false');
    if (sidebarBackdrop) sidebarBackdrop.hidden = true;
  }

  function openMobileDrawer() {
    if (!appNav) return;
    appNav.classList.add('nav-open');
    if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'true');
    if (sidebarBackdrop) sidebarBackdrop.hidden = false;
  }

  if (mobileMenuBtn && appNav) {
    mobileMenuBtn.addEventListener('click', function () {
      const isOpen = appNav.classList.contains('nav-open');
      if (isOpen) closeMobileDrawer(); else openMobileDrawer();
    });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileDrawer);
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMobileDrawer();
  });

  /**
   * Links genéricos de navegação cruzada entre teoria e simulador
   * (atributo data-navigate-to="algum-id-do-menu"). Em vez de duplicar a
   * lógica de troca de página, simplesmente clica no botão correspondente
   * do menu lateral — reaproveitando destaque de item ativo, abertura do
   * submenu "SIMULADORES" etc.
   */
  document.addEventListener('click', function (event) {
    const trigger = event.target.closest('[data-navigate-to]');
    if (!trigger) return;
    const targetId = trigger.getAttribute('data-navigate-to');
    const targetBtn = document.getElementById(targetId);
    if (targetBtn) targetBtn.click();
    // Rola para o topo da página de destino — útil em telas menores, onde
    // o clique pode ter ocorrido no meio de uma página longa.
    const visiblePage = document.getElementById('visible-page');
    if (visiblePage) visiblePage.scrollTop = 0;
  });

  /**
   * Abas de conteúdo genéricas (ex.: Tabela de Aminoácidos / Tabela de
   * Códons, na página de Proteínas). Estrutura esperada:
   *   .content-tabs > .content-tabs-nav > .content-tab-btn[data-tab-target]
   *   .content-tabs > .content-tab-panel[id]
   */
  Array.from(document.getElementsByClassName('content-tab-btn')).forEach(function (tabBtn) {
    tabBtn.addEventListener('click', function () {
      const wrapper = this.closest('.content-tabs');
      if (!wrapper) return;
      const targetId = this.getAttribute('data-tab-target');

      Array.from(wrapper.getElementsByClassName('content-tab-btn')).forEach(function (btn) {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      });
      Array.from(wrapper.getElementsByClassName('content-tab-panel')).forEach(function (panel) {
        panel.classList.remove('active');
        panel.hidden = true;
      });

      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
        targetPanel.hidden = false;
      }
    });
  });

  /**
   * Formulário de Feedback — envia via fetch() para um backend de
   * formulários (Formspree por padrão; ver comentário no HTML sobre como
   * configurar a URL). Substitui o antigo action="mailto:", que dependia de
   * o usuário ter um cliente de e-mail configurado no sistema.
   */
  const feedbackForm = document.getElementById('feedback-form');
  const feedbackStatus = document.getElementById('feedback-status');
  const feedbackSubmitBtn = document.getElementById('feedback-submit-btn');

  if (feedbackForm) {
    feedbackForm.addEventListener('submit', function (event) {
      event.preventDefault();

      const actionUrl = feedbackForm.getAttribute('action') || '';
      if (!actionUrl || actionUrl.indexOf('SEU_FORM_ID_AQUI') !== -1) {
        if (feedbackStatus) {
          feedbackStatus.textContent = 'Formulário ainda não configurado — veja o comentário no HTML (crie uma conta em formspree.io e cole a URL do formulário no atributo "action").';
          feedbackStatus.className = 'feedback-status feedback-status-error';
        }
        return;
      }

      if (feedbackSubmitBtn) feedbackSubmitBtn.disabled = true;
      if (feedbackStatus) {
        feedbackStatus.textContent = 'Enviando...';
        feedbackStatus.className = 'feedback-status';
      }

      fetch(actionUrl, {
        method: 'POST',
        body: new FormData(feedbackForm),
        headers: { 'Accept': 'application/json' }
      }).then(function (response) {
        if (response.ok) {
          if (feedbackStatus) {
            feedbackStatus.textContent = 'Mensagem enviada com sucesso — obrigado pelo feedback!';
            feedbackStatus.className = 'feedback-status feedback-status-success';
          }
          feedbackForm.reset();
        } else {
          throw new Error('Falha no envio');
        }
      }).catch(function () {
        if (feedbackStatus) {
          feedbackStatus.textContent = 'Não foi possível enviar agora. Tente novamente em instantes.';
          feedbackStatus.className = 'feedback-status feedback-status-error';
        }
      }).finally(function () {
        if (feedbackSubmitBtn) feedbackSubmitBtn.disabled = false;
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Melhoria #12 — Revelar cards de informação suavemente via IntersectionObserver
  // ═══════════════════════════════════════════════════════════════════════
  if ('IntersectionObserver' in window) {
    const cardObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    window.observeNewCards = function () {
      document.querySelectorAll('.info-card:not(.is-visible)').forEach(function (card) {
        cardObserver.observe(card);
      });
    };

    // Inicializa a observação nos cards presentes
    window.observeNewCards();
  } else {
    // Fallback para navegadores legados (apenas exibe os cards)
    document.querySelectorAll('.info-card').forEach(function (card) {
      card.classList.add('is-visible');
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Melhoria #18 — Error Boundary Global
  // ═══════════════════════════════════════════════════════════════════════
  window.addEventListener('error', function (event) {
    console.error('Captured global error:', event.error);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        type: 'error',
        title: 'Ops! Ocorreu um erro inesperado',
        text: 'Por favor, recarregue a página. Se o problema persistir, entre em contato pela aba de Feedback.'
      });
    }
  });

})();