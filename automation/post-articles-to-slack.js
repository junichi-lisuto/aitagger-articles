// articles/draft/ に置かれた下書き記事（Claudeが生成・push済み）をSlackへ通知する。
// 矢頭さんは通知内のGitHub Pages URLで実際の記事ページを見てから、
// Claude Codeのチャットで「1と3を承認」のように直接伝える（Slack上の返信では完結しない。
// Incoming Webhookは投稿専用で受信できないため）。
// 使い方: node automation/post-articles-to-slack.js <slug> <slug> ...
//   各slugについて articles/draft/<slug>.html と automation/draft-meta/<slug>.json が必要。

const fs = require('fs');
const path = require('path');

const config = require('./config.local.json');

const draftDir = path.join(__dirname, '..', 'articles', 'draft');
const metaDir = path.join(__dirname, 'draft-meta');
const PAGES_BASE = 'https://junichi-lisuto.github.io/lisuto-media-centre/articles/draft';

function loadDraftArticles(slugs) {
  return slugs.map((slug) => {
    const htmlPath = path.join(draftDir, `${slug}.html`);
    const metaPath = path.join(metaDir, `${slug}.json`);
    if (!fs.existsSync(htmlPath)) {
      throw new Error(`下書きHTMLが見つかりません: ${htmlPath}`);
    }
    if (!fs.existsSync(metaPath)) {
      throw new Error(`メタ情報が見つかりません: ${metaPath}`);
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return {
      slug,
      title: meta.title,
      source: meta.source,
      date: meta.date,
      platforms: meta.platforms,
      viewpoint: meta.viewpoint,
      theme: meta.theme,
      draftUrl: `${PAGES_BASE}/${slug}.html`,
    };
  });
}

function buildMessage(articles) {
  const lines = [
    `[記事下書き] ${articles.length}本 — 実際のページを見てから判断してください`,
    '承認する番号は、Claude Codeのチャットで矢頭さんから直接伝えてください（例:「1, 2, 4を承認」）。',
    '（このSlack上での返信は自動では検知できません）',
    '',
  ];
  articles.forEach((a, i) => {
    lines.push(`${i + 1}. *${a.title}*`);
    lines.push(`   ${(a.platforms || []).join('/')} / ${a.viewpoint} / ${a.theme} / ${a.source} / ${a.date}`);
    lines.push(`   下書き: ${a.draftUrl}`);
  });
  return lines.join('\n');
}

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error('使い方: node automation/post-articles-to-slack.js <slug> <slug> ...');
    process.exit(1);
  }

  const articles = loadDraftArticles(slugs);
  const text = buildMessage(articles);

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
