# Auditoria de Qualidade das Ideias das Features — Agente #2

**Projeto:** Recipe Planner (Mise) — Tauri 2 Desktop  
**Público-alvo:** Cozinha profissional / gestão de restauração / pro-sumer culinário  
**Data:** 2026-07-18  
**Âmbito:** Avaliar se as IDEIAS resolvem o problema certo para o público-alvo.

---

## Metodologia

Analisados:
- `PROJECT.md` (1272 linhas) — plano detalhado de features, decisões de produto e roadmap
- `src/router.tsx` — 15 rotas + 1 placeholder
- `src/pages/*.tsx` (15 ficheiros) — implementação de cada página
- Backlog e fases futuras documentadas no PROJECT.md

Cada feature é avaliada em 5 dimensões: (1) nome, (2) problema que resolve, (3) se a ideia é boa com justificação, (4) alternativa melhor se existir, (5) nota 0-10.

---

## Feature #1 — Dashboard

**Problema que resolve:** Um gestor de cozinha precisa de um golpe de vista diário do estado do negócio — valor de stock, alertas de rutura, refeições planeadas para a semana, compras pendentes, atividade recente.

**A ideia é boa?** SIM  
O dashboard é o ponto de entrada obrigatório para qualquer app profissional. Mostra os 4 KPI certos (valor de stock, baixo stock, a expirar, compras pendentes) + pré-visualização semanal + atividade recente + atalhos rápidos. A estrutura de cards navegáveis (clicar leva à respetiva página) é excelente — reduz fricção. Não falta nada essencial.

**Ideia melhor?** Sugestão menor: um KPI de "custo médio por refeição esta semana" fecharia o círculo financeiro. Mas já está muito bom.

**Nota: 9/10**

---

## Feature #2 — Gestão de Ingredientes

**Problema que resolve:** Precisa-se de um catálogo central de ingredientes com nome, unidade de medida, preço por unidade e imagem, para servir de base a receitas, stock e custos.

**A ideia é boa?** SIM  
Catálogo de ingredientes é a base de dados fundamental da app — sem isto nada funciona. Search, CRUD, select de unidades agrupadas por tipo (peso, volume, culinária, contagem) e suporte a imagem são o mínimo indispensável. O quick-create dentro de receitas também está bem pensado.

**Ideia melhor?** O campo `category` (que existia mas foi removido por ser `undefined` em runtime, conforme PROJECT.md) seria útil para agrupar ingredientes por secção (lacticínios, carnes, etc.) — tanto para a lista de compras como para relatórios. Reintroduzir com um enum fixo em vez de texto livre.

**Nota: 8/10**

---

## Feature #3 — Gestão de Receitas

**Problema que resolve:** Criar, editar, catalogar e consultar receitas com ingredientes, quantidades, instruções, tempos de preparação/cozedura, imagem e custo estimado por porção.

**A ideia é boa?** SIM  
É o coração da app. Suporta categorias, escalabilidade de porções (crítico para cozinha profissional), custo estimado por porção no frontend com indicação clara de "aproximado" quando a conversão de unidades é incerta. O formulário de ingredientes com seletor + quantidade + unidade é funcional. Os campos `prep_time_minutes`/`cook_time_minutes` são um toque profissional que faltava.

**Ideia melhor?** O detalhe de receita devia ser uma rota própria (`/receitas/:id`) em vez de uma vista expandida na lista, porque receitas com muitos ingredientes/instruções ficam difíceis de ler inline. O placeholder `ponytail` em `CalendarPage.tsx` (`navigate("/receitas")` em vez de `/receitas/:id`) confirma que isto está por fazer.

**Nota: 8/10**

---

## Feature #4 — Análise de Custos

**Problema que resolve:** Saber quanto custa realmente cada receita, por porção, e que margem permite.

**A ideia é boa?** SIM  
Cálculo de custo com base no `price_per_unit` dos ingredientes, com escalabilidade por porções, slider de margem para sugerir preço de venda, food cost %, e identificação clara de estimativas aproximadas. Isto é *o* problema principal de uma cozinha profissional — se não sabes quanto gastas, não sabes quanto cobras.

**Ideia melhor?** Esta feature devia estar integrada na página da receita, não isolada. Um chef quer ver o custo enquanto edita a receita, não ter de ir a outra página. O facto de estar separada sugere que nasceu como pensamento tardio. Integrar com a RecipesPage devia ser prioritário.

**Nota: 8/10** (descontado pela separação da página de receitas)

---

## Feature #5 — Gestão de Stock / Armazém

**Problema que resolve:** Controlar o stock físico de ingredientes (quantidade atual, mínimo, alertas), registar compras com marca, fornecedor, preço, desconto e ver histórico por ingrediente.

**A ideia é boa?** SIM  
A gestão de stock com suporte multi-marca (3.1, brand per purchase) é uma ideia fantástica e diferenciadora — a maioria das apps de receitas não tem stock, quanto mais stock multi-marca. A barra de nível visual, os status pills (ok/low/out) e o modal de compra com marca, fornecedor, desconto são de nível profissional. O BrandBreakdown (decomposição por marca do stock atual) é um detalhe de excelência.

O modal de compra incluir histórico do ingrediente é inteligente — o utilizador vê o que pagou antes.

**Ideia melhor?** O stock isolado por evento (3.3) está desenhado mas ainda não implementado — para caterers que gerem eventos paralelos é essencial. A prioridade correta está no plano (depois do evento mode).

**Nota: 10/10** — melhor feature da app.

---

## Feature #6 — Lista de Compras

**Problema que resolve:** Gerar e gerir listas de compras a partir do meal planner, com categorias, quantidades, custos estimados, e marcar como comprado (que cria automaticamente um lote de stock — ver 3.1).

**A ideia é boa?** SIM  
Lista de compras com categorias (Hortícolas, Frutas, Carnes, etc.), toggles purchased↔unpurchased, inline editing, custo estimado por item, e integração com stock (mostra quanto já existe em stock) é excelente. O mark-purchased criar automaticamente um lote de stock real (3.1) elimina duplicação de registo.

**Ideia melhor?** A UI é densa (971 linhas de componente, considerado god-component no PROJECT.md). A separação por categorias com collapse/expand está bem, mas a edição inline torna a interface pesada. Um modal de edição dedicado seria mais limpo. Mas a ideia em si é sólida.

**Nota: 9/10**

---

## Feature #7 — Planeamento de Refeições

**Problema que resolve:** Planear o que cozinhar ao longo da semana, por refeição (pequeno-almoço, almoço, jantar, snack), associando receitas a dias.

**A ideia é boa?** SIM  
O meal planner semanal com 4 refeições por dia, datas e seleção de receitas é exatamente o que um profissional precisa para organizar ementas. Gera automaticamente a lista de compras com as quantidades certas. Planos múltiplos (criar um plano para cada semana) é mais flexível que um único calendário.

**Ideia melhor?** O plano devia ter uma pré-visualização de custo total da semana (soma do custo de todas as receitas escaladas). Isso ajudaria o profissional a tomar decisões orçamentais. De resto está muito bem pensado.

**Nota: 9/10**

---

## Feature #8 — Calendário

**Problema que resolve:** Visualizar as refeições planeadas num formato de calendário (mês/semana).

**A ideia é boa?** SIM MAS  
A implementação é boa — vista mês e semana, navegação, dot indicators para almoço/jantar, detalhe ao clicar num dia. O problema é que esta feature sobrepõe-se quase completamente ao Meal Planner. O dashboard já mostra uma pré-visualização semanal. O calendário é bonito mas funcionalmente redundante.

**Ideia melhor?** Fundir com o Meal Planner: o planner devia ser a interface de planeamento visual (drag & drop de receitas para dias), e o calendário ser simplesmente a vista de leitura do mesmo. Separar as duas páginas cria confusão — o utilizador não sabe se deve ir ao "Planeamento" ou ao "Calendário". Manter apenas o planner (vista de grelha semanal editável) e eliminar o calendário como página autónoma.

**Nota: 6/10**

---

## Feature #9 — Modo Evento (Events)

**Problema que resolve:** Um caterer ou chef precisa de gerir receitas e ingredientes específicos para um evento (casamento, festa, catering), separados do catálogo principal, com a possibilidade de promover ao catálogo global depois.

**A ideia é boa?** SIM  
Event mode com snapshot congelado (copiar receita para o evento cria uma cópia independente, não uma referência viva) é a decisão arquitetural certa para o caso de uso. O modelo (a) de stock isolado por evento (cópia de ingredientes, não partilha de stock) é pragmático e evita complexidade desnecessária. A UI em EventsPage + EventDetailPage com suporte a copiar do catálogo, criar de raiz, promover, e registar compras no evento está muito completa.

**Ideia melhor?** A promoção de ingredientes de evento para o catálogo (que arrasta stock e compras) é uma escolha corajosa mas arriscada — o utilizador pode não esperar que o stock viaje com o ingrediente. Um aviso explícito ao promover ("Isto também move o stock atual para o catálogo principal") seria prudente.

**Nota: 10/10** — ideia original, bem executada, decisões arquiteturais acertadas.

---

## Feature #10 — Fornecedores e Cotações

**Problema que resolve:** Gerir fornecedores, contacto e notas, e associar cotações de preço por ingrediente para comparar preços entre fornecedores.

**A ideia é boa?** SIM  
Para uma cozinha profissional é fundamental saber quem vende o quê e a que preço. O histórico de cotações com datas de validade, flag de promoção e associação a ingredientes está bem pensado. O preço médio por fornecedor e a lista de ingredientes que fornece são métricas úteis.

**Ideia melhor?** A comparação lado-a-lado de preços entre fornecedores para o mesmo ingrediente seria o passo lógico seguinte — o dashboard de fornecedores devia highlight "Fornecedor X é 15% mais barato em farinha que o Y". O PROJECT.md confirma que isto está no backlog como "supplier price comparison" e que pode tornar-se redundante com 3.1 — é verdade, o brand multi-nível já dá caminho para isso.

**Nota: 8/10**

---

## Feature #11 — Relatórios

**Problema que resolve:** Análise de custos, desperdício, evolução de stock, estatísticas de refeições e tendências de preços.

**A ideia é boa?** SIM  
Relatórios com abas (custos, desperdício, stock, refeições, preços), KPIs, bar charts e mini bar charts de tendência são o que um gestor de cozinha precisa para tomar decisões informadas. A granularidade temporal (7/30/90/365 dias) é adequada.

**Ideia melhor?** Os relatórios são todos baseados em dados existentes (stock_purchases, meal_plans) — isso é inteligente porque não exige dados extra. Mas um relatório de "ingredientes mais usados" (top N por receita) e "custo por receita ao longo do tempo" seriam adições valiosas. O "waste report" é interessante mas precisa de dados de desperdício que a app ainda não recolhe — é uma feature à espera de instrumentação.

**Nota: 8/10**

---

## Feature #12 — Scanner OCR de Recibos

**Problema que resolve:** Digitalizar recibos de supermercado via fotografia/upload, extrair automaticamente os artigos, quantidades e preços, e importar para stock.

**A ideia é boa?** SIM  
Para uma cozinha profissional, registar compras manualmente é uma tarefa morosa e sujeita a erros. OCR de recibos resolve isto de forma drástica. O tesseract.js client-side (sem enviar dados para servidores) respeita a privacidade/local-first. A UI de revisão linha-a-linha com checkboxes para selecionar o que importar é o compromisso certo entre automatização e controlo.

**Ideia melhor?** A câmara não funciona em desktop Linux (bug conhecido, WebKitGTK) — a app depende de upload manual de fotos. Em mobile (Android/iOS) a câmara nativa via plugin Tauri deve resolver. A decisão de adiar o Vision LLM para depois de utilizadores reais é sensata. O segredo é o parsing IVA (3.5) que já funciona.

**Nota: 9/10** (penalizado pelo bug da câmara, que não é da ideia em si)

---

## Feature #13 — Importação de Receita por URL

**Problema que resolve:** Colar um URL de um site de receitas (NYT Cooking, AllRecipes, etc.) e importar automaticamente nome, ingredientes, instruções, porções e tempos.

**A ideia é boa?** SIM  
É uma feature de paridade competitiva — apps como Paprika e Recipe Keeper já fazem isto. A abordagem de usar schema.org/Recipe JSON-LD (o standard que motores de busca já usam) é inteligente: não precisa de scrapers frágeis por site. O resultado é read-only (nunca grava sem confirmação), o que é o comportamento correto.

**Ideia melhor?** O parsing de quantidades/unidades imperiais é frágil (frações vulgares `½`, unidades como "cup"/"tablespoon") — a correção com `normalize_vulgar_fractions` foi boa, mas a cobertura de formatos continua limitada a sites em inglês. Sites portugueses/comunidade lusófona não foram testados. A longo prazo, um mini LLM local ou tabela de conversão mais completa seriam desejáveis.

**Nota: 7/10** (boa ideia, implementação correta, mas valor duvidoso para o público português — quantos sites de receitas PT têm schema.org/Recipe?)

---

## Feature #14 — Segregação de Artigos por Código de IVA (3.5)

**Problema que resolve:** Um recibo mistura alimentos com não-alimentos (cremes, ração animal, detergentes). O utilizador quer só importar os alimentos como ingredientes, sem ter de desmarcar manualmente os não-alimentos.

**A ideia é boa?** SIM  
Ideia brilhante e muito específica ao mercado português. A descoberta de que as letras `C`/`E`/`I` nos talões portugueses correspondem a taxas de IVA, e que `C` (6%) ≈ alimentar, `E` (23%) ≈ não-alimentar, é um insight de domínio fantástico. A validação com recibos reais do Pingo Doce prova que funciona com tesseract.js atual.

**Ideia melhor?** Só está validado com Pingo Doce (2 recibos). Continente, Lidl, Auchan, Mercadona usam o mesmo formato de IVA? É o risco principal. A prioridade alta que o PROJECT.md atribui ao teste multi-cadeia é a decisão certa.

**Nota: 10/10** — ideia original, resolve um problema real de forma elegante, market-specific.

---

## Feature #15 — i18n PT/EN

**Problema que resolve:** Utilizadores portugueses e ingleses podem usar a app na sua língua.

**A ideia é boa?** SIM  
App com público-alvo português (cozinha profissional PT) mas com potencial de expansão. Ter PT como língua de referência e EN como secundária faz sentido. O code-splitting dinâmico por língua é uma boa prática técnica. O toggle PT/EN no topbar é clean.

**Ideia melhor?** O roadmap de onboarding (escolher língua nativa na primeira entrada) é o passo seguinte lógico. A tradução de vocabulário (unidades, ingredientes) está incompleta — unidades aparecem sempre em PT mesmo com toggle em EN. Isto é um bug visível. Prioridade alta para corrigir.

**Nota: 8/10** (descontado pelo vocabulário de unidades ainda sempre em PT)

---

## Feature #16 — Self-hosting Tesseract.js Assets

**Problema que resolve:** A CSP da app tinha uma exceção para `cdn.jsdelivr.net` porque o tesseract.js descarrega worker/core/lang daí. Self-host fecha esse buraco sem depender da decisão de motor OCR nativo.

**A ideia é boa?** SIM  
Decisão pragmática e bem documentada. Em vez de esperar pela decisão "nativo vs tesseract.js", a equipa fechou o problema de segurança imediatamente. O custo (~37MB no bundle) é aceitável. A remoção do `connect-src` para a CDN está feita.

**Ideia melhor?** Nada a melhorar — a decisão certa no timing certo.

**Nota: 10/10**

---

## Feature #17 — Definições / Configurações

**Problema que resolve:** Configurar língua, tema, densidade, unidades, moeda, sincronização (Turso), e ações de dados (export, report problem, seed demo).

**A ideia é boa?** SIM  
Settings com categorias (general, units, currency, data, sync, about, developer) é o esperado para uma app profissional. O suporte a temas (light/dark/system), densidade (compact/cozy/comfy), formatos de data e moeda é mais completo que muitas apps concorrentes. A secção "Data" com export de uso, report de problema e seed/delete demo data é excelente para suporte e debugging.

**Ideia melhor?** A secção "Sync" (Turso URL + auth token) parece prematura — a app é local-first e não tem backend próprio. Ter os campos na UI sem funcionalidade real pode confundir utilizadores. Ou implementar sync ou remover da UI até estar pronta.

**Nota: 8/10** (sync prematuro penaliza ligeiramente)

---

## Feature #18 — Ajuda

**Problema que resolve:** Documentação integrada de como usar cada módulo.

**A ideia é boa?** SIM  
Página de ajuda com secções por módulo (ingredientes, receitas, stock, compras, planeamento, custos/relatórios) + links úteis (GitHub, Tauri docs). É o mínimo aceitável para uma app profissional — bons utilizadores esperam documentação inline.

**Ideia melhor?** Vídeos/gifs de demonstração ou tooltips contextuais em cada página seriam mais úteis que uma página estática. Mas para um MVP, é suficiente.

**Nota: 6/10** (funcional, mas estática e sem contexto)

---

## Feature #19 — Instrumentação de Uso

**Problema que resolver:** Recolher dados de uso reais (local-only, sem telemetria) para alimentar decisões da Fase de Polishing — política de custo, caminho lista↔recibo, qualidade OCR.

**A ideia é boa?** SIM  
A decisão de armazenar eventos de uso localmente (na própria BD SQLite) em vez de enviar para servidores é ética, pragmática e alinhada com o princípio local-first. A tabela `usage_events` está criada, `problem_reports` e `export_usage_data` estão implementados. Os emissores automáticos foram deliberadamente adiados — decisão correta (não instrumentar sem consumidores).

**Ideia melhor?** O esquema de "reportar problema" com `export_usage_data` que gera um relatório Markdown é inteligente para debugging remoto sem infraestrutura. A exportação manual (botão explícito) garante privacidade.

**Nota: 9/10**

---

## Feature #20 — Distribuição (Fase 4)

**Problema que resolver:** Empacotar a app para distribuição (Linux .deb + AppImage), corrigir paths de dados, self-host assets OCR.

**A ideia é boa?** SIM  
Ter .deb e AppImage como alvos de distribuição Linux cobre a maioria dos utilizadores Ubuntu/Debian e o resto via AppImage. A correção do path duplicado `mise/mise/mise.db` e a migração manual são a abordagem certa para uma app sem instalações reais.

**Ideia melhor?** A dependência de `libfuse2t64` para AppImage é uma falha de UX — utilizadores normais não sabem disto. Ou documentar proeminentemente ou priorizar Flatpak/Snap como alternativa. O .deb como alvo primário é a escolha certa.

**Nota: 7/10** (óbvia mas necessária; o bug do fuse2 é uma dor)

---

## Rating Global

| Feature | Nota |
|---|---|
| Dashboard | 9 |
| Gestão de Ingredientes | 8 |
| Gestão de Receitas | 8 |
| Análise de Custos | 8 |
| Gestão de Stock / Armazém | 10 |
| Lista de Compras | 9 |
| Planeamento de Refeições | 9 |
| Calendário | 6 |
| Modo Evento | 10 |
| Fornecedores e Cotações | 8 |
| Relatórios | 8 |
| Scanner OCR de Recibos | 9 |
| Importação de Receita por URL | 7 |
| Segregação de Artigos por IVA | 10 |
| i18n PT/EN | 8 |
| Self-hosting Tesseract | 10 |
| Definições / Configurações | 8 |
| Ajuda | 6 |
| Instrumentação de Uso | 9 |
| Distribuição | 7 |
| **Média** | **8.25/10** |

### Rating Global da Qualidade das Ideias: 8/10

**Pontos fortes:**

- **Visão profissional clara:** A app não é um recipe manager amador — foca-se em custos, stock multi-marca, fornecedores, eventos e OCR. Isto é distintivo.
- **Decisões de produto bem fundamentadas:** Quase todas as features têm uma secção "Decisão" no PROJECT.md que explica porquê X em vez de Y, com trade-offs conscientes (ex: modelo (a) vs (b) no stock de evento, média ponderada vs outras políticas de custo, snapshot congelado vs partilha viva em eventos).
- **Ideias originais para o mercado PT:** A segregação por código de IVA (3.5) é uma ideia brilhante e específica ao mercado português que nenhuma app concorrente tem.
- **Pragmatismo técnico:** Self-host tesseract.js em vez de esperar por motor nativo, eventos append-only sem escritores até haver consumidores, export local-only sem servidor.
- **No feature creep evidente:** As features foram priorizadas com critério (Fase 0→1→2→3→Polishing→Multi-plataforma→Experimentação).

**Pontos fracos:**

- **Redundância Calendário ↔ Meal Planner:** Duas páginas para a mesma função. O calendário devia ser absorvido pelo planner.
- **Custos isolados das Receitas:** O custo por porção devia estar visível na página de receita, não obrigar a navegar para CustosPage.
- **Importação de URL frágil:** Só funciona com schema.org/Recipe JSON-LD (sites ingleses). Para o mercado PT o valor é limitado. Podia estar mais abaixo na prioridade.
- **Ajuda estática:** Sem tooltips contextuais, dicas de uso ou onboarding interativo.
- **Sync prematuro:** UI de Turso sem funcionalidade real confunde.

**Conclusão:** A qualidade das ideias é muito boa (8/10). O projeto demonstra maturidade de produto invulgar — as decisões são documentadas, os trade-offs são conscientes, e o foco no público-alvo (cozinha profissional) é consistente. As melhores ideias são o stock multi-marca com weighted average cost, o modo evento com isolamento por cópia, e a segregação IVA em recibos portugueses — nenhuma destas é trivial ou copiada de concorrentes. As fragilidades são sobretudo de execução/integração UI, não de conceito.
