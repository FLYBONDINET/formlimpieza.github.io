
/* Helpers */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const qs = (name, def=null) => new URL(location.href).searchParams.get(name) ?? def;

function nowISODate(){ const d=new Date(); return d.toISOString().slice(0,10); }
function nowTime(){ const d=new Date(); return d.toTimeString().slice(0,8); }

const MATRICULAS = [
  "LV-KAY","LV-KBD","LV-KBI","LV-KDR","LV-KDQ","LV-KEH","LV-KEL","LV-KES","LV-KGA","LV-KGN",
  "LV-KJD","LV-KJE","LV-KJP","LV-KQI","LV-KQK","LV-KEF","LV-HFR","LV-HQY","LV-KAH","LV-KAN",
  "LV-KKU","LV-KSZ","LV-KVG","LV-KVM","LV-KEA","LV-KMD","Otro"
];

function fillMatriculas(select){
  select.innerHTML = '<option value="">Seleccionar…</option>' + MATRICULAS.map(m=>`<option>${m}</option>`).join("");
}

/* Signature Pad simple */
class SigPad {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.drawing = false;
    this.resize();
    window.addEventListener('resize', ()=>this.resize());
    canvas.addEventListener('pointerdown', e=>this.start(e));
    canvas.addEventListener('pointermove', e=>this.move(e));
    canvas.addEventListener('pointerup', e=>this.end(e));
    canvas.addEventListener('pointerleave', e=>this.end(e));
  }
  resize(){
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * ratio;
    this.canvas.height = rect.height * ratio;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.scale(ratio, ratio);
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = '#111';
  }
  start(e){ this.drawing=true; this.ctx.beginPath(); this.ctx.moveTo(e.offsetX, e.offsetY); }
  move(e){ if(!this.drawing) return; this.ctx.lineTo(e.offsetX, e.offsetY); this.ctx.stroke(); }
  end(e){ if(!this.drawing) return; this.drawing=false; }
  toDataURL(){ return this.canvas.toDataURL('image/png'); }
  clear(){ this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height); }
}

/* Limpieza - index.html */
async function initCleaning(){
  const form = $('#cleaningForm');
  const fecha = $('#fecha');
  const matricula = $('#matricula');
  const horaInicio = $('#horaInicio');
  const horaFin = $('#horaFin');
  const sigCanvas = $('#firmaLimpieza');
  const sig = new SigPad(sigCanvas);

  fecha.value = nowISODate();
  fillMatriculas(matricula);

  $('#btnInicio').addEventListener('click', ()=>{ horaInicio.value = nowTime(); });
  $('#btnFin').addEventListener('click', ()=>{ horaFin.value = nowTime(); });
  $('#btnBorrarFirma').addEventListener('click', ()=>sig.clear());

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    fd.append('action','submitCleaning');
    fd.append('firmaLimpiezaDataURL', sig.toDataURL());

    const res = await fetch(WEB_APP_URL, { method:'POST', body: fd });
    let data; try{ data = await res.json(); }catch{ data = null; }
    if(res.ok && data && data.ok){
      alert('Enviado OK. ID: '+data.id);
      location.href = 'review.html?id='+encodeURIComponent(data.id);
    } else {
      alert('Error al enviar. Revisa consola.');
      console.error('HTTP', res.status, res.statusText, 'Body:', data);
    }
  });
}

/* Listado - list.html (robusto) */
async function initList(){
  const tbody = $('#tbody');
  const setError = (msg)=>{ tbody.innerHTML = `<tr><td colspan="7">⚠️ ${msg}</td></tr>`; };

  try{
    tbody.innerHTML = '<tr><td colspan="7">Cargando…</td></tr>';
    const url = WEB_APP_URL + '?action=list';
    const res = await fetch(url, { method:'GET' });
    if(!res.ok){
      setError(`Error HTTP ${res.status} - ${res.statusText}. Verificá que la App Web permita "Cualquiera con el enlace".`);
      return;
    }
    const data = await res.json();
    if(!data || !data.ok){
      setError('Respuesta inesperada del servidor. Revisá la consola (F12) para detalles.');
      console.error('Respuesta:', data);
      return;
    }
    const rows = Array.isArray(data.rows) ? data.rows : [];
    tbody.innerHTML = '';
    if(rows.length === 0){
      setError('No hay registros aún. Cargá alguno desde "Nuevo".');
    }

    let total=0, aceptadas=0, noacept=0, pendientes=0, mes=0, anio=0;
    const today = new Date();

    for(const r of rows){
      total++;
      const f = new Date(r.fecha_limpieza);
      if(!isNaN(f)){
        if(f.getMonth()===today.getMonth() && f.getFullYear()===today.getFullYear()) mes++;
        if(f.getFullYear()===today.getFullYear()) anio++;
      }
      if(r.estado==='Aceptada') aceptadas++;
      else if(r.estado==='No aceptada') noacept++;
      else pendientes++;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.id ?? ''}</td>
        <td>${r.fecha_limpieza ?? ''}</td>
        <td>${r.matricula ?? ''}</td>
        <td>${r.escala ?? ''} / ${r.aeropuerto ?? ''}</td>
        <td>${r.tipo_limpieza ?? ''}</td>
        <td><span class="badge">${r.estado ?? ''}</span></td>
        <td><a href="review.html?id=${encodeURIComponent(r.id)}">Ver</a></td>
      `;
      tbody.appendChild(tr);
    }
    $('#k_total').textContent = total;
    $('#k_acept').textContent = aceptadas;
    $('#k_noacept').textContent = noacept;
    $('#k_pend').textContent = pendientes;
    $('#k_mes').textContent = mes;
    $('#k_anio').textContent = anio;

  }catch(err){
    console.error(err);
    setError('Fallo de red o CORS. Probá abrir la URL de la App Web con ?action=list para ver si responde JSON.');
  }
}

/* Review + Recepción - review.html */
async function initReview(){
  const id = qs('id');
  if(!id){ alert('Falta ID'); return; }

  const res = await fetch(WEB_APP_URL+'?action=getRecord&id='+encodeURIComponent(id));
  const data = await res.json();
  if(!data.ok){ alert('No encontrado'); return; }

  const r = data.row;
  for(const [k,v] of Object.entries(r)){
    const el = $('#ro_'+k);
    if(el) el.textContent = v ?? '';
  }

  if(r.adjuntos_links){
    const cont = $('#adj_clean');
    r.adjuntos_links.split('\\n').forEach(link=>{
      const a = document.createElement('a'); a.href=link; a.textContent='Archivo'; a.target='_blank';
      cont.appendChild(a); cont.appendChild(document.createTextNode(' '));
    });
  }
  if(r.pdf_fileId){
    const a = $('#pdf_link');
    a.href = 'https://drive.google.com/open?id='+r.pdf_fileId;
  }

  const form = $('#recepForm');
  const fechaR = $('#recep_fecha');
  const horaR = $('#recep_hora');
  const sigCanvas = $('#firmaRecepcion');
  const sig = new SigPad(sigCanvas);
  fechaR.value = nowISODate();
  $('#btnHoraRecep').addEventListener('click', ()=>{ horaR.value = nowTime(); });
  $('#btnBorrarFirmaR').addEventListener('click', ()=>sig.clear());

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    fd.append('action','submitReception');
    fd.append('id', id);
    fd.append('firmaRecepDataURL', sig.toDataURL());
    const res2 = await fetch(WEB_APP_URL, { method:'POST', body: fd });
    const out = await res2.json();
    if(out.ok){
      alert('Recepción enviada.');
      location.reload();
    } else {
      alert('Error: '+out.error);
    }
  });
}

/* bootstrap by page */
document.addEventListener('DOMContentLoaded', ()=>{
  if($('#cleaningForm')) initCleaning();
  if($('#listPage')) initList();
  if($('#recepForm')) initReview();
});
