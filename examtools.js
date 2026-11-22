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
