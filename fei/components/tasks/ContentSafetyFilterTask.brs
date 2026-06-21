sub init()
    m.top.functionName = "run"
end sub

sub run()
    url = m.top.url
    if url = invalid or url = "" then
        url = "https://hyakkmarupy.github.io/fei-blocklist/config/adult-blocklist-v1.json"
    end if

    filter = DownloadSafetyJson(url, 2500)
    if IsValidSafetyFilter(filter) then
        m.top.filter = filter
        m.top.ok = true
    else
        m.top.filter = LocalSafetyFallback()
        m.top.ok = false
    end if
end sub

function DownloadSafetyJson(url as String, timeoutMs as Integer) as Dynamic
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
            return ParseJson(msg.GetString())
        end if
    else
        transfer.AsyncCancel()
    end if

    return invalid
end function

function IsValidSafetyFilter(data as Dynamic) as Boolean
    if data = invalid then return false
    if type(data) <> "roAssociativeArray" then return false
    if data.block_terms = invalid then return false
    if type(data.block_terms) <> "roArray" then return false
    return true
end function

function LocalSafetyFallback() as Object
    return {
        schema: "aura.content-safety.blocklist.v1",
        version: 1,
        mode: "block",
        allow_terms: ["adult swim", "cartoon network adult swim"],
        block_terms: ["18+", "+18", "adult", "adulto", "xxx", "porn", "porno", "erotic", "erotico", "sex", "sexo", "sexual", "nude", "naked", "hentai"]
    }
end function
