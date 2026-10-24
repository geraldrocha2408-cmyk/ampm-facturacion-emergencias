(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.Core=api;})(globalThis,()=>{
  'use strict';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  function cents(v){
    if(typeof v==='number'){if(!Number.isFinite(v)||v<0)return null;const n=Math.round((v+Number.EPSILON)*100);return Number.isSafeInteger(n)?n:null;}
    let s=String(v??'').trim().replace(/^(USD|US\$|\$)\s*/i,'');
    if(!s)return null;
    if(/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s))s=s.replace(/,/g,'');
    else if(/^\d+,\d{1,2}$/.test(s))s=s.replace(',','.');
    if(!/^\d+(\.\d{1,2})?$/.test(s))return null;
    const parts=s.split('.');const n=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));return Number.isSafeInteger(n)?n:null;
  }
  function csv(text){
    text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0];
    const delimiter=['\t',';',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===delimiter&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=ch;}
    if(quoted)throw Error('El CSV tiene comillas sin cerrar.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
  }
  const aliases={code:['item','itemlookupcode','itemlookcupcode','itemloockupcode','codigo','sku'],name:['description','itemdescription','descripcion'],price:['pricec'],category:['category','categoria'],store:['store','tienda']};
  function mapping(headers){return Object.fromEntries(Object.entries(aliases).map(([k,a])=>[k,headers.findIndex(h=>a.includes(norm(h)))]));}
  function catalog(headers,rows,map=mapping(headers),store=''){
    for(const k of ['code','name','price'])if(map[k]<0)throw Error('Falta la columna '+({code:'código',name:'descripción',price:'PriceC'}[k])+'.');
    const stores=map.store<0?[]:[...new Set(rows.map(r=>String(r[map.store]??'').trim()).filter(Boolean))];
    if(stores.length>1&&!store)throw Error('El archivo incluye varias tiendas. Selecciona una tienda antes de aplicarlo.');
    const products=new Map();let repeated=0;
    for(let i=0;i<rows.length;i++){
      const r=rows[i];if(!r.some(v=>String(v??'').trim()))continue;
      if(store&&map.store>=0&&String(r[map.store]??'').trim()!==store)continue;
      const code=String(r[map.code]??'').trim(),name=String(r[map.name]??'').trim(),price=cents(r[map.price]);
      if(!code||!name||price===null)throw Error('Fila '+(i+2)+': código, descripción o precio no válido. Corrige el archivo antes de aplicarlo.');
      if(/[eE][+-]?\d+$/.test(code)&&/^\d/.test(code))throw Error('Código en notación científica en la fila '+(i+2)+'. Expórtalo como texto.');
      const p={code,name,cents:price,category:map.category<0?'':String(r[map.category]??'').trim()};
      const old=products.get(code);if(old){if(old.cents!==price||old.name!==name)throw Error('El código '+code+' tiene valores diferentes. Filtra la tienda o corrige el origen.');repeated++;}else products.set(code,p);
    }
    if(!products.size)throw Error('No hay productos válidos para esta selección.');
    return {products:[...products.values()],repeated,zero:[...products.values()].filter(p=>p.cents===0).length,store:store||stores[0]||''};
  }
  function total(items){const n=items.reduce((s,p)=>{if(!Number.isInteger(p.qty)||p.qty<1||p.qty>9999||!Number.isSafeInteger(p.cents)||p.cents<=0)throw Error('Cantidad o precio no válido.');return s+p.cents*p.qty;},0);if(!Number.isSafeInteger(n))throw Error('Total fuera de rango.');return n;}
  function payment(items,method,received,reference){const amount=total(items);if(!amount)throw Error('Agrega al menos un producto.');if(method!=='Efectivo'&&method!=='Tarjeta BAC')throw Error('Método no válido.');if(method==='Efectivo'&&(received===null||received<amount))throw Error('El monto recibido no cubre el total.');if(method!=='Efectivo'&&!String(reference||'').trim())throw Error('Ingresa la referencia de la autorización de tarjeta.');return {total:amount,received:method==='Efectivo'?received:amount,change:method==='Efectivo'?received-amount:0};}
  const csvCell=v=>'"'+String(v??'').replace(/^[\s]*[=+\-@]/,m=>"'"+m).replace(/"/g,'""')+'"';
  function exportCSV(headers,rows){return '\uFEFF'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');}
  return {norm,cents,csv,mapping,catalog,total,payment,exportCSV};
});
