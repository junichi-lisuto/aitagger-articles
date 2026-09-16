// 承認された下書き記事を articles/draft/ から articles/ 直下へ昇格し、
// articles.json に登録して used-source-urls.md を再生成する。
// 使い方: node automation/promote-draft.js <slug> <slug> ...
//   slug は articles/draft/<slug>.html のファイル名（拡張子なし）と、
//   automation/draft-meta/<slug>.json （下記メタ情報）から対応させる。

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const draftDir = path.join(__dirname, '..', 'articles', 'draft');
const articlesDir = path.join(__dirname, '..', 'articles');
const metaDir = path.join(__dirname, 'draft-meta');
const articlesJsonPath = path.join(__dirname, '..', 'articles.json');

function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error('使い方: node automation/promote-draft.js <slug> <slug> ...');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(articlesJsonPath, 'utf-8'));
  const existingSlugs = new Set(data.articles.map((a) => a.slug));

  slugs.forEach((slug) => {
    const draftHtmlPath = path.join(draftDir, `${slug}.html`);
    const metaPath = path.join(metaDir, `${slug}.json`);

    if (!fs.existsSync(draftHtmlPath)) {
      throw new Error(`下書きHTMLが見つかりません: ${draftHtmlPath}`);
    }
    if (!fs.existsSync(metaPath)) {
      throw new Error(`メタ情報が見つかりません: ${metaPath}`);
    }
    if (existingSlugs.has(slug)) {
      throw new Error(`既にarticles.jsonに登録済みのslugです: ${slug}`);
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const destHtmlPath = path.join(articlesDir, `${slug}.html`);

    // articles/draft/<slug>.html はarticles/直下より1階層深い場所からの相対パスで
    // 書かれている（../../index.html、他記事への../<slug>.html等）。
    // articles/直下へ移動する際、深さの差分ぶんパスを書き換える必要がある。
    let html = fs.readFileSync(draftHtmlPath, 'utf-8');
    html = html
      .replace(/href="\.\.\/([a-z0-9-]+\.html)"/g, 'href="$1"')
      .replace(/href="\.\.\/\.\.\/index\.html/g, 'href="../index.html')
      .replace(/この記事（下書き・未公開）/g, 'この記事');
    fs.writeFileSync(destHtmlPath, html, 'utf-8');
    fs.unlinkSync(draftHtmlPath);
    fs.unlinkSync(metaPath);

    data.articles.unshift(meta);
    existingSlugs.add(slug);
    console.log(`昇格しました: ${slug}`);
  });

  data.updatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(articlesJsonPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');

  execFileSync('node', [path.join(__dirname, 'generate-used-urls.js')], { stdio: 'inherit' });

  console.log(`articles.jsonを更新しました（${slugs.length}件昇格）。`);
}

main();
