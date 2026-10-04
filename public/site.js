(() => {
  'use strict';
  const config=JSON.parse(document.getElementById('site-config').textContent);
  const search=document.getElementById('article-search');
  if(search){
    const tools=document.querySelector('.search-tools'),rows=[...document.querySelectorAll('[data-post]')],filters=[...document.querySelectorAll('[data-filter]')],status=document.querySelector('[data-results]'),empty=document.querySelector('.search-empty');
    let category='';tools.hidden=false;
    function update(){
      const terms=search.value.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean);let count=0;
      for(const row of rows){const shown=(!category||row.dataset.category===category)&&terms.every(term=>row.dataset.search.includes(term));row.hidden=!shown;if(shown)count++;}
      for(const group of document.querySelectorAll('[data-year]'))group.hidden=![...group.querySelectorAll('[data-post]')].some(row=>!row.hidden);
      status.textContent=`显示 ${count} / ${rows.length} 篇文章`;empty.hidden=count!==0;
      for(const filter of filters){const active=filter.dataset.filter===category;filter.setAttribute('aria-pressed',String(active));filter.classList.toggle('active',active);}
    }
    search.addEventListener('input',update);
    filters.forEach(filter=>filter.addEventListener('click',()=>{category=filter.dataset.filter;update();}));
    document.querySelector('[data-clear-search]').addEventListener('click',()=>{search.value='';category='';update();search.focus();});
  }

  const toc=[...document.querySelectorAll('.toc-side a,.mobile-toc a')];
  if(toc.length&&'IntersectionObserver' in window){
    const links=new Map();for(const link of toc){const id=decodeURIComponent(link.hash.slice(1));if(!links.has(id))links.set(id,[]);links.get(id).push(link);}
    const sections=[...links.keys()].map(id=>document.getElementById(id)).filter(Boolean);
    const setCurrent=id=>{for(const [key,group] of links){for(const link of group){link.classList.toggle('current',key===id);if(key===id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}}};
    setCurrent(sections[0]?.id);
    let scheduled=false;
    const update=()=>{scheduled=false;let active=sections[0];for(const section of sections){if(section.getBoundingClientRect().top<=145)active=section;}if(active)setCurrent(active.id);};
    window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}},{passive:true});
    toc.forEach(link=>link.addEventListener('click',()=>{setCurrent(decodeURIComponent(link.hash.slice(1)));const menu=link.closest('.mobile-toc');if(menu)menu.open=false;}));
  }

  const values=document.querySelector('[data-stats-values]'),status=document.querySelector('[data-stats-status]'),start=document.querySelector('[data-stats-start]');
  if(!values)return;
  const cacheKey='huaxuan.stats.snapshot.v1',identityKey='huaxuan.stats.identity.v1';
  let recent=config.snapshot;
  const valid=data=>data&&Number.isSafeInteger(data.today)&&data.today>=0&&Number.isSafeInteger(data.total)&&data.total>=data.today&&/^\d{4}-\d{2}-\d{2}$/.test(data.day)&&/^\d{4}-\d{2}-\d{2}$/.test(data.enabledAt)&&Number.isFinite(Date.parse(data.updatedAt))&&data.metric==='daily_unique';
  try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(valid(cached)&&(!valid(recent)||cached.updatedAt>recent.updatedAt))recent=cached;}catch{}
  function display(data,stale=false){
    values.textContent=`今日访客：${data.today.toLocaleString('zh-CN')} 人 · 累计访客：${data.total.toLocaleString('zh-CN')} 人次`;
    const stamp=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(data.updatedAt));
    status.textContent=(stale?'统计暂时不可用，显示最近成功数据（'+data.day+'）':'数据更新')+'：'+stamp+'（北京时间）';
    start.textContent=data.enabledAt;
  }
  if(valid(recent))display(recent,true);
  async function statistics(retryDay=true){
    if(!config.statsEndpoint){values.textContent='统计暂不可用';status.textContent='';return;}
    try{
      const response=await fetch(config.statsEndpoint+'/api/stats',{credentials:'omit',signal:AbortSignal.timeout(6000)});
      if(!response.ok)throw new Error('Statistics unavailable');let data=await response.json();if(!valid(data))throw new Error('Invalid statistics');
      recent=data;display(data);try{localStorage.setItem(cacheKey,JSON.stringify(data));}catch{}
      // Previews may read real aggregates but never add visitors.
      if(location.origin!==new URL(config.url).origin||navigator.webdriver)return;
      let identity;
      try{identity=JSON.parse(localStorage.getItem(identityKey)||'null');if(!identity||identity.day!==data.day){identity={day:data.day,id:crypto.randomUUID()};localStorage.setItem(identityKey,JSON.stringify(identity));}}catch{return;}
      const counted=await fetch(config.statsEndpoint+'/api/visit',{method:'POST',credentials:'omit',headers:{'Content-Type':'text/plain'},body:JSON.stringify({...identity,path:location.pathname}),signal:AbortSignal.timeout(6000)});
      if(counted.status===409){const value=await counted.json();if(value.day!==identity.day){try{localStorage.removeItem(identityKey);}catch{}if(retryDay)return statistics(false);throw new Error('Day changed again');}}
      if(!counted.ok)throw new Error('Counting unavailable');const result=await counted.json();
      if(valid(result)){recent=result;display(result);try{localStorage.setItem(cacheKey,JSON.stringify(result));}catch{}}
    }catch{if(valid(recent))display(recent,true);else {values.textContent='统计暂不可用';status.textContent='';start.textContent='启用日期待读取';}}
  }
  statistics();
})();
