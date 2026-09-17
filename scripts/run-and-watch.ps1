param(
    [int]$Count
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repoRoot "scripts\logs"
$pidPath = Join-Path $logDir "current-run.pid"

Write-Host "=== aitagger-articles 自動リサーチ 実行＆進捗表示 ==="
Write-Host ""

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}

if (-not $Count) {
    $inputCount = Read-Host "収集する記事の目標本数を入力してください(空Enterで既定の10本)"
    if ($inputCount -match '^\d+$') {
        $Count = [int]$inputCount
    } else {
        $Count = 10
    }
}
Write-Host "目標本数: $Count 本(上限はその1.5倍まで)"
Write-Host ""

# 実行前の最新summaryログを記録しておき、新しく増えたものだけを追う
$before = Get-ChildItem $logDir -Filter "*-summary.log" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name

# タスクスケジューラー経由(Start-ScheduledTask)は引数を渡せないため、
# 本数を指定する手動実行はタスクを介さず nightly-research.ps1 を直接バックグラウンド起動する
Write-Host "自動リサーチを起動します..."
$scriptPath = Join-Path $PSScriptRoot "nightly-research.ps1"
Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$scriptPath`"", "-Count", $Count
) -WindowStyle Hidden

Write-Host "ログファイルが作成されるのを待っています..."
$summaryLogPath = $null
$waitCount = 0
while (-not $summaryLogPath -and $waitCount -lt 30) {
    Start-Sleep -Seconds 1
    $waitCount++
    $current = Get-ChildItem $logDir -Filter "*-summary.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($current -and ($before -notcontains $current.Name)) {
        $summaryLogPath = $current.FullName
    }
}

if (-not $summaryLogPath) {
    Write-Host "ログファイルが見つかりませんでした。タスクが正常に起動していない可能性があります。"
    Write-Host "以下で状態を確認してください: Get-ScheduledTaskInfo -TaskName `"aitagger-articles-nightly-research`""
    exit 1
}

Write-Host ""
Write-Host "進捗を表示します。"
Write-Host ">>> 途中で止めたい場合は「S」キーを押してください（Enterは不要） <<<"
Write-Host "----------------------------------------"
Write-Host ""

# ログファイルをポーリングしつつ、'S'キー入力を監視する。
# Get-Content -Wait はキー入力を受け付けられずCtrl+Cでしか止められないため、
# ここでは1秒ごとに新規行を読み出す簡易tailにして、その合間にキー入力をチェックする。
$reader = New-Object System.IO.StreamReader(New-Object System.IO.FileStream($summaryLogPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite))
$stopRequested = $false

try {
    while (-not $stopRequested) {
        while (-not $reader.EndOfStream) {
            $line = $reader.ReadLine()
            if ($null -ne $line) {
                Write-Host $line
                if ($line -match "自動リサーチが完了しました" -or $line -match "^\[.*\] 失敗: ") {
                    $stopRequested = $true
                    break
                }
            }
        }
        if ($stopRequested) { break }

        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if ($key.Key -eq "S") {
                Write-Host ""
                Write-Host ">>> 停止要求を受け付けました。安全に停止処理へ移ります... <<<"
                $stopRequested = $true
                break
            }
        }

        Start-Sleep -Milliseconds 500
    }
} finally {
    $reader.Close()
}

if (Test-Path $pidPath) {
    Write-Host ""
    & (Join-Path $PSScriptRoot "stop-research.ps1")
} else {
    Write-Host ""
    Write-Host "実行は既に終了しています。"
}
