$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repoRoot "scripts\logs"
$pidPath = Join-Path $logDir "current-run.pid"

Write-Host "=== aitagger-articles 自動リサーチ 強制終了ツール ==="
Write-Host ""

if (-not (Test-Path $pidPath)) {
    Write-Host "現在実行中の自動リサーチは見つかりませんでした(PIDファイルなし)。"
    Write-Host "既に完了しているか、そもそも起動していない可能性があります。"
    exit 0
}

$targetPid = (Get-Content $pidPath -Raw).Trim()
$process = Get-Process -Id $targetPid -ErrorAction SilentlyContinue

if (-not $process) {
    Write-Host "PIDファイルに記録されたプロセス(PID: $targetPid)は既に終了していました。"
    Write-Host "PIDファイルを削除します。"
    Remove-Item -Path $pidPath -Force -ErrorAction SilentlyContinue
    exit 0
}

Write-Host "実行中の自動リサーチプロセスが見つかりました:"
Write-Host "  PID       : $($process.Id)"
Write-Host "  開始時刻   : $($process.StartTime)"
Write-Host "  経過時間   : $([math]::Round(((Get-Date) - $process.StartTime).TotalMinutes, 1))分"
Write-Host ""
Write-Host "この時点までの進捗(draft push・Slack通知)は保持されますが、"
Write-Host "処理中の記事は中断され、途中までの状態がログに残ります。"
Write-Host ""

$answer = ""
while ($answer -ne "YES" -and $answer -ne "NO") {
    $answer = Read-Host "強制終了しますか？ このまま続行する場合は NO、強制終了する場合は YES と入力してください"
    $answer = $answer.Trim().ToUpper()
    if ($answer -ne "YES" -and $answer -ne "NO") {
        Write-Host "YES か NO のどちらかを入力してください。"
    }
}

if ($answer -eq "NO") {
    Write-Host ""
    Write-Host "続行を選択しました。自動リサーチはこのまま動作を継続します。"
    Write-Host "  PID       : $($process.Id)"
    Write-Host "  経過時間   : $([math]::Round(((Get-Date) - $process.StartTime).TotalMinutes, 1))分"
    $latestLog = Get-ChildItem $logDir -Filter "nightly-research-*-summary.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
    Write-Host "進捗は以下のログファイルで確認できます:"
    Write-Host "  $latestLog"
    exit 0
}

Write-Host "強制終了しています..."
Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$stillAlive = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
if ($stillAlive) {
    Write-Host "警告: プロセス(PID: $targetPid)がまだ生きています。停止できませんでした。"
    Write-Host "タスクマネージャーから手動で終了するか、時間をおいて再度このスクリプトを実行してください。"
    exit 1
} else {
    Write-Host "停止を確認しました(PID: $targetPid は終了しています)。"
    Remove-Item -Path $pidPath -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "直近のログファイル一覧:"
Get-ChildItem $logDir -Filter "nightly-research-*-summary.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName | ForEach-Object {
    Write-Host "  $_"
    Write-Host ""
    Write-Host "--- 最後の10行 ---"
    Get-Content $_ -Tail 10 -Encoding utf8
}

Write-Host ""
$deleteAnswer = Read-Host "この実行のログファイルを削除しますか？ (通常は残すことを推奨。削除する場合のみ YES と入力)"
if ($deleteAnswer -eq "YES") {
    $prefix = "nightly-research-*"
    Get-ChildItem $logDir -Filter $prefix | Sort-Object LastWriteTime -Descending | Select-Object -First 4 | Remove-Item -Force
    Write-Host "直近の実行分のログファイルを削除しました。"
} else {
    Write-Host "ログファイルは残しました。"
}
