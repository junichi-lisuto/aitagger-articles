// articles/*.html（既存126本）のヘッダー・フッターをUnbounce側の新デザイン
// （日本語ロゴSVG・「メディアセンター」表記・会社情報付きフッター）に統一する
// 一括移行スクリプト。build-batch-drafts.js のテンプレート変更と対になる。
// 使い方: node automation/migrate-article-header-footer.js

const fs = require('fs');
const path = require('path');

const articlesDir = path.join(__dirname, '..', 'articles');
const SITE_TOP_URL = 'https://www.lisuto.co.jp/media/';

const THEME_LABEL = {
  visibility: '検索結果・購買導線の変化',
  optimization: '商品情報・タグ付けの対策',
  measurement: '計測・分析'
};

const OLD_HEADER_CSS = `  header{border-bottom:1px solid var(--line);background:#fff;position:sticky;top:0;z-index:20}
  .hbar{display:flex;align-items:center;gap:28px;height:68px;max-width:1120px;margin:0 auto;padding-inline:24px}
  .logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;
        text-decoration:none;flex:none}
  .logo .mark{background:var(--blue);color:#fff;font-weight:800;font-size:13px;
        padding:5px 7px;border-radius:5px;letter-spacing:.04em}
  .logo .sub{color:var(--ink-soft);font-weight:500;font-size:13px;
        border-left:1px solid var(--line);padding-left:10px;margin-left:2px}
  nav{margin-left:auto;display:flex;gap:26px;align-items:center}
  nav a{font-size:14px;font-weight:500;color:var(--ink-mid);text-decoration:none;
        padding:6px 0;border-bottom:2px solid transparent}
  nav a:hover{color:var(--blue);border-bottom-color:var(--blue)}`;

const NEW_HEADER_CSS = `  header{border-bottom:1px solid var(--line);background:#fff;position:sticky;top:0;z-index:20}
  .hbar{display:flex;align-items:center;gap:11px;height:68px;max-width:1120px;margin:0 auto;padding-inline:24px}
  .logo{display:flex;align-items:center;gap:11px;font-weight:700;font-size:17px;
        text-decoration:none;flex:none}
  .logo img{display:block;height:34px;width:auto}
  .logo .sub{color:var(--ink-soft);font-weight:500;font-size:13px;
        border-left:1px solid var(--line);padding-left:11px;margin-left:2px}`;

const OLD_FOOTER_CSS = `  footer{border-top:1px solid var(--line);padding:34px 0;font-size:13px;color:var(--ink-soft)}
  .frow{display:flex;gap:24px;align-items:center;flex-wrap:wrap;max-width:1120px;margin:0 auto;padding-inline:24px}

  @media(max-width:560px){
    h1{font-size:21px}
    nav{display:none}
  }`;

const NEW_FOOTER_CSS = `  footer{border-top:1px solid var(--line);padding:40px 0 25px;font-size:12px;color:var(--ink-soft);max-width:1120px;margin:0 auto;padding-inline:24px}
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
  }`;

const OLD_HEADER_HTML = `<header>
  <div class="hbar">
    <a class="logo" href="../index.html"><span class="mark">AI</span>タッガー<span class="sub">ツールセンター</span></a>
    <nav>
      <a href="../index.html#tools">ツール</a>
      <a href="../index.html#reads">AI検索を知る</a>
      <a href="../index.html#support">困ったときは</a>
    </nav>
  </div>
</header>`;

function newHeaderHtml() {
  return `<header>
  <div class="hbar">
    <a class="logo" href="${SITE_TOP_URL}"><img src="../assets/logo.svg" alt="AIタッガー"><span class="sub">メディアセンター</span></a>
  </div>
</header>`;
}

const OLD_FOOTER_HTML = `<footer>
  <div class="frow">
    <span>© 2026 LISUTO</span>
    <span style="margin-left:auto">AIタッガーをご契約のお客様向けページです</span>
  </div>
</footer>`;

const NEW_FOOTER_HTML = `<footer>
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
</footer>`;

function themeFromHtml(html) {
  const m = html.match(/class="cat theme-(visibility|optimization|measurement)"/);
  return m ? m[1] : null;
}

function main() {
  const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith('.html'));
  let migrated = 0;
  let skipped = [];

  files.forEach((file) => {
    const filePath = path.join(articlesDir, file);
    let html = fs.readFileSync(filePath, 'utf-8');

    if (!html.includes(OLD_HEADER_CSS) || !html.includes(OLD_FOOTER_CSS) ||
        !html.includes(OLD_HEADER_HTML) || !html.includes(OLD_FOOTER_HTML)) {
      skipped.push(file);
      return;
    }

    const theme = themeFromHtml(html);
    if (!theme) {
      skipped.push(file + '（テーマ判定不可）');
      return;
    }

    // 既存記事はトップ「›」AI検索を知る「›」この記事、というパンくずなので
    // 中間の「AI検索を知る」をテーマ別一覧ページへのリンクに差し替える
    const oldCrumb = `<p class="crumb"><a href="../index.html">トップ</a><span>›</span><a href="../index.html#reads">AI検索を知る</a><span>›</span>この記事</p>`;
    const newCrumb = `<p class="crumb"><a href="${SITE_TOP_URL}">トップ</a><span>›</span><a href="${SITE_TOP_URL}?theme=${theme}">${THEME_LABEL[theme]}</a><span>›</span>この記事</p>`;

    if (!html.includes(oldCrumb)) {
      skipped.push(file + '（パンくず不一致）');
      return;
    }

    html = html
      .replace(OLD_HEADER_CSS, NEW_HEADER_CSS)
      .replace(OLD_FOOTER_CSS, NEW_FOOTER_CSS)
      .replace(OLD_HEADER_HTML, newHeaderHtml())
      .replace(oldCrumb, newCrumb)
      .replace(OLD_FOOTER_HTML, NEW_FOOTER_HTML);

    fs.writeFileSync(filePath, html, 'utf-8');
    migrated++;
  });

  console.log(`移行完了: ${migrated}件`);
  if (skipped.length) {
    console.log(`スキップ（要確認）: ${skipped.length}件`);
    skipped.forEach((f) => console.log('  -', f));
  }
}

main();
