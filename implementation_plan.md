# Melhorias — ProteinSynthesis para Sala de Aula

Transformar o simulador atual em uma ferramenta didática completa, moderna e intuitiva para o ensino de genética no ensino médio/superior.

---

## Funcionalidades Novas / Melhorias Educacionais

### 1. Tabela de Códons Interativa (nova página)
- Tabela visual 4×4 de todos os 64 códons do RNAm, codificados por cor por aminoácido.
- Clicar em um códon preenche automaticamente o simulador com aquelas bases.
- Destaque de códons de INÍCIO (AUG) e PARADA (UAA, UAG, UGA).

### 2. Simulador — Melhorias de UX críticas
- **Entrada por botões de base** (A, T, C, G) além do teclado: usuários de tablet e touchscreen conseguem usar.
- **Botão "Limpar tudo"** para reiniciar rapidamente.
- **Botão "Sequência aleatória"** para demonstrações rápidas do professor.
- **Contador de códons e aminoácidos** em tempo real visível acima das fitas.
- Correção definitiva do alinhamento DNA / RNAm / Aminoácido (colunas perfeitamente alinhadas via CSS grid, não flex).
- Arquivo de imagem de molécula exibido em tamanho correto (ocupa todo o cartão).

### 3. Modo de Apresentação (Projetor)
- Botão de alternância "🎯 Modo Professor" aumenta fontes e cartões para facilitar visualização em projetor.
- Ícone na barra lateral que aplica classe `presentation-mode` ao body.

### 4. Painel Educacional Lateral nos Aminoácidos
- Ao passar o mouse / clicar em um aminoácido, abre tooltip/sidebar com:
  - Estrutura química resumida
  - Códon(s) que o codificam
  - Tipo (polar, apolar, básico, ácido)
  - Função biológica simplificada

### 5. Seções Educacionais — Conteúdo Enriquecido
- Página **DNA**: adicionar animação SVG da dupla hélice (CSS puro).
- Página **RNA**: adicionar diagrama de transcrição passo a passo.
- Página **Proteínas**: adicionar tabela resumo dos 20 aminoácidos com suas abreviações 1-letra e 3-letras.

---

## UI/UX — Redesign

### Design System
- Paleta estendida com variáveis CSS: cores para cada base, gradientes de fundo suaves.
- Google Font: adicionar `Inter` como fonte principal (mais legível que Roboto em textos longos).
- Animações de entrada de cartões com `@keyframes slideIn`.

### Sidebar
- Adicionar ícones mais descritivos para cada seção.
- Grupo "SIMULADOR" com sublabel descritivo.

### Simulador — Layout
- Layout reformulado: DNA e RNAm ficam em grid com colunas fixas por códon (sem scroll horizontal quebrado).
- Aminoácidos alinhados perfeitamente abaixo de seus códons correspondentes.
- Cards de aminoácidos maiores (120×160px) com imagem ocupando ≥60% do cartão.

---

## Arquivos a Modificar

### `index.html`
- Adicionar nova aba "Tabela de Códons".
- Adicionar botões de base (A/T/C/G) e botões Limpar/Aleatório no simulador.
- Adicionar botão modo professor na sidebar.
- Adicionar contadores de códons/aminoácidos.
- Adicionar tooltip de aminoácido no HTML.

### `assets/style/fixed-elements.css`
- Adicionar variáveis CSS para modo apresentação.
- Melhorar sidebar com ícones e espaçamento.

### `assets/style/pages.css`
- Adicionar estilos da Tabela de Códons.
- Adicionar estilos do tooltip de aminoácido.
- Adicionar `presentation-mode` overrides.

### `assets/style/app.css`
- Refatorar layout do simulador para grid por códon.
- Corrigir tamanho das imagens de aminoácido.
- Adicionar estilos dos botões de entrada rápida (A/T/C/G).
- Adicionar estilos dos contadores.

### `assets/js/dom.js`
- Adicionar lógica para botão modo professor.
- Adicionar lógica para nova aba Tabela de Códons.

### `assets/js/script.js`
- Adicionar função `insertBase(base)` chamada pelos botões de base.
- Adicionar função `clearSequence()`.
- Adicionar função `randomSequence()`.
- Adicionar lógica de atualização dos contadores.
- Adicionar dados dos aminoácidos para tooltip.

---

## Verificação
- Testar entrada por teclado e por botões (A/T/C/G).
- Verificar alinhamento DNA/RNAm/Aminoácido para sequências longas.
- Verificar imagens dos aminoácidos no tamanho correto.
- Verificar modo professor em resolução de projetor (1024×768).
- Verificar Tabela de Códons clicável inserindo no simulador.
