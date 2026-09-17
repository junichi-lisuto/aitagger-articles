【重要】これはWindowsタスクスケジューラーによる完全非対話の自動実行です。矢頭さんは今この場におらず、
質問しても誰も答えられません。AskUserQuestionツールは使わないでください。選択肢や確認事項が生じた場合は、
本プロンプトおよびCLAUDE.mdの記載に基づき自分で判断し、最後まで作業を完遂してください。
「今回は何をしましょうか」のような確認で止まることは禁止です。すぐに手順の実行を開始してください。

このリポジトリ (aitagger-articles) の CLAUDE.md を必ず最初に読み、そこに書かれた「記事の収集・承認フロー」の手順1〜4
（リサーチ → 既出URL照合 → 実在確認 → og:image取得 → HTML生成 → draft push → Slack通知）を実行してください。
CLAUDE.md内の「Codexへのリサーチ依頼で必ず守ること」および「2026-09-17 リサーチはCodexからClaude単体に移行」の節に
書かれた注意点（重複検出、一次情報の格付け基準、Cloudflare配下ドメインの実在確認方法、og:imageのCross-Origin-Resource-Policy
確認など）もすべて厳守してください。

## 収集方針

- 探索対象は直近1週間以内に公開された記事を優先する。日付の新しいものから優先的に採用する
- 収集本数は{{MIN_COUNT}}本を下限とする。CLAUDE.md記載の「依頼本数の150%を上限」ルールに従い、基準を満たす
  良質な候補が複数見つかった場合は{{MAX_COUNT}}本まで増やしてよい。基準を満たす候補が{{MIN_COUNT}}本に
  満たない場合でも、本数を埋めるために採用基準を緩めないこと（下回って提出することより基準を緩めることの
  方がNG、という優先順位はCLAUDE.mdの記載通り）
- テーマ(platforms/viewpoint/theme)の配分は指定しない。CLAUDE.mdの通常運用（theme網羅、特にoptimizationが
  手薄にならないよう配慮）に従う
- 元記事の言語配分: 収集本数のうち3割程度(10本なら3本、15本なら4〜5本)は、元記事(sourceUrl先)が
  英語等の海外言語で書かれた記事にすること。日本語メディアが海外の発表を後追いした記事ではなく、
  海外メディア・海外企業公式ブログ・海外SEOベンダー等の記事そのものを元記事として採用する。
  3割に届く海外記事の候補が見つからない場合でも、採用基準(実在確認・重複除外・一次情報の格付け)は
  緩めない。日本語記事の質を落として無理に海外記事の比率を埋めることもしない

## 手順ごとの注意

1. リサーチ: WebSearch/WebFetchを使い、直近1週間以内を優先して記事候補を集める。背景・結論（元の数値・
   固有名詞を含む箇条書き、篇数無制限）を作成する。automation/配下に既存のarticles-batch-*.jsonが
   残っていても、それを調査済みデータとして再利用しないこと。必ず今回のWebSearch/WebFetchで
   ゼロから調査し直す（過去の中断実行が残した古い・未検証のデータを引き継がないため）。
   **文体は「である」調（言い切り）で統一し、「です・ます」調は使わない。**「結論」は
   ページ本文にある実際の数値（%・件数・期間等）と固有名詞をそのまま拾い、主観的な
   言い換えでぼかさない。件数だけの記述で終えず、その中身を具体的に列挙する
   （CLAUDE.mdの該当節を必ず参照すること）
2. 既出URL照合・実在確認・og:image取得: automation/generate-used-urls.js相当のused-source-urls.mdと、
   候補記事URLをすべて機械的に突き合わせる（1件でも一致したら理由を問わず除外）。残った候補URLは全件curlで
   200 OK確認する。og:imageもcurlで取得し、200 OK確認とCross-Origin-Resource-Policyヘッダーの確認
   （same-site/same-originなら候補から除外）を行う
3. HTML生成: 「メッセージ」パートを書き足し、articles/draft/<slug>.html を生成する（背景/結論/メッセージの
   3セクション構成）。カード用bullets（articles.json登録用、automation/draft-meta/<slug>.jsonに保存）は
   必ず3件・1件55文字以内で別途書き直す。結論の全項目をそのまま流用しない
4. git push: articles/draft/ と automation/draft-meta/ をpushする

## 完了後

Slack通知は automation/config.local.json の slackApprovalWebhookUrl 宛てに、automation/post-articles-to-slack.js
と同等の内容（各draftのGitHub Pages URL付き）で投稿すること。

## 絶対に行わないこと

- 承認作業は行わない。手順4のSlack通知までで完了とする
- automation/promote-draft.js は絶対に実行しない。articles.jsonへの昇格・記事の本番反映は一切行わない。
  承認は矢頭さんが別途チャットで行う

## 最後に

作業の最後に、(a) draft pushが成功したこと、(b) Slack通知が成功したこと、(c) 収集した記事の本数と各slug一覧
（元記事が海外言語のものには「海外」と付記する）、を明記して終了すること。もし途中でエラーが発生し
完遂できない場合は、その理由を明記した上で「NIGHTLY_RESEARCH_FAILED: <理由>」という行を出力の最後に
必ず含めること（失敗検知に使う）。
