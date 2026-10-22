#!/usr/bin/env node
/**
 * 校驗：frontmatter、體例、字數、引文、出處。
 * 用法：node scripts/validate.mjs
 * 退出碼 1 表示有錯誤；警告不阻擋合併。
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();

/** 目錄規則 */
const DIRS = [
  { dir: 'cases', tiers: ['A', 'B'], statuses: ['published'] },
  { dir: 'appendix', tiers: ['A', 'B', 'C', 'D'], statuses: ['pending'] },
  { dir: 'examples', tiers: ['A', 'B', 'C', 'D'], statuses: ['example', 'pending'] },
];

const HEADINGS = {
  zh: ['一句話', '情境', '經過', '當事人的理解'],
  en: ['In one line', 'Setting', 'Account', 'Their own understanding'],
};

const BANNED = [
  '菩薩救了他', '菩薩救了她', '佛菩薩顯靈', '奇蹟般', '神奇地',
  '不可思議地痊癒', '科學無法解釋', '親身見證奇蹟',
];

const SOURCE_TYPES = ['youtube', 'article', 'audio', 'book', 'interview', 'other'];
const ATTRIBUTIONS = ['named', 'pseudonymous', 'anonymous'];

const REQUIRED = [
  'id', 'title', 'lang', 'event_date', 'date_precision', 'place',
  'tradition', 'theme', 'evidence_tier', 'attribution', 'sources', 'status',
];

const errors = [];
const warnings = [];
const ids = new Map();

const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

/** js-yaml 會把 2020-01-02 解析成 Date，統一轉字串 */
function dateStr(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v === undefined || v === null ? '' : String(v);
}

function cjkCount(s) {
  return (s.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
}

function wordCount(s) {
  return s.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*`|_]/g, ' ').split(/\s+/).filter(Boolean).length;
}

function isCJK(lang) {
  return lang !== 'en';
}

function readFiles(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort()
    .map((f) => ({ name: f, rel: path.posix.join(dir, f), full: path.join(abs, f) }));
}

function checkSource(file, src, i, lang) {
  const at = `sources[${i}]`;
  if (!src || typeof src !== 'object') return err(file, `${at} 不是物件`);
  if (!SOURCE_TYPES.includes(src.type)) err(file, `${at}.type 無效（${src.type}）`);
  if (!src.retrieved) err(file, `${at}.retrieved 缺失（存取日期）`);
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr(src.retrieved))) err(file, `${at}.retrieved 格式須為 YYYY-MM-DD`);

  const hasUrl = typeof src.url === 'string' && src.url.trim() !== '';
  const hasIsbn = typeof src.isbn === 'string' && src.isbn.trim() !== '';
  if (!hasUrl && !hasIsbn) err(file, `${at} 缺 url 或 isbn`);

  if (src.type === 'book') {
    if (!hasIsbn) err(file, `${at} 為書籍，須填 isbn`);
    if (!src.page) err(file, `${at} 為書籍，須填 page（頁碼）`);
  }
  if (src.type === 'youtube' && !src.timestamp) {
    err(file, `${at} 為影片，須填 timestamp（時間戳）`);
  }
  if (!src.archived) {
    warn(file, `${at}.archived 為空；請送 Wayback Machine 存檔`);
  }

  if (src.quote) {
    const q = String(src.quote);
    if (isCJK(lang) && cjkCount(q) > 80) err(file, `${at}.quote 超過八十字（${cjkCount(q)}）`);
    if (!isCJK(lang) && wordCount(q) > 60) err(file, `${at}.quote 過長（${wordCount(q)} words）`);
    if (!src.timestamp && !src.page && !src.paragraph) {
      err(file, `${at}.quote 須附 timestamp、page 或 paragraph`);
    }
  }
}

function checkFile(entry, rule) {
  const file = entry.rel;
  const raw = fs.readFileSync(entry.full, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return err(file, '缺少 frontmatter（--- 區塊）');

  let fm;
  try {
    fm = yaml.load(m[1]) || {};
  } catch (e) {
    return err(file, `frontmatter YAML 解析失敗：${e.message}`);
  }
  const body = m[2].trim();

  for (const k of REQUIRED) {
    if (fm[k] === undefined || fm[k] === null || fm[k] === '') err(file, `缺欄位 ${k}`);
  }
  if (errors.some((e) => e.startsWith(`${file}: 缺欄位`))) return;

  // 檔名與 id
  if (!/^\d{4}$/.test(String(fm.id))) err(file, 'id 須為四位數字字串');
  else {
    const prev = ids.get(String(fm.id));
    if (prev) err(file, `id ${fm.id} 與 ${prev} 重覆；流水號不可重用`);
    else ids.set(String(fm.id), file);
  }
  const expected = /^(\d{4})-([a-z]{2})-(\d{4})-[a-z0-9-]+\.md$/;
  const fn = entry.name.match(expected);
  if (!fn) {
    warn(file, '檔名建議為 YYYY-<地區>-<流水號>-<slug>.md');
  } else if (fn[3] !== String(fm.id)) {
    err(file, `檔名中的流水號 ${fn[3]} 與 id ${fm.id} 不符`);
  }

  // 日期
  const ev = dateStr(fm.event_date);
  const prec = String(fm.date_precision);
  const pat = { day: /^\d{4}-\d{2}-\d{2}$/, month: /^\d{4}-\d{2}$/, year: /^\d{4}$/ }[prec];
  if (!pat) {
    if (prec !== 'approx') err(file, `date_precision 無效（${prec}）`);
  } else if (!pat.test(ev)) {
    err(file, `event_date "${ev}" 與 date_precision "${prec}" 不符`);
  }

  // 地點
  if (!fm.place || typeof fm.place !== 'object' || !fm.place.country) {
    err(file, 'place.country 缺失');
  }

  // 主題
  if (!Array.isArray(fm.theme) || fm.theme.length === 0) err(file, 'theme 須為非空陣列');

  // 級別／署名
  if (!rule.tiers.includes(fm.evidence_tier)) {
    err(file, `${rule.dir}/ 只收 ${rule.tiers.join('/')} 級，此則為 ${fm.evidence_tier}`);
  }
  if (!ATTRIBUTIONS.includes(fm.attribution)) err(file, `attribution 無效（${fm.attribution}）`);

  // 狀態
  if (!rule.statuses.includes(fm.status)) {
    err(file, `status 須為 ${rule.statuses.join('|')}（現為 ${fm.status}）`);
  }
  if (fm.status === 'pending' && !fm.pending_reason) {
    err(file, 'status 為 pending 時須填 pending_reason');
  }
  if (rule.dir === 'examples' && fm.status !== 'example' && fm.status !== 'pending') {
    err(file, 'examples/ 的檔案 status 須為 example 或 pending');
  }

  // 來源
  if (!Array.isArray(fm.sources) || fm.sources.length === 0) err(file, 'sources 須為非空陣列');
  else fm.sources.forEach((s, i) => checkSource(file, s, i, fm.lang));

  // 體例
  const lang = isCJK(fm.lang) ? 'zh' : 'en';
  const heads = [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((x) => x[1]);
  for (const h of HEADINGS[lang]) {
    if (!heads.includes(h)) err(file, `缺小節「## ${h}」`);
  }
  const extra = heads.filter((h) => !HEADINGS[lang].includes(h));
  if (extra.length) warn(file, `多餘小節：${extra.join('、')}（體例只有四節）`);

  // 出處行
  if (!/^(出處：|Source:)/m.test(body)) err(file, '缺出處行（以「出處：」或「Source:」開頭）');
  if (isCJK(fm.lang)) {
    if (!/編者未親見/.test(body)) err(file, '出處行末須自陳「編者未親見」');
  } else if (!/editor did not witness|did not witness/i.test(body)) {
    err(file, 'Source line must state that the editor did not witness the event');
  }

  // 字數
  if (isCJK(fm.lang)) {
    const n = cjkCount(body);
    if (n < 120) err(file, `正文僅 ${n} 字，少於 120 字`);
    if (n > 400) err(file, `正文 ${n} 字，多於 400 字`);
  } else {
    const n = wordCount(body);
    if (n < 120) err(file, `body is ${n} words, under 120`);
    if (n > 300) err(file, `body is ${n} words, over 300`);
  }

  // 歸因語氣
  const own = body.split(new RegExp(`^##\\s+${HEADINGS[lang][3]}\\s*$`, 'm'))[1] || '';
  if (isCJK(fm.lang)) {
    if (!/(認為|相信|以為|說|自稱)/.test(own)) {
      err(file, '「當事人的理解」須以當事人自己的說法表述（他認為／她相信）');
    }
  } else if (!/(believe|says|said|according to|describe)/i.test(own)) {
    err(file, 'Their own understanding must be attributed to the person');
  }

  // 禁用語
  for (const b of BANNED) if (body.includes(b)) err(file, `禁用語「${b}」：不可代當事人斷言`);
  if (body.includes('證明')) warn(file, '出現「證明」；若為肯定句請改寫為「無法證明」等');

  // 範例須標明
  if (rule.dir === 'examples' && !/格式範例|Format example/.test(body)) {
    err(file, 'examples/ 的正文須標明〔格式範例，非真實案例〕');
  }
}

for (const rule of DIRS) {
  for (const entry of readFiles(rule.dir)) checkFile(entry, rule);
}

const total = DIRS.reduce((n, r) => n + readFiles(r.dir).length, 0);

for (const w of warnings) console.log(`\x1b[33m警告\x1b[0m ${w}`);
for (const e of errors) console.log(`\x1b[31m錯誤\x1b[0m ${e}`);

console.log(
  `\n檢查 ${total} 個檔案：${errors.length} 錯誤，${warnings.length} 警告。`
);

if (errors.length) {
  console.log('\n請參閱 docs/EDITORIAL.md 與 docs/TEMPLATE.md。');
  process.exit(1);
}
