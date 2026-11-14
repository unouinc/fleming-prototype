const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'../site');
const srv=http.createServer((q,r)=>{let f=path.join(root,q.url.split('?')[0].split('#')[0]);if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});r.end(d);});}).listen(8765);
const MOCK=`
window.supabase={createClient(){
  const db=()=>JSON.parse(localStorage.getItem('mockdb')||'{"profiles":[],"talk_requests":[],"session":null}');
  const save=d=>localStorage.setItem('mockdb',JSON.stringify(d));
  const res=d=>Promise.resolve({data:d,error:null});
  return {auth:{getSession:()=>res({session:db().session}),signInWithOtp:({email})=>{const d=db();d.otp=email;save(d);return res({});},signOut:()=>res({})},
   from(t){return {select(){return {eq(k,v){return {maybeSingle:()=>res(db()[t].find(r=>r[k]===v)||null)}}}},
     insert(row){const d=db();d[t].push(row);save(d);return res(null);},
     upsert(row){const d=db();d[t]=d[t].filter(r=>r.id!==row.id).concat([row]);save(d);return {select(){return {single:()=>res(row)}}};}}}};
}};`;
(async()=>{const b=await chromium.launch();
for (const [w,h,tag] of [[1440,900,'pc'],[390,844,'sp']]){
 const ctx=await b.newContext({viewport:{width:w,height:h}});
 await ctx.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:"window.NASURI_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'k'};"}));
 await ctx.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:MOCK}));
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const U='http://localhost:8765/';
 await p.goto(U+'index.html');await p.waitForTimeout(400);
 await p.locator('a.cta').first().click();await p.waitForTimeout(500);
 const m=p.locator('[aria-modal="true"]');
 console.log(tag,'card',await m.locator('text=まだ登録されていません').count(),'btn',await m.locator('button',{hasText:'登録して送る'}).count());
 await m.locator('button',{hasText:'少しだけ興味がある'}).click();
 await p.locator('#talknote').fill('有休の取りやすさ');
 await m.locator('button',{hasText:'登録して送る'}).click();await p.waitForURL('**/signup.html');await p.waitForTimeout(400);
 console.log(tag,'lead',await p.locator('text=登録が終わると、そのまま送信されます').count());
 await p.locator('button',{hasText:'ログイン用のリンクを送る'}).click();
 console.log(tag,'err1',await p.locator('[role=alert]').innerText());
 await p.locator('#su-email').fill('a@example.com');await p.locator('#su-agree').check();
 console.log(tag,'email kept',await p.locator('#su-email').inputValue());
 await p.locator('button',{hasText:'ログイン用のリンクを送る'}).click();await p.waitForTimeout(300);
 console.log(tag,'sent',await p.locator('text=メールを送りました').count(),'protoBtn',await p.locator('text=試作用').count());
 await p.screenshot({path:`shots/live-sent-${tag}.png`});
 // simulate clicking the magic link
 await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('mockdb'));d.session={user:{id:'u1',email:d.otp}};localStorage.setItem('mockdb',JSON.stringify(d));});
 await p.goto(U+'signup.html');await p.waitForTimeout(500);
 console.log(tag,'profile step',await p.locator('text=プロフィールを登録').count());
 await p.locator('#su-name').fill('山田 花子');await p.locator('#su-years').fill('5年');await p.locator('#su-station').fill('横浜駅');
 console.log(tag,'years',await p.locator('#su-years').inputValue());
 await p.screenshot({path:`shots/live-profile-${tag}.png`,fullPage:true});
 await p.locator('button',{hasText:'登録して「話を聞きたい」を送る'}).click();await p.waitForURL('**/job.html#sent');await p.waitForTimeout(500);
 console.log(tag,'done',await p.locator('text=「話を聞きたい」を送りました').count(),'summary',await p.locator('text=少しだけ興味がある').count(),await p.locator('text=有休の取りやすさ').count(),'msgLink',await p.locator('[aria-modal="true"] a',{hasText:'メッセージを見る'}).count());
 await p.screenshot({path:`shots/live-done-${tag}.png`});
 console.log(tag,'db',await p.evaluate(()=>localStorage.getItem('mockdb')), 'pending',await p.evaluate(()=>localStorage.getItem('nasuri_pending_talk')));
 // second request while logged in
 await p.goto(U+'index.html');await p.goto(U+'job.html#talk');await p.waitForTimeout(500);
 console.log(tag,'card2',await p.locator('[aria-modal="true"]').locator('text=正看護師 5年目｜最寄駅 横浜').count());
 await p.locator('[aria-modal="true"] button',{hasText:'この内容で送る'}).click();await p.waitForTimeout(300);
 console.log(tag,'done2',await p.locator('text=「話を聞きたい」を送りました').count(),'n',await p.evaluate(()=>JSON.parse(localStorage.getItem('mockdb')).talk_requests.length),'sw',await p.evaluate(()=>document.documentElement.scrollWidth),errs);
 // logged-in user visiting signup
 await p.goto(U+'signup.html');await p.waitForTimeout(500);console.log(tag,'signup when done',await p.locator('text=登録が完了しました').count());
 await ctx.close();
 // prototype-mode signup
 const q=await b.newPage({viewport:{width:w,height:h}});await q.goto(U+'signup.html');await q.waitForTimeout(300);
 await q.screenshot({path:`shots/proto-signup-${tag}.png`});
 await q.locator('#su-email').fill('a@example.com');await q.locator('#su-agree').check();await q.locator('button',{hasText:'ログイン用のリンクを送る'}).click();
 await q.locator('text=試作用').click();await q.locator('#su-name').fill('a');await q.locator('#su-years').fill('3');await q.locator('#su-station').fill('b');await q.locator('button',{hasText:'登録する'}).click();
 console.log(tag,'proto done',await q.locator('text=登録が完了しました').count(),'sw',await q.evaluate(()=>document.documentElement.scrollWidth));await q.close();
}
await b.close();srv.close();})();
