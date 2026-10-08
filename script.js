import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getFirestore,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,collection,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ค่าเชื่อมต่อ Firebase (ไม่ใช่รหัสลับ ความปลอดภัยอยู่ที่ Firestore Rules)
const firebaseConfig={
  apiKey:"AIzaSyB9Qa-wcMxqIfwtBrzIEWhK9YOkF9aV91A",
  authDomain:"constitution-6a0e8.firebaseapp.com",
  projectId:"constitution-6a0e8",
  storageBucket:"constitution-6a0e8.firebasestorage.app",
  messagingSenderId:"603270880596",
  appId:"1:603270880596:web:420eb97520c4b35f9d3cc1"
};
const fbApp=initializeApp(firebaseConfig),auth=getAuth(fbApp),db=getFirestore(fbApp);
let me=null,role='guest',ownerUid=null,canEdit=false,cloudOK=false,usersPending=0,dirty=false;
const ROLE={owner:'เจ้าของ',admin:'ผู้ดูแล',pending:'รออนุมัติ',rejected:'ไม่ได้รับสิทธิ์',guest:'ผู้เยี่ยมชม'};
const KEY='law-site-v2';
const NAMES=['ประมวลกฎหมายอาญา','พระราชบัญญัติกฎระเบียบ','พระราชบัญญัติว่าด้วยวินัย','ประมวลกฎหมายอาญาไซเบอร์','รัฐธรรมนูญแห่งราชอาณาจักรไทย'];
const DEF=()=>({site:{top:'ระบบรวมศูนย์ผู้กระทำผิด',title:'ข้อกฎหมาย',sub:'รัฐธรรมนูญ ประมวลกฎหมายอาญา และพระราชบัญญัติที่เกี่ยวข้อง',logo:''},
  cats:NAMES.map((n,i)=>({id:'c'+i,name:n,heading:n,items:[]}))});
let S=DEF(),cur='c0',edit=false;
try{const r=localStorage.getItem(KEY);
  if(r){const p=JSON.parse(r);S.site=Object.assign(S.site,p.site||{});if(Array.isArray(p.cats)&&p.cats.length)S.cats=p.cats}
  else{const old=JSON.parse(localStorage.getItem('law-data')||'null');
    if(old){const m={criminal:'c0',rules:'c1',discipline:'c2',cyber:'c3',constitution:'c4'};
      for(const k in m){const c=S.cats.find(x=>x.id===m[k]);if(c&&old[k])c.items=old[k]}}}
}catch(e){}
const $=id=>document.getElementById(id);
const defLogo=$('logo').src;
function el(t,a={},...k){const e=document.createElement(t);
  for(const[x,v]of Object.entries(a)){if(x==='class')e.className=v;else if(x.startsWith('on'))e[x]=v;else if(x==='value')e.value=v;else e.setAttribute(x,v)}
  k.flat().forEach(c=>e.append(c));return e}
let tt;function toast(m,ms){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),ms||1400)}
function localSave(){try{localStorage.setItem(KEY,JSON.stringify(S));return true}catch(e){return false}}
const lastSaved={};let cloudIds=new Set();
const catData=(c,i)=>JSON.parse(JSON.stringify({name:c.name||'',heading:c.heading||'',items:c.items||[],order:i}));
async function cloudLoad(){
  try{
    const [st,cs]=await Promise.all([getDoc(doc(db,'site','main')),getDocs(collection(db,'cats'))]);
    if(st.exists()){S.site=Object.assign(DEF().site,st.data())}
    if(!cs.empty){
      const arr=cs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0));
      S.cats=arr.map(({order,...c})=>({...c,items:c.items||[]}));
    }
    lastSaved.site=JSON.stringify(S.site);
    cloudIds=new Set(cs.docs.map(d=>d.id));
    S.cats.forEach((c,i)=>{if(cloudIds.has(c.id))lastSaved[c.id]=JSON.stringify(catData(c,i))});
    if(!S.cats.some(c=>c.id===cur))cur=S.cats[0].id;
    localSave();cloudOK=true;
  }catch(e){cloudOK=false}
}
async function cloudSave(){
  if(!canEdit)return 0;
  const jobs=[],sj=JSON.stringify(S.site);
  if(sj!==lastSaved.site)jobs.push([doc(db,'site','main'),JSON.parse(sj),'site',sj]);
  S.cats.forEach((c,i)=>{const d=catData(c,i),j=JSON.stringify(d);if(j!==lastSaved[c.id])jobs.push([doc(db,'cats',c.id),d,c.id,j])});
  for(const [ref,data,k,j] of jobs){await setDoc(ref,data);lastSaved[k]=j;cloudIds.add(k)}
  for(const id of [...cloudIds]){if(!S.cats.some(c=>c.id===id)){await deleteDoc(doc(db,'cats',id));cloudIds.delete(id);delete lastSaved[id]}}
  return jobs.length;
}
let queue=Promise.resolve();
function save(quiet){
  localSave();
  if(!canEdit)return;
  dirty=true;
  queue=queue.then(cloudSave).then(()=>{dirty=false;if(!quiet)toast('บันทึกขึ้นระบบแล้ว ✓')}).catch(e=>{
    const m=e&&e.code==='permission-denied'?'ไม่มีสิทธิ์บันทึก (ตรวจสอบ Firestore Rules)':e&&e.code==='invalid-argument'?'ข้อมูลหมวดนี้ใหญ่เกิน 1 MB ควรแบ่งเป็นหลายหมวด':'บันทึกขึ้นระบบไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต';
    toast(m,3500)});
}
addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
let sd;function autosave(){dirty=true;clearTimeout(sd);sd=setTimeout(()=>save(),1200)}
function applySite(){
  $('topT').textContent=S.site.top;$('siteT').textContent=S.site.title;$('navT').textContent=S.site.title;$('crumbT').textContent=S.site.title;
  $('siteS').textContent=S.site.sub;document.title=S.site.title;$('logo').src=S.site.logo||defLogo}
function copy(txt){
  const ok=()=>toast('คัดลอกแล้ว');
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(txt).then(ok,fb);else fb();
  function fb(){const a=el('textarea',{value:txt});document.body.append(a);a.select();try{document.execCommand('copy');ok()}catch(e){}a.remove()}}
function parse(t){
  const L=t.replace(/\r/g,'').split('\n'),re=/^\s*(มาตรา|ข้อ)\s*[\d๐-๙]+/,hre=/^\s*(หมวด|ส่วนที่|บทที่|ภาค)\s*[\d๐-๙]+/,out=[];
  if(L.some(l=>re.test(l))){let c=null;for(const l of L){if(hre.test(l)){c=null;out.push({type:'h',title:l.trim(),body:''})}else if(re.test(l)){c={title:l.trim(),body:''};out.push(c)}else if(c&&l.trim())c.body+=(c.body?'\n':'')+l.trim()}}
  else t.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean).forEach(s=>{const p=s.split('\n');out.push({title:p[0],body:p.slice(1).join('\n')})});
  return out}
function field(label,val,fn,ta){const i=el(ta?'textarea':'input',{class:'in',value:val});i.oninput=()=>{fn(i.value);autosave()};
  return el('div',{},el('span',{class:'lab'},label),i)}
function settings(){
  const f=el('input',{type:'file',accept:'image/*'});
  f.onchange=()=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas'),s=Math.min(1,400/Math.max(im.width,im.height));
    c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);S.site.logo=c.toDataURL('image/png');applySite();save()};im.src=r.result};if(f.files[0])r.readAsDataURL(f.files[0])};
  const imp=el('input',{type:'file',accept:'.json'});
  imp.onchange=()=>{const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);if(!Array.isArray(p.cats)||!p.cats.length)throw 0;p.site=Object.assign(DEF().site,p.site||{});S=p;cur=S.cats[0].id;save();applySite();render()}catch(e){toast('ไฟล์สำรองไม่ถูกต้อง')}};if(imp.files[0])r.readAsText(imp.files[0])};
  return el('div',{class:'panel'},el('h4',{},'ตั้งค่าเว็บไซต์'),
    el('div',{class:'grid'},
      field('ข้อความแถบบน',S.site.top,v=>{S.site.top=v;applySite()}),
      field('ชื่อหน้า',S.site.title,v=>{S.site.title=v;applySite()}),
      field('คำอธิบายใต้ชื่อ',S.site.sub,v=>{S.site.sub=v;applySite()})),
    el('div',{class:'row'},el('div',{},el('span',{class:'lab'},'โลโก้ (อัปโหลดรูปใหม่)'),f),
      el('button',{class:'btn sm',onclick:()=>{S.site.logo='';applySite();save()}},'ใช้โลโก้เดิม')),
    el('h4',{style:'margin-top:16px'},'หมวดหมู่'),
    el('div',{class:'grid'},S.cats.map(c=>field('ชื่อหมวด',c.name,v=>{c.name=v;pills()}))),
    el('div',{class:'row',style:'margin-top:16px'},
      el('button',{class:'btn pri',onclick:()=>save()},'💾 บันทึก'),
      el('button',{class:'btn',onclick:()=>{const a=el('a',{href:URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'})),download:'law-backup.json'});document.body.append(a);a.click();a.remove()}},'⬇ สำรองข้อมูล (.json)'),
      el('div',{},el('span',{class:'lab'},'นำเข้าไฟล์สำรอง'),imp)),
    el('div',{class:'lab',style:'margin-top:8px'},'ระบบบันทึกอัตโนมัติขึ้นระบบออนไลน์ ทุกคนที่เปิดเว็บจะเห็นข้อมูลล่าสุดตรงกัน ควรกดสำรองข้อมูลไว้เป็นระยะ'))}
function card(x,c,i,q){
  if(edit&&!q){
    const H=x.type==='h';
    const ti=el('input',{class:'in ti',value:x.title,placeholder:H?'เช่น หมวด ๑ : บทนิยาม':'เช่น มาตรา ๑ ชื่อประมวลกฎหมาย'});ti.oninput=()=>{x.title=ti.value;autosave()};
    const bo=el('textarea',{class:'in',value:x.body,placeholder:'เนื้อหาข้อกฎหมาย'});bo.oninput=()=>{x.body=bo.value;autosave()};
    const mv=d=>()=>{const j=i+d;if(j<0||j>=c.items.length)return;[c.items[i],c.items[j]]=[c.items[j],c.items[i]];save(true);render()};
    return el('div',{class:'item'+(H?' hdi':'')},H?el('span',{class:'tag'},'หัวข้อหมวด'):'',ti,H?'':bo,el('div',{class:'row'},
      el('button',{class:'btn sm',onclick:mv(-1)},'↑'),el('button',{class:'btn sm',onclick:mv(1)},'↓'),
      el('button',{class:'btn sm',onclick:()=>{if(confirm('ลบรายการนี้?')){c.items.splice(i,1);save();render()}}},'🗑 ลบ')))}
  if(x.type==='h')return el('h2',{class:'sec'},x.title);
  const d=el('div',{class:'item'},el('button',{class:'cp',onclick:()=>copy(x.title+(x.body?'\n'+x.body:''))},'คัดลอก'));
  if(q)d.append(el('span',{class:'tag'},c.name),el('br'));
  d.append(el('h3',{},x.title));if(x.body)d.append(el('p',{},x.body));return d}
function pills(){const p=$('pills');p.textContent='';
  S.cats.forEach(c=>p.append(el('button',{class:'pill'+(c.id===cur?' on':''),onclick:()=>{cur=c.id;$('q').value='';render()}},c.name)))}
function render(){
  pills();const m=$('main');m.textContent='';m.className=edit?'edit':'';
  $('editBtn').textContent=edit?'✓ เสร็จสิ้นการแก้ไข':'⚙ ตั้งค่า / แก้ไข';
  const q=$('q').value.trim().toLowerCase();
  if(edit&&!q)m.append(settings());
  if(q){const rows=[];S.cats.forEach(c=>c.items.forEach((x,i)=>{if(x.type!=='h'&&(x.title+' '+x.body).toLowerCase().includes(q))rows.push([x,c,i])}));
    m.append(el('h2',{class:'hd'},`ผลการค้นหา (${rows.length} รายการ)`));
    if(!rows.length)m.append(el('div',{class:'empty'},'ไม่พบรายการที่ค้นหา'));
    rows.forEach(([x,c,i])=>m.append(card(x,c,i,true)));return}
  const c=S.cats.find(x=>x.id===cur)||S.cats[0];
  if(edit){const h=el('input',{class:'in',value:c.heading,style:'font-size:20px;font-weight:600;margin-bottom:14px',placeholder:'หัวข้อ เช่น ประมวลกฎหมายอาญา พุทธศักราช ๒๔๖๙'});
    h.oninput=()=>{c.heading=h.value;autosave()};m.append(h)}
  else m.append(el('h2',{class:'hd'},c.heading||c.name));
  if(!c.items.length)m.append(el('div',{class:'empty'},edit?'ยังไม่มีรายการ กด "+ เพิ่มมาตรา" ด้านล่าง':'ยังไม่มีข้อมูลในหมวดนี้'));
  c.items.forEach((x,i)=>m.append(card(x,c,i)));
  if(edit){const ta=el('textarea',{class:'in',style:'min-height:180px',placeholder:'มาตรา ๑ ...\nเนื้อหา...\n\nมาตรา ๒ ...'});
    m.append(el('div',{class:'row'},el('button',{class:'btn pri',onclick:()=>{c.items.push({title:'',body:''});save(true);render();window.scrollTo(0,document.body.scrollHeight)}},'+ เพิ่มมาตรา'),
      el('button',{class:'btn pri',onclick:()=>{c.items.push({type:'h',title:'',body:''});save(true);render();window.scrollTo(0,document.body.scrollHeight)}},'+ เพิ่มหัวข้อหมวด'),
      el('button',{class:'btn',onclick:()=>{if(confirm('ล้างรายการทั้งหมวดนี้?')){c.items=[];save();render()}}},'ล้างทั้งหมวด')),
      el('details',{},el('summary',{},'วางข้อความหลายมาตราพร้อมกัน'),
        el('div',{class:'lab',style:'margin:6px 0'},'ระบบแยกรายการเมื่อบรรทัดขึ้นต้นด้วย "มาตรา" หรือ "ข้อ" ตามด้วยตัวเลข และบรรทัดที่ขึ้นต้นด้วย "หมวด" "ส่วนที่" "บทที่" "ภาค" จะกลายเป็นหัวข้อหมวดให้อัตโนมัติ'),ta,
        el('button',{class:'btn pri',style:'margin-top:8px',onclick:()=>{if(!ta.value.trim())return;c.items.push(...parse(ta.value));save();render()}},'เพิ่มทั้งหมด')))}}
$('q').oninput=render;$('go').onclick=render;
$('editBtn').onclick=()=>{if(!canEdit)return;edit=!edit;if(!edit)save(true);render()};

/* ---------- ระบบสมาชิก / สิทธิ์ ---------- */
let modal=null;
function closeModal(){if(modal){modal.remove();modal=null}}
function openModal(...kids){closeModal();
  modal=el('div',{class:'ov',onclick:e=>{if(e.target===modal)closeModal()}},
    el('div',{class:'dlg'},el('button',{class:'x',type:'button',onclick:closeModal,'aria-label':'ปิด'},'✕'),...kids));
  document.body.append(modal)}
function authErr(x){const m={'auth/invalid-email':'อีเมลไม่ถูกต้อง','auth/invalid-credential':'อีเมลหรือรหัสผ่านไม่ถูกต้อง','auth/wrong-password':'อีเมลหรือรหัสผ่านไม่ถูกต้อง','auth/user-not-found':'อีเมลหรือรหัสผ่านไม่ถูกต้อง','auth/email-already-in-use':'อีเมลนี้สมัครไว้แล้ว','auth/weak-password':'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว','auth/too-many-requests':'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่','auth/operation-not-allowed':'ยังไม่ได้เปิดใช้ Email/Password ใน Firebase','auth/network-request-failed':'เชื่อมต่ออินเทอร์เน็ตไม่ได้','auth/invalid-api-key':'ค่า apiKey ไม่ถูกต้อง'};
  return m[x&&x.code]||('เกิดข้อผิดพลาด: '+((x&&x.code)||x))}
function authDialog(mode){
  const up=mode==='up';
  const em=el('input',{class:'in',type:'email',placeholder:'อีเมล',autocomplete:'email',required:'required'});
  const pw=el('input',{class:'in',type:'password',placeholder:'รหัสผ่าน (อย่างน้อย 6 ตัว)',autocomplete:up?'new-password':'current-password',required:'required'});
  const pw2=up?el('input',{class:'in',type:'password',placeholder:'ยืนยันรหัสผ่าน',autocomplete:'new-password',required:'required'}):'';
  const err=el('div',{class:'err'});
  const sub=el('button',{class:'btn pri',type:'submit'},up?'สมัครสมาชิก':'เข้าสู่ระบบ');
  const f=el('form',{class:'af',onsubmit:async e=>{e.preventDefault();err.textContent='';
    if(up&&pw.value!==pw2.value){err.textContent='รหัสผ่านไม่ตรงกัน';return}
    sub.disabled=true;
    try{if(up)await createUserWithEmailAndPassword(auth,em.value.trim(),pw.value);else await signInWithEmailAndPassword(auth,em.value.trim(),pw.value);
      closeModal();if(up)toast('สมัครแล้ว รอเจ้าของเว็บอนุมัติ',3000)}
    catch(x){err.textContent=authErr(x)}
    sub.disabled=false}},
    em,pw,pw2,err,sub,
    el('div',{class:'lab',style:'margin-top:6px'},up?'หลังสมัคร ต้องรอเจ้าของเว็บอนุมัติก่อน จึงจะเห็นช่องตั้งค่า':''));
  const tab=(t,m)=>el('button',{type:'button',class:'tab'+((m==='up')===up?' on':''),onclick:()=>authDialog(m)},t);
  openModal(el('div',{class:'tabs'},tab('เข้าสู่ระบบ','in'),tab('สมัครสมาชิก','up')),f);
  em.focus()}
async function loadUsers(){
  const s=await getDocs(collection(db,'users'));
  const o={pending:0,admin:1,rejected:2};
  return s.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.uid!==me.uid).sort((a,b)=>(o[a.role]??3)-(o[b.role]??3));}
async function drawUsers(box){
  box.textContent='';box.append(el('h4',{style:'margin:16px 0 6px'},'ผู้ดูแลระบบและคำขอสมัคร'));
  let list;
  try{list=await loadUsers()}catch(e){box.append(el('div',{class:'err'},'โหลดรายชื่อไม่ได้ (ตรวจสอบ Firestore Rules)'));return}
  usersPending=list.filter(u=>u.role==='pending').length;updateLoginText();
  if(!list.length){box.append(el('div',{class:'lab'},'ยังไม่มีผู้สมัคร'));return}
  list.forEach(u=>{
    const setR=r=>async()=>{try{await updateDoc(doc(db,'users',u.uid),{role:r});toast('อัปเดตแล้ว');drawUsers(box)}catch(e){toast('ทำรายการไม่สำเร็จ',2500)}};
    const delU=async()=>{if(!confirm('ลบรายชื่อนี้?'))return;try{await deleteDoc(doc(db,'users',u.uid));toast('ลบแล้ว');drawUsers(box)}catch(e){toast('ทำรายการไม่สำเร็จ',2500)}};
    const b=[];
    if(u.role!=='admin')b.push(el('button',{class:'btn sm pri',type:'button',onclick:setR('admin')},'อนุมัติ'));
    if(u.role==='pending')b.push(el('button',{class:'btn sm',type:'button',onclick:setR('rejected')},'ปฏิเสธ'));
    if(u.role==='admin')b.push(el('button',{class:'btn sm',type:'button',onclick:setR('rejected')},'ถอนสิทธิ์'));
    b.push(el('button',{class:'btn sm',type:'button',onclick:delU},'ลบ'));
    box.append(el('div',{class:'urow'},el('div',{class:'um'},el('div',{},u.email||u.uid),el('span',{class:'tag'},ROLE[u.role]||u.role)),el('div',{class:'row',style:'margin:0'},b)))})}
async function acctDialog(){
  const box=el('div');
  const parts=[el('h4',{style:'margin:0 0 4px'},'บัญชีของฉัน'),el('div',{class:'lab'},me.email),el('div',{},el('span',{class:'tag'},ROLE[role]))];
  if(role==='pending'||role==='rejected'){
    parts.push(el('p',{class:'lab',style:'margin:10px 0'},role==='pending'?'บัญชีรอเจ้าของเว็บอนุมัติ เมื่ออนุมัติแล้วกดปุ่มตรวจสอบสิทธิ์':'คำขอถูกปฏิเสธหรือสิทธิ์ถูกถอน'),
      el('button',{class:'btn',type:'button',onclick:async()=>{await refreshRole();closeModal();toast(canEdit?'ได้รับสิทธิ์แล้ว':'ยังไม่ได้รับสิทธิ์')}},'ตรวจสอบสิทธิ์อีกครั้ง'))}
  if(!ownerUid){
    const code=el('input',{class:'in',type:'password',placeholder:'รหัสตั้งค่าเจ้าของ (ที่ตั้งไว้ใน Rules)'});
    parts.push(el('div',{class:'panel',style:'margin:12px 0 0'},el('h4',{},'ตั้งเป็นเจ้าของเว็บ (ทำครั้งเดียว)'),code,
      el('button',{class:'btn pri',type:'button',style:'margin-top:8px',onclick:async()=>{
        try{await setDoc(doc(db,'meta','owner'),{uid:me.uid,setupCode:code.value});await refreshRole();closeModal();toast('ตั้งเป็นเจ้าของแล้ว',2500)}
        catch(e){toast('ตั้งไม่สำเร็จ ตรวจรหัสและ Rules',3000)}}},'ยืนยัน')))}
  parts.push(box,el('div',{class:'row',style:'margin-top:16px'},el('button',{class:'btn',type:'button',onclick:()=>signOut(auth).then(()=>{closeModal();toast('ออกจากระบบแล้ว')})},'ออกจากระบบ')));
  openModal(...parts);
  if(role==='owner')drawUsers(box)}
function updateLoginText(){
  $('loginT').textContent=!me?'เข้าสู่ระบบ':role==='owner'?'เจ้าของ'+(usersPending?' ('+usersPending+' คำขอ)':''):ROLE[role]}
function updateUI(){
  updateLoginText();$('editBtn').style.display=canEdit?'':'none';render()}
async function refreshRole(){
  await loadP;
  role='guest';ownerUid=null;usersPending=0;
  try{const o=await getDoc(doc(db,'meta','owner'));ownerUid=o.exists()?o.data().uid:null}catch(e){}
  if(me){
    if(ownerUid&&ownerUid===me.uid)role='owner';
    else{
      try{const r=doc(db,'users',me.uid),u=await getDoc(r);
        if(!u.exists()){await setDoc(r,{email:me.email,role:'pending',createdAt:serverTimestamp()});role='pending'}
        else role=u.data().role||'pending'}
      catch(e){role='pending'}}}
  canEdit=(role==='owner'||role==='admin')&&cloudOK;
  if((role==='owner'||role==='admin')&&!cloudOK)toast('โหลดข้อมูลออนไลน์ไม่สำเร็จ จึงปิดการแก้ไขไว้ก่อน',3500);
  if(!canEdit&&edit)edit=false;
  updateUI();
  if(role==='owner'){try{usersPending=(await loadUsers()).filter(u=>u.role==='pending').length;updateLoginText()}catch(e){}}}
$('loginBtn').onclick=()=>{me?acctDialog():authDialog('in')};

applySite();render();
const loadP=cloudLoad().then(()=>{applySite();render()});
onAuthStateChanged(auth,u=>{me=u;refreshRole()});

