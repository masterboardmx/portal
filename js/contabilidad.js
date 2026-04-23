// ── CONTABILIDAD ─────────────────────────────────────────────
let allMovimientos=[], graficaChart=null, contTipo='todos', allReservas=[];
let ajusteTipo='sumar', ajusteTarget=null;
let reservaMetodoActual=null;
let graficaCategChart=null;

const ajusteConfig={
  ingresos:{label:'Ingresos',metodoDefault:'efectivo',tipo_mov:'ingreso'},
  gastos:{label:'Gastos',metodoDefault:'efectivo',tipo_mov:'gasto'},
  efectivo:{label:'Efectivo',metodoDefault:'efectivo'},
  transferencia:{label:'Transferencia',metodoDefault:'transferencia'},
  banamex:{label:'Banamex',metodoDefault:'tarjeta_banamex'},
  banorte:{label:'Banorte',metodoDefault:'tarjeta_banorte'}
};

async function loadContabilidad(){
  const mes=document.getElementById('cont-mes')?.value;
  let q=sb.from('contabilidad').select('*,ordenes(folio,marca),clientes(nombre)').order('fecha',{ascending:false});
  if(mes){const[y,m]=mes.split('-');const ini=`${y}-${m}-01`;const fin=new Date(y,m,0).toISOString().split('T')[0];q=q.gte('fecha',ini).lte('fecha',fin);}
  const{data}=await q;
  allMovimientos=data||[];
  const{data:resData}=await sb.from('reservas').select('*').eq('activo',true).order('created_at');
  allReservas=resData||[];
  poblarSelectMeses();
  poblarSelectOrdenes();
  actualizarStats();
  renderMovimientos(allMovimientos.filter(m=>m.categoria!=='Ajuste Maestro'));
  renderGrafica();
}

function poblarSelectMeses(){
  const sel=document.getElementById('cont-mes');
  if(!sel)return;
  const meses=new Set();
  allMovimientos.forEach(m=>meses.add(m.fecha.substring(0,7)));
  // Get all months data regardless of filter
  sb.from('contabilidad').select('fecha').then(({data})=>{
    const todosM=new Set((data||[]).map(r=>r.fecha.substring(0,7)));
    const cur=sel.value;
    sel.innerHTML='<option value="">Todo el tiempo</option>';
    [...todosM].sort().reverse().forEach(m=>{
      const[y,mo]=m.split('-');
      const label=new Date(y,mo-1).toLocaleDateString('es-MX',{month:'long',year:'numeric'});
      sel.innerHTML+=`<option value="${m}" ${cur===m?'selected':''}>${label}</option>`;
    });
  });
}

function poblarSelectOrdenes(){
  const sel=document.getElementById('cont-orden');
  if(!sel)return;
  sel.innerHTML='<option value="">— Sin orden —</option>'+
    allOrdenes.map(o=>`<option value="${o.id}">#${o.folio} — ${o.clientes?.nombre||'?'} (${o.marca})</option>`).join('');
}

async function actualizarStats(){
  const{data:ordenesActuales}=await sb.from('ordenes').select('id,estado,costo_estimado,costo_final');
  // Ajuste Maestro se excluye de totales visibles (solo afecta saldos por método)
  const ingresos=allMovimientos.filter(m=>m.tipo==='ingreso'&&m.categoria!=='Ajuste Maestro').reduce((a,m)=>a+Number(m.monto),0);
  const gastos=allMovimientos.filter(m=>m.tipo==='gasto'&&m.categoria!=='Ajuste Maestro').reduce((a,m)=>a+Number(m.monto),0);
  const lblIng=document.getElementById('lbl-total-ing');if(lblIng)lblIng.textContent='$'+ingresos.toLocaleString('es-MX',{minimumFractionDigits:2});
  const lblGas=document.getElementById('lbl-total-gas');if(lblGas)lblGas.textContent='$'+gastos.toLocaleString('es-MX',{minimumFractionDigits:2});
  const balance=ingresos-gastos;
  const ordenesConIngreso=new Set(allMovimientos.filter(m=>m.orden_id).map(m=>m.orden_id));
  const porCobrar=(ordenesActuales||[]).filter(o=>['listo','entregado'].includes(o.estado)&&!ordenesConIngreso.has(o.id))
    .reduce((a,o)=>a+Number(o.costo_final||o.costo_estimado||0),0);
  document.getElementById('c-ingresos').textContent='$'+ingresos.toLocaleString('es-MX',{minimumFractionDigits:2});
  document.getElementById('c-gastos').textContent='$'+gastos.toLocaleString('es-MX',{minimumFractionDigits:2});
  const balEl=document.getElementById('c-balance');
  balEl.textContent='$'+Math.abs(balance).toLocaleString('es-MX',{minimumFractionDigits:2});
  balEl.className='stat-num '+(balance>=0?'green':'red');
  const cardBal=document.getElementById('card-balance');
  if(cardBal)cardBal.style.borderTop=balance>=0?'2px solid rgba(48,209,88,0.5)':'2px solid rgba(255,69,58,0.5)';
  document.getElementById('c-cobrar').textContent='$'+porCobrar.toLocaleString('es-MX',{minimumFractionDigits:2});
  // Saldo neto por método
  const metodos=['efectivo','transferencia','tarjeta_banamex','tarjeta_banorte'];
  const colores={efectivo:'var(--green)',transferencia:'var(--blue)',tarjeta_banamex:'var(--yellow)',tarjeta_banorte:'var(--orange)'};
  metodos.forEach(met=>{
    const ing=allMovimientos.filter(m=>m.tipo==='ingreso'&&m.metodo_pago===met).reduce((a,m)=>a+Number(m.monto),0);
    const gas=allMovimientos.filter(m=>m.tipo==='gasto'&&m.metodo_pago===met).reduce((a,m)=>a+Number(m.monto),0);
    const neto=ing-gas;
    const el=document.getElementById('c-'+met);
    if(el){
      el.textContent=(neto<0?'-':'')+'$'+Math.abs(neto).toLocaleString('es-MX',{minimumFractionDigits:2});
      el.style.color=neto<0?'var(--red)':colores[met];
    }
  });
  actualizarReservasUI();
}

function filtrarMovimientos(tipo){
  contTipo=tipo;
  ['todos','ingresos','gastos','cobrar'].forEach(t=>{
    const btn=document.getElementById('tab-'+t);
    if(btn){btn.className=t===tipo?'btn-blue btn-sm':'btn-ghost btn-sm';}
  });
  if(tipo==='cobrar'){
    const ordenesConIngreso=new Set(allMovimientos.filter(m=>m.orden_id).map(m=>m.orden_id));
    const porCobrar=allOrdenes.filter(o=>['listo','entregado'].includes(o.estado)&&!ordenesConIngreso.has(o.id));
    renderCobrar(porCobrar);
  } else {
    const sinAjuste=allMovimientos.filter(m=>m.categoria!=='Ajuste Maestro');
    const list=tipo==='todos'?sinAjuste:sinAjuste.filter(m=>m.tipo===tipo);
    renderMovimientos(list);
  }
}

function renderMovimientos(list){
  const metodoLabel={efectivo:'\U0001f4b5 Efectivo',transferencia:'\U0001f3e6 Transferencia',tarjeta_banamex:'\U0001f4b3 Banamex',tarjeta_banorte:'\U0001f4b3 Banorte',mercadopago:'\U0001f4f2 MercadoPago',paypal:'\U0001f17f\ufe0f PayPal',otro:'\U0001f4b1 Otro'};
  // desktop
  const tbody=document.getElementById('tabla-cont');
  if(tbody) tbody.innerHTML=list.length?list.map(m=>`
    <tr style="box-shadow:inset 3px 0 0 ${m.tipo==='ingreso'?'var(--green)':'var(--red)'};">
      <td style="font-family:var(--mono);font-size:0.78rem;color:var(--text-dim);white-space:nowrap;">${fmtFechaContab(m.fecha)}</td>
      <td><span class="badge badge-${m.tipo}">${m.tipo==='ingreso'?'\u2191 Ingreso':'\u2193 Gasto'}</span></td>
      <td style="font-size:0.82rem;">${m.categoria}</td>
      <td><div style="font-size:0.85rem;">${m.descripcion}</div>${m.ordenes?`<div style="font-size:0.72rem;color:var(--blue);">#${m.ordenes.folio}</div>`:''}</td>
      <td style="font-size:0.82rem;color:var(--text-dim);white-space:nowrap;">${metodoLabel[m.metodo_pago]||m.metodo_pago}</td>
      <td style="font-family:var(--mono);font-weight:700;color:${m.tipo==='ingreso'?'var(--green)':'var(--red)'};">${m.tipo==='ingreso'?'+':'-'}$${Number(m.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
      <td><div style="display:flex;gap:0.4rem;"><button class="btn-ghost btn-sm" onclick="editarMovimiento('${m.id}')">✏</button><button class="btn-red btn-sm" onclick="eliminarMovimiento('${m.id}')">&#x2715;</button></div></td>
    </tr>`).join(''):`<tr class="empty-row"><td colspan="7">Sin movimientos</td></tr>`;
  // mobile
  const mob=document.getElementById('mobile-cont');
  if(mob) mob.innerHTML=list.length?list.map(m=>`
    <div class="m-card" style="cursor:default;">
      <div class="m-card-top">
        <span class="badge badge-${m.tipo}">${m.tipo==='ingreso'?'\u2191 Ingreso':'\u2193 Gasto'}</span>
        <span style="font-family:var(--mono);font-weight:700;color:${m.tipo==='ingreso'?'var(--green)':'var(--red)'};">${m.tipo==='ingreso'?'+':'-'}$${Number(m.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
      </div>
      <div style="font-weight:500;margin:0.4rem 0;">${m.descripcion}</div>
      <div style="font-size:0.78rem;color:var(--text-dim);">${m.categoria} \u00b7 ${metodoLabel[m.metodo_pago]||m.metodo_pago} \u00b7 ${fmtFechaContab(m.fecha)}</div>
      ${m.ordenes?`<div style="font-size:0.75rem;color:var(--blue);margin-top:0.2rem;">Orden #${m.ordenes.folio}</div>`:''}
      <div class="m-card-actions"><button class="btn-ghost btn-sm" onclick="editarMovimiento('${m.id}')">✏ Editar</button><button class="btn-red" onclick="eliminarMovimiento('${m.id}')">&#x2715; Eliminar</button></div>
    </div>`).join(''):'<div style="text-align:center;color:var(--text-dim);padding:2rem;">Sin movimientos</div>';
}

function renderCobrar(ordenes){
  const tbody=document.getElementById('tabla-cont');
  if(tbody) tbody.innerHTML=ordenes.length?ordenes.map(o=>`
    <tr onclick="verDetalle('${o.id}')" style="cursor:pointer;">
      <td style="font-size:0.78rem;color:var(--text-dim);">${fmtFecha(o.fecha_ingreso)}</td>
      <td><span class="badge badge-listo">Por Cobrar</span></td>
      <td>${o.clientes?.nombre||'?'}</td>
      <td>${o.marca} ${o.modelo||''}</td>
      <td><span style="font-family:var(--mono);font-size:0.8rem;color:var(--blue);">#${o.folio}</span></td>
      <td style="font-family:var(--mono);font-weight:700;color:var(--yellow);">$${Number(o.costo_estimado||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
      <td><button class="btn-blue btn-sm" onclick="event.stopPropagation();registrarCobroOrden('${o.id}')">Cobrar</button></td>
    </tr>`).join(''):`<tr class="empty-row"><td colspan="7">Todo cobrado</td></tr>`;
  const mob=document.getElementById('mobile-cont');
  if(mob) mob.innerHTML=ordenes.length?ordenes.map(o=>`
    <div class="m-card" onclick="verDetalle('${o.id}')">
      <div class="m-card-top"><span class="m-card-folio">#${o.folio}</span><span class="badge badge-listo">Por cobrar</span></div>
      <div class="m-card-name">${o.clientes?.nombre||'?'}</div>
      <div class="m-card-equipo">${o.marca} ${o.modelo||''}</div>
      <div class="m-card-bottom">
        <span style="font-family:var(--mono);color:var(--yellow);font-weight:700;">$${Number(o.costo_estimado||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
        <button class="btn-blue btn-sm" onclick="event.stopPropagation();registrarCobroOrden('${o.id}')">Cobrar</button>
      </div>
    </div>`).join(''):'<div style="text-align:center;color:var(--text-dim);padding:2rem;">Todo cobrado</div>';
}

let cobroOrdenId=null, cobroMetodo=null;

function registrarCobroOrden(ordenId){
  const o=allOrdenes.find(x=>x.id===ordenId);
  if(!o)return;
  cobroOrdenId=ordenId;
  cobroMetodo=null;
  // Reset buttons
  document.querySelectorAll('.cobro-btn').forEach(b=>{
    b.style.borderColor='var(--border)';
    b.style.background='var(--bg3)';
  });
  document.getElementById('btn-confirmar-cobro').disabled=true;
  document.getElementById('btn-confirmar-cobro').style.opacity='0.5';
  // Info de la orden
  const monto=o.costo_final||o.costo_estimado||0;
  document.getElementById('cobro-info').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-weight:600;">${o.clientes?.nombre||'?'}</div>
        <div style="color:var(--text-dim);font-size:0.8rem;">${o.marca} ${o.modelo||''} — Orden #${o.folio}</div>
      </div>
      <div style="font-family:var(--mono);font-size:1.2rem;font-weight:700;color:var(--green);">$${Number(monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
    </div>`;
  document.getElementById('modal-cobro').classList.add('open');
}

function seleccionarMetodoCobro(metodo){
  cobroMetodo=metodo;
  document.querySelectorAll('.cobro-btn').forEach(b=>{
    b.style.borderColor='var(--border)';
    b.style.background='var(--bg3)';
  });
  event.currentTarget.style.borderColor='var(--blue)';
  event.currentTarget.style.background='rgba(10,132,255,0.12)';
  document.getElementById('btn-confirmar-cobro').disabled=false;
  document.getElementById('btn-confirmar-cobro').style.opacity='1';
}

async function confirmarCobro(){
  if(!cobroOrdenId||!cobroMetodo)return;
  const o=allOrdenes.find(x=>x.id===cobroOrdenId);
  if(!o)return;
  const monto=o.costo_final||o.costo_estimado||0;
  const{error}=await sb.from('contabilidad').insert([{
    tipo:'ingreso',categoria:'Reparación',
    descripcion:`Cobro reparación #${o.folio} — ${o.marca} ${o.modelo||''} — ${o.clientes?.nombre||'?'}`,
    monto,orden_id:cobroOrdenId,cliente_id:o.cliente_id,
    fecha:new Date().toISOString().split('T')[0],
    metodo_pago:cobroMetodo,registrado_por:currentUser
  }]);
  if(error){notif('Error al registrar cobro','error');return;}
  closeModal('modal-cobro');
  const metodoLabel={efectivo:'💵 Efectivo',tarjeta_banamex:'💳 Banamex',tarjeta_banorte:'💳 Banorte',transferencia:'🏦 Transferencia',mercadopago:'📱 MercadoPago',otro:'💱 Otro'};
  notif(`✓ $${Number(monto).toLocaleString('es-MX')} cobrado — ${metodoLabel[cobroMetodo]}`,'success');
  cobroOrdenId=null;cobroMetodo=null;
  loadContabilidad();
}

function renderGrafica(){
  const canvas=document.getElementById('grafica-cont');
  if(!canvas)return;
  // Últimos 6 meses
  const meses=[];
  for(let i=5;i>=0;i--){
    const d=new Date();d.setMonth(d.getMonth()-i);
    meses.push(d.toISOString().substring(0,7));
  }
  const labels=meses.map(m=>{const[y,mo]=m.split('-');return new Date(y,mo-1).toLocaleDateString('es-MX',{month:'short'});});
  const dataIngresos=meses.map(m=>allMovimientos.filter(x=>x.tipo==='ingreso'&&x.fecha.startsWith(m)&&x.categoria!=='Ajuste Maestro').reduce((a,x)=>a+Number(x.monto),0));
  const dataGastos=meses.map(m=>allMovimientos.filter(x=>x.tipo==='gasto'&&x.fecha.startsWith(m)&&x.categoria!=='Ajuste Maestro').reduce((a,x)=>a+Number(x.monto),0));
  if(graficaChart)graficaChart.destroy();
  graficaChart=new Chart(canvas,{
    type:'bar',
    data:{labels,datasets:[
      {label:'Ingresos',data:dataIngresos,backgroundColor:'rgba(48,209,88,0.7)',borderRadius:6},
      {label:'Gastos',data:dataGastos,backgroundColor:'rgba(255,69,58,0.7)',borderRadius:6}
    ]},
    options:{responsive:true,plugins:{legend:{labels:{color:getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim(),font:{size:11}}}},scales:{x:{ticks:{color:getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim()},grid:{color:document.documentElement.getAttribute('data-theme')==='light'?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.05)'}},y:{ticks:{color:getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim(),callback:v=>'$'+v.toLocaleString('es-MX')},grid:{color:document.documentElement.getAttribute('data-theme')==='light'?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.05)'}}}}
  });
  renderGraficaCategorias();
}

function renderGraficaCategorias(){
  const canvas=document.getElementById('grafica-categorias');
  if(!canvas)return;
  const gastos=allMovimientos.filter(x=>x.tipo==='gasto'&&x.categoria!=='Ajuste Maestro');
  if(!gastos.length){if(graficaCategChart)graficaCategChart.destroy();document.getElementById('categ-lista').innerHTML='';return;}
  const cats={};
  gastos.forEach(g=>{const cc=g.categoria||'Otro';cats[cc]=(cats[cc]||0)+Number(g.monto);});
  const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const totalGastos=sorted.reduce((a,[,v])=>a+v,0);
  const colors=['#FF453A','#FF6B00','#FFD60A','#0A84FF','#BF5AF2','#30D158','#FF9F0A','#64C8FF','#FF2D55','#34C759'];
  if(graficaCategChart)graficaCategChart.destroy();
  graficaCategChart=new Chart(canvas,{
    type:'doughnut',
    data:{
      labels:sorted.map(([k])=>k),
      datasets:[{data:sorted.map(([,v])=>v),backgroundColor:colors.slice(0,sorted.length),borderWidth:2,borderColor:getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim(),hoverOffset:8}]
    },
    options:{responsive:true,maintainAspectRatio:false,cutout:'58%',
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:ctx=>' $'+Number(ctx.raw).toLocaleString('es-MX',{minimumFractionDigits:2})+' ('+(ctx.raw/totalGastos*100).toFixed(1)+'%)'}}
      },
      onClick:(evt,elements)=>{if(elements.length)abrirDetalleCategoria(sorted[elements[0].index][0]);},
      onHover:(evt,el)=>{canvas.style.cursor=el.length?'pointer':'default';}
    }
  });
  // Lista lateral con barras
  const lista=document.getElementById('categ-lista');
  if(lista){
    lista.innerHTML=sorted.map(([k,v],i)=>{
      const pct=(v/totalGastos*100).toFixed(1);
      return `<div onclick="abrirDetalleCategoria('${k}')" style="cursor:pointer;padding:0.5rem 0.6rem;border-radius:8px;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;">
          <div style="display:flex;align-items:center;gap:0.4rem;">
            <div style="width:10px;height:10px;border-radius:50%;background:${colors[i%colors.length]};flex-shrink:0;"></div>
            <span style="font-size:0.78rem;">${k}</span>
          </div>
          <span style="font-family:var(--mono);font-size:0.75rem;color:var(--red);">-$${Number(v).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;">
          <div style="height:4px;border-radius:2px;background:${colors[i%colors.length]};width:${pct}%;transition:width 0.4s;"></div>
        </div>
        <div style="font-size:0.68rem;color:var(--text-dim);margin-top:0.15rem;">${pct}% del total</div>
      </div>`;
    }).join('');
  }
}

function abrirDetalleCategoria(cat){
  const gastosCat=allMovimientos.filter(m=>m.tipo==='gasto'&&(m.categoria||'Otro')===cat).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  const total=gastosCat.reduce((a,m)=>a+Number(m.monto),0);
  const dias=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  function fd(f){if(!f)return'?';const d=new Date(f+'T12:00:00');return dias[d.getDay()]+' '+String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');}
  const metL={efectivo:'💵 Efectivo',transferencia:'🏦 Transferencia',tarjeta_banamex:'💳 Banamex',tarjeta_banorte:'💳 Banorte',mercadopago:'📲 MercadoPago',paypal:'🅿️ PayPal',otro:'💱 Otro'};
  document.getElementById('modal-categ-title').textContent='📂 '+cat;
  document.getElementById('modal-categ-total').textContent='Total: $'+total.toLocaleString('es-MX',{minimumFractionDigits:2})+' · '+gastosCat.length+' movimiento'+(gastosCat.length!==1?'s':'');
  document.getElementById('modal-categ-body').innerHTML=gastosCat.length?gastosCat.map(m=>`
    <tr>
      <td style="font-family:var(--mono);font-size:0.75rem;color:var(--text-dim);white-space:nowrap;">${fd(m.fecha)}</td>
      <td style="font-size:0.85rem;">${m.descripcion}</td>
      <td style="font-size:0.8rem;color:var(--text-dim);white-space:nowrap;">${metL[m.metodo_pago]||m.metodo_pago}</td>
      <td style="font-family:var(--mono);font-weight:700;color:var(--red);white-space:nowrap;">-$${Number(m.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
    </tr>`).join(''):`<tr class="empty-row"><td colspan="4">Sin gastos</td></tr>`;
  document.getElementById('modal-categ').classList.add('open');
}

let editingContId=null, contTipoActual='ingreso';
function openNuevoMovimiento(tipo){
  editingContId=null;
  contTipoActual=tipo;
  document.getElementById('modal-cont-title').textContent=tipo==='ingreso'?'Nuevo Ingreso':'Nuevo Gasto';
  const tit=document.getElementById('modal-cont-title');tit.style.borderBottom=tipo==='ingreso'?'2px solid rgba(48,209,88,0.5)':'2px solid rgba(255,69,58,0.5)';tit.style.paddingBottom='0.75rem';
  document.getElementById('btn-guardar-cont').textContent='Guardar';
  document.getElementById('cont-categoria').value='';
  document.getElementById('cont-monto').value='';
  document.getElementById('cont-descripcion').value='';
  document.getElementById('cont-fecha').value=new Date().toISOString().split('T')[0];
  document.getElementById('cont-metodo').value='efectivo';
  document.getElementById('cont-notas').value='';
  document.getElementById('cont-orden').value='';
  document.getElementById('opt-ingresos').style.display=tipo==='ingreso'?'':'none';
  document.getElementById('opt-gastos').style.display=tipo==='gasto'?'':'none';
  poblarSelectOrdenes();
  document.getElementById('modal-cont').classList.add('open');
}

async function guardarMovimiento(){
  const monto=parseFloat(document.getElementById('cont-monto').value);
  const desc=document.getElementById('cont-descripcion').value.trim();
  const cat=document.getElementById('cont-categoria').value;
  if(!monto||!desc||!cat){notif('Completa monto, categoría y descripción','error');return;}
  // Avisar si ingreso sin OT ligada
  const ordenVal=document.getElementById('cont-orden').value;
  if(contTipoActual==='ingreso'&&!editingContId&&!ordenVal){
    if(!confirm('Este ingreso no tiene una OT ligada. ¿Deseas guardarlo sin orden de trabajo?'))return;
  }
  const data={
    tipo:contTipoActual,categoria:cat,descripcion:desc,monto,
    fecha:document.getElementById('cont-fecha').value,
    metodo_pago:document.getElementById('cont-metodo').value,
    notas:document.getElementById('cont-notas').value.trim(),
    orden_id:document.getElementById('cont-orden').value||null,
    registrado_por:currentUser
  };
  let error;
  if(editingContId){
    ({error}=await sb.from('contabilidad').update(data).eq('id',editingContId));
  } else {
    ({error}=await sb.from('contabilidad').insert([data]));
  }
  if(error){notif('Error: '+error.message,'error');return;}
  closeModal('modal-cont');
  notif(editingContId?'Movimiento actualizado':''+contTipoActual==='ingreso'?'Ingreso registrado':'Gasto registrado','success');
  editingContId=null;
  loadContabilidad();
}

function editarMovimiento(id){
  const m=allMovimientos.find(x=>x.id===id);
  if(!m)return;
  editingContId=id;
  contTipoActual=m.tipo;
  document.getElementById('modal-cont-title').textContent=m.tipo==='ingreso'?'Editar Ingreso':'Editar Gasto';
  const titE=document.getElementById('modal-cont-title');titE.style.borderBottom=m.tipo==='ingreso'?'2px solid rgba(48,209,88,0.5)':'2px solid rgba(255,69,58,0.5)';titE.style.paddingBottom='0.75rem';
  document.getElementById('btn-guardar-cont').textContent='Actualizar';
  document.getElementById('cont-monto').value=m.monto;
  document.getElementById('cont-descripcion').value=m.descripcion||'';
  document.getElementById('cont-fecha').value=m.fecha||'';
  document.getElementById('cont-metodo').value=m.metodo_pago||'efectivo';
  document.getElementById('cont-notas').value=m.notas||'';
  document.getElementById('cont-orden').value=m.orden_id||'';
  document.getElementById('opt-ingresos').style.display=m.tipo==='ingreso'?'':'none';
  document.getElementById('opt-gastos').style.display=m.tipo==='gasto'?'':'none';
  document.getElementById('cont-categoria').value=m.categoria||'';
  poblarSelectOrdenes();
  document.getElementById('modal-cont').classList.add('open');
}

async function eliminarMovimiento(id){
  if(!confirm('¿Eliminar este movimiento?'))return;
  const{error}=await sb.from('contabilidad').delete().eq('id',id);
  if(error){notif('Error','error');return;}
  notif('Movimiento eliminado','success');
  loadContabilidad();
}

// ── HELPERS ──────────────────────────────────────────────────

// ── RESERVAS ──────────────────────────────────────────────────

function abrirGestionReservas(metodo){
  if(currentUser!=='Alan')return;
  reservaMetodoActual=metodo;
  const labels={efectivo:'Efectivo',tarjeta_banamex:'Banamex',tarjeta_banorte:'Banorte'};
  document.getElementById('modal-reservas-title').textContent='Reservas — '+labels[metodo];
  document.getElementById('res-nombre').value='';
  document.getElementById('res-monto').value='';
  renderListaReservas();
  document.getElementById('modal-reservas').classList.add('open');
}

function renderListaReservas(){
  const lista=document.getElementById('lista-reservas');
  const items=allReservas.filter(r=>r.metodo===reservaMetodoActual);
  lista.innerHTML=items.length
    ?items.map(r=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0.75rem;background:var(--bg3);border-radius:8px;">
        <div>
          <div style="font-size:0.85rem;font-weight:500;">${r.nombre}</div>
          <div style="font-family:var(--mono);font-size:0.78rem;color:var(--red);">-$${Number(r.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
        </div>
        <button class="btn-red btn-sm" onclick="eliminarReserva('${r.id}')">✕</button>
      </div>`).join('')
    :'<div style="color:var(--text-dim);font-size:0.82rem;text-align:center;padding:1rem;">Sin reservas</div>';
}

async function guardarReserva(){
  const nombre=document.getElementById('res-nombre').value.trim();
  const monto=parseFloat(document.getElementById('res-monto').value);
  if(!nombre||!monto||monto<=0){notif('Completa nombre y monto','error');return;}
  const{error}=await sb.from('reservas').insert([{metodo:reservaMetodoActual,nombre,monto}]);
  if(error){notif('Error: '+error.message,'error');return;}
  document.getElementById('res-nombre').value='';
  document.getElementById('res-monto').value='';
  notif('Reserva agregada','success');
  const{data}=await sb.from('reservas').select('*').eq('activo',true).order('created_at');
  allReservas=data||[];
  renderListaReservas();
  actualizarReservasUI();
}

async function eliminarReserva(id){
  const{error}=await sb.from('reservas').update({activo:false}).eq('id',id);
  if(error){notif('Error: '+error.message,'error');return;}
  allReservas=allReservas.filter(r=>r.id!==id);
  renderListaReservas();
  actualizarReservasUI();
}

function actualizarReservasUI(){
  const mapa=[
    {met:'efectivo',elId:'reservas-efectivo',cId:'c-efectivo'},
    {met:'tarjeta_banamex',elId:'reservas-banamex',cId:'c-tarjeta_banamex'},
    {met:'tarjeta_banorte',elId:'reservas-banorte',cId:'c-tarjeta_banorte'}
  ];
  mapa.forEach(({met,elId,cId})=>{
    const el=document.getElementById(elId);
    if(!el)return;
    const items=allReservas.filter(r=>r.metodo===met);
    if(!items.length){el.innerHTML='';return;}
    const totalReservado=items.reduce((a,r)=>a+Number(r.monto),0);
    const saldoEl=document.getElementById(cId);
    const raw=saldoEl?saldoEl.textContent.replace(/[$,\s]/g,''):'0';
    const saldoNeto=parseFloat(raw)||0;
    const disponible=saldoNeto-totalReservado;
    el.innerHTML=`<div style="border-top:1px solid var(--border);margin-top:0.4rem;padding-top:0.4rem;">
      ${items.map(r=>`<div style="display:flex;justify-content:space-between;padding:0.1rem 0;">
        <span style="color:var(--text-dim);">📌 ${r.nombre}</span>
        <span style="font-family:var(--mono);color:var(--red);">-$${Number(r.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
      </div>`).join('')}
      <div style="display:flex;justify-content:space-between;margin-top:0.35rem;padding-top:0.35rem;border-top:1px dashed rgba(255,255,255,0.08);">
        <span style="color:var(--text-dim);">Disponible</span>
        <span style="font-family:var(--mono);font-weight:700;color:${disponible>=0?'inherit':'var(--red)'};">${disponible<0?'-':''}$${Math.abs(disponible).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
      </div>
    </div>`;
  });

  // Liquidez inmediata: Efectivo + Banorte + Banamex disponible
  const efEl=document.getElementById('c-efectivo');
  const bnEl=document.getElementById('c-tarjeta_banorte');
  const bmxEl=document.getElementById('c-tarjeta_banamex');
  const saldoEf=parseFloat(efEl?efEl.textContent.replace(/[$,\s]/g,''):'0')||0;
  const saldoBn=parseFloat(bnEl?bnEl.textContent.replace(/[$,\s]/g,''):'0')||0;
  const saldoBmx=parseFloat(bmxEl?bmxEl.textContent.replace(/[$,\s]/g,''):'0')||0;
  const resEf=allReservas.filter(r=>r.metodo==='efectivo').reduce((a,r)=>a+Number(r.monto),0);
  const resBn=allReservas.filter(r=>r.metodo==='tarjeta_banorte').reduce((a,r)=>a+Number(r.monto),0);
  const resBmx=allReservas.filter(r=>r.metodo==='tarjeta_banamex').reduce((a,r)=>a+Number(r.monto),0);
  const dispEf=saldoEf-resEf;
  const dispBn=saldoBn-resBn;
  const dispBmx=saldoBmx-resBmx;
  const liquidez=dispEf+dispBn+dispBmx;
  const lEl=document.getElementById('c-liquidez');
  const lDet=document.getElementById('liquidez-detalle');
  if(lEl){
    lEl.textContent=(liquidez<0?'-':'')+'$'+Math.abs(liquidez).toLocaleString('es-MX',{minimumFractionDigits:2});
    lEl.style.color=liquidez>=0?'var(--blue)':'var(--red)';
  }
  if(lDet){
    const fmtLine=(label,val)=>`<div style="display:flex;gap:0.75rem;justify-content:flex-end;"><span>${label}</span><span style="font-family:var(--mono);color:${val>=0?'inherit':'var(--red)'};">${val<0?'-':''}$${Math.abs(val).toLocaleString('es-MX',{minimumFractionDigits:2})}</span></div>`;
    lDet.innerHTML=fmtLine('💵 Efectivo disp.',dispEf)+fmtLine('💳 Banorte disp.',dispBn)+fmtLine('🏧 Banamex disp.',dispBmx);
  }
}

function abrirAjuste(target){
  if(currentUser!=='Alan')return;
  ajusteTarget=target;
  const cfg=ajusteConfig[target];
  document.getElementById('ajuste-modal-title').textContent='⚙️ Ajuste — '+cfg.label;
  document.getElementById('ajuste-monto').value='';
  document.getElementById('ajuste-razon').value='';
  document.getElementById('ajuste-fecha').value=new Date().toISOString().split('T')[0];
  // Preset método según target
  const metSel=document.getElementById('ajuste-metodo');
  metSel.value=cfg.metodoDefault||'efectivo';
  selAjusteTipo('sumar');
  actualizarPreviewAjuste();
  document.getElementById('ajuste-monto').addEventListener('input',actualizarPreviewAjuste);
  document.getElementById('modal-ajuste').classList.add('open');
}

function selAjusteTipo(t){
  ajusteTipo=t;
  const bs=document.getElementById('ajuste-btn-sumar');
  const br=document.getElementById('ajuste-btn-restar');
  if(t==='sumar'){
    bs.style.background='rgba(48,209,88,0.12)';bs.style.borderColor='rgba(48,209,88,0.4)';bs.style.color='var(--green)';
    br.style.background='transparent';br.style.borderColor='var(--border)';br.style.color='var(--text-dim)';
  } else {
    br.style.background='rgba(255,69,58,0.12)';br.style.borderColor='rgba(255,69,58,0.4)';br.style.color='var(--red)';
    bs.style.background='transparent';bs.style.borderColor='var(--border)';bs.style.color='var(--text-dim)';
  }
  actualizarPreviewAjuste();
}

function actualizarPreviewAjuste(){
  const monto=parseFloat(document.getElementById('ajuste-monto').value)||0;
  const cfg=ajusteConfig[ajusteTarget]||{};
  const prev=document.getElementById('ajuste-preview');
  if(!monto){prev.textContent='—';prev.style.color='var(--text)';return;}
  const signo=ajusteTipo==='sumar'?'+':'-';
  const color=ajusteTipo==='sumar'?'var(--green)':'var(--red)';
  prev.textContent=`${signo}$${monto.toLocaleString('es-MX',{minimumFractionDigits:2})} en ${cfg.label||ajusteTarget}`;
  prev.style.color=color;
}

async function aplicarAjuste(){
  const monto=parseFloat(document.getElementById('ajuste-monto').value);
  const razon=document.getElementById('ajuste-razon').value.trim();
  if(!monto||monto<=0){notif('Ingresa un monto válido','error');return;}
  if(!razon){notif('Escribe la razón del ajuste','error');return;}

  const cfg=ajusteConfig[ajusteTarget];
  const metodo=document.getElementById('ajuste-metodo').value;
  const fecha=document.getElementById('ajuste-fecha').value;

  // Para ingresos/gastos directos, usar tipo_mov del config
  // Para métodos de pago, el tipo determina si suma o resta el saldo de ese método
  let tipo_mov;
  if(ajusteTarget==='ingresos'){
    tipo_mov=ajusteTipo==='sumar'?'ingreso':'gasto';
  } else if(ajusteTarget==='gastos'){
    tipo_mov=ajusteTipo==='sumar'?'gasto':'ingreso';
  } else {
    // Para método específico: sumar = ingreso en ese método, restar = gasto en ese método
    tipo_mov=ajusteTipo==='sumar'?'ingreso':'gasto';
  }

  const data={
    tipo:tipo_mov,
    categoria:'Ajuste Maestro',
    descripcion:`[AJUSTE] ${cfg.label} — ${razon}`,
    monto,fecha,
    metodo_pago:metodo,
    notas:`Ajuste manual aplicado por Alan (Maestro) — ${ajusteTipo==='sumar'?'suma':'resta'} en ${cfg.label}`,
    registrado_por:'Alan'
  };

  const{error}=await sb.from('contabilidad').insert([data]);
  if(error){notif('Error al aplicar ajuste: '+error.message,'error');return;}
  closeModal('modal-ajuste');
  notif(`✓ Ajuste aplicado: ${ajusteTipo==='sumar'?'+':'-'}$${monto.toLocaleString('es-MX')} en ${cfg.label}`,'success');
  loadContabilidad();
}
// Registrar Service Worker para PWA
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

