function FeiSafetyFilterUrl() as String
    return "https://hyakkmarupy.github.io/fei-blocklist/config/adult-blocklist-v1.json"
end function

function FeiGetLocalSafetyFallback() as Object
    return {
        schema: "aura.content-safety.blocklist.v1",
        version: 1,
        mode: "block",
        ttl_seconds: 86400,
        allow_terms: [
            "adult swim",
            "cartoon network adult swim"
        ],
        block_terms: [
            "18+",
            "+18",
            "adult",
            "adulto",
            "adultos",
            "xxx",
            "porn",
            "porno",
            "pornografia",
            "erotic",
            "erotico",
            "erótico",
            "sex",
            "sexo",
            "sexual",
            "nude",
            "naked",
            "hentai"
        ]
    }
end function

function FeiLoadSafetyFilter() as Object
    cachePath = "cachefs:/fei_adult_blocklist_v1.json"
    remote = FeiDownloadJson(FeiSafetyFilterUrl(), 2500)

    if FeiIsValidSafetyFilter(remote) then
        WriteAsciiFile(cachePath, FormatJson(remote))
        return remote
    end if

    cachedRaw = ReadAsciiFile(cachePath)
    if cachedRaw <> invalid and cachedRaw <> "" then
        cachedJson = ParseJson(cachedRaw)
        if FeiIsValidSafetyFilter(cachedJson) then return cachedJson
    end if

    return FeiGetLocalSafetyFallback()
end function

function FeiDownloadJson(url as String, timeoutMs as Integer) as Dynamic
    transfer = CreateObject("roUrlTransfer")
    port = CreateObject("roMessagePort")

    transfer.SetMessagePort(port)
    transfer.SetUrl(url)
    transfer.SetRequest("GET")
    transfer.AddHeader("Accept", "application/json")
    transfer.AddHeader("User-Agent", "FeiConfig/1.0")

    if LCase(Left(url, 5)) = "https" then
        transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
        transfer.InitClientCertificates()
    end if

    if transfer.AsyncGetToString() <> true then return invalid

    msg = wait(timeoutMs, port)
    if type(msg) = "roUrlEvent" then
        code = msg.GetResponseCode()
        if code >= 200 and code < 300 then
            body = msg.GetString()
            parsed = ParseJson(body)
            if parsed <> invalid then return parsed
        end if
    else
        transfer.AsyncCancel()
    end if

    return invalid
end function

function FeiIsValidSafetyFilter(data as Dynamic) as Boolean
    if data = invalid then return false
    if type(data) <> "roAssociativeArray" then return false
    if data.block_terms = invalid then return false
    if type(data.block_terms) <> "roArray" then return false
    return true
end function

function FeiShouldBlockText(value as Dynamic, filter as Object) as Boolean
    if value = invalid then return false

    text = LCase(value.ToStr())
    if text = "" then return false

    if filter.allow_terms <> invalid then
        for each allowTerm in filter.allow_terms
            t = LCase(allowTerm.ToStr())
            if t <> "" and Instr(1, text, t) > 0 then return false
        end for
    end if

    if filter.block_terms <> invalid then
        for each blockTerm in filter.block_terms
            t = LCase(blockTerm.ToStr())
            if t <> "" and Instr(1, text, t) > 0 then return true
        end for
    end if

    return false
end function

function FeiShouldBlockItem(item as Object, filter as Object) as Boolean
    if item = invalid then return false

    fields = ["category", "group-title", "group_title", "name", "title", "stream_name", "vod_name", "series_name"]
    for each fieldName in fields
        if item.DoesExist(fieldName) then
            if FeiShouldBlockText(item[fieldName], filter) then return true
        end if
    end for

    return false
end function

function FeiFilterItems(items as Dynamic, filter as Object) as Object
    result = []
    if items = invalid then return result

    for each item in items
        if FeiShouldBlockItem(item, filter) = false then
            result.Push(item)
        end if
    end for

    return result
end function
