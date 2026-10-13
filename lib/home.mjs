export function renderHomepage(config, esc) {
  const columns = [
    {number:'01',name:'语文学习',english:'CHINESE',url:'/study/',description:'从高考语文 135 分的实践出发，整理文言文、阅读主观题和具体的学习方法。',tags:'文言文 / 阅读 / 一分钟语文',status:'专题整理中'},
    {number:'02',name:'高中成绩档案',english:'SCORE ARCHIVE',url:'/archive/',description:'翻出高中三年的真实成绩短信，逐科复盘分数、排名，以及那些起起落落。',tags:'真实数据 / 成绩图表 / 学习复盘',status:'档案整理中'},
    {number:'03',name:'工具与作品',english:'PROJECTS',url:'/projects/',description:'把学习和创作中遇到的问题，做成可以使用的小工具。记录想法，也展示作品。',tags:'编程实践 / 创作工具 / 个人项目',status:'查看作品'}
  ];
  return `<div class="launch-home">
    <section class="launch-hero" aria-labelledby="home-title">
      <div class="launch-hero-copy"><p class="launch-label">化玄 EVOXUAN · 个人网站</p><h1 id="home-title">让每一次成长，<br>都有迹可循。</h1><p class="launch-intro">我是化玄。高考 663 分，语文 135 分。<br>这里收录我的语文学习方法、高中成绩档案，<br class="desktop-break">以及学习与创作中做出来的小工具。</p><div class="hero-actions"><a class="button primary-button" href="#columns">从这里开始 <span aria-hidden="true">↓</span></a></div></div>
      <aside class="score-note" aria-label="高考成绩记录"><div class="note-heading"><span>一份真实的学习记录</span><span aria-hidden="true">↗</span></div><dl><div><dt>高考总分</dt><dd>663<span>分</span></dd></div><div><dt>高考语文</dt><dd>135<span>分</span></dd></div></dl><p>成绩是一张切片。<br>我更想讲清楚，走到这里的过程。</p><span class="note-signature">化玄 / EVOXUAN</span></aside>
    </section>
    <section class="launch-columns" id="columns" aria-labelledby="columns-title"><div class="launch-section-head"><div><p class="launch-label">EXPLORE</p><h2 id="columns-title">从三个方向，慢慢展开。</h2></div><p>方法，记录，作品。</p></div><div class="column-grid">${columns.map(c=>`<a class="column-entry" href="${c.url}"><div class="column-top"><span>${c.number}</span><span>${c.english}</span></div><h3>${c.name}</h3><p>${c.description}</p><small>${c.tags}</small><div class="column-bottom"><span>${c.status}</span><span aria-hidden="true">↗</span></div></a>`).join('')}</div></section>
    <section class="launch-about" aria-labelledby="about-title"><p class="launch-label">ABOUT EVOXUAN</p><div><h2 id="about-title">既记录高光，也认真复盘失误。</h2><p>高考 663 分，不代表高中三年一路顺风。考过好成绩，也经历过暴跌。我希望把真正用过的方法、能核对的数据，以及后来想明白的事情，留在这里。</p><a class="text-link" href="/about/">更多关于化玄 <span aria-hidden="true">↗</span></a></div></section>
  </div>`;
}
