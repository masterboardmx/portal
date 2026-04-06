// ── DASHBOARD ────────────────────────────────────────────────
async function loadDashboard(){
  if(currentUser!==MASTER){loadMiPanel();showPage('mipanel');return;}
  document.getElementById('s-total').textContent=allOrdenes.length;
  document.getElementById('s-proceso').textContent=allOrdenes.filter(o=>['recibido','diagnostico','reparacion'].includes(o.estado)).length;
  document.getElementById('s-listas').textContent=allOrdenes.filter(o=>o.estado==='listo').length;
  document.getElementById('s-clientes').textContent=allClientes.length;

  // Resumen semanal
  const hoy=new Date();
  const lunes=new Date(hoy);lunes.setDate(hoy.getDate()-(hoy.getDay()===0?6:hoy.getDay()-1));
  const domingo=new Date(lunes);domingo.setDate(lunes.getDate()+6);
  const ini=lunes.toISOString().split('T')[0];
  const fin=domingo.toISOString().split('T')[0];
  const{data:semData}=await sb.from('contabilidad').select('tipo,monto,categoria').gte('fecha',ini).lte('fecha',fin);
  const movSem=(semData||[]).filter(m=>m.categoria!=='Ajuste Maestro');
  const semIng=movSem.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+Number(m.monto),0);
  const semGas=movSem.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+Number(m.monto),0);
  const semUtil=semIng-semGas;
  const fmt=v=>(v<0?'-':'')+'$'+Math.abs(v).toLocaleString('es-MX',{minimumFractionDigits:2});
  const elIng=document.getElementById('dash-sem-ing');if(elIng)elIng.textContent=fmt(semIng);
  const elGas=document.getElementById('dash-sem-gas');if(elGas)elGas.textContent=fmt(semGas);
  const elUtil=document.getElementById('dash-sem-util');
  if(elUtil){elUtil.textContent=fmt(semUtil);elUtil.className='stat-num '+(semUtil>=0?'green':'red');}

  // Alertas + saldos + flujo visual
  const[{data:resActivas},{data:saldoData}]=await Promise.all([
    sb.from('reservas').select('nombre,monto,metodo').eq('activo',true),
    sb.from('contabilidad').select('tipo,monto,metodo_pago')
  ]);

  // Alertas
  const alertasEl=document.getElementById('dash-alertas');
  if(alertasEl){
    const alertas=(resActivas||[]).map(r=>`
      <div style="background:rgba(255,214,10,0.08);border:1px solid rgba(255,214,10,0.35);border-radius:10px;padding:0.75rem 1rem;display:flex;align-items:center;gap:0.75rem;">
        <span style="font-size:1.1rem;">⚠️</span>
        <div style="flex:1;font-size:0.83rem;">
          <strong>${r.nombre}</strong> apartada en ${r.metodo==='tarjeta_banorte'?'Banorte':r.metodo==='efectivo'?'Efectivo':'Banamex'}
          — <span style="font-family:var(--mono);color:var(--yellow);">$${Number(r.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</span> por pagar
        </div>
      </div>`);
    alertasEl.innerHTML=alertas.join('');
  }

  // Flujo visual: saldos por cuenta
  const movAll=saldoData||[];
  const calcSaldo=met=>movAll.filter(m=>m.metodo_pago===met).reduce((a,m)=>a+Number(m.monto)*(m.tipo==='ingreso'?1:-1),0);
  const saldoEf=calcSaldo('efectivo');
  const saldoBn=calcSaldo('tarjeta_banorte');
  const totalCuentas=saldoEf+saldoBn; // sin banamex
  const totalReservado=(resActivas||[]).reduce((a,r)=>a+Number(r.monto),0);
  const liquidez=totalCuentas-totalReservado;
  const flujoEl=document.getElementById('dash-flujo');
  if(flujoEl){
    const fmtM=v=>'$'+Math.abs(v).toLocaleString('es-MX',{minimumFractionDigits:2});
    const pct=v=>totalCuentas>0?Math.min(100,Math.round(Math.abs(v)/totalCuentas*100)):0;
    const resRows=(resActivas||[]).map(r=>{
      const met=r.metodo==='tarjeta_banorte'?'Banorte':r.metodo==='efectivo'?'Efectivo':'Banamex';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0 0.3rem 1rem;border-left:2px solid rgba(255,69,58,0.3);">
        <span style="font-size:0.8rem;color:var(--text-dim);">📌 ${r.nombre} (${met})</span>
        <span style="font-family:var(--mono);font-size:0.8rem;color:var(--red);">-${fmtM(r.monto)}</span>
      </div>`;}).join('');
    flujoEl.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:1.25rem;">
      <div style="font-family:var(--mono);font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:1rem;">¿Dónde está el dinero?</div>
      <div style="display:flex;flex-direction:column;gap:0.75rem;">
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:0.35rem;">
            <span style="font-size:0.82rem;font-weight:600;">🏦 En cuentas (Efectivo + Banorte)</span>
            <span style="font-family:var(--mono);font-weight:700;color:var(--green);">${fmtM(totalCuentas)}</span>
          </div>
          <div style="display:flex;gap:1rem;padding:0.3rem 0 0.3rem 1rem;border-left:2px solid rgba(48,209,88,0.3);">
            <span style="font-size:0.78rem;color:var(--text-dim);">💵 Efectivo <strong style="font-family:var(--mono);color:var(--text);">${fmtM(saldoEf)}</strong></span>
            <span style="font-size:0.78rem;color:var(--text-dim);">💳 Banorte <strong style="font-family:var(--mono);color:var(--text);">${fmtM(saldoBn)}</strong></span>
          </div>
        </div>
        ${totalReservado>0?`<div>
          <div style="display:flex;justify-content:space-between;margin-bottom:0.35rem;">
            <span style="font-size:0.82rem;font-weight:600;">📌 Apartado / Comprometido</span>
            <span style="font-family:var(--mono);font-weight:700;color:var(--red);">-${fmtM(totalReservado)}</span>
          </div>
          ${resRows}
        </div>`:''}
        <div style="border-top:1px solid var(--border);padding-top:0.75rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.9rem;font-weight:700;">💧 Disponible ahora mismo</span>
            <span style="font-family:var(--mono);font-size:1.2rem;font-weight:700;color:${liquidez>=0?'var(--blue)':'var(--red)'};">${fmtM(liquidez)}</span>
          </div>
          <div style="margin-top:0.6rem;background:var(--bg3);border-radius:6px;height:8px;overflow:hidden;">
            <div style="width:${pct(liquidez)}%;height:100%;background:${liquidez>=0?'var(--blue)':'var(--red)'};border-radius:6px;transition:width 0.5s;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:0.3rem;">
            <span style="font-size:0.68rem;color:var(--text-dim);">$0</span>
            <span style="font-size:0.68rem;color:var(--text-dim);">${fmtM(totalCuentas)} total en cuentas</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  const recent=allOrdenes.slice(0,8);
  // desktop
  document.getElementById('dash-recent').innerHTML=recent.length?recent.map(o=>`
    <tr onclick="verDetalle('${o.id}')" style="cursor:pointer;">
      <td><span style="font-family:var(--mono);color:var(--blue);font-size:0.8rem;">#${o.folio}</span></td>
      <td>${o.clientes?.nombre||'?'}</td>
      <td><a href="https://wa.me/52${(o.clientes?.telefono||'').replace(/\D/g,'')}" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue);text-decoration:none;font-family:var(--mono);font-size:0.78rem;">${o.clientes?.telefono||'?'}</a></td>
      <td>${o.marca} ${o.modelo||''}</td>
      <td>${badgeEstado(o.estado)}</td>
      <td>${o.modificado_por?userPill(o.modificado_por):'<span style="color:var(--text-dim);font-size:0.78rem;">?</span>'}</td>
      <td style="color:var(--text-dim);font-size:0.78rem;">${fmtFecha(o.fecha_ingreso)}</td>
    </tr>`).join(''):`<tr class="empty-row"><td colspan="7">Sin ordenes aun</td></tr>`;
  // mobile cards
  const mob=document.getElementById('dash-recent-mobile');
  if(mob){mob.innerHTML=recent.length?recent.map(o=>`
    <div class="m-card" onclick="verDetalle('${o.id}')">
      <div class="m-card-top">
        <span class="m-card-folio">#${o.folio}</span>
        ${badgeEstado(o.estado)}
      </div>
      <div class="m-card-name">${o.clientes?.nombre||'?'}</div>
      <a href="https://wa.me/52${(o.clientes?.telefono||'').replace(/\D/g,'')}" target="_blank" onclick="event.stopPropagation()" class="m-card-phone" style="display:block;margin:0.2rem 0;">${o.clientes?.telefono||''}</a>
      <div class="m-card-equipo">${o.marca} ${o.modelo||''}</div>
      <div class="m-card-bottom">
        <span style="font-size:0.75rem;color:var(--text-dim);">${fmtFecha(o.fecha_ingreso)}</span>
        ${o.modificado_por?userPill(o.modificado_por):''}
      </div>
    </div>`).join(''):'<div style="text-align:center;color:var(--text-dim);padding:2rem;font-size:0.85rem;">Sin ordenes aun</div>';}
}

// ── MI PANEL & TAREAS ────────────────────────────────────────
let allTareas=[], allTareasEquipo=[];

async function loadMiPanel(){
  const sal=document.getElementById('mipanel-saludo');
  const fec=document.getElementById('mipanel-fecha');
  if(sal) sal.textContent=`Hola, ${currentUser} 👋`;
  if(fec) fec.textContent=new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const{data}=await sb.from('tareas').select('*').eq('para',currentUser).order('created_at',{ascending:false});
  allTareas=data||[];
  renderTareasPanel();
  const sec=document.getElementById('mipanel-pagos-section');
  if(sec&&currentUser==='Chitara'){sec.style.display='block';loadMisPagos();}
  const secOrd=document.getElementById('mipanel-ordenes-section');
  if(secOrd&&currentUser==='Alonso'){secOrd.style.display='block';loadOrdenesAlonso();}
}

async function loadOrdenesAlonso(){
  const{data}=await sb.from('ordenes').select('*,clientes(nombre,telefono)').neq('estado','entregado').order('fecha_ingreso',{ascending:true});
  renderOrdenesAlonso(data||[]);
}

function renderOrdenesAlonso(list){
  const c=document.getElementById('mipanel-ordenes-container');if(!c)return;
  if(!list.length){
    c.innerHTML='<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:2rem;text-align:center;color:var(--text-dim);font-size:0.85rem;">Sin órdenes activas ✓</div>';return;
  }
  const hoy=Date.now();
  function dias(f){return Math.floor((hoy-new Date(f).getTime())/(1000*60*60*24));}
  function urgColor(o){
    if(o.estado==='listo')return'var(--green)';
    const d=dias(o.fecha_ingreso);
    if(d>7)return'var(--red)';
    if(d>3)return'var(--yellow)';
    return'var(--green)';
  }
  function urgLabel(o){
    if(o.estado==='listo')return'Listo ✓';
    const d=dias(o.fecha_ingreso);
    if(d>7)return`⚠️ ${d} días — urgente`;
    if(d>3)return`${d} días`;
    return`${d} día${d!==1?'s':''}`;
  }
  const estadoOpts=[
    {v:'recibido',l:'Recibido'},
    {v:'diagnostico',l:'Diagnóstico'},
    {v:'reparacion',l:'Reparación'},
    {v:'cotizacion',l:'Cotización'},
    {v:'listo',l:'Listo'},
    {v:'entregado',l:'Entregado'}
  ];
  const colorMap={recibido:'rgba(122,130,144,0.5)',diagnostico:'rgba(255,214,10,0.7)',reparacion:'rgba(10,132,255,0.7)',cotizacion:'rgba(191,90,242,0.7)',listo:'rgba(48,209,88,0.7)',entregado:'rgba(122,130,144,0.3)'};
  c.innerHTML=list.map(o=>`
    <div style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid ${urgColor(o)};border-radius:12px;padding:1rem 1.25rem;margin-bottom:0.75rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.75rem;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem;flex-wrap:wrap;">
            <span style="font-family:var(--mono);color:var(--blue);font-size:0.82rem;font-weight:700;">#${o.folio}</span>
            <span style="font-weight:600;font-size:0.9rem;">${o.clientes?.nombre||'?'}</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-dim);">${o.marca||''} ${o.modelo||''}</div>
          <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;">${o.falla_reportada||''}</div>
        </div>
        <span style="font-size:0.72rem;font-family:var(--mono);color:${urgColor(o)};white-space:nowrap;">${urgLabel(o)}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">
        ${estadoOpts.map(e=>`<button type="button" onclick="event.stopPropagation();cambiarEstadoAlonso('${o.id}','${e.v}',this)" style="font-size:0.68rem;padding:0.25rem 0.6rem;border-radius:100px;border:1px solid ${o.estado===e.v?colorMap[e.v]:'var(--border)'};cursor:pointer;background:${o.estado===e.v?colorMap[e.v]:'transparent'};color:${o.estado===e.v?'white':'var(--text-dim)'};transition:all 0.15s;">${e.l}</button>`).join('')}
      </div>
    </div>`).join('');
}

function cambiarEstadoAlonso(id,estado,btn){
  cambiarEstado(id,estado,null).then(()=>{
    // Actualizar botones en la tarjeta
    const row=btn.parentElement;
    const estadoOpts=['recibido','diagnostico','reparacion','cotizacion','listo','entregado'];
    const colorMap={recibido:'rgba(122,130,144,0.5)',diagnostico:'rgba(255,214,10,0.7)',reparacion:'rgba(10,132,255,0.7)',cotizacion:'rgba(191,90,242,0.7)',listo:'rgba(48,209,88,0.7)',entregado:'rgba(122,130,144,0.3)'};
    row.querySelectorAll('button').forEach((b,i)=>{
      const isActive=estadoOpts[i]===estado;
      b.style.background=isActive?colorMap[estadoOpts[i]]:'transparent';
      b.style.borderColor=isActive?colorMap[estadoOpts[i]]:'var(--border)';
      b.style.color=isActive?'white':'var(--text-dim)';
    });
    // Actualizar borde de urgencia de la tarjeta
    const hoy=Date.now();
    const o=allOrdenes.find(x=>x.id===id);
    if(o){
      const dias=Math.floor((hoy-new Date(o.fecha_ingreso).getTime())/(1000*60*60*24));
      const color=estado==='listo'?'var(--green)':dias>7?'var(--red)':dias>3?'var(--yellow)':'var(--green)';
      const card=row.closest('div[style*="border-left"]');
      if(card)card.style.borderLeftColor=color;
    }
  });
}

function renderTareasPanel(){
  const c=document.getElementById('mipanel-tareas-container');if(!c)return;
  const pend=allTareas.filter(t=>!t.completada);
  const comp=allTareas.filter(t=>t.completada).slice(0,5);
  if(!pend.length&&!comp.length){
    c.innerHTML='<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:2rem;text-align:center;color:var(--text-dim);font-size:0.85rem;">Sin pendientes ✓</div>';return;
  }
  c.innerHTML=pend.map(t=>`
    <div style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--blue);border-radius:12px;padding:1rem 1.25rem;margin-bottom:0.75rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
        <div>
          <div style="font-weight:600;margin-bottom:0.2rem;">${t.titulo}</div>
          ${t.descripcion?`<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.3rem;">${t.descripcion}</div>`:''}
          <div style="font-size:0.7rem;color:var(--text-dim);font-family:var(--mono);">${fmtFecha(t.created_at)} · de ${t.creado_por}</div>
        </div>
        <button class="btn-green btn-sm" style="white-space:nowrap;" onclick="completarTarea('${t.id}')">✓ Listo</button>
      </div>
    </div>`).join('')+
    (comp.length?`<div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);">
      <div style="font-size:0.68rem;color:var(--text-dim);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem;">Completadas</div>
      ${comp.map(t=>`<div style="display:flex;justify-content:space-between;padding:0.4rem 0.5rem;border-radius:6px;opacity:0.55;">
        <span style="font-size:0.8rem;text-decoration:line-through;color:var(--text-dim);">${t.titulo}</span>
        <span style="font-size:0.65rem;color:var(--green);">✓</span>
      </div>`).join('')}
    </div>`:'');
}

async function completarTarea(id){
  const{error}=await sb.from('tareas').update({completada:true}).eq('id',id);
  if(error){notif('Error','error');return;}
  allTareas=allTareas.map(t=>t.id===id?{...t,completada:true}:t);
  renderTareasPanel();
  notif('¡Listo! ✓','success');
}

async function loadMisPagos(){
  const c=document.getElementById('mipanel-pagos-container');if(!c)return;
  const{data}=await sb.from('contabilidad').select('*').eq('tipo','gasto').or('categoria.ilike.%Chitara%,descripcion.ilike.%Chitara%').order('fecha',{ascending:false}).limit(50);
  const pagos=data||[];
  if(!pagos.length){c.innerHTML='<div style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:1.5rem;background:var(--bg2);border-radius:12px;border:1px solid var(--border);">Sin pagos registrados aún</div>';return;}
  const total=pagos.reduce((a,p)=>a+Number(p.monto),0);
  const mL={efectivo:'💵 Efectivo',tarjeta_banorte:'💳 Banorte',tarjeta_banamex:'💳 Banamex'};
  c.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
    <div style="padding:0.85rem 1.25rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:0.78rem;color:var(--text-dim);">${pagos.length} pagos registrados</span>
      <span style="font-family:var(--mono);font-weight:700;color:var(--green);">Total $${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
    </div>
    ${pagos.map(p=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1.25rem;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-size:0.82rem;">${p.descripcion.replace('Comisión Chitara — ','')}</div>
        <div style="font-size:0.7rem;color:var(--text-dim);font-family:var(--mono);margin-top:0.15rem;">${fmtFecha(p.fecha)}</div>
      </div>
      <span style="font-family:var(--mono);font-weight:700;color:var(--green);">$${Number(p.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
    </div>`).join('')}
  </div>`;
}

// ALAN — gestión de tareas del equipo
async function loadTareasEquipo(){
  const{data}=await sb.from('tareas').select('*').eq('completada',false).order('created_at',{ascending:false});
  allTareasEquipo=data||[];
  renderTareasEquipo();
}

function renderTareasEquipo(){
  const c=document.getElementById('dash-tareas-lista');if(!c)return;
  if(!allTareasEquipo.length){c.innerHTML='<div style="color:var(--text-dim);font-size:0.82rem;text-align:center;padding:1rem;">Sin pendientes</div>';return;}
  const por={};
  allTareasEquipo.forEach(t=>{if(!por[t.para])por[t.para]=[];por[t.para].push(t);});
  c.innerHTML=Object.entries(por).map(([u,ts])=>`
    <div style="margin-bottom:0.85rem;">
      <div style="font-size:0.68rem;font-family:var(--mono);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.35rem;">${u} · ${ts.length} pendiente${ts.length>1?'s':''}</div>
      ${ts.map(t=>`<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:8px;padding:0.55rem 0.75rem;margin-bottom:0.3rem;gap:0.5rem;">
        <div>
          <div style="font-size:0.83rem;font-weight:500;">${t.titulo}</div>
          ${t.descripcion?`<div style="font-size:0.72rem;color:var(--text-dim);">${t.descripcion}</div>`:''}
        </div>
        <button class="btn-red btn-sm" onclick="eliminarTarea('${t.id}')">✕</button>
      </div>`).join('')}
    </div>`).join('');
}

async function crearTarea(){
  const para=document.getElementById('tarea-para').value;
  const titulo=document.getElementById('tarea-titulo').value.trim();
  const desc=document.getElementById('tarea-desc').value.trim();
  if(!para||!titulo){notif('Selecciona usuario y escribe el mensaje','error');return;}
  const{error}=await sb.from('tareas').insert([{para,titulo,descripcion:desc,creado_por:currentUser}]);
  if(error){notif('Error: '+error.message,'error');return;}
  document.getElementById('tarea-titulo').value='';
  document.getElementById('tarea-desc').value='';
  notif(`Mensaje enviado a ${para} ✓`,'success');
  await loadTareasEquipo();
}

async function eliminarTarea(id){
  const{error}=await sb.from('tareas').delete().eq('id',id);
  if(error){notif('Error','error');return;}
  allTareasEquipo=allTareasEquipo.filter(t=>t.id!==id);
  renderTareasEquipo();
}

