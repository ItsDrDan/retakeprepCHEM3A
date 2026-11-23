/* Exam tools: floating reference Book and TI-36X Pro-style practice calculator (same calculator as the Algebra Trainer). */
const Calc=(()=>{
/* ---------- entry model ----------
   list of tokens: {t:'c',v} char/operator, {t:'f',v:'ln'|'log'|'√'} function with "(",
   {t:'frac',n:[],d:[]}, {t:'pow',e:[]} (superscript on the thing before it), {t:'base',b:'e'|'10',e:[]} */
let entry=[],frames=[{list:entry,i:0}],hist=[],ans=0,second=false,last=null,lastTok=null,fresh=true,showFrac=false,err=null;
const top=()=>frames[frames.length-1];
const slotsOf=t=>t.t==='frac'?['n','d']:t.t==='pow'||t.t==='base'?['e']:[];
function reset(){entry=[];frames=[{list:entry,i:0}];err=null}
function ins(tok){const f=top();f.list.splice(f.i,0,tok);f.i++;const s=slotsOf(tok);if(s.length)frames.push({list:tok[s[0]],i:0,tok,slot:s[0],at:f.i-1});return tok}
function exitRight(){if(frames.length<2)return false;const fr=frames.pop();top().i=fr.at+1;return true}
function exitLeft(){if(frames.length<2)return false;const fr=frames.pop();top().i=fr.at;return true}
function right(){const f=top();if(f.i<f.list.length){const t=f.list[f.i],s=slotsOf(t);if(s.length){frames.push({list:t[s[0]],i:0,tok:t,slot:s[0],at:f.i})}else f.i++}
 else{const fr=top();if(fr.tok&&fr.tok.t==='frac'&&fr.slot==='n'){fr.slot='d';fr.list=fr.tok.d;fr.i=0}else exitRight()}}
function left(){const f=top();if(f.i>0){const t=f.list[f.i-1],s=slotsOf(t);if(s.length){const sl=s[s.length-1];frames.push({list:t[sl],i:t[sl].length,tok:t,slot:sl,at:f.i-1})}else f.i--}
 else{const fr=top();if(fr.tok&&fr.tok.t==='frac'&&fr.slot==='d'){fr.slot='n';fr.list=fr.tok.n;fr.i=fr.list.length}else exitLeft()}}
function vert(dir){for(let k=frames.length-1;k>0;k--){const fr=frames[k];if(fr.tok.t==='frac'){const want=dir>0?'d':'n';if(fr.slot!==want){frames.length=k+1;fr.slot=want;fr.list=fr.tok[want];fr.i=Math.min(fr.i,fr.list.length)}return}}}
function del(){const f=top();if(f.i>0){f.list.splice(f.i-1,1);f.i--}else if(frames.length>1){const fr=frames.pop();const p=top();
 const empty=slotsOf(fr.tok).every(s=>!fr.tok[s].length);if(empty){p.list.splice(fr.at,1);p.i=fr.at}else p.i=fr.at}}

/* ---------- evaluate ---------- */
class CalcErr extends Error{}
function lex(list){const out=[];let i=0;
 while(i<list.length){const t=list[i];
  if(t.t==='c'&&/[0-9.]/.test(t.v)){let s='';while(i<list.length&&list[i].t==='c'&&/[0-9.]/.test(list[i].v)){s+=list[i].v;i++}
   if(i<list.length&&list[i].t==='c'&&list[i].v==='E'){i++;let sg='';if(i<list.length&&list[i].t==='c'&&list[i].v==='⁻'){sg='-';i++}let ex='';while(i<list.length&&list[i].t==='c'&&/[0-9]/.test(list[i].v)){ex+=list[i].v;i++}if(!ex)throw new CalcErr('SYNTAX');s+='e'+sg+ex}
   if((s.match(/\./g)||[]).length>1||s==='.')throw new CalcErr('SYNTAX');out.push({k:'val',v:parseFloat(s)});continue}
  if(t.t==='c'&&t.v==='E'){i++;let sg='';if(i<list.length&&list[i].t==='c'&&list[i].v==='⁻'){sg='-';i++}let ex='';while(i<list.length&&list[i].t==='c'&&/[0-9]/.test(list[i].v)){ex+=list[i].v;i++}if(!ex)throw new CalcErr('SYNTAX');out.push({k:'val',v:parseFloat('1e'+sg+ex)});continue}
  i++;
  if(t.t==='c'){const v=t.v;
   if('+−×÷'.includes(v))out.push({k:'op',v});else if(v==='(')out.push({k:'lp'});else if(v===')')out.push({k:'rp'});
   else if(v==='⁻')out.push({k:'neg'});else if(v==='²'||v==='⁻¹')out.push({k:'post',v});
   else if(v==='π')out.push({k:'val',v:Math.PI});else if(v==='ans')out.push({k:'val',v:ans});else throw new CalcErr('SYNTAX')}
  else if(t.t==='f')out.push({k:'fn',v:t.v});
  else if(t.t==='frac'){const n=value(t.n),d=value(t.d);if(d===0)throw new CalcErr('DIVIDE BY 0');out.push({k:'val',v:n/d})}
  else if(t.t==='pow')out.push({k:'powt',v:value(t.e)});
  else if(t.t==='base')out.push({k:'val',v:Math.pow(t.b==='e'?Math.E:10,value(t.e))})}
 return out}
function value(list){if(!list.length)throw new CalcErr('SYNTAX');return parseTokens(lex(list))}
function parseTokens(T){let i=0;const pk=()=>T[i];
 const startsPrimary=t=>t&&(t.k==='val'||t.k==='lp'||t.k==='fn'||t.k==='neg');
 function add(){let v=mul();while(pk()&&pk().k==='op'&&(pk().v==='+'||pk().v==='−')){const o=T[i++].v,r=mul();v=o==='+'?v+r:v-r}return v}
 function mul(){let v=neg();for(;;){const t=pk();if(t&&t.k==='op'&&(t.v==='×'||t.v==='÷')){i++;const r=neg();if(t.v==='÷'){if(r===0)throw new CalcErr('DIVIDE BY 0');v/=r}else v*=r}
   else if(startsPrimary(t)&&t.k!=='neg'){v*=neg()}else break}return v}
 function neg(){if(pk()&&pk().k==='neg'){i++;return-neg()}return post()}
 function post(){let v=prim();for(;;){const t=pk();if(!t)break;if(t.k==='post'){i++;v=t.v==='²'?v*v:(v===0?(()=>{throw new CalcErr('DIVIDE BY 0')})():1/v)}else if(t.k==='powt'){i++;v=Math.pow(v,t.v)}else break}return v}
 function prim(){const t=T[i++];if(!t)throw new CalcErr('SYNTAX');
  if(t.k==='val')return t.v;
  if(t.k==='lp'){const v=add();if(pk()&&pk().k==='rp')i++;return v}
  if(t.k==='fn'){const x=add();if(pk()&&pk().k==='rp')i++;if(t.v==='√'){if(x<0)throw new CalcErr('DOMAIN');return Math.sqrt(x)}if(x<=0)throw new CalcErr('DOMAIN');return t.v==='ln'?Math.log(x):Math.log10(x)}
  throw new CalcErr('SYNTAX')}
 const v=add();if(i<T.length){if(T[i].k==='rp'){throw new CalcErr('SYNTAX')}throw new CalcErr('SYNTAX')}return v}
function evaluate(list){const v=value(list);if(!isFinite(v)||isNaN(v))throw new CalcErr('OVERFLOW');return v}

/* ---------- formatting ---------- */
const SUP={'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
function fmt(x){if(x===0)return'0';const a=Math.abs(x);
 if(a>=1e10||a<1e-3){let[m,e]=x.toExponential(9).split('e');m=m.replace(/\.?0+$/,'');return m.replace('-','⁻')+'×10'+String(+e).split('').map(c=>SUP[c]).join('')}
 let s=String(+x.toPrecision(10));if(/e/.test(s))s=x.toFixed(10).replace(/\.?0+$/,'');return s.replace('-','⁻')}
function plainE(x){if(x===0)return'0';const a=Math.abs(x);if(a>=1e10||a<1e-3){let[m,e]=x.toExponential(9).split('e');return m.replace(/\.?0+$/,'')+'E'+(+e)}return String(+x.toPrecision(10))}
function frac(x){if(!isFinite(x)||Number.isInteger(x))return null;for(let d=2;d<=1000;d++){const n=Math.round(x*d);if(Math.abs(n/d-x)<1e-12*Math.max(1,Math.abs(x)))return[n,d]}return null}

/* ---------- rendering ---------- */
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function rList(list,cur){let h='';list.forEach((t,k)=>{if(cur&&cur.list===list&&cur.i===k)h+='<i class="cc"></i>';h+=rTok(t,cur)});
 if(cur&&cur.list===list&&cur.i===list.length)h+='<i class="cc"></i>';if(!list.length&&!(cur&&cur.list===list))h='<span class="slot"></span>';return h}
function rTok(t,cur){if(t.t==='c'){const m={'⁻':'<span class="ng">-</span>','E':'<span class="ee">E</span>','²':'<sup>2</sup>','⁻¹':'<sup>-1</sup>','ans':'ans'};return m[t.v]!=null?m[t.v]:esc(t.v)}
 if(t.t==='f')return t.v+'(';
 if(t.t==='frac')return'<span class="mf"><span>'+rList(t.n,cur)+'</span><b></b><span>'+rList(t.d,cur)+'</span></span>';
 if(t.t==='pow')return'<sup class="ms">'+rList(t.e,cur)+'</sup>';
 return(t.b==='e'?'e':'10')+'<sup class="ms">'+rList(t.e,cur)+'</sup>'}
function rFrac(f){return'<span class="mf"><span>'+(f[0]<0?'⁻':'')+Math.abs(f[0])+'</span><b></b><span>'+f[1]+'</span></span>'}

/* ---------- keys ---------- */
const OPS={add:'+',sub:'−',mul:'×',div:'÷'};
function press(k){
 if(k==='second'){second=!second;draw();return}
 const s2=second;second=false;
 if(err&&k!=='clear'&&k!=='del'&&k!=='left'&&k!=='right'){err=null}
 const prevLast=last;last=k;
 // after enter: operator keys start with ans
 if(fresh&&!entry.length&&hist.length&&(OPS[k]||k==='sq'&&!s2||k==='pow'||(k==='pow'&&s2))){ins({t:'c',v:'ans'})}
 if(k!=='toggle')showFrac=false;
 if(/^[0-9]$/.test(k)){ins({t:'c',v:k})}
 else if(k==='dot')ins({t:'c',v:'.'});
 else if(OPS[k])ins({t:'c',v:OPS[k]});
 else if(k==='lp')ins({t:'c',v:'('});else if(k==='rp')ins({t:'c',v:')'});
 else if(k==='neg'){if(s2)ins({t:'c',v:'ans'});else ins({t:'c',v:'⁻'})}
 else if(k==='ee')ins({t:'c',v:'E'});
 else if(k==='pi')ins({t:'c',v:'π'});
 else if(k==='sq'){if(s2)lastTok=ins({t:'f',v:'√'});else ins({t:'c',v:'²'})}
 else if(k==='pow'){if(s2)ins({t:'c',v:'⁻¹'});else{const fr=top();if(fr.tok&&fr.tok.t==='pow'){if(!fr.tok.e.length){frames.pop();const pf=top();pf.list.splice(fr.at,1);pf.i=fr.at}else exitRight()}else ins({t:'pow',e:[]})}}
 else if(k==='lnlog'){const f=top();if(prevLast==='lnlog'&&lastTok&&f.list[f.i-1]===lastTok&&lastTok.t==='f'){lastTok.v=lastTok.v==='ln'?'log':'ln'}else lastTok=ins({t:'f',v:'ln'})}
 else if(k==='expk'){const f=top();if(prevLast==='expk'&&lastTok&&f.tok===lastTok&&!lastTok.e.length){lastTok.b=lastTok.b==='e'?'10':'e'}else lastTok=ins({t:'base',b:'e',e:[]})}
 else if(k==='frac'){const f=top(),prev=f.list[f.i-1];
  /* typing a number first then □/□ puts that number on top, like MathPrint */
  let n=[];if(!s2){let j=f.i;while(j>0&&f.list[j-1].t==='c'&&/[0-9.]/.test(f.list[j-1].v))j--;if(j<f.i){n=f.list.splice(j,f.i-j);f.i=j}}
  const t={t:'frac',n,d:[]};f.list.splice(f.i,0,t);f.i++;frames.push(n.length?{list:t.d,i:0,tok:t,slot:'d',at:f.i-1}:{list:t.n,i:0,tok:t,slot:'n',at:f.i-1})}
 else if(k==='right')right();else if(k==='left')left();else if(k==='down')vert(1);else if(k==='up')vert(-1);
 else if(k==='del'){del()}
 else if(k==='clear'){if(entry.length||err)reset();else hist=[];showFrac=false}
 else if(k==='toggle'){if(!entry.length&&hist.length){showFrac=!showFrac}}
 else if(k==='enter'){enter();return}
 else if(k==='mode'){err='Mode menu is not included here.'}
 fresh=false;draw()}
function enter(){if(!entry.length){if(hist.length){entry=JSON.parse(JSON.stringify(hist[hist.length-1].entry));}else{draw();return}}
 try{const v=evaluate(entry);ans=v;hist.push({entry,v,html:rList(entry,null)});if(hist.length>12)hist.shift();reset();fresh=true;showFrac=false}
 catch(e){err=e instanceof CalcErr?e.message+' ERROR':'SYNTAX ERROR'}draw()}

/* ---------- UI ---------- */
let root=null,screen=null,onAns=null,playing=false;
const KEYS=[ // [id, label, 2nd label, class]; null = arrow pad spot
 ['second','2nd','','k2nd'],['mode','mode','quit',''],['del','delete','insert',''],null,
 ['lnlog','ln/log','',''],['expk','eˣ/10ˣ','',''],['frac',null,'Un/d',''],['toggle','◂ ▸','',''],['clear','clear','',''],
 ['sq','x²','√',''],['pow','x<sup>□</sup>','x⁻¹',''],['lp','(','',''],['rp',')','',''],['div','÷','',''],
 ['ee','EE','',''],['7','7','','num'],['8','8','','num'],['9','9','','num'],['mul','×','',''],
 ['pi','π','',''],['4','4','','num'],['5','5','','num'],['6','6','','num'],['sub','−','',''],
 ['sto','sto→','','off'],['1','1','','num'],['2','2','','num'],['3','3','','num'],['add','+','',''],
 ['on','on','off','off'],['0','0','','num'],['dot','.','','num'],['neg','(−)','ans',''],['enter','enter','','kent']];
const FRAC_ICON='<svg viewBox="0 0 12 20" width="13" height="21" aria-hidden="true"><rect x="1.5" y="1" width="9" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1=".5" y1="10" x2="11.5" y2="10" stroke="currentColor" stroke-width="1.6"/><rect x="1.5" y="12" width="9" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const NAMES={second:'2nd',del:'delete',lnlog:'ln / log',expk:'e to the x / 10 to the x',frac:'fraction',toggle:'toggle',clear:'clear',pi:'pi',pow:'power',sq:'x squared',lp:'open parenthesis',rp:'close parenthesis',ee:'EE',div:'divide',neg:'negative',mul:'times',sub:'minus',add:'plus',dot:'decimal point',enter:'enter',left:'left',right:'right',up:'up',down:'down',mode:'mode'};
function mount(el,cb){root=el;onAns=cb;
 const pad='<div class="dpad" role="group" aria-label="Arrow keys"><button type="button" data-k="up" aria-label="up">▲</button><button type="button" data-k="left" aria-label="left">◀</button><button type="button" data-k="right" aria-label="right">▶</button><button type="button" data-k="down" aria-label="down">▼</button></div>';
 let keys='';KEYS.forEach(k=>{if(k===null){keys+=pad;return}
  const lab=k[0]==='frac'?FRAC_ICON:k[1];keys+='<div class="kc"><small>'+(k[2]||'&nbsp;')+'</small><button type="button" class="'+k[3]+'" data-k="'+k[0]+'" aria-label="'+(NAMES[k[0]]||k[0])+'"'+(k[3]==='off'?' disabled title="Not used in this game"':'')+'>'+lab+'</button></div>'});
 el.innerHTML='<div class="tcalc"><div class="tcalc-brand"><b>Practice calculator</b><span>TI-36X Pro-style keys</span></div><div class="lcd" aria-live="polite"><div class="ind" id="cInd"></div><div class="scr" id="cScr"></div></div><div class="keys">'+keys+'</div>'+
  '<div class="tcalc-foot"><button type="button" class="btn" id="cUse">↧ Put ans in my answer</button></div></div>';
 screen=el.querySelector('#cScr');
 el.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click',()=>{if(!playing)press(b.dataset.k)}));
 el.querySelector('#cUse').onclick=()=>{if(onAns&&hist.length)onAns(plainE(ans))};
 el.addEventListener('keydown',e=>{const m={'+':'add','-':'sub','*':'mul','/':'div','(':'lp',')':'rp','.':'dot','Enter':'enter','=':'enter','Backspace':'del','ArrowLeft':'left','ArrowRight':'right','ArrowUp':'up','ArrowDown':'down','^':'pow','Escape':'clear','e':'ee','E':'ee'};
  const k=/^[0-9]$/.test(e.key)?e.key:m[e.key];if(k&&!playing&&!e.ctrlKey&&!e.metaKey){e.preventDefault();press(k);flash(k)}});
 draw()}
function draw(){if(!screen)return;const ind=root.querySelector('#cInd');const fr0=top(),inPow=!!(fr0&&fr0.tok&&fr0.tok.t==='pow');ind.textContent=(second?'2ND ':'')+(inPow?'EXPONENT':'');const pk=root.querySelector('[data-k="pow"]');if(pk)pk.classList.toggle('lit',inPow);
 let h='';hist.slice(-2).forEach((r,k,arr)=>{const res=k===arr.length-1&&showFrac&&frac(r.v)?rFrac(frac(r.v)):fmt(r.v);h+='<div class="hl">'+r.html+'</div><div class="hr">'+res+'</div>'});
 h+='<div class="hl cur">'+rList(entry,top())+'</div>';if(err)h+='<div class="herr">'+esc(err)+'</div>';screen.innerHTML=h;screen.scrollTop=screen.scrollHeight}
function flash(k){if(!root)return;const b=root.querySelector('[data-k="'+k+'"]');if(!b)return;b.classList.add('press');setTimeout(()=>b.classList.remove('press'),220)}
async function play(seq,ms=340){if(playing)return;playing=true;second=false;reset();draw();
 for(const k of seq){flash(k);press(k);await new Promise(r=>setTimeout(r,ms))}playing=false;return ans}
function clearAll(){reset();hist=[];second=false;showFrac=false;draw()}
return{mount,press,play,evaluate,fmt,plainE,clearAll,get ans(){return ans},get hist(){return hist},get entry(){return entry},_t:{ins,reset}}})();
/* ======================= floating Book + calculator ======================= */
(function(){
const D=window.EXAM_BOOK;if(!D)return;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const BOOK='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10 4.8 7 4.4 3.5 5v14c3.5-.6 6.500-.2 8.500 1.500 2-1.700 5-2.100 8.500-1.500V5C17 4.400 14 4.800 12 6.500Z"/><path d="M12 6.500V20"/></svg>';
const CALC='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2.500" width="14" height="19" rx="2.500"/><path d="M8.500 6.500h7M8.500 11.500h.01M12 11.500h.01M15.500 11.500h.01M8.500 15h.01M12 15h.01M15.500 15h.01M8.500 18.500h.01M12 18.500h.01M15.500 18.500h.01"/></svg>';
const host=document.createElement('div');
host.innerHTML=`<div id="xTools" role="group" aria-label="Exam tools"><button type="button" id="xBook" aria-expanded="false" aria-controls="xBookPanel" title="Reference book">${BOOK}<span>Book</span></button><button type="button" id="xCalc" aria-expanded="false" aria-controls="calcDock" title="Calculator">${CALC}<span>Calc</span></button></div>
<aside id="xBookPanel" role="dialog" aria-label="Exam reference book" hidden><div class="xb-head"><b id="xbTitle"></b><button type="button" id="xbClose" aria-label="Close reference book">✕</button></div><div class="xb-tabs" id="xbTabs" role="tablist" aria-label="Reference sections"></div><div class="xb-body" id="xbBody" role="tabpanel" tabindex="0"></div></aside>
<aside id="calcDock" hidden aria-label="Practice calculator"><div class="dock-head"><b>Calculator</b><button type="button" id="calcClose" aria-label="Close calculator">✕</button></div><div id="calcMount"></div></aside>`;
while(host.firstChild)document.body.appendChild(host.firstChild);
const curExam=()=>{try{return state.exam}catch(e){return 1}};
const phone=()=>innerWidth<=700;
let tab=null,seen=null,lastAns=null,calcReady=false,bookOpener=null;
document.addEventListener('focusin',e=>{const t=e.target;if(t.matches&&t.matches('input.ans:not(.co)'))lastAns=t});
/* periodic table */
function pos(z){const main=[[1,1,1],[2,1,18]];for(const m of main)if(z===m[0])return[m[1],m[2]];
 if(z<=10)return[2,z<=4?z-2:z+8];if(z<=18)return[3,z<=12?z-10:z];if(z<=36)return[4,z-18];if(z<=54)return[5,z-36];
 if(z<=57)return[6,z-54];if(z<=71)return[9,z-54];if(z<=86)return[6,z-68];if(z<=89)return[7,z-86];if(z<=103)return[10,z-86];return[7,z-100]}
function ptable(mode){const showEN=mode==='en'||D.tileEN;const cells=D.elements.map(([z,s,n,m,en])=>{const[r,c]=pos(z),v=mode==='en'?(en==null?'—':en.toFixed(1)):(m||'—'),label=`${n?n+', ':''}${s}, atomic number ${z}, ${mode==='en'?'electronegativity '+(en==null?'not listed':en.toFixed(1)):'mass '+(m||'not listed')}`;return `<button type="button" class="pt-c${mode==='en'&&en==null?' dim':''}" style="grid-row:${r};grid-column:${c}" data-z="${z}" aria-label="${label}"><small>${z}</small><b>${s}</b><span>${v}</span>${mode!=='en'&&D.tileEN&&en!=null?`<i>${en.toFixed(1)}</i>`:''}</button>`}).join('');
 return `<div class="pt-read" id="ptRead" aria-live="polite">Tap an element to read it larger.</div><div class="pt-wrap" tabindex="0" aria-label="Periodic table. Scroll sideways to see every group."><div class="pt-grid">${cells}</div></div><p class="xb-note">${mode==='en'?'Electronegativity values.':D.tileEN?'Each tile shows atomic number, symbol, average mass, then electronegativity.':'Each tile shows atomic number, symbol, and atomic mass.'} Swipe sideways to see the whole table.</p>`}
function readEl(z){const e=D.elements.find(x=>x[0]===z);if(!e)return;const[,s,n,m,en]=e,show=seen==='en'||D.tileEN;q('#ptRead').innerHTML=`<b>${s}</b>${n?' '+n:''} · Z = ${z}${seen!=='en'?` · ${m?m+' g/mol':'mass not listed'}`:''}${show?` · EN ${en==null?'not listed':en.toFixed(1)}`:''}`;qa('.pt-c.on').forEach(x=>x.classList.remove('on'));const b=q(`.pt-c[data-z="${z}"]`);if(b)b.classList.add('on')}
function drawBook(){const ex=curExam(),ids=D.exams[ex]||D.exams[1];if(!ids.includes(tab))tab=ids[0];seen=tab;q('#xbTitle').textContent=`Exam ${ex} reference`;
 q('#xbTabs').innerHTML=ids.map(i=>`<button type="button" role="tab" data-t="${i}" aria-selected="${i===tab}" class="${i===tab?'on':''}">${D.sections[i].t}</button>`).join('');
 qa('#xbTabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;drawBook();q('#xbBody').scrollTop=0;const x=q(`#xbTabs [data-t="${tab}"]`);x&&x.focus({preventScroll:true})});
 const s=D.sections[tab];q('#xbBody').innerHTML=s.kind==='ptable'?ptable('mass'):s.kind==='en'?ptable('en'):s.html;qa('.pt-c').forEach(b=>b.onclick=()=>readEl(+b.dataset.z))}
function setOpen(btn,on){btn.setAttribute('aria-expanded',on);btn.classList.toggle('on',on)}
function openBook(){if(phone())closeCalc();bookOpener=document.activeElement;drawBook();q('#xBookPanel').hidden=false;document.body.classList.add('book-open');setOpen(q('#xBook'),true);q('#xbClose').focus({preventScroll:true})}
function closeBook(back){q('#xBookPanel').hidden=true;document.body.classList.remove('book-open');setOpen(q('#xBook'),false);if(back)q('#xBook').focus({preventScroll:true})}
function useAns(v){const a=lastAns&&document.contains(lastAns)&&!lastAns.disabled?lastAns:null;if(!a){window.toast&&toast('Tap an answer box first, then press this again');return}a.value=v;a.dispatchEvent(new Event('input',{bubbles:true}));window.toast&&toast('Copied. Round it to the right sig figs');if(phone())closeCalc();a.focus({preventScroll:true});a.scrollIntoView({block:'center',behavior:'smooth'})}
function openCalc(){if(phone())closeBook();if(!calcReady){Calc.mount(q('#calcMount'),useAns);const f=q('#calcDock .tcalc-foot'),u=q('#cUse');u.textContent='Use in answer';q('#calcDock .dock-head b').after(f);calcReady=true}q('#calcDock').hidden=false;document.body.classList.add('calc-open');setOpen(q('#xCalc'),true);if(!phone()){const b=q('#calcDock [data-k="7"]');b&&b.focus({preventScroll:true})}}
function closeCalc(back){q('#calcDock').hidden=true;document.body.classList.remove('calc-open');setOpen(q('#xCalc'),false);if(back===true)q('#xCalc').focus({preventScroll:true})}
/* act on touch-down: with the iPhone keyboard open, the first tap's click can be lost while the page shifts */
const toggleBook=()=>q('#xBookPanel').hidden?openBook():closeBook(),toggleCalc=()=>q('#calcDock').hidden?openCalc():closeCalc();
[['#xBook',toggleBook],['#xCalc',toggleCalc]].forEach(([id,fn])=>{const b=q(id);let touched=0;b.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;e.preventDefault();touched=Date.now();const a=document.activeElement;if(a&&a.matches&&a.matches('input,select'))a.blur();fn()});b.addEventListener('click',()=>{if(Date.now()-touched<900)return;fn()})});
q('#xbClose').onclick=()=>closeBook(true);q('#calcClose').onclick=()=>closeCalc(true);
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!q('#xBookPanel').hidden&&q('#xBookPanel').contains(e.target)){closeBook(true)}});
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.exam-card')&&!q('#xBookPanel').hidden)setTimeout(drawBook,0)});
window.ExamTools={openBook,closeBook,openCalc,closeCalc};
})();

/* ======================= My Retake Plan + Fix My Mistakes ======================= */
(function(){
if(typeof G==='undefined'||typeof recordType!=='function')return;
const el=id=>document.getElementById(id);
const key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parse=s=>{const a=String(s).split('-').map(Number);return new Date(a[0],a[1]-1,a[2])};
const validDay=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!isNaN(parse(s));
const today=()=>key(new Date());
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return key(d)};
const diff=(a,b)=>Math.round((parse(b)-parse(a))/864e5);
const nice=s=>parse(s).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
let P=obj(LS.get('-plan',{})),F=obj(LS.get('-fix',{})),sess=null,quiet=false,banner='';
const save=()=>{LS.set('-plan',P);LS.set('-fix',F)};
const planOf=ex=>{const p=obj(P[ex]);return p.date&&validDay(p.date)?p:null};
const skillName=t=>TYPE_NAMES[t]||prettySkill(String(t).replace('bank:',''));
const bankOf=(ex,t)=>bankPool(ex,'all').filter(b=>'bank:'+b.sk===t);
const usable=(ex,t)=>String(t).startsWith('bank:')?bankOf(ex,t).length>0:!!G[t]&&poolFor(ex).includes(t);
function make(t){const ex=state.exam;let q;if(t.startsWith('bank:')){q=bankToQ(pick(bankOf(ex,t)),ex)}else{q=G[t]();q.sec=secFor(ex,t);const p=EXAMS[ex].pts;if(p&&p[t])q.pts=p[t]}q.type=t;return q}

/* the CHEM 1A and CHEM 3A engines differ slightly, so optional helpers fall back here */
const hintsOf=q=>typeof hintSteps==='function'?hintSteps(q):[q.hint].filter(Boolean);
const preOf=(ex,t)=>typeof prereqFor==='function'?prereqFor(ex,t):null;
const fixRec=t=>{if(typeof recordFix==='function')recordFix(t)};
const track=(q,res)=>{if(typeof trackQ==='function')return trackQ(q,res);try{window.ddTrack&&ddTrack({game:'retakeprep',course:'CHEM 3A',mode:'Plan',topic:EXAMS[state.exam].name+': '+((EXAMS[state.exam].sections.find(x=>x[0]===q.sec)||[])[1]||''),correct:res.earned>=q.pts})}catch(e){}};
function reveal(q){if(typeof revealMC==='function')return revealMC(q);q.allParts.forEach(p=>{if(p.kind!=='mc')return;const e=el(p.id);if(e)e.querySelectorAll('label').forEach((l,i)=>{if(i===p.ans)l.classList.add('good')})})}
function unlock(q){if(typeof unlockQ==='function')return unlockQ(q);const box=el(q.qid);box.classList.remove('ok','part','bad');q.allParts.forEach(p=>{const e=el(p.id);if(!e)return;(e.matches('input,select')?[e]:[...e.querySelectorAll('input,select')]).forEach(i=>{i.disabled=false;i.classList.remove('good','wrong')});if(p.kind==='mc')e.querySelectorAll('label').forEach(l=>{l.classList.remove('good','wrong');if(l.querySelector('input:checked'))l.classList.add('pick')});e.style.outline='';e.querySelectorAll('.obox,.d,.chk-opt').forEach(x=>x.style.pointerEvents='')})}

/* ---------- Fix My Mistakes: a skill clears after a clean answer, then another clean answer on a later day ---------- */
const fixes=ex=>Object.values(obj(F[ex])).filter(x=>x&&x.t&&validDay(x.due)&&usable(ex,x.t));
const dueFixes=ex=>{const d=today();return fixes(ex).filter(x=>x.due<=d)};
function addMiss(ex,t){if(!usable(ex,t))return;const m=F[ex]=obj(F[ex]),d=today(),x=m[t];m[t]={t,stage:0,due:d,at:x&&x.at||d,last:x&&x.last||'',misses:(x&&x.misses||0)+1};LS.set('-fix',F)}
function cleanFix(ex,t){const m=obj(F[ex]),x=m[t];if(!x)return 'none';const d=today(),p=planOf(ex),lastChance=p&&p.date<=d;if((x.stage>=1&&x.last&&x.last<d)||lastChance){delete m[t];LS.set('-fix',F);return 'cleared'}x.stage=1;x.last=d;x.due=addDays(d,1);LS.set('-fix',F);return 'tomorrow'}
function helpedFix(ex,t){const x=obj(F[ex])[t];if(!x)return;const d=today(),p=planOf(ex);x.stage=0;x.due=p&&p.date<=d?d:addDays(d,1);LS.set('-fix',F)}
const rec0=recordType;recordType=function(t,frac,o){rec0(t,frac,o);if(!quiet&&frac<1)addMiss(state.exam,t)};

/* ---------- daily plan ---------- */
function sectionPct(ex,p){const out={};EXAMS[ex].sections.forEach(([s])=>{const ts=poolFor(ex).filter(t=>secFor(ex,t)===s).map(typePct).filter(v=>v!=null);out[s]=ts.length?ts.reduce((a,b)=>a+b,0)/ts.length:(p&&p.diag&&p.diag[s]!=null?p.diag[s]:null)});return out}
function ranked(ex,p,avoid){const sec=sectionPct(ex,p),bp=EXAMS[ex].blueprint,rows=poolFor(ex).map(t=>{const v=typePct(t),n=(REC[t]||{}).n||0,sp=sec[secFor(ex,t)];if(v!=null&&v>=.85&&n>=3)return null;let s=(1-(v==null?.55:v))+(1-(sp==null?.55:sp));if(bp.includes(t))s+=.35;if(avoid&&avoid.has(t))s*=.55;const pre=v!=null&&v<.8?preOf(ex,t):null;return{t:pre||t,s}}).filter(Boolean).sort((a,b)=>b.s-a.s),seen=new Set();return rows.map(r=>r.t).filter(t=>!seen.has(t)&&seen.add(t))}
const hasMock=(p,d)=>{const left=diff(d,p.date),span=diff(p.start||d,p.date);return left===1||(span>=5&&left===Math.ceil(span/2))};
const focusCount=m=>m>=60?3:m>=30?2:1;
function dayRec(ex,p){const d=today();p.days=obj(p.days);if(!p.days[d]){const avoid=new Set(obj(p.days[addDays(d,-1)]).skills||[]),mock=hasMock(p,d),n=mock||p.date<=d?(p.date<=d?1:0):focusCount(p.mins);p.days[d]={skills:ranked(ex,p,avoid).slice(0,n),got:{},tries:{},mock,mocks0:J.mocks||0};Object.keys(p.days).sort().slice(0,-10).forEach(k=>delete p.days[k]);save()}return p.days[d]}
const skillDone=(r,t)=>(r.got[t]||0)>=3||(r.tries[t]||0)>=6;

/* ---------- screens ---------- */
const ICON='<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><rect x="9" y="13" width="46" height="43" rx="9" fill="#fff" stroke="#26324a" stroke-width="4"/><path d="M9 25V22a9 9 0 0 1 9-9h28a9 9 0 0 1 9 9v3Z" fill="#2d8a7d" stroke="#26324a" stroke-width="4"/><path d="M21 8v11M43 8v11" stroke="#26324a" stroke-width="5" stroke-linecap="round"/><path d="m21 41 8 8 15-17" fill="none" stroke="#4b57d1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function setup(ex,p){const min=today(),v=p&&p.date>=min?p.date:'',m=p&&p.mins||30;return `<h2 tabindex="-1" id="planH">My Retake Plan</h2><p class="lead">Tell me when you retake ${EXAMS[ex].name}. A short check finds what to work on, then you get a small plan for each day.</p><div class="pl-form"><label for="plDate">Retake date</label><select id="plDate"><option value="">Choose a day</option>${Array.from({length:36},(_,i)=>addDays(min,i)).map((x,i)=>`<option value="${x}" ${x===v?'selected':''}>${nice(x)}${i===0?' (today)':i===1?' (tomorrow)':''}</option>`).join('')}</select><label for="plMins">Study time each day</label><select id="plMins">${[20,30,45,60].map(x=>`<option value="${x}" ${x===m?'selected':''}>${x} minutes</option>`).join('')}</select></div><div class="pl-msg" id="plMsg" role="alert"></div><div class="row"><button class="btn primary" data-a="save">${p&&p.diag?'Save changes':'Next: quick check'}</button>${p?'<button class="btn" data-a="home">Cancel</button>':''}</div>`}
function dash(ex,p){const d=today(),left=diff(d,p.date);if(left<0)return `<h2 tabindex="-1" id="planH">My Retake Plan</h2><p class="lead">Your ${EXAMS[ex].name} retake date (${nice(p.date)}) has passed. If you have a new date, update it here.</p><div class="row"><button class="btn primary" data-a="edit">Set a new date</button></div>`;
 const r=dayRec(ex,p),due=dueFixes(ex),all=fixes(ex),later=all.length-due.length,mockDone=(J.mocks||0)>r.mocks0;let rows=[];
 rows.push(`<li class="pl-task ${due.length?'':'ok'}"><span class="pl-tick" aria-hidden="true">${due.length?'':'✓'}</span><span><b>Fix My Mistakes</b><small>${due.length?plural(due.length,'skill')+' ready now':all.length?'Nothing due today. '+plural(later,'skill')+' come back on a later day':'No missed skills right now'}</small></span>${due.length?'<button class="btn primary" data-a="fix">Start</button>':''}</li>`);
 r.skills.forEach(t=>{const ok=skillDone(r,t);rows.push(`<li class="pl-task ${ok?'ok':''}"><span class="pl-tick" aria-hidden="true">${ok?'✓':''}</span><span><b>${skillName(t)}</b><small>${ok?'Done for today':`Get 3 right (${r.got[t]||0} so far)`}</small></span>${ok?'':`<button class="btn soft" data-a="skill" data-t="${t}">Practice</button>`}</li>`)});
 if(r.mock)rows.push(`<li class="pl-task ${mockDone?'ok':''}"><span class="pl-tick" aria-hidden="true">${mockDone?'✓':''}</span><span><b>Full Mock Exam</b><small>${mockDone?'Finished today':'Set aside time and work it on paper'}</small></span>${mockDone?'':'<button class="btn soft" data-a="mock">Start</button>'}</li>`);
 const undone=rows.filter(x=>!x.includes('pl-task ok')).length,sec=sectionPct(ex,p),next=[];for(let i=1;i<=Math.min(left-1,4);i++){const x=addDays(d,i);next.push(`<li><b>${nice(x)}</b> ${hasMock(p,x)?'Mock exam + fixes':'Fixes + '+plural(focusCount(p.mins),'skill')}</li>`)}if(left>=1)next.push(`<li><b>${nice(p.date)}</b> Retake day</li>`);
 return `<div class="pl-head"><div><h2 tabindex="-1" id="planH">My Retake Plan</h2><p>${EXAMS[ex].name} · ${nice(p.date)} · <b>${left===0?'Today':left===1?'1 day left':left+' days left'}</b></p></div></div>${banner?`<div class="fb ok">${banner}</div>`:''}<h3>${left===0?'Warm up for today':'Today'}</h3><ul class="pl-list">${rows.join('')}</ul>${undone?'':'<div class="fb ok"><b>You finished today’s plan.</b> Rest counts too. Your next set is ready tomorrow.</div>'}
 <details class="ref pl-more"><summary>How ready am I?</summary><div class="body">${EXAMS[ex].sections.map(([s,n])=>{const v=sec[s];return `<div class="pl-bar"><span>${SHORT[s]||n}</span><div class="bar" role="img" aria-label="${v==null?'No data yet':Math.round(v*100)+' percent'}"><i style="width:${v==null?0:Math.round(v*100)}%;background:${v>=.8?'#5fae78':v>=.6?'#f2c35b':'#e0675a'}"></i></div><b>${v==null?'—':Math.round(v*100)+'%'}</b></div>`}).join('')}<p class="pl-note">This is a practice estimate. It does not predict your grade.</p></div></details>${next.length?`<details class="ref pl-more"><summary>What’s coming up</summary><div class="body"><ul class="pl-next">${next.join('')}</ul></div></details>`:''}
 <div class="row"><button class="btn" data-a="edit">Change date or time</button><button class="btn" data-a="recheck">Retake quick check</button></div>`}
function intro(ex,p){const g=obj(p.prog),n=(g.types||diagTypes(ex)).length,i=g.i||0;return `<h2 tabindex="-1" id="planH">Quick check</h2><p class="lead">${plural(n,'question')} from across ${EXAMS[ex].name}. Use the Book and calculator, but no hints. If you have not learned something yet, tap <b>Not sure yet</b>. That helps your plan more than guessing.</p><div class="row"><button class="btn primary" data-a="diag">${i?`Continue (question ${i+1})`:'Start quick check'}</button><button class="btn" data-a="edit">Change date</button></div>`}
function render(){const ex=state.exam,b=el('planBody');if(sess&&sess.ex!==ex)sess=null;if(sess){if(!sess.q||!el(sess.q.qid))loadQ();return}const p=planOf(ex);b.innerHTML=!p||render.edit?setup(ex,p):!p.diag?intro(ex,p):dash(ex,p);banner=''}
function top(){const a=el('plan');if(!a)return;const y=a.getBoundingClientRect().top+scrollY-8;try{scrollTo({top:Math.max(0,y),behavior:'auto'})}catch(e){scrollTo(0,y)}}
function diagTypes(ex){const X=EXAMS[ex],out=[],left=[];X.sections.forEach(([s])=>{const ts=shuf(X.blueprint.filter(t=>secFor(ex,t)===s));out.push(...ts.slice(0,2));left.push(...ts.slice(2))});shuf(left).slice(0,Math.max(0,10-out.length)).forEach(t=>out.push(t));const order=X.blueprint;return out.sort((a,c)=>order.indexOf(a)-order.indexOf(c))}

/* ---------- one-question-at-a-time runner ---------- */
function title(s){if(s.kind==='diag')return `Quick check · ${s.i+1} of ${s.types.length}`;if(s.kind==='fix')return `Fix My Mistakes · ${s.seen.size} of ${s.total}`;return `${skillName(s.t)} · ${s.day.got[s.t]||0} of 3 right`}
function nextType(s){if(s.kind==='diag')return s.types[s.i];if(s.kind==='skill')return s.t;const x=dueFixes(s.ex).find(v=>!s.seen.has(v.t));return x&&x.t}
function loadQ(){const s=sess,t=nextType(s);if(!t)return finish();if(s.kind==='fix')s.seen.add(t);const q=make(t);Object.assign(s,{q,att:1,help:false,hint:0,st:'ask',recorded:false});el('planBody').innerHTML=`<div class="pl-run"><b tabindex="-1" id="planH">${title(s)}</b><button class="btn" data-a="back">My plan</button></div>${s.kind==='fix'?'<p class="pl-note">Try this one on your own first. Hints open after your first try.</p>':''}<div id="pQ">${renderQ(q,'',`pq${++uid}`)}</div><div class="row" id="pBtns"></div>`;wireInteractive(q);buttons();top()}
function buttons(){const s=sess,B=[];const b=(a,t,c='')=>B.push(`<button class="btn ${c}" data-a="${a}">${t}</button>`),hintsOK=s.kind==='skill'||(s.kind==='fix'&&s.att>1),more=hintsOf(s.q).length>s.hint;
 if(s.st==='ask'){if(hintsOK&&more)b('hint',s.hint?'Next hint':'Hint','warm');b('check','Check answer','primary');if(s.kind==='diag')b('unsure','Not sure yet');else if(hintsOK)b('sol','Show solution','soft')}
 else if(s.st==='wrong'){b('retry','Try again','primary');if(more)b('hint',s.hint?'Next hint':'Hint','warm');b('sol','Show solution','soft')}
 else b('next','Next','good');el('pBtns').innerHTML=B.join('')}
function box(cls,html){const w=el(sess.q.qid).querySelector('.fbwrap');w.querySelectorAll('.pl-fb').forEach(x=>x.remove());w.insertAdjacentHTML('beforeend',`<div class="fb ${cls} pl-fb">${html}</div>`)}
const msgList=m=>m.length?'<ul style="margin:6px 0 0;padding-left:20px">'+m.map(x=>`<li>${x}</li>`).join('')+'</ul>':'';
const solBox=q=>`<details class="ref" style="margin-top:8px" open><summary>Step-by-step solution</summary><div class="body sol" style="border:0;color:var(--ink)">${q.sol}</div></details>`;
function lock(q){el(q.qid).querySelectorAll('input,select').forEach(i=>i.disabled=true);el(q.qid).querySelectorAll('.obox,.d,.chk-opt').forEach(x=>x.style.pointerEvents='none')}
function count(s,frac){if(s.recorded)return;s.recorded=true;quiet=s.kind==='fix';recordType(s.q.type,frac,{help:s.help});quiet=false}
function check(){const s=sess,q=s.q;if(!q.allParts.some(answered)){toast('Type or choose an answer first');return}const first=s.att===1,res=gradeQ(q,{reveal:false}),full=res.earned>=q.pts,frac=res.earned/q.pts;if(first){count(s,frac);track(q,res)}
 if(s.kind==='diag'){s.scores[q.type]=frac;saveProg(s);s.st='done';box(full?'ok':res.earned?'part':'bad',`<b>${full?'✓ Correct':res.earned?`Partial credit: ${res.earned} / ${q.pts}`:'Not this time'}</b>${msgList(res.msgs)}${full?'':solBox(q)}`);setMood(full?'correct':'thinking',1800)}
 else if(s.kind==='fix'){if(full&&first){const r=cleanFix(s.ex,q.type);if(r==='cleared')s.cleared++;addXP(r==='cleared'?20:8);s.st='done';box('ok',`<b>${r==='cleared'?'✓ Skill cleared!':'✓ Correct on your own.'}</b> ${r==='cleared'?'You got it right again on a later day.':'It comes back tomorrow to make sure it sticks.'}${q.why?`<div style="margin-top:4px">${q.why}</div>`:''}`);setMood('correct',1800)}else if(full){helpedFix(s.ex,q.type);fixRec(q.type);J.fixes=(J.fixes||0)+1;addXP(4);s.st='done';box('ok','<b>✓ You fixed it.</b> It comes back tomorrow so you can get it on the first try.');setMood('correct',1800)}else{s.st='wrong';box(res.earned?'part':'bad',`<b>${res.earned?`Partial credit: ${res.earned} / ${q.pts}`:'Not yet'}</b>${msgList(res.msgs)}<div style="margin-top:6px">Find the slip and try again, or open a hint.</div>`);setMood('thinking',1800)}}
 else{s.day.tries[q.type]=(s.day.tries[q.type]||0)+(first?1:0);if(full&&first&&!s.help)s.day.got[q.type]=(s.day.got[q.type]||0)+1;save();if(full){s.st='done';box('ok',`<b>✓ Correct${first?'':' on another try'}.</b>${s.help&&first?' A hint helped, so try the next one without it.':''}${q.why?`<div style="margin-top:4px">${q.why}</div>`:''}`);if(first&&!s.help)addXP(6);setMood('correct',1800)}else{s.st='wrong';box(res.earned?'part':'bad',`<b>${res.earned?`Partial credit: ${res.earned} / ${q.pts}`:'Not yet'}</b>${msgList(res.msgs)}`);setMood('thinking',1800)}}
 checkBadges();buttons()}
function saveProg(s){const p=planOf(s.ex);p.prog={types:s.types,i:s.i+(s.st==='x'?1:0),scores:s.scores};save()}
function finish(){const s=sess,ex=s.ex,p=planOf(ex);sess=null;if(s.kind==='diag'){const d={};EXAMS[ex].sections.forEach(([x])=>{const ts=s.types.filter(t=>secFor(ex,t)===x);d[x]=ts.length?ts.reduce((a,t)=>a+(s.scores[t]||0),0)/ts.length:null});p.diag=d;p.start=p.start||today();delete p.prog;if(p.days)delete p.days[today()];save();banner='<b>Your plan is ready.</b> Start with the first item below.';setMood('victory',2200)}else if(s.kind==='fix'){banner=s.cleared?`<b>${plural(s.cleared,'skill')} cleared.</b> Nice work.`:'<b>Fix list done for now.</b>'}else if(skillDone(s.day,s.t))banner=`<b>${skillName(s.t)} is done for today.</b>`;render();top()}
function start(kind,t){const ex=state.exam,p=planOf(ex);if(kind==='diag'){const g=obj(p.prog);sess={kind,ex,types:g.types&&g.types.every(x=>usable(ex,x))?g.types:diagTypes(ex),i:g.i||0,scores:obj(g.scores)};if(sess.i>=sess.types.length)sess.i=0}else if(kind==='fix')sess={kind,ex,seen:new Set(),total:dueFixes(ex).length,cleared:0};else sess={kind,ex,t,day:dayRec(ex,p)};loadQ()}
function act(a,btn){const s=sess,ex=state.exam;
 if(a==='save'){const v=el('plDate').value,m=+el('plMins').value;if(!validDay(v)||v<today()){el('plMsg').textContent='Choose a retake date of today or later.';el('plDate').focus();return}const o=planOf(ex)||{};P[ex]=Object.assign(o,{date:v,mins:m});if(!o.start||o.date<o.start)P[ex].start=today();if(P[ex].days)delete P[ex].days[today()];save();render.edit=false;render();top()}
 else if(a==='edit'){render.edit=true;render();top()}else if(a==='home'){render.edit=false;render();top()}
 else if(a==='diag')start('diag');else if(a==='fix')start('fix');else if(a==='skill')start('skill',btn.dataset.t);
 else if(a==='recheck'){const p=planOf(ex);delete p.diag;delete p.prog;if(p.days)delete p.days[today()];save();render();top()}
 else if(a==='mock'){state.mode='mock';saveUI();buildModes();show();window.scrollTo({top:el('mock').getBoundingClientRect().top+scrollY-8})}
 else if(a==='back'){if(s&&s.kind==='diag'){if(s.st==='done')s.i++;saveProg(s)}sess=null;render();top()}
 else if(!s)return;
 else if(a==='check')check();
 else if(a==='hint'){const h=hintsOf(s.q),k=s.hint;if(k>=h.length)return;s.help=true;s.hint=k+1;el(s.q.qid).querySelector('.fbwrap').insertAdjacentHTML('afterbegin','');const w=el(s.q.qid).querySelector('.fbwrap'),old=w.querySelectorAll('.fb.hint');const html=`<div class="fb hint">💡 <b>Hint ${k+1} of ${h.length}:</b> ${h[k]}</div>`;if(old.length)old[old.length-1].insertAdjacentHTML('afterend',html);else w.insertAdjacentHTML('afterbegin',html);setMood('thinking');buttons()}
 else if(a==='retry'){unlock(s.q);s.att++;s.st='ask';buttons();const f=el(s.q.qid).querySelector('input:not([type=radio]):not([type=checkbox]),select');if(f&&!matchMedia('(pointer: coarse)').matches)f.focus({preventScroll:true})}
 else if(a==='sol'){s.help=true;if(s.kind==='skill'){if(!s.recorded){count(s,0);track(s.q,{earned:0});s.day.tries[s.q.type]=(s.day.tries[s.q.type]||0)+1;save()}}else if(s.kind==='fix')helpedFix(s.ex,s.q.type);lock(s.q);reveal(s.q);s.st='done';box('part',`<b>Solution shown.</b>${s.kind==='fix'?' This skill comes back tomorrow.':''}${solBox(s.q)}`);buttons()}
 else if(a==='unsure'){count(s,0);s.q.allParts.forEach(p=>p.result={score:0});s.scores[s.q.type]=0;saveProg(s);lock(s.q);reveal(s.q);s.st='done';box('part',`<b>That’s useful to know.</b> It’s now on your fix list.${solBox(s.q)}`);buttons()}
 else if(a==='next'){if(s.kind==='diag'){s.i++;saveProg(s);if(s.i>=s.types.length)return finish();loadQ()}else if(s.kind==='skill'&&skillDone(s.day,s.t))finish();else loadQ()}}

/* ---------- connect to the game ---------- */
const sec=document.createElement('section');sec.className='card hidden';sec.id='plan';sec.innerHTML='<div id="planBody"></div>';el('train').before(sec);
sec.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button[data-a]');if(b&&sec.contains(b))act(b.dataset.a,b)});
MODES.unshift({id:'plan',ic:ICON,t:'My Retake Plan',d:'A daily plan plus your fix-it list'});MODE_ART.plan='mode-train';
const build0=buildModes;buildModes=function(){build0();const c=document.querySelector('.mode[data-m="plan"] .ic');if(c)c.innerHTML=`<span class="pl-ic">${ICON}</span>`};
const show0=show;show=function(){const on=state.mode==='plan';sec.classList.toggle('hidden',!on);if(on){['train','mock','weak'].forEach(id=>el(id).classList.add('hidden'));render.edit=false;render()}else show0()};
const grade0=el('bGrade').onclick;el('bGrade').onclick=function(){grade0.call(this);const M=state.mock;if(!M||!M.graded||M.fixBtn)return;M.fixBtn=true;const n=dueFixes(state.exam).length,c=el('result').querySelector('.card');if(!n||!c)return;c.insertAdjacentHTML('afterbegin',`<div class="fb hint" style="margin:0 0 12px"><b>${plural(n,'skill')} on your fix list.</b> Rework them with new numbers while this exam is fresh.<div class="row" style="margin-top:8px"><button class="btn primary" id="plFixGo">Fix My Mistakes</button></div></div>`);el('plFixGo').onclick=()=>{state.mode='plan';saveUI();buildModes();show();if(planOf(state.exam)&&obj(planOf(state.exam)).diag)start('fix');else{P[state.exam]=P[state.exam]||{};sess=null;startFixNoPlan()}}};
function startFixNoPlan(){sess={kind:'fix',ex:state.exam,seen:new Set(),total:dueFixes(state.exam).length,cleared:0};loadQ()}
const reset0=el('bReset').onclick;el('bReset').onclick=function(){const before=J;reset0.call(this);if(J!==before){P={};F={};sess=null;save();show()}};
if(ui.mode==='plan')state.mode='plan';buildModes();show();
window.RetakePlan={render,dueFixes,fixes,planOf,cleanFix,get session(){return sess}};
})();

/* ======================= Exam Day, printable mocks, video help, Lewis drawing ======================= */
(function(){
if(typeof G==='undefined'||typeof EXAMS==='undefined'||!window.EXAM_BOOK)return;
const el=id=>document.getElementById(id),course=EXAM_BOOK.course,is1A=course==='CHEM 1A',lewisExam=is1A?3:2;

/* ---------- Lewis drawing ---------- */
const VE={H:1,B:3,C:4,N:5,O:6,F:7,P:5,S:6,Cl:7,Br:7,I:7,Xe:8};
const LW=[['NH₃','N','H H H',0,[[1,1,1]]],['H₂O','O','H H',0,[[1,1]]],['CCl₄','C','Cl Cl Cl Cl',0,[[1,1,1,1]]],['PCl₃','P','Cl Cl Cl',0,[[1,1,1]]],['NF₃','N','F F F',0,[[1,1,1]]],['H₂S','S','H H',0,[[1,1]]],['CO₂','C','O O',0,[[2,2]]],['HCN','C','H N',0,[[1,3]]],['CH₂O','C','O H H',0,[[2,1,1]]],['BF₃','B','F F F',0,[[1,1,1]]],['H₃O⁺','O','H H H',1,[[1,1,1]]],['NO₃⁻','N','O O O',-1,[[2,1,1]]],['CO₃²⁻','C','O O O',-2,[[2,1,1]]],['NO₂⁻','N','O O',-1,[[2,1]]],['O₃','O','O O',0,[[2,1]]],['SO₂','S','O O',0,[[2,1],[2,2]]]];
const LX=[['PF₅','P','F F F F F',0,[[1,1,1,1,1]]],['SF₄','S','F F F F',0,[[1,1,1,1]]],['ClF₃','Cl','F F F',0,[[1,1,1]]],['XeF₂','Xe','F F',0,[[1,1]]],['XeF₄','Xe','F F F F',0,[[1,1,1,1]]],['SF₆','S','F F F F F F',0,[[1,1,1,1,1,1]]],['BrF₅','Br','F F F F F',0,[[1,1,1,1,1]]],['ICl₂⁻','I','Cl Cl',-1,[[1,1]]]];
const LWPOOL=is1A?LW.concat(LX):LW;
function lewisData(r){const [f,c,o,q,orders]=r,O=o.split(' '),T=VE[c]+O.reduce((a,x)=>a+VE[x],0)-q,acc=orders.map(b=>{const l=b.map((n,i)=>O[i]==='H'?0:4-n),cl=(T-2*b.reduce((x,y)=>x+y,0)-2*l.reduce((x,y)=>x+y,0))/2;return{b,l,c:cl}});return{f,c,O,q,T,acc}}
const sig=(O,b,l,c)=>c+'|'+O.map((x,i)=>x+':'+b[i]+':'+l[i]).sort().join(',');
function lewisSVG(d,b,l,c,live){const n=d.O.length,cx=160,cy=150,R=108,P=d.O.map((_,i)=>{const a=(-90+i*360/n)*Math.PI/180;return[cx+R*Math.cos(a),cy+R*Math.sin(a),a]});
 const dots=(x,y,angles)=>angles.map(t=>{const dx=Math.cos(t),dy=Math.sin(t),px=-dy*5,py=dx*5,rr=25;return `<circle cx="${x+dx*rr+px}" cy="${y+dy*rr+py}" r="3" fill="#26324a"/><circle cx="${x+dx*rr-px}" cy="${y+dy*rr-py}" r="3" fill="#26324a"/>`}).join('');
 let s='';P.forEach(([x,y,a],i)=>{const ox=-Math.sin(a),oy=Math.cos(a),x1=cx+Math.cos(a)*22,y1=cy+Math.sin(a)*22,x2=x-Math.cos(a)*22,y2=y-Math.sin(a)*22,k=b[i]===1?[0]:b[i]===2?[-4,4]:[-7,0,7];s+=`<g ${live?`class="lw-b" data-b="${i}" role="button" tabindex="0" aria-label="Bond ${i+1}, center to ${d.O[i]}: ${['single','double','triple'][b[i]-1]}. Tap to change."`:''}>${live?`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="36"/>`:''}${k.map(v=>`<line x1="${x1+ox*v}" y1="${y1+oy*v}" x2="${x2+ox*v}" y2="${y2+oy*v}" stroke="#26324a" stroke-width="3"/>`).join('')}</g>`});
 P.forEach(([x,y,a],i)=>{const back=a+Math.PI,slots=[back+Math.PI/2,back+Math.PI,back-Math.PI/2,back+Math.PI/4].slice(0,l[i]);s+=`<g ${live?`class="lw-a" data-a="${i}" role="button" tabindex="0" aria-label="${d.O[i]}, ${l[i]} lone pairs. Tap to add a pair."`:''}><circle cx="${x}" cy="${y}" r="24" fill="${live?'#f3f6fd':'#fff'}" stroke="${live?'#b9c1da':'none'}"/><text x="${x}" y="${y+7}" text-anchor="middle" font-size="21" font-weight="800" fill="#26324a">${d.O[i]}</text>${dots(x,y,slots)}</g>`});
 const sorted=P.map(p=>p[2]).sort((u,v)=>u-v),gaps=sorted.map((t,i)=>({a:t,w:(i===n-1?sorted[0]+2*Math.PI:sorted[i+1])-t,k:0}));for(let i=0;i<c;i++){gaps.reduce((b,g)=>g.w/(g.k+1)>b.w/(b.k+1)?g:b).k++}const cs=[];gaps.forEach(g=>{for(let j=1;j<=g.k;j++)cs.push(g.a+g.w*j/(g.k+1))});
 s+=`<g ${live?'class="lw-a" data-a="c" role="button" tabindex="0" aria-label="Center '+d.c+', '+c+' lone pairs. Tap to add a pair."':''}><circle cx="${cx}" cy="${cy}" r="24" fill="${live?'#fff6dd':'#fff'}" stroke="${live?'#e3c56f':'none'}"/><text x="${cx}" y="${cy+7}" text-anchor="middle" font-size="21" font-weight="800" fill="#26324a">${d.c}</text>${dots(cx,cy,cs)}</g>`;
 return `<svg viewBox="0 0 320 300" role="img" aria-label="Lewis structure of ${d.f}" style="width:100%;max-width:340px;display:block;margin:0 auto">${s}</svg>`}
G.lewisDraw=()=>{const d=lewisData(pick(LWPOOL)),a=d.acc[0];const res=d.acc.length>1||new Set(a.b).size>1&&d.O.every(x=>x===d.O[0]);const q={sec:'lewis',pts:6,prompt:`Draw the Lewis structure of <b>${d.f}</b>. Tap a <b>bond</b> to switch single, double, or triple. Tap an <b>atom</b> to add a lone pair.`,parts:[{kind:'lewis',label:'',d,st:{b:d.O.map(()=>1),l:d.O.map(()=>0),c:0}}],hint:'Count total valence electrons first. Add one for each negative charge, and subtract one for each positive charge. Give outer atoms their octets, then use multiple bonds if the center is short.',sol:`<ol><li>Total valence electrons = ${`<span class="ans">${d.T}</span>`}</li><li>Center atom: ${d.c}, with ${a.c} lone pair${a.c===1?'':'s'}</li><li>${res?'Any equivalent atom can hold the multiple bond, so this is one valid resonance structure.':'Check that every atom follows its usual electron count.'}${lewisSVG(d,a.b,a.l,a.c,false)}</li></ol>`,why:`The structure uses all ${d.T} valence electrons and gives each atom a sensible electron count.`};return q};
EXAMS[lewisExam].extras.push('lewisDraw');(EXAMS[lewisExam].secMap=EXAMS[lewisExam].secMap||{}).lewisDraw='lewis';TYPE_NAMES.lewisDraw='Drawing Lewis structures';
function drawLw(p){const box=document.getElementById(p.id);if(!box)return;box.querySelector('.lw-draw').innerHTML=lewisSVG(p.d,p.st.b,p.st.l,p.st.c,true);const used=2*p.st.b.reduce((a,b)=>a+b,0)+2*p.st.l.reduce((a,b)=>a+b,0)+2*p.st.c;const u=box.querySelector('.lw-count');u.textContent=`Electrons used: ${used} of ${p.d.T}`;u.classList.toggle('over',used>p.d.T)}
const rp=renderPart,rd=readPart,gp=gradePart,an=answered,wi=wireInteractive;
renderPart=function(p,qid,idx){if(p.kind==='lewis'){const id=`${qid}-${idx}`;p.id=id;_partById[id]=p;return `<div class="part lw" id="${id}" style="display:block"><div class="lw-draw"></div><div class="lw-count" aria-live="polite"></div></div>`}return rp(p,qid,idx)};
readPart=p=>p.kind==='lewis'?p.st:rd(p);
answered=p=>p.kind==='lewis'?p.st.b.some(x=>x>1)||p.st.l.some(Boolean)||p.st.c>0:an(p);
gradePart=function(p){if(p.kind!=='lewis')return gp(p);if(!answered(p))return{score:0,slip:'blank'};const {b,l,c}=p.st,d=p.d,used=2*b.reduce((x,y)=>x+y,0)+2*l.reduce((x,y)=>x+y,0)+2*c,me=sig(d.O,b,l,c);if(d.acc.some(a=>sig(d.O,a.b,a.l,a.c)===me))return{score:1};if(used!==d.T)return{score:0,slip:'wrong',msg:`You used ${used} electrons, but ${d.f} has ${d.T} valence electrons.`};const bad=d.O.map((x,i)=>x!=='H'&&2*b[i]+2*l[i]!==8?x:null).filter(Boolean);return{score:.5,slip:'wrong',msg:bad.length?`Right electron total, but check the octet on ${[...new Set(bad)].join(', ')}.`:`Right electron total. Check the bonds and lone pairs on the center, ${d.c}.`}};
wireInteractive=function(q){wi(q);q.allParts.filter(p=>p.kind==='lewis').forEach(p=>{const box=document.getElementById(p.id);drawLw(p);const act=t=>{if(box.closest('.q.ok,.q.part,.q.bad'))return;const g=t.closest&&t.closest('[data-a],[data-b]');if(!g)return;if(g.dataset.b!=null){const i=+g.dataset.b;p.st.b[i]=p.st.b[i]%3+1}else if(g.dataset.a==='c')p.st.c=(p.st.c+1)%5;else{const i=+g.dataset.a;p.st.l[i]=(p.st.l[i]+1)%4}const k=g.dataset.b!=null?`[data-b="${g.dataset.b}"]`:`[data-a="${g.dataset.a}"]`;drawLw(p);const f=box.querySelector(k);if(f&&document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.lw'))f.focus({preventScroll:true});updateStatus()};let down=null;const keyOf=t=>{const g=t.closest&&t.closest('[data-a],[data-b]');return g?(g.dataset.b!=null?'b'+g.dataset.b:'a'+g.dataset.a):null};box.addEventListener('pointerdown',e=>{down={k:keyOf(e.target),x:e.clientX,y:e.clientY,t:e.target}});box.addEventListener('pointerup',e=>{if(!down)return;const d=down;down=null;if(d.k&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<12){const hit=document.elementFromPoint(e.clientX,e.clientY);if(hit&&keyOf(hit)===d.k){e.preventDefault();act(hit)}}});box.addEventListener('pointercancel',()=>down=null);box.addEventListener('click',e=>{if(e.detail===0)act(e.target)});box.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act(e.target)}})})};

/* ---------- targeted video help ---------- */
const V={};const add=(id,title,keys)=>keys.split(' ').forEach(k=>V[k]=[id,title]);
add('YFd6XTQpI08','Understanding the States of Matter','x1change x1matter physChem particles statesMatter phaseNames');add('b__bU7D6YIM','The 7 Diatomic Elements','x1diatomic diatomic');add('JmyWmu3RA6Q','How to Use the Periodic Table','x1elements x1nuclear whichElement nuclearTable');add('CTvvJRGMdxY','How to Name Ionic Compounds','x1name nameCmpd nameMixed');add('A1-PS3fGOw8','Ionic Formulas with Polyatomic Ions','x1formula');add('2ZT9T8M2CWM','Writing Ionic Formulas: Swap-Drop','x1ionic writeFormula formulaMixed');add('c3m2L5Ni3wk','Significant Figures','x1sigfig measure sfCount exactSF addSF');add('SsLd_YRnLtw','Rounding Significant Figures','roundSF roundDP');add('UCQq22qA-vo','Scientific Notation','sciNot');add('gVI0NWuv9VU','Dimensional Analysis Word Problems','x1dose healthTablets healthDose');add('ilqm5Quaggc','Multi-Step Unit Conversions','x1distance');add('s7Dr7FSQ4R8','How to Convert Units','prefixes metricL metricG');add('W1fKRtt0CZc','Temperature Conversions','tempConvert');add('USaNyE1y6gE','What is Density?','densityFactor');add('p1vMT2wxsBc','Density by Displacement','densityLab');add('oy7dm7qZiXY','Law of Conservation of Mass','x1conserve massConserve');add('ZtWHJci1vgc','Percent Composition by Mass','x1percent pctComp');add('wB01PrQBxVw','What is a Mole?','x1atomsmass gToMol molToParticles');add('7fWGLGY_6Wo','How to Read Chemical Formulas','x1structure');add('mvdjSfWFdaU','Molar Mass, Including Hydrates','x1hydrate molarMass');add('Ia26SFitnIE','Isotopes: Percent Abundance','x1isotope x1spike avgMass');add('r5ciwMWV8Ns','Empirical and Molecular Formulas','x1combustion empirical molecular');add('jNh0S62GrHg','Cations, Anions and Predictable Charges','ionConcept ionCharge');add('Gl6OxNmAc7M','The Anatomy of the Atom','atomChart');add('sCmUQWVB90Q','How the Scientific Method Works','sciTerms');
add('YqZjFTpnHjc','Predicting and Balancing Reactions','x2predict wordEquation');add('t65x7RaFeFY','How to Balance Chemical Reactions','balance');add('2MsgPQYwsjA','Types of Chemical Reactions','rxnType rxnType2');add('7FP2lehyuRU','Introduction to Limiting Reactants','x2limiting');add('EcT5aqQzaYA','Theoretical and Percent Yield','x2yield');add('RsPUbM1DivA','How to Write Net Ionic Equations','x2netionic predictPpt netIonic');add('-PeAGG6s6nY','How to Read a Solubility Table','solubility');add('oLCLggs3Zmw','What is Molarity?','x2ionM x2mixions');add('auELinUz1R4','Solution Stoichiometry','x2prep');add('Ca7o0AjwhcY','Acid-Base Titration Stoichiometry','x2titrate');add('qwkB_gLdg6s','Solution Dilutions','x2dilute');add('IsypcIC7XqA','Introduction to Oxidation and Reduction','x2oxstate x2activity oxStates redoxIdentify');add('zr0Y2hF_aOE','Balancing Redox in Basic Solution','x2redox');add('uexlvfNkuhs',"Boyle's, Charles's and Gay-Lussac's Laws",'x2charles');add('qcuMu3m77Yw','Gases and Kinetic Molecular Theory','x2speed x2kmt');add('T0fOuTmNY6g','Introduction to the Ideal Gas Law','x2idgas');add('efgNeWjlsGY','Tips and Tricks for Gas Laws','x2graham x2gasdensity');add('gpjC3C_zkoE',"Dalton's Law of Partial Pressure",'x2overwater x2partial');add('r7isVoOlWyU','Specific Heat Capacity','x2heat qmcdt');add('1xjSCl5hsug','Introduction to Calorimetry','x2calor x2bomb');add('qPM-C3V0l80','Introduction to Heat and Energy','x2food');add('KqKvWr6Y2zs','Intro to Thermochemistry','x2endo endoExo');add('udPzY15vH1w','Heat of Fusion and Vaporization','phaseHeat');add('-fyDACk_Zx0','Heating and Cooling Curves','heatCurve heatMulti');
add('a73T36_j0Xg','Writing Electron Configurations','x3tmion x3ioncfg x3anomalous fullCfg nobleCfg shellCount');add('AgKAXoYLRBA','Electromagnetic Radiation, Part 1','x3photon emSpectrum');add('2QWO4oGxvfA','Electromagnetic Radiation, Part 2','x3rydberg x3photoel x3debroglie');add('84sL9kEAVmQ','Orbital Diagrams and Filling Rules','x3shape x3quantum x3filling orbital');add('-WH0D2cWcJc','Formal Charge and Resonance','x3resonance resonance');add('Wz23sE4KUBE','Electronegativity and Polar Bonds','x3polarbond x3deltaEN enTrend');add('0fzuzHnkPAc','Polar Molecules','polarity');add('u_Y1sC58C7M','Introduction to Chemical Bonding','bondType');add('T6j9Gw1EyPU','Periodic Table Trends','x3isoelec x3ie x3radius periodicTrend');add('wD3b-7J0Xy0','Introduction to VSEPR Theory','x3fictional x3vseprtable electronGroups vsepr');add('Nb4z-SSwmb4','A Lecture on Hybridization','x3hybrid x3vbtable');add('r3IGajq0hD8','Drawing MO Diagrams','x3mo');add('oxbd7aS8ROg','Valence Electrons and Lewis Dot Symbols','valenceCore valenceCount lewisDot');add('CGmbd2YwflY','How to Draw Lewis Structures','lonePairs lewisDraw');add('RNQKJ1hnHes','Basic Concepts of Intermolecular Forces','imfType');add('CdA3Ov94lw0','Dipole, Hydrogen Bonding and Ion-Dipole','imfBetween');add('lAcgVwEmjM8','IMFs and Boiling Point','bpRank solidType propRank');
V.x1definite=['Gl6OxNmAc7M','The Anatomy of the Atom (constant composition)',172];V.x1intensive=['USaNyE1y6gE','What is Density? (intensive properties)',193];
window.RETAKE_VIDEOS=V;
const QT={},rq=renderQ;renderQ=function(q,n,qid){QT[qid]=q.type;return rq(q,n,qid)};
function addVideos(){document.querySelectorAll('.q').forEach(b=>{const w=b.querySelector('.fbwrap');if(!w||w.querySelector('.vh'))return;if(!w.querySelector('.fb.bad,.fb.part'))return;const v=V[QT[b.id]];if(!v)return;w.insertAdjacentHTML('beforeend',`<a class="vh" href="https://youtu.be/${v[0]}${v[2]?'?t='+v[2]:''}" target="_blank" rel="noopener">▶ Watch Dr. Dan: ${v[1]}</a>`)})}
new MutationObserver(addVideos).observe(el('train').parentNode,{childList:true,subtree:true});

/* ---------- Exam Day ---------- */
const minsOf=e=>EXAMS[e].mins||(is1A?90:{1:60,2:90}[e]);
let day=null;const fmtT=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
const bar=document.createElement('div');bar.id='edBar';bar.innerHTML='<div class="ed-idle"><button class="btn primary" id="edStart">Start Exam Day</button><button class="btn" id="edPrint">Print exam + key</button><small>Exam Day is timed, with no hints. You get only the Book and Calc.</small></div><div class="ed-live" hidden role="timer" aria-live="off"><b id="edClock"></b><span>Exam Day. Grade when you finish.</span></div>';
const jump=el('jump');jump.parentNode.insertBefore(bar,jump);
const end=()=>{if(day){clearInterval(day.t);day=null}document.body.classList.remove('exam-day');bar.querySelector('.ed-idle').hidden=false;bar.querySelector('.ed-live').hidden=true};
function tick(){if(!day)return;const left=Math.max(0,Math.ceil((day.end-Date.now())/1000));el('edClock').textContent=fmtT(left);el('edClock').classList.toggle('low',left<=300);if(left===300)toast('5 minutes left');if(left<=0){const c=window.confirm;window.confirm=()=>true;try{toast("Time's up. Grading your exam.");el('bGrade').click()}finally{window.confirm=c}}}
el('edStart').onclick=()=>{const ex=EXAMS[state.exam];if(!confirm(`Start a timed ${ex.name}? You have ${minsOf(state.exam)} minutes. The clock keeps running until you grade it.`))return;buildMock();state.mock.exam=state.exam;day={end:Date.now()+minsOf(state.exam)*60000,t:setInterval(tick,1000)};document.body.classList.add('exam-day');bar.querySelector('.ed-idle').hidden=true;bar.querySelector('.ed-live').hidden=false;tick();el('mock').scrollIntoView({block:'start'})};
document.addEventListener('visibilitychange',tick);
document.addEventListener('click',e=>{if(!day)return;const t=e.target.closest&&e.target.closest('.mode,.exam-card,#bNewMock');if(t){e.preventDefault();e.stopPropagation();toast('Finish and grade your exam first')}},true);
const gr=el('bGrade').onclick;el('bGrade').onclick=function(){gr.call(this);if(state.mock&&state.mock.graded)end()};

/* ---------- printable exam + key ---------- */
const clean=s=>String(s||'').replace(/<input[^>]*>/g,'');const line='<span class="pr-line"></span>';
function prPart(p){const lab=clean(p.label);if(p.kind==='sel')return `<div class="pr-p">${lab} ${line}<small>${p.opts.join('  •  ')}</small></div>`;if(p.kind==='mc')return `<ol class="pr-mc" type="a">${p.opts.map(o=>`<li>${o}</li>`).join('')}</ol>`;if(p.kind==='chk')return `<div class="pr-p">${lab}<small>Circle all that apply: ${p.opts.join('  •  ')}</small></div>`;if(p.kind==='obx')return `<div class="pr-p">${lab}${p.levels.map(l=>`<div class="pr-box"><b>${l.name}</b>${'<span></span>'.repeat(l.n)}</div>`).join('')}</div>`;if(p.kind==='lewis')return '<div class="pr-draw">Draw here</div>';if(p.kind==='wordeq')return `<div class="pr-p">Balanced equation: <span class="pr-line wide"></span></div>`;if(p.kind==='coef')return `<div class="pr-p">${p.r[0].map(f=>'___ '+fml(f)).join(' + ')} → ${p.r[1].map(f=>'___ '+fml(f)).join(' + ')}</div>`;return `<div class="pr-p">${lab} ${line}</div>`}
function prQ(q,n){let body;if(q.table)body=`<table class="pr-t"><tr>${q.table.head.map(h=>`<th>${h}</th>`).join('')}</tr>${q.table.rows.map(r=>`<tr>${r.map(c=>`<td>${c.kind==='given'?(c.html||c.text||''):''}</td>`).join('')}</tr>`).join('')}</table>`;else body=(q.pd?`<div class="pr-pd">${q.pd.map((x,i)=>`<span>${x}<b>${String.fromCharCode(65+i)}</b></span>`).join('')}</div>`:'')+q.parts.map(prPart).join('');return `<section class="pr-q"><h3>${n}. <small>(${q.pts} points)</small></h3><div>${q.prompt}</div>${body}<div class="pr-work"></div></section>`}
function printExam(){if(!state.mock)buildMock();const ex=EXAMS[state.exam],qs=state.mock.qs;let box=el('xPrint');if(!box){box=document.createElement('div');box.id='xPrint';document.body.appendChild(box)}const secs=ex.sections;let html=`<header><h1>${course} ${ex.name}: Practice Exam</h1><p>Name: <span class="pr-line wide"></span></p><p>Show your work. Use a calculator and your exam reference sheet. Time: ${minsOf(state.exam)} minutes. This practice exam is not graded.</p></header>`,sec='';qs.forEach((q,i)=>{if(q.sec!==sec){sec=q.sec;html+=`<h2>${(secs.find(s=>s[0]===sec)||[])[1]||''}</h2>`}html+=prQ(q,i+1)});html+=`<div class="pr-key"><h1>Answer Key: ${ex.name}</h1>${qs.map((q,i)=>`<section class="pr-k"><b>${i+1}.</b> ${q.sol}</section>`).join('')}</div>`;box.innerHTML=html;document.body.classList.add('printing');const off=()=>{document.body.classList.remove('printing');removeEventListener('afterprint',off)};addEventListener('afterprint',off);setTimeout(()=>window.print(),80)}
el('edPrint').onclick=printExam;
window.RetakePlus={minsOf,printExam,lewisData,LWPOOL,get examDay(){return day},end};
})();
