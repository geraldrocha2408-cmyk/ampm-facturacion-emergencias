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
  const channels=['Tienda','PedidosYa','Uber Eats'];
  function isDelivery(channel='Tienda'){if(!channels.includes(channel))throw Error('Canal de venta no válido.');return channel!=='Tienda';}
  function unitPrice(price,channel='Tienda'){
    if(!Number.isSafeInteger(price)||price<0)throw Error('Precio no válido.');
    // Round once per unit so search, receipt and quantity multiplication agree.
    const scaled=isDelivery(channel)?price*110+50:price;
    if(!Number.isSafeInteger(scaled))throw Error('Precio fuera de rango.');
    return isDelivery(channel)?Math.floor(scaled/100):price;
  }
  function quote(items,channel='Tienda'){
    const delivery=isDelivery(channel),baseTotal=total(items);
    const amount=total(items.map(p=>({...p,cents:unitPrice(p.cents,channel)})));
    if(!Number.isSafeInteger(amount*13+56))throw Error('Total fuera de rango.');
    const vat=delivery?Math.floor((amount*13+56)/113):0;
    return {rule:delivery?'delivery-10-vat-included-v1':'pricec-v1',baseTotal,surcharge:amount-baseTotal,total:amount,net:amount-vat,vat,vatRate:delivery?13:0,markupRate:delivery?10:0};
  }
  const orderKey=v=>String(v??'').trim().toUpperCase();
  function deliveryData(channel,details){
    if(!isDelivery(channel))return null;
    const orderId=String(details?.orderId??'').trim(),rider=String(details?.rider??'').trim(),notes=String(details?.notes??'').trim(),packages=Number(details?.packages);
    if(!orderId||orderId.length>80||/[\x00-\x1f\x7f]/.test(orderId))throw Error('Ingresa el número de orden de la plataforma (máximo 80 caracteres).');
    if(rider.length>80||notes.length>200)throw Error('Revisa el nombre del rider o las observaciones.');
    if(!Number.isInteger(packages)||packages<1||packages>99)throw Error('Indica entre 1 y 99 bolsas o paquetes.');
    return {orderId,rider,packages,notes};
  }
  function assertUniqueOrder(sales,store,channel,details){
    if(isDelivery(channel)&&sales.some(v=>!v.void&&v.store===store&&v.channel===channel&&orderKey(v.delivery?.orderId)===orderKey(details.orderId)))throw Error('Esta orden ya está registrada en esta tienda y plataforma. Revisa el historial.');
  }
  function payment(items,method,received,reference,channel='Tienda'){
    const amount=quote(items,channel).total;if(!amount)throw Error('Agrega al menos un producto.');
    if(!['Efectivo','Tarjeta BAC','Plataforma delivery'].includes(method)||method==='Plataforma delivery'&&!isDelivery(channel))throw Error('Método no válido para este canal.');
    if(method==='Efectivo'&&(!Number.isSafeInteger(received)||received<amount))throw Error('El monto recibido no cubre el total.');
    if(method==='Tarjeta BAC'&&!String(reference||'').trim())throw Error('Ingresa la referencia de la autorización de tarjeta.');
    return {total:amount,received:method==='Plataforma delivery'?0:method==='Efectivo'?received:amount,change:method==='Efectivo'?received-amount:0};
  }
  const csvCell=v=>'"'+String(v??'').replace(/^[\s]*[=+\-@]/,m=>"'"+m).replace(/"/g,'""')+'"';
  function exportCSV(headers,rows){return '\uFEFF'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');}
  return {norm,cents,csv,mapping,catalog,total,payment,exportCSV,channels,isDelivery,unitPrice,quote,deliveryData,assertUniqueOrder};
});
