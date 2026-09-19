# HTML Generator v6.6 — guia mandatório de trabalho

Leia este arquivo antes de qualquer tarefa em `html-generator/v6.6`. Ele existe para reduzir leitura de histórico, evitar regressões por arquivos antigos e obrigar diagnóstico/validação antes de publicar. Atualize apenas arquitetura confirmada, invariantes e checkpoints úteis; não transforme este arquivo em um diário de conversa.

## Fonte de verdade e caminho curto

- Projeto: `HyakkimaruPY/fei-config`, branch publicada `main`. Escopo deste guia: `html-generator/v6.6/**` e os workflows que constroem/validam esse projeto.
- Primeiro leia, nesta ordem:
  1. `html-generator/v6.6/Mandatório.md`;
  2. `html-generator/v6.6/dist/r23/manifest.json`;
  3. `html-generator/v6.6/dist/r25/manifest.json` quando a tarefa envolver Shorts;
  4. `html-generator/v6.6/scripts/build-r23.mjs` ou `build-shorts-r25.mjs`, conforme o modo;
  5. só então os módulos ativos envolvidos na mudança.
- O manifesto e o script de build dizem o que realmente entra no bundle. A existência de `generator-r14.js`, `runtime/standard/04-...`, `runtime/shorts/**`, `shorts-r23.html` etc. NÃO significa que esses arquivos estejam ativos.
- Não reconstruir arquitetura a partir de nomes/versionamentos históricos. Buscar primeiro o identificador/função com `rg -n` ou busca de código GitHub e confirmar quem a define, quem chama e quem a sobrescreve.
- Para mudanças pequenas, não carregar todo o repositório nem todo o histórico. Ler o guia + manifesto + build + arquivos diretamente relacionados.
- Se houver divergência entre este guia e os arquivos ativos, os arquivos/build/manifesto atuais vencem; corrija este guia no mesmo checkpoint.

## Ferramentas e método preferido

- Para conteúdo do repositório, usar Git/GitHub; não usar busca web genérica para descobrir código que está no próprio repositório.
- Se houver clone local: `git status`, `git log -5 --oneline`, `rg -n`, `git diff`, `node --check` e os scripts de build são o caminho mais rápido.
- Sem clone/push autenticado, usar o conector GitHub para leitura/escrita e GitHub Actions para build/publicação. Não repetir tentativas de push HTTPS sem credencial.
- Use o navegador/DevTools ou Playwright para comportamento visual/DOM quando disponível. Teste de sintaxe/build não equivale a teste real com um provedor Xtream.
- Pesquisar documentação externa apenas quando a tarefa depender de comportamento de navegador, HLS, TMDB/Xtream ou API que não esteja verificável no código local.
- Nunca imprimir ou registrar credenciais Xtream, chaves privadas, cookies ou URLs contendo usuário/senha.

## Entradas e builders

- `generator.html` é a entrada principal e deve permanecer idêntico a `generator-r23.html`; o build R23 valida essa igualdade.
- Builder principal: `builder/generator-r23-clean.js`.
- Distribuição estável sem Shorts: `generator_distro_no_shorts.html` + `builder/generator-r23-distro-no-shorts.js`. Ela não pode adquirir opção, template ou runtime Shorts por acidente.
- `builder/generator.css` estiliza o gerador. A antiga família separada “Flix/Fixed Style” foi aposentada. Os temas disponíveis são Graphene, Obsidian, Porcelain, Jade, Aurora e Ember.
- O gerador não deve incorporar catálogos nos HTMLs. Ele grava configuração, credenciais e categorias escolhidas; o runtime/catálogo continuam remotos.
- Ao gerar configuração de categoria, preservar `type`, `id` e `name`. O ID evita remapear categorias por nome em toda abertura, especialmente no Shorts.
- Shorts aceita apenas VOD/filmes no gerador. Standard aceita live, VOD e séries.
- “Gerar HTML” só é considerado funcional se o `initUI()` concluir e o handler `el.generate.onclick=generate` for registrado. O erro histórico `$('input[name="theme"]').forEach` quebra a inicialização; a coleção deve usar `$$`.

## Arquitetura ativa — Standard

- Template gerado: `templates/standard-r23.html`.
- Distribuição: `dist/r23/manifest.json` → `standard.js` + `standard.css`.
- O build ativo é `scripts/build-r23.mjs`. Ele parte deliberadamente do core modular `runtime/standard/01.js`, `02.js`, `03.js`, usa um `04-fixes.js` histórico no commit `46b9cd4bbf7d403a31634a4f46417856b6903e5a`, e adiciona apenas os patches leves listados no próprio build.
- CSS Standard atualmente ativo pelo build: `01.css`, `02.css`, `03-fixes.css`, `12-ui-organization-lite.css`, `13-tmdb-enrichment.css`, `14-main-stream-style.css`.
- Patches Standard atualmente ativos: `15-ui-organization-lite.js`, `16-tmdb-enrichment.js`, `17-main-stream-style.js`, além do `04-fixes.js` histórico citado acima.
- Arquivos de Aura/transport/proxy antigos presentes em `runtime/standard` são referência/histórico, salvo se o build passar a listá-los. Não reintroduzi-los “porque parecem mais novos”.
- O bootstrap Standard depende remotamente do repositório: contrato visual compartilhado, manifesto R23, tema e bundles. Essa dependência serve para manutenção/atualização remota; não tratá-la como DRM impossível de remover.
- Temas clássicos compartilham a identidade visual principal inspirada no antigo experimento Flix: hero/flare/organização responsiva. A família Flix separada não deve voltar.
- Graphene é grafite/branco/gelo; não restaurar azul antigo como identidade principal sem pedido explícito.

## Arquitetura ativa — Shorts

- O gerador principal escolhe internamente `templates/shorts-r25.html`; para o usuário a opção é apenas “App Shorts”.
- O Shorts ativo NÃO usa `dist/r23/shorts.*`. O caminho ativo é `runtime/shorts-r25/**` → `scripts/build-shorts-r25.mjs` → `dist/r25/manifest.json` → `dist/r25/shorts.css/js`.
- `dist/r25/manifest.json` declara `architecture: fresh-native-flow-grid` e `legacyShortsImported: false`. Não importar módulos do antigo `runtime/shorts/**` para “corrigir rápido”.
- Catálogo: fluxo normal do DOM + CSS Grid. Não voltar à lista absoluta/virtualizada baseada em índice que gerava capas piscando, overlays deslocando e tela preta clicável.
- Cards do catálogo têm container estável, skeleton interno e imagens lazy. Título/tag “Shorts” não devem ser sobrepostos à capa.
- Player é vertical-first. `object-fit: cover` é o padrão para preencher a tela sem esticar; `contain` é opção do usuário. Em desktop, preservar gramática vertical em vez de virar um player horizontal gigante.
- HLS.js não pertence ao caminho crítico do catálogo: carregar apenas quando reprodução HLS realmente precisar.
- Arcos são de 120 segundos.
- Catálogo usa IDs de categoria gravados pelo gerador. Só remapear por nome como fallback para HTML antigo; normalizar acentos/espaços/símbolos.
- Carregamento é progressivo: primeira categoria respondida pode pintar o catálogo; não esperar a categoria mais lenta antes do primeiro conteúdo.
- Cache de catálogo usa IndexedDB com stale-while-revalidate. Segunda abertura deve poder mostrar cache e atualizar em segundo plano.
- Requisições idênticas e escolha de proxy devem ser compartilhadas/deduplicadas; não fazer uma bateria de testes de proxy por categoria simultânea.

## Rede, Xtream, proxies e TMDB

- Xtream é API-first: extrair `server/username/password`; usar `player_api.php`. Não baixar/parsing de `get.php` para listar catálogo.
- Listagens por categoria devem usar `category_id` quando disponível.
- O pool de CORS é `runtime/shared/proxy-pool.json`; candidatos são mantidos pelo workflow `Validate CORS proxies`. Não misturar proxy HTTP genérico com proxy CORS.
- Preservar afinidade/cache de proxy e evitar testes repetidos. Falha temporária não deve envenenar permanentemente o perfil.
- Configuração TMDB é remota em `runtime/shared/tmdb-config.json`. Não duplicar chave dentro de cada HTML gerado.
- TMDB: priorizar ID fornecido pelo provedor; fallback por nome sanitizado e, quando existir, ano. Provider continua fallback quando TMDB não responde.
- Logos/backdrops/posters devem respeitar fallbacks sem causar reflow brusco. Logo limpa e título revelado devem seguir a mesma guia visual da sinopse.
- Não limpar favoritos/histórico para resolver cache. Cache descartável de TMDB/catálogo/proxy pode ser invalidado; dados do usuário precisam de tratamento separado.

## Invariantes de UX e estado

- Standard é a base de distribuição mais estável. Mudanças de Shorts não devem alterar Standard salvo dependência compartilhada realmente necessária.
- Toda troca de aba Standard (live/filmes/séries) começa no topo; scroll de uma aba não vaza para outra.
- Configurações fecham ao clicar/tocar fora e permanecem abertas ao interagir dentro.
- Zoom por pinça/atalhos está bloqueado no app gerado, Standard e Shorts.
- “Continuar assistindo” só guarda conteúdo após pelo menos 60 s vistos. No Shorts, a gravação ocorre ao cruzar 60 s e depois periodicamente; não depender de contagem de eventos `timeupdate` nem exigir duração conhecida.
- Lixeira de Continuar precisa remover de storage + memória + faixa imediatamente e impedir `pause/close` de salvar o mesmo item de novo.
- Favoritos devem sobreviver a quota/cache; mutação é atômica: só alterar o `Set` em memória depois de `localStorage` gravar. Se Favoritos/Continuar estiver aberto, refletir a mudança imediatamente.
- Em modal, destruir/parar player ao fechar; vídeo não pode seguir tocando em segundo plano.
- Skeletons ocupam o espaço final; dados que chegam não devem abrir/empurrar a tela abruptamente.
- Não criar “segunda camada”/overlay global para mascarar bugs de renderização. Placeholder pertence ao container do item.
- Não adicionar MutationObserver/IntersectionObserver globais ou polling sem medir custo. Em listas grandes, priorizar DOM simples, concorrência limitada e paint containment.
- Uma correção de CSS não deve introduzir um segundo sistema JS para o mesmo problema, e vice-versa. Identificar dono da função antes de patchar.

## Dependência remota e segurança

- O HTML gerado é intencionalmente dependente dos módulos publicados em `fei-config`. Preserve manifests/revisões como mecanismo de atualização/cache.
- Não prometer que uma “chave escondida” em CSS/JS torna o cliente inviolável. Código client-side pode ser modificado por quem controla o arquivo.
- O objetivo é dependência operacional: sem os contratos/manifests/bundles remotos esperados, o app pode falhar de forma clara em vez de funcionar parcialmente.
- Credenciais Xtream existem na configuração do HTML gerado por necessidade funcional. Não copiá-las para logs, relatórios, commits ou mensagens.

## Como diagnosticar antes de editar

1. Identificar se o problema é no gerador, template, runtime fonte, bundle `dist`, tema ou serviço remoto.
2. Conferir qual modo está ativo:
   - Standard → `standard-r23.html` + manifesto/bundle R23;
   - Shorts → `shorts-r25.html` + manifesto/bundle R25.
3. Encontrar função/classe exata com busca; ler definições anteriores e posteriores para detectar override.
4. Reproduzir o fluxo mínimo. Exemplos:
   - gerador: login → analisar → selecionar → gerar;
   - Standard: aba → categoria → modal → reproduzir → fechar;
   - Shorts: boot → primeiro paint → scroll → abrir player → voltar.
5. Só depois editar. Evitar “mais um patch” quando a arquitetura é a causa.
6. Em regressão, comparar com commit/versão estável imediatamente anterior e localizar a mudança causal antes de reintroduzir funcionalidades.

## Validação mínima obrigatória

### Gerador
1. `node --check builder/generator-r23-clean.js` e, se afetado, `generator-r23-distro-no-shorts.js`.
2. Rodar `node scripts/build-r23.mjs`.
3. Confirmar que `generator.html === generator-r23.html`.
4. Confirmar que Flix/Fixed Style não reapareceu.
5. Confirmar que distro_no_shorts não contém opção/referência Shorts.
6. Testar: analisar conta, selecionar categorias, trocar tema, gerar arquivo Standard; no gerador principal, gerar também Shorts.

### Standard
1. `node --check dist/r23/standard.js`.
2. Verificar build R23 e mudança de `revision` quando bundle muda.
3. Testar mobile e desktop: rails, skeletons, abas, modal live/filme/série, favoritos, continuar, lixeira, fechamento do player e scroll.
4. Testar tema escuro e Porcelain; contraste/flare não podem depender de preto fixo.
5. Testar falha/timeout de arte/TMDB/proxy sem travar categoria inteira.

### Shorts
1. Rodar `node scripts/build-shorts-r25.mjs` e `node --check dist/r25/shorts.js`.
2. Confirmar `legacyShortsImported: false`.
3. Testar primeira abertura sem cache e segunda com cache.
4. Confirmar primeiro paint antes do fim de todas as categorias.
5. Testar HTML novo com `category_id` e fallback de HTML antigo por nome.
6. Scroll rápido: nenhuma capa pode desaparecer, piscar pela reciclagem do DOM ou gerar overlay deslocado.
7. Player: vertical cover padrão, contain opcional, controles no canto inferior direito, arco de 2 min, retorno ao catálogo.
8. Confirmar que HLS.js não é carregado antes de abrir mídia HLS.

### Rede/publicação
1. Conferir `git diff`, sintaxe e build antes de publicar.
2. Não editar `dist` manualmente quando o workflow/build é o dono do artefato; editar fonte e deixar o build gerar distribuição.
3. Verificar GitHub Actions:
   - `Build HTML Generator R23`;
   - `Build Shorts R25` quando Shorts mudou;
   - `Validate CORS proxies` quando proxy/pool mudou;
   - Pages build/deployment.
4. Se `main` avançou durante a tarefa, reler os arquivos tocados antes de atualizar/push; não force-push.
5. Resposta final deve distinguir: validação de sintaxe/build, validação em navegador e teste real com provedor. Não afirmar teste real que não foi feito.

## Ordem de publicação recomendada

- Alterar fontes/templates/builders.
- Rodar validações locais quando disponíveis.
- Commitar/publicar fonte.
- Aguardar workflow gerar/commitar `dist`.
- Verificar manifesto/revisão resultante e status do Pages.
- Só então considerar a atualização entregue.
- Para mudança compartilhada, verificar Standard e Shorts separadamente; sucesso de um workflow não valida o outro.

## Checkpoint — 19/09/2026

- `main` observado ao criar este guia: `c2a54b3445f576f51ae0b3cb721e0b642f4ef630`. Isto é apenas checkpoint; não é referência eterna.
- Standard publicado: `dist/r23/manifest.json` revision `r23-b562142756c7ec83`, layer `lite-ui-r13-detail-guides-history-delete`, baseline histórica `46b9cd4-pre-aura`.
- Shorts publicado: `dist/r25/manifest.json` revision `r25-eaf6980b111b7377`, arquitetura `fresh-native-flow-grid`, `legacyShortsImported=false`, arcos de 120 s.
- Gerador principal oferece Standard + “App Shorts”; internamente Shorts aponta para `shorts-r25.html`. A distribuição `generator_distro_no_shorts.html` continua Standard-only.
- Família Flix/Fixed foi removida do gerador. A identidade visual promovida ficou no layout principal e os seis temas clássicos fornecem a paleta.
- Standard recente: alinhamento de logo/título com sinopse, live header/estrela com respiro, remoção persistente de Continuar assistindo e proteção contra progresso antigo recriar item excluído.
- Shorts recente: catálogo refeito sem virtualização absoluta; vídeo vertical cover-first; controles menores; tags/título removidos dos covers; category IDs incorporados; cache IndexedDB; first paint progressivo; de-duplicação de requests/proxy; HLS lazy; Continuar grava após 60 s; Favoritos/Continuar atualizam a biblioteca aberta; Arcos usam bottom sheet com backdrop inspirado no `aura-reels` e fecham ao tocar fora.
- Workflows observados ao criar o guia: Pages e Validate CORS proxies concluíram com sucesso; último Build Shorts R25 concluído com sucesso. Isso não substitui teste manual em navegador/provedor.
- Limite conhecido: esta documentação foi construída por inspeção do repositório, manifests, scripts e Actions. Não houve, nesta etapa documental, teste end-to-end com credenciais de provedor nem benchmark em todos os navegadores.

## Regra para atualizar este guia

Ao concluir uma mudança estrutural ou checkpoint:
- atualizar somente o que mudou de verdade;
- registrar revisão/manifesto/commit relevante e validações executadas;
- apagar instrução que deixou de ser verdadeira em vez de acumular contradições;
- manter o guia curto o suficiente para ser lido antes de toda tarefa.
