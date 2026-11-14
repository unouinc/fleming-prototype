const { chromium } = require('playwright');
const dir=process.argv[2]||'before';
(async()=>{const b=await chromium.launch();
for(const [n,w,h,hash] of [['index',1440,1400,''],['job',1440,2600,''],['job',1440,900,'#talk'],['scouts',1440,1100,''],['members-a',1440,1100,''],['profile',1440,1200,''],['signup',1440,900,''],['index',390,1600,''],['job',390,1800,'']]){
 const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('file://'+process.cwd()+'/site/'+n+'.html'+hash);await p.waitForTimeout(500);
 await p.screenshot({path:`${dir}/${n}${hash?'-talk':''}-${w}.png`});await p.close();}
await b.close();})();
