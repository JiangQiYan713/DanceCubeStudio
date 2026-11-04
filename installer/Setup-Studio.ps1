param([string]$Repository='')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot 'Launch-Studio.ps1')
[Windows.Forms.Application]::EnableVisualStyles()
function Ask-Value([string]$Title,[string]$Message,[string]$Default){
    $form=[Windows.Forms.Form]::new();$form.Text=$Title;$form.Size=[Drawing.Size]::new(560,205);$form.StartPosition='CenterScreen';$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false;$form.MinimizeBox=$false
    $label=[Windows.Forms.Label]::new();$label.Text=$Message;$label.Location=[Drawing.Point]::new(18,15);$label.Size=[Drawing.Size]::new(510,47)
    $text=[Windows.Forms.TextBox]::new();$text.Text=$Default;$text.Location=[Drawing.Point]::new(20,69);$text.Width=505
    $ok=[Windows.Forms.Button]::new();$ok.Text='确定';$ok.Location=[Drawing.Point]::new(350,112);$ok.DialogResult=[Windows.Forms.DialogResult]::OK
    $cancel=[Windows.Forms.Button]::new();$cancel.Text='取消';$cancel.Location=[Drawing.Point]::new(440,112);$cancel.DialogResult=[Windows.Forms.DialogResult]::Cancel
    $form.Controls.AddRange(@($label,$text,$ok,$cancel));$form.AcceptButton=$ok;$form.CancelButton=$cancel
    if($form.ShowDialog() -ne [Windows.Forms.DialogResult]::OK){$form.Dispose();throw '用户取消安装。'};$value=$text.Text.Trim();$form.Dispose();return $value
}
function Download-Official([string]$Url,[string]$Destination,[string]$Proxy){$args=@{Uri=$Url;OutFile=$Destination;UseBasicParsing=$true;TimeoutSec=180;Headers=@{'User-Agent'='DanceCube-Studio-Setup'}};if($Proxy){$args.Proxy=$Proxy};Invoke-WebRequest @args}
try {
    Write-Host 'Checking GitHub and available local proxies...'
    $proxy=Enable-StudioNetwork
    if(-not $Repository){$Repository=Ask-Value 'DanceCube Studio · GitHub 仓库' '粘贴维护者提供的源码仓库 HTTPS 地址。' ''}
    if(-not(Test-RepositoryUrl $Repository)){throw '仓库地址格式应为 https://github.com/所有者/仓库名'}
    $folderDialog=[Windows.Forms.FolderBrowserDialog]::new();$folderDialog.Description='选择一个本地空文件夹，存放网站、便携 Git 和启动器';$folderDialog.ShowNewFolderButton=$true
    if($folderDialog.ShowDialog() -ne [Windows.Forms.DialogResult]::OK){throw '用户取消安装。'};$target=$folderDialog.SelectedPath;$folderDialog.Dispose()
    if(@(Get-ChildItem -LiteralPath $target -Force).Count){throw '目标文件夹必须为空，请重新运行安装器并选择空文件夹。'}
    $portText=Ask-Value 'DanceCube Studio · 本地端口' '选择本地网页端口（1024–65535，仅监听本机）。更改端口会使用独立的浏览器缓存。' '8964'
    $port=0;if(-not [int]::TryParse($portText,[ref]$port) -or $port -lt 1024 -or $port -gt 65535){throw '端口应为 1024–65535 的整数。'}
    $probe=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$port);try{$probe.Start()}catch{throw '所选端口已被占用，请重新选择。'}finally{$probe.Stop()}
    $gitCommand=Get-Command git -ErrorAction SilentlyContinue
    if($gitCommand){$git=$gitCommand.Source}else{
        Write-Host 'Downloading official Portable Git (no system installation)...'
        $request=@{Uri='https://api.github.com/repos/git-for-windows/git/releases/latest';UseBasicParsing=$true;TimeoutSec=30;Headers=@{'User-Agent'='DanceCube-Studio-Setup'}};if($proxy){$request.Proxy=$proxy}
        $release=Invoke-RestMethod @request;$asset=$release.assets | Where-Object {$_.name -match '^PortableGit-.*-64-bit\.7z\.exe$'} | Select-Object -First 1
        if(-not $asset -or $asset.browser_download_url -notmatch '^https://github\.com/git-for-windows/git/releases/download/'){throw '无法找到官方便携 Git，请先安装 Git for Windows 后重试。'}
        if($asset.digest -notmatch '^sha256:([a-f0-9]{64})$'){throw '官方便携 Git 未提供可验证的 SHA-256，请先安装 Git for Windows 后重试。'};$expected=$Matches[1]
        $gitArchive=Join-Path $env:TEMP ('DanceCube-Git-'+[guid]::NewGuid().ToString('N')+'.exe')
        try{Download-Official $asset.browser_download_url $gitArchive $proxy;$actual=(Get-FileHash -LiteralPath $gitArchive -Algorithm SHA256).Hash.ToLowerInvariant();if($actual -ne $expected){throw '便携 Git 校验失败，未执行下载文件。'};$gitRoot=Join-Path $target 'git';$process=Start-Process -FilePath $gitArchive -ArgumentList @('-y',('-o"'+$gitRoot+'"')) -Wait -PassThru;if($process.ExitCode -ne 0){throw '便携 Git 解压失败。'};$git=Join-Path $gitRoot 'cmd/git.exe';if(-not(Test-Path $git)){throw '便携 Git 文件不完整。'}}finally{Remove-Item -LiteralPath $gitArchive -Force -ErrorAction SilentlyContinue}
    }
    $source=Join-Path $target 'source';Sync-StudioRepository $git $Repository $source
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Launch-Studio.ps1') -Destination (Join-Path $target 'Launch-Studio.ps1')
    @{repository=$Repository;port=$port;git=$git} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $target 'studio-config.json') -Encoding UTF8
    '@echo off'+"`r`n"+'cd /d "%~dp0"'+"`r`n"+'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Launch-Studio.ps1"'+"`r`n" | Set-Content -LiteralPath (Join-Path $target 'Start-DanceCube.bat') -Encoding ASCII
    $argument='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $target 'Launch-Studio.ps1')+'"'
    Start-Process powershell.exe -ArgumentList $argument -WorkingDirectory $target
    [Windows.Forms.MessageBox]::Show("安装完成。浏览器将打开 http://localhost:$port/`n以后双击 Start-DanceCube.bat，启动时会检查并更新源码。`n保持启动器窗口打开以运行网站；可以删除 setup.exe。",'DanceCube Studio',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    exit 0
} catch {
    [Windows.Forms.MessageBox]::Show($_.Exception.Message,'安装未完成',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    exit 1
}
