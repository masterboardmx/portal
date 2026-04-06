// ── AUDITORIA ────────────────────────────────────────────────
async function registrarAuditoria(tabla,registro_id,accion,detalle,cambios){
  await sb.from('auditoria').insert([{tabla,registro_id,accion,usuario:currentUser,detalle,cambios:cambios||null}]);
}

async function loadAuditoria(){
  if(currentUser!==MASTER){notif('Acceso restringido','error');showPage('dashboard');return;}
  const{data}=await sb.from('auditoria').select('*').order('created_at',{ascending:false}).limit(200);
  allAuditoria=data||[];
  renderAuditoria(allAuditoria);
}

function renderAuditoria(data){
  const el=document.getElementById('audit-lista');
  if(!data.length){el.innerHTML='<div style="padding:3rem;text-align:center;color:var(--text-dim);font-size:0.85rem;">Sin registros aun</div>';return;}
  el.innerHTML=data.map(a=>`
    <div class="audit-row">
      <div class="audit-time">${fmtFechaHora(a.created_at)}</div>
      <div style="min-width:80px;">${userPill(a.usuario)}</div>
      <div style="min-width:100px;">${badgeAccion(a.accion)}</div>
      <div class="audit-detail">
        <div>${a.detalle||''}</div>
        ${a.cambios?`<div class="audit-sub">${JSON.stringify(a.cambios)}</div>`:''}
      </div>
    </div>`).join('');
}

function filterAuditoria(){
  const u=document.getElementById('filter-audit-user').value;
  const a=document.getElementById('filter-audit-accion').value;
  let list=allAuditoria;
  if(u)list=list.filter(x=>x.usuario===u);
  if(a)list=list.filter(x=>x.accion===a);
  renderAuditoria(list);
}

async function loadSesiones(){
  if(currentUser!==MASTER){notif('Acceso restringido','error');showPage('dashboard');return;}
  const{data}=await sb.from('auditoria').select('*').eq('tabla','sesiones').order('created_at',{ascending:false}).limit(200);
  renderSesiones(data||[]);
}

function renderSesiones(data){
  const osIcon=os=>({iPhone:'📱',iPad:'📱',Android:'📱',Windows:'🖥️',Mac:'💻'}[os]||'💻');
  const browserIcon=b=>({Chrome:'🌐',Safari:'🧭',Firefox:'🦊',Edge:'🌀'}[b]||'🌐');
  const accionLabel=a=>a==='login'
    ?'<span style="color:var(--green);font-family:var(--mono);font-size:0.72rem;background:rgba(48,209,88,0.12);border:1px solid rgba(48,209,88,0.3);padding:0.2rem 0.6rem;border-radius:100px;">ENTRÓ</span>'
    :'<span style="color:var(--text-dim);font-family:var(--mono);font-size:0.72rem;background:rgba(255,255,255,0.06);border:1px solid var(--border);padding:0.2rem 0.6rem;border-radius:100px;">SALIÓ</span>';
  const dispositivo=s=>{
    const c=s.cambios||{};
    const os=c.os||'?'; const browser=c.browser||'?'; const tipo=c.tipo||'?';
    return `${osIcon(os)} ${os} · ${browserIcon(browser)} ${browser}`;
  };
  // desktop table
  const tbody=document.getElementById('tabla-sesiones');
  if(tbody) tbody.innerHTML=data.length?data.map(s=>`
    <tr>
      <td>${userPill(s.usuario)}</td>
      <td>${accionLabel(s.accion)}</td>
      <td style="font-size:0.82rem;">${dispositivo(s)}</td>
      <td style="font-family:var(--mono);font-size:0.78rem;color:var(--text-dim);">${fmtFechaHora(s.created_at)}</td>
    </tr>`).join(''):`<tr class="empty-row"><td colspan="4">Sin registros aun</td></tr>`;
  // mobile cards
  const mob=document.getElementById('mobile-sesiones');
  if(mob) mob.innerHTML=data.length?data.map(s=>`
    <div class="m-card" style="cursor:default;">
      <div class="m-card-top">${userPill(s.usuario)}${accionLabel(s.accion)}</div>
      <div style="font-size:0.82rem;margin-top:0.4rem;">${dispositivo(s)}</div>
      <div style="font-family:var(--mono);font-size:0.75rem;color:var(--text-dim);margin-top:0.3rem;">${fmtFechaHora(s.created_at)}</div>
    </div>`).join(''):'<div style="text-align:center;color:var(--text-dim);padding:2rem;">Sin registros</div>';
}

async function filterSesiones(){
  const u=document.getElementById('filter-sesion-user').value;
  const{data}=await sb.from('auditoria').select('*').eq('tabla','sesiones').order('created_at',{ascending:false}).limit(200);
  const list=u?(data||[]).filter(s=>s.usuario===u):data||[];
  renderSesiones(list);
}

async function loadActividad(){
  if(currentUser!==MASTER){notif('Acceso restringido','error');showPage('dashboard');return;}
  const{data}=await sb.from('auditoria').select('*').order('created_at',{ascending:false}).limit(500);
  allAuditoria=data||[];
  const usuarios=['Alan','Azul','Alonso'];
  const statsEl=document.getElementById('user-stats');
  statsEl.innerHTML=usuarios.map(u=>{
    const uData=allAuditoria.filter(a=>a.usuario===u);
    return`<div class="stat-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">${userPill(u)}<span style="font-size:0.68rem;color:var(--text-dim);font-family:var(--mono);">${u===MASTER?'MAESTRO':'TECNICO'}</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.8rem;">
        <div><div style="color:var(--text-dim);font-size:0.68rem;">Creaciones</div><div style="font-family:var(--mono);color:var(--green);">${uData.filter(a=>a.accion==='crear').length}</div></div>
        <div><div style="color:var(--text-dim);font-size:0.68rem;">Ediciones</div><div style="font-family:var(--mono);color:var(--blue);">${uData.filter(a=>a.accion==='editar').length}</div></div>
        <div><div style="color:var(--text-dim);font-size:0.68rem;">Estados</div><div style="font-family:var(--mono);color:var(--yellow);">${uData.filter(a=>a.accion==='estado').length}</div></div>
        <div><div style="color:var(--text-dim);font-size:0.68rem;">Eliminados</div><div style="font-family:var(--mono);color:var(--red);">${uData.filter(a=>a.accion==='eliminar').length}</div></div>
      </div>
    </div>`;
  }).join('');
  const recentEl=document.getElementById('user-recent');
  const recent=allAuditoria.slice(0,15);
  recentEl.innerHTML=recent.length?recent.map(a=>`
    <div class="audit-row">
      <div class="audit-time">${fmtFechaHora(a.created_at)}</div>
      <div style="min-width:80px;">${userPill(a.usuario)}</div>
      <div style="min-width:100px;">${badgeAccion(a.accion)}</div>
      <div class="audit-detail">${a.detalle||''}</div>
    </div>`).join(''):'<div style="padding:2rem;text-align:center;color:var(--text-dim);">Sin actividad</div>';
}
