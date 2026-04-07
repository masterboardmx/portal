async function loadOrdenes(){const{data}=await sb.from('ordenes').select('*,clientes(nombre,telefono)').order('fecha_ingreso',{ascending:false});allOrdenes=data||[];}

async function cambiarEstado(id,estado,sel){
  const o=allOrdenes.find(x=>x.id===id);
  const estadoAnterior=o?.estado;
  const{error}=await sb.from('ordenes').update({estado,modificado_por:currentUser}).eq('id',id);
  if(error){
    console.error('cambiarEstado error:',error);
    notif('Error al guardar: '+error.message,'error');
    // Revertir select visualmente
    if(sel&&estadoAnterior)sel.value=estadoAnterior;
    return;
  }
  if(o)o.estado=estado;
  if(sel){sel.className='estado-select '+estado;}
  registrarAuditoria('ordenes',id,'estado',`Cambio estado orden #${o?.folio} a: ${estadoLabel(estado)}`,{de:estadoAnterior,a:estado});
  notif('Estado: '+estadoLabel(estado),'success');
}

// ── ORDENES ──────────────────────────────────────────────────
function renderOrdenes(data){
  const list=data||allOrdenes;
  // Desktop table
  document.getElementById('tabla-ordenes').innerHTML=list.length?list.map(o=>{
    const tipoLabel={convencional:'🌀 Conv.',inverter:'❄️ Inv.'};
    const comisionPendiente=o.tipo_equipo&&(o.tipo_equipo==='convencional'||o.tipo_equipo==='inverter')&&!o.comision_pagada;
    return`<tr>
      <td>
        <span style="font-family:var(--mono);color:var(--blue);font-size:0.8rem;">#${o.folio}</span>
        ${o.visita_id?'<span style="display:block;font-size:0.62rem;background:rgba(10,132,255,0.15);color:var(--blue);border-radius:4px;padding:0.05rem 0.3rem;margin-top:0.2rem;">📅 visita</span>':''}
        ${o.tipo_equipo?`<span style="display:block;font-size:0.62rem;background:rgba(255,255,255,0.07);color:var(--text-dim);border-radius:4px;padding:0.05rem 0.3rem;margin-top:0.1rem;">${tipoLabel[o.tipo_equipo]||o.tipo_equipo}</span>`:''}
      </td>
      <td><div style="font-weight:500;">${o.clientes?.nombre||'?'}</div><div style="font-size:0.75rem;color:var(--text-dim);">${o.clientes?.telefono||''}</div></td>
      <td><div>${o.marca}</div><div style="font-size:0.75rem;color:var(--text-dim);">${o.modelo||''}</div></td>
      <td style="max-width:140px;"><div style="font-size:0.8rem;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${o.falla_reportada}</div></td>
      <td><select class="estado-select ${o.estado}" onchange="cambiarEstado('${o.id}',this.value,this)" onclick="event.stopPropagation()">
        <option value="recibido"${o.estado==='recibido'?' selected':''}>Recibido</option>
        <option value="diagnostico"${o.estado==='diagnostico'?' selected':''}>Diagnostico</option>
        <option value="reparacion"${o.estado==='reparacion'?' selected':''}>Reparacion</option>
        <option value="cotizacion"${o.estado==='cotizacion'?' selected':''}>Cotización enviada</option>
        <option value="listo"${o.estado==='listo'?' selected':''}>Listo</option>
        <option value="entregado"${o.estado==='entregado'?' selected':''}>Entregado</option>
      </select></td>
      <td style="color:var(--text-dim);font-size:0.82rem;">${o.tecnico||'?'}</td>
      <td>${o.modificado_por?userPill(o.modificado_por):'<span style="color:var(--text-dim);font-size:0.75rem;">?</span>'}</td>
      <td style="color:var(--text-dim);font-size:0.78rem;">${fmtFecha(o.fecha_ingreso)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:3px;">
          <input type="file" id="oc-${o.id}" accept="image/*" capture="environment" style="display:none;" onchange="sfo(this,'${o.id}')">
          <input type="file" id="og-${o.id}" accept="image/*" multiple style="display:none;" onchange="sfo(this,'${o.id}')">
          <button class="btn-ghost btn-sm" onclick="document.getElementById('oc-'+'${o.id}').click()" title="Cámara" style="padding:0.3rem 0.5rem;">📷</button>
          <button class="btn-ghost btn-sm" onclick="document.getElementById('og-'+'${o.id}').click()" title="Galería" style="padding:0.3rem 0.5rem;">🖼</button>
          <div id="of-${o.id}" style="display:flex;gap:2px;overflow-x:auto;max-width:90px;-webkit-overflow-scrolling:touch;"></div>
        </div>
      </td>
      <td><div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
        <button class="btn-ghost btn-sm" onclick="verDetalle('${o.id}')">Ver</button>
        <button class="btn-ghost btn-sm" onclick="editarOrden('${o.id}')">Editar</button>
        <button class="btn-ghost btn-sm" onclick="registrarAnticipo('${o.id}')" title="Registrar anticipo">💵 Anticipo${o.anticipo?` <span style='color:var(--green);'>$${Number(o.anticipo).toLocaleString('es-MX')}</span>`:''}
        </button>
        ${comisionPendiente?`<button class="btn-green btn-sm" onclick="registrarComision('${o.id}')" title="Registrar pago a Chitara">💰 Comisión</button>`:''}
        ${o.comision_pagada?'<span style="font-size:0.65rem;color:var(--green);padding:0.2rem 0.3rem;">✓ com.</span>':''}
        <button class="btn-red btn-sm" onclick="eliminarOrden('${o.id}')">X</button>
      </div></td>
    </tr>`;}).join(''):`<tr class="empty-row"><td colspan="10">No hay ordenes</td></tr>`;
  setTimeout(function(){ list.forEach(function(o){ cfo(o.id); }); }, 30);
  // Mobile cards
  const mob=document.getElementById('mobile-ordenes');
  const tipoLabelM={convencional:'🌀 Convencional',inverter:'❄️ Inverter'};
  mob.innerHTML=list.length?list.map(o=>{
    const comisionPendienteM=o.tipo_equipo&&(o.tipo_equipo==='convencional'||o.tipo_equipo==='inverter')&&!o.comision_pagada;
    return`<div class="m-card" onclick="verDetalle('${o.id}')">
      <div class="m-card-top">
        <span class="m-card-folio">#${o.folio}${o.visita_id?' <span style="font-size:0.62rem;background:rgba(10,132,255,0.15);color:var(--blue);border-radius:4px;padding:0.05rem 0.3rem;">📅 visita</span>':''}</span>
        ${badgeEstado(o.estado)}
      </div>
      <div class="m-card-name">${o.clientes?.nombre||'?'}</div>
      <a href="https://wa.me/52${(o.clientes?.telefono||'').replace(/\D/g,'')}" target="_blank" onclick="event.stopPropagation()" class="m-card-phone">${o.clientes?.telefono||''}</a>
      <div class="m-card-equipo">${o.marca} ${o.modelo||''} ${o.tecnico?'· '+o.tecnico:''}${o.tipo_equipo?` · <span style="color:var(--text-dim);">${tipoLabelM[o.tipo_equipo]||o.tipo_equipo}</span>`:''}</div>
      <div class="m-card-bottom">
        <span style="font-size:0.75rem;color:var(--text-dim);">${fmtFecha(o.fecha_ingreso)}</span>
        ${o.modificado_por?userPill(o.modificado_por):''}
        ${o.comision_pagada?'<span style="font-size:0.65rem;color:var(--green);">✓ comisión</span>':''}
      </div>
      <div class="m-card-actions" onclick="event.stopPropagation()">
        <button class="btn-ghost" onclick="verDetalle('${o.id}')">Ver detalle</button>
        <button class="btn-ghost" onclick="editarOrden('${o.id}')">Editar</button>
        <button class="btn-ghost" onclick="registrarAnticipo('${o.id}')">💵 Anticipo${o.anticipo?` $${Number(o.anticipo).toLocaleString('es-MX')}`:''}
        </button>
        ${comisionPendienteM?`<button class="btn-green" onclick="registrarComision('${o.id}')">💰 Comisión</button>`:''}
        <button class="btn-red btn-sm" onclick="eliminarOrden('${o.id}')">✕</button>
      </div>
    </div>`;}).join(''):'<div style="text-align:center;color:var(--text-dim);padding:3rem;font-size:0.85rem;">No hay ordenes</div>';
}

function filterOrdenes(){
  const q=document.getElementById('search-ordenes').value.toLowerCase();
  const est=document.getElementById('filter-estado').value;
  let list=allOrdenes;
  if(q)list=list.filter(o=>(o.clientes?.nombre||'').toLowerCase().includes(q)||String(o.folio).includes(q)||(o.marca||'').toLowerCase().includes(q));
  if(est)list=list.filter(o=>o.estado===est);
  renderOrdenes(list);
}

async function openNuevaOrden(prefill){
  editingOrdenId=null;
  document.getElementById('modal-orden-title').textContent='Nueva Orden';
  document.getElementById('btn-guardar-orden').textContent='Guardar';
  ['o-marca','o-modelo','o-serie','o-falla','o-diagnostico','o-notas'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('o-tecnico').value='Alonso';
  document.getElementById('o-costo-est').value='';
  document.getElementById('o-estado').value='recibido';
  document.getElementById('o-iva').checked=false;
  document.getElementById('o-isr').checked=false;
  document.getElementById('resumen-impuestos').style.display='none';
  document.getElementById('items-container').innerHTML='';
  agregarItem();
  document.getElementById('o-cliente').value='';
  // Auto-folio: max actual + 1
  const maxLocal=allOrdenes.length?Math.max(...allOrdenes.map(o=>Number(o.folio)||0)):0;
  if(maxLocal>0){
    document.getElementById('o-folio').value=maxLocal+1;
  } else {
    const{data:fd}=await sb.from('ordenes').select('folio').order('folio',{ascending:false}).limit(1);
    document.getElementById('o-folio').value=fd&&fd[0]?.folio?fd[0].folio+1:254;
  }
  document.getElementById('o-tipo-equipo').value='';
  document.getElementById('o-visita-id').value='';
  // Pre-llenado opcional (desde visita)
  if(prefill){
    if(prefill.cliente_id) document.getElementById('o-cliente').value=prefill.cliente_id;
    if(prefill.tecnico) document.getElementById('o-tecnico').value=prefill.tecnico;
    if(prefill.falla) document.getElementById('o-falla').value=prefill.falla;
    if(prefill.notas) document.getElementById('o-notas').value=prefill.notas;
    if(prefill.visita_id) document.getElementById('o-visita-id').value=prefill.visita_id;
  }
  document.getElementById('modal-orden').classList.add('open');
}

function editarOrden(id){
  const o=allOrdenes.find(x=>x.id===id);if(!o)return;
  editingOrdenId=id;
  document.getElementById('modal-orden-title').textContent='Editar Orden';
  document.getElementById('btn-guardar-orden').textContent='Actualizar';
  document.getElementById('o-cliente').value=o.cliente_id||'';
  document.getElementById('o-folio').value=o.folio||'';
  document.getElementById('o-marca').value=o.marca||'';
  document.getElementById('o-modelo').value=o.modelo||'';
  document.getElementById('o-serie').value=o.numero_serie||'';
  document.getElementById('o-tecnico').value=o.tecnico||'';
  document.getElementById('o-falla').value=o.falla_reportada||'';
  document.getElementById('o-diagnostico').value=o.diagnostico||'';
  document.getElementById('o-estado').value=o.estado||'recibido';
  document.getElementById('o-notas').value=o.notas||'';
  document.getElementById('o-iva').checked=o.aplica_iva||false;
  document.getElementById('o-isr').checked=o.aplica_isr||false;
  document.getElementById('o-tipo-equipo').value=o.tipo_equipo||'';
  document.getElementById('o-visita-id').value=o.visita_id||'';
  // anticipo es solo informativo al editar, no se modifica aquí
  // Load items
  document.getElementById('items-container').innerHTML='';
  const items=o.items||[];
  if(items.length){items.forEach(it=>agregarItem(it.descripcion,it.cantidad,it.precio));}
  else{agregarItem();}
  recalcularCosto();
  document.getElementById('modal-orden').classList.add('open');
}

async function guardarOrden(){
  const cliente_id=document.getElementById('o-cliente').value;
  const marca=document.getElementById('o-marca').value.trim();
  const falla=document.getElementById('o-falla').value.trim();
  if(!cliente_id||!marca||!falla){notif('Completa cliente, marca y falla','error');return;}
  const items=getItems();
  const subtotal=items.reduce((a,i)=>a+i.cantidad*i.precio,0);
  const iva=document.getElementById('o-iva').checked;
  const isr=document.getElementById('o-isr').checked;
  const ivaAmt=iva?subtotal*0.16:0;
  const isrAmt=isr?subtotal*0.0125:0;
  const total=subtotal+ivaAmt-isrAmt;
  const tipoEquipo=document.getElementById('o-tipo-equipo').value||null;
  const visitaId=document.getElementById('o-visita-id').value||null;
  const data={cliente_id,marca,modelo:document.getElementById('o-modelo').value.trim(),numero_serie:document.getElementById('o-serie').value.trim(),tecnico:document.getElementById('o-tecnico').value.trim(),falla_reportada:falla,diagnostico:document.getElementById('o-diagnostico').value.trim(),costo_estimado:total||null,estado:document.getElementById('o-estado').value,notas:document.getElementById('o-notas').value.trim(),updated_at:new Date().toISOString(),modificado_por:currentUser,aplica_iva:iva,aplica_isr:isr,items:items,tipo_equipo:tipoEquipo,visita_id:visitaId};
  const folioManual=parseInt(document.getElementById('o-folio').value);
  if(folioManual) data.folio=folioManual;
  let err,rid;
  if(editingOrdenId){
    const old=allOrdenes.find(x=>x.id===editingOrdenId);
    ({error:err}=await sb.from('ordenes').update(data).eq('id',editingOrdenId));
    rid=editingOrdenId;
    await registrarAuditoria('ordenes',rid,'editar',`Edito orden #${old?.folio} - ${marca}`,{estado_anterior:old?.estado,estado_nuevo:data.estado});
  }else{
    const{data:d,error:e}=await sb.from('ordenes').insert([data]).select();
    err=e;rid=d?.[0]?.id;
    await registrarAuditoria('ordenes',rid,'crear',`Creo orden: ${marca} ${data.modelo||''} - ${falla.substring(0,60)}`);
  }
  if(err){notif('Error: '+err.message,'error');return;}
  closeModal('modal-orden');
  notif(editingOrdenId?'Orden actualizada':'Orden creada','success');
  await loadOrdenes();renderOrdenes();loadDashboard();
}

async function eliminarOrden(id){
  const o=allOrdenes.find(x=>x.id===id);
  if(!confirm('Eliminar orden #'+o?.folio+'?'))return;
  const{error}=await sb.from('ordenes').delete().eq('id',id);
  if(error){notif('Error al eliminar','error');return;}
  await registrarAuditoria('ordenes',id,'eliminar',`Elimino orden #${o?.folio} - ${o?.marca} ${o?.modelo||''}`);
  notif('Orden eliminada','success');
  await loadOrdenes();renderOrdenes();loadDashboard();
}

// Tarifas de comisión por tipo de equipo
const COMISIONES_TECNICO={convencional:400,inverter:650};
let _comisionOrdenId=null, _anticipoOrdenId=null;

function registrarComision(ordenId){
  const o=allOrdenes.find(x=>x.id===ordenId);
  if(!o||!o.tipo_equipo)return;
  const monto=COMISIONES_TECNICO[o.tipo_equipo];
  if(!monto){notif('Tipo de equipo sin tarifa definida','error');return;}
  _comisionOrdenId=ordenId;
  const tipoLabel={convencional:'Convencional',inverter:'Inverter'};
  document.getElementById('comision-detalle').innerHTML=
    `<div style="font-weight:600;margin-bottom:0.4rem;">#${o.folio} · ${o.marca} ${o.modelo||''}</div>`+
    `<div>Técnico: <strong>${o.tecnico||'?'}</strong></div>`+
    `<div>Tipo: ${tipoLabel[o.tipo_equipo]} · tarifa base $${monto.toLocaleString('es-MX')}</div>`;
  document.getElementById('comision-monto').value=monto;
  document.getElementById('comision-metodo').value='efectivo';
  document.getElementById('modal-comision').classList.add('open');
}

async function confirmarComision(){
  const o=allOrdenes.find(x=>x.id===_comisionOrdenId);
  if(!o)return;
  const monto=parseFloat(document.getElementById('comision-monto').value);
  if(!monto||monto<=0){notif('Ingresa un monto válido','error');return;}
  const metodo=document.getElementById('comision-metodo').value;
  const gasto={tipo:'gasto',categoria:'Comisiones',descripcion:`Comisión ${o.tecnico||'técnico'} — #${o.folio} ${o.marca} ${o.modelo||''} (${o.tipo_equipo})`.trim(),monto,fecha:new Date().toISOString().split('T')[0],metodo_pago:metodo,notas:`Pago por OT #${o.folio}`,registrado_por:currentUser};
  const{error:e1}=await sb.from('contabilidad').insert([gasto]);
  if(e1){notif('Error: '+e1.message,'error');return;}
  const{error:e2}=await sb.from('ordenes').update({comision_pagada:true}).eq('id',_comisionOrdenId);
  if(e2){notif('Error: '+e2.message,'error');return;}
  closeModal('modal-comision');
  notif(`✓ Comisión $${monto} registrada`,'success');
  await loadOrdenes();renderOrdenes();
}

function registrarAnticipo(ordenId){
  const o=allOrdenes.find(x=>x.id===ordenId);
  if(!o)return;
  _anticipoOrdenId=ordenId;
  document.getElementById('anticipo-detalle').textContent=`#${o.folio} · ${o.clientes?.nombre||'?'} · ${o.marca}`;
  document.getElementById('anticipo-monto').value=200;
  document.getElementById('anticipo-metodo').value='efectivo';
  document.getElementById('modal-anticipo').classList.add('open');
}

async function confirmarAnticipo(){
  const o=allOrdenes.find(x=>x.id===_anticipoOrdenId);
  if(!o)return;
  const monto=parseFloat(document.getElementById('anticipo-monto').value);
  if(!monto||monto<=0){notif('Ingresa un monto válido','error');return;}
  const metodo=document.getElementById('anticipo-metodo').value;
  const ingreso={tipo:'ingreso',categoria:'Anticipo',descripcion:`Anticipo — #${o.folio} ${o.clientes?.nombre||''} ${o.marca}`.trim(),monto,fecha:new Date().toISOString().split('T')[0],metodo_pago:metodo,orden_id:o.id,notas:`Anticipo OT #${o.folio}`,registrado_por:currentUser};
  const{error:e1}=await sb.from('contabilidad').insert([ingreso]);
  if(e1){notif('Error: '+e1.message,'error');return;}
  const nuevoAnticipo=(Number(o.anticipo)||0)+monto;
  const{error:e2}=await sb.from('ordenes').update({anticipo:nuevoAnticipo}).eq('id',_anticipoOrdenId);
  if(e2){notif('Error al actualizar orden: '+e2.message,'error');return;}
  closeModal('modal-anticipo');
  notif(`✓ Anticipo $${monto.toLocaleString('es-MX')} registrado`,'success');
  await loadOrdenes();renderOrdenes();
}

async function verDetalle(id){
  const o=allOrdenes.find(x=>x.id===id);if(!o)return;
  showPage('detalle');
  document.getElementById('detalle-content').innerHTML=`
    <div class="detail-header">
      <div>
        <div class="detail-folio">Orden #${o.folio} - ${fmtFecha(o.fecha_ingreso)}</div>
        <div class="detail-name">${o.clientes?.nombre||'Cliente'}</div>
        <div style="color:var(--text-dim);font-size:0.85rem;margin-top:0.25rem;">${o.clientes?.telefono||''}</div>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
        ${o.modificado_por?`<div style="font-size:0.75rem;color:var(--text-dim);">Editado por: ${userPill(o.modificado_por)}</div>`:''}
        <button class="btn-ghost btn-sm" onclick="generarCotizacion('${o.id}')">📄 Cotización</button>
        <button class="btn-ghost btn-sm" onclick="editarOrden('${o.id}')">Editar</button>
      </div>
    </div>
    <div style="margin-bottom:1.25rem;">
      <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.5rem;font-family:var(--mono);text-transform:uppercase;letter-spacing:0.08em;">Cambiar Estado</div>
      <div class="estado-buttons">${['recibido','diagnostico','reparacion','cotizacion','listo','entregado'].map(e=>`<button class="estado-btn ${o.estado===e?'active-'+e:''}" onclick="cambiarEstado('${o.id}','${e}',null).then(()=>verDetalle('${o.id}'))">${estadoLabel(e)}</button>`).join('')}</div>
    </div>
    <div class="detail-grid">
      <div class="detail-card"><div class="detail-card-label">Marca</div><div class="detail-card-value">${o.marca}</div></div>
      <div class="detail-card"><div class="detail-card-label">Modelo</div><div class="detail-card-value">${o.modelo||'?'}</div></div>
      <div class="detail-card"><div class="detail-card-label">No. Serie</div><div class="detail-card-value">${o.numero_serie||'?'}</div></div>
      <div class="detail-card"><div class="detail-card-label">Tecnico</div><div class="detail-card-value">${o.tecnico||'?'}</div></div>
      <div class="detail-card" style="grid-column:1/-1"><div class="detail-card-label">Falla Reportada</div><div class="detail-card-value">${o.falla_reportada}</div></div>
      <div class="detail-card" style="grid-column:1/-1"><div class="detail-card-label">Diagnostico</div><div class="detail-card-value">${o.diagnostico||'Pendiente'}</div></div>
      <div class="detail-card"><div class="detail-card-label">Costo Estimado</div><div class="detail-card-value">${o.costo_estimado?'$'+Number(o.costo_estimado).toLocaleString('es-MX'):'?'}</div></div>
      <div class="detail-card"><div class="detail-card-label">Costo Final</div><div class="detail-card-value">${o.costo_final?'$'+Number(o.costo_final).toLocaleString('es-MX'):'?'}</div></div>
      ${o.notas?`<div class="detail-card" style="grid-column:1/-1"><div class="detail-card-label">Notas</div><div class="detail-card-value">${o.notas}</div></div>`:''}
    </div>
    <!-- FOTOS -->
    <div style="margin-top:1.5rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.75rem;">
        <div style="font-family:var(--mono);font-size:0.85rem;font-weight:700;">Fotos de la Orden</div>
        <div style="display:flex;gap:0.5rem;">
          <input type="file" id="foto-input" accept="image/*" multiple style="display:none;" onchange="subirFotos('${o.id}', this)">
          <button class="btn-ghost btn-sm" onclick="document.getElementById('foto-input').click()">📁 Subir</button>
          <button class="btn-ghost btn-sm" onclick="tomarFoto('${o.id}')">📷 Tomar Foto</button>
          <input type="file" id="camara-input" accept="image/*" capture="environment" style="display:none;" onchange="subirFotos('${o.id}', this)">
        </div>
      </div>
      <div style="margin-bottom:0.75rem;">
        <select id="foto-tipo" style="width:200px;">
          <option value="antes">📥 Al recibir (antes)</option>
          <option value="despues">📤 Reparación terminada (después)</option>
          <option value="danio">🔍 Componente dañado</option>
        </select>
      </div>
      <div id="fotos-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.75rem;">
        <div style="text-align:center;color:var(--text-dim);font-size:0.82rem;padding:2rem;grid-column:1/-1;">Cargando fotos...</div>
      </div>
    </div>`;
  cargarFotos(id);
}

// ── FOTOS ─────────────────────────────────────────────────────
async function comprimirImagen(file, maxW=1200, quality=0.75){
  return new Promise(resolve=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      let w=img.width,h=img.height;
      if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      canvas.toBlob(blob=>resolve(blob),'image/jpeg',quality);
      URL.revokeObjectURL(url);
    };
    img.src=url;
  });
}

function tomarFoto(ordenId){
  document.getElementById('camara-input').click();
}

async function sfo(input,oid){
  var files=Array.from(input.files);
  if(!files.length)return;
  notif("Subiendo "+files.length+" foto(s)...","");
  var ok=0;
  for(var i=0;i<files.length;i++){
    try{
      var comp=await comprimirImagen(files[i]);
      var nom=oid+"/foto_"+Date.now()+".jpg";
      var res=await sb.storage.from("reparaciones").upload(nom,comp,{contentType:"image/jpeg",upsert:false});
      if(!res.error)ok++;
    }catch(e){}
  }
  input.value="";
  notif(ok+" foto(s) subida(s)","success");
  cfo(oid);
}

async function cfo(oid){
  var el=document.getElementById("of-"+oid);
  if(!el)return;
  var res=await sb.storage.from("reparaciones").list(oid,{sortBy:{column:"created_at",order:"desc"}});
  if(res.error||!res.data||!res.data.length){el.innerHTML="";return;}
  var html="";
  for(var i=0;i<res.data.length;i++){
    var url="https://qsjscxnlbxwvhgzjjvuh.supabase.co/storage/v1/object/public/reparaciones/"+oid+"/"+res.data[i].name;
    var nom=res.data[i].name;
    html+='<img src="'+url+'" style="width:32px;height:32px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--border);flex-shrink:0;scroll-snap-align:start;" onclick="verFotoOrden(\''+url+'\',\''+oid+'\',\''+nom+'\')" loading="lazy">';
  }
  el.innerHTML=html;
}

function verFotoOrden(url,oid,nom){
  var ov=document.createElement("div");
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;";
  ov.innerHTML='<img src="'+url+'" style="max-width:100%;max-height:80vh;border-radius:10px;object-fit:contain;">'
    +'<div style="display:flex;gap:1rem;margin-top:1.25rem;">'
    +'<button onclick="window.open(\''+url+'\',\'_blank\')" style="background:rgba(255,255,255,0.12);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:0.6rem 1.2rem;cursor:pointer;font-size:0.9rem;">🔍 Ver completa</button>'
    +'<button onclick="bfo(\''+oid+'\',\''+nom+'\',this.closest(\'div\').parentNode)" style="background:rgba(255,69,58,0.2);color:#FF453A;border:1px solid rgba(255,69,58,0.3);border-radius:8px;padding:0.6rem 1.2rem;cursor:pointer;font-size:0.9rem;">🗑 Borrar</button>'
    +'<button onclick="this.closest(\'[style*=position]\').remove()" style="background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:0.6rem 1.2rem;cursor:pointer;font-size:0.9rem;">✕ Cerrar</button>'
    +'</div>';
  ov.addEventListener("click",function(e){if(e.target===ov)ov.remove();});
  document.body.appendChild(ov);
}

async function bfo(oid,nom,ov){
  if(!confirm("¿Borrar esta foto?"))return;
  var r=await sb.storage.from("reparaciones").remove([oid+"/"+nom]);
  if(r.error){notif("Error al borrar","error");return;}
  notif("Foto borrada","success");
  if(ov)ov.remove();
  cfo(oid);
}

async function subirFotos(ordenId, input){
  const files=Array.from(input.files);
  if(!files.length)return;
  const tipo=document.getElementById('foto-tipo')?.value||'antes';
  const tipoLabel={antes:'Antes',despues:'Después',danio:'Daño'};
  notif(`Subiendo ${files.length} foto(s)...`,'');
  let ok=0;
  for(const file of files){
    try{
      const compressed=await comprimirImagen(file);
      const ext='jpg';
      const nombre=`${ordenId}/${tipo}_${Date.now()}.${ext}`;
      const{error}=await sb.storage.from('reparaciones').upload(nombre,compressed,{contentType:'image/jpeg',upsert:false});
      if(!error)ok++;
    }catch(e){console.error(e);}
  }
  input.value='';
  notif(`✓ ${ok} foto(s) subida(s)`,'success');
  cargarFotos(ordenId);
}

async function cargarFotos(ordenId){
  const grid=document.getElementById('fotos-grid');
  if(!grid)return;
  const{data,error}=await sb.storage.from('reparaciones').list(ordenId,{sortBy:{column:'created_at',order:'desc'}});
  if(error||!data||!data.length){
    grid.innerHTML='<div style="text-align:center;color:var(--text-dim);font-size:0.82rem;padding:2rem;grid-column:1/-1;">Sin fotos aún — sube o toma una foto</div>';
    return;
  }
  const tipoIcon={antes:'📥',despues:'📤',danio:'🔍'};
  grid.innerHTML=data.map(f=>{
    const url=`https://qsjscxnlbxwvhgzjjvuh.supabase.co/storage/v1/object/public/reparaciones/${ordenId}/${f.name}`;
    const tipo=f.name.split('_')[0];
    const label=tipoIcon[tipo]||'📷';
    return`<div style="position:relative;border-radius:10px;overflow:hidden;background:var(--bg3);border:1px solid var(--border);">
      <img src="${url}" style="width:100%;height:130px;object-fit:cover;display:block;cursor:pointer;" onclick="verFotoGrande('${url}')" loading="lazy">
      <div style="padding:0.4rem 0.6rem;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:0.72rem;color:var(--text-dim);">${label} ${tipo}</span>
        <button onclick="eliminarFoto('${ordenId}','${f.name}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:0.9rem;padding:0;">✕</button>
      </div>
    </div>`;
  }).join('');
}

function verFotoGrande(url){
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  overlay.innerHTML=`<img src="${url}" style="max-width:95vw;max-height:90vh;border-radius:8px;object-fit:contain;">
    <button style="position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.15);border:none;color:white;font-size:1.5rem;width:40px;height:40px;border-radius:50%;cursor:pointer;">✕</button>`;
  overlay.onclick=()=>document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}

async function eliminarFoto(ordenId, nombre){
  if(!confirm('¿Eliminar esta foto?'))return;
  const{error}=await sb.storage.from('reparaciones').remove([`${ordenId}/${nombre}`]);
  if(error){notif('Error al eliminar','error');return;}
  notif('Foto eliminada','success');
  cargarFotos(ordenId);
}

// ── COTIZACIÓN PDF ────────────────────────────────────────────

// ── ITEMS Y CALCULOS ─────────────────────────────────────────
function agregarItem(desc,cant,precio){
  desc=desc||'';cant=cant||1;precio=precio||0;
  const c=document.getElementById('items-container');
  const div=document.createElement('div');
  div.style.cssText='display:grid;grid-template-columns:1fr 60px 100px 32px;gap:0.5rem;margin-bottom:0.5rem;align-items:center;';
  div.innerHTML=`
    <input type="text" placeholder="Descripción" value="${desc}" oninput="recalcularCosto()" style="font-size:0.82rem;padding:0.5rem 0.7rem;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%;">
    <input type="number" placeholder="Cant" value="${cant}" min="1" oninput="recalcularCosto()" style="font-size:0.82rem;padding:0.5rem 0.4rem;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%;text-align:center;">
    <input type="number" placeholder="Precio" value="${precio||''}" min="0" step="0.01" oninput="recalcularCosto()" style="font-size:0.82rem;padding:0.5rem 0.5rem;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%;">
    <button onclick="this.parentElement.remove();recalcularCosto()" style="background:rgba(255,69,58,0.15);color:var(--red);border:1px solid rgba(255,69,58,0.3);border-radius:6px;padding:0.4rem;cursor:pointer;font-size:0.85rem;width:32px;">✕</button>`;
  c.appendChild(div);
}

function getItems(){
  const rows=document.getElementById('items-container').children;
  const items=[];
  for(const row of rows){
    const inputs=row.querySelectorAll('input');
    const desc=inputs[0].value.trim();
    const cant=parseInt(inputs[1].value)||1;
    const precio=parseFloat(inputs[2].value)||0;
    if(desc||precio)items.push({descripcion:desc,cantidad:cant,precio});
  }
  return items;
}

function recalcularCosto(){
  const items=getItems();
  const subtotal=items.reduce((a,i)=>a+i.cantidad*i.precio,0);
  const iva=document.getElementById('o-iva')?.checked;
  const isr=document.getElementById('o-isr')?.checked;
  const ivaAmt=iva?subtotal*0.16:0;
  const isrAmt=isr?subtotal*0.0125:0;
  const total=subtotal+ivaAmt-isrAmt;
  document.getElementById('o-costo-est').value=total?total.toFixed(2):'';
  const res=document.getElementById('resumen-impuestos');
  if(subtotal>0&&(iva||isr)){
    res.style.display='block';
    document.getElementById('r-subtotal').textContent='$'+subtotal.toLocaleString('es-MX',{minimumFractionDigits:2});
    document.getElementById('r-iva-row').style.display=iva?'flex':'none';
    document.getElementById('r-iva').textContent='$'+ivaAmt.toLocaleString('es-MX',{minimumFractionDigits:2});
    document.getElementById('r-isr-row').style.display=isr?'flex':'none';
    document.getElementById('r-isr').textContent='$'+isrAmt.toLocaleString('es-MX',{minimumFractionDigits:2});
    document.getElementById('r-total').textContent='$'+total.toLocaleString('es-MX',{minimumFractionDigits:2});
  } else { res.style.display='none'; }
}

function generarCotizacion(id){
  const o=allOrdenes.find(x=>x.id===id);if(!o)return;
  const cliente=o.clientes||{};
  const hoy=new Date();
  const fecha=String(hoy.getDate()).padStart(2,'0')+'/'+String(hoy.getMonth()+1).padStart(2,'0')+'/'+hoy.getFullYear();
  const items=o.items&&o.items.length?o.items:[{descripcion:(o.marca+' '+(o.modelo||'')).trim(),cantidad:1,precio:o.costo_estimado||0}];
  const iva=o.aplica_iva||false;
  const isr=o.aplica_isr||false;
  const subtotal=items.reduce((a,i)=>a+i.cantidad*i.precio,0);
  const ivaAmt=iva?subtotal*0.16:0;
  const isrAmt=isr?subtotal*0.0125:0;
  const total=subtotal+ivaAmt-isrAmt;
  const fmt=n=>'$'+Number(n).toLocaleString('es-MX',{minimumFractionDigits:2});
  const desc=o.diagnostico||o.falla_reportada||'Servicio de reparacion';
  const logoSrc='data:image/png;base64,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';
  const itemsRows=items.map(it=>'<tr><td>'+it.descripcion+'</td><td style="text-align:center">'+it.cantidad+'</td><td style="text-align:right">'+fmt(it.precio)+'</td><td style="text-align:right">'+fmt(it.cantidad*it.precio)+'</td></tr>').join('');
  const ivaRow=iva?'<tr><td colspan="2" style="border:1px solid #ddd;"></td><td style="text-align:right;font-weight:700;padding:8px 14px;border:1px solid #ddd;">IVA</td><td style="text-align:right;font-weight:700;padding:8px 14px;border:1px solid #ddd;">'+fmt(ivaAmt)+' MXN</td></tr>':'';
  const isrRow=isr?'<tr><td colspan="2" style="border:1px solid #ddd;"></td><td style="text-align:right;font-weight:700;padding:8px 14px;border:1px solid #ddd;">ISR</td><td style="text-align:right;font-weight:700;padding:8px 14px;border:1px solid #ddd;">'+fmt(isrAmt)+' MXN</td></tr>':'';

  const html='<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
    +'*{margin:0;padding:0;box-sizing:border-box;}'
    +'body{font-family:Arial,sans-serif;font-size:11pt;color:#111;background:white;}'
    +'.page{padding:30px 40px;max-width:820px;margin:0 auto;}'
    +'.header{display:flex;justify-content:space-between;align-items:flex-start;background:#1a2a4a;color:white;padding:20px 24px;}'
    +'.header-left{display:flex;align-items:center;gap:14px;}'
    +'.logo-img{width:64px;height:64px;border-radius:10px;}'
    +'.empresa-nombre{font-size:1.3rem;font-weight:900;letter-spacing:0.08em;color:white;}'
    +'.empresa-info{font-size:0.72rem;color:#ccd;margin-top:3px;line-height:1.7;}'
    +'.cot-titulo{font-size:1.8rem;font-weight:900;color:white;letter-spacing:0.05em;}'
    +'.cot-datos{margin-top:10px;display:grid;grid-template-columns:auto auto;gap:2px 16px;}'
    +'.lbl{font-size:0.72rem;font-weight:700;color:#aac;text-transform:uppercase;letter-spacing:0.08em;}'
    +'.val{font-size:0.82rem;color:white;font-weight:600;}'
    +'.desc-section{border:1px solid #ccc;border-top:none;padding:16px 24px;}'
    +'.desc-titulo{font-weight:700;font-size:0.9rem;margin-bottom:8px;text-transform:uppercase;}'
    +'.desc-texto{font-size:0.88rem;line-height:1.7;text-transform:uppercase;white-space:pre-line;}'
    +'.tabla{width:100%;border-collapse:collapse;}'
    +'.tabla th{background:#1a2a4a;color:white;padding:10px 14px;font-size:0.8rem;font-weight:700;text-transform:uppercase;}'
    +'.tabla td{padding:12px 14px;border:1px solid #ddd;font-size:0.88rem;vertical-align:middle;}'
    +'.total-row td{background:#1a2a4a;color:white;font-weight:900;font-size:0.95rem;padding:10px 14px;}'
    +'.terminos{margin-top:24px;border-top:2px solid #1a2a4a;padding-top:12px;}'
    +'.terminos-titulo{font-weight:700;font-size:0.85rem;color:#1a2a4a;margin-bottom:6px;text-transform:uppercase;}'
    +'.terminos-texto{font-size:0.78rem;color:#444;line-height:1.7;text-align:justify;}'
    +'@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.page{padding:15px 20px;}.no-print{display:none;}}'
    +'</style></head><body><div class="page">'
    +'<div class="no-print" style="margin-bottom:12px;text-align:right;"><button onclick="window.print()" style="background:#1a2a4a;color:white;border:none;padding:10px 22px;border-radius:6px;font-size:0.9rem;cursor:pointer;font-weight:700;">&#128424; Imprimir / Guardar PDF</button></div>'
    +'<div class="header"><div class="header-left">'
    +'<img src="'+logoSrc+'" class="logo-img">'
    +'<div><div class="empresa-nombre">MASTERBOARD</div>'
    +'<div class="empresa-info">CALLE DIVISIÓN DEL NORTE #1303<br>COL. FRANCISCO VILLA.<br>MAZATLÁN, SIN. CP.82127<br>Tel: 669-271-1522</div></div></div>'
    +'<div style="text-align:right"><div class="cot-titulo">COTIZACIÓN</div>'
    +'<div class="cot-datos"><span class="lbl">FECHA:</span><span class="val">'+fecha+'</span>'
    +'<span class="lbl">CLIENTE:</span><span class="val">'+(cliente.nombre||'').toUpperCase()+'</span>'
    +'<span class="lbl">TELÉFONO:</span><span class="val">'+(cliente.telefono||'')+'</span>'
    +'<span class="lbl">FOLIO:</span><span class="val">'+o.folio+'</span></div></div></div>'
    +'<div class="desc-section"><div class="desc-titulo">Descripción:</div><div class="desc-texto">'+desc+'</div></div>'
    +'<table class="tabla"><thead><tr><th>Producto</th><th style="text-align:center">Cantidad</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th></tr></thead>'
    +'<tbody>'+itemsRows+'<tr><td colspan="4" style="height:30px;border:1px solid #ddd;"></td></tr></tbody>'
    +'<tfoot>'
    +'<tr><td colspan="2" style="border:1px solid #ddd;height:20px;"></td><td colspan="2" style="border:1px solid #ddd;"></td></tr>'+'<tr><td colspan="2" style="font-size:0.8rem;color:#555;font-style:italic;padding:8px 14px;border:1px solid #ddd;">Cotización válida por 15 días*</td>'
    +'<td style="text-align:right;font-weight:700;padding:8px 14px;border:1px solid #ddd;">SUBTOTAL</td>'
    +'<td style="text-align:right;font-weight:700;padding:8px 14px;border:1px solid #ddd;">'+fmt(subtotal)+' MXN</td></tr>'
    +ivaRow+isrRow
    +'<tr class="total-row"><td colspan="2"></td><td style="text-align:right;">TOTAL</td><td style="text-align:right;">'+fmt(total)+' MXN</td></tr>'
    +'</tfoot></table>'
    +'<div class="terminos"><div class="terminos-titulo">Términos y Condiciones</div>'
    +'<div class="terminos-texto">Las reparaciones realizadas cuentan con una garantía de 40 días, aplicable únicamente sobre los trabajos efectuados. La garantía no cubre daños ocasionados por mal uso, condiciones externas como humedad, sobrecargas eléctricas o intervenciones posteriores de terceros. Para hacerla válida es indispensable presentar este recibo.</div></div>'
    +'</div></body></html>';

  const win=window.open('','_blank');
  win.document.write(html);
  win.document.close();
}


// ── CLIENTES ─────────────────────────────────────────────────
