# R13 — auditoria final do gerador v6.6

## Resultado

A R13 fecha a revisão da integração Aura no modo Shorts/chat e confirma que o tema escolhido no gerador chega ao catálogo e ao player.

## Contratos verificados

- O gerador continua gravando `theme: chosenTheme()` dentro de `app-config`.
- O modo Shorts consulta somente VOD/filmes e preserva a seleção de tema ao alternar de modo.
- O template Shorts define `data-theme` antes de injetar CSS/runtime.
- O arquivo compartilhado `themes/<tema>.css` continua sendo a fonte principal de tokens.
- O player Shorts possui uma ponte de tema própria (`05-theme-variants-r13.css`) e não depende mais de preto/cinza fixos para controles e painéis.
- Graphene, Obsidian, Porcelain, Jade, Aurora e Ember têm superfícies/acento/atmosfera próprios no player.
- Porcelain usa controles claros com texto escuro e superfície própria para manter contraste sobre o vídeo.
- Aurora preserva o caráter ciano-violeta em vez de reduzir o player a uma única cor.

## Funcionalidades Shorts/chat mantidas

- Arcos reais de 120 segundos.
- Badge, arco atual, saltos e painel usam a mesma unidade de 120 s.
- Capa e sinopse vêm de `get_vod_info` quando disponíveis.
- Favorito.
- Corte/ajuste (`cover` / `contain`).
- Tela cheia / tela normal.
- Próximo conteúdo.
- Voltar 10 s / play-pause / avançar 10 s.
- Barra de progresso.
- Controles ocultam durante reprodução e reaparecem com interação.
- Compartilhar e controles de perfil/audiência do Aura continuam deliberadamente fora do player gerado.

## Desempenho preservado

- Grade virtual: somente a janela próxima ao viewport permanece renderizada.
- Atualização de scroll agrupada via `requestAnimationFrame`.
- `contain: layout paint style` nos cards.
- Imagens com lazy loading e decode assíncrono.
- Probes de duração limitados à janela de itens visíveis.
- `get_vod_info` para capa/sinopse é feito ao abrir o conteúdo, não em massa para todos os cards.

## App padrão / catálogo

- A UI Aura permanece fora do app padrão.
- R12 de resiliência continua posterior à camada de transporte R11.
- Falhas transitórias de categorias/conteúdo recebem retry.
- O builder não converte silenciosamente falha de `get_vod_categories` em `0 filmes`.
- Uma consulta que continua falhando é indicada como incompleta.

## Cache

- Standard permanece em `aura625-r12` porque não mudou nesta etapa.
- Shorts passa para `shorts-aura-r13`.
- O novo CSS de tema usa a chave da revisão R13, invalidando o cache R12 dos módulos Shorts.
- Chaves de módulos `srh66:*` antigas são descartadas no boot.
- Dados funcionais `srhell:*` (histórico, favoritos, atualização de login/lista e preferência de enquadramento) permanecem preservados.

## Casos extremos revistos

- Tema claro sobre cena escura: controles Porcelain recebem superfície própria.
- API de metadados indisponível: reprodução continua com título/capa básica do item.
- Duração desconhecida: badge continua `…` até o probe concluir.
- Último conteúdo: botão Próximo informa fim da lista sem quebrar o player.
- Fullscreen/orientation API indisponível: o player continua utilizável.
- Atualização da lista não remove o tema original, porque o runtime é mesclado sobre `BASE_CONFIG`.

## Limite de validação

O repositório não possui workflow de CI/browser. A auditoria cobre contratos de código, ordem de carregamento, escopo do diff e casos extremos estáticos; a validação final de reprodução/renderização ainda depende de abrir um HTML gerado em navegador/WebView real com uma conta Xtream válida.
