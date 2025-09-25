
# Bundle v5 (Frontend + Apps Script)
- Sin "Escala"
- Listado con filtros (texto + rango de fechas), encabezados centrados
- Formato fechas yyyy-mm-dd y horas hh:mm en UI
- PDF con firmas embebidas (base64) + fecha yyyy-mm-dd + horas hh:mm
- Email No Conforme: adjunta PDF, intenta adjuntar imágenes/PDF chicos, e incluye links

## Pasos
1. **Apps Script**: subí `apps_script/Code.gs`, `apps_script/PdfTemplate.html`, `apps_script/appsscript.json` (o pegá el código).
   - Implementá como **App Web** (Ejecutar como: Yo / Acceso: Cualquiera con el enlace).
2. **Frontend**: serví `frontend/` (Live Server o `python -m http.server`).
3. **Config**: `frontend/assets/js/config.js` ya apunta a tu Web App.
