// assets/js/pwa.js
// Registro del Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
  });
}

let deferredPrompt = null;

// Mostrar botón cuando haya evento de instalación disponible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  document.querySelectorAll('#btnInstall').forEach(btn => {
    btn.style.display = 'inline-flex';
    btn.onclick = async () => {
      btn.style.display = 'none';
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      }
    };
  });
});

// Ocultar botón después de instalar
window.addEventListener('appinstalled', () => {
  document.querySelectorAll('#btnInstall').forEach(btn => btn.style.display = 'none');
  deferredPrompt = null;
});
