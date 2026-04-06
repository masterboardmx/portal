// ── BACKUP ───────────────────────────────────────────────────
function loadBackupPage(){
  const ultimo=localStorage.getItem('ultimo_backup');
  const el=document.getElementById('ultimo-backup');
  if(el) el.textContent=ultimo?`Descargado el ${ultimo}`:'Sin registros aun';
}

async function descargarBackup(){
  const btn=document.getElementById('btn-backup');
  const status=document.getElementById('backup-status');
  btn.disabled=true;btn.textContent='⏳ Descargando...';
  status.textContent='Obteniendo datos...';
  try{
    const[{data:clientes},{data:ordenes},{data:cont},{data:audit}]=await Promise.all([
      sb.from('clientes').select('*'),
      sb.from('ordenes').select('*'),
      sb.from('contabilidad').select('*'),
      sb.from('auditoria').select('*').limit(1000)
    ]);
    const backup={
      version:'1.0',
      fecha:new Date().toISOString(),
      taller:'MASTERBOARD',
      datos:{clientes:clientes||[],ordenes:ordenes||[],contabilidad:cont||[],auditoria:audit||[]}
    };
    const json=JSON.stringify(backup,null,2);
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const fecha=new Date().toISOString().split('T')[0];
    a.href=url;a.download=`masterboard-backup-${fecha}.json`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const ahora=new Date().toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    localStorage.setItem('ultimo_backup',ahora);
    document.getElementById('ultimo-backup').textContent=`Descargado el ${ahora}`;
    status.style.color='var(--green)';
    status.textContent=`✓ Backup completo — ${(clientes||[]).length} clientes, ${(ordenes||[]).length} órdenes, ${(cont||[]).length} movimientos`;
  }catch(e){
    status.style.color='var(--red)';
    status.textContent='Error al descargar: '+e.message;
  }
  btn.disabled=false;btn.textContent='⬇ Descargar Backup Completo';
}

async function restaurarBackup(input){
  const file=input.files[0];if(!file)return;
  const status=document.getElementById('restore-status');
  status.style.color='var(--text-dim)';
  status.textContent='Leyendo archivo...';
  try{
    const text=await file.text();
    const backup=JSON.parse(text);
    if(!backup.datos||!backup.version){status.style.color='var(--red)';status.textContent='Archivo de backup inválido';return;}
    if(!confirm(`¿Restaurar backup del ${backup.fecha?.split('T')[0]}?\n\nSe agregarán los datos que no existan. No se borrarán datos actuales.`)){status.textContent='';return;}
    status.textContent='Restaurando clientes...';
    let ok=0,err=0;
    const{datos}=backup;
    if(datos.clientes?.length){
      for(const c of datos.clientes){
        const{error}=await sb.from('clientes').upsert(c,{onConflict:'id',ignoreDuplicates:true});
        error?err++:ok++;
      }
    }
    status.textContent='Restaurando órdenes...';
    if(datos.ordenes?.length){
      for(const o of datos.ordenes){
        const{error}=await sb.from('ordenes').upsert(o,{onConflict:'id',ignoreDuplicates:true});
        error?err++:ok++;
      }
    }
    status.textContent='Restaurando contabilidad...';
    if(datos.contabilidad?.length){
      for(const c of datos.contabilidad){
        const{error}=await sb.from('contabilidad').upsert(c,{onConflict:'id',ignoreDuplicates:true});
        error?err++:ok++;
      }
    }
    await loadAll();
    status.style.color='var(--green)';
    status.textContent=`✓ Restauración completa — ${ok} registros restaurados${err?`, ${err} errores`:''}`;
  }catch(e){
    status.style.color='var(--red)';
    status.textContent='Error: '+e.message;
  }
  input.value='';
}

