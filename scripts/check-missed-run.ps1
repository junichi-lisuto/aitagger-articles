# ログオン時にタスクスケジューラから実行される。
# 「19時の自動リサーチが前回実行された日」を記録したマーカー(last-run-date.txt)を見て、
# 前回実行日から今日までの間に1日以上の空白があれば、PCが19時に起動していなかった
# (=スキップされた)とみなしSlackに通知するだけの軽量スクリプト。
# ここでは記事リサーチ自体は実行しない(19時トリガーが次に発火するのを待つ)。

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repoRoot "scripts\logs"
$lastRunMarkerPath = Join-Path $logDir "last-run-date.txt"
$notifiedMarkerPath = Join-Path $logDir "last-missed-run-notified.txt"

function Get-AlertWebhookUrl {
    $configPath = Join-Path $repoRoot "automation\config.local.json"
    if (-not (Test-Path $configPath)) {
        return $null
    }
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        return $config.alertSlackWebhookUrl
    } catch {
        return $null
    }
}

function Send-AlertToSlack {
    param([string]$Message)

    $webhookUrl = Get-AlertWebhookUrl
    if (-not $webhookUrl) {
        return
    }

    $payload = @{ text = $Message } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $payload -ContentType "application/json; charset=utf-8" | Out-Null
    } catch {
        # ログオン直後はネットワーク未接続のことがあるため、失敗しても静かに終了する
    }
}

if (-not (Test-Path $lastRunMarkerPath)) {
    # 初回セットアップ直後などマーカーがまだ存在しない場合は判定材料がないため何もしない
    exit 0
}

$lastRunDate = (Get-Content $lastRunMarkerPath -Raw -Encoding utf8).Trim()
$today = Get-Date -Format "yyyy-MM-dd"

if ($lastRunDate -ge $today) {
    # 今日すでに実行済み、または未来日付(想定外)なら通知不要
    exit 0
}

$daysMissed = ((Get-Date $today) - (Get-Date $lastRunDate)).Days
if ($daysMissed -le 1) {
    # 前日実行済み(=直近の19時はまだ来ていないだけ)は正常なので通知しない
    exit 0
}

# 同じスキップについて多重通知しないよう、通知済みの日付を記録する
$alreadyNotified = $false
if (Test-Path $notifiedMarkerPath) {
    $notifiedDate = (Get-Content $notifiedMarkerPath -Raw -Encoding utf8).Trim()
    if ($notifiedDate -eq $lastRunDate) {
        $alreadyNotified = $true
    }
}

if (-not $alreadyNotified) {
    $missedDays = $daysMissed - 1
    Send-AlertToSlack -Message ":warning: [aitagger-articles] 自動リサーチが${missedDays}日分スキップされました(前回実行日: $lastRunDate)。19時にPCが起動していなかったためです。次にPCが19時に起動しているタイミングで自動実行されます。"
    $lastRunDate | Out-File -FilePath $notifiedMarkerPath -Encoding utf8 -Force
}
