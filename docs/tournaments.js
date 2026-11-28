(function(global){
'use strict';
function install(deps){
  const {app,ALM,IDX,parseDate,table,esc,pLink,kpi,fmt,SEAS,getJSON,tUrl,MEM,regKey,RULES,nameLink,holeCell,legend,TEE}=deps;

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

  return {tournamentsAll,tournamentHist,tournament};
}
global.KunstersTournaments={install};
})(window);
