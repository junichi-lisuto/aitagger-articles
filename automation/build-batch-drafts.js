// 記事一括投入用: articles-batch*.json を読み、articles/draft/*.html と
// automation/draft-meta/*.json を一括生成する。
// 見出し構成は「背景」「結論」「メッセージ」で固定（2026-09-16改訂）。
//   - background: 何が起きたか・何が公開されたか・なぜ公開されたか
//   - bullets（記事詳細ページの「結論」箇条書き）: 数の制限なし。記事本文を読まずとも
//     要点・数値が分かる粒度で書く。単なる事実の要約でなく「何が示されたか」「何が変わったか」まで書く
//   - cardBullets（トップページ一覧カードの要点。**必ず3件**、2026-09-16追加）:
//     bulletsとは別物。カードは幅が狭くレイアウトが崩れるため3件固定。
//     全文を読まなくても概要がつかめるキャッチーな短い要点3つにする
//     （bulletsから最重要3つを選ぶのではなく、カード用に短く書き直す）
//   - meaning（メッセージ）: タグ付け・構造化に限定しない、EC店長への気づき。
//     結果としてタグ付け関連の話になるのは良いが、それを前提にしない
// 使い方: node automation/build-batch-drafts.js <articles-batch-N.json のパス>
//   （引数省略時は automation/articles-batch.json を読む）

const fs = require('fs');
const path = require('path');

const dataPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'articles-batch.json');
const draftDir = path.join(__dirname, '..', 'articles', 'draft');
const metaDir = path.join(__dirname, 'draft-meta');

const CAT_CLASS = { visibility: 'theme-visibility', optimization: 'theme-optimization', measurement: 'theme-measurement' };
const THEME_LABEL = { visibility: '検索結果・購買導線の変化', optimization: '商品情報・タグ付けの対策', measurement: '計測・分析' };
const PLATFORM_LABEL = { google: 'Google', chatgpt: 'ChatGPT', rakuten: '楽天', yahoo: 'Yahoo!', 'other-ai': 'その他AI検索', amazon: 'Amazon' };
const SITE_TOP_URL = 'https://www.lisuto.co.jp/media/';

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function articleHtml(a) {
  const platformLabel = a.platforms.map(p => PLATFORM_LABEL[p] || p).join('・');
  const points = a.bullets.map(b => `    <li>${esc(b)}</li>`).join('\n');
  const relatedLinks = (a.related || []).map(r => `    <a href="../${esc(r.slug)}.html">${esc(r.title)}</a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }</script>
<title>${esc(a.title)}｜AIタッガー メディアセンター</title>
<style>
  :root{
    --blue:#2563EB;
    --blue-dark:#1E3A8A;
    --blue-wash:#EFF6FF;
    --ink:#0F172A;
    --ink-mid:#475569;
    --ink-soft:#64748B;
    --line:#E2E8F0;
    --tint:#F8FAFC;
    --c-visibility:#2563EB;
    --c-optimization:#7C3AED;
    --c-measurement:#DC2626;
    --maxw:760px;
    --jp:"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,system-ui,sans-serif;
  }
  *{box-sizing:border-box}
  [hidden]{display:none!important}
  body{margin:0;background:#fff;color:var(--ink);font-family:var(--jp);
       font-size:16px;line-height:1.8;-webkit-font-smoothing:antialiased}
  a{color:inherit}
  .wrap{max-width:var(--maxw);margin:0 auto;padding-inline:24px}

  header{border-bottom:1px solid var(--line);background:#fff;position:sticky;top:0;z-index:20}
  .hbar{display:flex;align-items:center;gap:11px;height:68px;max-width:1120px;margin:0 auto;padding-inline:24px}
  .logo{display:flex;align-items:center;gap:11px;font-weight:700;font-size:17px;
        text-decoration:none;flex:none}
  .logo img{display:block;height:34px;width:auto}
  .logo .sub{color:var(--ink-soft);font-weight:500;font-size:13px;
        border-left:1px solid var(--line);padding-left:11px;margin-left:2px}

  .crumb{font-size:12.5px;color:var(--ink-soft);padding:16px 0 0}
  .crumb a{text-decoration:none}
  .crumb a:hover{color:var(--blue)}
  .crumb span{margin:0 7px;color:#CBD5E1}

  .thumb{position:relative;display:block;width:100%;padding-top:56.25%;
         overflow:hidden;background:var(--tint);border-radius:12px;
         margin:20px 0;transition:opacity .15s}
  .thumb:hover{opacity:.88}
  .thumb svg,.thumb img{position:absolute;inset:0;width:100%;height:100%;
         display:block;object-fit:cover}

  .meta{display:flex;gap:8px;align-items:center;margin:0 0 12px;flex-wrap:wrap}
  .cat{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;color:#fff}
  .platform{font-size:11px;font-weight:700;color:var(--ink-soft)}
  .cat.theme-visibility{background:var(--c-visibility)}
  .cat.theme-optimization{background:var(--c-optimization)}
  .cat.theme-measurement{background:var(--c-measurement)}
  .src,.date{font-size:12.5px;color:var(--ink-soft)}

  h1{font-size:26px;margin:0 0 8px;line-height:1.5;color:var(--blue-dark)}
  .orig{font-size:13px;color:var(--ink-soft);margin:0 0 28px}

  h2{font-size:15px;letter-spacing:.04em;color:var(--ink-soft);font-weight:700;margin:0 0 12px}
  .background{font-size:15.5px;color:var(--ink);line-height:1.8;margin:0 0 28px}
  .points{margin:0 0 28px;padding:0;list-style:none}
  .points li{font-size:15.5px;line-height:1.8;color:var(--ink);
        padding-left:18px;position:relative;margin-bottom:10px}
  .points li::before{content:"";position:absolute;left:0;top:.75em;
        width:5px;height:5px;border-radius:50%;background:var(--blue)}

  .why{background:var(--blue-wash);border-radius:12px;padding:20px 22px;margin-bottom:28px}
  .why h2{color:var(--blue-dark);margin-bottom:8px}
  .why p{font-size:15px;color:var(--ink);margin:0;line-height:1.8}

  .source-link{display:inline-flex;align-items:center;gap:6px;font-size:14.5px;
        font-weight:600;color:var(--blue);text-decoration:none;margin-bottom:48px}
  .source-link:hover{text-decoration:underline}

  .related{border-top:1px solid var(--line);padding:32px 0 60px}
  .related h2{color:var(--ink);margin-bottom:16px}
  .related a{display:block;font-size:14.5px;color:var(--blue);text-decoration:none;margin-bottom:8px}
  .related a:hover{text-decoration:underline}

  footer{border-top:1px solid var(--line);padding:40px 0 25px;font-size:12px;color:var(--ink-soft);max-width:1120px;margin:0 auto;padding-inline:24px}
  .ftop{display:flex;justify-content:space-between;gap:32px;flex-wrap:wrap;padding-bottom:24px;border-bottom:1px solid var(--line)}
  .fcompany p{margin:0 0 6px}
  .fcompany p:last-child{margin-bottom:0}
  .fname{color:var(--ink);font-size:13px;font-weight:800}
  .fcompany a{color:var(--ink-soft);text-decoration:none}
  .fcompany a:hover{color:var(--blue-dark);text-decoration:underline}
  .flinks{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
  .flinks a{color:var(--ink-mid);text-decoration:none;font-size:12px;font-weight:600}
  .flinks a:hover{color:var(--blue-dark);text-decoration:underline}
  .frow{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-top:20px}

  @media(max-width:560px){
    h1{font-size:21px}
    .flinks{align-items:flex-start}
  }
</style>
</head>
<body>

<header>
  <div class="hbar">
    <a class="logo" href="${SITE_TOP_URL}"><img src="../../assets/logo.svg" alt="AIタッガー"><span class="sub">メディアセンター</span></a>
  </div>
</header>

<div class="wrap">
  <p class="crumb"><a href="${SITE_TOP_URL}">トップ</a><span>›</span><a href="${SITE_TOP_URL}?theme=${esc(a.theme)}">${THEME_LABEL[a.theme]}</a><span>›</span>この記事（下書き・未公開）</p>

  <a class="thumb" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener"><img src="${esc(a.thumbnail)}" alt="" loading="lazy"></a>

  <div class="meta">
    <span class="cat ${CAT_CLASS[a.theme]}">${THEME_LABEL[a.theme]}</span>
    <span class="platform">${esc(platformLabel)}</span>
    <span class="src">${esc(a.source)}</span>
    <span class="date">${esc(a.dateDisplay)}</span>
  </div>
  <h1>${esc(a.title)}</h1>
${a.origTitle ? `  <p class="orig">原題: ${esc(a.origTitle)}</p>\n` : ''}
  <h2>背景</h2>
  <p class="background">${esc(a.background)}</p>

  <h2>結論</h2>
  <ul class="points">
${points}
  </ul>

  <div class="why">
    <h2>メッセージ</h2>
    <p>${esc(a.meaning)}</p>
  </div>

  <a class="source-link" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener">元記事を読む（${esc(a.source)}）↗</a>

  <div class="related">
    <h2>関連記事</h2>
${relatedLinks}
  </div>
</div>

<footer>
  <div class="ftop">
    <div class="fcompany">
      <p class="fname">LISUTO株式会社</p>
      <p>〒106-0032 東京都港区六本木2丁目2-8-9F</p>
      <p><a href="tel:0362777445">03-6277-7445</a> / <a href="mailto:sales@lisuto.com">sales@lisuto.com</a></p>
    </div>
    <nav class="flinks">
      <a href="https://www.lisuto.co.jp/company/" target="_blank" rel="noopener">会社概要</a>
      <a href="https://www.lisuto.co.jp/terms-of-use/" target="_blank" rel="noopener">利用規約</a>
      <a href="https://www.lisuto.co.jp/privacy/" target="_blank" rel="noopener">プライバシーポリシー</a>
    </nav>
  </div>
  <div class="frow"><span>&copy; 2026 LISUTO Inc.</span></div>
</footer>

<script>
window.scrollTo(0,0);
window.addEventListener('load', function(){ window.scrollTo(0,0); });
</script>
</body>
</html>
`;
}

const REQUIRED_FIELDS = ['slug', 'title', 'sourceUrl', 'source', 'date', 'background', 'bullets', 'cardBullets', 'meaning', 'thumbnail'];

// Unbounce一覧カードの箇条書き(.am-points)はfont-size:12px・line-height:1.65・
// 実効幅約360pxで2行までしか表示されない。全角1文字を約12pxとして逆算すると、
// 1項目は全角換算55文字までなら2行に収まる（2026-09-16、カード高さ不揃いの
// 事故を受けて設定）。超過時は自動で切り詰めない（文が不自然に途切れるため）。
// 必ず55文字以内に収まる文章として書き直すこと。
const CARD_BULLET_MAX_LENGTH = 55;

function fullWidthLength(s) {
  // 半角英数記号は0.5文字分としてカウントし、全角換算の文字数を概算する
  let len = 0;
  for (const ch of s) {
    len += /[\x20-\x7E]/.test(ch) ? 0.5 : 1;
  }
  return len;
}

function validateCardBullets(data) {
  const errors = [];
  data.forEach((a, i) => {
    if (!Array.isArray(a.cardBullets) || a.cardBullets.length !== 3) {
      errors.push(`[${i}] ${a.slug || '(slug未設定)'}: "cardBullets" は必ず3件にしてください（現在${(a.cardBullets||[]).length}件）`);
      return;
    }
    a.cardBullets.forEach((b, j) => {
      const len = fullWidthLength(b);
      if (len > CARD_BULLET_MAX_LENGTH) {
        errors.push(`[${i}] ${a.slug}: cardBullets[${j}] が全角換算${len.toFixed(1)}文字あります（上限${CARD_BULLET_MAX_LENGTH}文字）。切り詰めず、${CARD_BULLET_MAX_LENGTH}文字以内に収まる文章に書き直してください: "${b}"`);
      }
    });
  });
  if (errors.length) {
    throw new Error('articles-batch.json の cardBullets が不正です（トップページカードのレイアウト崩れの原因になります）:\n' + errors.join('\n'));
  }
}

function validate(data) {
  const errors = [];
  data.forEach((a, i) => {
    for (const field of REQUIRED_FIELDS) {
      if (!a[field] || (Array.isArray(a[field]) && a[field].length === 0)) {
        errors.push(`[${i}] ${a.slug || '(slug未設定)'}: "${field}" が空です`);
      }
    }
  });
  if (errors.length) {
    throw new Error('articles-batch.json の必須項目が不足しています:\n' + errors.join('\n'));
  }
}

// 「結論」(bullets)に数値が1件も含まれない記事を警告として一覧化する。
// 2026-09-18、公開済み48記事を後追い調査した結果17件が「元記事に数値が
// あるのに結論が行為の要約止まり」というNGだったことが判明したため追加。
// 元記事に本当に数値が存在しない発表記事（機能紹介のみ等）はCLAUDE.md上
// 許容されるため、ここではビルドを止めず警告表示のみに留める。この警告が
// 出た記事は、元記事に本当に数値がないか手動で確認すること。
function warnBulletsWithoutNumbers(data) {
  const hasNumber = (s) => /[0-9０-９]/.test(s);
  const flagged = data.filter(a => Array.isArray(a.bullets) && !a.bullets.some(hasNumber));
  if (flagged.length) {
    console.warn('\n[警告] 以下の記事は「結論」(bullets)に数値が1件も含まれていません。');
    console.warn('元記事に本当に数値がないか（機能紹介のみの発表等）を必ず確認してください:');
    flagged.forEach(a => console.warn(`  - ${a.slug}`));
    console.warn('');
  }
}

function main() {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  validate(data);
  validateCardBullets(data);
  warnBulletsWithoutNumbers(data);
  data.forEach((a) => {
    const html = articleHtml(a);
    fs.writeFileSync(path.join(draftDir, `${a.slug}.html`), html, 'utf-8');

    const meta = {
      slug: a.slug,
      url: `https://junichi-lisuto.github.io/aitagger-articles/articles/${a.slug}.html`,
      sourceUrl: a.sourceUrl,
      platforms: a.platforms,
      viewpoint: a.viewpoint,
      theme: a.theme,
      source: a.source,
      date: a.date,
      title: a.title,
      bullets: a.cardBullets,
      thumbnail: { type: 'image', url: a.thumbnail }
    };
    fs.writeFileSync(path.join(metaDir, `${a.slug}.json`), JSON.stringify(meta, null, 2) + '\n', 'utf-8');
    console.log('生成:', a.slug);
  });
  console.log(`完了: ${data.length}件`);
}

main();
