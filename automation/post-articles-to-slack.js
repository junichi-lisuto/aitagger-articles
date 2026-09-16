// 記事リサーチ下書き（Markdown）を読み、Slack #承認依頼 チャンネルへ投稿する。
// 使い方: node automation/post-articles-to-slack.js <下書きMarkdownのパス>

const fs = require('fs');
const path = require('path');

const config = require('./config.local.json');

function normalizeUrl(url) {
  return (url || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function loadExistingSourceUrls() {
  const articlesJsonPath = path.join(__dirname, '..', 'articles.json');
  const data = JSON.parse(fs.readFileSync(articlesJsonPath, 'utf-8'));
  return new Set(
    data.articles
      .map((a) => a.sourceUrl)
      .filter(Boolean)
      .map(normalizeUrl)
  );
}

function parseArticles(markdown) {
  const blocks = markdown.split(/\n## /).slice(1);
  return blocks
    .filter((block) => /^\d+\./.test(block))
    .map((block) => {
      const lines = block.split('\n');
      const title = lines[0].replace(/^\d+\.\s*/, '').trim();
      const get = (label) => {
        const line = lines.find((l) => l.trim().startsWith(`- **${label}**`));
        if (!line) return '';
        return line.split(':').slice(1).join(':').trim();
      };
      return {
        title,
        url: get('URL'),
        source: get('出典'),
        date: get('公開日'),
        category: get('カテゴリ'),
      };
    });
}

function buildMessage(articles, draftFileName) {
  const lines = [
    `[記事候補] ${draftFileName} — ${articles.length}本`,
    '承認する番号を、このチャットで矢頭さんへ直接返信してください（例: 「1, 2, 4を承認」）。',
    '',
  ];
  articles.forEach((a, i) => {
    lines.push(`${i + 1}. *${a.title}*`);
    lines.push(`   ${a.category} / ${a.source} / ${a.date}`);
    lines.push(`   ${a.url}`);
  });
  return lines.join('\n');
}

async function main() {
  const draftPath = process.argv[2];
  if (!draftPath) {
    console.error('使い方: node post-articles-to-slack.js <下書きMarkdownのパス>');
    process.exit(1);
  }

  const markdown = fs.readFileSync(draftPath, 'utf-8');
  const allArticles = parseArticles(markdown);
  if (allArticles.length === 0) {
    console.error('記事が1件も見つかりませんでした。Markdownのフォーマットを確認してください。');
    process.exit(1);
  }

  const existingSourceUrls = loadExistingSourceUrls();
  const duplicates = allArticles.filter((a) => existingSourceUrls.has(normalizeUrl(a.url)));
  const articles = allArticles.filter((a) => !existingSourceUrls.has(normalizeUrl(a.url)));

  if (duplicates.length > 0) {
    console.warn('既出の元記事URLのため除外しました:');
    duplicates.forEach((a) => console.warn(`  - ${a.title}\n    ${a.url}`));
  }

  if (articles.length === 0) {
    console.error('全件が既出の元記事URLのため、Slackには投稿しませんでした。');
    process.exit(1);
  }

  const text = buildMessage(articles, path.basename(draftPath));

  const res = await fetch(config.slackApprovalWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ text }),
  });

  const body = await res.text();
  if (!res.ok || body !== 'ok') {
    console.error(`Slack投稿に失敗しました: ${res.status} ${body}`);
    process.exit(1);
  }

  console.log(`Slackへ投稿しました（${articles.length}本）。`);
}

main();
