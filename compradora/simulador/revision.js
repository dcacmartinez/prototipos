/* =========================================================================
   CAPA DE REVISIÓN — Simulador de Negocio Ganadero
   -------------------------------------------------------------------------
   Se monta encima del prototipo sin tocar su código. Dos cosas a revisar:

   1. CAMPOS editables precargados → ¿es personalizado por sociedad?
      · si NO  → ¿de dónde se obtiene? (tabla de parámetros u otro)
      · si SÍ  → ¿con qué se precarga? (mediana / promedio / último valor)
                 y ¿de dónde sale el valor por defecto? (tabla de parámetros u otro)
   2. FÓRMULAS inferidas del prototipo → ¿está bien? y, si no, la corrección.
   ========================================================================= */
(function(){
'use strict';

/* ---------------------------------------------------------------------
   Constantes
   --------------------------------------------------------------------- */
const LS_AUTOR = 'rev_autor_v1';
const LS_RESP  = 'rev_respuestas_' + REV_CONFIG.DOC;
const LS_COLA  = 'rev_cola_' + REV_CONFIG.DOC;

const OP_SI_NO    = [{v:'si', l:'Sí'}, {v:'no', l:'No'}];
const OP_ORIGEN   = [{v:'tabla', l:'Tabla de parámetros'}, {v:'otro', l:'Otro'}];
const OP_PRECARGA = [{v:'mediana', l:'Mediana'}, {v:'promedio', l:'Promedio'}, {v:'ultimo', l:'Último valor'}];
const OP_FORMULA  = [{v:'si', l:'Está bien'}, {v:'no', l:'Hay que corregirla'}];

const LBL = {};
[OP_SI_NO, OP_ORIGEN, OP_PRECARGA].forEach(g => g.forEach(o => { LBL[o.v] = o.l; }));

/* ---------------------------------------------------------------------
   Estado
   --------------------------------------------------------------------- */
let AUTOR = '';
let RESP  = {};
let COLA  = [];
let keyAbierta = null;
let solapa = 'campo';          // 'campo' | 'formula'
let soloPendientes = false;
let expandido = null;          // key de la fórmula desplegada dentro del panel
let estadoGuardado = 'listo';  // 'listo' | 'guardando' | 'error' | 'local'
let cerrarDrawer = () => {};
let verFuentes = false;        // preferencia: resaltar también los campos que intervienen
let resaltado = null;          // key de la fórmula resaltada en pantalla

const hayEndpoint = !!(REV_CONFIG.ENDPOINT || '').trim();

/**
 * fetch + JSON, distinguiendo el caso más común cuando algo no anda: que la
 * Web App esté restringida y Google devuelva su pantalla de login en vez de
 * la respuesta. Ahí el error es de permisos, no de red.
 */
async function pedirJSON(url, opciones){
  let res;
  try {
    res = await fetch(url, opciones || {});
  } catch(e){
    const err = new Error('sin-red'); err.codigo = 'red'; throw err;
  }
  const txt = await res.text();
  try {
    const data = JSON.parse(txt);
    if (!data || !data.ok){
      const err = new Error('respuesta-no-ok'); err.codigo = 'servidor';
      err.detalle = (data && data.error) || txt.slice(0,200); throw err;
    }
    return data;
  } catch(e){
    if (e.codigo) throw e;
    const esLogin = /accounts\.google\.com|ServiceLogin|<!DOCTYPE/i.test(txt);
    const err = new Error('respuesta-no-json');
    err.codigo = esLogin ? 'permiso' : 'formato';
    err.detalle = txt.slice(0, 300);
    throw err;
  }
}

function avisarFalla(e, donde){
  const ayuda = {
    permiso: 'La Web App de Apps Script está restringida: devolvió la pantalla de login de Google en vez de la respuesta. ' +
             'Implementar → Administrar implementaciones → editar la activa → Quién tiene acceso: "Cualquier usuario" (la anónima, no la que pide Cuenta de Google). ' +
             'Ojo también con usar la URL /exec y no la /dev.',
    formato:  'El endpoint contestó algo que no es JSON. ¿La URL de ENDPOINT es la correcta?',
    servidor: 'El script contestó con un error.',
    red:      'No se pudo llegar al endpoint (sin conexión o URL inalcanzable).',
  };
  console.warn('[revisión] ' + donde + ' — ' + (ayuda[e.codigo] || e.message), e.detalle || '');
  return e.codigo === 'permiso' ? 'permiso' : 'error';
}

/* ---------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------- */
function el(tag, cls, html){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function esc(s){
  return String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function lsGet(k, def){
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch(e){ return def; }
}
function lsSet(k, v){
  try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){}
}
function paramPorKey(k){ return REV_PARAMS.find(p => p.k === k); }
function grupoPorId(id){ return REV_GRUPOS.find(g => g.id === id); }
function deSolapa(t){ return REV_PARAMS.filter(p => p.tipo === t); }
function lleno(s){ return !!String(s==null?'':s).trim(); }

/** Para un campo, la personalización que rige hoy: la respondida o la del CSV. */
function persEfectiva(p, r){ return (r && r.pers) || p.def; }

function respondido(p){
  const r = RESP[p.k];
  if (!r) return false;
  if (p.tipo === 'formula'){
    return r.ok === 'si' || (r.ok === 'no' && lleno(r.correccion));
  }
  const pers = persEfectiva(p, r);
  const origenOk = r.origen === 'tabla' || (r.origen === 'otro' && lleno(r.origenOtro));
  if (pers === 'no') return origenOk;
  if (pers === 'si') return !!r.precarga && origenOk;
  return false;
}
function totalRespondidos(t){
  const lista = t ? deSolapa(t) : REV_PARAMS;
  return lista.filter(respondido).length;
}
function horaCorta(ts){
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  return new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);
}
const debounce = (fn, ms) => { let t; return function(){ clearTimeout(t); t = setTimeout(()=>fn.apply(this, arguments), ms); }; };

/** Resumen de una línea de lo respondido, para el panel y la exportación. */
function resumenRespuesta(p){
  const r = RESP[p.k];
  if (!respondido(p)) return '';
  if (p.tipo === 'formula'){
    return r.ok === 'si' ? 'Fórmula correcta' : 'A corregir: ' + r.correccion;
  }
  const pers = persEfectiva(p, r);
  if (pers === 'no'){
    return 'No personalizado · ' + (r.origen === 'tabla' ? 'Tabla de parámetros' : (r.origenOtro || 'Otro'));
  }
  return 'Personalizado por sociedad · precarga: ' + LBL[r.precarga] +
         ' · default: ' + (r.origen === 'tabla' ? 'Tabla de parámetros' : (r.origenOtro || 'Otro'));
}

/* ---------------------------------------------------------------------
   Guardado — Apps Script con respaldo en este navegador
   --------------------------------------------------------------------- */
function metaDe(key){
  const p = paramPorKey(key) || {};
  const g = grupoPorId(p.g);
  return {
    tipo: p.tipo || '',
    label: p.l || key,
    grupo: (g && g.nombre) || p.g || '',
    base: p.tipo === 'formula' ? (p.f || '') : (p.v || ''),
    defaultCsv: p.tipo === 'campo' ? (p.def || '') : ''
  };
}

const Store = {

  async cargar(){
    RESP = lsGet(LS_RESP, {});
    COLA = lsGet(LS_COLA, []);
    if (!hayEndpoint){ estadoGuardado = 'local'; return; }
    try {
      const url = REV_CONFIG.ENDPOINT + '?doc=' + encodeURIComponent(REV_CONFIG.DOC) + '&t=' + Date.now();
      const data = await pedirJSON(url, { method:'GET' });
      if (data.respuestas){
        RESP = data.respuestas;
        COLA.forEach(item => { RESP[item.key] = item.answer; });
        lsSet(LS_RESP, RESP);
        estadoGuardado = 'listo';
      }
    } catch(e){
      estadoGuardado = avisarFalla(e, 'al leer las respuestas');
    }
    vaciarCola();
  },

  async guardar(key){
    const answer = RESP[key];
    const meta   = metaDe(key);
    lsSet(LS_RESP, RESP);
    if (!hayEndpoint){ estadoGuardado = 'local'; pintarEstado(); return; }
    estadoGuardado = 'guardando'; pintarEstado();
    try {
      // Sin headers propios: el pedido queda "simple" y Apps Script
      // no necesita responder un preflight de CORS.
      await pedirJSON(REV_CONFIG.ENDPOINT, {
        method:'POST',
        body: JSON.stringify({ doc: REV_CONFIG.DOC, key: key, answer: answer, meta: meta })
      });
      estadoGuardado = 'listo';
    } catch(e){
      COLA = COLA.filter(i => i.key !== key);
      COLA.push({ key: key, answer: answer, meta: meta });
      lsSet(LS_COLA, COLA);
      estadoGuardado = avisarFalla(e, 'al guardar "' + key + '"');
    }
    pintarEstado();
  },
};

async function vaciarCola(){
  if (!hayEndpoint || !COLA.length) return;
  const pendientes = COLA.slice();
  for (const item of pendientes){
    try {
      await pedirJSON(REV_CONFIG.ENDPOINT, {
        method:'POST',
        body: JSON.stringify({ doc: REV_CONFIG.DOC, key: item.key, answer: item.answer, meta: item.meta || metaDe(item.key) })
      });
      COLA = COLA.filter(i => i.key !== item.key);
    } catch(e){ break; }
  }
  lsSet(LS_COLA, COLA);
  if (!COLA.length && estadoGuardado === 'error') estadoGuardado = 'listo';
  pintarEstado();
}

async function traerCambios(){
  if (!hayEndpoint) return;
  try {
    const url = REV_CONFIG.ENDPOINT + '?doc=' + encodeURIComponent(REV_CONFIG.DOC) + '&t=' + Date.now();
    const data = await pedirJSON(url, { method:'GET' });
    if (!data.respuestas) return;
    const nuevas = data.respuestas;
    // No pisamos el ítem que la persona está editando en este momento.
    const editando = k => k === keyAbierta || k === expandido;
    Object.keys(nuevas).forEach(k => { if (!editando(k)) RESP[k] = nuevas[k]; });
    // Lo que ya no está en la planilla (lo borraron desde ahí) también se va acá.
    Object.keys(RESP).forEach(k => {
      if (!(k in nuevas) && !editando(k) && !COLA.some(i => i.key === k)) delete RESP[k];
    });
    COLA.forEach(item => { RESP[item.key] = item.answer; });
    lsSet(LS_RESP, RESP);
    pintarTodo();
  } catch(e){ /* silencioso: es un refresco de fondo */ }
}

/* ---------------------------------------------------------------------
   Identidad
   --------------------------------------------------------------------- */
function pedirIdentidad(){
  return new Promise(resolve => {
    const guardado = lsGet(LS_AUTOR, '');
    if (guardado){ AUTOR = guardado; resolve(); return; }

    const fondo = el('div','rev-modal-fondo rev-scope');
    fondo.innerHTML = `
      <div class="rev-modal">
        <h3>Revisión del Simulador de Negocio Ganadero</h3>
        <p>Antes de arrancar, decinos quién sos. Lo usamos para saber quién respondió
           cada cosa cuando revisemos las respuestas — no es un login.</p>
        <input type="text" id="rev-in-autor" placeholder="Nombre y apellido" autocomplete="name">
        <button class="rev-btn" id="rev-btn-autor" style="width:100%">Entrar</button>
      </div>`;
    document.body.appendChild(fondo);
    const input = fondo.querySelector('#rev-in-autor');
    const btn   = fondo.querySelector('#rev-btn-autor');
    input.focus();
    const entrar = () => {
      const v = input.value.trim();
      if (!v){ input.focus(); return; }
      AUTOR = v; lsSet(LS_AUTOR, v);
      fondo.remove(); resolve();
    };
    btn.addEventListener('click', entrar);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
  });
}

/* ---------------------------------------------------------------------
   Barra superior
   --------------------------------------------------------------------- */
function montarTopbar(){
  const barra = el('div','rev-topbar rev-scope');
  barra.innerHTML = `
    <div class="rev-topbar-txt">
      <b>Revisión con negocio.</b> Tocá el punto
      <span class="rev-dot rev-inline" style="position:static; display:inline-flex;">?</span>
      de cada dato para decirnos si es personalizado por sociedad y de dónde sale.
      Las fórmulas se revisan desde el panel. Podés mover los valores del simulador
      para ver cómo impactan.
    </div>
    <div class="rev-topbar-acc">
      <span class="rev-estado" id="rev-estado">—</span>
      <button class="rev-chip" id="rev-chip-autor"></button>
    </div>`;
  document.body.insertBefore(barra, document.body.firstChild);

  if (!hayEndpoint){
    const aviso = el('div','rev-aviso rev-scope',
      '<b>Atención:</b> todavía no está configurado el guardado compartido. ' +
      'Tus respuestas quedan guardadas sólo en este navegador — desde el panel podés bajarlas en un archivo.');
    document.body.insertBefore(aviso, barra.nextSibling);
  }

  barra.querySelector('#rev-chip-autor').addEventListener('click', () => {
    const v = prompt('¿Quién sos?', AUTOR);
    if (v && v.trim()){ AUTOR = v.trim(); lsSet(LS_AUTOR, AUTOR); pintarTodo(); }
  });
}

function pintarEstado(){
  const n = document.getElementById('rev-estado');
  if (!n) return;
  const mapa = {
    listo:     ['Guardado',                    'rev-ok'],
    guardando: ['Guardando…',                  ''],
    error:     ['Sin conexión — guardado acá', 'rev-err'],
    permiso:   ['No se puede guardar — falta permiso', 'rev-err'],
    local:     ['Guardado en este navegador',  ''],
  };
  const [txt, cls] = mapa[estadoGuardado] || ['', ''];
  n.textContent = txt;
  n.className = 'rev-estado ' + cls;
  const chip = document.getElementById('rev-chip-autor');
  if (chip) chip.textContent = AUTOR || 'Identificarme';
}

/* ---------------------------------------------------------------------
   Puntos de revisión sobre los campos
   --------------------------------------------------------------------- */
function contenedorDe(p){
  const base = document.querySelector(p.el);
  if (!base) return null;
  if (p.mount === 'self')  return base;
  if (p.mount === 'table'){
    const t = base.closest('table');
    return t ? (t.parentElement || t) : base;
  }
  return base.closest('.campo, .flete-campo, .campo-precio-venta, td') || base.parentElement;
}

/** Ninguna sección del simulador puede quedar plegada: adentro hay campos a revisar. */
function expandirSecciones(){
  document.querySelectorAll('.sim-sec').forEach(sec => {
    sec.classList.remove('confirmado');
    const body = sec.querySelector('.sim-sec-body');
    if (body) body.style.maxHeight = 'none';
  });
}

function montarPuntos(){
  document.querySelectorAll('.rev-dot[data-rev-key]').forEach(n => n.remove());
  deSolapa('campo').forEach(p => {
    if (!p.el) return;
    const cont = contenedorDe(p);
    if (!cont) return;
    cont.classList.add('rev-host');
    const dot = el('button','rev-dot');
    dot.type = 'button';
    dot.dataset.revKey = p.k;
    dot.title = 'Revisar: ' + p.l;
    cont.appendChild(dot);
    dot.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      abrirPopover(p.k, dot);
    });
  });
  pintarPuntos();
}

function pintarPuntos(){
  document.querySelectorAll('.rev-dot[data-rev-key]').forEach(dot => {
    const p = paramPorKey(dot.dataset.revKey);
    if (!p) return;
    const ok = respondido(p);
    dot.classList.toggle('rev-done', ok);
    dot.classList.toggle('rev-abierto', dot.dataset.revKey === keyAbierta);
    dot.textContent = ok ? '✓' : '?';
    dot.title = ok ? resumenRespuesta(p) : ('Revisar: ' + p.l);
  });
}

/* ---------------------------------------------------------------------
   Resaltado en pantalla de lo que toca una fórmula
   -------------------------------------------------------------------------
   Los selectores de config.js admiten tres formas:
     '#id'                        → un elemento común
     'fila:Etiqueta##Bloque'      → una fila de las tablas de Resultados
     'chip:Etiqueta'              → un chip del recorrido de pesos
   --------------------------------------------------------------------- */
function resolver(sel){
  try {
    if (sel.startsWith('fila:')){
      const [etiqueta, bloque] = sel.slice(5).split('##');
      return [...document.querySelectorAll('.tabla-res tr')].filter(tr => {
        const lbl = tr.querySelector('td.lbl');
        if (!lbl || !lbl.textContent.trim().startsWith(etiqueta.trim())) return false;
        if (!bloque) return true;
        const caja = tr.closest('.bloque-resumen');
        const tit  = caja && caja.querySelector('h5');
        return !!tit && tit.textContent.toLowerCase().includes(bloque.trim().toLowerCase());
      });
    }
    if (sel.startsWith('chip:')){
      const etiqueta = sel.slice(5).trim().toLowerCase();
      return [...document.querySelectorAll('#peso-stepper .peso-chip')]
        .filter(c => (c.querySelector('.peso-chip-lbl')||{}).textContent?.trim().toLowerCase() === etiqueta);
    }
    return [...document.querySelectorAll(sel)];
  } catch(e){ return []; }
}

/** Si se resaltan los campos que intervienen: por elección, o porque el
    cálculo no tiene resultado en pantalla que mostrar. */
function mostrarFuentes(p){
  return verFuentes || !((p && p.out) || []).length;
}

/** Cálculos intermedios que componen esta fórmula: el prototipo no los
    muestra en pantalla, así que no se revisan sueltos sino acá adentro. */
function pasosDe(p){
  if (!p || p.tipo !== 'formula') return [];
  return REV_FORMULAS.filter(x => x.interna && (x.impacta || []).includes(p.k));
}

/** Campos que intervienen: los propios más los de sus pasos intermedios. */
function fuentesDe(p){
  const todas = (p.src || []).concat(...pasosDe(p).map(x => x.src || []));
  return todas.filter((s, i) => todas.indexOf(s) === i);
}

/** Sube del input al recuadro del campo, para que el resaltado se vea entero. */
function cajaDe(n){
  return n.closest('.campo, .flete-campo, .campo-precio-venta, .out-box, .peso-chip, td, tr') || n;
}

function limpiarResaltado(){
  document.querySelectorAll('.rev-hl-out, .rev-hl-src')
    .forEach(n => n.classList.remove('rev-hl-out','rev-hl-src'));
  resaltado = null;
  pintarLeyenda();
}

function aplicarResaltado(p, opciones){
  opciones = opciones || {};
  document.querySelectorAll('.rev-hl-out, .rev-hl-src')
    .forEach(n => n.classList.remove('rev-hl-out','rev-hl-src'));
  if (!p || p.tipo !== 'formula'){ resaltado = null; pintarLeyenda(); return; }

  resaltado = p.k;
  const cajasOut = [], cajasSrc = [];

  (p.out || []).forEach(sel => resolver(sel).forEach(n => {
    const caja = cajaDe(n);
    caja.classList.add('rev-hl-out');
    cajasOut.push(caja);
  }));

  if (mostrarFuentes(p)){
    fuentesDe(p).forEach(sel => resolver(sel).forEach(n => {
      const caja = cajaDe(n);
      if (!caja.classList.contains('rev-hl-out')){ caja.classList.add('rev-hl-src'); cajasSrc.push(caja); }
    }));
  }

  pintarLeyenda();

  // Lo resaltado se lleva arriba de todo: el popover se ubica abajo a la
  // derecha, así no tapa justo el campo que se acaba de marcar.
  // El scroll va siempre al resultado de la fórmula. Sólo cuando el cálculo
  // es intermedio y no se muestra, se cae al primer campo que interviene.
  if (!opciones.scroll) return;
  const destino = cajasOut.length ? cajasOut[0] : cajasSrc[0];
  if (destino) scrollArriba(destino);
}

/** Deja el elemento cerca del techo de la pantalla, despejando los headers fijos. */
function scrollArriba(n, margen){
  const r = n.getBoundingClientRect();
  const destino = window.scrollY + r.top - (margen || 150);
  window.scrollTo({ top: Math.max(0, destino), behavior:'smooth' });
}

function montarLeyenda(){
  const l = el('div','rev-leyenda rev-scope');
  l.id = 'rev-leyenda';
  l.innerHTML = `
    <div class="rev-leyenda-txt">
      <b id="rev-leyenda-campo"></b>
      <span class="rev-leyenda-refs">
        <span class="rev-pin rev-pin-out"></span> lo que completa
        <span class="rev-leyenda-src"><span class="rev-pin rev-pin-src"></span> de dónde sale</span>
      </span>
    </div>
    <button type="button" class="rev-leyenda-cerrar" title="Quitar el resaltado">Quitar</button>`;
  document.body.appendChild(l);
  l.querySelector('.rev-leyenda-cerrar').addEventListener('click', limpiarResaltado);
}

function pintarLeyenda(){
  const l = document.getElementById('rev-leyenda');
  if (!l) return;
  const p = resaltado ? paramPorKey(resaltado) : null;
  l.classList.toggle('rev-visible', !!p);
  if (!p) return;
  l.querySelector('#rev-leyenda-campo').textContent = p.l;
  l.querySelector('.rev-leyenda-refs').style.display = (p.out || []).length ? '' : 'none';
  l.querySelector('.rev-leyenda-src').style.display  = mostrarFuentes(p) ? '' : 'none';
}

/* ---------------------------------------------------------------------
   Popover
   --------------------------------------------------------------------- */
let popover = null;

/**
 * `sugerido` viene marcado como si estuviera elegido — con el cartelito
 * "sugerido" mientras la persona no lo haya confirmado ni cambiado.
 * Se identifica por data-grupo y no por id: el mismo formulario puede estar
 * abierto en el panel y en un popover sin que se pisen.
 */
function opcionesHTML(grupo, opciones, seleccion, sugerido){
  const sel = seleccion || sugerido || '';
  return `<div class="rev-opciones" data-grupo="${grupo}">` + opciones.map(o => `
    <button type="button" class="rev-opcion ${sel===o.v?'rev-sel':''}" data-v="${o.v}">${esc(o.l)}${
      (sugerido && sugerido===o.v && !seleccion) ? ' <span class="rev-sug">sugerido</span>' : ''
    }</button>`).join('') + '</div>';
}

function cuerpoFormulario(p){
  const r = RESP[p.k] || {};

  const notas =
    (p.nota ? `<p class="rev-pop-nota">Duda abierta de Producto: ${esc(p.nota)}</p>` : '') +
    (p.plm  ? `<p class="rev-pop-plm">Nota de PLM: ${esc(p.plm)}</p>` : '');

  /* ----- fórmulas ----- */
  if (p.tipo === 'formula'){
    const hayOut = (p.out || []).length;
    const haySrc = fuentesDe(p).length;
    const pasos  = pasosDe(p);
    return `
      <p class="rev-pop-valor">Fórmula inferida del prototipo:</p>
      <p class="rev-pop-formula">${esc(p.f)}</p>
      ${ pasos.length ? `
      <div class="rev-pasos">
        <p class="rev-pasos-tit">${pasos.length === 1 ? 'Cálculo intermedio que usa' : 'Cálculos intermedios que usa'}
          <span>— el prototipo no los muestra en pantalla</span></p>
        ${pasos.map(x => `
          <div class="rev-paso" title="${esc(x.uso || '')}">
            <b>${esc(x.l)}</b>
            <span>${esc(x.f)}</span>
          </div>`).join('')}
      </div>` : '' }
      ${notas}
      <div class="rev-resaltado">
        <p class="rev-resaltado-lin">${ hayOut
          ? '<span class="rev-pin rev-pin-out"></span> En pantalla está resaltado el campo que completa.'
          : '<span class="rev-pin rev-pin-none"></span> Es un cálculo intermedio: no se muestra en pantalla.' }</p>
        ${ !hayOut && p.uso ? `<p class="rev-uso">${esc(p.uso)}</p>` : '' }
        ${ haySrc ? (hayOut ? `
        <label class="rev-check">
          <input type="checkbox" data-chk="src" ${verFuentes?'checked':''}>
          <span><span class="rev-pin rev-pin-src"></span> ${ pasos.length
            ? `Resaltar los ${haySrc} campos de entrada — los de la fórmula y los de sus pasos`
            : `Resaltar también los ${haySrc} campos que intervienen` }</span>
        </label>` : `
        <p class="rev-resaltado-lin" style="margin-top:9px">
          <span class="rev-pin rev-pin-src"></span> Están resaltados los ${haySrc} campos que intervienen.
        </p>`) : '' }
      </div>
      <div class="rev-campo">
        <label>¿La fórmula está bien?</label>
        ${opcionesHTML('ok', OP_FORMULA, r.ok)}
      </div>
      ${r.ok === 'no' ? `
      <div class="rev-campo">
        <label>¿Cuál es el error o la fórmula correcta?</label>
        <textarea data-campo="correccion" placeholder="Escribí la fórmula corregida o qué está mal">${esc(r.correccion || '')}</textarea>
      </div>` : ''}
      <div class="rev-campo">
        <label>Comentario</label>
        <textarea data-campo="coment" placeholder="Opcional">${esc(r.coment || '')}</textarea>
      </div>`;
  }

  /* ----- campos editables ----- */
  const pers = persEfectiva(p, r);
  let seguimiento = '';

  if (pers === 'no'){
    seguimiento = `
      <div class="rev-campo">
        <label>¿De dónde se obtiene este valor?</label>
        ${opcionesHTML('origen', OP_ORIGEN, r.origen)}
      </div>
      ${r.origen === 'otro' ? `
      <div class="rev-campo">
        <label>¿De dónde?</label>
        <input type="text" data-campo="origenOtro" placeholder="Sistema, planilla, referencia de mercado…"
               value="${esc(r.origenOtro || '')}">
      </div>` : ''}`;
  } else if (pers === 'si'){
    seguimiento = `
      <div class="rev-campo">
        <label>¿Con qué lo precargamos?</label>
        ${opcionesHTML('precarga', OP_PRECARGA, r.precarga)}
      </div>
      <div class="rev-campo">
        <label>Valor por defecto</label>
        ${opcionesHTML('origen', OP_ORIGEN, r.origen)}
        <p class="rev-ayuda">De dónde sale mientras la sociedad no tenga historia propia.</p>
      </div>
      ${r.origen === 'otro' ? `
      <div class="rev-campo">
        <label>¿De dónde?</label>
        <input type="text" data-campo="origenOtro" placeholder="Sistema, planilla, referencia de mercado…"
               value="${esc(r.origenOtro || '')}">
      </div>` : ''}`;
  }

  return `
    <p class="rev-pop-valor">Precargado hoy: <b>${esc(p.v || '—')}</b></p>
    ${notas}
    <div class="rev-campo">
      <label>¿Es personalizado por sociedad?</label>
      ${opcionesHTML('pers', OP_SI_NO, r.pers, p.def)}
      <p class="rev-ayuda">Viene marcado lo que pusimos en el CSV. Si no es así, cambialo.</p>
    </div>
    ${seguimiento}
    <div class="rev-campo">
      <label>Comentario</label>
      <textarea data-campo="coment" placeholder="Opcional">${esc(r.coment || '')}</textarea>
    </div>`;
}

function cerrarPopover(){
  if (popover){ popover.remove(); popover = null; }
  keyAbierta = null;
  document.removeEventListener('mousedown', clickAfuera);
  document.removeEventListener('keydown', teclaEscape);
  pintarPuntos();
}

function abrirPopover(key, ancla){
  const yaAbierto = (keyAbierta === key);
  cerrarPopover();
  if (yaAbierto) return;

  const p = paramPorKey(key);
  if (!p) return;
  keyAbierta = key;

  popover = el('div','rev-pop rev-scope');
  popover._ancla = ancla || null;
  dibujarPopover(p);
  document.body.appendChild(popover);
  ubicarPopover(popover._ancla);

  // El popover es sólo para campos editables: las fórmulas se despliegan
  // dentro del panel. Un campo ya se señala con su punto, así que limpia.
  limpiarResaltado();

  setTimeout(() => {
    document.addEventListener('mousedown', clickAfuera);
    document.addEventListener('keydown', teclaEscape);
  }, 0);
  pintarPuntos();
}

function dibujarPopover(p){
  const r = RESP[p.k] || {};
  const g = grupoPorId(p.g);
  popover.innerHTML = `
    <div class="rev-pop-head">
      <div style="flex:1">
        <span class="rev-pop-kicker">${esc((g && g.nombre) || '')} · ${p.tipo === 'formula' ? 'campo calculado' : 'campo editable'}</span>
        <h5>${esc(p.l)}</h5>
      </div>
      <button class="rev-pop-cerrar" type="button" title="Cerrar">×</button>
    </div>
    <div class="rev-cuerpo">${cuerpoFormulario(p)}</div>
    <div class="rev-pop-pie">
      <span class="rev-firma">${r.autor ? esc(r.autor) + ' · ' + esc(horaCorta(r.ts)) : 'Sin responder'}</span>
      <button class="rev-btn" type="button" id="rev-pop-listo">Listo</button>
    </div>`;
  bindFormulario(popover, p, () => ubicarPopover(popover._ancla));

  const cerrarYGuardar = () => { Store.guardar(p.k); cerrarPopover(); };
  popover.querySelector('.rev-pop-cerrar').addEventListener('click', cerrarYGuardar);
  popover.querySelector('#rev-pop-listo').addEventListener('click', cerrarYGuardar);
}

/**
 * Cuelga los eventos del formulario de un ítem. `cont` es cualquier caja que
 * tenga adentro un .rev-cuerpo: el popover de un campo o la fila desplegada
 * del panel. `alRedibujar` se llama cuando el cuerpo se rehace.
 */
function bindFormulario(cont, p, alRedibujar){
  const key = p.k;

  const tocar = (cambios, redibujar) => {
    RESP[key] = Object.assign({}, RESP[key] || {}, cambios, { autor: AUTOR, ts: new Date().toISOString() });
    if (p.tipo === 'campo') RESP[key].pers = persEfectiva(p, RESP[key]);
    if (redibujar){
      cont.querySelector('.rev-cuerpo').innerHTML = cuerpoFormulario(p);
      bindFormulario(cont, p, alRedibujar);
      if (alRedibujar) alRedibujar();
    }
    const firma = cont.querySelector('.rev-firma');
    if (firma) firma.textContent = AUTOR + ' · ahora';
    pintarPuntos(); actualizarItems(); pintarProgreso();
  };

  // Los grupos que abren preguntas nuevas rehacen el cuerpo.
  const REDIBUJAN = { pers:true, origen:true, ok:true, precarga:false };
  cont.querySelectorAll('.rev-opciones[data-grupo]').forEach(grupo => {
    const campo = grupo.dataset.grupo;
    const redibujar = !!REDIBUJAN[campo];
    grupo.querySelectorAll('.rev-opcion').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!redibujar){
          grupo.querySelectorAll('.rev-opcion').forEach(b => b.classList.remove('rev-sel'));
          btn.classList.add('rev-sel');
        }
        tocar({ [campo]: btn.dataset.v }, redibujar);
        Store.guardar(key);
      });
    });
  });

  const chk = cont.querySelector('[data-chk="src"]');
  if (chk) chk.addEventListener('change', () => {
    verFuentes = chk.checked;
    aplicarResaltado(p, { scroll: chk.checked });
  });

  const guardarDebounced = debounce(() => Store.guardar(key), 700);
  cont.querySelectorAll('[data-campo]').forEach(n => {
    n.addEventListener('input', () => { tocar({ [n.dataset.campo]: n.value }, false); guardarDebounced(); });
  });
}

function clickAfuera(ev){
  if (!popover) return;
  if (popover.contains(ev.target) || ev.target.closest('.rev-dot') || ev.target.closest('.rev-item')) return;
  const k = keyAbierta;
  cerrarPopover();
  if (k) Store.guardar(k);
}
function teclaEscape(ev){ if (ev.key === 'Escape') cerrarPopover(); }

function ubicarPopover(ancla){
  if (!popover) return;
  const ancho = popover.offsetWidth;
  const alto  = popover.offsetHeight;
  let top, left;

  if (ancla && ancla.getBoundingClientRect && ancla.offsetParent !== null){
    const r = ancla.getBoundingClientRect();
    left = r.left + window.scrollX - ancho + r.width + 10;
    top  = r.bottom + window.scrollY + 10;
    if (top + alto > window.scrollY + window.innerHeight - 10){
      const arriba = r.top + window.scrollY - alto - 10;
      if (arriba > window.scrollY + 10) top = arriba;
    }
  } else {
    left = window.scrollX + (window.innerWidth - ancho) / 2;
    top  = window.scrollY + Math.max(20, (window.innerHeight - alto) / 2);
  }
  left = Math.max(window.scrollX + 12, Math.min(left, window.scrollX + window.innerWidth - ancho - 12));
  top  = Math.max(window.scrollY + 12, top);
  popover.style.left = left + 'px';
  popover.style.top  = top + 'px';
}

/* ---------------------------------------------------------------------
   Panel lateral
   --------------------------------------------------------------------- */
function montarPanel(){
  const fab = el('button','rev-fab rev-scope');
  fab.type = 'button';
  fab.innerHTML = 'Revisión <span class="rev-fab-contador" id="rev-fab-contador">0/0</span>';
  document.body.appendChild(fab);

  const fondo = el('div','rev-backdrop');
  document.body.appendChild(fondo);

  const drawer = el('div','rev-drawer rev-scope');
  drawer.innerHTML = `
    <div class="rev-drawer-head">
      <button class="rev-drawer-cerrar" type="button" title="Cerrar">×</button>
      <h3>Revisión del simulador</h3>
      <div class="rev-solapas">
        <button type="button" class="rev-solapa rev-sel" data-t="campo">Campos <span id="rev-cnt-campo"></span></button>
        <button type="button" class="rev-solapa" data-t="formula">Fórmulas <span id="rev-cnt-formula"></span></button>
      </div>
      <p id="rev-solapa-ayuda"></p>
      <div class="rev-progreso">
        <div class="rev-progreso-barra"><div class="rev-progreso-fill" id="rev-prog-fill"></div></div>
        <div class="rev-progreso-txt">
          <span id="rev-prog-txt">0 de 0 respondidos</span>
          <span id="rev-prog-pct">0 %</span>
        </div>
      </div>
    </div>
    <div class="rev-filtros">
      <button type="button" class="rev-opcion rev-sel" data-f="todos">Todos</button>
      <button type="button" class="rev-opcion" data-f="pendientes">Pendientes</button>
    </div>
    <div class="rev-lista" id="rev-lista"></div>
    <div class="rev-drawer-pie">
      <button class="rev-btn rev-btn-sec" type="button" id="rev-btn-json">Bajar respuestas</button>
      <button class="rev-btn rev-btn-sec" type="button" id="rev-btn-copiar">Copiar resumen</button>
    </div>`;
  document.body.appendChild(drawer);

  // La clase en el body habilita que lo resaltado se trepe por encima del
  // fondo oscuro (ver revision.css).
  const abrir  = () => {
    drawer.classList.add('rev-abierto'); fondo.classList.add('rev-abierto');
    document.body.classList.add('rev-panel-abierto');
  };
  const cerrar = () => {
    drawer.classList.remove('rev-abierto'); fondo.classList.remove('rev-abierto');
    document.body.classList.remove('rev-panel-abierto');
  };
  cerrarDrawer = cerrar;
  fab.addEventListener('click', abrir);
  fondo.addEventListener('click', cerrar);
  drawer.querySelector('.rev-drawer-cerrar').addEventListener('click', cerrar);

  drawer.querySelectorAll('.rev-solapa').forEach(btn => {
    btn.addEventListener('click', () => {
      drawer.querySelectorAll('.rev-solapa').forEach(b => b.classList.remove('rev-sel'));
      btn.classList.add('rev-sel');
      solapa = btn.dataset.t;
      expandido = null;
      pintarLista(true); pintarProgreso();
    });
  });

  drawer.querySelectorAll('.rev-filtros .rev-opcion').forEach(btn => {
    btn.addEventListener('click', () => {
      drawer.querySelectorAll('.rev-filtros .rev-opcion').forEach(b => b.classList.remove('rev-sel'));
      btn.classList.add('rev-sel');
      soloPendientes = btn.dataset.f === 'pendientes';
      expandido = null;
      pintarLista(true);
    });
  });

  drawer.querySelector('#rev-btn-json').addEventListener('click', bajarJSON);
  drawer.querySelector('#rev-btn-copiar').addEventListener('click', copiarResumen);
}

/**
 * Refresca el estado y el resumen de cada fila sin rehacer la lista, para no
 * matar el formulario que está desplegado (ni el foco de quien está tipeando).
 */
function actualizarItems(){
  document.querySelectorAll('#rev-lista .rev-item').forEach(item => {
    const p = paramPorKey(item.dataset.k);
    if (!p) return;
    const ok = respondido(p);
    item.classList.toggle('rev-done', ok);
    const meta = item.querySelector('.rev-item-meta');
    if (meta && ok) meta.innerHTML = '<b>' + esc(resumenRespuesta(p)) + '</b>' +
      ((RESP[p.k] || {}).autor ? ' · ' + esc(RESP[p.k].autor) : '');
  });
}

function pintarLista(forzar){
  const cont = document.getElementById('rev-lista');
  if (!cont) return;
  // Con una fórmula desplegada no se rehace la lista: se actualiza en el lugar.
  if (expandido && !forzar){ actualizarItems(); return; }

  const ayuda = document.getElementById('rev-solapa-ayuda');
  if (ayuda){
    ayuda.textContent = solapa === 'campo'
      ? 'Inputs que el usuario ve precargados. Para cada uno: ¿es personalizado por sociedad y de dónde sale el valor?'
      : 'Campos que el simulador calcula. Para cada uno: ¿la fórmula que inferimos del prototipo está bien?';
  }

  let html = '';
  REV_GRUPOS.filter(g => g.tipo === solapa).forEach(g => {
    const items = REV_PARAMS.filter(p => p.g === g.id)
      .filter(p => !soloPendientes || !respondido(p));
    if (!items.length) return;
    html += `<div class="rev-grupo-tit">${esc(g.nombre)}</div>`;
    items.forEach(p => {
      const r  = RESP[p.k] || {};
      const ok = respondido(p);
      let meta;
      if (ok){
        meta = '<b>' + esc(resumenRespuesta(p)) + '</b>' + (r.autor ? ' · ' + esc(r.autor) : '');
      } else if (p.tipo === 'formula'){
        meta = esc(p.f);
      } else {
        meta = 'Hoy: ' + esc(p.v || '—') + ' · sugerido: ' + (p.def === 'si' ? 'personalizado' : 'no personalizado');
      }
      const abierto = (expandido === p.k);
      html += `
        <div class="rev-item ${ok?'rev-done':''} ${p.nota||p.plm?'rev-con-nota':''} ${abierto?'rev-expandido':''}" data-k="${esc(p.k)}">
          <div class="rev-item-cab">
            <div class="rev-item-tit"><span class="rev-item-estado"></span>${esc(p.l)}</div>
            <div class="rev-item-meta">${meta}</div>
          </div>
          ${abierto ? `<div class="rev-item-cuerpo">
            <div class="rev-cuerpo">${cuerpoFormulario(p)}</div>
            <div class="rev-item-pie">
              <span class="rev-firma">${(RESP[p.k]||{}).autor
                ? esc(RESP[p.k].autor) + ' · ' + esc(horaCorta(RESP[p.k].ts)) : 'Sin responder'}</span>
              <button class="rev-btn rev-btn-sec" type="button" data-cerrar="1">Cerrar</button>
            </div>
          </div>` : ''}
        </div>`;
    });
  });
  if (!html) html = '<div class="rev-grupo-tit" style="margin-top:24px">No queda nada pendiente acá. Gracias.</div>';
  cont.innerHTML = html;

  cont.querySelectorAll('.rev-item').forEach(item => {
    const k = item.dataset.k;
    const p = paramPorKey(k);

    item.querySelector('.rev-item-cab').addEventListener('click', () => {
      // Las fórmulas se despliegan acá mismo, sin abrir nada encima.
      if (p && p.tipo === 'formula'){ alternarFormula(k); return; }
      const dot = document.querySelector('.rev-dot[data-rev-key="' + k + '"]');
      cerrarDrawer();  // para un campo, el panel taparía el campo y el popover
      if (p && p.el && dot){
        dot.scrollIntoView({behavior:'smooth', block:'center'});
        setTimeout(() => abrirPopover(k, dot), 340);
      } else {
        setTimeout(() => abrirPopover(k, null), 260);
      }
    });

    const cuerpo = item.querySelector('.rev-item-cuerpo');
    if (cuerpo && p){
      bindFormulario(item, p, null);
      const btn = cuerpo.querySelector('[data-cerrar]');
      if (btn) btn.addEventListener('click', () => { Store.guardar(k); alternarFormula(k); });
    }
  });
}

/** Despliega (o pliega) una fórmula dentro del panel y marca lo suyo en pantalla. */
function alternarFormula(k){
  const cerrando = (expandido === k);
  if (!cerrando && expandido) Store.guardar(expandido);
  expandido = cerrando ? null : k;
  pintarLista(true);

  if (cerrando){ Store.guardar(k); return; }

  const item = document.querySelector('#rev-lista .rev-item[data-k="' + k + '"]');
  if (item) item.scrollIntoView({behavior:'smooth', block:'nearest'});
  aplicarResaltado(paramPorKey(k), { scroll:true });
}

function pintarProgreso(){
  const hechos = totalRespondidos(solapa);
  const total  = deSolapa(solapa).length;
  const pct    = total ? Math.round(hechos * 100 / total) : 0;
  const set = (id, txt) => { const n = document.getElementById(id); if (n) n.textContent = txt; };
  const fill = document.getElementById('rev-prog-fill');
  if (fill) fill.style.width = pct + '%';
  set('rev-prog-txt', hechos + ' de ' + total + ' respondidos');
  set('rev-prog-pct', pct + ' %');
  set('rev-cnt-campo',   totalRespondidos('campo')   + '/' + deSolapa('campo').length);
  set('rev-cnt-formula', totalRespondidos('formula') + '/' + deSolapa('formula').length);
  set('rev-fab-contador', totalRespondidos() + '/' + REV_PARAMS.length);
}

/* ---------------------------------------------------------------------
   Exportar
   --------------------------------------------------------------------- */
function filasResumen(){
  return REV_PARAMS.map(p => {
    const r = RESP[p.k] || {};
    const g = grupoPorId(p.g);
    const base = {
      tipo: p.tipo,
      seccion: (g && g.nombre) || p.g,
      campo: p.l,
      autor: r.autor || '',
      actualizado: r.ts || '',
      comentario: r.coment || '',
      respondido: respondido(p),
    };
    if (p.tipo === 'formula'){
      return Object.assign(base, {
        formula_inferida: p.f,
        formula_ok: r.ok ? (r.ok === 'si' ? 'Sí' : 'No') : '',
        correccion: r.correccion || '',
      });
    }
    const pers = r.pers ? persEfectiva(p, r) : '';
    return Object.assign(base, {
      valor_precargado: p.v || '',
      personalizado_csv: p.def === 'si' ? 'Sí' : 'No',
      personalizado: pers ? (pers === 'si' ? 'Sí' : 'No') : '',
      origen: r.origen ? (r.origen === 'tabla' ? 'Tabla de parámetros' : 'Otro') : '',  // si es personalizado, de dónde sale el default
      origen_detalle: r.origenOtro || '',
      precarga: r.precarga ? LBL[r.precarga] : '',
    });
  });
}
function bajarJSON(){
  const blob = new Blob([JSON.stringify({ doc: REV_CONFIG.DOC, bajado: new Date().toISOString(), filas: filasResumen() }, null, 2)],
                        { type:'application/json' });
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'revision-simulador-' + REV_CONFIG.DOC + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function copiarResumen(){
  const txt = filasResumen().filter(f => f.respondido).map(f => {
    const base = '• ' + f.campo + ' → ' +
      (f.tipo === 'formula'
        ? (f.formula_ok === 'Sí' ? 'fórmula OK' : 'CORREGIR: ' + f.correccion)
        : (f.personalizado === 'Sí'
            ? 'personalizado · precarga ' + f.precarga + ' · default ' + (f.origen === 'Otro' ? f.origen_detalle : f.origen)
            : 'no personalizado · ' + (f.origen === 'Otro' ? f.origen_detalle : f.origen)));
    return base + (f.comentario ? '\n   ' + f.comentario : '') + (f.autor ? ' (' + f.autor + ')' : '');
  }).join('\n');
  const btn = document.getElementById('rev-btn-copiar');
  navigator.clipboard.writeText(txt || 'Todavía no hay respuestas.').then(() => {
    if (btn){ btn.textContent = 'Copiado ✓'; setTimeout(() => btn.textContent = 'Copiar resumen', 1600); }
  });
}

/* ---------------------------------------------------------------------
   Arranque
   --------------------------------------------------------------------- */
function pintarTodo(){ pintarPuntos(); pintarLista(); pintarProgreso(); pintarEstado(); }

async function iniciar(){
  montarTopbar();
  montarPanel();
  montarLeyenda();
  await pedirIdentidad();
  await Store.cargar();

  // El prototipo arma el panel del simulador recién al abrirlo, así que
  // volvemos a colgar los puntos después de cada render.
  if (typeof window.renderSimulador === 'function'){
    const original = window.renderSimulador;
    window.renderSimulador = function(){
      const salida = original.apply(this, arguments);
      expandirSecciones();
      montarPuntos();
      return salida;
    };
  }

  // Las tablas de Resultados se rehacen enteras con cada cambio de un input,
  // así que hay que volver a marcar lo resaltado después de cada render.
  if (typeof window.renderResultados === 'function'){
    const original = window.renderResultados;
    window.renderResultados = function(){
      const salida = original.apply(this, arguments);
      if (resaltado){
        const p = paramPorKey(resaltado);
        setTimeout(() => { if (resaltado) aplicarResaltado(p, { scroll:false }); }, 0);
      }
      return salida;
    };
  }

  // `state` es un const del script del prototipo: no está en window, pero sí
  // en el ámbito léxico global, así que se alcanza por nombre.
  const S = (typeof state !== 'undefined') ? state : null;

  // El prototipo arranca con Costos de Recría, Costos de Terminación y Venta
  // colapsadas. En la revisión todo tiene que estar a la vista.
  if (S && S.confirmado){
    Object.keys(S.confirmado).forEach(k => { S.confirmado[k] = false; });
  }

  // Negocio entra directo al simulador, sin pasar por el video.
  if (typeof window.abrirSimulador === 'function' && !(S && S.simuladorAbierto)){
    window.abrirSimulador();
  }

  expandirSecciones();
  montarPuntos();
  pintarTodo();

  if (hayEndpoint) setInterval(traerCambios, Math.max(8, REV_CONFIG.POLL_SEGUNDOS) * 1000);
  window.addEventListener('online', vaciarCola);
  window.addEventListener('resize', () => { if (popover) cerrarPopover(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();

})();
