# Uso no Fei

## Opção simples: source/ContentSafetyFilter.brs

Copie o arquivo:

```text
fei/source/ContentSafetyFilter.brs
```

para:

```text
source/ContentSafetyFilter.brs
```

No ponto onde você já carregou categorias/canais/filmes/séries, use:

```brightscript
safetyFilter = FeiLoadSafetyFilter()
itemsLimpos = FeiFilterItems(itemsOriginais, safetyFilter)
```

Para item individual:

```brightscript
if FeiShouldBlockItem(item, safetyFilter) = false then
    itemsLimpos.Push(item)
end if
```

## Opção Task SceneGraph

Copie:

```text
fei/components/tasks/ContentSafetyFilterTask.xml
fei/components/tasks/ContentSafetyFilterTask.brs
```

para:

```text
components/tasks/ContentSafetyFilterTask.xml
components/tasks/ContentSafetyFilterTask.brs
```

Exemplo:

```brightscript
task = CreateObject("roSGNode", "ContentSafetyFilterTask")
task.url = "https://hyakkmarupy.github.io/fei-blocklist/config/adult-blocklist-v1.json"
task.ObserveField("filter", "onSafetyFilterLoaded")
task.control = "RUN"
```

Callback:

```brightscript
sub onSafetyFilterLoaded()
    m.safetyFilter = m.top.findNode("contentSafetyTask").filter
end sub
```

Ajuste o exemplo acima ao padrão dos seus controllers.

## Importante

- Não use `EnablePeerVerification(false)` em build de loja.
- Não use `EnableHostVerification(false)` em build de loja.
- Use HTTPS.
- Use `common:/certs/ca-bundle.crt`.
- Mantenha fallback local mínimo.
- Não exiba termos bloqueados em logs, toast ou tela.
- Não use a lista remota para ocultar comportamento da certificação; use como filtro real de segurança.
