/* Validation of user-imported backup files, independent from rendering. */
(function(root,factory){if(typeof module==='object')module.exports=factory(require('./core.js'));else root.Validate=factory(root.Core);})(globalThis,C=>{
  const fail=()=>{throw Error('El respaldo contiene datos incompletos o inconsistentes. No se aplicó ningún cambio.');};
  const str=(v,max=500)=>typeof v==='string'&&v.length<=max;
  const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v);
  const integer=v=>Number.isSafeInteger(v)&&v>=0;
  const timestamp=v=>str(v,40)&&Number.isFinite(Date.parse(v));
  function validate(d){
    if(!d||d.version!==2||!id(d.device)||!integer(d.seq)||d.seq<1||!Array.isArray(d.sales)||!Array.isArray(d.sessions)||!Array.isArray(d.catalog?.products)||!Array.isArray(d.audit)||!d.profile||!d.draft||!Array.isArray(d.draft.items))fail();
    if(!str(d.catalog.source)||d.catalog.syncedAt!==null&&!timestamp(d.catalog.syncedAt)||!str(d.catalog.store||''))fail();
    for(const k of ['store','till','cashier'])if(!str(d.profile[k]))fail();
    const sessions=new Map(),ids=new Set(),codes=new Set();
    for(const s of d.sessions){if(!id(s.id)||sessions.has(s.id)||!timestamp(s.opened)||!integer(s.opening)||!str(s.store)||!str(s.till)||!str(s.cashier)||!str(s.reason))fail();if(s.closed&&(!timestamp(s.closed)||!integer(s.expected)||!integer(s.counted)||s.difference!==s.counted-s.expected||!str(s.notes)))fail();sessions.set(s.id,s);}
    function product(p,selling=false){if(!p||!str(p.code,100)||!p.code||!str(p.name)||!p.name||!str(p.category)||!integer(p.cents))fail();if(selling&&(!Number.isInteger(p.qty)||p.qty<1||p.qty>9999||p.cents<1))fail();}
    for(const p of d.catalog.products){product(p);if(codes.has(p.code))fail();codes.add(p.code);}
    const orders=new Set();
    for(const v of d.sales){
      if(!id(v.id)||ids.has(v.id)||!id(v.sessionId)||!sessions.has(v.sessionId)||!timestamp(v.created)||v.currency!=='USD'||!str(v.folio)||!str(v.store)||!str(v.till)||!str(v.cashier)||!str(v.source)||!str(v.reference)||!Array.isArray(v.items))fail();
      ids.add(v.id);v.items.forEach(p=>product(p,true));const channel=v.channel??'Tienda',delivery=C.isDelivery(channel);
      if(delivery){
        if(!v.delivery||!str(v.delivery.orderId,80)||!str(v.delivery.rider,80)||!str(v.delivery.notes,200)||(v.delivery.packages!==undefined&&(!integer(v.delivery.packages)||v.delivery.packages<1||v.delivery.packages>99)))fail();
        C.deliveryData(channel,v.delivery);const expected=C.quote(v.items,channel);
        if(!v.pricing||Object.keys(expected).some(k=>v.pricing[k]!==expected[k]))fail();
        const key=JSON.stringify([v.store,channel,v.delivery.orderId.trim().toUpperCase()]);if(!v.void){if(orders.has(key))fail();orders.add(key);}
      }else if(v.delivery!=null||v.pricing&&Object.keys(C.quote(v.items)).some(k=>v.pricing[k]!==C.quote(v.items)[k]))fail();
      const pay=C.payment(v.items,v.method,v.received,v.reference,channel);if(pay.total!==v.total||pay.change!==v.change||pay.received!==v.received)fail();
      if(v.void&&(!str(v.void.reason)||!str(v.void.by)||!timestamp(v.void.at)))fail();if(v.posReference&&(!str(v.posReference.reference)||!str(v.posReference.by)||!timestamp(v.posReference.at)))fail();if(v.void&&v.posReference)fail();
    }
    if(d.active&&(!sessions.has(d.active)||sessions.get(d.active).closed))fail();
    d.draft.items.forEach(p=>product(p,true));C.quote(d.draft.items,d.draft.channel??'Tienda');if(!['Efectivo','Tarjeta BAC','Plataforma delivery'].includes(d.draft.method)||!str(d.draft.received)||!str(d.draft.reference))fail();
    if(d.draft.method==='Plataforma delivery'&&!C.isDelivery(d.draft.channel??'Tienda'))fail();
    if(d.draft.delivery&&(!str(d.draft.delivery.orderId,80)||!str(d.draft.delivery.rider,80)||!str(d.draft.delivery.notes,200)||(d.draft.delivery.packages!==undefined&&!str(String(d.draft.delivery.packages),3))))fail();
    return d;
  }
  return {validate};
});
