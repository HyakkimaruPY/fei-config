# R13 — fechamento do builder e compatibilidade de temas

Este checkpoint fecha a cadeia R13 do gerador v6.6.

- `generator.html` usa revisão `builder-aura625-r13`, invalidando o cache R12 do próprio builder.
- `builder/generator.js` usa `aura-generator-r13` ao buscar os templates remotos.
- O fallback de upgrade do Shorts reconhece `shorts-aura-r12`, sobe para `shorts-aura-r13`, injeta o bridge `05-theme-variants-r13.css` quando necessário e garante `data-theme` no bootstrap de templates antigos.
- O modo Standard continua na revisão visual/transport R12 e mantém o fallback de `11-aura-transport-r11.js` + `12-catalog-resilience-r12.js`.
- O status de geração diferencia `Shorts R13` de `Padrão R12`.
- O bridge de temas Shorts não depende mais de `color-mix()`: Graphene, Obsidian, Porcelain, Jade, Aurora e Ember usam tokens RGBA explícitos para controles, superfícies, contraste, progresso e arcos, reduzindo risco em WebViews antigos.

## Contrato preservado

- Arcos: 120 segundos.
- Transporte/playback anterior: preservado.
- Metadados do conteúdo: carregados ao abrir via `get_vod_info`.
- Renderização virtual e redução de renders: preservadas.
- Persistência funcional `srhell:*`: preservada.
- Cache modular `srh66:*`: invalidado por revisão.
