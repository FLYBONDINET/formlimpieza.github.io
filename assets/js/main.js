const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

(function ensureConfig(){
  if (!('WEB_APP_URL' in window) || typeof WEB_APP_URL !== 'string' || !WEB_APP_URL.startsWith('http')) {
    console.error('WEB_APP_URL no está definido o es inválido. Verificá assets/js/config.js o el fallback inline.');
    // No alert acá (ya hay uno al enviar), pero podés descomentar si querés ser más estricto:
    // alert('WEB_APP_URL no definido. Verificá assets/js/config.js.');
  }
})();

const pad2 = n => String(n).padStart(2,'0');
const nowISO = () => { const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
const nowTime = () => { const d=new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const fmtISO = x => {
  if(!x) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
  const d=new Date(x);
  if(isNaN(d)) return x;
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
};
const fmtHHMM = x => {
  if(!x) return '';
  const m=/^(\d{2}):(\d{2})(?::\d{2})?$/.exec(x);
  if(m) return `${m[1]}:${m[2]}`;
  try{
    const d=new Date('1970-01-01T'+x);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }catch{ return x; }
};

// Matrículas de ejemplo
const MATRICULAS=[
  "LV-KAY","LV-KAH","LV-KJD","LV-KJE","LV-KCE","LV-KEH","LV-KEG","LV-KJF","LV-HKS","LV-AAR",
  "LV-KFW","LV-PPM","LY-MLN","LY-MLI","LY-MLK","LY-MLJ","LY-MLI","LY-MLG","LY-MLD","LY-NVL",
  "LY-VEL","PR-MLD","PR-NVN"
];
function fillMatriculas(sel){
  sel.innerHTML='<option value="">Seleccionar…</option>' + MATRICULAS.map(m=>`<option>${m}</option>`).join('');
}

/* Signature pad */
class SigPad{
  constructor(canvas){
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d');
    this.drawing=false;
    this.resize();
    window.addEventListener('resize',()=>this.resize());
    canvas.addEventListener('pointerdown',e=>this.start(e));
    canvas.addEventListener('pointermove',e=>this.move(e));
    canvas.addEventListener('pointerup',()=>this.end());
    canvas.addEventListener('pointerleave',()=>this.end());
  }
  resize(){
    const r=this.canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    this.canvas.width=r.width*dpr; this.canvas.height=r.height*dpr;
    this.ctx.setTransform(1,0,0,1,0,0); this.ctx.scale(dpr,dpr);
    this.ctx.lineWidth=2; this.ctx.lineCap='round'; this.ctx.strokeStyle='#111';
  }
  start(e){ this.drawing=true; this.ctx.beginPath(); this.ctx.moveTo(e.offsetX,e.offsetY); }
  move(e){ if(!this.drawing) return; this.ctx.lineTo(e.offsetX,e.offsetY); this.ctx.stroke(); }
  end(){ this.drawing=false; }
  clear(){ this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height); }
  toDataURL(){ return this.canvas.toDataURL('image/png'); }
}

/* ---- Index (alta) ---- */
async function initIndex(){
  const fecha=$('#fecha'), matricula=$('#matricula'), horaIni=$('#horaInicio'), horaFin=$('#horaFin');
  const sig=new SigPad($('#firmaLimpieza'));

  fillMatriculas(matricula);
  fecha.value=nowISO();
  $('#btnInicio')?.addEventListener('click',()=>horaIni.value=nowTime());
  $('#btnFin')?.addEventListener('click',()=>horaFin.value=nowTime());
  $('#btnClearSig')?.addEventListener('click',()=>sig.clear());

  $('#cleaningForm')?.addEventListener('submit', async ev=>{
    ev.preventDefault();
    if(!window.WEB_APP_URL){
      alert('WEB_APP_URL no definido. Verificá assets/js/config.js o el fallback inline en el HTML.');
      return;
    }
    const fd=new FormData(ev.target);
    fd.append('action','submitCleaning');
    fd.append('firmaLimpiezaDataURL', sig.toDataURL());

    const res=await fetch(WEB_APP_URL,{method:'POST', body:fd});
    let data=null; try{ data=await res.json(); }catch{}
    if(res.ok && data && data.ok){
      alert('Registro enviado. ID: '+data.id);
      location.href='review.html?id='+encodeURIComponent(data.id);
    }else{
      alert('Error al enviar. Revisá consola.');
      console.error('HTTP', res.status, res.statusText, data);
    }
  });
}

/* ---- List ---- */
let _rows=[];

function renderRowsInto(tbody, rows){
  tbody.innerHTML='';
  if(rows.length===0){
    tbody.innerHTML='<tr><td colspan="7" class="center">Sin resultados</td></tr>';
    return;
  }
  for(const r of rows){
    const cerrado=(r.estado && r.estado!=='Pendiente de recepción');
    const tr=document.createElement('tr');
    tr.className=cerrado?'tr-cerr':'tr-pend';
    const pdfCell=r.pdf_file_id?`<a href="https://drive.google.com/open?id=${r.pdf_file_id}" target="_blank">PDF</a>`:'';
    tr.innerHTML=`
      <td class="center">${r.id??''}</td>
      <td class="center">${fmtISO(r.fecha_limpieza)}</td>
      <td class="center">${r.matricula??''}</td>
      <td class="center">${r.aeropuerto??''}</td>
      <td class="center">${r.tipo_limpieza??''}</td>
      <td class="center">
        <span class="badge ${r.estado==='No aceptada' ? 'badge-noacept' : ''}">
          ${r.estado??''}
        </span>
      </td>
      <td class="center table-actions">
        <a href="review.html?id=${encodeURIComponent(r.id)}">Ver</a>${pdfCell?' · '+pdfCell:''}
      </td>`;
    tbody.appendChild(tr);
  }
}

function applyFilters(){
  const q=($('#f_query').value||'').toLowerCase().trim();
  const f1=$('#f_from').value;
  const f2=$('#f_to').value;

  const filtered=_rows.filter(r=>{
    const hay=`${r.matricula||''} ${r.aeropuerto||''} ${r.tipo_limpieza||''} ${r.estado||''}`.toLowerCase();
    if(q && !hay.includes(q)) return false;
    const f=fmtISO(r.fecha_limpieza);
    if(f1 && f<f1) return false;
    if(f2 && f>f2) return false;
    return true;
  });

  const pend=filtered.filter(r=>r.estado==='Pendiente de recepción');
  const cerr=filtered.filter(r=>r.estado!=='Pendiente de recepción');

  const cardPend=$('#cardPend');
  if(pend.length===0){
    cardPend.style.display='none';
  }else{
    cardPend.style.display='';
    renderRowsInto($('#tbodyPend'), pend);
  }
  renderRowsInto($('#tbodyCerr'), cerr);
}

async function initList(){
  $('#tbodyPend').innerHTML='<tr><td colspan="7" class="center">Cargando…</td></tr>';
  $('#tbodyCerr').innerHTML='<tr><td colspan="7" class="center">Cargando…</td></tr>';
  if(!window.WEB_APP_URL){
    alert('WEB_APP_URL no definido. Verificá assets/js/config.js o el fallback inline en el HTML.');
    return;
  }
  try{
    const res=await fetch(WEB_APP_URL+'?action=list');
    const data=await res.json();
    if(!res.ok || !data || !data.ok){
      $('#tbodyPend').innerHTML='<tr><td colspan="7" class="center">Error al cargar</td></tr>';
      $('#tbodyCerr').innerHTML='<tr><td colspan="7" class="center">Error al cargar</td></tr>';
      return;
    }
    _rows=data.rows||[];

    // KPIs
    let total=_rows.length, acept=0, noacept=0, pend=0, mes=0, anio=0;
    const today=new Date();
    for(const r of _rows){
      const d=new Date(r.fecha_limpieza);
      if(!isNaN(d)){
        if(d.getMonth()===today.getMonth() && d.getFullYear()===today.getFullYear()) mes++;
        if(d.getFullYear()===today.getFullYear()) anio++;
      }
      if(r.estado==='Aceptada') acept++;
      else if(r.estado==='No aceptada') noacept++;
      else pend++;
    }
    $('#k_total').textContent=total;
    $('#k_acept').textContent=acept;
    $('#k_noacept').textContent=noacept;
    $('#k_pend').textContent=pend;
    $('#k_mes').textContent=mes;
    $('#k_anio').textContent=anio;

    $('#f_query').addEventListener('input', applyFilters);
    $('#f_from').addEventListener('change', applyFilters);
    $('#f_to').addEventListener('change', applyFilters);

    applyFilters();
  }catch(e){
    console.error(e);
    $('#tbodyPend').innerHTML='<tr><td colspan="7" class="center">Fallo de red</td></tr>';
    $('#tbodyCerr').innerHTML='<tr><td colspan="7" class="center">Fallo de red</td></tr>';
  }
}

/* ---- Review ---- */
function qs(name,def=null){ return new URL(location.href).searchParams.get(name) ?? def; }

async function initReview(){
  const id=qs('id');
  if(!id){ alert('Falta ID'); return; }
  if(!window.WEB_APP_URL){
    alert('WEB_APP_URL no definido. Verificá assets/js/config.js o el fallback inline en el HTML.');
    return;
  }
  const res=await fetch(WEB_APP_URL+'?action=getRecord&id='+encodeURIComponent(id));
  const data=await res.json();
  if(!data.ok){ alert('No encontrado'); return; }

  const r=data.row;
  const mapping={ fecha_limpieza:fmtISO(r.fecha_limpieza), hora_inicio:fmtHHMM(r.hora_inicio), hora_fin:fmtHHMM(r.hora_fin) };
  for(const [k,v] of Object.entries(r)){
    const el=$('#ro_'+k);
    if(!el) continue;
    el.textContent=(k in mapping)?mapping[k]:(v??'');
  }

  if(r.adjuntos_links){
    const cont=$('#adj_clean');
    r.adjuntos_links.split('\n').forEach(u=>{
      const a=document.createElement('a'); a.href=u; a.textContent='Archivo'; a.target='_blank';
      cont.appendChild(a); cont.appendChild(document.createTextNode(' '));
    });
  }

  if(r.pdf_file_id){
    const a=$('#pdf_link'); a.href='https://drive.google.com/open?id='+r.pdf_file_id; a.textContent='Abrir PDF';
  }

  // Form de recepción (bloqueo si ya está cerrado)
  const form=$('#recepForm');
  const sig=new SigPad($('#firmaRecepcion'));
  $('#recep_fecha').value=nowISO();
  $('#btnHoraRecep').addEventListener('click',()=>$('#recep_hora').value=nowTime());
  $('#btnBorrarFirmaR').addEventListener('click',()=>sig.clear());

  const cerrado=(r.estado && r.estado!=='Pendiente de recepción');
  if(cerrado){
    const banner=document.createElement('div');
    banner.className='banner-locked';
    banner.textContent='Registro cerrado: ya no se puede modificar. Solo lectura.';
    form.parentElement.insertBefore(banner, form);
    form.querySelectorAll('input,select,textarea,button').forEach(el=>{ if(el.tagName!=='A') el.disabled=true; });
  }

  form.addEventListener('submit', async ev=>{
    ev.preventDefault();
    const fd=new FormData(form);
    fd.append('action','submitReception');
    fd.append('id', id);
    fd.append('firmaRecepDataURL', sig.toDataURL());

    const res2=await fetch(WEB_APP_URL,{method:'POST', body:fd});
    const out=await res2.json();
    if(out.ok){
      alert('Recepción enviada.');
      location.reload();
    }else{
      alert('Error: '+(out.error||'desconocido'));
      console.error(out);
    }
  });
}

/* Bootstrap */
document.addEventListener('DOMContentLoaded', ()=>{
  if(document.body.dataset.page==='index') initIndex();
  if(document.body.dataset.page==='list')  initList();
  if(document.body.dataset.page==='review') initReview();
});
