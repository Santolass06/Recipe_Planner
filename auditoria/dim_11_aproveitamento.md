# Fase 11 — Aproveitamento (Fit vs Potencial)

**Rating: 6/10** — boa base comercial, mas falhas estruturais impedem escala.

## O que está bom (bom aproveitamento do propósito)

| Área | Nota | Porquê |
|------|------|--------|
| Core features (ingredientes, receitas, stock) | **9/10** | O backbone da app está sólido. CRUD completo, weighted average cost funcional, multi-brand stock |
| Event mode (snapshot isolado) | **10/10** | Diferenciação comercial real. Clientes de catering vão pagar por isto |
| Segregação IVA | **9/10** | Feature matadora para o mercado português — ninguém mais faz isto |
| Local-first + Tauri 2 | **9/10** | Zero dependência cloud, privacidade de dados, funciona offline. Escolha certa para o target market |
| i18n (EN/PT) | **8/10** | Mercado português + exportação, cobertura completa |
| Sistema de tokens CSS dark/light | **8/10** | Design system preparado para escala visual |

## O que está a ser mal aproveitado (gaps críticos)

| Área | Nota | Problema |
|------|------|----------|
| Testes | **2/10** | **BLOQUEADOR COMERCIAL.** Sem testes não há confiança para lançar. 21 testes para 21K LOC é insustentável |
| db.rs monolítico | **3/10** | 5825 linhas num ficheiro. Cada nova feature é mais difícil que a anterior |
| OCR | **5/10** | Parsing regex frágil, sem fuzzy matching. Funciona para Pingo Doce, falha nos outros |
| Reports | **5/10** | 40% das abas são stubs (waste, trends). Um cliente abre e vê páginas vazias |
| Performance (N+1) | **4/10** | Com dados reais (100+ receitas, 500+ ingredientes), a app vai ficar lenta |
| Acessibilidade | **4/10** | Inacessível para utilizadores com deficiência visual ou motora |

## Oportunidades (o que fazer melhor)

1. **Extrair db.rs por domínio** — liberta velocidade de desenvolvimento para TODAS as features seguintes
2. **Adicionar testes ao CRUD base** — custo baixo, impacto altíssimo na confiança comercial
3. **Fuzzy matching no OCR** — diferença entre "demo feature" e "produção real"
4. **Completar reports** — waste tracking é feature de venda (cozinhas profissionais desperdiçam muito)
5. **Lazy loading router + cache de dados** — impacto visual imediato na percepção de qualidade

## Conclusão

A app tem o **núcleo certo** para o mercado. As features que distinguem (stock multi-brand, eventos, IVA) estão bem implementadas. O que falta não são novas ideias — é **execução** no que já existe: testes, modularização, performance, e completude das features existentes.

Se o próximo sprint focar apenas:
1. Dividir db.rs
2. Testar CRUD base
3. Completar reports + OCR

A app salta de 6/10 para 8/10 no aproveitamento comercial.
