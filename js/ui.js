function badgeEstado(e){const L={recibido:'Recibido',diagnostico:'Diagnostico',reparacion:'Reparacion',cotizacion:'Cotización enviada',listo:'Listo',entregado:'Entregado'};return`<span class="badge badge-${e}">${L[e]||e}</span>`;}
function badgeAccion(a){const L={crear:'Crear',editar:'Editar',estado:'Estado',eliminar:'Eliminar'};return`<span class="badge badge-${a}">${L[a]||a}</span>`;}
function estadoLabel(e){return{recibido:'Recibido',diagnostico:'Diagnostico',reparacion:'Reparacion',cotizacion:'Cotización enviada',listo:'Listo',entregado:'Entregado'}[e]||e;}
function userPill(u){return`<span class="user-pill user-${u}">${u}</span>`;}
function fmtFecha(f){if(!f)return'?';return new Date(f).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});}
function fmtFechaHora(f){if(!f)return'?';return new Date(f).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}
function fmtFechaContab(f){
  if(!f)return'?';
  const dias=['Dom','Lun','Mar','Mi\u00e9','Jue','Vie','S\u00e1b'];
  const d=new Date(f+'T12:00:00');
  return'<span style="color:var(--blue);font-size:0.7rem;">'+dias[d.getDay()]+'</span> '+String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function notif(msg,type){const el=document.getElementById('notif');el.textContent=msg;el.className='notif show '+(type||'');setTimeout(()=>el.className='notif',3000);}

document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');}));
  window.addEventListener('resize',()=>{
    if(!currentUser)return;
    document.getElementById('bottom-nav').style.display=window.innerWidth<=768?'flex':'none';
  });
  // Keepalive — evita que Supabase se pause por inactividad
  setInterval(()=>{ sb.from('clientes').select('id').limit(1).then(()=>{}); }, 4 * 60 * 1000);
});

// ── TEMA CLARO / OSCURO ───────────────────────────────────────
function initTheme(){
  const saved=localStorage.getItem('mb-theme');
  const prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme=saved||(prefersDark?'dark':'light');
  applyTheme(theme);
  // Seguir cambios del OS si no hay preferencia manual
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',e=>{
    if(!localStorage.getItem('mb-theme')) applyTheme(e.matches?'dark':'light');
  });
}

function applyTheme(theme){
  const root=document.documentElement;
  if(theme==='light'){
    root.setAttribute('data-theme','light');
  } else {
    root.removeAttribute('data-theme');
  }
  const btn=document.getElementById('btn-theme');
  if(btn) btn.textContent=theme==='light'?'🌙':'☀️';
}

function toggleTheme(){
  const isLight=document.documentElement.getAttribute('data-theme')==='light';
  const next=isLight?'dark':'light';
  localStorage.setItem('mb-theme',next);
  applyTheme(next);
  // Redibujar gráficas si están visibles
  if(graficaChart){graficaChart.destroy();graficaChart=null;}
  if(document.getElementById('page-contabilidad')?.classList.contains('active')) renderGrafica();
}

initTheme();

// ── TEMA CLARO / OSCURO ───────────────────────────────────────
