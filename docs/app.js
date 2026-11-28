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
// RECOVERY SOURCE: restore-full-app full baseline.
// Full application content continues in preserved branch and is applied atomically via PR/workflow when available.
})();
