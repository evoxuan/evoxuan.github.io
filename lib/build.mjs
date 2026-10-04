import {readFileSync,readdirSync,mkdirSync,writeFileSync,cpSync,rmSync,existsSync} from 'node:fs';
import {dirname,join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked,Renderer} from '../vendor/marked.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'_site');
if(dirname(out)!==root||basename(out)!=='_site')throw new Error('Invalid output path');
const config=JSON.parse(readFileSync(join(root,'site.json'),'utf8'));
const projects=JSON.parse(readFileSync(join(root,'projects.json'),'utf8'));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const absolute=path=>config.url.replace(/\/$/,'')+path;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
const plain=html=>html.replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|#39);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[e]));
for(const social of config.socials){if(new URL(social.url).protocol!=='https:')throw new Error('Social links must use HTTPS');}
for(const project of projects){if(!/^[a-z0-9-]+$/.test(project.slug)||!['可用','实验中','暂停'].includes(project.status)||new URL(project.url).protocol!=='https:')throw new Error('Invalid project');}

function renderMarkdown(source){
  const headings=[],used=new Map(),renderer=new Renderer();
  renderer.heading=function({tokens,depth}){
    const inner=this.parser.parseInline(tokens),text=plain(inner),base=text.replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')||'section';
    const n=(used.get(base)||0)+1;used.set(base,n);const id=base+(n>1?`-${n}`:'');
    if(depth===2||depth===3)headings.push({text,id,depth});
    return `<h${depth} id="${esc(id)}">${inner}</h${depth}>\n`;
  };
  const html=marked.parse(source,{gfm:true,renderer}).replace(/<table>/g,'<div class="table-scroll"><table>').replace(/<\/table>/g,'</table></div>');
  return {html,headings};
}

function readPost(file){
  const match=file.match(/^(\d{4}-\d{2}-\d{2})-([a-z0-9][a-z0-9-]*)\.md$/);if(!match)throw new Error(`Invalid filename: ${file}`);
  const source=readFileSync(join(root,'posts',file),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  const parts=source.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);if(!parts)throw new Error(`Missing metadata: ${file}`);
  const meta={};
  for(const line of parts[1].split('\n')){
    if(!line.trim()||line.trimStart().startsWith('#'))continue;
    const field=line.match(/^(title|description|summary|category|tags|featured|draft|initial|related|date|updated):\s*(.*)$/);if(!field)throw new Error(`Unsupported metadata: ${file}: ${line}`);
    let value=field[2].trim();
    if(['tags','related'].includes(field[1])){
      if(value.startsWith('[')&&value.endsWith(']')){try{value=JSON.parse(value);}catch{value=value.slice(1,-1).split(',').map(v=>v.trim().replace(/^['"]|['"]$/g,''));}}
      else value=value.split(',').map(v=>v.trim());
      if(!Array.isArray(value)||value.some(v=>typeof v!=='string'))throw new Error(`Invalid list: ${file}`);
      value=value.filter(Boolean);
    }else if(['featured','draft','initial'].includes(field[1])){if(!['true','false'].includes(value))throw new Error(`Invalid boolean: ${file}`);value=value==='true';}
    else if(value.startsWith('"'))value=JSON.parse(value);
    else if(value.startsWith("'")&&value.endsWith("'"))value=value.slice(1,-1).replace(/''/g,"'");
    meta[field[1]]=value;
  }
  if(!meta.title||typeof meta.title!=='string')throw new Error(`Missing title: ${file}`);
  const date=meta.date||match[1],parsed=new Date(date+'T00:00:00Z');
  if(Number.isNaN(+parsed)||parsed.toISOString().slice(0,10)!==date)throw new Error(`Invalid date: ${file}`);
  if(meta.updated){const value=new Date(meta.updated+'T00:00:00Z');if(Number.isNaN(+value)||value.toISOString().slice(0,10)!==meta.updated||meta.updated<date)throw new Error(`Invalid updated date: ${file}`);}
  const {html,headings}=renderMarkdown(parts[2]),text=plain(html),characters=Array.from(text.replace(/\s/g,'')).length;
  return {...meta,date,file,slug:file.slice(0,-3),url:`/posts/${file.slice(0,-3)}/`,html,headings,characters,minutes:Math.max(1,Math.ceil(characters/400)),description:meta.summary||meta.description||text.replace(/\s+/g,' ').trim().slice(0,90),tags:meta.tags||[]};
}
const allPosts=readdirSync(join(root,'posts')).filter(f=>f.endsWith('.md')).map(readPost);
const posts=allPosts.filter(p=>!p.draft).sort((a,b)=>b.date.localeCompare(a.date)||a.file.localeCompare(b.file));
const featured=posts.filter(p=>p.featured).slice(0,3);
const socials=()=>config.socials.map(s=>`<a href="${esc(s.url)}">${esc(s.name)}</a>`).join('');
const tagList=post=>post.tags.map(tag=>`<span class="tag">${esc(tag)}</span>`).join('');
const metadata=post=>`<time datetime="${post.date}">${post.date.replaceAll('-','.')}</time><span>约 ${post.minutes} 分钟</span>`;

let snapshot=null;
if(config.statsEnabled&&config.statsEndpoint){try{const response=await fetch(config.statsEndpoint+'/api/stats',{signal:AbortSignal.timeout(5000)});if(response.ok){const data=await response.json();if(Number.isSafeInteger(data.today)&&Number.isSafeInteger(data.total)&&data.metric==='daily_unique')snapshot=data;}}catch{/* The site still builds if statistics are temporarily unavailable. */}}
function footer(){
  if(!config.statsEnabled)return `<footer class="footer"><div class="footer-top"><a class="footer-brand" href="/">化玄</a><div class="social-links" aria-label="社交平台">${socials()}</div></div><div class="footer-bottom"><p>© ${today.slice(0,4)} 化玄</p><p>写东西，做产品，也记录成长。</p></div></footer>`;
  const stats=snapshot?`今日访客：<strong>${snapshot.today.toLocaleString('zh-CN')}</strong> 人 · 累计访客：<strong>${snapshot.total.toLocaleString('zh-CN')}</strong> 人次`:'统计暂不可用';
  return `<footer class="footer"><div class="footer-top"><a class="footer-brand" href="/">化玄</a><div class="social-links" aria-label="社交平台">${socials()}</div></div><div class="footer-bottom"><p>© ${today.slice(0,4)} 化玄</p><div class="visitor-stats"><p data-stats-values aria-live="polite">${stats}</p><p class="stats-status" data-stats-status>${snapshot?'数据时间：'+esc(snapshot.updatedAt.replace('T',' ').slice(0,16))+' UTC':''}</p><details class="stats-notes"><summary>统计口径</summary><div><p>访客按日去重统计，跨日访问会再次计入累计人次。人数为估算值，统计自 <span data-stats-start>${snapshot?esc(snapshot.enabledAt):'启用日期待读取'}</span> 起，日期切分采用北京时间。</p><p>识别依靠每日更换的匿名浏览器标识。清除存储、更换设备或阻止脚本会影响估算；已知机器人与开发预览尽量排除。仅公开汇总数字。</p></div></details></div></div></footer>`;
}
function layout(title,description,path,current,content,type='website'){
  const pageTitle=path==='/'?config.title:`${title} · 化玄`;
  const nav=[['/writing/','文章','writing'],['/data/','数据与故事','data'],['/projects/','项目','projects'],['/about/','关于','about']].map(([url,label,id])=>`<a href="${url}"${current===id?' aria-current="page"':''}>${label}</a>`).join('');
  const structured=JSON.stringify({url:config.url,statsEndpoint:config.statsEndpoint,snapshot}).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(pageTitle)}</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#FAFAF8"><link rel="canonical" href="${esc(absolute(path))}"><meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(absolute(path))}"><meta property="og:site_name" content="化玄"><meta property="og:locale" content="zh_CN"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css"><script id="site-config" type="application/json">${structured}</script><script defer src="/site.js"></script></head><body><a class="skip" href="#main">跳到正文</a><header class="header"><div class="header-inner"><a class="brand" href="/" aria-label="化玄，返回首页">化玄<span class="brand-en" aria-hidden="true">HUAXUAN</span></a><nav class="desktop-nav" aria-label="主导航">${nav}</nav><details class="mobile-menu"><summary>菜单</summary><nav aria-label="手机导航">${nav}</nav></details></div></header><div class="shell"><main id="main">${content}</main>${footer()}</div></body></html>\n`;
}
function postCard(post,primary=false){return `<article class="feature-card${primary?' primary':''}"><p class="category">${esc(post.category||'文章')}</p><h3><a href="${post.url}">${esc(post.title)}</a></h3><p class="summary">${esc(post.description)}</p><div class="meta">${metadata(post)}</div></article>`;}
function postRow(post){return `<article class="post-row" data-post data-category="${esc(post.category||'文章')}" data-search="${esc([post.title,post.description,...post.tags].join(' ').normalize('NFKC').toLowerCase())}"><div><p class="category">${esc(post.category||'文章')}</p><h2><a href="${post.url}">${esc(post.title)}</a></h2><p class="summary">${esc(post.description)}</p><div class="tags">${tagList(post)}</div></div><div class="meta">${metadata(post)}</div></article>`;}
function heading(title,label,description=''){return `<header class="page-heading"><p class="eyebrow">${label}</p><h1>${title}</h1>${description?`<p class="page-intro">${description}</p>`:''}</header>`;}
const section=(title,id,content,more)=>`<section class="home-section" aria-labelledby="${id}"><div class="section-header"><h2 id="${id}">${title}</h2>${more}</div>${content}</section>`;
const projectCard=project=>`<article class="project-card"><div class="project-top"><p class="category">个人项目</p><span class="status">${esc(project.status)}</span></div><h3><a href="/projects/${project.slug}/">${esc(project.title)}</a></h3><p>${esc(project.description)}</p><a class="text-link" href="${esc(project.url)}">${esc(project.linkLabel)}</a></article>`;
const dataCard=`<article class="data-card"><div><p class="category">站内数据 · 阅读时间</p><h3><a href="/data/reading-time/">阅读时间，是怎么算出来的？</a></h3><p>从 ${posts.length} 篇文章的真实文本出发，看看字数能说明什么，又有哪些阅读体验无法用数字代替。</p><a class="text-link" href="/data/reading-time/">阅读完整故事</a></div><div class="data-card-index" aria-label="数据样本"><strong>${posts.length}</strong><span>篇文章 · 统一口径</span></div></article>`;
function toc(headings){return headings.length<3?'':`<details class="mobile-toc"><summary>本文目录</summary><nav aria-label="本文目录">${headings.map(h=>`<a href="#${esc(h.id)}" class="depth-${h.depth}">${esc(h.text)}</a>`).join('')}</nav></details>`;}
function sidebar(headings){return headings.length<3?'':`<aside class="toc-side"><p>本文目录</p><nav aria-label="侧边目录">${headings.map(h=>`<a href="#${esc(h.id)}" class="depth-${h.depth}">${esc(h.text)}</a>`).join('')}</nav></aside>`;}
function reading(title,description,body,headings,meta,back,extra=''){
  return `<div class="reading-layout"><article class="article-main"><a class="back" href="${back.url}">${back.label}</a><header class="article-header"><h1>${esc(title)}</h1><p class="article-description">${esc(description)}</p><div class="meta">${meta}</div></header>${toc(headings)}<div class="prose">${body}</div>${extra}<div class="article-social"><p>继续交流</p><div class="social-links">${socials()}</div></div></article>${sidebar(headings)}</div>`;
}
if(existsSync(out))rmSync(out,{recursive:true});mkdirSync(out,{recursive:true});cpSync(join(root,'public'),out,{recursive:true});
const write=(path,value)=>{const target=join(out,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,value,'utf8');};
const home=`<section class="home-top"><div class="hero"><p class="eyebrow">化玄的个人网站</p><h1>写东西，做产品，<br>也记录成长。</h1><p class="hero-intro">这里以文章为核心，连接数据故事与个人项目。<br>用文字展开问题，用作品尝试答案，也留下判断的依据。</p><div class="hero-actions"><a class="button primary-button" href="/writing/">阅读文章</a><a class="button" href="/projects/">浏览项目</a><a class="about-link" href="/about/">关于我</a></div></div><aside class="index-card" aria-label="个人内容索引"><p class="index-title">在这里，找到</p><a href="/writing/"><span>文章与笔记</span><b>${posts.length.toString().padStart(2,'0')}</b></a><a href="/data/"><span>数据与故事</span><b>01</b></a><a href="/projects/"><span>正在做的项目</span><b>${projects.length.toString().padStart(2,'0')}</b></a><p class="index-foot">文字 / 作品 / 时间</p></aside></section>`+
  (featured.length?section('精选文章','featured',`<div class="featured-grid">${featured.map((p,i)=>postCard(p,i===0)).join('')}</div>`,'<a class="text-link" href="/writing/">全部文章</a>'):'')+
  section('数据与故事','data-stories',dataCard,'<a class="text-link" href="/data/">全部故事</a>')+
  (projects.length?section('项目','projects',`<div class="projects-grid">${projects.map(projectCard).join('')}</div>`,'<a class="text-link" href="/projects/">浏览项目</a>'):'');
write('index.html',layout(config.title,config.description,'/','home',home));

const categories=[...new Set(posts.map(p=>p.category||'文章'))];let groups='',previous;
for(const p of posts){const year=p.date.slice(0,4);if(year!==previous){if(previous)groups+='</section>';groups+=`<section class="year-group" data-year><h2 class="year-heading">${year}</h2>`;previous=year;}groups+=postRow(p);}if(previous)groups+='</section>';
write('writing/index.html',layout('文章','浏览文章，按分类筛选，搜索标题、摘要和标签。','/writing/','writing',heading('文章与笔记','WRITING','从一个具体问题开始，慢慢展开。')+`<div class="search-tools" hidden><label for="article-search">搜索文章</label><input id="article-search" type="search" placeholder="搜索标题、摘要或标签" autocomplete="off"><div class="filters" aria-label="文章分类"><button class="filter active" data-filter="" aria-pressed="true">全部</button>${categories.map(c=>`<button class="filter" data-filter="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}</div><p class="results-summary" role="status" data-results>共 ${posts.length} 篇文章</p></div><div class="post-list">${groups||'<p>目前没有公开文章。</p>'}</div><div class="search-empty" hidden><h2>没有找到匹配的文章</h2><p>试试其他关键词，或查看全部文章。</p><button class="button" data-clear-search>清除筛选</button></div>`));

for(const p of posts){
  const related=(p.related||[]).map(slug=>posts.find(item=>item.slug===slug)).filter(Boolean).slice(0,3);
  const extra=related.length?`<section class="related"><h2>相关内容</h2>${related.map(item=>`<a href="${item.url}">${esc(item.title)}</a>`).join('')}</section>`:'';
  const note=p.initial?'<p class="initial-note">初始草稿 · 经授权由 AI 辅助生成，未作为个人经历或正式观点稿确认。</p>':'';
  const body=note+p.html;
  const meta=metadata(p)+(p.updated&&p.updated!==p.date?`<span>更新于 ${esc(p.updated)}</span>`:'');
  write(p.url.slice(1)+'index.html',layout(p.title,p.description,p.url,'writing',reading(p.title,p.description,body,p.headings,meta,{url:'/writing/',label:'返回文章列表'},extra),'article'));
}

write('data/index.html',layout('数据与故事','从可核对的材料出发，说明数字的口径与判断的边界。','/data/','data',heading('让数字回到问题里','DATA & STORIES','注明来源，统一口径，也保留暂时不能确定的部分。')+dataCard));
const measurements=posts.map(p=>({title:p.title,url:p.url,characters:p.characters,estimatedMinutes:p.minutes}));
const maximum=Math.max(1,...measurements.map(p=>p.characters));
const bars=`<div class="data-chart" role="img" aria-label="各篇文章的可见文本字符数，对照结果见下方表格">${measurements.map(p=>`<div class="chart-row"><div class="chart-label"><span>${esc(p.title)}</span><strong>${p.characters.toLocaleString('zh-CN')} 字符</strong></div><div class="chart-track"><span style="width:${(p.characters/maximum*100).toFixed(2)}%"></span></div></div>`).join('')}</div>`;
const table=`<div class="table-scroll"><table><caption>文章字数与预计阅读时间</caption><thead><tr><th scope="col">文章</th><th scope="col">文本字符数</th><th scope="col">预计阅读</th></tr></thead><tbody>${measurements.map(p=>`<tr><th scope="row"><a href="${p.url}">${esc(p.title)}</a></th><td>${p.characters.toLocaleString('zh-CN')}</td><td>${p.estimatedMinutes} 分钟</td></tr>`).join('')}</tbody></table></div>`;
const story=renderMarkdown(`## 一个熟悉的数字\n\n文章标题下方常有“约几分钟”的提示。它可以帮助安排阅读，但这个数字并不来自对每位读者的计时。这个网站采用同一个计算规则，让估算能够复算。\n\n## 数据从哪里来\n\n本页使用网站当前公开的 ${posts.length} 篇文章，构建时读取 Markdown 正文，并先转换为实际显示的文本。页面标题、摘要、菜单与页脚不计入；正文里的小标题、标点、数字和代码文字计入。去掉空白后，按 Unicode 字符逐个计数。\n\n这些是本次构建的真实文本测量，文章本身为授权生成的初始草稿。样本并不代表其他网站或中文文章的总体。\n\n## 同一口径下的比较\n\n{{CHART}}\n\n{{TABLE}}\n\n字符数反映文本长度。图中最长的一条只说明这份正文包含更多字符，不能据此判断文章更难、质量更好，或实际阅读一定更慢。\n\n## 阅读时间怎样估算\n\n统一按每分钟 400 个可见文本字符估算，结果向上取整，最低显示 1 分钟：\n\n\`预计分钟数 = max(1, ceil(正文字符数 ÷ 400))\`\n\n400 是本网站选择的编辑参数，不是经过实验测得的个人阅读速度，也不是普遍适用的科学结论。所有文章使用相同规则，方便读者理解提示来自哪里。\n\n## 哪些事情数字还不能说明\n\n陌生概念、表格、代码、回看和做笔记，都会改变阅读过程。图表占用的思考时间，也无法从文本字符数中可靠推断。\n\n因此页面保留“约”字。预计阅读时间是一项统一口径的提示，不能替代真正的阅读体验，更不能用来评价读者的能力。\n\n## 查看与复算\n\n[下载本页的测量数据](/data/reading-time/measurements.json)，或从表格打开原文章。本站每次更新构建时，测量会随公开正文重新计算。\n\n数据测量日期：${today}。口径版本：v1；文本字符数含标点与代码，去除空白，预计阅读时间按 400 字符／分钟计算。`);
const storyHtml=story.html.replace('<p>{{CHART}}</p>',bars).replace('<p>{{TABLE}}</p>',table);
write('data/reading-time/index.html',layout('阅读时间，是怎么算出来的？','用站内文章的真实文本测量，解释阅读时间的估算方法与边界。','/data/reading-time/','data',reading('阅读时间，是怎么算出来的？','把一个常见提示拆开，看看字数能支持什么判断。',storyHtml,story.headings,`<time datetime="${today}">${today}</time><span>站内文本测量 · 口径 v1</span>`,{url:'/data/',label:'返回数据与故事'}),'article'));
write('data/reading-time/measurements.json',JSON.stringify({measuredAt:today,source:'Published Markdown article bodies in this repository',method:'Rendered Unicode text characters excluding whitespace; includes punctuation and code',charactersPerMinute:400,rounding:'ceil, minimum 1 minute',articles:measurements},null,2));

write('projects/index.html',layout('项目','正在制作和可以公开访问的个人项目。','/projects/','projects',heading('把想法做成能用的东西','PROJECTS','说明解决的问题，保留当前状态，提供一个有效入口。')+`<div class="projects-grid">${projects.map(projectCard).join('')}</div>`));
for(const p of projects){const content=renderMarkdown(`## 解决什么问题\n\n${p.description}\n\n## 当前可以使用\n\n${p.detail}\n\n当前状态：${p.status}。项目会根据实际阅读和使用反馈继续调整。\n\n## 访问入口\n\n[${p.linkLabel}](${p.url})\n\n[打开网站](https://evoxuan.github.io/)`);write(`projects/${p.slug}/index.html`,layout(p.title,p.description,`/projects/${p.slug}/`,'projects',reading(p.title,p.description,content.html,content.headings,`<span>${esc(p.status)}</span>`,{url:'/projects/',label:'返回项目列表'})));}
const about=renderMarkdown(readFileSync(join(root,'about.md'),'utf8').replace(/^# .*\r?\n/,''));
write('about/index.html',layout('关于化玄','关于这个网站，最近在做的事，以及真实社交入口。','/about/','about',reading('关于化玄','文章、数据与作品，在这里慢慢积累。',about.html,about.headings,'',{url:'/',label:'返回首页'})));
write('404.html',layout('页面未找到','这个页面暂时找不到。','/404.html','',heading('这一页暂时找不到','404','可以回到首页，继续阅读。')+'<a class="button" href="/">返回首页</a>'));
const redirect=(path,to)=>write(path,`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${to}"><link rel="canonical" href="${absolute(to)}"><title>前往文章列表 · 化玄</title></head><body><a href="${to}">前往文章列表</a></body></html>`);
redirect('archives/index.html','/writing/');redirect('posts/2026-10-04-hello-world/index.html','/writing/');
const urls=['/','/writing/','/data/','/data/reading-time/','/projects/','/about/',...posts.map(p=>p.url),...projects.map(p=>`/projects/${p.slug}/`)];
write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(p=>`<url><loc>${esc(absolute(p))}</loc></url>`).join('')}</urlset>`);
write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${absolute('/sitemap.xml')}\n`);write('.nojekyll','');
console.log(`Built: ${posts.length} articles, ${featured.length} featured, 1 measured data story, ${projects.length} project(s); statistics ${snapshot?'snapshot available':'not yet available'}.`);
