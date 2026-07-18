# Auditoria de Qualidade Estética — Agente #2

**App:** Recipe Planner (Mise) · Tauri 2 + React/TypeScript  
**Data:** 2026-07-18  
**Rating global:** 6.5 / 10  
**Scope:** Consistência visual, responsividade, dark/light theme, acessibilidade, micro-interações UX, CSS moderno, layout breaks, form states

---

## Sumário Executivo

O sistema de design do Mise tem uma fundação sólida: tokens CSS consistentes,
tema dark/light completo, tipografia coerente com 3 famílias de fontes, e
boa atenção a acessibilidade básica (aria labels, roles, htmlFor). No entanto,
a execução sofre de **dependência excessiva de estilos inline** (especialmente
nas páginas de negócio), **ausência total de media queries** para
responsividade, **falta de focus rings visíveis** para navegação por teclado,
e **inconsistências entre classes CSS definidas e as usadas nos componentes**.

---

## 1. Consistência Visual

### ✅ Pontos Fortes

- Sistema de tokens completo: `--ink`, `--surface`, `--line`, `--ember`, etc.
- Escala de spacing: `--space-1` a `--space-6` (4–32px)
- 3 font families via CSS vars: `--sans` (Hanken Grotesk), `--serif` (Newsreader), `--mono` (IBM Plex Mono)
- `border-radius` tokens: `--radius: 9px`, `--radius-md: 11px`, `--radius-lg: 14px`
- Shadow tokens: `--shadow-sm/md/lg`
- Layer de aliases legacy (`--text-1` → `--ink`, `--border` → `--line`) garante compatibilidade

### ❌ Achados

| Ficheiro | Linha | Problema | Severidade | Sugestão |
|----------|-------|----------|------------|----------|
| `src/styles/theme.css` | 35–58 | Legacy alias layer (~25 vars) duplica o sistema de tokens, criando confusão sobre qual nome usar | Média | Eliminar aliases após migrar todos os consumidores para os tokens primários |
| `src/components/ui/DataTable.tsx` | 19 | Usa `className="data-table"` mas a classe CSS definida é `.table` — DataTable não recebe estilos do theme.css | Alta | Mudar para `className="table"` e usar `.table-wrap` para overflow |
| `src/components/IngredientAvatar.tsx` | 28 | Usa `className="ingredient-avatar"` — classe não existe no theme.css, estilos 100% inline | Média | Definir `.ingredient-avatar` em theme.css com width/height/font-size dinâmicos por CSS var |
| `src/components/ImageUpload.tsx` | 150, 164 | Usa `var(--color-border)` e `var(--color-danger)` — **variáveis que não existem em lado nenhum** | Alta | Substituir por `var(--line)` e `var(--red)` respectivamente |
| `src/components/ui/EmptyState.tsx` | 14 | Usa `var(--text-1)` (alias legacy) em vez de `var(--ink)` (token primário) | Baixa | Usar `var(--ink)` directamente |
| `src/pages/DashboardPage.tsx` | 60–295 | Praticamente **100% dos estilos são inline** — KPI cards, alerts, week panel, activity | Alta | Extrair para classes CSS reutilizáveis em theme.css |
| `src/pages/ShoppingListPage.tsx` | 40–180 | Componentes CategorySection, ShoppingItemRow usam maioritariamente inline styles | Alta | Extrair patterns comuns (linhas de tabela, checkboxes custom) para classes |
| `src/pages/StockPage.tsx` | 41–148 | StockTable, StockModal, PurchaseModal com estilos inline | Média | Migrar para classes `.card`, `.field`, `.table` |
| `src/pages/CostsPage.tsx` | 152–297 | Breakdown table, summary card, approx alert todos inline | Média | Reutilizar classes `.card`, `.table`, `.status-pill` |
| `src/pages/RecipesPage.tsx` | 93–177 | RecipeListCard, RecipeDetail com inline styles | Média | Extrair `.recipe-list-card`, `.recipe-detail` para CSS |
| `src/pages/MealPlannerPage.tsx` | 321–444 | Plan modal e entry modal misturam classes `.field` com inline | Baixa | Padronizar — ou tudo classes ou tudo inline |

---

## 2. Responsividade

### ✅ Pontos Fortes

- `.content` tem `max-width: 1320px` — não escala para além disso
- `.item-grid` usa `repeat(auto-fill, minmax(280px, 1fr))` — adaptativo
- `.table-wrap` com `overflow-x: auto` — tabelas não quebram layout
- Modal usa `max-height: calc(100vh - 48px)` com overflow-y auto
- `min-width: 0` no `.main` previne overflow do flex container

### ❌ Achados

| Ficheiro | Linha | Problema | Severidade | Sugestão |
|----------|-------|----------|------------|----------|
| `src/styles/theme.css` | global | **Zero media queries** no ficheiro inteiro (415 linhas) | Crítica | Adicionar breakpoints para <1024px e <768px |
| `src/pages/DashboardPage.tsx` | 84 | `gridTemplateColumns: "repeat(4, 1fr)"` sem auto-fill — não quebra em janelas estreitas | Alta | Usar `repeat(auto-fill, minmax(200px, 1fr))` |
| `src/pages/DashboardPage.tsx` | 366 | `"1.05fr 1.35fr"` — grid de 2 colunas fixas sem wrap | Alta | Adicionar `@media (max-width: 1024px) { grid-template-columns: 1fr }` |
| `src/pages/DashboardPage.tsx` | 371 | `"repeat(3, 1fr)"` — 3 colunas fixas | Alta | `repeat(auto-fill, minmax(250px, 1fr))` |
| `src/pages/CostsPage.tsx` | 164 | `"1.5fr 1fr"` — não quebra | Média | Wrap em viewports < 900px |
| `src/pages/RecipesPage.tsx` | 289 | `"1.1fr 1fr"` — grid fixa de 2 colunas | Média | Envolver em media query |
| `src/styles/theme.css` | 113 | Sidebar `width: var(--sidebar-w) = 236px` — fixa, não colapsa | Média | Adicionar variante collapsible ou drawer em mobile |
| `src/pages/HelpPage.tsx` | 24 | `repeat(auto-fit, minmax(260px, 1fr))` — **bom exemplo**, único grid responsivo | — | (referência positiva, usado correctamente) |
| `src/styles/theme.css` | 105–108 | `.app { display: flex } .main { flex: 1 }` sem wrap — sidebar + main não empilham | Média | `flex-wrap: wrap` ou media query para empilhar |

---

## 3. Dark/Light Theme

### ✅ Pontos Fortes

- Tokens dark completos em `:root[data-theme="dark"]` — todas as cores têm equivalente escuro
- `theme.ts` suporta 3 modos: light, dark, system
- Contorno para bug do WebKitGTK (`prefers-color-scheme` não funciona no GNOME)
- `theme-color` meta tag com valores para dark/light

### ❌ Achados

| Ficheiro | Linha | Problema | Severidade | Sugestão |
|----------|-------|----------|------------|----------|
| `src/styles/theme.css` | 5–20 | Todas as cores dark/light definidas — **completo, sem falhas** | — | (sem problemas) |
| `src/components/ImageUpload.tsx` | 150, 164 | `var(--color-border)` e `var(--color-danger)` não existem — **vão falhar silenciosamente em dark mode** | Alta | Corrigir variáveis para `var(--line)` e `var(--red)` |
| `src/pages/DashboardPage.tsx` | 241 | Card "ember" no CostsPage com `color: var(--ember-ink)` hardcoded para branco — funciona em dark/light | OK | (válido, cor sobre fundo ember) |
| Global | — | Nenhum componente usa `prefers-color-scheme` directamente — tudo via `data-theme` | OK | Abordagem correcta |

---

## 4. Acessibilidade

### ✅ Pontos Fortes

- `aria-label` em inputs de pesquisa, botões de acção, avatar
- `aria-hidden="true"` em ícones decorativos (Material Symbols, SVGs)
- `role="dialog"` + `aria-modal="true"` nos modais
- `role="alert"` + `aria-live="polite"` nos toasts
- `role="search"` nas search bars
- `role="group"` nos grupos de botões de acção
- `htmlFor`/`id` em todos os label/input pairs
- `lang="pt-PT"` no `<html>`
- `aria-current` implícito via `NavLink` do React Router (classe `active`)
- `aria-pressed` nos botões de toggle (ShoppingListPage)

### ❌ Achados

| Ficheiro | Linha | Problema | Severidade | Sugestão |
|----------|-------|----------|------------|----------|
| `src/styles/theme.css` | 248 | `input:focus { border-color: var(--ember-line) }` — única indicação de focus, **sem outline, sem focus ring** | Crítica | Adicionar `box-shadow: 0 0 0 3px var(--ember-soft)` para focus visível |
| `src/styles/theme.css` | 248 | Select:focus apenas muda `border-color` — mesmo problema | Crítica | Adicionar focus ring consistente |
| `src/styles/theme.css` | 178–181 | `.seg button` sem estilos de focus | Alta | Adicionar `:focus-visible` ring |
| `src/components/Sidebar.tsx` | 60 | `<nav>` sem `role="navigation"` (redundante em HTML5 mas boa prática), falta `aria-label` na sidebar | Baixa | `<nav aria-label={t("nav.ariaLabel")}>` — já tem label, role é implícito |
| `src/components/Sidebar.tsx` | 70–77 | `.sidebar-profile` sem `role` nem `aria-label` | Média | Adicionar `role="contentinfo"` ou `aria-label` |
| `src/components/ui/Modal.tsx` | 30–31 | Modal tem `role="dialog"` e `aria-modal` mas **não tem `aria-labelledby`** ligado ao título | Média | Adicionar `aria-labelledby="modal-title"` e `id="modal-title"` no h2 |
| `src/components/ui/Toast.tsx` | 39 | `pointerEvents: "none"` no container de toasts — pode interferir com leitores de ecrã | Média | Manter pointer-events: none, mas garantir que leitores de ecrã acedem via role="alert" |
| `src/pages/DashboardPage.tsx` | 186–196 | Stepper buttons (+/−) usam caracteres Unicode − e + sem `aria-label` | Média | Adicionar `aria-label={t("common.decrease")}` etc. |
| `src/pages/CostsPage.tsx` | 178–193 | Stepper buttons em CostsPage — mesmos caracteres, sem aria-label | Média | Adicionar aria-labels |
| `src/pages/IngredientsPage.tsx` | 222 | Modal inline (não usa componente Modal) sem `aria-labelledby` | Alta | Usar componente Modal partilhado em vez de duplicar |
| Global | — | **Sem skip-to-content link** | Baixa | Adicionar link "Saltar para conteúdo" |
| Global | — | Sem `prefers-reduced-motion` para animações | Média | Envolver `@keyframes` em `@media (prefers-reduced-motion: no-preference)` |

---

## 5. UX Micro-interactions

### ✅ Pontos Fortes

- `@keyframes fade` — animação suave de entrada nas páginas (translateY + opacity)
- `.animate-spin` para loading spinners
- `@keyframes slideIn` nos toasts
- `backdrop-filter: blur(4px)` no modal backdrop
- `.item-card:hover` — transição de border-color (120ms)
- `.item-actions` fade in no hover
- `.btn-primary:active` — scale(0.98) dá feedback tátil
- Toasts auto-dismiss após 3s
- Loading states com spinner em **todas as páginas** (Dashboard, Ingredients, Stock, etc.)
- Empty states em todas as listas (Ingredients, Stock, ShoppingList, MealPlanner, Events, etc.)

### ❌ Achados

| Ficheiro | Linha | Problema | Severidade | Sugestão |
|----------|-------|----------|------------|----------|
| Global | — | **Sem skeleton loaders** — spinner genérico apenas | Média | Implementar skeleton placeholders para KPIs, tabelas, grids |
| Global | — | Transição do `data-theme` é instantânea — sem transição suave entre modos | Baixa | Adicionar `transition: background-color 200ms, color 200ms` no body |
| `src/components/ui/SearchBar.tsx` | 30 | onChange dispara em cada keystroke — sem debounce | Média | Adicionar debounce de 200ms para evitar re-renders excessivos |
| `src/components/ui/ConfirmDialog.tsx` | 32 | Botão danger usa `className="btn-icon danger"` + `width: auto` inline — hack estilístico | Baixa | Criar classe `.btn-danger` (já existe em theme.css!) e usar directamente |
| `src/components/ui/Modal.tsx` | 15 | Escape handler fecha modal mas **não retorna focus ao elemento trigger** | Média | Guardar `document.activeElement` antes de abrir, restaurar ao fechar |
| `src/components/Toast.tsx` | 25 | setTimeout de 3s fixo — sem pausa em hover | Baixa | Adicionar pausa se rato está sobre o toast |

---

## 6. CSS Moderno

### ✅ Pontos Fortes

- CSS custom properties (variáveis) usadas **em todo o lado** — token system
- `calc()` no modal: `max-height: calc(100vh - 48px)`
- `backdrop-filter: blur()` — glassmorphism no backdrop
- CSS Grid extensivamente usado
- `font-variation-settings` para ícones Material Symbols variáveis
- `scrollbar` estilizado via `::-webkit-scrollbar`

### ❌ Achados

| Ficheiro | Linha | Problema | Severidade | Sugestão |
|----------|-------|----------|------------|----------|
| Global | — | **Uso excessivo de inline styles** em páginas (Dashboard, ShoppingList, StockPage, CostsPage) — cerca de 60% dos estilos são inline | Alta | Migrar patterns repetidos para classes CSS |
| `src/styles/theme.css` | 91–94 | `.text-1`, `.text-2` são úteis mas subutilizados — páginas usam `color: var(--ink)` inline | Baixa | Preferir classes utilitárias |
| `src/styles/theme.css` | 0 | **Sem `@container` queries** — oportunidade para UI mais adaptativa | Baixa | Adicionar container queries nos cards do dashboard |
| Global | — | Sem `@property` para animação de custom properties | Baixa | (nice-to-have) |
| `src/styles/theme.css` | 24–63 | `:root` com muitas definições — podia ser dividido em section comments (já está bem organizado) | OK | (boa organização actual) |

---

## 7. Layout Breaks

### ✅ Pontos Fortes

- `box-sizing: border-box` global
- `min-width: 0` no `.main`
- Modal usa `createPortal` para evitar clipping do `overflow: hidden` no `.main`
- `.main-scroll` com `overflow-y: auto`
- `max-width: 1320px` no `.content`

### ❌ Achados

| Ficheiro | Linha | Problema | Severidade | Sugestão |
|----------|-------|----------|------------|----------|
| `src/styles/theme.css` | 106 | `.main { overflow: hidden }` — pode cortar elementos position:fixed dentro do main | Média | Já mitigado pelo portal do Modal — mas cuidado com futuros fixed elements |
| `src/pages/DashboardPage.tsx` | 84 | 4-column grid pode overflow em ecrãs < 800px (cada card ~180px + gap 16px) | Média | `auto-fill` com minmax ou media query |
| `src/pages/RecipesPage.tsx` | 289 | `gridTemplateColumns: "1.1fr 1fr"` — ingredients + preparation lado a lado, parte de baixo fica vazia se conteúdo é curto | Baixa | Considerar layout vertical em ecrãs pequenos |
| `src/pages/StockPage.tsx` | 136 | `field-row` com `display: flex` sem wrap — inputs podem sobrepor-se | Média | Adicionar `flex-wrap: wrap` em field-row |

---

## 8. Form States

### ✅ Pontos Fortes

- Validação antes de submit em todos os formulários (nome obrigatório, ingredient_id > 0)
- Toast de feedback: sucesso (ok), erro (err), aviso (warn)
- Botões disabled durante loading
- Loading spinners nos botões de save
- `autoFocus` nos inputs de formulário

### ❌ Achados

| Ficheiro | Linha | Problema | Severidade | Sugestão |
|----------|-------|----------|------------|----------|
| Global | — | **Sem inline validation errors** — erros só aparecem em toast, não junto ao campo | Média | Adicionar `<span className="field-error">` junto aos inputs inválidos |
| `src/styles/theme.css` | — | Não existe `.field-error` ou `.field.invalid` no CSS | Média | Adicionar `.field.invalid input { border-color: var(--red); }` |
| `src/styles/theme.css` | — | Não existe `.field-success` para feedback positivo inline | Baixa | Adicionar estilos opcionais |
| `src/pages/IngredientsPage.tsx` | 59 | `handleSave` valida só `name.trim()` — sem feedback visual no campo vazio | Média | Mostrar borda vermelha + mensagem se campo vazio |
| `src/pages/StockPage.tsx` | 121 | `disabled={loading \|\| form.ingredient_id === 0 \|\| form.quantity < 0}` — validação correcta mas sem dica visual de quais campos são obrigatórios | Baixa | Adicionar asterisco ou label "(obrigatório)" |
| `src/components/ImageUpload.tsx` | 76 | Valida tamanho do ficheiro com toast `warn` — boa UX | — | (referência positiva) |
| Global | — | Nenhum formulário mostra `required` nos inputs | Baixa | Adicionar atributo `required` para validação nativa do browser |

---

## Rating Final

| Dimensão | Pontuação | Notas |
|----------|-----------|-------|
| Consistência Visual | 7/10 | Tokens sólidos, mas excesso de inline styles e classes CSS não usadas |
| Responsividade | 4/10 | Zero media queries, grids fixas sem wrap, sidebar fixa |
| Dark/Light Theme | 9/10 | Completo, 2 variáveis quebradas no ImageUpload |
| Acessibilidade | 6/10 | Boas labels/roles/aria, mas falta de focus ring visível é crítica |
| UX Micro-interactions | 6/10 | Boas animações de base, sem skeletons, sem transição de tema |
| CSS Moderno | 7/10 | Custom properties bem usadas, mas ~60% dos estilos são inline |
| Layout Breaks | 6/10 | Overflow mitigado, mas grids não quebram em ecrãs pequenos |
| Form States | 5/10 | Feedback via toast apenas, sem validação inline |

---

## Rating Global: 6.5 / 10

### O que está bem:
- Sistema de tokens CSS excelente e consistente
- Tema dark/light completo e testado (inclusive workaround WebKitGTK)
- Acessibilidade básica implementada (aria, roles, htmlFor)
- Loading states e empty states em todas as páginas
- Modal com portal para evitar clipping

### O que precisa de atenção imediata:
1. **`var(--color-border)` e `var(--color-danger)` no ImageUpload.tsx** — variáveis inexistentes, quebram em runtime
2. **Zero media queries responsivas** — app não funciona abaixo de ~900px
3. **Focus ring ausente** — crítica de acessibilidade para navegação por teclado
4. **Excesso de inline styles nas páginas de negócio** — dificulta manutenção e consistência

### O que precisa de atenção a médio prazo:
5. DataTable não usa classes CSS do theme.css (`data-table` vs `table`)
6. IngredientAvatar sem classe CSS (100% inline)
7. Sem inline validation errors nos formulários
8. Sem skeleton loaders
9. Modal sem `aria-labelledby`
10. Sem `prefers-reduced-motion`

---

## Checklist de Correções Prioritárias

- [ ] CRÍTICO: Corrigir `var(--color-border)` → `var(--line)` em ImageUpload.tsx:150
- [ ] CRÍTICO: Corrigir `var(--color-danger)` → `var(--red)` em ImageUpload.tsx:164
- [ ] CRÍTICO: Adicionar `:focus-visible` ring em todos os inputs e botões em theme.css
- [ ] ALTA: DataTable.tsx:19 usar `className="table"` em vez de `className="data-table"`
- [ ] ALTA: Adicionar media queries para grids do Dashboard, CostsPage, RecipesPage
- [ ] ALTA: Migrar estilos inline do DashboardPage para classes CSS
- [ ] MÉDIA: Adicionar `aria-labelledby` no Modal.tsx
- [ ] MÉDIA: Adicionar `.field.invalid` e `.field-error` no theme.css
- [ ] MÉDIA: Adicionar skeleton loaders para estados de carregamento
- [ ] MÉDIA: Adicionar `prefers-reduced-motion` nas animações

---

*Relatório gerado por Agente #2 de Qualidade Estética.*  
*Baseado em análise estática de 30+ ficheiros (CSS, componentes, páginas).*
