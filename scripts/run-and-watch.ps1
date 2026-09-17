param(
    [int]$Count,
    [string]$Model = "",
    [string]$Effort = ""
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

if (-not $Model) {
    Write-Host "使用するモデルを選んでください:"
    Write-Host "  1: 既定(claude設定に従う)"
    Write-Host "  2: sonnet"
    Write-Host "  3: opus"
    Write-Host "  4: haiku"
    $modelChoice = Read-Host "番号を入力(空Enterで既定)"
    switch ($modelChoice) {
        "2" { $Model = "sonnet" }
        "3" { $Model = "opus" }
        "4" { $Model = "haiku" }
        default { $Model = "" }
    }
}

if (-not $Effort) {
    Write-Host "推論レベル(effort)を選んでください:"
    Write-Host "  1: 既定"
    Write-Host "  2: low"
    Write-Host "  3: medium"
    Write-Host "  4: high"
    $effortChoice = Read-Host "番号を入力(空Enterで既定)"
    switch ($effortChoice) {
        "2" { $Effort = "low" }
        "3" { $Effort = "medium" }
        "4" { $Effort = "high" }
        default { $Effort = "" }
    }
}

Write-Host ""
Write-Host "モデル: $(if ($Model) { $Model } else { '既定' }) / 推論レベル: $(if ($Effort) { $Effort } else { '既定' })"
Write-Host ""

# 実行前の最新summaryログを記録しておき、新しく増えたものだけを追う
$before = Get-ChildItem $logDir -Filter "*-summary.log" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name

# タスクスケジューラー経由(Start-ScheduledTask)は引数を渡せないため、
# 本数を指定する手動実行はタスクを介さず nightly-research.ps1 を直接バックグラウンド起動する
Write-Host "自動リサーチを起動します..."
$scriptPath = Join-Path $PSScriptRoot "nightly-research.ps1"
$nightlyArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$scriptPath`"", "-Count", $Count)
if ($Model) { $nightlyArgs += @("-Model", $Model) }
if ($Effort) { $nightlyArgs += @("-Effort", $Effort) }
Start-Process -FilePath "powershell.exe" -ArgumentList $nightlyArgs -WindowStyle Hidden

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
$finished = $false

try {
    while (-not $finished) {
        while (-not $reader.EndOfStream) {
            $line = $reader.ReadLine()
            if ($null -ne $line) {
                Write-Host $line
                if ($line -match "自動リサーチが完了しました" -or $line -match "^\[.*\] 失敗: ") {
                    $finished = $true
                    break
                }
            }
        }
        if ($finished) { break }

        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)

            # クリックやウィンドウ切り替え時にコンソールへ偶発的に1文字送られることがあるため、
            # 'S'を検知しても即座には反応せず、直後にもう一度明示的な確認キーを求める。
            if ($key.Key -eq "S") {
                # バッファに紛れ込んだ余分な入力を読み捨ててから確認する
                while ([Console]::KeyAvailable) { [Console]::ReadKey($true) | Out-Null }

                Write-Host ""
                Write-Host -NoNewline "本当に停止しますか？ よければもう一度「S」キーを押してください(3秒以内。他のキーやそのまま待つとキャンセル): "
                $confirmed = $false
                $waited = 0
                while ($waited -lt 30) {
                    if ([Console]::KeyAvailable) {
                        $confirmKey = [Console]::ReadKey($true)
                        if ($confirmKey.Key -eq "S") { $confirmed = $true }
                        break
                    }
                    Start-Sleep -Milliseconds 100
                    $waited++
                }
                Write-Host ""

                if (-not $confirmed) {
                    Write-Host "キャンセルしました。進捗表示に戻ります。"
                    Write-Host ">>> 途中で止めたい場合は「S」キーを押してください（Enterは不要） <<<"
                }
                elseif (Test-Path $pidPath) {
                    & (Join-Path $PSScriptRoot "stop-research.ps1")
                    # stop-research.ps1側でYESが選ばれ実際に停止した場合のみ、ここでも終了する
                    if (-not (Test-Path $pidPath)) {
                        $finished = $true
                        break
                    }
                    Write-Host ""
                    Write-Host "進捗表示に戻ります。"
                    Write-Host ">>> 途中で止めたい場合は「S」キーを押してください（Enterは不要） <<<"
                }
                else {
                    Write-Host "実行は既に終了しています。"
                    $finished = $true
                    break
                }
            }
        }

        Start-Sleep -Milliseconds 500
    }
} finally {
    $reader.Close()
}

Write-Host ""
Write-Host "進捗表示を終了します。"
