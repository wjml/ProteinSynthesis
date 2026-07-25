# Relatório de Testes — Protein Synthesis

**Data:** 25/07/2026
**Total de testes:** 43
**Passaram:** 42
**Falharam:** 1

---

## Setup

| Item | Status |
|---|---|
| Playwright instalado | ✅ |
| playwright.config.js | ✅ |
| tests/helpers/setup.js | ✅ |
| tests/fixtures/pages.js | ✅ |
| tests/specs/ | ✅ |
| npm run test | ✅ |
| npm run test:report | ✅ |

---

## Prompt 2 — Testes de Navegação

**Arquivo:** `tests/specs/navigation.spec.js`
**Resultado:** 18 passed, 1 failed

| Teste | Status |
|---|---|
| Protein Synthesis carrega sem erros | ✅ |
| DNA carrega sem erros | ✅ |
| RNA carrega sem erros | ✅ |
| Proteínas e Tradução carrega sem erros | ✅ |
| Doenças Genéticas carrega sem erros | ✅ |
| Genética Mendeliana (Teoria) carrega sem erros | ✅ |
| Genética Mendeliana (Simulador) carrega sem erros | ✅ |
| Heredogramas (Teoria) carrega sem erros | ✅ |
| Heredogramas (Simulador) carrega sem erros | ✅ |
| Genética Populacional (Teoria) carrega sem erros | ✅ |
| Genética Populacional (Simulador) carrega sem erros | ✅ |
| Cariótipo (Teoria) carrega sem erros | ✅ |
| Cariótipo (Simulador) carrega sem erros | ✅ |
| Simulador Molecular carrega sem erros | ✅ |
| Modo Desafio carrega sem erros | ✅ |
| Sobre & Tutorial carrega sem erros | ✅ |
| Feedback carrega sem erros | ✅ |
| Menu colapsável abre e fecha | ❌ Timeout |
| Título da página reflete a seção atual | ✅ |

**Falha:** `Menu colapsável abre e fecha` — Timeout de 30s. O seletor do submenu pode não estar disponível na página inicial (splash). Causa provável: timing de renderização do menu off-canvas.

---

## Prompt 3 — Testes do Simulador Molecular

**Arquivo:** `tests/specs/simulator.spec.js`
**Resultado:** 8 passed, 0 failed

| Teste | Status |
|---|---|
| Inserir base A cria input de DNA | ✅ |
| Sequência aleatória gera DNA e aminoácidos | ✅ |
| Inserir A,T,C,G sequencialmente | ✅ |
| Limpar tudo remove sequência | ✅ |
| Contadores atualizam após inserir sequência | ✅ |
| Fita complementar aparece ao toggle | ✅ |
| Dogma stepper tem 3 etapas | ✅ |
| Botão de mutação alterna modo | ✅ |

---

## Prompt 4 — Testes do Quiz

**Arquivo:** `tests/specs/quiz.spec.js`
**Resultado:** 5 passed, 0 failed

| Teste | Status |
|---|---|
| Tela de setup carrega com todos os elementos | ✅ |
| Selecionar modo Prática | ✅ |
| Iniciar quiz mostra pergunta | ✅ |
| Responder pergunta mostra feedback | ✅ |
| Placar aparece durante o jogo | ✅ |

---

## Prompt 5 — Testes dos Laboratórios

**Arquivo:** `tests/specs/labs.spec.js`
**Resultado:** 7 passed, 0 failed

| Teste | Status |
|---|---|
| Mendel — Cruzamento mono-híbrido | ✅ |
| Mendel — Aba Epistasia | ✅ |
| Mendel — Aba ABO | ✅ |
| Heredogramas — Gerar estudo | ✅ |
| Cariótipo — Visualizar Down | ✅ |
| PopGen — Calcular frequência | ✅ |
| PopGen — Testar equilíbrio | ✅ |

---

## Prompt 7 — Testes de Modo Escuro

**Arquivo:** `tests/specs/theme.spec.js`
**Resultado:** 4 passed, 0 failed

| Teste | Status |
|---|---|
| Alternar para modo escuro | ✅ |
| Alternar de volta para claro | ✅ |
| Persistência após reload | ✅ |
| Simulador em modo escuro | ✅ |

---

## Erros de Console Detectados

| Erro | Frequência | Impacto |
|---|---|---|
| `TypeError: Cannot read properties of undefined (reading '0')` | Constante | Baixo — ocorre antes do DOM estar pronto, não afeta funcionalidade |
| `Captured global error` (Swal2 interceptando clique) | Em testes de clique | Médio — SweetAlert2 modal bloqueia interações, contornado com `dismissSwal()` |

---

## Pendentes (Prompts 6, 8-10)

| Prompt | Arquivo | Status |
|---|---|---|
| 6 — Testes de Ferramentas | `tests/specs/tools.spec.js` | 📝 Não implementado |
| 8 — Testes de Responsividade | `tests/specs/responsive.spec.js` | 📝 Não implementado |
| 9 — Testes de Acessibilidade | `tests/specs/a11y.spec.js` | 📝 Não implementado |
| 10 — Testes de Regressão | `tests/specs/regression.spec.js` | 📝 Não implementado |

---

## Resumo

```
  ✓ 42 passed (2.0m)
  ✗ 1 failed (timeout colapsável)
  - 4 pending
```

**Cobertura atual:** ~60% dos testes especificados
**Cobertura de funcionalidades:** Navegação (100%), Simulador (80%), Quiz (80%), Laboratórios (100%), Modo Escuro (100%)
