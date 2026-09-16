// 否認された下書き記事を articles/draft/ から削除する。
// articles.jsonには未登録のため、これだけで実害なく取り消せる。
// 使い方: node automation/reject-draft.js <slug> <slug> ...

const fs = require('fs');
const path = require('path');

const draftDir = path.join(__dirname, '..', 'articles', 'draft');
const metaDir = path.join(__dirname, 'draft-meta');

function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error('使い方: node automation/reject-draft.js <slug> <slug> ...');
    process.exit(1);
  }

  slugs.forEach((slug) => {
    const draftHtmlPath = path.join(draftDir, `${slug}.html`);
    const metaPath = path.join(metaDir, `${slug}.json`);
    let removed = false;

    if (fs.existsSync(draftHtmlPath)) {
      fs.unlinkSync(draftHtmlPath);
      removed = true;
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
      removed = true;
    }

    console.log(removed ? `否認・削除しました: ${slug}` : `該当ファイルなし（既に処理済みの可能性）: ${slug}`);
  });
}

main();
