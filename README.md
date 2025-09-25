# Flybondi - Limpieza de Aeronaves (VS Code + Google Apps Script)

Incluye:
- **frontend/** (HTML, CSS, JS): `index.html` (Limpieza), `list.html` (Historial + KPIs), `review.html` (Detalle + Recepción).
- **apps_script/**: `Code.gs`, `PdfTemplate.html`, `appsscript.json`.

## Config ya aplicada
- WEB_APP_URL: https://script.google.com/macros/s/AKfycbx2fTx90Mi4caagXHl3nezAVD8aL6PewU8nBQ3ZpmNJrpXzhK3rBR5vXKxom3nq3b6m/exec
- SPREADSHEET_ID: 1bLCm6Tni1VmUkXZzqv3222OSKJ9TZZIQ8Hm8M05Lm28
- SHEET_NAME: Limpiezas
- ROOT_FOLDER_ID: 1pT1ilE5HDJQr2unzdylD4xbidGFe5k-I
- ALERT_EMAIL: nico@nicoover.com

## Columnas de la Sheet (orden sugerido)
A id · B timestamp · C fecha_limpieza · D matricula · E escala · F aeropuerto · G posicion · H tipo_limpieza ·
I hora_inicio · J hora_fin · K responsable_limpieza · L firma_limpieza_fileId · M observaciones · N adjuntos_links ·
O estado · P recepcion_fecha · Q recepcion_hora · R recepcion_nombre · S recepcion_legajo · T recepcion_conforme ·
U recepcion_observaciones · V recepcion_adjuntos_links · W firma_recepcion_fileId · X pdf_fileId · Y drive_folder_id

## Estructura de Drive
/ROOT_FOLDER_ID/YYYY/MM/DD/MATRICULA/

## Uso rápido
1) Abrí `frontend/index.html`, cargá una limpieza y enviá.
2) Abrí `frontend/list.html` para ver el historial y KPIs (ya corregido para mostrar errores si los hay).
3) Desde `list.html` → “Ver” abre `review.html` en solo lectura + formulario de Recepción.
