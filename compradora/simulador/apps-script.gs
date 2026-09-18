/* =========================================================================
   BACKEND — Revisión del Simulador de Negocio Ganadero
   -------------------------------------------------------------------------
   Pegar tal cual en Extensiones → Apps Script de una planilla nueva de
   Google Sheets y publicar como aplicación web (ver README, paso 2).
   No hay nada que configurar acá adentro: la hoja se crea sola.

   Una fila por ítem revisado, sirve tanto para los campos editables como
   para las fórmulas (las columnas que no aplican quedan vacías).
   ========================================================================= */

var HOJA = 'respuestas';

var COLUMNAS = [
  'doc',                 // 0
  'key',                 // 1
  'tipo',                // 2  campo | formula
  'seccion',             // 3
  'campo',               // 4
  'valor_o_formula',     // 5  valor precargado, o la fórmula inferida
  'personalizado_csv',   // 6  lo que decía el CSV (si / no)
  'personalizado',       // 7  lo que respondió negocio (si / no)
  'origen',              // 8  tabla | otro — de dónde sale el valor; si es
                         //    personalizado, de dónde sale el valor por defecto
  'origen_detalle',      // 9  texto libre       (sólo si origen = otro)
  'precarga',            // 10 mediana | promedio | ultimo  (sólo si ES personalizado)
  'formula_ok',          // 11 si | no           (sólo fórmulas)
  'correccion',          // 12 texto libre       (sólo fórmulas)
  'comentario',          // 13
  'autor',               // 14
  'actualizado'          // 15
];

function getHoja_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(HOJA);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA);
    hoja.appendRow(COLUMNAS);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* -------------------------------------------------------------------------
   GET — devuelve todas las respuestas del documento
   ------------------------------------------------------------------------- */
function doGet(e) {
  try {
    var doc = (e && e.parameter && e.parameter.doc) || 'default';
    var hoja = getHoja_();
    var filas = hoja.getDataRange().getValues();
    var respuestas = {};

    for (var i = 1; i < filas.length; i++) {
      var f = filas[i];
      if (String(f[0]) !== doc) continue;
      respuestas[String(f[1])] = {
        pers:       String(f[7]  || ''),
        origen:     String(f[8]  || ''),
        origenOtro: String(f[9]  || ''),
        precarga:   String(f[10] || ''),
        ok:         String(f[11] || ''),
        correccion: String(f[12] || ''),
        coment:     String(f[13] || ''),
        autor:      String(f[14] || ''),
        ts:         f[15] ? new Date(f[15]).toISOString() : ''
      };
    }
    return json_({ ok: true, doc: doc, respuestas: respuestas });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* -------------------------------------------------------------------------
   POST — guarda (o pisa) la respuesta de un ítem
   ------------------------------------------------------------------------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    var body = JSON.parse(e.postData.contents);
    var doc  = String(body.doc || 'default');
    var key  = String(body.key || '');
    var a    = body.answer || {};
    var meta = body.meta || {};
    if (!key) return json_({ ok: false, error: 'falta key' });

    var hoja  = getHoja_();
    var filas = hoja.getDataRange().getValues();
    var fila  = -1;

    for (var i = 1; i < filas.length; i++) {
      if (String(filas[i][0]) === doc && String(filas[i][1]) === key) { fila = i + 1; break; }
    }

    // Si la fila ya existía y esta vez no vino la metadata, se conserva la que estaba.
    function metaCol_(valor, idx) {
      return String(valor || (fila > 0 ? filas[fila - 1][idx] : ''));
    }

    var ahora = a.ts ? new Date(a.ts) : new Date();
    var valores = [
      doc, key,
      metaCol_(meta.tipo, 2),
      metaCol_(meta.grupo, 3),
      metaCol_(meta.label, 4),
      metaCol_(meta.base, 5),
      metaCol_(meta.defaultCsv, 6),
      String(a.pers       || ''),
      String(a.origen     || ''),
      String(a.origenOtro || ''),
      String(a.precarga   || ''),
      String(a.ok         || ''),
      String(a.correccion || ''),
      String(a.coment     || ''),
      String(a.autor      || ''),
      ahora
    ];

    if (fila > 0) {
      hoja.getRange(fila, 1, 1, valores.length).setValues([valores]);
    } else {
      hoja.appendRow(valores);
    }

    return json_({ ok: true, key: key, ts: ahora.toISOString() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (err2) {}
  }
}
