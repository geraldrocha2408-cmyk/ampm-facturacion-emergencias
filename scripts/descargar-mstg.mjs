import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ENDPOINT='https://ampm-facturacion-emergencias.carlosramirez2025.chatgpt.site/api/catalog';
const REPORT='6A605160AF446BF48DD5CAB6278A1037';
const HEADERS=['ItemLoockupCode','Item Description','Category','PriceC'];
const start=Date.now();
let data;
for(let attempt=1;attempt<=3;attempt++){
  try{
    const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','X-AMPM-Request':'catalog'},body:'{}',redirect:'manual',signal:AbortSignal.timeout(150000)});
    if(!response.ok)throw Error('MSTG HTTP '+response.status);
    data=await response.json();
    break;
  }catch(error){
    if(attempt===3)throw error;
    console.error('Consulta no completada; reintento '+attempt+' en 65 segundos.');
    await new Promise(resolve=>setTimeout(resolve,65000));
  }
}
if(data.reportId!==REPORT||JSON.stringify(data.headers)!==JSON.stringify(HEADERS)||!Array.isArray(data.rows)||data.rows.length!==data.total||data.total<1||data.total>10000)throw Error('Informe incompleto o distinto del autorizado. Se conserva la copia anterior.');
const timestamp=Date.parse(data.downloadedAt);
if(!Number.isFinite(timestamp)||timestamp<start-20*60000||timestamp>Date.now()+60000)throw Error('Fecha de descarga no vigente. Se conserva la copia anterior.');
const seen=new Set();
for(const row of data.rows){
  if(!Array.isArray(row)||row.length!==4||typeof row[0]!=='string'||!row[0].trim()||seen.has(row[0])||typeof row[1]!=='string'||!row[1].trim()||typeof row[2]!=='string'||typeof row[3]!=='number'||!Number.isFinite(row[3])||row[3]<0||row[3]>1000000)throw Error('Producto inválido o duplicado. Se conserva la copia anterior.');
  seen.add(row[0]);
}
const catalog={headers:HEADERS,rows:data.rows,total:data.total,name:'Precios Productos',reportId:REPORT,downloadedAt:data.downloadedAt};
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Managua',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));
const csvCell=value=>'"'+String(value).replace(/^[=+@\t\r-]/,"'$&").replaceAll('"','""')+'"';
const csv='\uFEFF'+[HEADERS,...data.rows.map(r=>[r[0],r[1],r[2],r[3].toFixed(2)])].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
const json=JSON.stringify(catalog,null,2)+'\n';
const digest=createHash('sha256').update(json).digest('hex');
const status={downloadedAt:data.downloadedAt,verifiedAt:new Date().toISOString(),products:data.total,withoutPrice:data.rows.filter(r=>r[3]===0).length,priceColumn:'PriceC',currency:'USD',reportId:REPORT,sha256:digest,reportFile:'reportes/Precios-Productos-'+date+'.csv',schedule:'Lunes y viernes, 09:00, America/Managua'};
await fs.mkdir(path.join(ROOT,'datos'),{recursive:true});await fs.mkdir(path.join(ROOT,'reportes'),{recursive:true});
// All upstream validation completes before any current file is replaced.
await fs.writeFile(path.join(ROOT,'datos/catalogo-actual.json.tmp'),json);
await fs.writeFile(path.join(ROOT,status.reportFile),csv);
await fs.writeFile(path.join(ROOT,'reportes/Precios-Productos-Actual.csv'),csv);
await fs.rename(path.join(ROOT,'datos/catalogo-actual.json.tmp'),path.join(ROOT,'datos/catalogo-actual.json'));
await fs.writeFile(path.join(ROOT,'datos/ultima-descarga.json'),JSON.stringify(status,null,2)+'\n');
const verified=JSON.parse(await fs.readFile(path.join(ROOT,'datos/catalogo-actual.json'),'utf8'));
if(verified.rows.length!==data.total)throw Error('Falló la lectura del archivo guardado.');
console.log(JSON.stringify(status,null,2));
