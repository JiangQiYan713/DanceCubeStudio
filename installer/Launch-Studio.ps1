param([string]$ConfigPath = (Join-Path $PSScriptRoot 'studio-config.json'), [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
function Get-LocalProxy {
    $candidates = [Collections.Generic.List[string]]::new()
    foreach ($key in @('HTTPS_PROXY','HTTP_PROXY','ALL_PROXY')) { $value=[Environment]::GetEnvironmentVariable($key); if($value){$candidates.Add($value)} }
    try { $reg=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'; if($reg.ProxyEnable -eq 1 -and $reg.ProxyServer){foreach($entry in ($reg.ProxyServer -split ';')){$value=$entry -replace '^https?=','';if($value -notmatch '^[a-z]+://'){$value='http://'+$value};$candidates.Add($value)}} } catch {}
    # Bounded loopback discovery only; never scan LAN addresses or change system proxy.
    foreach($port in @(7890,7897,10809,8080,1080)){$candidates.Add("http://127.0.0.1:$port")}
    foreach($value in ($candidates | Select-Object -Unique)){
        try {$uri=[uri]$value;if($uri.UserInfo -or $uri.Scheme -ne 'http' -or $uri.Host -notin @('127.0.0.1','localhost','[::1]','::1')){continue};$tcp=[Net.Sockets.TcpClient]::new();$task=$tcp.ConnectAsync($uri.Host,$uri.Port);$ok=$task.Wait(250) -and $tcp.Connected;$tcp.Dispose();if(-not $ok){continue}
            $probe=Invoke-WebRequest -Uri 'https://api.github.com/rate_limit' -Proxy $uri.AbsoluteUri -UseBasicParsing -TimeoutSec 6 -Headers @{'User-Agent'='DanceCube-Studio-Setup'}
            if($probe.StatusCode -eq 200){return $uri.AbsoluteUri}
        } catch {}
    }
    return $null
}
function Enable-StudioNetwork {
    [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
    $proxy=Get-LocalProxy
    if($proxy){$env:HTTPS_PROXY=$proxy;$env:HTTP_PROXY=$proxy;Write-Host "Using validated local proxy: $proxy";return $proxy}
    # Prevent inherited, invalid proxy settings from blocking this launcher.
    $env:HTTPS_PROXY=$null;$env:HTTP_PROXY=$null;$env:ALL_PROXY=$null
    try {Invoke-WebRequest 'https://api.github.com/rate_limit' -UseBasicParsing -TimeoutSec 8 -Headers @{'User-Agent'='DanceCube-Studio-Setup'} | Out-Null;return $null}
    catch {throw 'Cannot connect to GitHub. Enable a local HTTP proxy or check the network, then retry.'}
}
function Test-RepositoryUrl([string]$Url){return $Url -cmatch '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?$'}
function Sync-StudioRepository([string]$Git,[string]$Repository,[string]$Path){
    if(-not(Test-RepositoryUrl $Repository)){throw 'Only an HTTPS GitHub repository URL is accepted.'}
    if(-not(Test-Path (Join-Path $Path '.git'))){
        if((Test-Path $Path) -and @(Get-ChildItem -Force $Path).Count){throw 'The source directory is not empty and is not a Git checkout.'}
        & $Git -c credential.interactive=never clone -- $Repository $Path
        if($LASTEXITCODE -ne 0){throw 'git clone failed. Check repository permissions and network.'}
    } else {
        $origin=(& $Git -C $Path config --get remote.origin.url | Out-String).Trim()
        if($LASTEXITCODE -ne 0 -or $origin.TrimEnd('/').Replace('.git','') -ne $Repository.TrimEnd('/').Replace('.git','')){throw 'Repository origin differs from the configured URL; no files were changed.'}
        & $Git -C $Path fetch --prune origin
        if($LASTEXITCODE -ne 0){throw 'Could not check for updates.'}
        $tracking=(& $Git -C $Path rev-parse --abbrev-ref '@{u}' | Out-String).Trim()
        if($LASTEXITCODE -ne 0){throw 'No upstream branch is configured.'}
        $head=(& $Git -C $Path rev-parse HEAD | Out-String).Trim();$remote=(& $Git -C $Path rev-parse $tracking | Out-String).Trim()
        if($head -ne $remote){$changes=(& $Git -C $Path status --porcelain | Out-String).Trim();if($changes){throw 'Local source changes exist. Save or commit them before updating.'}; & $Git -C $Path merge --ff-only $tracking;if($LASTEXITCODE -ne 0){throw 'Update needs manual conflict resolution. Local files were preserved.'}}
    }
    if(-not(Test-Path (Join-Path $Path 'dist/index.html'))){throw 'The repository does not contain dist/index.html.'}
}
function Read-HttpLine($Stream){$bytes=[Collections.Generic.List[byte]]::new();while($bytes.Count -lt 8192){$b=$Stream.ReadByte();if($b -eq -1){return $null};if($b -eq 10){return [Text.Encoding]::ASCII.GetString($bytes.ToArray()).TrimEnd("`r")};$bytes.Add([byte]$b)};throw 'HTTP header is too long.'}
function Start-StudioServer([string]$Root,[int]$Port,[bool]$OpenBrowser){
    if($Port -lt 1024 -or $Port -gt 65535){throw 'Port must be 1024..65535.'}
    $rootPath=[IO.Path]::GetFullPath($Root).TrimEnd('\','/')+[IO.Path]::DirectorySeparatorChar
    $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$Port)
    try {$listener.Start()}catch{throw "Port $Port is in use. Edit studio-config.json and select another port."}
    Write-Host "DanceCube Studio http://localhost:$Port/ (keep this window open; Ctrl+C to stop)"
    if($OpenBrowser){Start-Process "http://localhost:$Port/"}
    $types=@{'.html'='text/html; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.css'='text/css; charset=utf-8';'.json'='application/json; charset=utf-8';'.md'='text/markdown; charset=utf-8';'.png'='image/png';'.jpg'='image/jpeg';'.jpeg'='image/jpeg';'.svg'='image/svg+xml';'.ogg'='audio/ogg';'.mp3'='audio/mpeg';'.wav'='audio/wav';'.zip'='application/zip';'.woff2'='font/woff2';'.flac'='audio/flac';'.m4a'='audio/mp4'}
    try {while($true){$client=$listener.AcceptTcpClient();try{$stream=$client.GetStream();$stream.ReadTimeout=5000;$stream.WriteTimeout=5000;$first=Read-HttpLine $stream;$headers=@{};for($i=0;$i -lt 80;$i++){$line=Read-HttpLine $stream;if([string]::IsNullOrEmpty($line)){break};$kv=$line -split ':',2;if($kv.Length -eq 2){$headers[$kv[0].ToLowerInvariant()]=$kv[1].Trim()}}
        $parts=$first -split ' ';$method=$parts[0];$code='200 OK';$body=$null;$file=$null;$start=0L;$length=0L;$extra='';$mime='text/plain; charset=utf-8'
        if($method -notin @('GET','HEAD') -or $parts.Length -lt 2){$code='405 Method Not Allowed';$body=[Text.Encoding]::UTF8.GetBytes('GET / HEAD only')}
        else{try{$relative=[uri]::UnescapeDataString(($parts[1] -split '\?')[0]).Replace('/',[IO.Path]::DirectorySeparatorChar).TrimStart('\','/');if($relative -match '[:\x00]'){throw 'Invalid path'};if(-not $relative){$relative='index.html'};$target=[IO.Path]::GetFullPath((Join-Path $rootPath $relative));if(-not $target.StartsWith($rootPath,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid path'};if(-not [IO.File]::Exists($target)){$code='404 Not Found';$body=[Text.Encoding]::UTF8.GetBytes('Not found')}else{$file=[IO.File]::OpenRead($target);$length=$file.Length;$ext=[IO.Path]::GetExtension($target).ToLowerInvariant();if($types.ContainsKey($ext)){$mime=$types[$ext]}else{$mime='application/octet-stream'};if($headers.ContainsKey('range')){if($headers['range'] -match '^bytes=(\d*)-(\d*)$' -and ($Matches[1] -or $Matches[2])){if(-not $Matches[1]){$start=[Math]::Max(0L,$length-[long]$Matches[2]);$end=$length-1}else{$start=[long]$Matches[1];$end=if($Matches[2]){[Math]::Min($length-1,[long]$Matches[2])}else{$length-1}};if($start -ge $length -or $end -lt $start){$code='416 Range Not Satisfiable';$extra="Content-Range: bytes */$length`r`n";$length=0}else{$code='206 Partial Content';$extra="Content-Range: bytes $start-$end/$length`r`n";$length=$end-$start+1;$file.Position=$start}}else{$code='416 Range Not Satisfiable';$length=0}}}}catch{$code='400 Bad Request';$body=[Text.Encoding]::UTF8.GetBytes('Invalid path')}}
        if($body){$length=$body.Length};$response="HTTP/1.1 $code`r`nContent-Type: $mime`r`nContent-Length: $length`r`nAccept-Ranges: bytes`r`nCache-Control: no-cache`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n$extra`r`n";$buffer=[Text.Encoding]::ASCII.GetBytes($response);$stream.Write($buffer,0,$buffer.Length)
        if($method -ne 'HEAD'){if($body){$stream.Write($body,0,$body.Length)}elseif($file){$buffer=New-Object byte[] 65536;$remaining=$length;while($remaining -gt 0){$count=$file.Read($buffer,0,[int][Math]::Min($remaining,$buffer.Length));if($count -le 0){break};$stream.Write($buffer,0,$count);$remaining-=$count}}}
    }catch{Write-Verbose $_.Exception.Message}finally{if($file){$file.Dispose();$file=$null};$client.Dispose()}}}finally{$listener.Stop()}
}
# Setup imports the functions without starting a server.
if($MyInvocation.InvocationName -ne '.'){
    try {$config=Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json;$null=Enable-StudioNetwork;$git=[string]$config.git;if(-not(Test-Path $git)){$git=(Get-Command git -ErrorAction Stop).Source};$repoPath=Join-Path $PSScriptRoot 'source';Sync-StudioRepository $git $config.repository $repoPath;Start-StudioServer (Join-Path $repoPath 'dist') ([int]$config.port) (-not $NoBrowser)}catch{Write-Host $_.Exception.Message -ForegroundColor Red;Read-Host 'Press Enter to close';exit 1}
}
