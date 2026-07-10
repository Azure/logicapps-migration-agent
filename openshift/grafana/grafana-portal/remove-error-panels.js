// Removes the 3 error/warning panels from the Overview & Health tab and
// compacts Volume Mounts up to sit directly under Pod Health (per Pod).
const http = require('http');
const HOST='127.0.0.1', PORT=3000;
const AUTH='Basic '+Buffer.from('admin:admin').toString('base64');
const UID='logicapps-monitor-psrivas-la1001';
const API=`/apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboards/${UID}`;
const REMOVE=['panel-30','panel-31','panel-32'];

function req(method,path,body){return new Promise((res,rej)=>{const d=body?JSON.stringify(body):'';
 const r=http.request({host:HOST,port:PORT,path,method,headers:{Authorization:AUTH,'Content-Type':'application/json','Accept':'application/json','Content-Length':Buffer.byteLength(d)}},
  x=>{let b='';x.on('data',c=>b+=c);x.on('end',()=>res({status:x.statusCode,json:b?JSON.parse(b):null}));});
 r.on('error',rej);if(d)r.write(d);r.end();});}

(async()=>{
  const get=await req('GET',API);
  if(get.status!==200){console.error('GET failed',get.status);process.exit(1);}
  const obj=get.json;
  for(const k of REMOVE) delete obj.spec.elements[k];

  const tab=obj.spec.layout.spec.tabs.find(t=>t.spec.title==='Overview & Health');
  tab.spec.layout.spec.items = tab.spec.layout.spec.items.filter(i=>!REMOVE.includes(i.spec.element.name));

  // Compact: place Volume Mounts (panel-19) right below Pod Health per Pod (panel-96).
  const items=tab.spec.layout.spec.items;
  const p96=items.find(i=>i.spec.element.name==='panel-96');
  const p19=items.find(i=>i.spec.element.name==='panel-19');
  if(p96&&p19) p19.spec.y = p96.spec.y + p96.spec.height;

  console.table(items.map(i=>({el:i.spec.element.name,y:i.spec.y,h:i.spec.height,w:i.spec.width}))
    .sort((a,b)=>a.y-b.y||a.x-b.x));

  const put=await req('PUT',API,obj);
  if(put.status>=200&&put.status<300)console.log('PUT ok',put.status);
  else{console.error('PUT failed',put.status,JSON.stringify(put.json));process.exit(1);}
})();
