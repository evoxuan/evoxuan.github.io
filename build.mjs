import {readFileSync, readdirSync, mkdirSync, writeFileSync, cpSync, rmSync, existsSync} from 'node:fs';
import {dirname, join, resolve, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked} from './vendor/marked.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const out = resolve(root, '_site');
if (dirname(out) !== root || basename(out) !== '_site') throw new Error('Invalid output path');
const config = JSON.parse(readFileSync(join(root, 'site.json'), 'utf8'));
for (const key of ['title', 'name', 'description', 'url', 'github']) {
  if (typeof config[key] !== 'string' || !config[key].trim()) throw new Error(`site.json: missing ${key}`);
}
for (const key of ['url', 'github']) if (new URL(config[key]).protocol !== 'https:') throw new Error(`${key} must use HTTPS`);
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const year = new Intl.DateTimeFormat('en', {year:'numeric',timeZone:'Asia/Shanghai'}).format(new Date());
const renderMarkdown = source => marked.parse(source, {gfm:true}).replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>');

function parsePost(file) {
  const match = file.match(/^(\d{4}-\d{2}-\d{2})-([a-z0-9][a-z0-9-]*)\.md$/);
  if (!match) throw new Error(`Invalid post filename: ${file}; use YYYY-MM-DD-english-name.md`);
  const date = match[1];
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(+parsedDate) || parsedDate.toISOString().slice(0,10) !== date) throw new Error(`Invalid date: ${file}`);
  const source = readFileSync(join(root, 'posts', file), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const parts = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!parts) throw new Error(`Missing article metadata: ${file}`);
  const meta = {};
  for (const line of parts[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const field = line.match(/^(title|description|category|draft):\s*(.*)$/);
    if (!field) throw new Error(`Unsupported metadata in ${file}: ${line}`);
    let value = field[2].trim();
    if (value.startsWith('"')) value = JSON.parse(value);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1,-1).replace(/''/g,"'");
    if (typeof value !== 'string') throw new Error(`Metadata must be text in ${file}`);
    meta[field[1]] = value;
  }
  if (!meta.title) throw new Error(`Missing title: ${file}`);
  if (meta.draft && !['true','false'].includes(meta.draft)) throw new Error(`draft must be true or false: ${file}`);
  const plain = parts[2].replace(/```[\s\S]*?```/g, '').replace(/[#*_>`\[\]]/g,'').replace(/\s+/g,' ').trim();
  return {...meta, date, file, url:`/posts/${date}-${match[2]}/`, html:renderMarkdown(parts[2]),
    description:meta.description || plain.slice(0,100), minutes:Math.max(1, Math.ceil(plain.length/400))};
}

const posts = readdirSync(join(root,'posts')).filter(file => file.endsWith('.md')).map(parsePost)
  .filter(post => post.draft !== 'true').sort((a,b) => b.date.localeCompare(a.date) || a.file.localeCompare(b.file));

function layout(title, description, path, current, content) {
  const fullTitle = path === '/' ? config.title : `${title} · ${config.title}`;
  const nav = [['/', '文章', 'home'], ['/archives/', '归档', 'archives'], ['/about/', '关于', 'about']]
    .map(([href,label,key]) => `<a href="${href}"${current===key?' aria-current="page"':''}>${label}</a>`).join('');
  const canonical = config.url.replace(/\/$/,'') + path;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fullTitle)}</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}"><meta property="og:title" content="${esc(fullTitle)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${current==='post'?'article':'website'}"><meta property="og:url" content="${esc(canonical)}">
<meta name="theme-color" content="#faf9f6"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css"></head>
<body><a class="skip" href="#main">跳到正文</a><div class="shell">
<header class="header"><a class="brand" href="/" aria-label="${esc(config.title)}，首页"><span class="monogram" aria-hidden="true">e</span><span>${esc(config.name)}</span></a><nav class="nav" aria-label="主导航">${nav}</nav></header>
<main id="main">${content}</main>
<footer class="footer"><p>© ${year} ${esc(config.name)}</p><p><a href="${esc(config.github)}">GitHub</a><span aria-hidden="true"> · </span>文字与时间</p></footer>
</div></body></html>\n`;
}

function row(post) {
  return `<article class="post-row"><time class="post-date" datetime="${post.date}">${post.date.replaceAll('-',' / ')}</time><div><h2><a href="${post.url}">${esc(post.title)}</a></h2><p>${esc(post.description)}</p>${post.category?`<span class="tag">${esc(post.category)}</span>`:''}</div></article>`;
}

// Only regenerate this project's dedicated build output, never source files.
if (existsSync(out)) rmSync(out, {recursive:true});
mkdirSync(out, {recursive:true});
cpSync(join(root,'public'), out, {recursive:true});
const write = (path, html) => {const target=join(out,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,html,'utf8');};
write('index.html', layout(config.title,config.description,'/','home',`
<section class="hero"><p class="eyebrow">${esc(config.title)}</p><h1>文章与笔记</h1><p>${esc(config.description)}</p></section>
<section aria-labelledby="latest"><div class="section-label"><h2 id="latest">最新文章</h2><span>${posts.length} 篇</span></div>${posts.length?posts.map(row).join(''):'<p class="empty">第一篇文章，正在酝酿。</p>'}</section>`));

let archive = '', previousYear;
for (const post of posts) {const postYear=post.date.slice(0,4);if(postYear!==previousYear){archive+=`<h2 class="year">${postYear}</h2>`;previousYear=postYear;}archive+=row(post);}
write('archives/index.html', layout('文章归档','按时间查看所有文章。','/archives/','archives',`<section class="hero"><p class="eyebrow">文章归档</p><h1>沿着时间，慢慢读。</h1><p>共 ${posts.length} 篇文章</p></section><section aria-label="文章列表">${archive || '<p class="empty">暂无文章。</p>'}</section>`));
write('about/index.html', layout('关于',`关于 ${config.name} 的个人博客。`,'/about/','about',`<article class="article prose">${renderMarkdown(readFileSync(join(root,'about.md'),'utf8'))}</article>`));
for (const post of posts) {
  write(post.url.slice(1)+'index.html', layout(post.title,post.description,post.url,'post',`<article class="article"><a class="back" href="/">返回文章列表</a><header class="article-header">${post.category?`<span class="tag">${esc(post.category)}</span>`:''}<h1>${esc(post.title)}</h1><div class="meta"><time datetime="${post.date}">${post.date.replaceAll('-',' / ')}</time><span>${esc(config.name)}</span><span>约 ${post.minutes} 分钟</span></div></header><div class="prose">${post.html}</div><div class="article-bottom"><a href="/archives/">查看所有文章</a></div></article>`));
}
write('404.html',layout('页面未找到','这个页面不存在。','/404.html','',`<section class="hero"><p class="eyebrow">404</p><h1>这一页暂时找不到。</h1><p><a href="/">回到首页，继续阅读。</a></p></section>`));
write('.nojekyll','');
const urls=['/','/about/','/archives/',...posts.map(post=>post.url)];
write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(path=>`<url><loc>${esc(config.url.replace(/\/$/,'')+path)}</loc></url>`).join('')}</urlset>`);
write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${config.url.replace(/\/$/,'')}/sitemap.xml\n`);
console.log(`Built ${posts.length} published article(s), homepage, archive, about and 404 page.`);
