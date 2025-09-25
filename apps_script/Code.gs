
/**
 * Flybondi - Limpieza de Aeronaves (bundle v5)
 * - Sin "Escala"
 * - PDF con firmas embebidas (base64), fecha yyyy-mm-dd, horas hh:mm
 * - Mail "No conforme" con PDF adjunto + adjuntos pequeños y links
 */
const SPREADSHEET_ID = '1bLCm6Tni1VmUkXZzqv3222OSKJ9TZZIQ8Hm8M05Lm28';
const SHEET_NAME     = 'Limpiezas';
const ROOT_FOLDER_ID = '1pT1ilE5HDJQr2unzdylD4xbidGFe5k-I';
const ALERT_EMAIL    = 'NICOOBER@FLYBONDI.COM';
const MAIL_MAX_TOTAL_MB   = 20;
const MAIL_MAX_PER_FILEMB = 7;

const COLS = {
  id:1, timestamp:2, fecha:3, matricula:4, escala:5, aeropuerto:6, posicion:7, tipo:8,
  hIni:9, hFin:10, resp:11, firmaL:12, obs:13, adjL:14, estado:15,
  rFecha:16, rHora:17, rNombre:18, rLegajo:19, rConf:20, rObs:21, rAdj:22, firmaR:23, pdfId:24, folderId:25
};
const HEADERS = [
  'id','timestamp','fecha_limpieza','matricula','escala','aeropuerto','posicion','tipo_limpieza',
  'hora_inicio','hora_fin','responsable_limpieza','firma_limpieza_fileId','observaciones','adjuntos_links','estado',
  'recepcion_fecha','recepcion_hora','recepcion_nombre','recepcion_legajo','recepcion_conforme','recepcion_observaciones',
  'recepcion_adjuntos_links','firma_recepcion_fileId','pdf_fileId','drive_folder_id'
];

/* HTTP */
function doGet(e){ const p=e&&e.parameter?e.parameter:{}; const a=(p.action||'').toString();
  if(a==='list') return safeWrap_(list_);
  if(a==='getRecord') return safeWrap_(()=>getRecord_(p.id));
  if(a==='health') return safeWrap_(health_);
  return json_({ok:true,ping:'ok'});
}
function doPost(e){ const p=e&&e.parameter?e.parameter:{}; const a=(p.action||'').toString();
  if(a==='submitCleaning') return safeWrap_(()=>submitCleaning_(e));
  if(a==='submitReception') return safeWrap_(()=>submitReception_(e));
  return json_({ok:false,error:'Acción no reconocida'});
}
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function safeWrap_(fn){ try{ return fn(); }catch(err){ Logger.log(err); return json_({ok:false,error:String(err)}); }}

/* Sheet safe */
function getSheetSafe_(){
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh=ss.getSheetByName(SHEET_NAME); if(!sh) sh=ss.insertSheet(SHEET_NAME);
  const width=Math.max(sh.getLastColumn(), HEADERS.length);
  const r1=(sh.getLastRow()>=1)?sh.getRange(1,1,1,width).getValues()[0]:[];
  if(r1.slice(0,HEADERS.length).join('|')!==HEADERS.join('|')){
    sh.clear(); sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  }
  return sh;
}

/* Drive utils */
function ensureFolder_(fechaISO, matricula){
  const root=DriveApp.getFolderById(ROOT_FOLDER_ID);
  const [y,m,d]=(fechaISO||'').split('-');
  const fY=getOrMake_(root, y||'YYYY'); const fM=getOrMake_(fY, m||'MM'); const fD=getOrMake_(fM, d||'DD');
  return getOrMake_(fD, matricula||'SIN_MATRICULA');
}
function getOrMake_(parent,name){ const it=parent.getFoldersByName(name); return it.hasNext()?it.next():parent.createFolder(name); }
function saveAdjuntos_(e, folder, fieldName){
  const out=[]; if(e.files){ for(const k in e.files){ if(k!==fieldName && !k.startsWith(fieldName)) continue;
    const b=e.files[k]; if(!b) continue; const f=folder.createFile(b); out.push('https://drive.google.com/open?id='+f.getId()); }}
  return out.join('\n');
}
function saveSignature_(dataURL, folder, filename){
  if(!dataURL) return '';
  const bytes=Utilities.base64Decode((dataURL.split(',')[1]||''));
  const blob=Utilities.newBlob(bytes,'image/png',filename||'firma.png');
  const file=folder.createFile(blob);
  return file.getId();
}
function toDataUrlFromFileId_(fileId){
  if(!fileId) return '';
  const blob = DriveApp.getFileById(fileId).getBlob();
  const b64  = Utilities.base64Encode(blob.getBytes());
  return 'data:'+blob.getContentType()+';base64,'+b64;
}

/* Formatting helpers */
function fmtISODateOnly_(s){ if(!s) return ''; const d=new Date(s); if(isNaN(d)) return s; const p=n=>('0'+n).slice(-2); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function fmtHHMM_(s){ if(!s) return ''; const m=/^(\d{2}):(\d{2})/.exec(s); if(m) return m[1]+':'+m[2]; const d=new Date('1970-01-01T'+s); if(isNaN(d)) return s; const p=n=>('0'+n).slice(-2); return p(d.getHours())+':'+p(d.getMinutes()); }

/* PDF */
function generatePdf_(folder, data, existingPdfId){
  // inject formatted fields and inline signatures
  data.fecha_fmt = fmtISODateOnly_(data.fecha);
  data.hora_inicio_fmt = fmtHHMM_(data.hora_inicio);
  data.hora_fin_fmt    = fmtHHMM_(data.hora_fin);
  data.firma_limpieza_dataUrl   = toDataUrlFromFileId_(data.firma_limpieza_fileId||'');
  data.firma_recepcion_dataUrl  = toDataUrlFromFileId_(data.firma_recepcion_fileId||'');

  const t=HtmlService.createTemplateFromFile('PdfTemplate');
  t.data=data;
  const html=t.evaluate().getContent();
  const pdf = Utilities.newBlob(html, 'text/html', 'tmp.html').getAs('application/pdf');
  const name='Limpieza_'+(data.matricula||'')+'_'+(data.fecha_fmt||'')+'.pdf';
  if(existingPdfId){
    const newFile=folder.createFile(pdf).setName(name);
    try{ DriveApp.getFileById(existingPdfId).setTrashed(true); }catch(e){}
    return newFile.getId();
  }
  return folder.createFile(pdf).setName(name).getId();
}

/* Helpers */
function nextId_(sh){ const last=sh.getLastRow(); if(last<2) return 1;
  const vals=sh.getRange(2, COLS.id, last-1, 1).getValues().flat().filter(v=>v!==''&&v!=null);
  return Math.max.apply(null,[0].concat(vals))+1;
}
function parseDriveIdFromLink_(url){
  if(!url) return '';
  let m=/[?&]id=([^&#]+)/.exec(url); if(m) return m[1];
  m=/https:\/\/drive\.google\.com\/file\/d\/([^/]+)/.exec(url); if(m) return m[1];
  m=/https:\/\/drive\.google\.com\/uc\?id=([^&#]+)/.exec(url); if(m) return m[1];
  return '';
}
function collectAttachmentBlobs_(linksText){
  if(!linksText) return [];
  const links=linksText.split('\n').map(s=>s.trim()).filter(Boolean);
  const blobs=[]; let total=0;
  const maxTotal=MAIL_MAX_TOTAL_MB*1024*1024, maxPer=MAIL_MAX_PER_FILEMB*1024*1024;
  for(const link of links){
    try{
      const id=parseDriveIdFromLink_(link); if(!id) continue;
      const f=DriveApp.getFileById(id); const size=f.getSize();
      if(size>maxPer) { Logger.log('Skip per-file size: '+link); continue; }
      const mime=f.getMimeType(); const ok=(mime.indexOf('image/')===0 || mime==='application/pdf');
      if(!ok) { Logger.log('Skip mime: '+mime+' '+link); continue; }
      if(total+size>maxTotal) { Logger.log('Skip total size cap: '+link); continue; }
      blobs.push(f.getBlob().setName(f.getName())); total+=size;
    }catch(err){ Logger.log('No adjunto: '+link+' | '+err); }
  }
  return blobs;
}

/* Endpoints */
function list_(){
  const sh=getSheetSafe_(); const last=sh.getLastRow(); const rows=[];
  if(last>=2){
    const rng=sh.getRange(2,1,last-1,HEADERS.length).getValues();
    const IDX={id:0, fecha:2, matricula:3, aeropuerto:5, tipo:7, estado:14};
    for(const r of rng){
      rows.push({ id:r[IDX.id], fecha_limpieza:r[IDX.fecha], matricula:r[IDX.matricula],
                  aeropuerto:r[IDX.aeropuerto], tipo_limpieza:r[IDX.tipo], estado:r[IDX.estado] });
    }
  }
  return json_({ok:true, rows});
}

function getRecord_(id){
  const sh=getSheetSafe_(); const last=sh.getLastRow(); if(last<2) return json_({ok:false,error:'Sin datos'});
  const rng=sh.getRange(2,1,last-1,HEADERS.length).getValues();
  for(const r of rng){
    if(String(r[COLS.id-1])===String(id)){
      return json_({ok:true, row:{
        id:r[COLS.id-1], fecha_limpieza:r[COLS.fecha-1], matricula:r[COLS.matricula-1],
        aeropuerto:r[COLS.aeropuerto-1], posicion:r[COLS.posicion-1],
        tipo_limpieza:r[COLS.tipo-1], hora_inicio:r[COLS.hIni-1], hora_fin:r[COLS.hFin-1],
        responsable_limpieza:r[COLS.resp-1], observaciones:r[COLS.obs-1],
        adjuntos_links:r[COLS.adjL-1], estado:r[COLS.estado-1], pdf_file_id:r[COLS.pdfId-1]
      }});
    }
  }
  return json_({ok:false,error:'ID no encontrado'});
}

function submitCleaning_(e){
  const p=e&&e.parameter?e.parameter:{}; const sh=getSheetSafe_();
  const fecha=(p.fecha||'').toString(); const matricula=(p.matricula||'').toString();
  const aeropuerto=(p.aeropuerto||'').toString(); const posicion=(p.posicion||'').toString();
  const tipo=(p.tipo_limpieza||'').toString(); const hIni=(p.hora_inicio||'').toString(); const hFin=(p.hora_fin||'').toString();
  const resp=(p.responsable_limpieza||'').toString(); const obs=(p.observaciones||'').toString();
  const firmaLDataURL=(p.firmaLimpiezaDataURL||'').toString();
  const folder=ensureFolder_(fecha,matricula); const folderId=folder.getId();
  const adjLinks=saveAdjuntos_(e,folder,'adjuntos'); const firmaLId=saveSignature_(firmaLDataURL, folder, 'firma_limpieza.png');
  const id=nextId_(sh); const timestamp=new Date(); const estado='Pendiente de recepción';
  sh.appendRow([ id,timestamp,fecha,matricula,'',aeropuerto,posicion,tipo,hIni,hFin,resp,firmaLId,obs,adjLinks,estado,'','','','','','','','', '', folderId ]);
  const data={ id, fecha, matricula, aeropuerto, posicion, tipo, hora_inicio:hIni, hora_fin:hFin, responsable_limpieza:resp, observaciones:obs, estado, firma_limpieza_fileId:firmaLId };
  const pdfId=generatePdf_(folder,data,''); const last=sh.getLastRow(); sh.getRange(last, COLS.pdfId).setValue(pdfId);
  return json_({ok:true,id});
}

function submitReception_(e){
  const p=e&&e.parameter?e.parameter:{}; const id=(p.id||'').toString();
  const rFecha=(p.recepcion_fecha||'').toString(); const rHora=(p.recepcion_hora||'').toString();
  const rNombre=(p.recepcion_nombre||'').toString(); const rLegajo=(p.recepcion_legajo||'').toString();
  const rConf=(p.recepcion_conforme||'').toString(); const rObs=(p.recepcion_observaciones||'').toString();
  const firmaRDataURL=(p.firmaRecepDataURL||'').toString();
  const sh=getSheetSafe_(); const last=sh.getLastRow(); if(last<2) return json_({ok:false,error:'Hoja sin datos'});
  const rng=sh.getRange(2,1,last-1,HEADERS.length).getValues(); let rowIdx=-1,row=null;
  for(let i=0;i<rng.length;i++){ if(String(rng[i][COLS.id-1])===String(id)){ rowIdx=i+2; row=rng[i]; break; } }
  if(rowIdx<0) return json_({ok:false,error:'ID no encontrado'});
  const estadoActual=row[COLS.estado-1]; if(estadoActual && estadoActual!=='Pendiente de recepción') return json_({ok:false,error:'Registro cerrado. No se puede modificar.'});
  const fecha=row[COLS.fecha-1]; const matricula=row[COLS.matricula-1];
  const folderId=row[COLS.folderId-1]||ensureFolder_(fecha,matricula).getId(); const folder=DriveApp.getFolderById(folderId);
  const rAdjLinks=saveAdjuntos_(e,folder,'recepcion_adjuntos'); const firmaRId=saveSignature_(firmaRDataURL,folder,'firma_recepcion.png');
  const conf=(rConf||'').trim().toLowerCase(); const esConforme=(conf==='si'||conf==='conforme'); const estado=esConforme?'Aceptada':'No aceptada';
  sh.getRange(rowIdx, COLS.rFecha, 1, 10).setValues([[ rFecha, rHora, rNombre, rLegajo, rConf, rObs, rAdjLinks, firmaRId, row[COLS.pdfId-1], folderId ]]);
  sh.getRange(rowIdx, COLS.estado).setValue(estado);
  const data={ id:row[COLS.id-1], fecha, matricula, aeropuerto:row[COLS.aeropuerto-1], posicion:row[COLS.posicion-1], tipo:row[COLS.tipo-1],
               hora_inicio:row[COLS.hIni-1], hora_fin:row[COLS.hFin-1], responsable_limpieza:row[COLS.resp-1], observaciones:row[COLS.obs-1],
               estado, firma_limpieza_fileId:row[COLS.firmaL-1], recepcion_fecha:rFecha, recepcion_hora:rHora, recepcion_nombre:rNombre,
               recepcion_legajo:rLegajo, recepcion_conforme:rConf, recepcion_observaciones:rObs, firma_recepcion_fileId:firmaRId };
  const newPdfId=generatePdf_(folder, data, row[COLS.pdfId-1]); sh.getRange(rowIdx, COLS.pdfId).setValue(newPdfId);

  if(estado==='No aceptada'){
    try {
      const linksL=(row[COLS.adjL-1]||'').toString(), linksR=(rAdjLinks||'').toString();
      const linksHtml=[].concat(linksL?linksL.split('\n').map(u=>`<div><a href="${u}">${u}</a></div>`):[]).concat(linksR?linksR.split('\n').map(u=>`<div><a href="${u}">${u}</a></div>`):[]).join('');
      const pdfBlob=DriveApp.getFileById(newPdfId).getBlob().setName('Acta_'+matricula+'_'+fmtISODateOnly_(fecha)+'.pdf');
      const attachments=[pdfBlob].concat(collectAttachmentBlobs_(linksL)).concat(collectAttachmentBlobs_(linksR));
      const asunto='[Limpieza No Conforme] '+matricula+' - '+fmtISODateOnly_(fecha);
      const cuerpo= 'Se registró una limpieza <b>NO CONFORME</b>.<br>'+
        'Matrícula: <b>'+matricula+'</b><br>Fecha: <b>'+fmtISODateOnly_(fecha)+'</b><br>'+
        'Responsable recepción: <b>'+rNombre+'</b> (Legajo '+rLegajo+')<br>'+
        'Observaciones: <pre>'+(rObs||'-')+'</pre><br>'+
        '<b>Acta PDF:</b> <a href="https://drive.google.com/open?id='+newPdfId+'">Abrir</a><br>'+
        '<b>Adjuntos (links):</b><br>'+(linksHtml || '<i>Sin adjuntos</i>');
      MailApp.sendEmail({ to:ALERT_EMAIL, subject:asunto, htmlBody:cuerpo, attachments:attachments });
    } catch (mailErr) { Logger.log('Mail error: '+mailErr); }
  }
  return json_({ok:true});
}

/* Health */
function health_(){ let sheetExists=true, hasHeaders=false, last=0, err=null;
  try{ const sh=getSheetSafe_(); last=sh.getLastRow(); const h=sh.getRange(1,1,1,HEADERS.length).getValues()[0]; hasHeaders=(h.join('|')===HEADERS.join('|')); }
  catch(e){ sheetExists=false; err=String(e); }
  return json_({ok:true,sheetExists,hasHeaders,last,spreadsheetId:SPREADSHEET_ID,sheetName:SHEET_NAME,err});
}
