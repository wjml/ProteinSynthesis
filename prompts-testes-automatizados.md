# Prompts para Testes Automatizados — Protein Synthesis

10 prompts para criar uma suíte de testes Playwright completa e robusta.
Ordem recomendada: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10.

---

## Prompt 1 — Setup da infraestrutura de testes

```
Instale e configure o Playwright para testes no projeto Protein Synthesis.

Requisitos:
1. Instalar @playwright/test como devDependency
2. Criar playwright.config.js na raiz com:
   - 3 projetos: desktop (1440×900), tablet (768×1024), mobile (375×667)
   - Todos os 3 modos: claro e escuro (6 variações no total)
   - Timeout global: 30s por teste
   - Retry: 1 vez em caso de falha
   - Reporters: 'list' + 'html' (para abrir relatório visual)
   - BaseURL: http://localhost:8080
   - Screenshots: 'on' (capturar em todo teste, não só em falha)
   - Trace: 'retain-on-failure'

3. Criar pasta tests/ com estrutura:
   tests/
     fixtures/       # dados de teste compartilhados
     helpers/         # funções auxiliares
     specs/           # os testes propriamente ditos
     screenshots/     # screenshots gerados

4. Criar tests/helpers/setup.js com:
   - Função startServer() que sobe o server.js antes dos testes
   - Função stopServer() que derruba ao final
   - Configuração de collectCoverage (opcional)
   - beforeAll/afterAll globais

5. Adicionar script no package.json:
   "test": "npx playwright test"
   "test:report": "npx playwright show-report"

6. Criar tests/fixtures/pages.js com lista de TODAS as páginas:
   - Cada página: { id, title, path, hasTheory, hasLab }
   - Teorias: mendel-theory, pedigree-theory, popgen-theory, karyotype-theory,
     dna, rna, aminoacids, diseases
   - Laboratórios: mendel-lab, pedigree-lab, popgen-lab, karyotype-lab, app (simulador)
   - Outras: quiz, app-info, feedback

Validação:
   npx playwright test --list  (lista todos os testes, mesmo vazios)
   npx playwright test --project=desktop  (roda só desktop)
```

## Prompt 2 — Testes de navegação e estrutura

```
Crie testes para validar a navegação completa do app.

Arquivo: tests/specs/navigation.spec.js

Testes:

1. "Sidebar contém todos os itens esperados"
   - Verificar que os 3 collapsibles existem (Genética Clássica, Molecular, Simuladores)
   - Verificar itens não-colapsáveis (Modo Desafio, Sobre, Feedback, tema)
   - Screenshot da sidebar inteira

2. "Cada página carrega sem erros de console"
   - Para cada página em pages.js:
     a. Clica no item da sidebar
     b. Aguarda 500ms para transição
     c. Verifica se .content.{id}.active existe
     d. Verifica console.errors === 0
     e. Screenshot da página
   - CRITÉRIO: 0 erros de console, 0 page errors

3. "Título da página é atualizado"
   - Para cada página, verificar document.title
   - Exemplo: "DNA | Protein Synthesis"

4. "Transição suave entre páginas"
   - Medir tempo entre clique e .active visível
   - CRITÉRIO: < 500ms para 95% das transições

5. "Botão Voltar à Teoria funciona"
   - Em cada laboratório, clicar "Ver teoria de..."
   - Verificar que navegou para a página de teoria correta

6. "Navegação por teclado"
   - Tab entre itens da sidebar
   - Enter para ativar
   - Verificar foco visível (focus-visible)

Critérios de aprovação:
   - 100% das páginas carregam sem erros
   - Transições < 500ms
   - Título correto em todas as páginas
   - 0 falhas de acessibilidade de navegação
```

## Prompt 3 — Testes do simulador molecular

```
Testes para o simulador molecular (DNA/RNA/transcrição/tradução).

Arquivo: tests/specs/simulator.spec.js

Testes:

1. "Inserir bases A/T/C/G"
   - Clicar em cada botão de base (btn-base.base-A, etc.)
   - Verificar que um input .sequenceChar foi criado
   - Verificar que a base aparece na fita de DNA
   - Verificar que a base complementar aparece no RNA
   - Screenshot após inserir A, T, C, G

2. "Sequência aleatória"
   - Clicar em btn-random
   - Verificar que a fita de DNA tem pelo menos 4 caracteres
   - Verificar que o RNA foi transcrito
   - Verificar que aminoácidos aparecem
   - CRITÉRIO: output-aminoacids não vazio

3. "Limpar sequência"
   - Inserir algumas bases, clicar "Limpar tudo"
   - Verificar que DNA ficou vazio

4. "Tradução correta"
   - Inserir TAC (início) + 3 códons + ATT (stop)
   - Verificar que a tradução produziu aminoácidos
   - Conferir que o primeiro aminoácido é Metionina (MET)

5. "Contadores funcionam"
   - Inserir uma sequência
   - Verificar que codon-counter > 0
   - Verificar que aminoacid-counter > 0
   - Verificar que gc-counter mostra percentual

6. "Fita complementar"
   - Clicar em toggle-complementary-strand
   - Verificar que .complementary-strand-row ficou visível
   - Verificar que .complementChar foram criados

7. "Copiar/colar sequência"
   - Inserir uma base simulando colagem (testar pasta handler)
   - Verificar se a sequência foi inserida

8. "Zoom não quebra layout"
   - Aplicar zoom no navegador (CTRL+/CTRL-)
   - Verificar que .sequence não extravasa o container
   - Screenshot com zoom 100%, 150%, 200%

Critérios:
   - 100% das operações funcionam
   - Contadores precisos (soma dos valores = total de bases)
   - GC ratio entre 0-100%
```

## Prompt 4 — Testes do Quiz (Modo Desafio)

```
Testes completos para o Modo Desafio (quiz).

Arquivo: tests/specs/quiz.spec.js

Testes:

1. "Setup do quiz carrega"
   - Navegar para quiz
   - Verificar botões de modo (Sobrevivência/Prática)
   - Verificar chips de dificuldade
   - Verificar chips de categoria
   - Screenshot da tela de setup

2. "Selecionar configurações"
   - Clicar em "Prática"
   - Clicar em "Fácil"
   - Desmarcar todas as categorias exceto "Genética Molecular"
   - Verificar que apenas 1 chip de categoria está ativo

3. "Iniciar quiz"
   - Configurar: Sobrevivência + Todas + 1 categoria
   - Clicar "Começar Desafio"
   - Verificar que quiz-setup desapareceu (display:none)
   - Verificar que quiz-question-area apareceu
   - Screenshot da primeira pergunta

4. "Responder perguntas (3 rodadas)"
   - Encontrar botões .quiz-option
   - Clicar no primeiro
   - Verificar que feedback apareceu
   - Verificar que explanation apareceu
   - Aguardar e clicar em "Próxima" (se houver) ou avançar
   - Repetir por 3 perguntas
   - Screenshot após cada resposta

5. "Placar funciona"
   - Verificar que quiz-score atualizou
   - Verificar que o valor é numérico e > 0

6. "Game over ao errar no survival"
   - No modo sobrevivência, errar de propósito
   - Verificar que quiz-gameover apareceu
   - Verificar que o placar final é mostrado
   - Screenshot da tela de game over

7. "Recorde persiste (localStorage)"
   - Anotar o score atual
   - Recarregar a página
   - Verificar se o quiz-best manteve o valor
   - CRITÉRIO: localStorage.getItem('proteinSynthesis.quizBestScore') === score anterior

8. "Todas as categorias de pergunta"
   - Iniciar quiz com cada categoria individualmente
   - Verificar que uma pergunta é gerada (não quebra)
   - Categorias: molecular, mendelian, population, pedigree, karyotype
   - 1 pergunta por categoria = 5 testes

Critérios:
   - 0 erros de console em qualquer cenário
   - Score sempre ≥ 0
   - Recorde persiste entre reloads
   - Todas as 5 categorias geram perguntas válidas
```

## Prompt 5 — Testes dos laboratórios (Mendel, PopGen, Heredogramas, Cariótipo)

```
Testes para os 4 laboratórios de genética.

Arquivo: tests/specs/labs.spec.js

Testes:

1. "Mendel — Cruzamento mono-híbrido"
   - Navegar para mendel-lab
   - Aba "Construtor de Cruzamentos"
   - Selecionar "Mono-híbrido"
   - Genitor 1: Heterozigoto, Genitor 2: Heterozigoto
   - Clicar "Gerar Quadro de Punnett"
   - Verificar que mendel-results apareceu
   - Verificar proporção 1:2:1 (AA, Aa, aa)
   - Screenshot do resultado

2. "Mendel — Cruzamento di-híbrido"
   - Repetir com "Di-híbrido"
   - Verificar proporção 9:3:3:1
   - CRITÉRIO: 4 fenótipos com contagens corretas

3. "Epistasia"
   - Aba "Epistasia"
   - Selecionar "Epistasia recessiva (9:3:4)"
   - Clicar "Gerar Cruzamento"
   - Verificar resultado com 3 proporções
   - Screenshot

4. "Sistema ABO"
   - Aba "Sistema ABO"
   - Genitor 1: IAi (tipo A), Genitor 2: IBi (tipo B)
   - Clicar "Calcular Cruzamento"
   - Verificar que 4 tipos sanguíneos possíveis
   - Screenshot

5. "PopGen — Frequência recessiva"
   - Navegar para popgen-lab
   - Modo 1: N=1000, afetados=16
   - Clicar "Calcular"
   - Verificar que q² ≈ 0.016, q ≈ 0.126, p ≈ 0.874
   - Screenshot

6. "PopGen — Teste de equilíbrio"
   - Modo 3: AA=1787, Aa=303, aa=10
   - Clicar "Testar"
   - Verificar veredito (equilíbrio ou não)
   - CRITÉRIO: cálculo do qui-quadrado correto

7. "Heredogramas"
   - Navegar para pedigree-lab
   - Selecionar "Autossômica Dominante"
   - Clicar "Gerar Heredograma"
   - Verificar que SVG foi gerado
   - Screenshot

8. "Cariótipo"
   - Navegar para karyotype-lab
   - Selecionar "Síndrome de Down"
   - Clicar "Visualizar"
   - Verificar 47 cromossomos (grid)
   - Screenshot

Critérios:
   - Resultados numéricos dentro de 0.01 de tolerância
   - SVG/elementos visuais renderizados
   - 0 erros de console
```

## Prompt 6 — Testes do gerador de exercícios e exportação

```
Testes para o gerador de exercícios e funcionalidades de export/import.

Arquivo: tests/specs/tools.spec.js

Testes:

1. "Abrir gerador de exercícios"
   - No simulador, clicar "Mais ações" → "Gerar Exercícios"
   - Verificar que exercise-generator-modal abriu
   - Screenshot

2. "Gerar exercícios"
   - Configurar: 5 exercícios, 7 códons
   - Clicar "Gerar"
   - Verificar que 5 itens apareceram na prévia
   - Verificar que cada item tem sequência de DNA e contagem de aminoácidos
   - CRITÉRIO: exercise-gen-preview tem 5 filhos .exercise-gen-item
   - Screenshot

3. "Download de exercícios (.txt)"
   - Clicar "Baixar como .txt"
   - Verificar que um arquivo foi baixado
   - (Playwright: verificar evento de download)

4. "Pré-visualização de impressão"
   - Clicar "Imprimir"
   - Verificar que .printing-exercise-set foi adicionado ao body
   - Verificar que .exercise-print-active foi adicionado
   - Screenshot do modo impressão

5. "Exportar sequência"
   - No simulador, inserir TACGCTA
   - Clicar "Mais ações" → "Exportar"
   - Verificar que export-modal abriu
   - Verificar que export-seq-text contém a sequência
   - Verificar que export-seq-link contém URL com ?seq=
   - Screenshot

6. "Copiar sequência"
   - Clicar "Copiar"
   - Verificar feedback visual (export-feedback)
   - CRITÉRIO: texto do feedback = 'Sequência copiada!'

7. "Importar sequência"
   - Fechar export, abrir import
   - Colar uma sequência (ex: TACGGTATT)
   - Clicar "Carregar"
   - Verificar que a sequência apareceu no simulador
   - Screenshot

8. "Snapshot de sequência"
   - Inserir sequência visualmente distinta
   - Clicar "Baixar imagem"
   - Verificar que um arquivo .svg foi baixado

Critérios:
   - Preview mostra número correto de exercícios
   - Download gera arquivo com nome esperado
   - Export contém a sequência exata
   - Import carrega a sequência corretamente
```

## Prompt 7 — Testes de modo escuro e tema

```
Testes de alternância e persistência do modo escuro.

Arquivo: tests/specs/theme.spec.js

Testes:

1. "Alternar modo escuro"
   - Clicar em theme-toggle
   - Verificar que body.dark-theme foi adicionado
   - Verificar que o ícone mudou para fa-sun
   - Screenshot modo escuro

2. "Alternar de volta para claro"
   - Clicar novamente
   - Verificar que body.dark-theme foi removido
   - Screenshot modo claro

3. "Persistência após reload"
   - Ativar modo escuro
   - Recarregar página
   - Verificar que body.dark-theme ainda está presente
   - CRITÉRIO: localStorage.getItem('theme') === 'dark'

4. "Persistência do modo claro"
   - Voltar para claro, recarregar
   - Verificar que body.dark-theme NÃO está presente

5. "Todas as páginas em modo escuro"
   - Para cada página em pages.js:
     a. Ativar modo escuro
     b. Navegar para a página
     c. Verificar se há elementos com contraste insuficiente
     d. Screenshot
   - CRITÉRIO: nenhum texto tem cor igual ao fundo

6. "Sidebar em modo escuro"
   - Verificar que a sidebar tem contraste adequado
   - Verificar que .button.active é legível
   - Screenshot da sidebar em modo escuro

7. "Simulador em modo escuro"
   - Inserir bases no simulador em modo escuro
   - Verificar que as bases e o fundo têm contraste
   - Screenshot

8. "Quiz em modo escuro"
   - Iniciar quiz em modo escuro
   - Screenshot da pergunta e opções

Critérios:
   - Persistência 100% entre reloads
   - Todas as páginas têm variante escura funcional
   - Contraste mínimo WCAG AA (4.5:1) em todos os textos
```

## Prompt 8 — Testes de responsividade e mobile

```
Testes de layout responsivo e menu mobile.

Arquivo: tests/specs/responsive.spec.js

Testes:

1. "Menu mobile abre e fecha"
   - Viewport: 375×812 (iPhone)
   - Verificar que hamburger está visível
   - Clicar no hamburger
   - Verificar que nav recebeu classe nav-open
   - Verificar que sidebar-backdrop apareceu
   - Screenshot

2. "Navegação no menu mobile"
   - Com o menu aberto, clicar em um item
   - Verificar que o menu fechou
   - Verificar que a página trocou

3. "Fechar com clique no backdrop"
   - Abrir menu
   - Clicar no backdrop (sidebar-backdrop)
   - Verificar que o menu fechou

4. "Fechar com ESC"
   - Abrir menu
   - Pressionar Escape
   - Verificar que o menu fechou

5. "Layout em 3 viewports"
   - Para cada página em pages.js:
     a. Desktop (1440×900) - screenshot
     b. Tablet (768×1024) - screenshot
     c. Mobile (375×667) - screenshot
   - CRITÉRIO: sem overflow horizontal em nenhuma viewport

6. "Toques em mobile"
   - Verificar que botões têm pelo menos 44×44px
   - (Critério WCAG para alvos de toque)

7. "Input de DNA em mobile"
   - No simulador mobile:
     a. Inserir bases
     b. Verificar que o inputmode='none' está presente
     c. Verificar que o teclado virtual não abre

8. "Tabelas em mobile"
   - Navegar para aminoacids (tabela de aminoácidos)
   - Em mobile, verificar se a tabela tem scroll horizontal
   - Screenshot

9. "Rodapé visível"
   - Rolar até o final em mobile e desktop
   - Verificar que footer aparece
   - CRITÉRIO: footer sempre visível ao final do conteúdo

Critérios:
   - 0 overflow em todas as viewports
   - Menu mobile funcional em 100% dos cenários
   - Alvos de toque ≥ 44×44px
```

## Prompt 9 — Testes de acessibilidade (aXe-core)

```
Testes de acessibilidade automatizados com aXe-core.

Arquivo: tests/specs/a11y.spec.js

Requisitos:
   npm install -D @axe-core/playwright

Testes:

1. "Página inicial sem violações críticas"
   - Injetar axe-core na página inicial
   - Rodar análise completa
   - CRITÉRIO: 0 violações de nível crítico ou sério
   - Listar TODAS as violações encontradas, mesmo leves

2. "Contraste em modo claro e escuro"
   - Rodar axe com regra 'color-contrast' em cada página
   - Modo claro e modo escuro
   - CRITÉRIO: 0 violações de contraste

3. "Navegação por teclado"
   - Tab através de toda a interface
   - Verificar que todos os elementos interativos recebem foco
   - Verificar que a ordem de foco é lógica
   - Verificar que skip-link aparece ao primeiro Tab
   - Screenshot do skip-link focado

4. "ARIA labels em todos os controles"
   - Verificar que todo botão de ícone tem aria-label
   - Verificar que todo role="dialog" tem aria-modal="true"
   - Verificar que tabpanels têm role="tabpanel"
   - CRITÉRIO: 0 elementos interativos sem label acessível

5. "Landmarks HTML5"
   - Verificar presença de <nav>, <main>, <footer>
   - Verificar que <nav> tem aria-label
   - Verificar que <h1> existe

6. "Simulador acessível"
   - Verificar que inputs .sequenceChar têm aria-label
   - Verificar que botões de base têm aria-label
   - Verificar que dogma-stepper tem role="navigation"

7. "Quiz acessível"
   - Verificar que opções do quiz são botões (role=button)
   - Verificar que feedback usa aria-live="polite"
   - Verificar que o placar está em elemento com role="status"

8. "Modal acessível"
   - Abrir modal de exportação
   - Verificar que o foco está preso dentro do modal
   - Verificar que Esc fecha o modal
   - Verificar que Tab não sai do modal
   - Screenshot

Relatório:
   - Salvar resultado do axe como JSON
   - Para cada violação: elemento, impacto, descrição, sugestão
   - CRITÉRIO: violações críticas/sérias = 0
```

## Prompt 10 — Testes de regressão visual e relatório final

```
Testes de regressão visual comparando screenshots + relatório consolidado.

Arquivo: tests/specs/regression.spec.js

Requisitos:
   npm install -D pixelmatch pngjs

Testes:

1. "Snapshot de cada página"
   - Para cada página em pages.js:
     a. Navegar, esperar loading completo
     b. Screenshot full-page
     c. Salvar como tests/screenshots/baseline/{page}-{viewport}-{theme}.png

2. "Comparação visual entre temas"
   - Para cada página:
     a. Screenshot em modo claro
     b. Screenshot em modo escuro
     c. Comparar: elementos devem ter posições iguais, cores diferentes
     d. CRITÉRIO: diferença de pixels < 5% (apenas cores mudam)

3. "Comparação entre viewports"
   - Para cada página:
     a. Desktop vs mobile
     b. Verificar que o conteúdo não é truncado
     c. Verificar que elementos não sobrepõem
     d. CRITÉRIO: 0 sobreposição

4. "Regressão vs baseline"
   - Comparar screenshots atuais com baseline armazenado
   - Se diff > 1%, falhar e salvar diff image
   - CRITÉRIO: < 1% de diferença (a menos que mudança intencional)

5. "Teste de loading"
   - Medir tempo de carregamento de cada página
   - CRITÉRIO: < 2s para First Contentful Paint
   - CRITÉRIO: < 500ms para transições entre páginas

6. "Teste de memória"
   - Navegar por todas as páginas 3 vezes
   - Verificar que não há vazamento de memória (performance.memory)

7. "Relatório final consolidado"
   - Gerar relatório JSON com:
     - Total de testes: passaram/falharam
     - Erros de console por página
     - Violações de acessibilidade por página
     - Tempo de carregamento por página
     - Screenshots disponíveis por página
   - Salvar como audit/relatorio-final.json

8. "Gráfico de cobertura"
   - Funções cobertas vs não cobertas
   - Páginas testadas vs não testadas
   - Fluxos testados vs não testados

Formato do relatório:
```json
{
  "data": "2024-01-01",
  "totalTests": 100,
  "passed": 95,
  "failed": 5,
  "coverage": {
    "pages": "100%",
    "simulator": "90%",
    "quiz": "85%",
    "labs": "80%",
    "a11y": "70%"
  },
  "errors": [
    { "test": "Nome do teste", "error": "Descrição", "severity": "alta" }
  ]
}
```

Critérios de aprovação final:
   - ≥ 95% dos testes passando
   - 0 erros de console
   - 0 violações de acessibilidade críticas
   - Tempo de transição < 500ms
   - Tempo de carregamento < 2s
```

---

## Checklist de execução

| Prompt | Testes | Esforço | Depende de |
|---|---|---|---|
| 1 | Setup | ⏱️ 30min | — |
| 2 | Navegação | ⏱️ 1h | Prompt 1 |
| 3 | Simulador | ⏱️ 1h | Prompt 1 |
| 4 | Quiz | ⏱️ 1h | Prompt 1 |
| 5 | Laboratórios | ⏱️ 1h | Prompt 1 |
| 6 | Ferramentas | ⏱️ 45min | Prompt 1 |
| 7 | Modo escuro | ⏱️ 45min | Prompt 1 |
| 8 | Responsividade | ⏱️ 1h | Prompt 1 |
| 9 | Acessibilidade | ⏱️ 1h | Prompt 1 + npm install |
| 10 | Regressão | ⏱️ 1h | Prompts 2-9 |

**Total estimado: ~9h**
