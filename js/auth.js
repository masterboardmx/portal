async function doLogin(){
  const u=document.getElementById('login-user').value.trim();
  const p=document.getElementById('login-pass').value;
  const email=USER_EMAILS[u];
  if(!email){document.getElementById('login-err').style.display='block';return;}
  const{data,error}=await sb.auth.signInWithPassword({email,password:p});
  if(error||!data.user){document.getElementById('login-err').style.display='block';return;}
  const nombre=data.user.raw_user_meta_data?.nombre||u;
  currentUser=nombre;
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('bottom-nav').style.display=window.innerWidth<=768?'flex':'none';
  document.getElementById('topbar-user').textContent=nombre;
  document.getElementById('dash-fecha').textContent=new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  if(nombre===MASTER){
    document.getElementById('master-badge').style.display='inline-flex';
    document.getElementById('sidebar-master').style.display='block';
    document.getElementById('bnav-backup').style.display='flex';
    document.getElementById('bnav-contabilidad').style.display='flex';
    document.getElementById('bnav-auditoria').style.display='flex';
    document.getElementById('bnav-usuarios').style.display='flex';
    document.getElementById('bnav-sesiones').style.display='flex';
    document.getElementById('bnav-backup').style.display='flex';
    activarAjusteMaestro();
  }
  if(AGENDA_USERS.includes(nombre)){
    document.getElementById('sidebar-agenda').style.display='block';
    document.getElementById('bnav-agenda').style.display='flex';
  }
  // Todos los no-Alan tienen Mi Panel y NO ven el dashboard financiero
  if(nombre!==MASTER){
    document.getElementById('sidebar-mipanel').style.display='block';
    document.getElementById('bnav-mipanel').style.display='flex';
    document.getElementById('bnav-dashboard').style.display='none';
  }
  // Chitara: solo ve Mi Panel + Visitas
  if(nombre==='Chitara'){
    document.querySelectorAll('.sidebar-item').forEach(el=>el.style.display='none');
    document.getElementById('bnav-dashboard').style.display='none';
    document.getElementById('bnav-ordenes').style.display='none';
    document.getElementById('bnav-clientes').style.display='none';
    // Mostrar de nuevo su panel y agenda
    document.querySelectorAll('#sidebar-mipanel .sidebar-item').forEach(el=>el.style.display='');
    document.querySelectorAll('#sidebar-agenda .sidebar-item').forEach(el=>el.style.display='');
  }
  if(CONTABILIDAD_USERS.includes(nombre)&&nombre!==MASTER){
    document.getElementById('bnav-contabilidad').style.display='flex';
    document.getElementById('sidebar-cont-alonso').style.display='block';
  }
  loadAll();
  const ua=navigator.userAgent;
  const browser=ua.includes('Chrome')&&!ua.includes('Edg')?'Chrome':ua.includes('Safari')&&!ua.includes('Chrome')?'Safari':ua.includes('Firefox')?'Firefox':ua.includes('Edg')?'Edge':'Otro';
  const os=ua.includes('iPhone')?'iPhone':ua.includes('iPad')?'iPad':ua.includes('Android')?'Android':ua.includes('Windows')?'Windows':ua.includes('Mac')?'Mac':'Otro';
  const tipo=ua.includes('Mobile')||ua.includes('iPhone')||ua.includes('Android')?'Celular':'Computadora';
  await sb.from('auditoria').insert([{
    tabla:'sesiones',registro_id:null,accion:'login',usuario:nombre,
    detalle:`Inicio sesion desde ${tipo} · ${os} · ${browser}`,
    cambios:{tipo,os,browser,hora:new Date().toISOString()}
  }]);
}

async function doLogout(){
  if(currentUser){
    await sb.from('auditoria').insert([{tabla:'sesiones',registro_id:null,accion:'logout',usuario:currentUser,detalle:`Cerro sesion`,cambios:{hora:new Date().toISOString()}}]);
  }
  await sb.auth.signOut();
  currentUser=null;
  document.getElementById('app').style.display='none';
  document.getElementById('bottom-nav').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
  document.getElementById('sidebar-agenda').style.display='none';
  document.getElementById('bnav-agenda').style.display='none';
  // Restaurar visibilidad completa
  document.querySelectorAll('.sidebar-item').forEach(el=>el.style.display='');
  document.getElementById('bnav-dashboard').style.display='flex';
  document.getElementById('bnav-ordenes').style.display='flex';
  document.getElementById('bnav-clientes').style.display='flex';
  document.getElementById('master-badge').style.display='none';
  document.getElementById('sidebar-master').style.display='none';
  document.getElementById('sidebar-cont-alonso').style.display='none';
  document.getElementById('sidebar-mipanel').style.display='none';
  document.getElementById('bnav-mipanel').style.display='none';
  document.getElementById('bnav-backup').style.display='none';
  document.getElementById('bnav-contabilidad').style.display='none';
  document.getElementById('bnav-auditoria').style.display='none';
  document.getElementById('bnav-usuarios').style.display='none';
  document.getElementById('bnav-sesiones').style.display='none';
  document.getElementById('bnav-backup').style.display='none';
}

function showPage(name){
  // No-Alan no puede ver el dashboard financiero
  if(name==='dashboard' && currentUser!==MASTER) name='mipanel';
  // Chitara solo puede ver agenda y mipanel
  if(currentUser==='Chitara' && !['agenda','mipanel'].includes(name)) name='mipanel';
  // proteger paginas de maestro
  const masterPages=['auditoria','usuarios','sesiones','backup'];
  const contPages=['contabilidad'];
  if(masterPages.includes(name) && currentUser!==MASTER){notif('Acceso restringido','error');return;}
  if(contPages.includes(name) && !CONTABILIDAD_USERS.includes(currentUser)){notif('Acceso restringido','error');return;}
  // Activar página
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg=document.getElementById('page-'+name);
  if(!pg){notif('Página no encontrada','error');return;}
  pg.classList.add('active');
  // Activar sidebar
  document.querySelectorAll('.sidebar-item').forEach(s=>s.classList.remove('active'));
  const si=document.querySelector(`.sidebar-item[data-page="${name}"]`);
  if(si)si.classList.add('active');
  // Activar bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(b=>b.classList.remove('active'));
  const bmap={dashboard:'bnav-dashboard',ordenes:'bnav-ordenes',clientes:'bnav-clientes',agenda:'bnav-agenda',backup:'bnav-backup',contabilidad:'bnav-contabilidad',auditoria:'bnav-auditoria',usuarios:'bnav-usuarios',sesiones:'bnav-sesiones',mipanel:'bnav-mipanel'};
  const bkey=name==='agenda'?'bnav-agenda':(bmap[name]||null);
  if(bkey){const b=document.getElementById(bkey);if(b)b.classList.add('active');}
  // Cargar datos
  if(name==='dashboard')loadDashboard();
  if(name==='ordenes')renderOrdenes();
  if(name==='clientes')renderClientes();
  if(name==='agenda')loadAgenda();
  if(name==='mipanel')loadMiPanel();
  if(name==='contabilidad')loadContabilidad();
  if(name==='backup'){loadBackupInfo();loadBackupPage();}
  if(name==='auditoria')loadAuditoria();
  if(name==='usuarios')loadActividad();
  if(name==='sesiones')loadSesiones();
}

async function loadAll(){
  await Promise.all([loadClientes(),loadOrdenes()]);
  if(currentUser===MASTER){loadDashboard();loadTareasEquipo();}
  else{await loadMiPanel();showPage('mipanel');}
}

function activarAjusteMaestro(){
  if(currentUser!=='Alan')return;
  document.querySelectorAll('.ajuste-card').forEach(c=>c.classList.add('maestro-editable'));
  document.querySelectorAll('.ajuste-hint').forEach(h=>h.textContent='✎');
  ['btn-res-efectivo','btn-res-banamex','btn-res-banorte'].forEach(id=>{
    const btn=document.getElementById(id);if(btn)btn.style.display='inline-flex';
  });
}

// Registrar Service Worker para PWA
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
