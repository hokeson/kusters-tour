(function(){
const app=document.getElementById('app');
const TYPES=[['HOLE IN ONE','Hole-in-one'],['ALBATROS','Albatros'],['EAGLE','Eagle'],['BIRDIE','Birdie'],['PAR','Par'],['BOGEY','Bogey'],['DOUBLE BOGEY','Double bogey'],['TRIPLE BOGEY','Triple bogey'],['OTHER','Other'],['PICKED UP','Škrtnutá']];
const TEE={YELLOW:'žlutá',BLUE:'modrá',WHITE:'bílá',RED:'červená',BLACK:'černá',ORANGE:'oranžová',GREEN:'zelená'};
const cls=t=>t?t.replace(/ /g,'-'):'';
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
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
async function seasonOfficial(y){let ctx;try{ctx=await seasonCtx(y);}catch(e){return '';}const {s}=ctx;const head='<tr><th class="n">#</th><th>Hráč</th><th class="n">HCP duben</th>'+s.tournaments.map(t=>'<th class="n tcol"><a href="#/sezona/'+y+'/turnaj/'+t.no+'">'+t.no+'. '+esc(t.name.replace(/ – .*$/,''))+'</a></th>').join('')+'<th class="n">Celkem vše</th><th class="n">'+s.counted+' nejlepších</th></tr>';const rows=s.players.map(p=>'<tr><td class="n">'+fmt(p.bestRank)+'.</td><td>'+pLink(p.display)+'</td><td class="n">'+fmt(p.hcp)+'</td>'+p.results.map((r,i)=>'<td class="n">'+ptsCell(r,'#/sezona/'+y+'/turnaj/'+(i+1))+'</td>').join('')+'<td class="n">'+fmt(p.totalAll)+'</td><td class="n big">'+fmt(p.best)+'</td></tr>').join('');return '<h2>Výsledky '+y+' – body Kunsters</h2><div class="fit"><table class="season"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div>';}
async function seasonDeductions(y){y=+y;const {s}=await seasonCtx(y);app.innerHTML=crumbs('<a href="#/sezony">Sezóny</a>','<a href="#/sezona/'+y+'">'+y+'</a>','Odpočty')+'<h1>Odpočty bodů '+y+'</h1>';}
async function seasonTournament(y,no){y=+y;no=+no;const {s}=await seasonCtx(y);const t=s.tournaments.find(x=>x.no===no);app.innerHTML=crumbs('<a href="#/sezony">Sezóny</a>','<a href="#/sezona/'+y+'">'+y+'</a>',no+'. turnaj')+'<h1>'+no+'. '+esc(t.name)+'</h1>';}

/* ---------- TURNAJE (historie) ---------- */
async function tournamentsAll(){const a=await ALM();const ts=a.tournaments.slice().sort((p,q)=>q.year-p.year||q.no-p.no);app.innerHTML='<h1>Všechny turnaje</h1>'+table([{k:'year',label:'Rok',n:1},{k:'no',label:'#',n:1},{k:'name',label:'Turnaj'},{k:'winner',label:'Vítěz'}],ts);}
async function tournamentHist(y,no){y=+y;no=+no;const a=await ALM();const t=a.tournaments.find(x=>x.year===y&&x.no===no)||{name:'Turnaj'};const rs=a.results.filter(r=>r.year===y&&r.no===no).sort((p,q)=>(p.rank??99)-(q.rank??99));app.innerHTML='<h1>'+esc(t.name)+'</h1>'+table([{k:'rank',label:'#',n:1},{k:'player',label:'Hráč',f:r=>pLink(r.player)},{k:'stb',label:'STB',n:1}],rs);}

/* ---------- HRÁČI ---------- */
async function players(){const a=await ALM();app.innerHTML='<h1>Hráči</h1>'+table([{k:'player',label:'Hráč',f:r=>pLink(r.player)},{k:'seasons',label:'Sezóny',n:1},{k:'tournaments',label:'Turnaje',n:1},{k:'titles',label:'Tituly',n:1},{k:'wins',label:'Vítězství',n:1},{k:'podiums',label:'Pódia',n:1},{k:'avgStb',label:'Průměr STB',n:1},{k:'bestStb',label:'Nejlepší STB',n:1}],a.players,{rowNum:1});}
async function playerProfile(s){const a=await ALM();const p=a.players.find(x=>slug(x.player)===s);if(!p){app.innerHTML='<p>Hráč nenalezen.</p>';return;}app.innerHTML='<h1>'+esc(p.player)+'</h1><div class="kpis">'+kpi(p.tournaments,'Turnajů')+kpi(p.wins,'Vítězství')+kpi(p.titles,'Titulů')+'</div>';}

/* ---------- REKORDY ---------- */
async function records(){const a=await ALM();app.innerHTML='<h1>Rekordy</h1>'+table([{k:'record',label:'Rekord'},{k:'holder',label:'Držitel',f:r=>pLink(r.holder)},{k:'value',label:'Hodnota',n:1}],a.records);}
async function recordDetail(){await records();}

/* ---------- PRAVIDLA ---------- */
const RULES=[
 {year:2017,planned:6,counted:4,drop:2,place:'40/30/15/10/5',par:2,birdie:10,eagle:30,alb:null,hio:40,low:'–',coef:'Majkl Cup ×1,5; Finále ×2',fee:'zdarma',tie:'–'},
 {year:2018,planned:6,counted:4,drop:2,place:'45/30/20/15/10/5',par:2,birdie:10,eagle:30,alb:null,hio:40,low:'–',coef:'Majkl Cup ×1,5; Finále ×1,75/×2',fee:'zdarma',tie:'–'},
 {year:2019,planned:7,counted:4,drop:3,place:'50/35/25/20/15/10/5/3',par:3,birdie:10,eagle:30,alb:35,hio:50,low:'–',coef:'Majkl Cup ×1,5; Finále ×1,75/×2',fee:'zdarma',tie:'Kunratice, pak horší HCP'},
 {year:2020,planned:7,counted:5,drop:2,place:'50/35/25/20/15/10/5/3',par:3,birdie:10,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Majkl Cup ×1,5; Finále ×1,75/×2',fee:'2 000 Kč',tie:'Kunratice, pak horší HCP'},
 {year:2021,planned:7,counted:5,drop:2,place:'50/35/25/20/15/10/5/3',par:3,birdie:10,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Majkl Cup ×1,5; Finále ×1,75/×2',fee:'2 000 Kč',tie:'Kunratice, pak horší HCP'},
 {year:2022,planned:8,counted:5,drop:3,place:'50/35/25/20/15/10/5/3',par:3,birdie:10,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Majkl Cup ×1,5; Finále ×1,75/×2',fee:'2 500 Kč',tie:'Kunratice, pak horší HCP'},
 {year:2023,planned:8,counted:5,drop:3,place:'50/35/25/20/15/10/5/3',par:3,birdie:10,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Majkl Cup ×1,5; Finále ×1,75/×2',fee:'3 000 Kč',tie:'Kunratice, pak horší HCP'},
 {year:2024,planned:8,counted:5,drop:3,place:'50/35/25/20/15/10/5/3',par:2,birdie:5,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Finále ×1,25/×1,5',fee:'3 000 Kč',tie:'nižší HCP'},
 {year:2025,planned:9,counted:6,drop:3,place:'50/35/25/20/15/10/5/3',par:2,birdie:5,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Finále ×1,25/×1,5',fee:'3 500 Kč',tie:'nižší HCP'},
 {year:2026,planned:9,counted:5,drop:4,place:'50/35/25/20/15/10/5/3',par:2,birdie:5,eagle:30,alb:35,hio:50,low:'−5 / −10 / −20',coef:'Finále ×1,25/×1,5',fee:'3 500 Kč',tie:'nižší HCP'}];
async function rulesPage(){app.innerHTML='<h1>Vývoj pravidel</h1>'+table([{k:'year',label:'Rok',n:1},{k:'planned',label:'Turnajů',n:1},{k:'counted',label:'Počítá se',n:1},{k:'par',label:'Par',n:1},{k:'birdie',label:'Birdie',n:1},{k:'coef',label:'Koeficienty'}],RULES);}
async function methodology(){const a=await ALM();app.innerHTML='<h1>Metodika almanachu</h1>'+table([{k:'area',label:'Oblast'},{k:'method',label:'Postup'},{k:'note',label:'Poznámka'}],a.methodology||[]);}

/* ---------- ČGF turnaj a skórkarta ---------- */
function holeCell(h){if(!h)return '<td></td>';return '<td><span class="h '+cls(h.type)+'">'+(h.pickedUp?'—':(h.strokes??''))+'</span></td>';}
function legend(){return '<div class="legend">'+TYPES.map(([k,l])=>'<span><span class="h '+cls(k)+'">&nbsp;</span> '+l+'</span>').join('')+'</div>';}
const nameLink=p=>'<a href="#/t/'+p.tournamentId+'/p/'+p.golferId+'">'+esc(p.name)+'</a>';
async function tournament(id){const d=await getJSON(tUrl(id));const t=d.tournament;const M=await MEM();const ps=[...d.players].sort((a,b)=>(a.rank??999)-(b.rank??999));const members=ps.filter(M.is);app.innerHTML='<h1>'+esc(t.name)+'</h1><h2>Výsledková listina ČGF</h2>'+table([{k:'rank',label:'ČGF #',n:1},{k:'name',label:'Hráč',f:p=>nameLink(p)},{k:'stbTotal',label:'Netto STB',n:1},{k:'hcpBefore',label:'HCP před',n:1},{k:'hcpAfter',label:'HCP po',n:1}],ps)+(members.length?'<h2>Jamky hráčů KUNSTERS</h2>'+legend():'');}
async function player(id,gid){const d=await getJSON(tUrl(id));const p=d.players.find(x=>String(x.golferId)===String(gid));if(!p){app.innerHTML='<p>Hráč nenalezen.</p>';return;}app.innerHTML='<h1>'+esc(p.name)+'</h1><div class="kpis">'+kpi(fmt(p.stbTotal),'Netto STB')+kpi(fmt(p.hcpBefore)+' → '+fmt(p.hcpAfter),'HCP před / po')+'</div>';}

/* ---------- ROUTER ---------- */
const NAV=[['','Almanach'],['sezony','Sezóny'],['turnaje','Turnaje'],['hraci','Hráči'],['rekordy','Rekordy'],['pravidla','Pravidla'],['metodika','Metodika']];
const YC={2017:'#e3d5b9',2018:'#738e1e',2019:'#9fb185',2020:'#8f9f86',2021:'#87998c',2022:'#9cb1bc',2023:'#64968d',2024:'#98975c',2025:'#efd6c2',2026:'#d8dbc5'};
const SC={'':2021,sezony:2019,turnaje:2022,hraci:2023,rekordy:2024,pravidla:2018,metodika:2026,t:2025};
function paint(sec,h){const y=(h[0]==='sezona'||h[0]==='turnaj')&&YC[h[1]]?+h[1]:SC[sec]??2021;if(document.body)document.body.style.setProperty('--bg',YC[y]);}
function nav(cur){const n=document.getElementById('nav');if(n)n.innerHTML=NAV.map(([k,l])=>'<a href="#/'+k+'"'+(cur===k?' class="on"':'')+'>'+l+'</a>').join('');}
async function route(){const h=location.hash.replace(/^#\/?/,'').split('/');const sec={t:'',sezona:'sezony',turnaj:'turnaje',hrac:'hraci',rekord:'rekordy'}[h[0]]??h[0];nav(sec);paint(sec,h);if(document.body)document.body.classList.toggle('wide',h[0]==='pravidla'||h[0]==='sezona');try{if(h[0]==='t'&&h[1]&&h[2]==='p')await player(h[1],h[3]);else if(h[0]==='t'&&h[1])await tournament(h[1]);else if(h[0]==='sezony')await seasons();else if(h[0]==='sezona'&&h[2]==='odpocty')await seasonDeductions(h[1]);else if(h[0]==='sezona'&&h[2]==='turnaj')await seasonTournament(h[1],h[3]);else if(h[0]==='sezona')await season(h[1]);else if(h[0]==='turnaje')await tournamentsAll();else if(h[0]==='turnaj')await tournamentHist(h[1],h[2]);else if(h[0]==='hraci')await players();else if(h[0]==='hrac')await playerProfile(h[1]);else if(h[0]==='rekordy')await records();else if(h[0]==='rekord')await recordDetail(h[1]);else if(h[0]==='metodika')await methodology();else if(h[0]==='pravidla')await rulesPage();else await home();window.scrollTo(0,0);}catch(e){app.innerHTML='<p>Data se nepodařilo načíst. ('+esc(e.message)+')</p>';}}
IDX().then(i=>{if(i.generatedAt&&document.getElementById('gen'))document.getElementById('gen').textContent='aktualizováno '+new Date(i.generatedAt).toLocaleString('cs-CZ');});
window.addEventListener('hashchange',route);route();
})();