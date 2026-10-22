#!/usr/bin/env node
/**
 * 生成 INDEX.md、exports/cases.json、exports/cases.csv。
 * 用法：node scripts/build-index.mjs
 * 輸出刻意保持確定性（不含時間戳），以免每次跑都產生無謂 diff。
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const OUT_INDEX = path.join(ROOT, 'INDEX.md');
const OUT_DIR = path.join(ROOT, 'exports');

const TIER_LABEL = { A: '自述', B: '口述記', C: '轉述', D: '傳聞' };

function dateStr(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v === undefined || v === null ? '' : String(v);
}

function load(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .map((f) => {
      const raw = fs.readFileSync(path.join(abs, f), 'utf8');
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!m) return null;
      try {
        return { ...yaml.load(m[1]), _file: path.posix.join(dir, f) };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

const cases = load('cases');
const appendix = load('appendix');

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const host = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url || '—'; }
};
const themes = (t) => (Array.isArray(t) ? t.join('、') : String(t ?? ''));
const sourceLabel = (e) => {
  const s = e.sources?.[0];
  if (!s) return '—';
  if (s.type === 'book') return s.title || '書籍';
  return host(s.url);
};

function table(rows, extraHead, extraCell) {
  if (!rows.length) return '_尚無條目。_\n';
  const head = `| # | 一句話 | 年月 | 主題 | 來源 | ${extraHead} |\n|---:|---|---|---|---|---|\n`;
  return head + rows.map((e) => {
    const d = dateStr(e.event_date);
    return `| [${e.id}](${e._file}) | ${cell(e.title)} | ${cell(d)} | ${cell(themes(e.theme))} | ${cell(TIER_LABEL[e.evidence_tier] || e.evidence_tier)} | ${cell(extraCell(e))} |`;
  }).join('\n') + '\n';
}

const md = `# 全錄索引

正錄 ${cases.length} 則　｜　附錄 ${appendix.length} 則

> 本檔由 \`npm run index\` 自動生成，請勿手改。投稿見 [CONTRIBUTING.md](CONTRIBUTING.md)，體例見 [docs/EDITORIAL.md](docs/EDITORIAL.md)。

## 正錄

${table(cases, '出處', sourceLabel)}
## 附錄·姑存

存其說，不入正錄。理由見各則 \`pending_reason\`。

${table(appendix, '未入正錄之故', (e) => e.pending_reason || '—')}
## 說明

- **自述**：當事人本人所述。**口述記**：當事人口述，他人筆錄或拍攝，並已公開發表。
- 標記只說來源離當事人多遠，不說事件真假。
- 每則末行皆註明編者所未見，請循出處回看原件。
`;

fs.writeFileSync(OUT_INDEX, md, 'utf8');

fs.mkdirSync(OUT_DIR, { recursive: true });

const flat = (e, bucket) => {
  const s = e.sources?.[0] || {};
  return {
    id: String(e.id),
    bucket,
    title: e.title,
    lang: e.lang,
    subject: e.subject ?? null,
    event_date: dateStr(e.event_date),
    date_precision: e.date_precision,
    country: e.place?.country ?? null,
    city: e.place?.city ?? null,
    detail: e.place?.detail ?? null,
    tradition: e.tradition,
    theme: Array.isArray(e.theme) ? e.theme : [e.theme],
    evidence_tier: e.evidence_tier,
    attribution: e.attribution,
    source_type: s.type ?? null,
    source_url: s.url ?? null,
    source_isbn: s.isbn ?? null,
    source_page: s.page ?? null,
    source_timestamp: s.timestamp ?? null,
    source_published: dateStr(s.published),
    retrieved: dateStr(s.retrieved),
    archived: s.archived || null,
    quote: s.quote ?? null,
    reviewed_by: e.reviewed_by ?? [],
    reviewed_at: dateStr(e.reviewed_at),
    status: e.status,
    file: e._file,
  };
};

const records = [
  ...cases.map((e) => flat(e, 'cases')),
  ...appendix.map((e) => flat(e, 'appendix')),
];

fs.writeFileSync(
  path.join(OUT_DIR, 'cases.json'),
  JSON.stringify({ generated_by: 'scripts/build-index.mjs', count: records.length, records }, null, 2) + '\n',
  'utf8'
);

const COLS = ['id', 'bucket', 'title', 'lang', 'event_date', 'country', 'city', 'tradition',
  'theme', 'evidence_tier', 'attribution', 'source_type', 'source_url', 'source_timestamp',
  'retrieved', 'archived', 'file'];

const csvCell = (v) => {
  const s = Array.isArray(v) ? v.join(';') : String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csv = [
  COLS.join(','),
  ...records.map((r) => COLS.map((c) => csvCell(r[c])).join(',')),
].join('\n') + '\n';

fs.writeFileSync(path.join(OUT_DIR, 'cases.csv'), csv, 'utf8');

console.log(`INDEX.md：正錄 ${cases.length} 則，附錄 ${appendix.length} 則`);
console.log(`exports/cases.json、exports/cases.csv：${records.length} 筆`);
