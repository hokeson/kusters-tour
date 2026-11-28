(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const regKey=v=>String(v??'').replace(/^0+/,'');
const getJSON=async u=>{const r=await fetch(u,{cache:'no-cache'});if(!r.ok)throw new Error(u+' '+r.status);return r.json();};
const HEADCOVER_RULES={
  tiger:{
    2023:{label:'při shodě STB: Kunratice, potom horší HCP',kunratice:true,hcp:'higher'},
    2024:{label:'při shodě STB: nižší HCP',hcp:'lower'},
    2025:{label:'při shodě STB: nižší HCP',hcp:'lower'},
    2026:{label:'při shodě STB: nižší HCP',hcp:'lower'}
  },
  pig:{
    2023:{label:'při shodě nejnižšího STB: lepší HCP',hcp:'lower'},
    2024:{label:'při shodě nejnižšího STB: horší HCP',hcp:'higher'},
    2025:{label:'při shodě nejnižšího STB: horší HCP',hcp:'higher'},
    2026:{label:'při shodě nejnižšího STB: horší HCP',hcp:'higher'}
  }
};
const memberNameKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.,]/g,' ').replace(/\s+/g,' ').trim().toUpperCase();
async function members(){
  const m=await getJSON('data/members.json').catch(()=>({members:[]}));
  const ms=Array.isArray(m.members)?m.members:[];
  const byId=new Map(),byReg=new Map(),byName=new Map();
  const ignored=new Set((m.ignoredGolferIds||[]).map(String));
  const aliases=new Map(Object.entries(m.aliases||{}).map(([from,to])=>[String(from),String(to)]));
  ms.forEach(member=>{
    if(member.golferId)byId.set(String(member.golferId),member);
    (member.historicalGolferIds||[]).forEach(id=>byId.set(String(id),member));
    (member.cgfNumbers||[]).forEach(number=>{const key=regKey(number);if(key)byReg.set(key,member);});
    const key=memberNameKey(member.name);
    if(key){const matches=byName.get(key)||[];matches.push(member);byName.set(key,matches);}
  });
  return {resolve:player=>{
    if(!player)return null;
    const rawId=player.golferId??player.playerId??player.cgfGolferId;
    if(rawId!=null){const key=String(rawId);if(ignored.has(key))return null;const id=aliases.get(key)||key;return byId.get(id)||null;}
    const registration=regKey(player.reg??player.memberNumber??player.registrationNumber??player.cgfNumber);
    if(registration)return byReg.get(registration)||null;
    const matches=byName.get(memberNameKey(player.player??player.name))||[];
    return matches.length===1?matches[0]:null;
  }};
}
const hcpOf=r=>{const raw=r?.hcp;if(raw==null||raw==='')return null;const v=Number(raw);return Number.isFinite(v)?v:null;};
function kunraticeStatus(member){
  if(!member)return null;
  if(member.kunratice===true)return true;
  if(member.kunratice===false)return false;
  const residence=member.residence??member.city??member.address;
  if(residence==null||String(residence).trim()==='')return null;
  return /kunratice/i.test(String(residence));
}
function confirmed(candidate,target,allCandidates,override=false){return {player:candidate.player,players:[candidate.player],stb:target,hcp:hcpOf(candidate),unresolved:false,tied:(allCandidates||[candidate]).map(r=>r.player),override};}
function unresolved(candidates,target){const players=candidates.map(r=>r.player);return {player:null,players,stb:target,hcp:null,unresolved:true,tied:players,override:false};}
function resolveTie(candidates,year,M,mode,target){
  if(candidates.length===1)return confirmed(candidates[0],target,candidates);
  const rule=HEADCOVER_RULES[mode]?.[year];
  if(!rule)return unresolved(candidates,target);
  let remaining=candidates.slice();
  if(rule.kunratice){
    const statuses=remaining.map(candidate=>({candidate,status:kunraticeStatus(M.resolve(candidate))}));
    if(statuses.some(x=>x.status==null))return unresolved(remaining,target);
    const residents=statuses.filter(x=>x.status===true).map(x=>x.candidate);
    const nonResidents=statuses.filter(x=>x.status===false).map(x=>x.candidate);
    if(residents.length&&nonResidents.length)remaining=residents;
    if(remaining.length===1)return confirmed(remaining[0],target,candidates);
  }
  if(rule.hcp){
    const withHcp=remaining.filter(r=>hcpOf(r)!=null);
    if(withHcp.length!==remaining.length)return unresolved(remaining,target);
    const values=withHcp.map(hcpOf);
    const preferred=rule.hcp==='higher'?Math.max(...values):Math.min(...values);
    remaining=withHcp.filter(r=>hcpOf(r)===preferred);
    if(remaining.length===1)return confirmed(remaining[0],target,candidates);
  }
  return unresolved(remaining,target);
}
function overrideFor(year,no,mode,rows){
  const name=(window.KUNSTERS_HEADCOVERS_OVERRIDES||{})[mode]?.[year+'-'+no];
  if(!name)return null;
  const candidate=rows.find(r=>memberNameKey(r.player)===memberNameKey(name));
  return candidate?confirmed(candidate,Number(candidate.stb),rows,true):null;
}
function pick(rows,year,no,M,mode){
  const valid=rows.filter(row=>M.resolve(row)&&row.stb!=null&&row.stb!==''&&Number.isFinite(Number(row.stb)));
  if(!valid.length)return null;
  const values=valid.map(row=>Number(row.stb));
  const target=mode==='tiger'?Math.max(...values):Math.min(...values);
  const candidates=valid.filter(row=>Number(row.stb)===target);
  const manual=overrideFor(year,no,mode,candidates);
  if(manual)return manual;
  return resolveTie(candidates,year,M,mode,target);
}
async function build(){
  const [a,M]=await Promise.all([getJSON('data/almanac.json'),members()]);
  const tournaments=(a.tournaments||[]).filter(t=>t.year>=2023).slice().sort((x,y)=>y.year-x.year||y.no-x.no);
  const events=tournaments.map(t=>{const rows=(a.results||[]).filter(r=>r.year===t.year&&r.no===t.no);return {...t,tiger:pick(rows,t.year,t.no,M,'tiger'),pig:pick(rows,t.year,t.no,M,'pig')};});
  return {events,TIE:HEADCOVER_RULES,rules:HEADCOVER_RULES};
}
function aggregate(events,key){const m=new Map();events.forEach(e=>{const x=e[key];if(!x||x.unresolved||!x.player)return;m.set(x.player,(m.get(x.player)||0)+1);});return [...m].map(([player,count])=>({player,count})).sort((a,b)=>b.count-a.count||a.player.localeCompare(b.player,'cs'));}
const person=n=>'<a href="#/hrac/'+slug(n)+'">'+esc(n)+'</a>';
function holder(x){
  if(!x)return '<span class="hc-missing">–</span>';
  if(x.unresolved){const candidates=(x.players||x.tied||[]).map(person).join(' / ');return '<div class="hc-holder hc-unresolved"><strong>'+candidates+'</strong><span>'+x.stb+' STB · historická shoda k ověření</span></div>';}
  return '<div class="hc-holder"><strong>'+person(x.player)+'</strong><span>'+x.stb+' STB'+(x.hcp!=null?' · HCP '+String(x.hcp).replace('.',','):'')+(x.override?' · ručně potvrzeno':'')+'</span></div>';
}
function ranking(title,rows,emoji){return '<section class="hc-rank"><h2>'+emoji+' '+title+'</h2>'+(rows.length?'<ol>'+rows.map(x=>'<li><span>'+person(x.player)+'</span><b>'+x.count+'×</b></li>').join('')+'</ol>':'<p class="muted">Zatím bez potvrzených držitelů.</p>')+'</section>';}
function render({events}){return '<div class="hc-page"><div class="hc-hero"><div><div class="hc-kicker">KUNSTERS TRADICE · OD 2023</div><h1>Putovní headcovery</h1><p>Po každém turnaji putuje <b>tygřík</b> k vítězi a <b>prasátko</b> k hráči s nejnižším Stablefordem. Při shodě se použije pravidlo platné pro daný headcover a sezonu.</p></div><div class="hc-icons" aria-hidden="true"><span>🐯</span><span>🐷</span></div></div><div class="hc-summary">'+ranking('Nejvíce tygříků',aggregate(events,'tiger'),'🐯')+ranking('Nejvíce prasátek',aggregate(events,'pig'),'🐷')+'</div><h2>Historie po turnajích</h2><div class="hc-scroll"><table class="hc-table"><thead><tr><th>Sezóna</th><th>Turnaj</th><th>🐯 Tygřík</th><th>🐷 Prasátko</th></tr></thead><tbody>'+events.map(e=>'<tr><td><a href="#/sezona/'+e.year+'">'+e.year+'</a></td><td><a href="#/turnaj/'+e.year+'/'+e.no+'">'+esc(e.name)+'</a></td><td>'+holder(e.tiger)+'</td><td>'+holder(e.pig)+'</td></tr>').join('')+'</tbody></table></div><div class="hc-note"><b>Historická pravidla:</b> Tygřík: v roce 2023 při shodě nejprve Kunratice a potom horší HCP; od roku 2024 nižší HCP. Prasátko: v roce 2023 při shodě nejnižšího STB lepší HCP; od roku 2024 horší HCP. Pokud dostupná historická data shodu bezpečně nerozhodnou, zobrazí se všichni zbývající kandidáti a headcover se do souhrnného počtu nezapočítá.</div></div>';}
window.KunstersHeadcovers={build,render,async page(){return render(await build());}};
})();
