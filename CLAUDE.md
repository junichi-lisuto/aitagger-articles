# aitagger-tools-site

**AIタッガー利用者向け「AI検索を知る」記事メディアのデータ管理リポジトリ。**

このリポジトリの役割は**記事データ（HTML本文＋メタ情報）の管理のみ**。
表示は **Unbounce**（LISUTO契約済み、矢頭が管理者アカウントを保有）が担う。
ツール（CSV加工・他ツール連携等）はこのリポジトリの対象外（2026-09-16 方針転換）。

`dev\gas-sales-console`（社内向けSales Console）とは**別プロジェクト**。
読み手が社外のお客様であり、顧客情報を置かない規律が正反対なので同居させない。

---

## 方針転換の経緯（2026-09-16）

以前は「ツール」と「記事」を同居させた公開サイト（`tools.lisuto.co.jp`想定）として設計していた。
実装済みツール11本・モックアップも作ったが、**表示はUnbounceに一本化し、この場所は記事データの
管理に専念する**方針に転換した。

- **表示ページ = Unbounce**。矢頭が管理者アカウントを保有し、LISUTOで契約済み
- **このリポジトリ = 記事データの管理のみ**。articles/ の記事HTML・メタ情報・収集/承認フロー（automation/）を扱う
- 実装済みだったツール一式（`tools/`）とツール用モックアップは**削除済み**（矢頭の判断、復元予定なし）
- 旧`index.html`のツール一覧セクションは削除し、**記事一覧のみの簡易ビュー**に縮小した
  （Unbounce連携までの参照用。Unbounceが本番表示になった段階で扱いを再検討する）

**旧方針だったパスワード保護・`tools.lisuto.co.jp`開設・ブラウザ完結ツールの各決定は、
ツールを扱わなくなったため無効。** 本ファイルの以降の記述は記事メディアの運用に絞る。

---

## 最重要: 顧客情報を置かない

このリポジトリの中身は**最終的に社外へ公開される**（Unbounce経由）。

- **企業名・担当者名・金額・ストアコードを、記事本文にも下書きにも置かない**
- 例が要るときは「A社」「sample-shop」のような仮名にする
- スクリーンショットを貼るときは、実データが写っていないか必ず確認する

`gas-sales-console` は顧客情報を扱う前提のリポジトリだが、**ここは逆**。

---

## このリポジトリの構成

| フォルダ/ファイル | 中身 |
|---|---|
| `articles/` | 公開済み記事のHTML本文（1記事1ファイル） |
| `automation/` | 記事の収集・承認フロー（Slack連携スクリプト） |
| `mockups/` | 記事関連の下書き・プレビューHTML |
| `index.html` | 記事一覧の簡易ビュー（Unbounce連携までの参照用） |
| `used-source-urls.md` | 既出の元記事URL一覧（自動生成、下記参照） |

### 記事の型

**サムネイル / 出典バッジ / 日付 / タイトル / 箇条書き3行** が1記事の基本情報。

**カテゴリは3軸で管理する（2026-09-16、schemaVersion:2で刷新）。** 単一カテゴリ
（旧: AI検索/SEO/楽天AI/Yahoo!AI）は「どこで起きたか」と「読者は何をすべきか」が
混在しており、記事が増えるほど分類に無理が出ていたため分離した。

- `platforms`（配列、複数可）: `google` / `chatgpt` / `rakuten` / `yahoo` / `other-ai` / `amazon`
- `viewpoint`（単一）: `seller`=出店者が今すぐ使える対策 / `buyer`=購入者の行動がどう変わったかという事実
- `theme`（単一）: `visibility`=検索結果・購買導線の変化 / `optimization`=商品情報・タグ付け対策 / `measurement`=計測・分析

Unbounce埋め込み（`unbounce-embed.html`）では`platforms`をタブとして表示する。`theme`は
カードのバッジ色として表示する。**`viewpoint`はデータとしては持つがUIタブには出さない**
（2026-09-16、一度は最上段セグメントとして実装したが撤回）。読者は全員EC運営者＝全員が
「売り手」であり、seller/buyerという人物属性でタブを分けると「自分は売り手なのに買い手
タブを見るべきか」と迷わせる。加えて実データがbuyer視点（プラットフォーム側発表の後追い）に
大きく偏っており、タブとして機能する分布ではなかった。seller視点の記事が十分に増えた段階で
UI復活を再検討する。

`theme`の網羅（特に`optimization`＝出店者が今すぐ使える対策）が構造的に手薄になりがちなため、
Codexへの依頼はテーマごとの本数を数値で明示する（例:「30本、visibility/optimization/measurement
各10本」）。比率ノルマ（「本数◯、うち◯本はこのテーマ」）は水増しを誘発したため撤廃した。

**サムネは必ず元記事のOGP画像（`og:image`）を使う。** `articles/`のHTML（`.thumb`内の`<img src="...">`）と
`articles.json`の`thumbnail`（`{"type":"image","url":"..."}`）の両方に反映する。取得できたのに
`{"type":"default", "category":"..."}`のまま放置しない（過去に取得を怠り3記事がSVG仮アイコンのままになっていた）。
色と図形だけのSVGは、`og:image`が本当に存在しない記事だけの最終手段とする。

### Codexへのリサーチ依頼で必ず守ること（2026-09-16、30本一括依頼の失敗から確立）

Codexへの依頼を作る前に、必ず
[codex-workspace/research/articles/依頼テンプレート.md](../codex-workspace/research/articles/依頼テンプレート.md)
を読んでコピーして使うこと（`codex-workspace`はGitHub管理外のローカルのみのため、
別セッション・別マシンではこのファイル自体にアクセスできない場合がある。その場合は
以下の要点だけでも必ず守ること）。

1. **URL・サムネイル画像URLは、200 OKかつ実際に中身が表示されることを確認する。**
   403/404は理由を問わず即NG。「bot対策で弾かれているだけ」と自己判断して見逃さない
   （実際に`storage.googleapis.com`のGCSアクセス拒否を403＝bot判定と誤認し、
   14件のサムネイルが壊れたまま公開してしまった事例がある）
2. **サムネイル画像URLは、元記事ページの`og:image`メタタグに実際に書かれている値
   そのものを使う。** 記事内容から画像ファイル名を推測して作らない（Codexが記事内容を
   もとに実在しないファイルパスを捏造し、10件が壊れていた事例がある）。低解像度版
   （`width-200`等）も使わない
3. **鮮度は「本数の少なくとも半数を直近3ヶ月以内」を数値で強制する。** 「直近3ヶ月を
   優先する」という努力目標の書き方では実効性がなく、30本中実質0本しか満たさなかった。
   探す順番も「直近1ヶ月→1〜3ヶ月→3ヶ月〜1年」の順に広げるよう指定し、見つけやすい
   古い記事に先に飛びつく癖を探索順序自体で防ぐ
4. **依頼内で集める記事どうし・サムネイル画像どうしの重複も、既出URLと同様にチェックする**
   （既出URLとの重複だけでなく、今回の依頼内での重複も別途確認が必要）

反映後は必ずClaude自身も機械的な実在確認（curl等でHTTPステータス確認）を行い、
「Codexが確認した」という報告を鵜呑みにしない。

### Codex CLI (`codex.exe exec`) が別セッションで実行できない場合（2026-09-16判明・解決済み）

Codex連携はVS Code拡張同梱の`codex.exe`（`C:\Users\junic\.vscode\extensions\openai.chatgpt-<version>-win32-x64\bin\windows-x86_64\codex.exe`、`codex login`済み）を
`Bash`ツールから直接呼ぶ方式（本ファイル冒頭の記事収集フロー参照）。

**あるセッションでは`codex.exe exec`が問題なく実行できるのに、別セッション（特に
「自動モード／auto mode」）では「Create Unsafe Agents」ルールで拒否される、ということが
起きた。** 原因はCodex連携の仕組みが壊れたのではなく、**`codex.exe`実行の恒久的な許可
ルールが`~/.claude/settings.json`に存在しなかった**ため。都度の確認プロンプトが出るモード
ではその場で承認できていたが、自動モードは未承認のコマンド実行を安全側で自動拒否するため、
確認プロンプト自体が発生せずブロックされた。

**解決済み（2026-09-16、矢頭さんが`~/.claude\settings.json`に追記）:**
```json
"permissions": {
  "allow": [
    "Bash(*/openai.chatgpt-*/bin/windows-x86_64/codex.exe exec *)",
    "Bash(*/openai.chatgpt-*/bin/windows-x86_64/codex.exe login *)"
  ]
}
```
これはユーザーのグローバル設定（全プロジェクト共通）に入っているため、以後どのセッション・
どのプロジェクトからでも`codex.exe exec`は都度確認なしで実行できるはずである。

**重要: この許可ルールの追加はClaude自身では絶対に行えない。** 自動モードには
「Self-Modification（自己書き換え）防止」の安全装置があり、自分の権限設定ファイルを
自分で書き換える操作は、どんな正当な理由を提示しても一律拒否される（設計上意図的な
制約であり、バグでも回避すべき対象でもない）。もし将来また同様のブロックに遭遇した場合、
Claudeにできることは原因説明までで、`settings.json`の編集自体は矢頭さんご本人に
依頼する必要がある。

リンク集は腐る。**厳選して少数を保つ**。各記事に「なぜ読むべきか」が伝わる箇条書きを付け、
公開日を入れて更新されている証拠を見せる。

### 記事の収集・承認フロー

**矢頭さんは「番号リストのテキスト」ではなく「実際に描画されたページ」を見てから承認・否認したい、
という要望（2026-09-16確認）に基づき、承認前にHTML化してGitHub Pages上のdraft URLとして
見せる方式にしている。** Slack Incoming Webhookは投稿専用で矢頭さんの返信を受信できないため、
承認の意思表示は必ずClaude Codeのチャットで直接行う（Slack上で返信しても検知されない）。

```
1. Codex: 元記事を調査し、下書きMarkdownに背景・ポイント3行までを書く
           （「AIタッガーユーザーへの意味」パートはここでは書かない）
2. Claude: 下書きを受け取り「意味」パートを書き足し、記事HTMLを articles/draft/<slug>.html に生成。
           対応するメタ情報（articles.json登録用の1件分）を automation/draft-meta/<slug>.json に保存。
           git push（articles/draft/ 配下はarticles.json未登録のため一覧・Unbounceには一切出ない）
3. Claude: Slack通知（下書きURL付き）を投稿
     node automation/post-articles-to-slack.js <slug> <slug> ...
4. 矢頭さん: 通知内のGitHub Pages URL（articles/draft/<slug>.html）で実際のページを確認し、
           Claude Codeのチャットで「1と3を承認」のように直接伝える
5a. 承認: node automation/promote-draft.js <slug> <slug> ...
     → articles/draft/ から articles/ 直下へ移動、articles.jsonに登録、
       used-source-urls.md再生成まで一括実行。その後 git push。
5b. 否認: node automation/reject-draft.js <slug> <slug> ...
     → draftのファイルを削除するだけ。articles.json未登録なので実害なし。
```

**承認push後、Unbounce側のトップページに反映されるまで数十秒のタイムラグがある**
（2026-09-16確認。GitHub Pages・articles.jsonは即時反映されているが、Unbounce側のCDN/ページ
キャッシュ由来と見られる遅延がある）。すぐ表示されなくても異常ではないので、数十秒〜数分待って
から再確認する。

`automation/config.local.json`（gitignore対象）にSlack Webhook URLを置く。
`config.local.json.example` がテンプレート。

**既出の元記事URLは、Codexへのリサーチ依頼前に`used-source-urls.md`で除外する**（下記参照）。
promote-draft.js実行時にも自動再生成されるため、都度手動実行し忘れても次の昇格時に追いつく。

### 重複記事の防止（Codexへの依頼時点で除外する）

**テーマがかぶるのは問題ないが、同じ元記事URLの再利用はNG。** 出来上がってからSlackで弾かれるのでは
遅い。**記事候補を探す作業をCodexに依頼する前に、必ず`used-source-urls.md`を読み込ませ、
そこに載っているURLと同じ元記事は調査対象から外すよう指示すること。**

`used-source-urls.md`は`articles.json`の`sourceUrl`一覧から生成される。
`articles.json`に記事を追加したら、都度これを実行して最新化する。

```
node automation/generate-used-urls.js
```

---

## 色（記事メディアとして使うもの）

AIタッガー管理画面の青系トーンを踏襲する。新しい色を増やさない。

| 用途 | 値 |
|---|---|
| アクセント | `#2563EB` |
| 見出し | `#1E3A8A` |
| 本文 | `#0F172A` / 補助 `#475569` / 薄 `#64748B` |
| 罫線 | `#E2E8F0` / 面の色 `#F8FAFC` |

テーマバッジ色: 検索結果・購買導線の変化(visibility)=青`#2563EB` / 商品情報・タグ付け対策(optimization)=紫`#7C3AED` / 計測・分析(measurement)=赤`#DC2626`

---

## 実装で踏んだ罠（記事HTML・簡易ビューに引き続き有効）

### `[hidden]` は `display` 指定に負ける

`display:flex` や `display:grid` を持つ要素に `hidden` を付けても**消えない**。
CSSの先頭に必ず書く:

```css
[hidden]{display:none!important}
```

絞り込み・タブ・画面の出し分けを作ったら、**書いた直後に機械で確認する**。
目視では「消えていない」ことに気づきにくい。

```bash
node -e "const h=require('fs').readFileSync('ファイル','utf8');
const css=h.match(/<style>([\s\S]*?)<\/style>/)[1];
console.log(/\[hidden\]\s*\{[^}]*display\s*:\s*none/.test(css)?'OK':'NG');"
```

### HTML内の `<script>` は構文チェックされない

`node --check` は `.js` しか見ない。`<script>` を書いたら `vm.Script` に通す。
参照している `id` が実在するかも併せて確認する（打ち間違いは実行するまで分からない）。

---

## Unbounce連携（次のステップ）

準備手順はチャットで都度確認する（本ファイルには最新の決定事項のみ反映していく）。
連携が固まり次第、ここに手順・API/エクスポート方式・記事データの受け渡しフォーマットを追記する。

---

## 矢頭さんとのやりとり

グローバルの `~\.claude\CLAUDE.md` に詳しい。ここでは特に効くものだけ:

- **日本語で書く**（説明・質問・コミットメッセージすべて）
- **推奨を1つ言い切る。**選択肢の羅列を嫌う。ループを何より嫌う
- **まず成果物を出してから分岐を示す。**一度出したものを自分から蒸し返さない
- **前提を疑う役をやる。**決断が速いぶん、前提が誤っているときに気づくのが遅れる
