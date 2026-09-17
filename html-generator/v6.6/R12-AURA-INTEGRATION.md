# R12 — integração Aura no Shorts/chat

## Escopo

A R12 usa `HyakkimaruPY/aura-reels` como referência apenas para o player Shorts/chat. O app padrão não recebe a interface Aura; nele entram somente correções estruturais de catálogo e invalidação de cache.

## Ideias implementadas em ordem

1. **Arquitetura remota preservada**
   - O HTML final continua sendo um shell compacto com configuração.
   - CSS/JS pesados permanecem no GitHub em `runtime/`.
   - A camada R11 de transporte/CORS permanece intacta e é carregada antes da R12.

2. **Falha intermitente de Filmes/VOD**
   - O builder não converte mais uma falha isolada de `get_vod_categories` silenciosamente em lista vazia.
   - Consultas de categorias recebem tentativas curtas adicionais.
   - Se ainda falharem, a interface informa consulta incompleta.
   - O runtime padrão também repete leituras de categorias/conteúdo em falhas transitórias.

3. **Cache versionado e substituição de módulos antigos**
   - Builder: `builder-aura625-r12`.
   - Standard: `aura625-r12`.
   - Shorts: `shorts-aura-r12`.
   - Chaves antigas `srh66:*` são removidas no boot quando pertencem a revisões anteriores.
   - Persistência funcional em `srhell:*` (login atualizado, histórico, favoritos e preferências) não é apagada.

4. **Arcos de 2 minutos**
   - A unidade lógica passa de 600 s para 120 s.
   - Contagem dos badges usa 120 s.
   - Arco atual usa 120 s.
   - Saltos e painel de arcos usam 120 s.
   - O painel mostra início/fim real de cada arco.

5. **Player Shorts/chat inspirado no Aura**
   - Voltar/sair.
   - Favorito.
   - Alternar enquadramento (`cover` / `contain`).
   - Abrir/fechar painel de arcos.
   - Próximo conteúdo.
   - Tela cheia / tela normal.
   - Voltar 10 s, play/pause, avançar 10 s.
   - Barra de progresso.
   - Controles somem durante reprodução e reaparecem ao interagir.

6. **Capa + sinopse no rodapé do player**
   - Ao abrir um VOD, a R12 consulta `get_vod_info`.
   - Usa capa e sinopse retornadas pela API quando disponíveis.
   - A consulta ocorre ao abrir o conteúdo, não para cada card do catálogo.
   - Isso evita transformar o catálogo em centenas de requisições de metadados.

7. **Renderização mais leve**
   - Mantém a grade virtual existente: apenas linhas próximas ao viewport ficam no DOM.
   - Scroll passa por `requestAnimationFrame`, evitando várias reconstruções da grade no mesmo frame.
   - Cards recebem contenção de layout/pintura.
   - Imagens continuam com lazy loading e decode assíncrono.
   - Probes de duração continuam limitados e só acompanham a janela visível.

## O que não foi portado do Aura

- Compartilhar.
- Perfil/audiência do catálogo.
- Controles específicos da organização interna do Aura que não servem ao player gerado.
- Qualquer UI Aura no app padrão.

## Casos extremos considerados

- API retorna lista vazia temporariamente: há nova leitura antes de aceitar o vazio.
- API falha repetidamente: a falha deixa de parecer uma categoria realmente vazia.
- Browser sem Fullscreen API/orientation lock: o player continua funcional e mostra fallback.
- `get_vod_info` falha: título/capa básica do item permanecem; reprodução não depende da sinopse.
- Duração ainda desconhecida: badge de arcos permanece `…` até o probe concluir.
- Último item da lista: Próximo não fecha o player nem quebra o índice.
- Cache antigo: módulos `srh66:*` de revisões anteriores são descartados, mas histórico/favoritos não.

## Arquivos principais

- `builder/generator.js`
- `generator.html`
- `templates/standard.html`
- `templates/shorts.html`
- `runtime/standard/12-catalog-resilience-r12.js`
- `runtime/shorts/04-aura-player-r12.css`
- `runtime/shorts/06-aura-player-r12.js`
