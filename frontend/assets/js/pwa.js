/* assets/js/pwa.js */
window.PWAQueue = (function(){
  const KEY = 'flybondi_queue_v1';
  const URL = window.WEB_APP_URL;

  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch{ return []; } }
  function save(q){ localStorage.setItem(KEY, JSON.stringify(q)); }

  function toFormData(obj){
    const fd = new FormData();
    Object.entries(obj).forEach(([k,v]) => fd.append(k, v));
    return fd;
  }

  async function process(){
    if (!navigator.onLine) return;
    let q = load();
    if (!q.length) return;

    const next = [];
    for (const item of q){
      try{
        const res = await fetch(URL, { method:'POST', body: toFormData(item.data) });
        const out = await res.json().catch(()=>({}));
        if (!(res.ok && out && out.ok)) next.push(item);
      }catch(e){ next.push(item); }
    }
    save(next);
  }

  async function submit(fd){
    try{
      const res = await fetch(URL, { method:'POST', body: fd });
      if (!res.ok) throw new Error('net');
      const out = await res.json().catch(()=>({}));
      if (out && out.ok) return out;
      throw new Error(out && out.error || 'Error');
    }catch(e){
      const obj = {};
      for (const [k,v] of fd.entries()) obj[k] = v;
      const q = load(); q.push({ ts: Date.now(), data: obj }); save(q);

      if ('serviceWorker' in navigator && 'SyncManager' in window){
        try{
          const reg = await navigator.serviceWorker.ready;
          await reg.sync.register('fb-sync');
        }catch{}
      }
      return { ok:false, queued:true };
    }
  }

  window.addEventListener('online', process);
  navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', ev => {
    if (ev.data && (ev.data.type === 'post-failed' || ev.data.type === 'sync')) process();
  });

  return { submit, process };
})();

(async function registerSW(){
  if ('serviceWorker' in navigator){
    try{
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
      window.PWAQueue.process();
    }catch(e){ /* noop */ }
  }
})();
