param(
    [switch]$SkipAlert,
    [int]$Count = 10,
    [switch]$NoRetry,
    [string]$Model = "",
    [string]$Effort = ""
)

$ErrorActionPreference = "Stop"

# claude CLIとのやり取りはUTF-8だが、PowerShell 5.1はコンソールの既定コードページ
# (日本語環境ではCP932)で入出力をデコード/エンコードするため文字化けする。
# コマンドライン引数としてプロンプトを渡すと同様に化けるため、標準入力経由で渡す方式にし、
# 入出力エンコーディングを明示的にUTF-8へ切り替える
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$repoRoot = Split-Path -Parent $PSScriptRoot
$promptPath = Join-Path $PSScriptRoot "nightly-research-prompt.md"
$logDir = Join-Path $repoRoot "scripts\logs"
$pidPath = Join-Path $logDir "current-run.pid"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}

# 個々の実行(Invoke-ResearchRun)をまたぐ制御ログ(待機・リトライの状況を記録する常設ファイル)。
# 「Write-Hostだけでコンソールが閉じると記録が残らない」事故(2026-09-18判明)を防ぐため、
# 待機・リトライに関する出力は必ずこのファイルにも書く。
$controlLogPath = Join-Path $logDir "nightly-research-control.log"
function Write-ControlLine {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    Add-Content -Path $controlLogPath -Value $line -Encoding utf8
}

# ツール名を日本語に対応させる表
$toolLabels = @{
    "Bash"      = "コマンド実行"
    "Read"      = "ファイル読み込み"
    "Write"     = "ファイル作成"
    "Edit"      = "ファイル編集"
    "Glob"      = "ファイル検索"
    "Grep"      = "文字列検索"
    "WebFetch"  = "Webページ取得"
    "WebSearch" = "Web検索"
}

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

    if ($SkipAlert) { return }

    $webhookUrl = Get-AlertWebhookUrl
    if (-not $webhookUrl) {
        Write-Warning "alertSlackWebhookUrl が automation/config.local.json に未設定のため、アラート通知をスキップします"
        return
    }

    $payload = @{ text = $Message } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $payload -ContentType "application/json; charset=utf-8" | Out-Null
    } catch {
        Write-Warning "Slackアラート送信に失敗しました: $_"
    }
}

# 利用上限エラーのメッセージ("You've hit your session limit — resets 10pm (Asia/Tokyo)"等)から
# リセット時刻を読み取り、その時刻(すでに過ぎていれば+1日)を返す。読み取れなければ$nullを返す
function Get-RetryTime {
    param([string]$ErrorText)

    if ($ErrorText -notmatch 'resets\s+(\d{1,2})(am|pm)') {
        return $null
    }
    $hour = [int]$matches[1]
    $ampm = $matches[2]
    if ($ampm -eq 'pm' -and $hour -ne 12) { $hour += 12 }
    if ($ampm -eq 'am' -and $hour -eq 12) { $hour = 0 }

    $now = Get-Date
    $retryTime = Get-Date -Hour $hour -Minute 5 -Second 0
    if ($retryTime -le $now) {
        $retryTime = $retryTime.AddDays(1)
    }
    return $retryTime
}

# 1回分の自動リサーチ実行。成功時は$true、失敗時は$falseとその理由を返す
function Invoke-ResearchRun {
    param(
        [int]$RunCount,
        [string]$RunModel = $Model,
        [string]$RunEffort = $Effort
    )

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $logPath = Join-Path $logDir ("nightly-research-{0}.log" -f $timestamp)
    $summaryLogPath = Join-Path $logDir ("nightly-research-{0}-summary.log" -f $timestamp)
    $stdOutPath = Join-Path $logDir ("nightly-research-{0}-stdout.jsonl" -f $timestamp)
    $stdErrPath = Join-Path $logDir ("nightly-research-{0}-stderr.log" -f $timestamp)

    $summaryUtf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $summaryStream = New-Object System.IO.FileStream($summaryLogPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
    $summaryWriter = New-Object System.IO.StreamWriter($summaryStream, $summaryUtf8NoBom)
    $summaryWriter.AutoFlush = $true

    function Write-SummaryLine {
        param([string]$Message)
        $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message
        # Add-Contentは呼び出し毎にファイルを開閉するためロック競合や書き込み遅延が起きやすい。
        # 開きっぱなしのStreamWriter+AutoFlushで即座にディスクへ反映し、tail側が確実に読めるようにする
        # (2026-09-17、要約ログが5行で止まって見える事故が発生したための対策)。
        $summaryWriter.WriteLine($line)
        Write-Host $line
    }

    Set-Location $repoRoot

    # 前回実行が利用上限等で中断した場合、automation/articles-batch-*.json に
    # 未コミットの調査途中データが残っていることがある。放置すると次回実行時にClaudeが
    # それを発見して「調査済みデータの再利用」と自己判断し、WebSearchをスキップして
    # 古いデータのまま処理してしまう(2026-09-17判明。実害はなかったが偶然による)。
    # 毎回必ずゼロから調査させるため、gitで未追跡(untracked)のarticles-batch-*.jsonを
    # 実行前に削除する。git管理下にある正規のバッチファイルは対象外(誤削除防止)。
    $untrackedBatchFiles = git status --porcelain automation/ 2>$null |
        Where-Object { $_ -match '^\?\? automation/(articles-batch-.*\.json)$' } |
        ForEach-Object { Join-Path $repoRoot "automation\$($matches[1])" }
    foreach ($f in $untrackedBatchFiles) {
        if (Test-Path $f) {
            Remove-Item -Path $f -Force
            Write-SummaryLine "前回実行の未コミット残骸を削除しました: $(Split-Path $f -Leaf)"
        }
    }

    # 下限本数(-Count)と、その150%(CLAUDE.md記載の上限ルール)を計算し、
    # プロンプト内の {{MIN_COUNT}} / {{MAX_COUNT}} を置換する
    $minCount = $RunCount
    $maxCount = [math]::Ceiling($RunCount * 1.5)
    $promptText = (Get-Content $promptPath -Raw -Encoding utf8) `
        -replace '\{\{MIN_COUNT\}\}', $minCount `
        -replace '\{\{MAX_COUNT\}\}', $maxCount
    $renderedPromptPath = Join-Path $logDir ("nightly-research-{0}-prompt.md" -f $timestamp)
    $promptText | Out-File -FilePath $renderedPromptPath -Encoding utf8

    # 自分のPIDを記録する。scripts/stop-research.ps1 が安全な強制終了に使う
    $PID | Out-File -FilePath $pidPath -Encoding ascii -Force

    $modelInfo = if ($RunModel) { $RunModel } else { "既定" }
    $effortInfo = if ($RunEffort) { $RunEffort } else { "既定" }
    Write-SummaryLine "aitagger-articles 自動リサーチを開始します(PID: $PID / 目標本数: ${minCount}〜${maxCount}本 / モデル: $modelInfo / 推論レベル: $effortInfo)"
    Write-SummaryLine "詳細ログ(生データ): $logPath"
    Write-SummaryLine "要約ログ(このファイル、実行中もtail可): $summaryLogPath"
    Write-SummaryLine "強制終了する場合: scripts\stop-research.ps1"

    # claude CLIへの追加引数を組み立てる(-Model/-Effort未指定時は既定のまま渡さない)
    $claudeExtraArgs = @()
    if ($RunModel) { $claudeExtraArgs += @("--model", $RunModel) }
    if ($RunEffort) { $claudeExtraArgs += @("--effort", $RunEffort) }

    try {
        # claude -p --output-format stream-json でツール呼び出し単位のイベントを逐次受け取り、
        # 詳細ログ($logPath)には生JSONを、要約ログ($summaryLogPath)には日本語1行要約を書く。
        # プロンプトはコマンドライン引数ではなく標準入力(-p単体)で渡す。引数渡しだとPowerShellの
        # コードページ変換で日本語が文字化けするため。
        Get-Content $renderedPromptPath -Raw -Encoding utf8 | & claude -p --output-format stream-json --verbose --allowedTools "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch" @claudeExtraArgs 2>$stdErrPath | ForEach-Object {
            $line = $_.ToString()
            $line | Out-File -FilePath $stdOutPath -Append -Encoding utf8

            try {
                $event = $line | ConvertFrom-Json -ErrorAction Stop
                if ($event.type -eq "assistant" -and $event.message.content) {
                    foreach ($block in $event.message.content) {
                        if ($block.type -eq "tool_use") {
                            $label = $toolLabels[$block.name]
                            if (-not $label) { $label = $block.name }
                            $detail = ""
                            if ($block.input.description) {
                                $detail = " - $($block.input.description)"
                            } elseif ($block.input.command) {
                                $detail = " - $($block.input.command)"
                            } elseif ($block.input.file_path) {
                                $detail = " - $($block.input.file_path)"
                            } elseif ($block.input.query) {
                                $detail = " - $($block.input.query)"
                            } elseif ($block.input.url) {
                                $detail = " - $($block.input.url)"
                            }
                            if ($detail.Length -gt 100) { $detail = $detail.Substring(0, 100) + "..." }
                            Write-SummaryLine ("  → {0}{1}" -f $label, $detail)
                        } elseif ($block.type -eq "text" -and $block.text) {
                            $text = $block.text.Trim()
                            if ($text) {
                                if ($text.Length -gt 200) { $text = $text.Substring(0, 200) + "..." }
                                Write-SummaryLine ("  💬 {0}" -f $text)
                            }
                        }
                    }
                } elseif ($event.type -eq "result") {
                    Write-SummaryLine ("処理完了。ターン数: {0} / 所要時間: {1}秒" -f $event.num_turns, [math]::Round($event.duration_ms / 1000))
                }
            } catch {
                # JSONとして読めない行（先頭バナー等）はそのまま無視。要約ログには出さない
            }
        }

        # claudeプロセス自体の終了コードを確実に取得
        $claudeExitCode = $LASTEXITCODE

        $rawOutputText = ""
        if (Test-Path $stdOutPath) {
            $rawOutputText = Get-Content $stdOutPath -Raw -Encoding utf8
        }

        # 最後のresultイベント(is_error等)も個別に確認する。$claudeExitCodeだけに頼ると、
        # claude CLI自体が0を返しつつ内部的にはAPIエラーで終わっているケース
        # (セッション利用上限到達等)を見逃す可能性があるための保険
        # (2026-09-17、上限到達で自動リサーチが無通知のまま終了した事故を受けての対策)。
        $lastResultLine = $null
        if (Test-Path $stdOutPath) {
            $lastResultLine = Get-Content $stdOutPath -Encoding utf8 | Where-Object { $_ -match '"type":"result"' } | Select-Object -Last 1
        }
        $resultIsError = $false
        $resultErrorText = ""
        if ($lastResultLine) {
            try {
                $resultEvent = $lastResultLine | ConvertFrom-Json -ErrorAction Stop
                if ($resultEvent.is_error -eq $true) {
                    $resultIsError = $true
                    $resultErrorText = $resultEvent.result
                }
            } catch {}
        }

        $failed = $false
        $reason = ""

        if ($claudeExitCode -ne 0) {
            $failed = $true
            $reason = "claude CLI がゼロ以外の終了コード ($claudeExitCode) で終了しました"
        } elseif ($resultIsError) {
            $failed = $true
            $reason = "claude CLI がエラー終了しました: $resultErrorText"
        } elseif ($rawOutputText -match "NIGHTLY_RESEARCH_FAILED:\s*(.+)") {
            $failed = $true
            $reason = $matches[1]
        } elseif (-not $rawOutputText) {
            $failed = $true
            $reason = "claude CLI から出力が得られませんでした(強制終了された可能性があります)"
        }

        if ($failed) {
            Write-SummaryLine "失敗: $reason"
        } else {
            Write-SummaryLine "自動リサーチが完了しました"
        }

        return @{
            Success        = -not $failed
            Reason         = $reason
            ErrorText      = $resultErrorText
            SummaryLogPath = $summaryLogPath
            LogPath        = $logPath
        }
    } finally {
        $summaryWriter.Close()
        Remove-Item -Path $pidPath -Force -ErrorAction SilentlyContinue
    }
}

# 1回目を実行
Write-ControlLine "1回目の実行を開始します(目標本数: $Count)"
$result = Invoke-ResearchRun -RunCount $Count

if ($result.Success) {
    Write-ControlLine "1回目の実行が成功しました"
    exit 0
}

Write-ControlLine "1回目の実行が失敗しました: $($result.Reason)"

# 失敗時、利用上限エラーであればリセット時刻まで自動で待って1回だけリトライする
# (2026-09-17、セッション利用上限でチャット作業と共倒れになり、無通知のまま終了した
# 事故を受けての対策。手動での再実行を待たずに済むようにする)。
#
# 待機はStart-Sleepの単発カウントダウンではなく、実時刻(Get-Date)を都度比較するポーリングにする
# (2026-09-18、PCがスリープ→復帰した際にStart-Sleepのカウントダウンが実質止まってしまい、
# リセット時刻を過ぎてもリトライが始まらない事故が発生したための対策。スリープ中はポーリング自体も
# 止まるが、復帰した瞬間に「もう過ぎている」と気づいてすぐリトライへ進める)。
$retryTime = $null
if (-not $NoRetry) {
    $retryTime = Get-RetryTime -ErrorText $result.ErrorText
}

if ($retryTime) {
    Write-ControlLine "利用上限のため失敗しました。リセット時刻($retryTime)まで待って自動リトライします。"
    Send-AlertToSlack -Message ":warning: [aitagger-articles] 自動リサーチが利用上限で失敗しました。リセット時刻($retryTime)まで待って自動リトライします。`n理由: $($result.Reason)`n要約ログ: $($result.SummaryLogPath)"

    $lastProgressLog = Get-Date
    while ((Get-Date) -lt $retryTime) {
        Start-Sleep -Seconds 30
        # スリープ跨ぎでも状況が分かるよう、10分に1回だけ「待機中」を記録する(ログが埋まりすぎないため)
        if (((Get-Date) - $lastProgressLog).TotalMinutes -ge 10) {
            $remainingMinutes = [math]::Ceiling(((New-TimeSpan -Start (Get-Date) -End $retryTime).TotalMinutes))
            Write-ControlLine "リトライ待機中(あと約${remainingMinutes}分。PCがスリープしていた場合はこのタイミングで復帰を検知)"
            $lastProgressLog = Get-Date
        }
    }

    Write-ControlLine "リセット時刻を過ぎたためリトライを開始します"
    $retryResult = Invoke-ResearchRun -RunCount $Count

    if ($retryResult.Success) {
        Write-ControlLine "リトライが成功しました"
        exit 0
    } else {
        Write-ControlLine "リトライも失敗しました: $($retryResult.Reason)"
        $alertMessage = ":rotating_light: [aitagger-articles] 自動リサーチがリトライ後も失敗しました`n理由: $($retryResult.Reason)`n要約ログ: $($retryResult.SummaryLogPath)`n詳細ログ: $($retryResult.LogPath)`nPC上で実行してください: scripts\nightly-research.ps1"
        Send-AlertToSlack -Message $alertMessage
        exit 1
    }
} else {
    Write-ControlLine "利用上限エラーではない(またはリセット時刻を読み取れない)ため、リトライせずに終了します"
    $alertMessage = ":rotating_light: [aitagger-articles] 自動リサーチが失敗しました`n理由: $($result.Reason)`n要約ログ: $($result.SummaryLogPath)`n詳細ログ: $($result.LogPath)`nPC上で実行してください: scripts\nightly-research.ps1"
    Send-AlertToSlack -Message $alertMessage
    exit 1
}
