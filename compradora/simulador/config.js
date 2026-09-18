/* =========================================================================
   CONFIG — Simulador de Negocio Ganadero · Revisión con Negocio
   =========================================================================
   Lo único que hay que tocar acá es ENDPOINT (paso 3 del README).
   El resto sale de los dos CSV:
     · Simulador NG - Campos a Completar.csv  → REV_CAMPOS
     · Simulador NG - Fórmulas.csv            → REV_FORMULAS
   ========================================================================= */

const REV_CONFIG = {

  // URL de la Web App de Google Apps Script (termina en /exec).
  // Mientras esté vacío, la página guarda sólo en este navegador
  // (localStorage) y muestra un aviso arriba.
  ENDPOINT: 'https://script.google.com/macros/s/AKfycbzE_ixkNubJGTpvFxoMXV3bRPPD4c1dQS0jXY6lj-0jSm9Lmprzb9B21Ubf8-_HShJPhQ/exec',

  // Identificador del documento dentro de la planilla.
  // Cambiándolo se arranca una revisión nueva sin pisar la anterior.
  DOC: 'simulador-v2',

  // Cada cuántos segundos se busca lo que cargaron los demás.
  POLL_SEGUNDOS: 20,
};

/* =========================================================================
   SECCIONES
   ========================================================================= */
const REV_GRUPOS = [
  // Campos editables precargados
  { id:'plan',        tipo:'campo',   nombre:'Plan Productivo' },
  { id:'recria',      tipo:'campo',   nombre:'Costos de Recría' },
  { id:'terminacion', tipo:'campo',   nombre:'Costos de Terminación' },
  { id:'venta',       tipo:'campo',   nombre:'Venta' },
  { id:'financiero',  tipo:'campo',   nombre:'Financiero' },
  // Campos calculados
  { id:'f-plan',        tipo:'formula', nombre:'Plan Productivo / Evolución' },
  { id:'f-recria',      tipo:'formula', nombre:'Costos de Recría' },
  { id:'f-terminacion', tipo:'formula', nombre:'Costos de Terminación' },
  { id:'f-venta',       tipo:'formula', nombre:'Venta' },
  { id:'f-resultado',   tipo:'formula', nombre:'Resultado Económico' },
  { id:'f-equilibrio',  tipo:'formula', nombre:'Precio de Equilibrio' },
];

/* =========================================================================
   1 · CAMPOS EDITABLES PRECARGADOS
   -------------------------------------------------------------------------
   k    → clave (no cambiar: es la que viaja a la planilla)
   g    → sección
   l    → nombre del campo
   el   → selector del campo en pantalla (null = sólo aparece en el panel)
   mount→ dónde se cuelga el punto: 'field' (default) | 'self' | 'table'
   v    → valor precargado hoy en el prototipo
   def  → 'si' | 'no' — personalización por sociedad según el CSV (viene marcada)
   nota → duda abierta del equipo de Producto
   plm  → nota de PLM
   ========================================================================= */
const REV_CAMPOS = [

  /* ---------------- Plan Productivo ---------------- */
  { k:'modoProductivo', g:'plan', l:'Modo Productivo', el:'#modo-productivo-toggle', mount:'self',
    v:'opciones: Recría+Terminación / Solo Recría / Solo Terminación', def:'no',
    plm:'El simulador ganadero es SOLO para tropas de Invernada, no para tropas de CRIA. Si la tropa es menor a 300 kg, proponer RECRÍA + TERMINACIÓN. Si la tropa es ≥ 300 kg, proponer TERMINACIÓN.' },

  { k:'recriaADG', g:'plan', l:'Ganancia Diaria en Recría — ADG (kg/día)', el:'#in-recria-adg',
    v:'0,50 kg/día', def:'si' },

  { k:'recriaDias', g:'plan', l:'Días en Recría', el:'#in-recria-dias',
    v:'los días necesarios para llegar a 350 kg en la recría', def:'si' },

  { k:'terminacionADG', g:'plan', l:'Ganancia Diaria en Terminación — ADG (kg/día)', el:'#in-term-adg',
    v:'1,25 kg/día', def:'si' },

  { k:'terminacionDias', g:'plan', l:'Días en Terminación', el:'#in-term-dias',
    v:'120 días', def:'si' },

  { k:'mortandadPct', g:'plan', l:'Mortandad (%)', el:'#in-mortandad',
    v:'2,0 % (Recría+Terminación) / 1,5 % (Solo Recría) / 1,0 % (Solo Terminación)', def:'si' },

  /* ---------------- Costos de Recría ---------------- */
  { k:'recriaCostoHaQuintales', g:'recria', l:'Costo Hectárea (quintales de soja)', el:'#in-recria-ha-quintales',
    v:'10 quintales/ha', def:'si',
    nota:'¿Cómo se calcula este valor en la práctica?' },

  { k:'recriaPrecioQuintalSoja', g:'recria', l:'Precio Quintal de Soja (USD)', el:'#in-recria-precio-quintal',
    v:'USD 21', def:'no' },

  { k:'recriaCostoSiembraPastura', g:'recria', l:'Costo Siembra Pastura (USD/ha)', el:'#in-recria-siembra',
    v:'USD 330', def:'si' },

  { k:'recriaMantenimientoPastura', g:'recria', l:'Mantenimiento Anual Pastura (USD/ha)', el:'#in-recria-mantenimiento',
    v:'USD 50', def:'si' },

  { k:'recriaVidaUtilPastura', g:'recria', l:'Vida Útil de la Pastura (años)', el:'#in-recria-vida-util',
    v:'4 años', def:'si' },

  { k:'recriaProduccionAnualMS', g:'recria', l:'Producción Anual de Materia Seca — MS (kg/ha)', el:'#in-recria-prod-ms',
    v:'10.000 kg MS/ha', def:'si' },

  { k:'recriaEficienciaPct', g:'recria', l:'Eficiencia de Aprovechamiento (%)', el:'#in-recria-eficiencia',
    v:'60 %', def:'si' },

  { k:'recriaConsumoPct', g:'recria', l:'Consumo en Recría (% peso vivo/día)', el:'#in-recria-consumo',
    v:'2,65 %', def:'si',
    nota:'¿De qué depende el consumo? ¿Varía según categoría del animal?' },

  { k:'recriaInsumoSanitarioPrecio', g:'recria', l:'INMC Recría — insumo sanitario ($/kg)', el:'#in-recria-sanitario-precio',
    v:'$4.416/kg', def:'no' },

  { k:'recriaDosisSanitaria', g:'recria', l:'Sanidad en Recría (kg INMC/cabeza)', el:'#in-recria-dosis',
    v:'2,8 kg/cabeza', def:'si' },

  /* ---------------- Costos de Terminación ---------------- */
  { k:'termEnergiaPct', g:'terminacion', l:'Energía — % de la dieta', el:'#in-term-energia-pct',
    v:'70 %', def:'si' },

  { k:'termEnergiaPrecio', g:'terminacion', l:'Energía — Precio ($/kg)', el:'#in-term-energia-precio',
    v:'$250/kg', def:'no' },

  { k:'termProteinaPct', g:'terminacion', l:'Proteína — % de la dieta', el:'#in-term-proteina-pct',
    v:'15 %', def:'si' },

  { k:'termProteinaPrecio', g:'terminacion', l:'Proteína — Precio ($/kg)', el:'#in-term-proteina-precio',
    v:'$425/kg', def:'no' },

  { k:'termFibraPct', g:'terminacion', l:'Fibra — % de la dieta', el:'#in-term-fibra-pct',
    v:'12,5 %', def:'si' },

  { k:'termFibraPrecio', g:'terminacion', l:'Fibra — Precio ($/kg)', el:'#in-term-fibra-precio',
    v:'$190/kg', def:'no' },

  { k:'termNucleoPct', g:'terminacion', l:'Núcleo Mineral — % de la dieta', el:'#in-term-nucleo-pct',
    v:'2,5 %', def:'si',
    nota:'La suma de los 4 porcentajes de la dieta hoy no está forzada a dar 100 % en el prototipo (sólo se pinta en rojo). ¿Corresponde bloquear el avance si no cierra?' },

  { k:'termNucleoPrecio', g:'terminacion', l:'Núcleo Mineral — Precio ($/kg)', el:'#in-term-nucleo-precio',
    v:'$1.750/kg', def:'no' },

  { k:'termConsumoPct', g:'terminacion', l:'Consumo en Terminación (% peso vivo/día)', el:'#in-term-consumo',
    v:'3,0 %', def:'si' },

  { k:'termInsumoSanitarioPrecio', g:'terminacion', l:'INMC Terminación — insumo sanitario ($/kg)', el:'#in-term-sanitario-precio',
    v:'$4.416/kg', def:'no' },

  { k:'termDosisSanitaria', g:'terminacion', l:'Sanidad en Terminación (kg INMC/cabeza)', el:'#in-term-dosis',
    v:'1,8 kg/cabeza', def:'si' },

  { k:'termEstructuraCabezaDia', g:'terminacion', l:'Costo de Estructura ($/cabeza/día)', el:'#in-term-estructura-cabezadia',
    v:'$200/cabeza/día', def:'si' },

  /* ---------------- Venta ---------------- */
  { k:'tipoPrecioVenta', g:'venta', l:'Tipo de Precio de Venta', el:'#tipo-precio-venta-toggle', mount:'self',
    v:'"Vivo" (opciones: $/kg Vivo o $/kg Carne)', def:'si' },

  { k:'rindeEstimadoPct', g:'venta', l:'Rinde Estimado (%) — sólo si el precio es en Carne', el:'#in-rinde-estimado',
    v:'58 %', def:'si' },

  { k:'precioVenta', g:'venta', l:'Precio de Venta ($/kg)', el:'#in-precio-venta',
    v:'$5.200/kg', def:'no' },

  { k:'comisionVentaPct', g:'venta', l:'Gastos Comerciales de Venta (%)', el:'#in-comision-venta',
    v:'0 % — totalmente editable, sin default documentado', def:'si',
    nota:'A diferencia de la comisión de compra, ésta arranca en 0 % sin fuente definida. ¿De dónde debería salir?' },

  { k:'plazoVentaDias', g:'venta', l:'Plazo de Cobro (días)', el:'#in-plazo-venta',
    v:'21 días', def:'si' },

  { k:'fleteVentaModo', g:'venta', l:'Flete de Venta — Modo', el:'#flete-venta-toggle', mount:'self',
    v:'"A Retirar" (aplica sólo si hay etapa de Terminación; otra opción: "Puesto en Planta")', def:'si' },

  { k:'fleteVentaJaulas', g:'venta', l:'Flete de Venta — Jaulas', el:'#in-flete-venta-jaulas',
    v:'4 jaulas', def:'no',
    nota:'El flete de venta "Puesto en Planta" arranca precargado con valores de ejemplo del lote (4 jaulas, 370 km, $2.500/km) en vez de en blanco o 0 — riesgo de que el usuario no lo revise.',
    plm:'Hay que calcularlo según la cantidad de kilos a venta.' },

  { k:'fleteVentaKm', g:'venta', l:'Flete de Venta — Km', el:'#in-flete-venta-km',
    v:'370 km', def:'si' },

  { k:'fleteVentaTarifa', g:'venta', l:'Flete de Venta — Tarifa ($/km)', el:'#in-flete-venta-tarifa',
    v:'$2.500/km', def:'no' },

  /* ---------------- Financiero ---------------- */
  { k:'tasaAnualPct', g:'financiero', l:'Costo de Oportunidad Anual — Tasa (%)', el:'#in-tasa',
    v:'18 %', def:'no',
    nota:'¿De dónde sale esta tasa? Se aplica en forma lineal, sin interés compuesto.' },
];

/* =========================================================================
   2 · CAMPOS CALCULADOS — fórmula inferida del prototipo
   -------------------------------------------------------------------------
   k → clave · g → sección · l → campo · f → fórmula inferida · nota → nota de Producto
   ========================================================================= */
const REV_FORMULAS = [

  /* ---------------- Plan Productivo / Evolución ---------------- */
  { k:'f_kgRecria', g:'f-plan', l:'Kg Ganados en Recría',
    out:['#nota-recria-ganancia'], src:['#in-recria-adg', '#in-recria-dias'],
    f:'ADG Recría (kg/día) × Días en Recría' },
  { k:'f_kgTerminacion', g:'f-plan', l:'Kg Ganados en Terminación',
    out:['#nota-term-ganancia'], src:['#in-term-adg', '#in-term-dias'],
    f:'ADG Terminación (kg/día) × Días en Terminación' },
  { k:'f_pesoFinRecria', g:'f-plan', l:'Peso Fin de Recría',
    out:['#out-recria-pesosalida', 'chip:Fin Recría'], src:['#in-titulo-peso', '#nota-recria-ganancia'],
    f:'Peso de Compra + Kg Ganados en Recría' },
  { k:'f_pesoFinal', g:'f-plan', l:'Peso Final (fin de Terminación)',
    out:['chip:Fin Terminación'], src:['#out-recria-pesosalida', '#nota-term-ganancia'],
    f:'Peso Fin de Recría + Kg Ganados en Terminación' },
  { k:'f_diasProduccion', g:'f-plan', l:'Días de Producción Total',
    out:['#out-recria-diasplan', '#out-term-diasplan'], src:['#in-recria-dias', '#in-term-dias', '#modo-productivo-toggle'],
    f:'Días en Recría + Días en Terminación (sólo las etapas activas según el Modo Productivo)' },
  { k:'f_fechaIngreso', g:'f-plan', l:'Fecha de Ingreso al Campo',
    out:['#nota-fecha-ingreso'], src:[],
    f:'HOY() + 7 días corridos' },
  { k:'f_fechaFinRecria', g:'f-plan', l:'Fecha Fin de Recría',
    out:['#fecha-fin-recria-plan', '#fecha-fin-recria-costos'], src:['#nota-fecha-ingreso', '#in-recria-dias'],
    f:'Fecha de Ingreso al Campo + Días en Recría' },
  { k:'f_fechaFinTerm', g:'f-plan', l:'Fecha Fin de Terminación / Salida a Venta',
    out:['#fecha-fin-term-plan', '#fecha-fin-term-costos', '#nota-fecha-venta'], src:['#nota-fecha-ingreso', '#in-recria-dias', '#in-term-dias'],
    f:'Fecha de Ingreso al Campo + Días de Producción Total' },
  { k:'f_mortRecria', g:'f-plan', l:'Mortandad % Recría',
    interna:true, impacta:['f_cabVenta'],
    uso:'Reparte la mortandad global entre las dos etapas según cuánto dura cada una. De acá salen las cabezas que se pierden en recría.',
    out:[], src:['#in-mortandad', '#in-recria-dias', '#in-term-dias'],
    f:'Mortandad Global (%) × (Días en Recría ÷ Días de Producción Total)' },
  { k:'f_mortTerm', g:'f-plan', l:'Mortandad % Terminación',
    interna:true, impacta:['f_cabVenta'],
    uso:'La otra mitad del reparto de la mortandad global. De acá salen las cabezas que se pierden en terminación.',
    out:[], src:['#in-mortandad', '#in-recria-dias', '#in-term-dias'],
    f:'Mortandad Global (%) × (Días en Terminación ÷ Días de Producción Total)' },
  { k:'f_cabPerdRecria', g:'f-plan', l:'Cabezas Perdidas en Recría',
    interna:true, impacta:['f_cabVenta'],
    uso:'Se resta de las cabezas que ingresan a recría para saber cuántas siguen a terminación.',
    out:[], src:['#in-titulo-cabezas', '#in-mortandad', '#in-recria-dias'],
    f:'REDONDEAR.MAS(Cabezas que Ingresan a Recría × Mortandad % Recría; 0) — siempre redondea hacia arriba' },
  { k:'f_cabSalenRecria', g:'f-plan', l:'Cabezas que Salen de Recría',
    interna:true, impacta:['f_cabVenta'],
    uso:'Es la cantidad que ingresa a terminación — o la que se vende, si el modo es Solo Recría.',
    out:[], src:['#in-titulo-cabezas', '#in-mortandad'],
    f:'Cabezas que Ingresan a Recría − Cabezas Perdidas en Recría' },
  { k:'f_cabIngTerm', g:'f-plan', l:'Cabezas que Ingresan a Terminación',
    interna:true, impacta:['f_cabVenta'],
    uso:'Es la base del costo de producción de terminación de todo el lote.',
    out:[], src:['#in-titulo-cabezas', '#modo-productivo-toggle'],
    f:'Cabezas que Salen de Recría (o Cabezas de Compra si el modo es "Solo Terminación")' },
  { k:'f_cabPerdTerm', g:'f-plan', l:'Cabezas Perdidas en Terminación',
    interna:true, impacta:['f_cabVenta'],
    uso:'Se resta para llegar a las cabezas de venta.',
    out:[], src:['#in-mortandad', '#in-term-dias'],
    f:'REDONDEAR.MAS(Cabezas que Ingresan a Terminación × Mortandad % Terminación; 0)' },
  { k:'f_cabVenta', g:'f-plan', l:'Cabezas de Venta',
    out:['#nota-venta-resumen'], src:['#modo-productivo-toggle'],
    f:'Cabezas que Salen de Terminación (o de Recría si el modo es "Solo Recría")' },

  /* ---------------- Costos de Recría ---------------- */
  { k:'f_costoAnualPastura', g:'f-recria', l:'Costo Anual Pastura/ha (ARS)',
    interna:true, impacta:['f_costoKgMS'],
    uso:'Es el paso previo al costo por kg de materia seca, que después define todo el costo de alimentación de la recría.',
    out:[], src:['#in-recria-ha-quintales', '#in-recria-precio-quintal', '#in-recria-siembra', '#in-recria-vida-util', '#in-recria-mantenimiento', '#dolar-mep-display'],
    f:'(Costo Ha en quintales de soja × Precio Quintal de Soja + Costo Siembra Pastura ÷ Vida Útil + Mantenimiento Anual Pastura) × Cotización Dólar MEP' },
  { k:'f_kgMSAprov', g:'f-recria', l:'Kg MS Aprovechable/ha',
    interna:true, impacta:['f_costoKgMS'],
    uso:'Es el divisor del costo anual de la pastura: de esa división sale el costo por kg de materia seca.',
    out:[], src:['#in-recria-prod-ms', '#in-recria-eficiencia'],
    f:'Producción Anual de MS × Eficiencia de Aprovechamiento (%)' },
  { k:'f_costoKgMS', g:'f-recria', l:'Costo por kg de MS',
    out:['#out-recria-costokgms'], src:[],
    f:'Costo Anual Pastura/ha (ARS) ÷ Kg MS Aprovechable/ha' },
  { k:'f_pesoPromRecria', g:'f-recria', l:'Peso Promedio en Recría',
    out:['#out-recria-pesoprom'], src:['#in-titulo-peso', '#out-recria-pesosalida'],
    f:'(Peso de Compra + Peso Fin de Recría) ÷ 2' },
  { k:'f_costoAlimRecria', g:'f-recria', l:'Costo Alimentación Recría (por cabeza)',
    out:['#out-recria-costoalim'], src:['#out-recria-pesoprom', '#in-recria-consumo', '#in-recria-dias', '#out-recria-costokgms'],
    f:'Peso Promedio en Recría × Consumo Recría (%) × Días en Recría × Costo por kg de MS' },
  { k:'f_costoSanRecria', g:'f-recria', l:'Costo Sanidad Recría (por cabeza)',
    out:['#out-recria-costosanidad'], src:['#in-recria-dosis', '#in-recria-sanitario-precio'],
    f:'Dosis Sanitaria Recría (kg INMC) × Precio INMC Recría ($/kg)' },
  { k:'f_costoTotRecriaCab', g:'f-recria', l:'Costo Total Recría (por cabeza)',
    out:['#out-recria-costototal'], src:['#out-recria-costoalim', '#out-recria-costosanidad'],
    f:'Costo Alimentación Recría + Costo Sanidad Recría' },
  { k:'f_costoKgProdRecria', g:'f-recria', l:'Costo Total por kg producido (Recría)',
    out:['#out-recria-costokgproducido'], src:['#out-recria-costototal', '#nota-recria-ganancia'],
    f:'Costo Total Recría (por cabeza) ÷ Kg Ganados en Recría' },
  { k:'f_costoProdRecria', g:'f-recria', l:'Costo de Producción de Recría (lote)',
    out:['fila:Costo Producción Recría'], src:['#out-recria-costototal', '#in-titulo-cabezas'],
    f:'Costo Total Recría (por cabeza) × Cabezas que Ingresan a Recría' },

  /* ---------------- Costos de Terminación ---------------- */
  { k:'f_costoRacion', g:'f-terminacion', l:'Costo Promedio de la Ración ($/kg)',
    out:['#out-term-costoracion'], src:['#in-term-energia-pct', '#in-term-energia-precio', '#in-term-proteina-pct', '#in-term-proteina-precio', '#in-term-fibra-pct', '#in-term-fibra-precio', '#in-term-nucleo-pct', '#in-term-nucleo-precio'],
    f:'(%Energía × Precio Energía) + (%Proteína × Precio Proteína) + (%Fibra × Precio Fibra) + (%Núcleo × Precio Núcleo)',
    nota:'El prototipo no valida que los 4 % sumen 100 %.' },
  { k:'f_pesoPromTerm', g:'f-terminacion', l:'Peso Promedio en Terminación',
    out:['#out-term-pesoprom'], src:['#out-recria-pesosalida', 'chip:Fin Terminación'],
    f:'(Peso de Ingreso a Terminación + Peso Final) ÷ 2' },
  { k:'f_costoAlimTerm', g:'f-terminacion', l:'Costo Alimentación Terminación (por cabeza)',
    out:['#out-term-costoalim'], src:['#out-term-pesoprom', '#in-term-consumo', '#in-term-dias', '#out-term-costoracion'],
    f:'Peso Promedio en Terminación × Consumo Terminación (%) × Días en Terminación × Costo Promedio de la Ración' },
  { k:'f_costoSanTerm', g:'f-terminacion', l:'Costo Sanidad Terminación (por cabeza)',
    out:['#out-term-costosanidad'], src:['#in-term-dosis', '#in-term-sanitario-precio'],
    f:'Dosis Sanitaria Terminación (kg INMC) × Precio INMC Terminación ($/kg)' },
  { k:'f_costoEstructura', g:'f-terminacion', l:'Costo Estructura (por cabeza)',
    out:['#out-term-costoestructura'], src:['#in-term-estructura-cabezadia', '#in-term-dias'],
    f:'Costo Estructura ($/cabeza/día) × Días en Terminación' },
  { k:'f_costoTotTermCab', g:'f-terminacion', l:'Costo Total Terminación (por cabeza)',
    out:['#out-term-costototal'], src:['#out-term-costoalim', '#out-term-costosanidad', '#out-term-costoestructura'],
    f:'Costo Alimentación Terminación + Costo Sanidad Terminación + Costo Estructura' },
  { k:'f_kgAlimDia', g:'f-terminacion', l:'Kg de Alimento Consumido/día (informativo)',
    out:['#out-term-kgdiario'], src:['#out-term-pesoprom', '#in-term-consumo'],
    f:'Peso Promedio en Terminación × Consumo Terminación (%)' },
  { k:'f_conversion', g:'f-terminacion', l:'Conversión (informativo)',
    out:['#out-term-conversion'], src:['#out-term-kgdiario', '#in-term-adg'],
    f:'Kg de Alimento Consumido/día ÷ ADG de Terminación' },
  { k:'f_costoKgProdTerm', g:'f-terminacion', l:'Costo Total por kg producido (Terminación)',
    out:['#out-term-costokgproducido'], src:['#out-term-costototal', '#nota-term-ganancia'],
    f:'Costo Total Terminación (por cabeza) ÷ Kg Ganados en Terminación' },
  { k:'f_costoProdTerm', g:'f-terminacion', l:'Costo de Producción de Terminación (lote)',
    out:['fila:Costo Producción Terminación'], src:['#out-term-costototal', '#in-titulo-cabezas'],
    f:'Costo Total Terminación (por cabeza) × Cabezas que Ingresan a Terminación' },
  { k:'f_costoProdTotal', g:'f-terminacion', l:'Costo de Producción Total',
    out:['fila:− Costo de Producción'], src:['fila:Costo Producción Recría', 'fila:Costo Producción Terminación'],
    f:'Costo de Producción de Recría + Costo de Producción de Terminación' },

  /* ---------------- Venta ---------------- */
  { k:'f_factorRinde', g:'f-venta', l:'Factor de Rinde',
    interna:true, impacta:['f_importeHaciendaVenta'],
    uso:'Convierte el precio a un equivalente sobre el peso vivo cuando está expresado en carne. Multiplica el importe de la venta y los dos precios de equilibrio.',
    out:[], src:['#tipo-precio-venta-toggle', '#in-rinde-estimado'],
    f:'SI(Tipo de Precio de Venta = "Carne"; Rinde Estimado (%); 1)' },
  { k:'f_importeHaciendaVenta', g:'f-venta', l:'Importe Hacienda Venta',
    out:['fila:Importe Hacienda##Venta'], src:['#nota-venta-resumen', 'chip:Fin Terminación', '#in-precio-venta'],
    f:'Cabezas de Venta × Peso Final × Precio de Venta × Factor de Rinde' },
  { k:'f_gastosComVenta', g:'f-venta', l:'Gastos Comerciales de Venta',
    out:['fila:Gastos Comerciales##Venta'], src:['fila:Importe Hacienda##Venta', '#in-comision-venta'],
    f:'Importe Hacienda Venta × Gastos Comerciales de Venta (%)' },
  { k:'f_costoFleteVenta', g:'f-venta', l:'Costo Flete de Venta',
    out:['fila:Costo de Flete##Venta'], src:['#flete-venta-toggle', '#in-flete-venta-jaulas', '#in-flete-venta-km', '#in-flete-venta-tarifa'],
    f:'SI(hay etapa de Terminación Y Modo Flete Venta = "Puesto en Planta"; Jaulas × Km × $/km; 0)' },
  { k:'f_importeTotalVenta', g:'f-venta', l:'Importe Total de Venta',
    out:['fila:Importe Total Venta'], src:['fila:Importe Hacienda##Venta', 'fila:Gastos Comerciales##Venta', 'fila:Costo de Flete##Venta'],
    f:'Importe Hacienda Venta − Gastos Comerciales de Venta − Costo Flete de Venta' },

  /* ---------------- Resultado Económico ---------------- */
  { k:'f_margenBruto', g:'f-resultado', l:'Margen Bruto',
    out:['fila:Margen Bruto'], src:['fila:Importe Total Venta', 'fila:Importe Total Compra'],
    f:'Importe Total de Venta − Importe Total de Compra' },
  { k:'f_margenNetoProd', g:'f-resultado', l:'Margen Neto Productivo',
    out:['fila:Margen Neto Productivo'], src:['fila:Margen Bruto', 'fila:− Costo de Producción'],
    f:'Margen Bruto − Costo de Producción Total' },
  { k:'f_diasFinCompra', g:'f-resultado', l:'Días de Financiamiento (Compra)',
    interna:true, impacta:['f_costoOportCompra'],
    uso:'Son los días que queda inmovilizada la plata de la compra. Multiplican la tasa en el costo de oportunidad financiero.',
    out:[], src:['#in-recria-dias', '#in-term-dias', '#plazo-compra-pills', '#in-plazo-venta'],
    f:'Días de Producción Total − Plazo de Compra (días) + Plazo de Venta (días)' },
  { k:'f_costoOportCompra', g:'f-resultado', l:'Costo de Oportunidad Financiero (Compra)',
    out:['fila:− Costo Oport. Financiero Compra'], src:['fila:Importe Total Compra', '#in-tasa'],
    f:'Importe Total de Compra × Tasa Anual (%) × Días de Financiamiento ÷ 365' },
  { k:'f_diasFinRecria', g:'f-resultado', l:'Días Financiero Recría',
    interna:true, impacta:['f_costoFinRecria'],
    uso:'Son los días desde la mitad de la recría hasta el cobro. Multiplican la tasa en el costo financiero de recría.',
    out:[], src:['#in-recria-dias', '#in-term-dias', '#in-plazo-venta'],
    f:'(Días de Producción Total + Plazo de Venta) − (Días en Recría ÷ 2)' },
  { k:'f_costoFinRecria', g:'f-resultado', l:'Costo Financiero Recría',
    out:['fila:− Costo Financiero Recría'], src:['fila:Costo Producción Recría', '#in-tasa'],
    f:'Costo de Producción de Recría × Tasa Anual (%) × Días Financiero Recría ÷ 365' },
  { k:'f_diasFinTerm', g:'f-resultado', l:'Días Financiero Terminación',
    interna:true, impacta:['f_costoFinTerm'],
    uso:'Son los días desde la mitad de la terminación hasta el cobro. Multiplican la tasa en el costo financiero de terminación.',
    out:[], src:['#in-recria-dias', '#in-term-dias', '#in-plazo-venta'],
    f:'(Días de Producción Total + Plazo de Venta) − Días en Recría − (Días en Terminación ÷ 2)' },
  { k:'f_costoFinTerm', g:'f-resultado', l:'Costo Financiero Terminación',
    out:['fila:− Costo Financiero Terminación'], src:['fila:Costo Producción Terminación', '#in-tasa'],
    f:'Costo de Producción de Terminación × Tasa Anual (%) × Días Financiero Terminación ÷ 365' },
  { k:'f_costoFinTotal', g:'f-resultado', l:'Costo Financiero Total',
    interna:true, impacta:['f_margenNetoEco'],
    uso:'Es lo que se le resta al Margen Neto Productivo para llegar al Margen Neto Económico, y lo único que separa un precio de equilibrio del otro.',
    out:[], src:['fila:− Costo Oport. Financiero Compra', 'fila:− Costo Financiero Recría', 'fila:− Costo Financiero Terminación'],
    f:'Costo de Oportunidad Financiero (Compra) + Costo Financiero Recría + Costo Financiero Terminación' },
  { k:'f_margenNetoEco', g:'f-resultado', l:'Margen Neto Económico',
    out:['fila:Margen Neto Económico', '#margen-final-wrap'], src:['fila:Margen Neto Productivo'],
    f:'Margen Neto Productivo − Costo Financiero Total' },
  { k:'f_importePagado', g:'f-resultado', l:'Importe Pagado Total',
    out:['#margen-final-wrap'], src:['fila:Importe Total Compra', 'fila:− Costo de Producción'],
    f:'Importe Total de Compra + Costo de Producción Total' },
  { k:'f_margenNetoEcoPct', g:'f-resultado', l:'Margen Neto Económico (%)',
    out:['#margen-final-wrap'], src:['fila:Margen Neto Económico', 'fila:Importe Total Compra', 'fila:− Costo de Producción'],
    f:'Margen Neto Económico ÷ Importe Pagado Total × 100' },
  { k:'f_diasNegocio', g:'f-resultado', l:'Días de Negocio Total',
    interna:true, impacta:['f_margenAnualizado'],
    uso:'Es la base para anualizar el margen: 365 ÷ días de negocio.',
    out:[], src:['#in-recria-dias', '#in-term-dias', '#in-plazo-venta'],
    f:'Días de Producción Total + Plazo de Venta' },
  { k:'f_margenAnualizado', g:'f-resultado', l:'Margen Neto Económico (% Anualizado)',
    out:['#margen-final-wrap'], src:['fila:Margen Neto Económico'],
    f:'Margen Neto Económico (%) × (365 ÷ Días de Negocio Total)' },

  /* ---------------- Precio de Equilibrio ---------------- */
  { k:'f_denomEquilibrio', g:'f-equilibrio', l:'Denominador de Equilibrio',
    interna:true, impacta:['f_equilibrioProd', 'f_equilibrioEco'],
    uso:'Son los kilos que efectivamente se cobran. Es el divisor de los dos precios de equilibrio.',
    out:[], src:['#nota-venta-resumen', 'chip:Fin Terminación', '#in-comision-venta', '#tipo-precio-venta-toggle', '#in-rinde-estimado'],
    f:'Cabezas de Venta × Peso Final × (1 − Gastos Comerciales de Venta %) × Factor de Rinde' },
  { k:'f_equilibrioProd', g:'f-equilibrio', l:'Precio de Equilibrio Productivo ($/kg)',
    out:['#equilibrio-grid'], src:['fila:Importe Total Compra', 'fila:− Costo de Producción', 'fila:Costo de Flete##Venta'],
    f:'(Importe Total de Compra + Costo de Producción Total + Costo Flete de Venta) ÷ Denominador de Equilibrio' },
  { k:'f_equilibrioEco', g:'f-equilibrio', l:'Precio de Equilibrio Económico ($/kg)',
    out:['#equilibrio-grid'], src:['fila:Importe Total Compra', 'fila:− Costo de Producción', 'fila:Costo de Flete##Venta', 'fila:− Costo Oport. Financiero Compra'],
    f:'(Importe Total de Compra + Costo de Producción Total + Costo Flete de Venta + Costo Financiero Total) ÷ Denominador de Equilibrio' },
];

/* -------------------------------------------------------------------------
   Lista única que consume revision.js. Las fórmulas marcadas `interna` no
   entran: no se piden por separado, se muestran como pasos dentro de las
   fórmulas donde impactan.
   ------------------------------------------------------------------------- */
const REV_PARAMS = []
  .concat(REV_CAMPOS.map(p   => Object.assign({ tipo:'campo' },   p)))
  .concat(REV_FORMULAS.filter(p => !p.interna).map(p => Object.assign({ tipo:'formula' }, p)));
