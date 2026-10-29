/* The same escaped ticket is used for preview and browser printing. */
(function(root,factory){if(typeof module==='object')module.exports=factory(require('./core.js'));else root.Receipt=factory(root.Core);})(globalThis,C=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+(n/100).toFixed(2);
  const date=v=>new Date(v).toLocaleString('es-SV',{timeZone:'America/El_Salvador',dateStyle:'short',timeStyle:'short'});
  function html(v,logo,{practice=false,signature=false}={}){
    const channel=v.channel||'Tienda',delivery=C.isDelivery(channel),p=v.pricing;
    return `<article class="thermal-ticket">
      <img class="ticket-logo" src="${esc(logo)}" alt="AMPM">
      ${practice?'<h2>PRÁCTICA · SIN VALOR</h2>':''}
      <h2>${delivery&&signature?'ENTREGA DE ORDEN DELIVERY':'COMPROBANTE DE CONTINGENCIA'}</h2>
      ${v.void?'<h2>ANULADO · NO ENTREGAR</h2><p>'+esc(v.void.reason)+'</p>':''}
      <p class="center"><b>Consecutivo: ${esc(v.folio)}</b></p><p>Fecha y hora: ${esc(date(v.created))}</p>
      <p><b>Sucursal: ${esc(v.store)}</b><br>Caja: ${esc(v.till)}<br>Responsable: ${esc(v.cashier)}</p>
      ${delivery?`<div class="ticket-order"><h2>${esc(channel)}</h2><p><b>ORDEN: ${esc(v.delivery.orderId)}</b></p></div>`:'<p>Venta en tienda</p>'}
      <table><thead><tr><th>PRODUCTOS / CANTIDAD</th><th class="right">USD</th></tr></thead><tbody>${v.items.map(item=>{const unit=C.unitPrice(item.cents,channel);return `<tr><td><b>${esc(item.name)}</b><br><small>${esc(item.code)}</small><br>${item.qty} × ${money(unit)}</td><td class="right">${money(unit*item.qty)}</td></tr>`;}).join('')}</tbody></table>
      <p>Unidades: ${v.items.reduce((n,item)=>n+item.qty,0)} · Productos: ${v.items.length}</p>
      ${delivery&&p?`<div class="ticket-totals"><p><span>Subtotal sin IVA</span><b>${money(p.net)}</b></p><p><span>IVA 13% incluido</span><b>${money(p.vat)}</b></p></div>`:''}
      <p class="print-total">TOTAL USD: ${money(v.total)}</p>
      <p><b>${esc(v.method)}</b>${v.method==='Plataforma delivery'?'<br>Cobro gestionado por la plataforma.<br>Sin ingreso de efectivo en esta caja.':`<br>Recibido: ${money(v.received)}<br>Cambio: ${money(v.change)}`}</p>
      ${v.reference?'<p>Autorización: '+esc(v.reference)+'</p>':''}
      ${delivery&&v.delivery.notes?'<p><b>Observaciones:</b> '+esc(v.delivery.notes)+'</p>':''}
      ${delivery&&signature&&!v.void?`<section class="ticket-signature"><h2>RECIBIDO POR EL RIDER</h2><p>Recibí los productos indicados de esta sucursal para entregar la orden.</p><p>Nombre: ${v.delivery.rider?esc(v.delivery.rider):'________________________'}</p><div class="signature-line">Firma del rider</div><p>Fecha: __________ Hora: __________</p><p>La tienda conserva esta copia firmada.</p></section>`:''}
      <p class="center ticket-footer">Comprobante de contingencia.<br>Pendiente de registro en el sistema de caja.<br>${delivery?'IVA incluido en los precios.':'Gracias por visitarnos.'}</p>
    </article>`;
  }
  return {html};
});
