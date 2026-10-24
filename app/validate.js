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
    for(const v of d.sales){if(!id(v.id)||ids.has(v.id)||!id(v.sessionId)||!sessions.has(v.sessionId)||!timestamp(v.created)||v.currency!=='USD'||!str(v.folio)||!str(v.store)||!str(v.till)||!str(v.cashier)||!str(v.source)||!str(v.reference)||!Array.isArray(v.items))fail();ids.add(v.id);v.items.forEach(p=>product(p,true));const pay=C.payment(v.items,v.method,v.received,v.reference);if(pay.total!==v.total||pay.change!==v.change||pay.received!==v.received)fail();if(v.void&&(!str(v.void.reason)||!str(v.void.by)||!timestamp(v.void.at)))fail();if(v.posReference&&(!str(v.posReference.reference)||!str(v.posReference.by)||!timestamp(v.posReference.at)))fail();if(v.void&&v.posReference)fail();}
    if(d.active&&(!sessions.has(d.active)||sessions.get(d.active).closed))fail();
    d.draft.items.forEach(p=>product(p,true));C.total(d.draft.items);if(!['Efectivo','Tarjeta BAC'].includes(d.draft.method)||!str(d.draft.received)||!str(d.draft.reference))fail();
    return d;
  }
  return {validate};
});
