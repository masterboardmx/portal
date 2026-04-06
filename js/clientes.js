async function loadClientes(){const{data}=await sb.from('clientes').select('*').order('created_at',{ascending:false});allClientes=data||[];poblarSelectClientes();}

// ── CLIENTES ─────────────────────────────────────────────────
function renderClientes(data){
  const list=data||allClientes;
  // Desktop table
  document.getElementById('tabla-clientes').innerHTML=list.length?list.map(c=>{
    const n=allOrdenes.filter(o=>o.cliente_id===c.id).length;
    return`<tr>
      <td><div style="font-weight:500;">${c.nombre}</div></td>
      <td><a href="https://wa.me/52${(c.telefono||'').replace(/\D/g,'')}" target="_blank" style="color:var(--blue);text-decoration:none;">${c.telefono}</a></td>
      <td style="color:var(--text-dim);font-size:0.82rem;">${c.email||'?'}</td>
      <td><span style="font-family:var(--mono);color:var(--blue);">${n}</span></td>
      <td>${c.modificado_por?userPill(c.modificado_por):'<span style="color:var(--text-dim);font-size:0.75rem;">?</span>'}</td>
      <td style="color:var(--text-dim);font-size:0.78rem;">${fmtFecha(c.created_at)}</td>
      <td><div style="display:flex;gap:0.4rem;"><button class="btn-ghost btn-sm" onclick="editarCliente('${c.id}')">Editar</button><button class="btn-red btn-sm" onclick="eliminarCliente('${c.id}')">X</button></div></td>
    </tr>`;
  }).join(''):`<tr class="empty-row"><td colspan="7">Sin clientes</td></tr>`;
  // Mobile cards
  const mob=document.getElementById('mobile-clientes');
  mob.innerHTML=list.length?list.map(c=>{
    const n=allOrdenes.filter(o=>o.cliente_id===c.id).length;
    return`<div class="m-card">
      <div class="m-card-top">
        <div class="m-card-name">${c.nombre}</div>
        <span style="font-family:var(--mono);font-size:0.8rem;color:var(--blue);">${n} orden${n!==1?'es':''}</span>
      </div>
      <a href="https://wa.me/52${(c.telefono||'').replace(/\D/g,'')}" target="_blank" class="m-card-phone" style="display:block;margin-bottom:0.25rem;">📱 ${c.telefono}</a>
      ${c.email?`<div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:0.25rem;">✉ ${c.email}</div>`:''}
      <div class="m-card-bottom">
        <span style="font-size:0.75rem;color:var(--text-dim);">${fmtFecha(c.created_at)}</span>
        ${c.modificado_por?userPill(c.modificado_por):''}
      </div>
      <div class="m-card-actions">
        <button class="btn-ghost" onclick="editarCliente('${c.id}')">Editar</button>
        <button class="btn-red btn-sm" onclick="eliminarCliente('${c.id}')">✕</button>
      </div>
    </div>`;
  }).join(''):'<div style="text-align:center;color:var(--text-dim);padding:3rem;font-size:0.85rem;">Sin clientes</div>';
}

function filterClientes(){
  const q=document.getElementById('search-clientes').value.toLowerCase();
  renderClientes(allClientes.filter(c=>c.nombre.toLowerCase().includes(q)||(c.telefono||'').includes(q)||(c.email||'').toLowerCase().includes(q)));
}

function openNuevoCliente(){
  editingClienteId=null;
  document.getElementById('modal-cliente-title').textContent='Nuevo Cliente';
  document.getElementById('btn-guardar-cliente').textContent='Guardar';
  ['c-nombre','c-telefono','c-email','c-direccion'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('modal-cliente').classList.add('open');
}

function editarCliente(id){
  const c=allClientes.find(x=>x.id===id);if(!c)return;
  editingClienteId=id;
  document.getElementById('modal-cliente-title').textContent='Editar Cliente';
  document.getElementById('btn-guardar-cliente').textContent='Actualizar';
  document.getElementById('c-nombre').value=c.nombre||'';
  document.getElementById('c-telefono').value=c.telefono||'';
  document.getElementById('c-email').value=c.email||'';
  document.getElementById('c-direccion').value=c.direccion||'';
  document.getElementById('modal-cliente').classList.add('open');
}

async function guardarCliente(){
  const nombre=document.getElementById('c-nombre').value.trim();
  const telefono=document.getElementById('c-telefono').value.trim();
  if(!nombre||!telefono){notif('Nombre y telefono requeridos','error');return;}
  const data={nombre,telefono,email:document.getElementById('c-email').value.trim(),direccion:document.getElementById('c-direccion').value.trim(),modificado_por:currentUser};
  let err,rid;
  if(editingClienteId){
    ({error:err}=await sb.from('clientes').update(data).eq('id',editingClienteId));
    rid=editingClienteId;
    await registrarAuditoria('clientes',rid,'editar',`Edito cliente: ${nombre}`);
  }else{
    const{data:d,error:e}=await sb.from('clientes').insert([data]).select();
    err=e;rid=d?.[0]?.id;
    await registrarAuditoria('clientes',rid,'crear',`Registro cliente: ${nombre} - ${telefono}`);
  }
  if(err){notif('Error: '+err.message,'error');return;}
  closeModal('modal-cliente');notif(editingClienteId?'Cliente actualizado':'Cliente registrado','success');
  await loadClientes();renderClientes();loadDashboard();
}

async function eliminarCliente(id){
  const c=allClientes.find(x=>x.id===id);
  if(!confirm('Eliminar cliente '+c?.nombre+' y sus ordenes?'))return;
  const{error}=await sb.from('clientes').delete().eq('id',id);
  if(error){notif('Error','error');return;}
  await registrarAuditoria('clientes',id,'eliminar',`Elimino cliente: ${c?.nombre}`);
  notif('Cliente eliminado','success');await loadAll();renderClientes();
}

function poblarSelectClientes(){
  document.getElementById('o-cliente').innerHTML='<option value="">Seleccionar cliente</option>'+allClientes.map(c=>`<option value="${c.id}">${c.nombre} - ${c.telefono}</option>`).join('');
}

function toggleNuevoCliente(){
  const f=document.getElementById('nuevo-cliente-form');
  const visible=f.style.display==='flex';
  f.style.display=visible?'none':'flex';
  if(!visible)document.getElementById('nc-nombre').focus();
}

async function crearClienteRapido(){
  const nombre=document.getElementById('nc-nombre').value.trim();
  const telefono=document.getElementById('nc-telefono').value.trim();
  if(!nombre||!telefono){notif('Nombre y teléfono requeridos','error');return;}
  const{data,error}=await sb.from('clientes').insert([{nombre,telefono,modificado_por:currentUser}]).select().single();
  if(error){notif('Error: '+error.message,'error');return;}
  allClientes.unshift(data);
  poblarSelectClientes();
  document.getElementById('o-cliente').value=data.id;
  document.getElementById('nc-nombre').value='';
  document.getElementById('nc-telefono').value='';
  toggleNuevoCliente();
  notif('Cliente creado ✓','success');
}
