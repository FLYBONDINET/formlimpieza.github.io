
const $ = (sel, root=document)=>root.querySelector(sel);
const pad2 = n => String(n).padStart(2,'0');
function nowISODate(){ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function nowTime(){ const d=new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

const MATRICULAS = [
  "LV-KAY","LV-KBD","LV-KBI","LV-KDR","LV-KDQ","LV-KEH","LV-KEL","LV-KES","LV-KGA","LV-KGN",
  "LV-KJD","LV-KJE","LV-KJP","LV-KQI","LV-KQK","LV-KEF","LV-HFR","LV-HQY","LV-KAH","LV-KAN",
  "LV-KKU","LV-KSZ","LV-KVG","LV-KVM","LV-KEA","LV-KMD","Otro"
];
function fillMatriculas(sel){
  sel.innerHTML = '<option value="">Seleccionar…</option>' + MATRICULAS.map(m=>`<option>${m}</option>`).join("");
}

class SigPad{
  constructor(canvas){
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.drawing=false;
    this.resize(); window.addEventListener('resize',()=>this.resize());
    canvas.addEventListener('pointerdown',e=>this.start(e));
    canvas.addEventListener('pointermove',e=>this.move(e));
    canvas.addEventListener('pointerup',e=>this.end(e));
    canvas.addEventListener('pointerleave',e=>this.end(e));
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

async function boot(){
  const fecha=$('#fecha'); const matricula=$('#matricula');
  const horaIni=$('#horaInicio'); const horaFin=$('#horaFin');
  const sigCanvas=$('#firmaLimpieza'); const sig=new SigPad(sigCanvas);
  fillMatriculas(matricula);
  fecha.value=nowISODate();
  $('#btnInicio').addEventListener('click', ()=>horaIni.value=nowTime());
  $('#btnFin').addEventListener('click', ()=>horaFin.value=nowTime());
  $('#btnClearSig').addEventListener('click', ()=>sig.clear());

  $('#cleaningForm').addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const fd = new FormData(ev.target);
    fd.append('action','submitCleaning');
    fd.append('firmaLimpiezaDataURL', sig.toDataURL());
    const res = await fetch(WEB_APP_URL, { method:'POST', body: fd });
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

document.addEventListener('DOMContentLoaded', boot);
