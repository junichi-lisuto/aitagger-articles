// articles.json から既出の元記事URL一覧を書き出す。
// 記事候補の調査をCodexに依頼する前に必ず実行し、used-source-urls.md を最新化すること。
// 使い方: node automation/generate-used-urls.js

const fs = require('fs');
const path = require('path');

const articlesJsonPath = path.join(__dirname, '..', 'articles.json');
const outputPath = path.join(__dirname, '..', 'used-source-urls.md');

const data = JSON.parse(fs.readFileSync(articlesJsonPath, 'utf-8'));

const lines = [
  '# 既出の元記事URL一覧（自動生成）',
  '',
  '記事候補を探す前に必ずこの一覧を確認し、ここに載っているURLと同じ元記事は候補から除外すること。',
  `生成元: articles.json（更新日: ${data.updatedAt}）`,
  '',
];

data.articles.forEach((a) => {
  if (a.sourceUrl) {
    lines.push(`- ${a.sourceUrl}`);
  }
});

fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf-8');
console.log(`生成しました: ${outputPath}（${data.articles.length}件）`);
