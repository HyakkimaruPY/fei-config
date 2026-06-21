# Fei Remote Config

Repositório público para arquivos estáticos do app Fei.

## URLs prontas

```text
https://hyakkmarupy.github.io/fei-blocklist/config/adult-blocklist-v1.json
https://hyakkmarupy.github.io/fei-blocklist/config/app-config-v1.json
```

## Estrutura

```text
/
  index.html
  .nojekyll
  README.md
  USO-NO-FEI.md
  config/
    adult-blocklist-v1.json
    app-config-v1.json
  fei/
    source/
      ContentSafetyFilter.brs
    components/tasks/
      ContentSafetyFilterTask.xml
      ContentSafetyFilterTask.brs
```

## Publicação no GitHub Pages

1. Crie um repositório público chamado `fei-blocklist`.
2. Envie estes arquivos para a branch `main`.
3. Abra `Settings` > `Pages`.
4. Em `Build and deployment`, escolha `Deploy from a branch`.
5. Em `Branch`, escolha `main` e pasta `/root`.
6. Salve.
7. Aguarde a publicação e teste as URLs acima.

## Observação importante

Este repositório deve ser usado como configuração remota legítima e pública para filtro de segurança de conteúdo. Não use para ocultar comportamento do app durante certificação.
