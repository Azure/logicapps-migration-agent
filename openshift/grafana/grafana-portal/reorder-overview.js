// Reorders the Overview & Health tab so error/warning panels sit directly under
// the two Pod Health tables, with Volume Mounts moved to the bottom.
const http = require('http');
const HOST='127.0.0.1', PORT=3000;
const AUTH='Basic '+Buffer.from('admin:admin').toString('base64');
const UID='logicapps-monitor-psrivas-la1001';
const API=`/apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboards/${UID}`;

function req(method,path,body){return new Promise((res,rej)=>{const d=body?JSON.stringify(body):'';
 const r=http.request({host:HOST,port:PORT,path,method,headers:{Authorization:AUTH,'Content-Type':'application/json','Accept':'application/json','Content-Length':Buffer.byteLength(d)}},
  x=>{let b='';x.on('data',c=>b+=c);x.on('end',()=>res({status:x.statusCode,json:b?JSON.parse(b):null}));});
 r.on('error',rej);if(d)r.write(d);r.end();});}

// Desired vertical order (x/width preserved from existing items).
const ORDER=['panel-13','panel-96','panel-30','panel-31','panel-32','panel-19'];

(async()=>{
  const get=await req('GET',API);
  if(get.status!==200){console.error('GET failed',get.status);process.exit(1);}
  const obj=get.json;
  const tab=obj.spec.layout.spec.tabs.find(t=>t.spec.title==='Overview & Health');
  const items=tab.spec.layout.spec.items;
  const by=n=>items.find(i=>i.spec.element.name===n);

  // Anchor y = just below the cluster pod stat row (max end-y of the stat panels).
  const anchors=['panel-1','panel-7'].map(by).filter(Boolean);
  let y=Math.max(...items.filter(i=>i.spec.height<=5).map(i=>i.spec.y+i.spec.height)); // stats end (=9)

  // panel-31 and panel-32 share a row (half width each) -> place at same y.
  for(const name of ORDER){
    const it=by(name); if(!it){console.warn('missing',name);continue;}
    if(name==='panel-32'){ it.spec.y=by('panel-31').spec.y; continue; } // same row as 31
    it.spec.y=y;
    y+=it.spec.height;
  }

  const rows=items.map(i=>({el:i.spec.element.name,y:i.spec.y,h:i.spec.height,x:i.spec.x,w:i.spec.width}))
    .sort((a,b)=>a.y-b.y||a.x-b.x);
  console.table(rows);

  const put=await req('PUT',API,obj);
  if(put.status>=200&&put.status<300)console.log('PUT ok',put.status);
  else{console.error('PUT failed',put.status,JSON.stringify(put.json));process.exit(1);}
})();
