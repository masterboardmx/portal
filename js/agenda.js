// ── AGENDA / VISITAS ─────────────────────────────────────────
let allVisitas=[], editingVisitaId=null;
let calYear=new Date().getFullYear(), calMes=new Date().getMonth();
let agendaFiltroActivo='todos', agendaFechaSel=null;

const DIAS_ES=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES_ES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

async function loadAgenda(){
  let q=sb.from('visitas').select('*').order('fecha').order('hora');
  if(currentUser!==MASTER) q=q.eq('tecnico',currentUser);
  const{data}=await q;
  allVisitas=data||[];
  renderCalendario();
  filtrarAgenda(agendaFiltroActivo);
}

function calNavMes(dir){
  calMes+=dir;
  if(calMes>11){calMes=0;calYear++;}
  if(calMes<0){calMes=11;calYear--;}
  renderCalendario();
}

function renderCalendario(){
  const titulo=document.getElementById('cal-titulo');
  if(titulo) titulo.textContent=MESES_ES[calMes]+' '+calYear;
  const grid=document.getElementById('cal-grid');
  if(!grid)return;
  const hoyStr=new Date().toISOString().split('T')[0];
  const primerDia=new Date(calYear,calMes,1);
  // Lunes=0, necesitamos offset (getDay: 0=Dom,1=Lun...)
  let offset=primerDia.getDay()-1; if(offset<0)offset=6;
  const diasMes=new Date(calYear,calMes+1,0).getDate();
  const diasPrevMes=new Date(calYear,calMes,0).getDate();

  // Agrupar visitas por fecha para puntos
  const visitasPorFecha={};
  allVisitas.forEach(v=>{
    if(!v.fecha)return;
    if(!visitasPorFecha[v.fecha])visitasPorFecha[v.fecha]=[];
    visitasPorFecha[v.fecha].push(v);
  });

  const dotColor=e=>{
    if(e==='completado')return'var(--green)';
    if(e==='cancelado')return'var(--red)';
    if(e==='en_camino')return'var(--orange)';
    if(e==='en_proceso')return'var(--yellow)';
    if(e==='programado')return'var(--blue)';
    return'var(--text-dim)';
  };

  let html='';
  // Días mes anterior
  for(let i=offset-1;i>=0;i--){
    const d=diasPrevMes-i;
    html+=`<div class="cal-day otroMes"><div class="cal-num">${d}</div></div>`;
  }
  // Días mes actual
  for(let d=1;d<=diasMes;d++){
    const mm=String(calMes+1).padStart(2,'0');
    const dd=String(d).padStart(2,'0');
    const fStr=`${calYear}-${mm}-${dd}`;
    const esHoy=fStr===hoyStr;
    const esSel=fStr===agendaFechaSel;
    const vis=visitasPorFecha[fStr]||[];
    const dots=vis.slice(0,4).map(v=>`<div class="cal-dot" style="background:${dotColor(v.estado)};"></div>`).join('');
    html+=`<div class="cal-day${esHoy?' hoy':''}${esSel?' seleccionado':''}" onclick="calSeleccionarDia('${fStr}')">
      <div class="cal-num">${d}</div>
      ${dots?`<div class="cal-dots">${dots}</div>`:''}
    </div>`;
  }
  // Días mes siguiente
  const totalCeldas=Math.ceil((offset+diasMes)/7)*7;
  for(let d=1;d<=totalCeldas-(offset+diasMes);d++){
    html+=`<div class="cal-day otroMes"><div class="cal-num">${d}</div></div>`;
  }
  grid.innerHTML=html;
}

function calSeleccionarDia(fecha){
  agendaFechaSel=fecha;
  agendaFiltroActivo='fecha';
  // Quitar active de botones
  ['hoy','semana','todos'].forEach(t=>{
    const btn=document.getElementById('agenda-btn-'+t);
    if(btn) btn.className='btn-ghost btn-sm';
  });
  renderCalendario();
  const list=allVisitas.filter(v=>v.fecha===fecha);
  const d=new Date(fecha+'T12:00:00');
  const label=DIAS_ES[d.getDay()]+', '+d.getDate()+' de '+MESES_ES[d.getMonth()]+' '+d.getFullYear();
  const hdr=document.getElementById('agenda-lista-header');
  if(hdr) hdr.textContent=label+' — '+list.length+' visita'+(list.length!==1?'s':'');
  renderAgendaCards(list);
}

function filtrarAgenda(tipo){
  agendaFiltroActivo=tipo;
  if(tipo!=='fecha') agendaFechaSel=null;
  ['hoy','semana','todos'].forEach(t=>{
    const btn=document.getElementById('agenda-btn-'+t);
    if(btn) btn.className=t===tipo?'btn-blue btn-sm':'btn-ghost btn-sm';
  });
  renderCalendario();
  const hoy=new Date().toISOString().split('T')[0];
  let list=allVisitas;
  let label='Todas las visitas';
  if(tipo==='hoy'){
    list=allVisitas.filter(v=>v.fecha===hoy);
    const d=new Date(hoy+'T12:00:00');
    label='Hoy — '+DIAS_ES[d.getDay()]+' '+d.getDate()+' de '+MESES_ES[d.getMonth()];
  } else if(tipo==='semana'){
    const d=new Date();
    const ini=new Date(d);ini.setDate(d.getDate()-(d.getDay()===0?6:d.getDay()-1));
    const fin=new Date(ini);fin.setDate(ini.getDate()+6);
    const inis=ini.toISOString().split('T')[0];
    const fins=fin.toISOString().split('T')[0];
    list=allVisitas.filter(v=>v.fecha>=inis&&v.fecha<=fins);
    label='Esta semana — '+list.length+' visita'+(list.length!==1?'s':'');
  } else {
    label='Todas las visitas — '+list.length+' en total';
  }
  const hdr=document.getElementById('agenda-lista-header');
  if(hdr) hdr.textContent=label;
  renderAgendaCards(list);
}

async function sfd(input,vid){
  var files=Array.from(input.files);
  if(!files.length)return;
  notif("Subiendo "+files.length+" foto(s)...","");
  var ok=0;
  for(var i=0;i<files.length;i++){
    try{
      var comp=await comprimirImagen(files[i]);
      var nom="visitas/"+vid+"/f_"+Date.now()+".jpg";
      var res=await sb.storage.from("reparaciones").upload(nom,comp,{contentType:"image/jpeg",upsert:false});
      if(!res.error)ok++;
    }catch(e){}
  }
  input.value="";
  notif(ok+" foto(s) subida(s)","success");
  cfc(vid);
}

async function cfc(vid){
  var el=document.getElementById("vf-"+vid);
  if(!el)return;
  var res=await sb.storage.from("reparaciones").list("visitas/"+vid,{sortBy:{column:"created_at",order:"desc"}});
  if(res.error||!res.data||!res.data.length){el.innerHTML="";return;}
  var html="";
  for(var i=0;i<res.data.length;i++){
    var url="https://qsjscxnlbxwvhgzjjvuh.supabase.co/storage/v1/object/public/reparaciones/visitas/"+vid+"/"+res.data[i].name;
    var nom=res.data[i].name;
    html+='<img src="'+url+'" style="width:44px;height:44px;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid var(--border);flex-shrink:0;" onclick="verFotoVisita(\''+url+'\',\''+vid+'\',\''+nom+'\')" loading="lazy">';
  }
  el.innerHTML=html;
}

function verFotoVisita(url,vid,nom){
  var ov=document.createElement("div");
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;";
  ov.innerHTML='<img src="'+url+'" style="max-width:100%;max-height:80vh;border-radius:10px;object-fit:contain;">'
    +'<div style="display:flex;gap:1rem;margin-top:1.25rem;">'
    +'<button onclick="window.open(\''+url+'\',\'_blank\')" style="background:rgba(255,255,255,0.12);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:0.6rem 1.2rem;cursor:pointer;font-size:0.9rem;">🔍 Ver completa</button>'
    +'<button onclick="bfv(\''+vid+'\',\''+nom+'\',this.closest(\'div\').parentNode)" style="background:rgba(255,69,58,0.2);color:#FF453A;border:1px solid rgba(255,69,58,0.3);border-radius:8px;padding:0.6rem 1.2rem;cursor:pointer;font-size:0.9rem;">🗑 Borrar</button>'
    +'<button onclick="this.closest(\'[style*=position]\').remove()" style="background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:0.6rem 1.2rem;cursor:pointer;font-size:0.9rem;">✕ Cerrar</button>'
    +'</div>';
  ov.addEventListener("click",function(e){if(e.target===ov)ov.remove();});
  document.body.appendChild(ov);
}

async function bfv(vid,nom,ov){
  if(!confirm("¿Borrar esta foto?"))return;
  var r=await sb.storage.from("reparaciones").remove(["visitas/"+vid+"/"+nom]);
  if(r.error){notif("Error al borrar","error");return;}
  notif("Foto borrada","success");
  if(ov)ov.remove();
  cfc(vid);
}

function renderAgendaCards(list){
  const container=document.getElementById('agenda-cards');
  if(!container)return;
  if(!list.length){
    container.innerHTML='<div style="text-align:center;color:var(--text-dim);padding:3rem 1rem;background:var(--bg2);border:1px solid var(--border);border-radius:12px;">Sin visitas para este período</div>';
    return;
  }
  const estadoBadge={
    por_programar:`<span style="background:rgba(122,130,144,0.15);color:var(--text-dim);border:1px solid rgba(122,130,144,0.3);border-radius:100px;padding:0.2rem 0.6rem;font-size:0.68rem;font-family:var(--mono);">🕐 Por Programar</span>`,
    programado:`<span style="background:rgba(10,132,255,0.12);color:var(--blue);border:1px solid rgba(10,132,255,0.3);border-radius:100px;padding:0.2rem 0.6rem;font-size:0.68rem;font-family:var(--mono);">📅 Programado</span>`,
    en_camino:`<span style="background:rgba(255,107,0,0.12);color:var(--orange);border:1px solid rgba(255,107,0,0.3);border-radius:100px;padding:0.2rem 0.6rem;font-size:0.68rem;font-family:var(--mono);">🚗 En Camino</span>`,
    en_proceso:`<span style="background:rgba(255,214,10,0.12);color:var(--yellow);border:1px solid rgba(255,214,10,0.3);border-radius:100px;padding:0.2rem 0.6rem;font-size:0.68rem;font-family:var(--mono);">🔧 En Proceso</span>`,
    completado:`<span style="background:rgba(48,209,88,0.12);color:var(--green);border:1px solid rgba(48,209,88,0.3);border-radius:100px;padding:0.2rem 0.6rem;font-size:0.68rem;font-family:var(--mono);">✅ Completado</span>`,
    cancelado:`<span style="background:rgba(255,69,58,0.12);color:var(--red);border:1px solid rgba(255,69,58,0.3);border-radius:100px;padding:0.2rem 0.6rem;font-size:0.68rem;font-family:var(--mono);">❌ Cancelado</span>`
  };
  const mL=v=>{const a=v.cliente_direccion||'';return a.startsWith('http')?a:`https://maps.google.com/?q=${encodeURIComponent(a)}`;};
  const mTxt=v=>{const a=v.cliente_direccion||'';return a.startsWith('http')?'Ver en Maps':a||'Sin dirección';};

  // Agrupar por fecha
  const grupos={};
  list.forEach(v=>{
    const f=v.fecha||'sin-fecha';
    if(!grupos[f])grupos[f]=[];
    grupos[f].push(v);
  });
  const fechasOrdenadas=Object.keys(grupos).sort();

  let html='';
  fechasOrdenadas.forEach(f=>{
    let labelGrupo='Sin fecha';
    if(f!=='sin-fecha'){
      const d=new Date(f+'T12:00:00');
      const hoy=new Date().toISOString().split('T')[0];
      const manana=new Date();manana.setDate(manana.getDate()+1);
      const manStr=manana.toISOString().split('T')[0];
      if(f===hoy) labelGrupo='Hoy · '+DIAS_ES[d.getDay()]+' '+d.getDate()+' de '+MESES_ES[d.getMonth()];
      else if(f===manStr) labelGrupo='Mañana · '+DIAS_ES[d.getDay()]+' '+d.getDate()+' de '+MESES_ES[d.getMonth()];
      else labelGrupo=DIAS_ES[d.getDay()]+' '+d.getDate()+' de '+MESES_ES[d.getMonth()]+' '+d.getFullYear();
    }
    html+=`<div class="dia-grupo-label">${labelGrupo} <span style="color:var(--blue);margin-left:0.5rem;">${grupos[f].length}</span></div>`;
    grupos[f].forEach(v=>{
      const d=v.fecha?new Date(v.fecha+'T12:00:00'):null;
      html+=`<div class="visita-card ${v.estado||''}">
        <div class="visita-fecha-col">
          ${d?`<div class="visita-dia-num">${d.getDate()}</div><div class="visita-dia-nombre">${DIAS_ES[d.getDay()]}</div><div class="visita-mes">${MESES_ES[d.getMonth()].substring(0,3)}</div>`:'<div style="font-size:0.7rem;color:var(--text-dim);">—</div>'}
          ${v.hora?`<div class="visita-hora-pill">${v.hora.substring(0,5)}</div>`:''}
        </div>
        <div>
          <div class="visita-nombre">${v.cliente_nombre}</div>
          ${v.descripcion?`<div class="visita-desc">${v.descripcion}</div>`:''}
          <div class="visita-info-row">
            ${v.cliente_telefono?`<a href="https://wa.me/52${v.cliente_telefono.replace(/\D/g,'')}" target="_blank" class="visita-tag" style="color:var(--green);text-decoration:none;">📱 ${v.cliente_telefono}</a>`:''}
            ${v.cliente_direccion?`<a href="${mL(v)}" target="_blank" class="visita-tag" style="color:var(--orange);text-decoration:none;">📍 ${mTxt(v)}</a>`:''}
            <span class="visita-tag">${userPill(v.tecnico)}</span>
          </div>
          <div style="margin-top:0.5rem;">${estadoBadge[v.estado]||v.estado}</div>
        </div>
        <div style="display:flex;flex-direction:row;gap:0.4rem;align-items:center;">
          <input type="file" id="fc-${v.id}" accept="image/*" multiple capture="environment" style="display:none;" onchange="sfd(this,'${v.id}')">
          <input type="file" id="fg-${v.id}" accept="image/*" multiple style="display:none;" onchange="sfd(this,'${v.id}')">
          <button class="btn-ghost btn-sm" onclick="document.getElementById('fc-'+'${v.id}').click()" title="Cámara">📷</button>
          <button class="btn-ghost btn-sm" onclick="document.getElementById('fg-'+'${v.id}').click()" title="Galería">🖼</button>
          <div id="vf-${v.id}" style="display:flex;gap:3px;overflow-x:auto;max-width:140px;padding-bottom:2px;-webkit-overflow-scrolling:touch;flex-shrink:0;scroll-snap-type:x mandatory;"></div>
          ${currentUser!=='Chitara'?`<button class="btn-ghost btn-sm" onclick="crearOrdenDesdeVisita('${v.id}')" title="Crear orden de trabajo">🔧 OT</button>`:''}
          <button class="btn-ghost btn-sm" onclick="editarVisita('${v.id}')">✏ Editar</button>
          <button class="btn-red btn-sm" onclick="eliminarVisita('${v.id}')">✕</button>
        </div>
      </div>`;
    });
  });
  container.innerHTML=html;
  setTimeout(function(){ list.forEach(function(v){ cfc(v.id); }); }, 30);
}

function renderAgenda(list){ renderAgendaCards(list); }

async function crearOrdenDesdeVisita(visitaId){
  const v=allVisitas.find(x=>x.id===visitaId);
  if(!v)return;
  // Cambiar a sección ordenes y esperar que cargue
  await showPage('ordenes');
  await new Promise(r=>setTimeout(r,200));
  // Buscar cliente por teléfono o nombre
  let cliente_id='';
  if(v.cliente_telefono){
    const match=allClientes.find(c=>c.telefono===v.cliente_telefono);
    if(match) cliente_id=match.id;
  }
  if(!cliente_id&&v.cliente_nombre){
    const match=allClientes.find(c=>c.nombre.toLowerCase()===v.cliente_nombre.toLowerCase());
    if(match) cliente_id=match.id;
  }
  await openNuevaOrden({
    cliente_id,
    tecnico:v.tecnico||'',
    falla:v.descripcion||'',
    notas:v.notas||'',
    visita_id:v.id
  });
}

function openNuevaVisita(){
  editingVisitaId=null;
  document.getElementById('modal-visita-title').textContent='Nueva Visita';
  document.getElementById('btn-guardar-visita').textContent='Guardar';
  ['v-nombre','v-telefono','v-direccion','v-descripcion','v-notas'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('v-estado').value='programado';
  document.getElementById('v-tecnico').value=currentUser==='Chitara'?'Chitara':'Chitara';
  document.getElementById('v-fecha').value=new Date().toISOString().split('T')[0];
  document.getElementById('v-hora').value='09:00';
  document.getElementById('modal-visita').classList.add('open');
}

function editarVisita(id){
  const v=allVisitas.find(x=>x.id===id);if(!v)return;
  editingVisitaId=id;
  document.getElementById('modal-visita-title').textContent='Editar Visita';
  document.getElementById('btn-guardar-visita').textContent='Actualizar';
  document.getElementById('v-nombre').value=v.cliente_nombre||'';
  document.getElementById('v-telefono').value=v.cliente_telefono||'';
  document.getElementById('v-direccion').value=v.cliente_direccion||'';
  document.getElementById('v-descripcion').value=v.descripcion||'';
  document.getElementById('v-notas').value=v.notas||'';
  document.getElementById('v-estado').value=v.estado||'programado';
  document.getElementById('v-tecnico').value=v.tecnico||'Chitara';
  document.getElementById('v-fecha').value=v.fecha||'';
  document.getElementById('v-hora').value=v.hora?.substring(0,5)||'';
  document.getElementById('modal-visita').classList.add('open');
}

async function guardarVisita(){
  const nombre=document.getElementById('v-nombre').value.trim();
  const estado=document.getElementById('v-estado').value;
  const fecha=document.getElementById('v-fecha').value;
  const hora=document.getElementById('v-hora').value;
  const esPorProgramar=estado==='por_programar';
  if(!nombre){notif('El nombre es requerido','error');return;}
  if(!esPorProgramar&&(!fecha||!hora)){notif('Fecha y hora requeridas para este estado','error');return;}
  const data={cliente_nombre:nombre,cliente_telefono:document.getElementById('v-telefono').value.trim(),cliente_direccion:document.getElementById('v-direccion').value.trim(),descripcion:document.getElementById('v-descripcion').value.trim(),notas:document.getElementById('v-notas').value.trim(),estado,tecnico:document.getElementById('v-tecnico').value,fecha:fecha||null,hora:hora||null,creado_por:currentUser,updated_at:new Date().toISOString()};
  let err;
  if(editingVisitaId){
    ({error:err}=await sb.from('visitas').update(data).eq('id',editingVisitaId));
    if(err){notif('Error: '+err.message,'error');return;}
    closeModal('modal-visita');
    notif('Visita actualizada','success');
  } else {
    ({error:err}=await sb.from('visitas').insert([data]));
    if(err){notif('Error: '+err.message,'error');return;}
    if(data.cliente_telefono){
      const{data:existe}=await sb.from('clientes').select('id').eq('telefono',data.cliente_telefono).maybeSingle();
      if(!existe){
        await sb.from('clientes').insert([{nombre:data.cliente_nombre,telefono:data.cliente_telefono,direccion:data.cliente_direccion||'',modificado_por:currentUser}]);
        const{data:clis}=await sb.from('clientes').select('*').order('nombre');
        allClientes=clis||[];
        notif('Visita guardada y cliente registrado ✓','success');
      } else {
        notif('Visita programada ✓','success');
      }
    } else {
      notif('Visita programada ✓','success');
    }
    closeModal('modal-visita');
  }
  loadAgenda();
}

async function eliminarVisita(id){
  const v=allVisitas.find(x=>x.id===id);
  if(!confirm('¿Eliminar visita de '+v?.cliente_nombre+'?'))return;
  const{error}=await sb.from('visitas').delete().eq('id',id);
  if(error){notif('Error','error');return;}
  notif('Visita eliminada','success');loadAgenda();
}

