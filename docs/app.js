(function(){
const app=document.getElementById('app');
const TYPES=[['HOLE IN ONE','Hole-in-one'],['ALBATROS','Albatros'],['EAGLE','Eagle'],['BIRDIE','Birdie'],['PAR','Par'],['BOGEY','Bogey'],['DOUBLE BOGEY','Double bogey'],['TRIPLE BOGEY','Triple bogey'],['OTHER','Other'],['PICKED UP','Škrtnutá']];
const TEE={YELLOW:'žlutá',BLUE:'modrá',WHITE:'bílá',RED:'červená',BLACK:'černá',ORANGE:'oranžová',GREEN:'zelená'};
const cls=t=>t?t.replace(/ /g,'-'):'';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=v=>v==null||v===''?'–':(typeof v==='number'&&!Number.isInteger(v)?v.toFixed(2).replace(/0$/,''):String(v)).replace('.',',');
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const cache={};
async function getJSON(u){if(!cache[u]){const r=await fetch(u,{cache:'no-cache'});if(!r.ok)throw new Error(u+' '+r.status);cache[u]=await r.json();}return cache[u];}
const tUrl=id=>'data/imports/'+id+'.json';
const ALM=()=>getJSON('data/almanac.json');
const IDX=()=>getJSON('data/imports/index.json').catch(()=>({tournaments:[]}));
function parseDate(d){const m=/(\d+)\.\s*(\d+)\.\s*(\d{4})/.exec(d||'');return m?new Date(+m[3],+m[2]-1,+m[1]):new Date(0);}
const pLink=n=>n?String(n).split(/,\s*/).map(x=>'<a href="#/hrac/'+slug(x)+'">'+esc(x)+'</a>').join(', '):'–';
const kpiA=(href,v,l)=>'<a class="kpi click" href="'+href+'"><div class="v">'+v+'</div><div class="l">'+l+'</div></a>';
const kpi=(v,l)=>'<div class="kpi"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>';
const REC={'Nejvíce titulů':'tituly','Nejvíce turnajových vítězství':'vitezstvi','Nejvíce pódií':'podia','Nejvíce odehraných turnajů':'turnaje','Nejvíce birdie':'birdie','Nejvíce parů':'par','Nejvyšší STB':'stb','Nejnižší počet ran':'rany'};
const recKey=r=>REC[r.record]||slug(r.record);
const crumbs=(...a)=>'<div class="crumbs">'+a.join(' › ')+'</div>';

// Sortable table: cols=[{k,label,n(umeric),f(ormat)(row)}]
let tblSeq=0;
function table(cols,rows,opt={}){
  const id='tb'+(++tblSeq);
  setTimeout(()=>{const el=document.getElementById(id);if(!el)return;
    el.querySelectorAll('th[data-i]').forEach(th=>th.addEventListener('click',()=>{
      const c=cols[+th.dataset.i];const dir=th.dataset.dir==='desc'?'asc':(th.dataset.dir==='asc'?'desc':(c.n?'desc':'asc'));
      const sorted=rows.slice().sort((a,b)=>{const x=a[c.k],y=b[c.k];if(x==null)return 1;if(y==null)return -1;const r=c.n?(x-y):String(x).localeCompare(String(y),'cs');return dir==='asc'?r:-r;});
      el.closest('.scroll').outerHTML=table(cols,sorted,Object.assign({},opt,{sortedBy:+th.dataset.i,dir}));
    }));},0);
  const S=opt.sortedBy;const sc=i=>S===i?' sorted':'';
  return '<div class="scroll"><table id="'+id+'"'+(opt.cls?' class="'+opt.cls+'"':'')+'><thead><tr>'+(opt.rowNum?'<th class="n rn">#</th>':'')+cols.map((c,i)=>'<th data-i="'+i+'"'+(S===i?' data-dir="'+opt.dir+'"':'')+' class="'+(c.n?'n ':'')+(c.hs?'hide-s ':'')+'sortable'+sc(i)+'" title="Seřadit">'+c.label+(S===i?(opt.dir==='asc'?' ▲':' ▼'):'')+'</th>').join('')+'</tr></thead><tbody>'+
   rows.map((r,ri)=>'<tr'+(opt.rowCls&&(S==null||opt.sepOn===S)?' class="'+opt.rowCls(r,ri,rows)+'"':'')+'>'+(opt.rowNum?'<td class="n rn">'+(ri+1)+'.</td>':'')+cols.map((c,i)=>'<td class="'+(c.n?'n ':'')+(c.hs?'hide-s':'')+sc(i)+'">'+(c.f?c.f(r):esc(fmt(r[c.k])))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}

// Členové tour: jediným autoritativním zdrojem je data/members.json.
// golferId má přednost; cgfNumbers se použijí jen pokud golferId ve zdroji chybí.
// Jméno je poslední fallback pouze pro záznamy bez obou identifikátorů.
let _mem=null;
const memberNameKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.,]/g,' ').replace(/\s+/g,' ').trim().toUpperCase();
const memberGolferId=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null;};
async function MEM(){
  if(_mem)return _mem;
  const m=await getJSON('data/members.json').catch(()=>({members:[]}));
  const members=Array.isArray(m.members)?m.members:[];
  const ignored=new Set((m.ignoredGolferIds||[]).map(memberGolferId).filter(Boolean));
  const aliases=new Map(Object.entries(m.aliases||{}).map(([from,to])=>[memberGolferId(from),memberGolferId(to)]).filter(([from,to])=>from&&to));
  const byId=new Map(),byNumber=new Map(),byName=new Map();
  members.forEach(member=>{
    const canonical=memberGolferId(member.golferId);
    if(canonical)byId.set(canonical,member);
    (member.historicalGolferIds||[]).forEach(v=>{const id=memberGolferId(v);if(id)byId.set(id,member);});
    (member.cgfNumbers||[]).forEach(v=>{const n=regKey(v);if(n)byNumber.set(n,member);});
    const nk=memberNameKey(member.name);if(nk){const a=byName.get(nk)||[];a.push(member);byName.set(nk,a);}
  });
  const resolve=p=>{
    if(!p)return null;
    const rawId=memberGolferId(p.golferId??p.playerId??p.cgfGolferId);
    if(rawId){
      if(ignored.has(rawId))return null;
      const id=aliases.get(rawId)||rawId;
      return byId.get(id)||null;
    }
    const number=regKey(p.memberNumber??p.reg??p.registrationNumber??p.cgfNumber);
    if(number)return byNumber.get(number)||null;
    const matches=byName.get(memberNameKey(p.name))||[];
    return matches.length===1?matches[0]:null;
  };
  _mem={members,resolve,is:p=>Boolean(resolve(p)),name:p=>resolve(p)?.name||p?.name||'',canonicalGolferId:p=>resolve(p)?.golferId??null};
  return _mem;
}
// Statistiky ze skórkaret ČGF podle členského čísla (jen členové tour)
async function cgfStats(){
  const idx=await IDX();const m={};const M=await MEM();
  for(const t of idx.tournaments){try{const d=await getJSON(tUrl(t.tournamentId));
    d.players.forEach(p=>{if(!M.is(p)||!p.holes.some(h=>h.strokes!=null))return;const k=regKey(p.memberNumber);const s=m[k]||(m[k]={rounds:0,eagles:0,birdies:0,pars:0,bogeys:0,doubles:0,worse:0,picked:0,holes:0,hio:0,eagleList:[]});m['n:'+slug(p.name)]=s;s.rounds++;s.name=s.name||M.name(p);
      p.holes.forEach(h=>{s.holes++;if(h.pickedUp||h.type==='PICKED UP'){s.picked++;return;}const r=h.relativeToPar;if(r==null)return;if(h.type==='HOLE IN ONE')s.hio++;if(r<=-2){s.eagles++;s.eagleList.push({d,p,h});}else if(r===-1)s.birdies++;else if(r===0)s.pars++;else if(r===1)s.bogeys++;else if(r===2)s.doubles++;else s.worse++;});});}catch(e){}}
  return m;
}
const regKey=r=>String(r||'').replace(/^0+/,'');

/* ---------- ALMANACH ---------- */
async function home(){
  const [a,idx,cs]=await Promise.all([ALM(),IDX(),cgfStats()]);
  const eag=[...new Set(Object.values(cs))].reduce((x,s)=>x+s.eagles,0);
  const list=[...idx.tournaments].sort((x,y)=>parseDate(y.date)-parseDate(x.date));
  app.innerHTML='<h1>'+esc(a.title)+'</h1><p class="muted">Desetiletý almanach Kunsters Cupu</p>'+
   (()=>{const K={'Celkem birdie':'birdie','Celkem parů':'par','Turnaje':'turnaje','Evidovaní hráči':'hraci','Ročníky':'sezony'};const card=o=>{const k=K[o.label];return k?kpiA(k==='turnaje'||k==='hraci'||k==='sezony'?'#/'+k:'#/rekord/'+k,esc(fmt(o.value)),esc(o.label)):kpi(esc(fmt(o.value)),esc(o.label));};const g=l=>a.overview.find(o=>o.label===l);const play=['Celkem birdie','Celkem parů'];return '<div class="kpis">'+a.overview.filter(o=>!play.includes(o.label)).map(card).join('')+'</div><div class="kpis">'+kpiA('#/rekord/eagle',eag,'Eagle (ze skórkaret ČGF)')+(g('Celkem birdie')?card(g('Celkem birdie')):'')+(g('Celkem parů')?card(g('Celkem parů')):'')+'</div>'+(()=>{const S=[...new Set(Object.values(cs))];const sum=k=>S.reduce((x,s)=>x+(s[k]||0),0);return '<div class="kpis">'+kpi(fmt(sum('bogeys')),'Bogey')+kpi(fmt(sum('doubles')),'Double bogey')+kpi(fmt(sum('worse')),'Horší (triple a víc)')+kpiA('#/rekordy/skrtle',fmt(sum('picked')),'Škrtnuté jamky')+kpi(fmt(sum('holes')),'Odehraných jamek')+'</div><p class="muted small">Bogey, double bogey, horší, škrtnuté a odehrané jamky se počítají ze skórkaret naimportovaných z ČGF ('+idx.tournaments.length+' turnajů, jen hráči tour). Birdie a pary jsou z almanachu za všechny ročníky.</p>';})();})()+
   '<div class="two"><div><h2>Mistři sezón</h2>'+table([{k:'year',label:'Rok',f:r=>'<a href="#/sezona/'+r.year+'">'+r.year+'</a>'},{k:'player',label:'Mistr',f:r=>pLink(r.player)}],a.champions.slice().reverse())+'</div>'+
   '<div><h2>Historická TOP 10</h2>'+table([{k:'player',label:'Hráč',f:r=>pLink(r.player)},{k:'titles',label:'Tituly',n:1},{k:'wins',label:'Vítězství',n:1},{k:'podiums',label:'Pódia',n:1},{k:'tournaments',label:'Turnaje',n:1}],a.top10)+'</div></div>'+
   '<h2>Rekordy</h2><div class="kpis">'+a.records.map(r=>kpiA('#/rekord/'+recKey(r),esc(fmt(r.value))+' <small>'+esc(r.unit)+'</small>',esc(r.record)+': '+esc(r.holder))).join('')+kpiA('#/rekord/eagle',eag+' <small>eagle</small>','Eagle: '+esc([...new Set(Object.values(cs))].filter(x=>x.eagles).map(x=>x.name).join(', ')||'–'))+'</div><p><a href="#/rekordy">Všechny rekordy →</a></p>'+
   (list.length?'<h2>Turnaje se skórkartami z ČGF</h2><div class="cards">'+list.map(t=>'<a class="card" href="#/t/'+t.tournamentId+'"><div class="t">'+esc(t.name)+'</div><div class="m">'+esc(t.date)+' · '+esc(t.venue)+'</div><div class="m">'+esc(t.format)+' · '+t.players+' hráčů</div>'+(t.winner?'<div class="w">🏆 '+esc(t.winner)+' – '+t.winnerScore+' b.</div>':'')+'</a>').join('')+'</div>':'');
}

/* ---------- SEZÓNY ---------- */
async function seasons(){
  const a=await ALM();
  const years=[...new Set(a.standings.map(s=>s.year))].sort((x,y)=>y-x);
  const champ=Object.fromEntries(a.champions.map(c=>[c.year,c.player]));
  const src=Object.fromEntries((a.seasonSources||[]).map(c=>[c.year,c.summary]));
  const top3=y=>a.standings.filter(s=>s.year===y&&s.rank<=3).sort((p,q)=>p.rank-q.rank);
  app.innerHTML='<h1>Sezóny</h1><div class="cards">'+years.map(y=>{const t=top3(y);const w=t.find(s=>s.rank===1);return '<a class="card season-card" href="#/sezona/'+y+'"><div class="t">'+y+'</div><div class="w1">🏆 '+esc(w?w.player:(champ[y]||''))+'</div>'+t.filter(s=>s.rank>1).map(s=>'<div class="w2">'+(s.rank===2?'🥈':'🥉')+' '+esc(s.player)+'</div>').join('')+'<div class="m">'+esc(src[y]||'')+'</div></a>';}).join('')+'</div>';
}
async function season(y){
  y=+y;const a=await ALM();
  const st=a.standings.filter(s=>s.year===y).sort((p,q)=>p.rank-q.rank);
  const ts=a.tournaments.filter(t=>t.year===y).sort((p,q)=>p.no-q.no);
  const py=Object.fromEntries(a.playerYears.filter(p=>p.year===y).map(p=>[p.player,p]));
  const rows=st.map(s=>Object.assign({},py[s.player]||{},s));
  app.innerHTML=crumbs('<a href="#/sezony">Sezóny</a>',String(y))+'<h1>Sezóna '+y+'</h1>'+(()=>{const r=RULES.find(x=>x.year===y);return r?(r.missing?'<p class="muted">Propozice pro tento ročník nemáme.</p>':'<div class="rulebox"><b>Pravidla '+y+':</b> do pořadí se počítá <b>'+r.counted+' nejlepších</b> výsledků z '+r.planned+' turnajů · par '+r.par+' b., birdie '+r.birdie+' b. · '+r.coef+' · <a href="#/pravidla">vývoj pravidel →</a></div>'):'';})()+
   (await seasonOfficial(y))+'<h2>'+(y===2026?'Konečné pořadí (almanach)':'Konečné pořadí')+'</h2>'+table([{k:'rank',label:'#',n:1},{k:'player',label:'Hráč',f:r=>pLink(r.player)},{k:'hcp',label:'HCP',n:1},{k:'tournaments',label:'Turnaje',n:1},{k:'wins',label:'Vítězství',n:1},{k:'podiums',label:'Pódia',n:1},{k:'avgStb',label:'Průměr STB',n:1,hs:1},{k:'bestStb',label:'Nejlepší STB',n:1,hs:1}],rows)+
   '<h2>Turnaje sezóny</h2>'+table([{k:'no',label:'#',n:1},{k:'name',label:'Turnaj',f:r=>'<a href="#/turnaj/'+r.year+'/'+r.no+'">'+esc(r.name)+'</a>'},{k:'participants',label:'Hráčů',n:1},{k:'winner',label:'Vítěz',f:r=>pLink(r.winner)},{k:'bestStb',label:'Nejlepší STB',n:1},{k:'avgStb',label:'Průměr STB',n:1,hs:1},{k:'bestStrokes',label:'Nejméně ran',n:1,hs:1}],ts);
}


/* ---------- OFICIÁLNÍ VÝSLEDKY SEZÓNY (replika Excelu) ---------- */
const SEAS=y=>getJSON('data/seasons/'+y+'.json');
async function seasonCtx(y){
  const s=await SEAS(y);const a=await ALM();
  const byReg={};a.results.forEach(r=>{if(r.reg)byReg[regKey(r.reg)]=r.player;});
  s.players.forEach(p=>{p.display=byReg[regKey(p.reg)]||p.name;
    const vals=p.results.map((r,i)=>({i,v:r.played?(r.bonus??r.total??0):null})).filter(x=>x.v!=null).sort((x,y)=>y.v-x.v);
    const keep=new Set(vals.slice(0,s.counted).map(x=>x.i));p.results.forEach((r,i)=>{r.pts=r.played?(r.bonus??r.total??0):null;r.counted=keep.has(i);});});
  const imp={};
  for(const t of s.tournaments){if(t.cgfId){try{imp[t.no]=await getJSON(tUrl(t.cgfId));}catch(e){}}}
  return {s,a,imp};
}
const ptsCell=(r,href)=>!r.played?'<span class="muted">'+(r.note||'–')+'</span>':'<a href="'+href+'" class="'+(r.counted?'cnt':'drop')+'">'+fmt(r.pts)+'</a>';
async function seasonOfficial(y){
  let ctx;try{ctx=await seasonCtx(y);}catch(e){return '';}
  const {s}=ctx;
  const head='<tr><th class="n">#</th><th>Hráč</th><th class="n">HCP duben</th>'+s.tournaments.map(t=>'<th class="n tcol"><a href="#/sezona/'+y+'/turnaj/'+t.no+'">'+t.no+'. '+esc(t.name.replace(/ – .*$/,''))+'</a><div class="small muted">'+t.date.split('-').reverse().slice(0,2).map(Number).join('. ')+'.'+(t.coef!==1?' ×'+fmt(t.coef):'')+'</div></th>').join('')+'<th class="n">Celkem vše</th><th class="n">'+s.counted+' nejlepších</th></tr>';
  const rows=s.players.map(p=>'<tr><td class="n">'+fmt(p.bestRank)+'.</td><td>'+pLink(p.display)+'</td><td class="n">'+fmt(p.hcp)+'</td>'+p.results.map((r,i)=>'<td class="n">'+ptsCell(r,'#/sezona/'+y+'/turnaj/'+(i+1))+'</td>').join('')+'<td class="n">'+fmt(p.totalAll)+'</td><td class="n big">'+fmt(p.best)+'</td></tr>').join('');
  return '<h2>Výsledky '+y+' – body Kunsters</h2><p class="muted small">Replika výsledkové tabulky (Excel „'+esc(s.source.split(' (')[0])+'“, stav k '+s.asOf.split('-').reverse().map(Number).join('. ')+'). Do pořadí se počítá '+s.counted+' nejlepších výsledků; <span class="drop">přeškrtnuté</span> výsledky se nezapočítávají. Kliknutím na turnaj zobrazíte detail (rány, STB, par, birdie, body). · <a href="#/sezona/'+y+'/odpocty">Odpočty bodů →</a></p>'+
   '<div class="fit"><table class="season"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div>';
}
async function seasonDeductions(y){
  y=+y;const {s}=await seasonCtx(y);
  const rows=s.players.map(p=>{const d=s.deductions[p.name]||{};return '<tr><td>'+pLink(p.display)+'</td>'+p.results.map((r,i)=>'<td class="n">'+ptsCell(r,'#/sezona/'+y+'/turnaj/'+(i+1))+'</td>').join('')+'<td class="n">'+fmt(d.all??p.totalAll)+'</td><td class="n big">'+fmt(d.best??p.best)+'</td><td class="n '+((d.deduct??0)>0?'neg':'')+'">'+fmt(d.deduct)+'</td></tr>';}).join('');
  app.innerHTML=crumbs('<a href="#/sezony">Sezóny</a>','<a href="#/sezona/'+y+'">'+y+'</a>','Odpočty')+'<h1>Odpočty bodů '+y+'</h1><p class="muted">Kolik bodů hráč ztratil tím, že se počítá jen '+s.counted+' nejlepších výsledků. Odečet = celkem za všechny turnaje − '+s.counted+' nejlepších. Záporný odečet znamená, že se škrtly záporné výsledky (srážky za slabé STB) a hráči to pomohlo.</p>'+
   '<div class="fit"><table class="season"><thead><tr><th>Hráč</th>'+s.tournaments.map(t=>'<th class="n tcol"><a href="#/sezona/'+y+'/turnaj/'+t.no+'">'+esc(t.name.replace(/ – .*$/,''))+'</a></th>').join('')+'<th class="n">Celkem bodů za všechny turnaje</th><th class="n">'+s.counted+' nejlepších výsledků</th><th class="n">Odečet bodů</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
async function seasonTournament(y,no){
  y=+y;no=+no;const {s,imp}=await seasonCtx(y);const t=s.tournaments.find(x=>x.no===no);const d=imp[no];
  const cg={};if(d)d.players.forEach(p=>cg[regKey(p.memberNumber)]=p);
  const st=p=>{if(!p)return null;let pars=0,bir=0,eag=0;p.holes.forEach(h=>{const r=h.relativeToPar;if(r==null)return;if(r===0)pars++;else if(r===-1)bir++;else if(r<=-2)eag++;});return {stb:p.stbTotal??p.officialScore,pars,bir,eag,strokes:p.holes.every(h=>h.strokes!=null)?p.holes.reduce((a,h)=>a+h.strokes,0):null};};
  const rows=s.players.filter(p=>p.results[no-1].played).map(p=>Object.assign({p},p.results[no-1])).sort((a,b)=>(typeof a.place==='number'?a.place:99)-(typeof b.place==='number'?b.place:99));
  const fin=t.coef!==1;
  const chk=(x,v)=>v==null||x==null||+x===+v?'':' <span class="warn" title="Výsledek k prověření – skórkarta ČGF: '+v+'">⚠ ČGF '+v+'</span>';
  const body=rows.map(r=>{const c=cg[regKey(r.p.reg)];const q=st(c);
    return '<tr><td class="n">'+fmt(r.place)+'.</td><td>'+pLink(r.p.display)+'</td><td class="n">'+(r.strokes==null?'<span class="muted" title="neúplný počet ran (škrtnutá jamka)">x</span>':fmt(r.strokes))+'</td><td class="n">'+fmt(r.stb)+(q?chk(r.stb,q.stb):'')+'</td><td class="n">'+fmt(r.pars)+(q?chk(r.pars,q.pars):'')+'</td><td class="n">'+fmt(r.birdies)+(q?chk(r.birdies,q.bir+q.eag):'')+'</td><td class="n">'+fmt(r.placePts)+'</td><td class="n">'+fmt(r.parPts)+'</td><td class="n">'+fmt(r.birdiePts)+'</td><td class="n'+(fin?'':' big')+'">'+fmt(r.total)+'</td>'+(fin?'<td class="n big">'+fmt(r.bonus)+'</td>':'')+'<td>'+(c?'<a href="#/t/'+d.tournamentId+'/p/'+c.golferId+'">skórkarta</a>':'<span class="muted">–</span>')+'</td></tr>';}).join('');
  const nPlayed=rows.length;
  app.innerHTML=crumbs('<a href="#/sezony">Sezóny</a>','<a href="#/sezona/'+y+'">'+y+'</a>',no+'. turnaj')+'<h1>'+no+'. '+esc(t.name)+'</h1><p class="muted">'+t.date.split('-').reverse().map(Number).join('. ')+' · '+nPlayed+' hráčů Kunsters'+(fin?' · body se násobí koeficientem ×'+fmt(t.coef):'')+(d?' · <a href="#/t/'+d.tournamentId+'">výsledky a skórkarty z ČGF</a>':' · skórkarty z ČGF zatím nejsou naimportované')+'</p>'+
   '<div class="kpis">'+(()=>{const w=rows[0];return kpi(w?pLink(w.p.display):'–','Vítěz turnaje')+kpi(fmt(Math.max(...rows.map(r=>r.stb||0))),'Nejlepší STB')+kpi(rows.reduce((a,r)=>a+(r.pars||0),0),'Parů celkem')+kpi(rows.reduce((a,r)=>a+(r.birdies||0),0),'Birdie celkem');})()+'</div>'+
   '<div class="fit"><table class="season"><thead><tr><th class="n">Pořadí</th><th>Hráč</th><th class="n">Rány</th><th class="n">STB</th><th class="n">Par</th><th class="n">Birdie</th><th class="n">Body za pořadí dle STB</th><th class="n">Body par</th><th class="n">Body birdie</th><th class="n">Celkem</th>'+(fin?'<th class="n">Bonus ×'+fmt(t.coef)+'</th>':'')+'<th>Skórkarta</th></tr></thead><tbody>'+body+'</tbody></table></div>'+
   '<p class="muted small">Údaje z výsledkové tabulky Kunsters. Výsledky k prověření: pokud se par, birdie nebo STB liší od skórkarty na ČGF, je u čísla ⚠ s hodnotou z ČGF. „x“ u ran = hráč měl škrtnutou jamku, celkový počet ran se nepočítá. Srážky za slabé STB: 19–15 STB −5 b., 14–10 STB −10 b., ≤9 STB −20 b.</p>'+
   '<p>'+(no>1?'<a href="#/sezona/'+y+'/turnaj/'+(no-1)+'">← předchozí turnaj</a> · ':'')+'<a href="#/sezona/'+y+'">celé pořadí</a>'+(no<s.tournaments.length?' · <a href="#/sezona/'+y+'/turnaj/'+(no+1)+'">další turnaj →</a>':'')+'</p>';
}

/* ---------- TURNAJE (historie) ---------- */
async function tournamentsAll(){
  const a=await ALM();
  const ts=a.tournaments.slice().sort((p,q)=>q.year-p.year||q.no-p.no);
  app.innerHTML='<h1>Všechny turnaje</h1><p class="muted">'+ts.length+' turnajů 2017–2026. Kliknutím na záhlaví sloupce seřadíte.</p>'+
   table([{k:'year',label:'Rok',n:1,f:r=>'<a href="#/sezona/'+r.year+'">'+r.year+'</a>'},{k:'no',label:'#',n:1},{k:'name',label:'Turnaj',f:r=>'<a href="#/turnaj/'+r.year+'/'+r.no+'">'+esc(r.name)+'</a>'},{k:'participants',label:'Hráčů',n:1},{k:'winner',label:'Vítěz',f:r=>pLink(r.winner)},{k:'bestStb',label:'Nejlepší STB',n:1},{k:'avgStb',label:'Průměr STB',n:1,hs:1},{k:'bestStrokes',label:'Nejméně ran',n:1,hs:1}],ts,{rowCls:(r,i,rows)=>i>0&&rows[i-1].year!==r.year?'ysep':'',sepOn:0});
}
async function tournamentHist(y,no){
  y=+y;no=+no;
  try{
    const s=await SEAS(y);
    const matches=(s.tournaments||[]).filter(x=>+x.no===no);
    const st=matches.length===1?matches[0]:null;
    const cgfId=st?.cgfId;
    if(cgfId!=null&&String(cgfId).trim()&&/^\d+$/.test(String(cgfId))){
      await getJSON(tUrl(cgfId));
      await tournament(cgfId);
      return;
    }
  }catch(e){console.warn('Historický turnaj používá almanachový fallback:',e);}
  const a=await ALM();
  const t=a.tournaments.find(x=>x.year===y&&x.no===no)||{name:'Turnaj'};
  const rs=a.results.filter(r=>r.year===y&&r.no===no).sort((p,q)=>(p.rank??99)-(q.rank??99)||(q.stb??0)-(p.stb??0));
  const idx=await IDX();const td=parseDate(t.name);
  const cg=idx.tournaments.find(x=>+parseDate(x.date)===+td&&+td>0);
  app.innerHTML=crumbs('<a href="#/turnaje">Turnaje</a>','<a href="#/sezona/'+y+'">'+y+'</a>',esc(t.name))+'<h1>'+esc(t.name)+'</h1>'+
   '<div class="meta"><span class="pill">Sezóna '+y+', turnaj č. '+no+'</span><span class="pill">'+rs.length+' hráčů</span>'+(cg?'<a class="pill" href="#/t/'+cg.tournamentId+'">Skórkarty z ČGF →</a>':'')+'</div>'+
   '<div class="kpis">'+kpi(pLink(t.winner),'Vítěz')+kpi(fmt(t.bestStb),'Nejlepší STB')+kpi(fmt(t.avgStb),'Průměr STB')+(()=>{const bs=rs.filter(r=>r.strokes!=null&&r.strokes>50).sort((x,z)=>x.strokes-z.strokes);const b=bs[0];return kpi(b?fmt(b.strokes):'–','Nejméně ran'+(b?': '+bs.filter(x=>x.strokes===b.strokes).map(x=>pLink(x.player)).join(', '):''));})()+'</div>'+
   '<h2>Výsledky</h2>'+table([{k:'rank',label:'#',n:1},{k:'player',label:'Hráč',f:r=>pLink(r.player)},{k:'hcp',label:'HCP',n:1,f:r=>fmt(r.hcp)+(r.hcpSource==='ČGF'?'':' <span class="muted small" title="sezónní HCP z výsledkové tabulky">*</span>')},{k:'strokes',label:'Rány',n:1,f:r=>r.strokes==null?'<span class="muted" title="škrtnutá jamka – celkový počet ran se nepočítá">x</span>':fmt(r.strokes)},{k:'stb',label:'STB',n:1},{k:'pars',label:'Par',n:1,hs:1},{k:'birdies',label:'Birdie',n:1,hs:1},{k:'points',label:'Body',n:1}],rs)+'<p class="muted small">HCP = HCP hráče před turnajem podle ČGF'+(rs.some(r=>r.hcpSource!=='ČGF')?'; * = sezónní HCP z výsledkové tabulky (skórkarta z ČGF zatím není)':'')+'. „x“ u ran = škrtnutá jamka, celkový počet ran se nepočítá.</p>';
}

/* ---------- HRÁČI ---------- */
async function players(){
  const [a0,cs]=await Promise.all([ALM(),cgfStats()]);
  const a=Object.assign({},a0,{players:a0.players.map(p=>Object.assign({},p,{eagles:(cs[regKey(p.reg)]||cs['n:'+slug(p.player)]||{}).eagles||0}))});
  app.innerHTML='<h1>Hráči</h1><p class="muted">'+a.players.length+' evidovaných hráčů. Kliknutím na záhlaví sloupce seřadíte.</p>'+
   table([{k:'player',label:'Hráč',f:r=>pLink(r.player)},{k:'seasons',label:'Sezóny',n:1},{k:'tournaments',label:'Turnaje',n:1},{k:'titles',label:'Tituly',n:1},{k:'wins',label:'Vítězství',n:1},{k:'podiums',label:'Pódia',n:1},{k:'avgStb',label:'Průměr STB',n:1},{k:'bestStb',label:'Nejlepší STB',n:1},{k:'avgStrokes',label:'Průměr ran',n:1,hs:1},{k:'bestStrokes',label:'Nejméně ran',n:1,hs:1},{k:'pars',label:'Par',n:1,hs:1},{k:'birdies',label:'Birdie',n:1,hs:1},{k:'eagles',label:'Eagle*',n:1}],a.players,{rowNum:1})+'<p class="muted small">* Eagle se počítá ze skórkaret naimportovaných z ČGF (almanach eagle neevidoval).</p>';
}
async function playerProfile(s){
  const [a,idx]=await Promise.all([ALM(),IDX()]);
  const p=a.players.find(x=>slug(x.player)===s);
  if(!p){app.innerHTML='<p>Hráč nenalezen. <a href="#/hraci">Seznam hráčů</a></p>';return;}
  const yrs=a.playerYears.filter(x=>x.player===p.player).sort((x,y)=>x.year-y.year);
  const fin=Object.fromEntries(a.standings.filter(x=>x.player===p.player).map(x=>[x.year,x]));
  yrs.forEach(y=>{y.finalRank=fin[y.year]?.rank;y.hcp=fin[y.year]?.hcp;});
  const res=a.results.filter(x=>x.player===p.player).sort((x,y)=>y.year-x.year||y.no-x.no);
  const titles=a.champions.filter(c=>c.player===p.player).map(c=>c.year);
  const css=await cgfStats();const cs=css[regKey(p.reg)]||css['n:'+s]||{eagles:0,eagleList:[]};
  // ČGF scorecards for this player (by registration number or name)
  const cgf=[];
  for(const t of idx.tournaments){try{const d=await getJSON(tUrl(t.tournamentId));const pl=d.players.find(x=>String(x.memberNumber)===String(p.reg)||slug(x.name)===s);if(pl)cgf.push({d,pl});}catch(e){}}
  const maxStb=Math.max(...yrs.map(y=>y.avgStb||0),1);
  app.innerHTML=crumbs('<a href="#/hraci">Hráči</a>',esc(p.player))+'<h1>'+esc(p.player)+'</h1>'+
   '<div class="meta"><span class="pill">Sezóny '+p.firstYear+'–'+p.lastYear+'</span>'+(titles.length?'<span class="pill">🏆 Mistr '+titles.join(', ')+'</span>':'')+'</div>'+
   '<div class="kpis">'+kpi(p.tournaments,'Turnajů')+kpi(p.wins,'Vítězství')+kpi(p.podiums,'Pódií')+kpi(p.titles,'Titulů')+kpi(fmt(p.avgStb),'Průměr STB')+kpi(p.bestStb,'Nejlepší STB')+kpi(fmt(p.bestStrokes),'Nejméně ran')+kpiA('#/rekord/birdie',p.pars+' / '+p.birdies+' / '+cs.eagles,'Par / Birdie / Eagle*')+'</div>'+
   (cs.eagleList.length?'<p>🦅 Eagle: '+cs.eagleList.map(x=>'<a href="#/t/'+x.d.tournamentId+'/p/'+x.p.golferId+'">'+esc(x.d.tournament.name)+', jamka '+x.h.hole+' (par '+x.h.par+', '+x.h.strokes+' rány)</a>').join('; ')+'</p>':'')+
   (cgf.length?'<h2>Skórkarty z ČGF</h2><div class="cards">'+cgf.map(({d,pl})=>'<a class="card" href="#/t/'+d.tournamentId+'/p/'+pl.golferId+'"><div class="t">'+esc(d.tournament.name)+'</div><div class="m">'+esc(d.tournament.date)+' · '+pl.rank+'. místo · '+fmt(pl.stbTotal)+' netto STB</div><div class="m">HCP '+fmt(pl.hcpBefore)+' → '+fmt(pl.hcpAfter)+'</div></a>').join('')+'</div>':'')+
   '<h2>Vývoj po sezónách</h2><div class="bars">'+yrs.map(y=>'<span>'+y.year+'</span><div class="bar" style="background:var(--g);width:'+(100*(y.avgStb||0)/maxStb).toFixed(1)+'%"></div><span>'+fmt(y.avgStb)+'</span>').join('')+'</div><p class="muted small">Průměr STB bodů v sezóně</p>'+
   table([{k:'year',label:'Rok',n:1,f:r=>'<a href="#/sezona/'+r.year+'">'+r.year+'</a>'},{k:'finalRank',label:'Konečné pořadí',n:1},{k:'hcp',label:'HCP',n:1,hs:1},{k:'tournaments',label:'Turnaje',n:1},{k:'wins',label:'Vítězství',n:1},{k:'podiums',label:'Pódia',n:1},{k:'avgStb',label:'Průměr STB',n:1},{k:'bestStb',label:'Nejlepší STB',n:1},{k:'avgStrokes',label:'Průměr ran',n:1,hs:1},{k:'pars',label:'Par',n:1,hs:1},{k:'birdies',label:'Birdie',n:1,hs:1}],yrs)+
   '<h2>Všechny výsledky ('+res.length+')</h2>'+
   table([{k:'year',label:'Rok',n:1},{k:'tournament',label:'Turnaj',f:r=>'<a href="#/turnaj/'+r.year+'/'+r.no+'">'+esc(r.tournament)+'</a>'},{k:'rank',label:'Pořadí',n:1},{k:'hcp',label:'HCP',n:1,hs:1},{k:'strokes',label:'Rány',n:1},{k:'stb',label:'STB',n:1},{k:'pars',label:'Par',n:1,hs:1},{k:'birdies',label:'Birdie',n:1,hs:1}],res);
}

/* ---------- REKORDY ---------- */
async function records(){
  const [a,idx]=await Promise.all([ALM(),IDX()]);
  const res=a.results;
  const top=(arr,k,n,asc)=>arr.filter(r=>r[k]!=null&&(k!=='strokes'||r[k]>50)).sort((x,y)=>asc?x[k]-y[k]:y[k]-x[k]).slice(0,n);
  const resCols=k=>[{k:'player',label:'Hráč',f:r=>pLink(r.player)},{k,label:k==='stb'?'STB':'Rány',n:1},{k:'tournament',label:'Turnaj',f:r=>'<a href="#/turnaj/'+r.year+'/'+r.no+'">'+esc(r.tournament)+'</a>'},{k:'year',label:'Rok',n:1}];
  // hole records from ČGF scorecards
  const holes=[];
  const M=await MEM();const cs=await cgfStats();
  for(const t of idx.tournaments){try{const d=await getJSON(tUrl(t.tournamentId));d.players.filter(M.is).forEach(p=>p.holes.forEach(h=>holes.push({p,h,d})));}catch(e){}}
  const worst=holes.filter(x=>x.h.relativeToPar!=null).sort((x,y)=>y.h.relativeToPar-x.h.relativeToPar).slice(0,5);
  const best=holes.filter(x=>x.h.relativeToPar!=null&&x.h.relativeToPar<0).sort((x,y)=>x.h.relativeToPar-y.h.relativeToPar).slice(0,5);
  const hcpDrop=[];for(const t of idx.tournaments){try{const d=await getJSON(tUrl(t.tournamentId));d.players.filter(M.is).forEach(p=>{if(p.hcpBefore!=null&&p.hcpAfter!=null)hcpDrop.push({p,d,v:p.hcpAfter-p.hcpBefore});});}catch(e){}}
  hcpDrop.sort((x,y)=>x.v-y.v);
  const holeRow=x=>'<tr><td>'+pLink(M.name(x.p))+'</td><td class="n">'+(x.h.relativeToPar>0?'+':'')+x.h.relativeToPar+'</td><td class="n">'+x.h.hole+' (par '+x.h.par+', '+(x.h.strokes??'–')+' ran)</td><td>'+esc(x.d.tournament.name)+'</td><td><a href="#/t/'+x.d.tournamentId+'/p/'+x.p.golferId+'">skórkarta</a> · <a href="'+esc(x.p.source)+'" target="_blank" rel="noopener">ČGF ↗</a></td></tr>';
  const holeTable=arr=>'<div class="scroll"><table><thead><tr><th>Hráč</th><th class="n">Vůči par</th><th class="n">Jamka</th><th>Turnaj</th><th>Odkaz</th></tr></thead><tbody>'+arr.map(holeRow).join('')+'</tbody></table></div>';
  app.innerHTML='<h1>Rekordy</h1><h2>Rekordy almanachu 2017–2026</h2>'+
   table([{k:'record',label:'Rekord',f:r=>'<a href="#/rekord/'+recKey(r)+'">'+esc(r.record)+' →</a>'},{k:'holder',label:'Držitel',f:r=>pLink(r.holder)},{k:'value',label:'Hodnota',n:1},{k:'unit',label:''}],a.records)+
   '<div class="two"><div><h2>Nejvíc STB v jednom turnaji</h2>'+table(resCols('stb'),top(res,'stb',10))+'</div>'+
   '<div><h2>Nejméně ran v jednom turnaji</h2>'+table(resCols('strokes'),top(res,'strokes',10,true))+'</div></div>'+
   (holes.length?'<h2>Rekordy jamek (ze skórkaret ČGF)</h2><p class="muted small">Počítá se ze všech turnajů naimportovaných z ČGF, s odkazem na konkrétní skórkartu.</p>'+
   (best.length?'<h3>Nejlepší jamky</h3>'+holeTable(best):'')+'<h3>Nejvíc ran nad par na jedné jamce</h3>'+holeTable(worst)+
   (hcpDrop.length?'<h3>Největší snížení HCP v turnaji</h3><div class="scroll"><table><thead><tr><th>Hráč</th><th class="n">Změna</th><th class="n">HCP</th><th>Turnaj</th><th>Odkaz</th></tr></thead><tbody>'+hcpDrop.slice(0,5).map(x=>'<tr><td>'+pLink(M.name(x.p))+'</td><td class="n">'+fmt(+x.v.toFixed(1))+'</td><td class="n">'+fmt(x.p.hcpBefore)+' → '+fmt(x.p.hcpAfter)+'</td><td>'+esc(x.d.tournament.name)+'</td><td><a href="#/t/'+x.d.tournamentId+'/p/'+x.p.golferId+'">skórkarta</a></td></tr>').join('')+'</tbody></table></div>':''):'')+
   (()=>{const S=[...new Set(Object.values(cs))].filter(s=>s.rounds).map(s=>Object.assign({per:+(s.picked/s.rounds).toFixed(2)},s)).sort((x,y)=>y.picked-x.picked||y.per-x.per);return S.length?'<h2 id="skrtle">Nejvíce škrtlých jamek</h2><p class="muted small">Kolikrát hráč jamku nedohrál (zvedl míček) – ze skórkaret ČGF, jen hráči tour.</p>'+table([{k:'name',label:'Hráč',f:r=>pLink(r.name)},{k:'picked',label:'Škrtnuté jamky',n:1},{k:'rounds',label:'Kol se skórkartou',n:1},{k:'per',label:'Na kolo',n:1},{k:'holes',label:'Odehraných jamek',n:1,hs:1}],S,{rowNum:1}):'';})();
}

/* ---------- DETAIL REKORDU ---------- */
async function recordDetail(key){
  const [a,idx,cs]=await Promise.all([ALM(),IDX(),cgfStats()]);
  const res=a.results;
  const cgfOf=r=>{const td=parseDate(r.tournament);return +td>0?idx.tournaments.find(x=>+parseDate(x.date)===+td):null;};
  const tLink=r=>'<a href="#/turnaj/'+r.year+'/'+r.no+'">'+esc(r.tournament)+'</a>';
  const scLink=r=>{const c=cgfOf(r);return c?'<a href="#/t/'+c.tournamentId+'">skórkarty ČGF</a>':'';};
  const rec=a.records.find(r=>recKey(r)===key);
  const head=(t,sub)=>crumbs('<a href="#/rekordy">Rekordy</a>',esc(t))+'<h1>'+esc(t)+'</h1>'+(sub?'<p class="muted">'+sub+'</p>':'');
  const perPlayer=(rows,k,label)=>{const m={};rows.forEach(r=>{m[r.player]=(m[r.player]||0)+(k?r[k]:1);});return table([{k:'player',label:'Hráč',f:r=>pLink(r.player)},{k:'v',label,n:1}],Object.entries(m).map(([player,v])=>({player,v})).sort((x,y)=>y.v-x.v));};
  const resTable=(rows,extra)=>table([{k:'year',label:'Rok',n:1},{k:'tournament',label:'Turnaj',f:tLink},{k:'player',label:'Hráč',f:r=>pLink(r.player)}].concat(extra,[{k:'_sc',label:'Skórkarta',f:scLink}]),rows);
  const sortRes=rows=>rows.sort((x,y)=>y.year-x.year||y.no-x.no);
  let html='';
  if(key==='eagle'){
    const list=[...new Set(Object.values(cs))].flatMap(s=>s.eagleList).sort((x,y)=>parseDate(y.d.tournament.date)-parseDate(x.d.tournament.date));
    html=head('Eagle','Kdo a kdy zahrál eagle (2 a více ran pod par na jamce). Zdroj: skórkarty naimportované z ČGF.')+
     '<div class="scroll"><table><thead><tr><th>Datum</th><th>Hráč</th><th>Turnaj</th><th class="n">Jamka</th><th class="n">Par</th><th class="n">Rány</th><th>Odkaz</th></tr></thead><tbody>'+
     list.map(x=>'<tr><td>'+esc(x.d.tournament.date)+'</td><td>'+esc(x.p.name)+'</td><td>'+esc(x.d.tournament.name)+'</td><td class="n">'+x.h.hole+'</td><td class="n">'+x.h.par+'</td><td class="n">'+x.h.strokes+'</td><td><a href="#/t/'+x.d.tournamentId+'/p/'+x.p.golferId+'">skórkarta</a></td></tr>').join('')+'</tbody></table></div>'+
     '<p class="muted small">Eagle je známý jen z turnajů naimportovaných z ČGF ('+idx.tournaments.length+').</p>';
  } else if(key==='birdie'||key==='par'){
    const k=key==='birdie'?'birdies':'pars',L=key==='birdie'?'Birdie':'Par';
    const rows=sortRes(res.filter(r=>r[k]>0));const tot=rows.reduce((x,r)=>x+r[k],0);
    html=head(L+' – kdo a kdy',tot+' '+(key==='birdie'?'birdie':'parů')+' v '+rows.length+' výsledcích. Počítají se kusy (jamky), ne rány.')+
     '<div class="two"><div><h2>Podle hráčů</h2>'+perPlayer(rows,k,L)+'</div><div><h2>Podle sezón</h2>'+(()=>{const m={};rows.forEach(r=>m[r.year]=(m[r.year]||0)+r[k]);return table([{k:'year',label:'Rok',n:1,f:r=>'<a href="#/sezona/'+r.year+'">'+r.year+'</a>'},{k:'v',label:L,n:1}],Object.entries(m).map(([year,v])=>({year:+year,v})).sort((x,y)=>y.year-x.year));})()+'</div></div>'+
     '<h2>Všechny turnaje s '+(key==='birdie'?'birdie':'parem')+'</h2>'+resTable(rows,[{k,label:L,n:1}]);
  } else if(key==='tituly'){
    html=head('Sezónní tituly','Mistři jednotlivých sezón.')+'<div class="two"><div>'+table([{k:'year',label:'Rok',n:1,f:r=>'<a href="#/sezona/'+r.year+'">'+r.year+'</a>'},{k:'player',label:'Mistr',f:r=>pLink(r.player)}],a.champions.slice().reverse())+'</div><div><h2>Podle hráčů</h2>'+perPlayer(a.champions,null,'Tituly')+'</div></div>';
  } else if(key==='vitezstvi'||key==='podia'){
    const max=key==='vitezstvi'?1:3;const rows=sortRes(res.filter(r=>r.rank!=null&&r.rank<=max));
    html=head(key==='vitezstvi'?'Turnajová vítězství':'Pódia (1.–3. místo)',rows.length+' umístění.')+'<div class="two"><div><h2>Podle hráčů</h2>'+perPlayer(rows,null,key==='vitezstvi'?'Vítězství':'Pódia')+'</div><div></div></div><h2>Všechny turnaje</h2>'+resTable(rows,[{k:'rank',label:'Pořadí',n:1},{k:'stb',label:'STB',n:1}]);
  } else if(key==='turnaje'){
    html=head('Odehrané turnaje','Počet odehraných turnajů podle hráčů.')+table([{k:'player',label:'Hráč',f:r=>pLink(r.player)},{k:'tournaments',label:'Turnaje',n:1},{k:'seasons',label:'Sezóny',n:1},{k:'firstYear',label:'Od',n:1},{k:'lastYear',label:'Do',n:1}],a.players.slice().sort((x,y)=>y.tournaments-x.tournaments));
  } else if(key==='stb'||key==='rany'){
    const k=key==='stb'?'stb':'strokes';const rows=res.filter(r=>r[k]!=null&&(k!=='strokes'||r[k]>50)).sort((x,y)=>k==='stb'?y[k]-x[k]:x[k]-y[k]).slice(0,30);
    html=head(key==='stb'?'Nejvyšší STB v turnaji':'Nejnižší počet ran v turnaji','TOP 30 výsledků.')+resTable(rows,[{k,label:k==='stb'?'STB':'Rány',n:1},{k:'hcp',label:'HCP',n:1,hs:1},{k:'rank',label:'Pořadí',n:1}]);
  } else { html='<p>Rekord nenalezen. <a href="#/rekordy">Rekordy</a></p>'; }
  if(rec)html=html.replace('</h1>','</h1><div class="kpis">'+kpi(esc(fmt(rec.value))+' <small>'+esc(rec.unit)+'</small>','Držitel: '+pLink(rec.holder))+'</div>');
  app.innerHTML=html;
}

/* ---------- PRAVIDLA (z PDF propozic) ---------- */
const RULES=[
 {year:2017,planned:6,counted:4,drop:2,place:'40/30/15/10/5',par:2,birdie:10,eagle:30,alb:null,hio:40,low:'–',coef:'Majkl Cup ×1,5; Finále ×2',fee:'zdarma (jen fee)',tie:'–'},
 {year:2018,planned:6,counted:4,drop:2,place:'45/30/20/15/10/5',par:2,birdie:10,eagle:30,alb:null,hio:40,low:'–',coef:'Majkl Cup ×1,5; Finále 1 ×1,75; Finále 2 ×2',fee:'zdarma (jen fee)',tie:'–'},
 {year:2019,planned:7,counted:4,drop:3,place:'50/35/25/20/15/10/5/3',par:3,birdie:10,eagle:30,alb:35,hio:50,low:'–',coef:'Majkl Cup ×1,5; Finále 1 ×1,75; Finále 2 ×2',fee:'zdarma (jen fee)',tie:'Kunratice, pak horší HCP vyhrává'},
 {year:2020,planned:7,counted:5,drop:2,place:'50/35/25/20/15/10/5/3',par:3,birdie:10,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Majkl Cup ×1,5; Finále 1 ×1,75; Finále 2 ×2',fee:'2 000 Kč',tie:'Kunratice, pak horší HCP vyhrává',note:'Plus INDOOR turnaj 28. 2. 2020 (mimo 7 turnajů). Dvoudenní finále 2.–3. 10.'},
 {year:2021,planned:7,counted:5,drop:2,place:'50/35/25/20/15/10/5/3',par:3,birdie:10,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Majkl Cup ×1,5; Finále 1 ×1,75; Finále 2 ×2',fee:'2 000 Kč',tie:'Kunratice, pak horší HCP vyhrává'},
 {year:2022,planned:8,counted:5,drop:3,place:'50/35/25/20/15/10/5/3',par:3,birdie:10,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Majkl Cup ×1,5; Finále 1 ×1,75; Finále 2 ×2',fee:'2 500 Kč',tie:'Kunratice, pak horší HCP vyhrává'},
 {year:2023,planned:8,counted:5,drop:3,place:'50/35/25/20/15/10/5/3',par:3,birdie:10,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Majkl Cup ×1,5; Finále 1 ×1,75; Finále 2 ×2',fee:'3 000 Kč',tie:'Kunratice, pak horší HCP vyhrává'},
 {year:2024,planned:8,counted:5,drop:3,place:'50/35/25/20/15/10/5/3',par:2,birdie:5,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Finále 1 ×1,25; Finále 2 ×1,5',fee:'3 000 Kč',tie:'nižší HCP vyhrává',note:'Turnaj na Slapech byl zrušen – odehráno 7 turnajů.'},
 {year:2025,planned:9,counted:6,drop:3,place:'50/35/25/20/15/10/5/3',par:2,birdie:5,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Finále 1 ×1,25; Finále 2 ×1,5',fee:'3 500 Kč',tie:'nižší HCP vyhrává'},
 {year:2026,planned:9,counted:5,drop:4,place:'50/35/25/20/15/10/5/3',par:2,birdie:5,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Finále 1 ×1,25; Finále 2 ×1,5',fee:'3 500 Kč',tie:'nižší HCP vyhrává'}];
const CHANGES=[
 [2017,'První ročník: 6 turnajů (finále 13. 10. s přespáním a přesahem do soboty), počítají se 4 nejlepší výsledky. Body za 1.–5. místo (40/30/15/10/5), za par 2, birdie 10, eagle 30, hole-in-one 40. Majkl Cup ×1,5 a finále ×2. Účast zdarma.'],
 [2018,'Finále je dvoudenní: první den ×1,75, druhý den ×2. Body se dávají za 1.–6. místo (45/30/20/15/10/5).'],
 [2019,'Body za 1.–8. místo (50/35/25/20/15/10/5/3). Par nově za 3 body, přibyl albatros (35) a hole-in-one stoupl na 50. Pravidlo pro rovnost: nejdřív trvalé bydliště v Kunraticích, pak vyhrává hráč s horším HCP.'],
 [2020,'7 turnajů (plus INDOOR), počítá se 5 nejlepších – škrtají se 2. Nově srážky za mizernou hru: 19–15 STB −5 bodů, 14–10 STB −10, 9 STB a méně −20. Vítěz turnaje dočasně získává zelené sako Kunsters, musí v něm přijet na další turnaj, a rozděluje 10 bodů ostatním. Startovné 2 000 Kč. Říjnové finále dvoudenní s přespáním.'],
 [2021,'Stejný formát jako 2020: 7 turnajů plus INDOOR, počítá se 5 nejlepších, srážky za slabé STB a 10 bodů k rozdělení od vítěze. Startovné 2 000 Kč.'],
 [2022,'8 turnajů, počítá se 5 nejlepších (škrtají se 3). Startovné 2 500 Kč. Buggy jen ze zdravotních důvodů.'],
 [2023,'Startovné 3 000 Kč. Putovní kokarda hrdosti pro vítěze a prasátko potupy pro posledního. Rozdělování 10 bodů vítězem už v propozicích není.'],
 [2024,'Turnaj na Slapech byl zrušen, odehráno 7 z 8 turnajů. Méně bodů za hru: par 2, birdie 5. Majkl Cup už bez koeficientu, finále jen ×1,25 a ×1,5. Pravidlo pro rovnost se otočilo: lepší umístění má hráč s nižším HCP a kritérium Kunratic zmizelo.'],
 [2025,'9 turnajů, počítá se 6 nejlepších. Startovné 3 500 Kč.'],
 [2026,'Jubilejní 10. ročník: 9 turnajů, ale počítá se jen 5 nejlepších (škrtají se 4).']];
async function rulesPage(){
  const a=await ALM();const cnt={};a.tournaments.forEach(t=>cnt[t.year]=(cnt[t.year]||0)+1);
  const rows=RULES.map(r=>Object.assign({played:cnt[r.year]},r));
  const v=x=>x==null?'–':String(x);
  app.innerHTML='<h1>Vývoj pravidel</h1><p class="muted">Podle PDF propozic jednotlivých ročníků. Do ročníkového pořadí se započítávají jen nejlepší výsledky, ostatní se škrtají.</p>'+
   '<div class="fit"><table class="rules"><thead><tr><th>Rok</th><th class="n">Turnajů v propozicích</th><th class="n">Odehráno (almanach)</th><th class="n">Počítá se nejlepších</th><th class="n">Škrtá se</th><th>Body za umístění</th><th class="n">Par</th><th class="n">Birdie</th><th class="n">Eagle</th><th class="n">Albatros</th><th class="n">HIO</th><th>Srážky za STB 19–15 / 14–10 / ≤9</th><th>Koeficienty</th><th>Startovné</th><th>Při rovnosti</th><th>Poznámka</th></tr></thead><tbody>'+
   rows.map(r=>r.missing?'<tr><td><a href="#/sezona/'+r.year+'">'+r.year+'</a></td><td class="n">?</td><td class="n">'+v(r.played)+'</td><td colspan="13" class="muted">Propozice nejsou k dispozici</td></tr>':
    '<tr><td><a href="#/sezona/'+r.year+'">'+r.year+'</a></td><td class="n">'+(r.plannedNote||r.planned)+'</td><td class="n'+(r.played!==(r.plannedN||r.planned)?' warn':'')+'">'+v(r.played)+'</td><td class="n big">'+r.counted+'</td><td class="n">'+r.drop+'</td><td>'+r.place+'</td><td class="n">'+r.par+'</td><td class="n">'+r.birdie+'</td><td class="n">'+r.eagle+'</td><td class="n">'+v(r.alb)+'</td><td class="n">'+r.hio+'</td><td>'+r.low+'</td><td>'+r.coef+'</td><td>'+r.fee+'</td><td>'+r.tie+'</td><td class="small">'+esc(r.note||'')+'</td></tr>').join('')+
   '</tbody></table></div><p class="muted small">„Škrtá se“ = kolik nejhorších výsledků škrtne hráč, který odehraje všechny turnaje z propozic. Zvýrazněný počet odehraných turnajů se liší od plánu v propozicích.</p>'+
   '<h2>Co se kdy měnilo</h2><div class="timeline">'+CHANGES.map(([y,t])=>'<div class="tl"><div class="y">'+y+'</div><div>'+esc(t)+'</div></div>').join('')+'</div>';
}

async function methodology(){
  const a=await ALM();
  app.innerHTML='<h1>Metodika almanachu</h1><p class="muted">Zdroj: '+esc(a.source)+'</p>'+
   table([{k:'area',label:'Oblast'},{k:'method',label:'Postup',f:r=>'<span class="wrap">'+esc(r.method)+'</span>'},{k:'note',label:'Poznámka',f:r=>'<span class="wrap">'+esc(r.note)+'</span>'}],a.methodology)+
   '<h2>Zdrojová data podle sezón</h2>'+table([{k:'year',label:'Rok',n:1},{k:'summary',label:'Načteno'}],a.seasonSources||[]);
}

/* ---------- ČGF turnaj a skórkarta ---------- */
function holeCell(h){
  if(!h) return '<td></td>';
  const txt=h.pickedUp?'—':(h.strokes??'');
  return '<td><span class="h '+cls(h.type)+'" title="'+esc(h.type||'')+'">'+txt+'</span></td>';
}
function legend(){return '<div class="legend">'+TYPES.map(([k,l])=>'<span><span class="h '+cls(k)+'">&nbsp;</span> '+l+'</span>').join('')+'</div>';}
const nameLink=(p)=>'<a href="#/t/'+p.tournamentId+'/p/'+p.golferId+'">'+esc(p.name)+'</a>';

async function tournament(id){
  const d=await getJSON(tUrl(id));const t=d.tournament;const M=await MEM();
  const ps=[...d.players].sort((a,b)=>(a.rank??999)-(b.rank??999)||(b.stbTotal??-Infinity)-(a.stbTotal??-Infinity));
  const members=ps.filter(M.is);
  const guestsData=await getJSON('data/guests.json').catch(()=>({guests:[]}));
  const guestIds=new Set((guestsData.guests||[]).flatMap(g=>[g.golferId,...(g.historicalGolferIds||[])]).filter(Boolean).map(String));
  const guestNumbers=new Set((guestsData.guests||[]).flatMap(g=>g.cgfNumbers||[]).map(regKey));
  const isGuest=p=>guestIds.has(String(p.golferId))||guestNumbers.has(regKey(p.memberNumber));
  let seasonTournament=null,seasonRule=null;
  for(let year=2017;year<=2026&&!seasonTournament;year++){try{const x=await SEAS(year);const st=(x.tournaments||[]).find(q=>String(q.cgfId)===String(id));if(st){seasonTournament=st;seasonRule=RULES.find(r=>r.year===year);}}catch(e){}}
  const tieLowerHcp=seasonRule&&seasonRule.year>=2024;
  const kunstersOrder=members.slice().sort((a,b)=>(b.stbTotal??-Infinity)-(a.stbTotal??-Infinity)||(tieLowerHcp?1:-1)*((a.hcpBefore??Infinity)-(b.hcpBefore??Infinity))||(a.rank??999)-(b.rank??999));
  const placeScale=String(seasonRule?.place||'').split('/').map(Number).filter(Number.isFinite);
  const holeStats=p=>{let par=0,birdie=0,eagle=0,albatros=0,hio=0;for(const h of p.holes||[]){if(h.type==='HOLE IN ONE')hio++;else if(h.relativeToPar===-3)albatros++;else if(h.relativeToPar===-2)eagle++;else if(h.relativeToPar===-1)birdie++;else if(h.relativeToPar===0)par++;}return {par,birdie,eagle,albatros,hio};};
  const calculatedByGolfer=new Map(kunstersOrder.map((p,i)=>{const h=holeStats(p);const stb=Number(p.stbTotal);const low=stb<=9?-20:stb<=14?-10:stb<=19?-5:0;const raw=(placeScale[i]||0)+h.par*(seasonRule?.par||0)+h.birdie*(seasonRule?.birdie||0)+h.eagle*(seasonRule?.eagle||0)+h.albatros*(seasonRule?.alb||0)+h.hio*(seasonRule?.hio||0)+(seasonRule&&seasonRule.year>=2020?low:0);const coef=Number(seasonTournament?.coef||1);return [String(p.golferId),{rank:i+1,points:raw*coef,raw,coef,...h}];}));
  const hasEagle=[...calculatedByGolfer.values()].some(x=>x.eagle>0);
  const hasAlbatros=[...calculatedByGolfer.values()].some(x=>x.albatros>0);
  const hasHio=[...calculatedByGolfer.values()].some(x=>x.hio>0);
  const scorecards=members.filter(p=>Array.isArray(p.holes)&&p.holes.length>0);
  const counts={};scorecards.forEach(p=>p.holes.forEach(h=>{counts[h.type]=(counts[h.type]||0)+1}));
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  const best=members.filter(p=>p.stbTotal!=null).slice().sort((a,b)=>(b.stbTotal??-Infinity)-(a.stbTotal??-Infinity))[0];
  const hcpDrop=members.filter(p=>p.hcpBefore!=null&&p.hcpAfter!=null).sort((a,b)=>(a.hcpAfter-a.hcpBefore)-(b.hcpAfter-b.hcpBefore))[0];
  let worst=null;scorecards.forEach(p=>p.holes.forEach(h=>{if(h.relativeToPar!=null&&(!worst||h.relativeToPar>worst.h.relativeToPar))worst={p,h};}));
  const birdies=scorecards.reduce((a,p)=>a+p.holes.filter(h=>h.relativeToPar!=null&&h.relativeToPar<0).length,0);
  app.innerHTML=crumbs('<a href="#/">Almanach</a>',esc(t.name))+
   '<h1>'+esc(t.name)+'</h1><div class="meta"><span class="pill">📅 '+esc(t.date)+'</span><span class="pill">📍 '+esc(t.venue)+'</span><span class="pill">'+esc(t.format)+(t.withHcp==='Ano'?' s HCP':'')+'</span><span class="pill">'+ps.length+' hráčů</span><a class="pill" href="'+esc(d.source)+'" target="_blank" rel="noopener">Výsledky na ČGF ↗</a></div>'+
   '<div class="kpis">'+
     kpi(best?best.stbTotal:'–','Nejvyšší netto STB: '+(best?nameLink(best):''))+
     (hcpDrop?kpi(fmt(+(hcpDrop.hcpAfter-hcpDrop.hcpBefore).toFixed(1)),'Největší snížení HCP: '+nameLink(hcpDrop)):'')+
     kpi(birdies,'Birdie a lepší')+
     (worst?kpi('+'+worst.h.relativeToPar,'Nejvíc nad par: '+nameLink(worst.p)+', jamka '+worst.h.hole):'')+
   '</div>'+
   '<h2>Výsledková listina ČGF</h2><p class="muted small">Primární pořadí podle výsledků ČGF. KUNSTERS pořadí a body jsou druhotný výpočet pouze pro členy tour'+(seasonRule?' podle pravidel '+seasonRule.year:'; sezónní pravidla zatím nebyla spárována')+'.</p><div class="scroll"><table><thead><tr><th class="n">ČGF #</th><th>Hráč</th><th class="hide-s">Klub</th><th class="n">HCP před</th><th class="n">HCP po</th><th class="n hide-s">Hrací HCP</th><th class="n hide-s">Odpaliště</th><th class="n">Netto STB</th><th class="n">KUNSTERS #</th>'+(hasEagle?'<th class="n">Eagle</th>':'')+(hasAlbatros?'<th class="n">Albatros</th>':'')+(hasHio?'<th class="n">HIO</th>':'')+'<th class="n">Kunsters body</th></tr></thead><tbody>'+
   ps.map(p=>{const c=calculatedByGolfer.get(String(p.golferId));const level=M.is(p)?'member':(isGuest(p)?'guest':'external');return '<tr class="click player-'+level+'" data-g="'+p.golferId+'"><td class="n">'+esc(p.rankLabel||p.rank)+'</td><td>'+nameLink(p)+(level==='guest'?' <span class="pill mini">host</span>':'')+'</td><td class="hide-s" title="'+esc(p.club)+'">'+esc(p.clubCode||p.club)+'</td><td class="n">'+fmt(p.hcpBefore)+'</td><td class="n">'+fmt(p.hcpAfter)+'</td><td class="n hide-s">'+fmt(p.playingHcp)+'</td><td class="n hide-s">'+esc(TEE[p.round?.tee]||p.round?.tee||'')+'</td><td class="n big">'+fmt(p.stbTotal)+'</td><td class="n">'+(c?c.rank+'.':'–')+'</td>'+(hasEagle?'<td class="n">'+fmt(c?.eagle||0)+'</td>':'')+(hasAlbatros?'<td class="n">'+fmt(c?.albatros||0)+'</td>':'')+(hasHio?'<td class="n">'+fmt(c?.hio||0)+'</td>':'')+'<td class="n big">'+(c&&seasonRule?fmt(c.points):'–')+'</td></tr>';}).join('')+
   '</tbody></table></div>'+
   '<h2>Jamky hráčů KUNSTERS</h2>'+legend()+
   '<div class="scroll"><table class="sc"><thead><tr><th>Hráč</th>'+Array.from({length:18},(_,i)=>'<th>'+(i+1)+'</th>').join('')+'<th class="sum">B</th></tr>'+
   '<tr><th class="muted">Par</th>'+Array.from({length:18},(_,i)=>'<th class="muted">'+(scorecards[0]?.holes[i]?.par??'')+'</th>').join('')+'<th></th></tr></thead><tbody>'+
   scorecards.map(p=>'<tr class="click" data-g="'+p.golferId+'"><td>'+esc(p.name)+'</td>'+Array.from({length:18},(_,i)=>holeCell(p.holes[i])).join('')+'<td class="sum">'+fmt(p.stbTotal)+'</td></tr>').join('')+
   '</tbody></table></div>'+
   '<h2>Rozložení výsledků na jamkách</h2><div class="bars">'+
   TYPES.filter(([k])=>counts[k]).map(([k,l])=>'<span>'+l+'</span><div class="bar '+cls(k)+'" style="width:'+(100*counts[k]/total).toFixed(1)+'%"></div><span>'+counts[k]+'</span>').join('')+'</div>';
  app.querySelectorAll('tr.click').forEach(tr=>tr.addEventListener('click',e=>{if(e.target.tagName!=='A')location.hash='#/t/'+id+'/p/'+tr.dataset.g;}));
}

async function player(id,gid){
  const [d,a]=await Promise.all([getJSON(tUrl(id)),ALM().catch(()=>null)]);const p=d.players.find(x=>String(x.golferId)===String(gid));
  if(!p){app.innerHTML='<p>Hráč nenalezen. <a href="#/t/'+id+'">Zpět</a></p>';return;}
  const ap=a&&(a.players.find(x=>regKey(x.reg)===regKey(p.memberNumber))||a.players.find(x=>slug(x.player)===slug(p.name)));
  const r=p.round||{};const H=p.holes;
  const seg=(a,b)=>H.slice(a,b);
  const sum=(arr,k)=>arr.reduce((s,h)=>s+(h[k]||0),0);
  const row=(label,fn,o,i,tot)=>'<tr><td>'+label+'</td>'+seg(0,9).map(fn).join('')+'<td class="sum">'+o+'</td>'+seg(9,18).map(fn).join('')+'<td class="sum">'+i+'</td><td class="sum">'+tot+'</td></tr>';
  const st=a=>a.some(h=>h.pickedUp)?'–':sum(a,'strokes');
  app.innerHTML=crumbs('<a href="#/">Almanach</a>','<a href="#/t/'+id+'">'+esc(d.tournament.name)+'</a>',esc(p.name))+
   '<h1>'+esc(p.name)+'</h1><div class="meta"><span class="pill">'+esc(p.club)+'</span><span class="pill">Pořadí: '+esc(p.rankLabel||p.rank)+'.</span><span class="pill">'+fmt(p.stbTotal)+' netto STB</span><a class="pill" href="'+esc(p.source)+'" target="_blank" rel="noopener">Skórkarta na ČGF ↗</a>'+(ap?'<a class="pill" href="#/hrac/'+slug(ap.player)+'">Profil v almanachu →</a>':'')+'</div>'+
   '<div class="kpis">'+kpi(fmt(p.hcpBefore)+' → '+fmt(p.hcpAfter),'HCP před / po')+kpi(fmt(p.playingHcp),'Hrací HCP')+kpi(esc(TEE[r.tee]||r.tee||'–'),'Odpaliště (CR '+fmt(r.cr)+' / SR '+fmt(r.sr)+')')+kpi(esc(r.course||'–'),'Hřiště · par '+fmt(r.par)+' · PCC '+fmt(r.pcc))+'</div>'+
   '<h2>Skórkarta</h2>'+legend()+
   '<div class="scroll"><table class="sc"><thead><tr><th>Jamka</th>'+Array.from({length:9},(_,i)=>'<th>'+(i+1)+'</th>').join('')+'<th class="sum">Out</th>'+Array.from({length:9},(_,i)=>'<th>'+(i+10)+'</th>').join('')+'<th class="sum">In</th><th class="sum">Celkem</th></tr></thead><tbody>'+
   row('Par',h=>'<td>'+fmt(h.par)+'</td>',sum(seg(0,9),'par'),sum(seg(9,18),'par'),sum(H,'par'))+
   row('HCP rány',h=>'<td class="muted">'+fmt(h.hcpStrokes)+'</td>',sum(seg(0,9),'hcpStrokes'),sum(seg(9,18),'hcpStrokes'),sum(H,'hcpStrokes'))+
   row('Rány',holeCell,st(seg(0,9)),st(seg(9,18)),st(H))+
   row('Body STB',h=>'<td><b>'+fmt(h.stb)+'</b></td>',sum(seg(0,9),'stb'),sum(seg(9,18),'stb'),sum(H,'stb'))+
   '</tbody></table></div>';
}

/* ---------- ROUTER ---------- */
const NAV=[['','Almanach'],['sezony','Sezóny'],['turnaje','Turnaje'],['hraci','Hráči'],['rekordy','Rekordy'],['pravidla','Pravidla'],['metodika','Metodika']];
// barvy pozadí převzaté z PDF propozic jednotlivých ročníků
const YC={2017:'#e3d5b9',2018:'#738e1e',2019:'#9fb185',2020:'#8f9f86',2021:'#87998c',2022:'#9cb1bc',2023:'#64968d',2024:'#98975c',2025:'#efd6c2',2026:'#d8dbc5'};
const SC={'':2021,sezony:2019,turnaje:2022,hraci:2023,rekordy:2024,pravidla:2018,metodika:2026,t:2025};
function paint(sec,h){const y=(h[0]==='sezona'||h[0]==='turnaj')&&YC[h[1]]?+h[1]:SC[sec]??2021;if(document.body)document.body.style.setProperty('--bg',YC[y]);}
function nav(cur){const n=document.getElementById('nav');if(n)n.innerHTML=NAV.map(([k,l])=>'<a href="#/'+k+'"'+(cur===k?' class="on"':'')+'>'+l+'</a>').join('');}
async function route(){
  const h=location.hash.replace(/^#\/?/,'').split('/');
  const sec={t:'',sezona:'sezony',turnaj:'turnaje',hrac:'hraci',rekord:'rekordy'}[h[0]]??h[0];nav(sec);paint(sec,h);if(document.body)document.body.classList.toggle('wide',h[0]==='pravidla'||h[0]==='sezona');
  try{
    if(h[0]==='t'&&h[1]&&h[2]==='p') await player(h[1],h[3]);
    else if(h[0]==='t'&&h[1]) await tournament(h[1]);
    else if(h[0]==='sezony') await seasons();
    else if(h[0]==='sezona'&&h[2]==='odpocty') await seasonDeductions(h[1]);
    else if(h[0]==='sezona'&&h[2]==='turnaj') await seasonTournament(h[1],h[3]);
    else if(h[0]==='sezona') await season(h[1]);
    else if(h[0]==='turnaje') await tournamentsAll();
    else if(h[0]==='turnaj') await tournamentHist(h[1],h[2]);
    else if(h[0]==='hraci') await players();
    else if(h[0]==='hrac') await playerProfile(h[1]);
    else if(h[0]==='rekordy') await records();
    else if(h[0]==='rekord') await recordDetail(h[1]);
    else if(h[0]==='metodika') await methodology();
    else if(h[0]==='pravidla') await rulesPage();
    else await home();
    window.scrollTo(0,0);
    if(h[0]==='rekordy'&&h[1]){const e=document.getElementById(h[1]);if(e&&e.scrollIntoView)e.scrollIntoView();}
  }catch(e){app.innerHTML='<p>Data se nepodařilo načíst. ('+esc(e.message)+')</p>';}
}
IDX().then(i=>{if(i.generatedAt)document.getElementById('gen').textContent='aktualizováno '+new Date(i.generatedAt).toLocaleString('cs-CZ');});
window.addEventListener('hashchange',route);route();
// Vždy nejnovější verze: porovná verzi skriptu s aktuálním index.html na serveru a případně stránku obnoví
(async()=>{try{const me=(document.currentScript||[...document.scripts].find(s=>/app\.js/.test(s.src))||{}).src||'';const cur=(/v=(\d+)/.exec(me)||[])[1];
  const html=await (await fetch(location.href.split('#')[0],{cache:'reload'})).text();const nw=(/app\.js\?v=(\d+)/.exec(html)||[])[1];
  if(cur&&nw&&cur!==nw&&sessionStorage.getItem('kv')!==nw){sessionStorage.setItem('kv',nw);location.reload();}}catch(e){}})();
})();
