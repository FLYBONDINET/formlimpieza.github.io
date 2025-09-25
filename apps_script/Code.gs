\
/**
 * Flybondi - Limpieza de Aeronaves
 * Google Apps Script Web App
 */
const SPREADSHEET_ID = '1bLCm6Tni1VmUkXZzqv3222OSKJ9TZZIQ8Hm8M05Lm28';
const SHEET_NAME = 'Limpiezas';
const ROOT_FOLDER_ID = '1pT1ilE5HDJQr2unzdylD4xbidGFe5k-I';
const ALERT_EMAIL = 'nico@nicoover.com';

const COLS = {
  id:1, timestamp:2, fecha:3, matricula:4, escala:5, aeropuerto:6, posicion:7, tipo:8,
  hIni:9, hFin:10, resp:11, firmaL:12, obs:13, adjL:14, estado:15,
  rFecha:16, rHora:17, rNombre:18, rLegajo:19, rConf:20, rObs:21, rAdj:22, firmaR:23, pdfId:24, folderId:25
};

function doGet(e){
  const action = (e.parameter.action||'').toString();
  if(action==='list') return list_();
  if(action==='getRecord') return getRecord_(e.parameter.id);
  return json_({ok:true});
}

function doPost(e){
  const action = (e.parameter.action||'').toString();
  if(action==='submitCleaning') return submitCleaning_(e);
  if(action==='submitReception') return submitReception_(e);
  return json_({ok:false, error:'Acción no reconocida'});
}

function sheet_(){ return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME); }
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function ensureFolder_(fechaISO, matricula){
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const [y,m,d] = fechaISO.split('-');
  const fY = getOrMake_(root, y);
  const fM = getOrMake_(fY, m);
  const fD = getOrMake_(fM, d);
  const fReg = getOrMake_(fD, matricula || 'SIN_MATRICULA');
  return fReg;
}
function getOrMake_(parent, name){
  const it = parent.getFoldersByName(name);
  if(it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function saveAdjuntos_(e, folder, fieldName){
  const outLinks = [];
  if(e.files){
    for(const key in e.files){
      if(key!==fieldName && !key.startsWith(fieldName)) continue;
      const fileBlob = e.files[key];
      if(!fileBlob) continue;
      const file = folder.createFile(fileBlob);
      outLinks.push('https://drive.google.com/open?id='+file.getId());
    }
  }
  return outLinks.join('\n');
}

function saveSignature_(dataURL, folder, filename){
  if(!dataURL) return '';
  const bytes = Utilities.base64Decode(dataURL.split(',')[1]);
  const blob = Utilities.newBlob(bytes, 'image/png', filename||'firma.png');
  const file = folder.createFile(blob);
  return file.getId();
}

function generatePdf_(folder, data, existingPdfId){
  const t = HtmlService.createTemplateFromFile('PdfTemplate');
  t.data = data;
  const html = t.evaluate().getContent();
  const blob = Utilities.newBlob(html, 'text/html', 'tmp.html');
  const pdf = blob.getAs('application/pdf');
  const name = 'Limpieza_' + (data.matricula||'') + '_' + (data.fecha||'') + '.pdf';
  if(existingPdfId){
    const newFile = folder.createFile(pdf).setName(name);
    try{ DriveApp.getFileById(existingPdfId).setTrashed(true); }catch(e){}
    return newFile.getId();
  } else {
    const file = folder.createFile(pdf).setName(name);
    return file.getId();
  }
}

function nextId_(sh){
  const last = sh.getLastRow();
  if(last < 2) return 1;
  const vals = sh.getRange(2, COLS.id, last-1, 1).getValues().flat().filter(v=>v!=='');
  return (Math.max.apply(null, [0].concat(vals)) + 1);
}

function list_(){
  const sh = sheet_();
  const last = sh.getLastRow();
  const rows = [];
  if(last>=2){
    const rng = sh.getRange(2,1,last-1,25).getValues();
    for(const r of rng){
      rows.push({
        id:r[COLS.id-1],
        fecha_limpieza:r[COLS.fecha-1],
        matricula:r[COLS.matricula-1],
        escala:r[COLS.escala-1],
        aeropuerto:r[COLS.aeropuerto-1],
        tipo_limpieza:r[COLS.tipo-1],
        estado:r[COLS.estado-1]
      });
    }
  }
  return json_({ok:true, rows});
}

function getRecord_(id){
  const sh = sheet_();
  const last = sh.getLastRow();
  if(last<2) return json_({ok:false});
  const rng = sh.getRange(2,1,last-1,25).getValues();
  for(const r of rng){
    if(String(r[COLS.id-1])===String(id)){
      return json_({ok:true, row: {
        id:r[COLS.id-1],
        fecha_limpieza:r[COLS.fecha-1],
        matricula:r[COLS.matricula-1],
        escala:r[COLS.escala-1],
        aeropuerto:r[COLS.aeropuerto-1],
        posicion:r[COLS.posicion-1],
        tipo_limpieza:r[COLS.tipo-1],
        hora_inicio:r[COLS.hIni-1],
        hora_fin:r[COLS.hFin-1],
        responsable_limpieza:r[COLS.resp-1],
        observaciones:r[COLS.obs-1],
        adjuntos_links:r[COLS.adjL-1],
        estado:r[COLS.estado-1],
        pdf_fileId:r[COLS.pdfId-1]
      }});
    }
  }
  return json_({ok:false});
}

function submitCleaning_(e){
  try{
    const sh = sheet_();
    const fecha = (e.parameter.fecha||'').toString();
    const matricula = (e.parameter.matricula||'').toString();
    const escala = (e.parameter.escala||'').toString();
    const aeropuerto = (e.parameter.aeropuerto||'').toString();
    const posicion = (e.parameter.posicion||'').toString();
    const tipo = (e.parameter.tipo_limpieza||'').toString();
    const hIni = (e.parameter.hora_inicio||'').toString();
    const hFin = (e.parameter.hora_fin||'').toString();
    const resp = (e.parameter.responsable_limpieza||'').toString();
    const obs = (e.parameter.observaciones||'').toString();
    const firmaLDataURL = (e.parameter.firmaLimpiezaDataURL||'').toString();

    const folder = ensureFolder_(fecha, matricula);
    const folderId = folder.getId();
    const adjLinks = saveAdjuntos_(e, folder, 'adjuntos');
    const firmaLId = saveSignature_(firmaLDataURL, folder, 'firma_limpieza.png');

    const id = nextId_(sh);
    const timestamp = new Date();
    const estado = 'Pendiente de recepción';

    sh.appendRow([
      id, timestamp, fecha, matricula, escala, aeropuerto, posicion, tipo,
      hIni, hFin, resp, firmaLId, obs, adjLinks, estado,
      '', '', '', '', '', '', '', '', '', folderId
    ]);

    const data = { id: id, fecha: fecha, matricula: matricula, escala: escala, aeropuerto: aeropuerto, posicion: posicion, tipo: tipo,
      hora_inicio:hIni, hora_fin:hFin, responsable_limpieza:resp, observaciones:obs, estado: estado,
      firma_limpieza_fileId: firmaLId
    };
    const pdfId = generatePdf_(folder, data, '');
    const last = sh.getLastRow();
    sh.getRange(last, COLS.pdfId).setValue(pdfId);

    return json_({ok:true, id:id});
  }catch(err){
    return json_({ok:false, error: String(err)});
  }
}

function submitReception_(e){
  try{
    const id = (e.parameter.id||'').toString();
    const rFecha = (e.parameter.recepcion_fecha||'').toString();
    const rHora = (e.parameter.recepcion_hora||'').toString();
    const rNombre = (e.parameter.recepcion_nombre||'').toString();
    const rLegajo = (e.parameter.recepcion_legajo||'').toString();
    const rConf = (e.parameter.recepcion_conforme||'').toString();
    const rObs = (e.parameter.recepcion_observaciones||'').toString();
    const firmaRDataURL = (e.parameter.firmaRecepDataURL||'').toString();

    const sh = sheet_();
    const last = sh.getLastRow();
    let rowIdx = -1, row=null;
    const rng = sh.getRange(2,1,last-1,25).getValues();
    for(let i=0;i<rng.length;i++){
      if(String(rng[i][COLS.id-1])===String(id)){ rowIdx = i+2; row = rng[i]; break; }
    }
    if(rowIdx<0) return json_({ok:false, error:'ID no encontrado'});

    const fecha = row[COLS.fecha-1];
    const matricula = row[COLS.matricula-1];
    const folderId = row[COLS.folderId-1] || ensureFolder_(fecha, matricula).getId();
    const folder = DriveApp.getFolderById(folderId);

    const rAdjLinks = saveAdjuntos_(e, folder, 'recepcion_adjuntos');
    const firmaRId = saveSignature_(firmaRDataURL, folder, 'firma_recepcion.png');

    const estado = (rConf==='Si') ? 'Aceptada' : 'No aceptada';

    sh.getRange(rowIdx, COLS.rFecha, 1, 10).setValues([[
      rFecha, rHora, rNombre, rLegajo, rConf, rObs, rAdjLinks, firmaRId, row[COLS.pdfId-1], folderId
    ]]);
    sh.getRange(rowIdx, COLS.estado).setValue(estado);

    const data = {
      id: row[COLS.id-1], fecha: fecha, matricula: matricula,
      escala: row[COLS.escala-1], aeropuerto: row[COLS.aeropuerto-1], posicion: row[COLS.posicion-1],
      tipo: row[COLS.tipo-1], hora_inicio: row[COLS.hIni-1], hora_fin: row[COLS.hFin-1],
      responsable_limpieza: row[COLS.resp-1], observaciones: row[COLS.obs-1],
      estado: estado,
      firma_limpieza_fileId: row[COLS.firmaL-1],
      recepcion_fecha: rFecha, recepcion_hora: rHora, recepcion_nombre: rNombre, recepcion_legajo: rLegajo,
      recepcion_conforme: rConf, recepcion_observaciones: rObs, firma_recepcion_fileId: firmaRId
    };

    const newPdfId = generatePdf_(folder, data, row[COLS.pdfId-1]);
    sh.getRange(rowIdx, COLS.pdfId).setValue(newPdfId);

    if(estado==='No aceptada'){
      MailApp.sendEmail({
        to: ALERT_EMAIL,
        subject: '[Limpieza No Conforme] ' + (matricula||'') + ' - ' + (fecha||''),
        htmlBody: 'Se registró una limpieza <b>NO CONFORME</b>.<br>' +
          'Matrícula: <b>'+(matricula||'')+'</b><br>Fecha: <b>'+(fecha||'')+'</b><br>' +
          'Responsable recepción: <b>'+(rNombre||'')+'</b> (Legajo '+(rLegajo||'')+')<br>' +
          'Observaciones: <pre>'+(rObs||'-')+'</pre><br>' +
          '<a href="https://drive.google.com/open?id='+newPdfId+'">Abrir PDF</a>',
      });
    }

    return json_({ok:true});
  }catch(err){
    return json_({ok:false, error:String(err)});
  }
}

function include_(fname){ return HtmlService.createHtmlOutputFromFile(fname).getContent(); }
