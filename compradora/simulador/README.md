# Simulador de Negocio Ganadero — versión revisión con negocio

Clon del prototipo (`01_features/buyer_experience/simulador-negocio-ganadero/prototype/`)
preparado para publicarse en GitHub Pages y que negocio confirme, sobre la
pantalla misma, cómo se comporta cada valor del modelo.

El prototipo no se tocó: el simulador calcula exactamente igual. Todo lo
agregado vive en `revision.css` / `revision.js` y se monta encima.

## Qué se revisa

Dos cosas distintas, con dos formularios distintos.

### 1 · Campos editables precargados (38)

Los inputs que el usuario ve ya completados. Para cada uno:

- **¿Es personalizado por sociedad?** — la respuesta del CSV
  viene ya marcada, con el cartelito "sugerido" mientras negocio no la confirme
  ni la cambie. La pregunta que sigue aparece de entrada, sin tener que elegir
  primero. Un campo no cuenta como respondido hasta que esa segunda pregunta
  está completa.
  - Si **NO** → ¿de dónde se obtiene el valor? **Tabla de parámetros** u
    **Otro** (y cuál).
  - Si **SÍ** → ¿con qué lo precargamos: **mediana**, **promedio** o **último
    valor**? Y el **valor por defecto**, el que rige mientras la sociedad no
    tenga historia propia: **Tabla de parámetros** u **Otro** (y cuál).
- Comentario.

Cada uno tiene su punto de revisión al lado del campo en pantalla, así se
responde viendo el dato en contexto.

### 2 · Campos calculados (42)

Los que el simulador deriva de otros. Para cada uno se muestra la **fórmula
inferida leyendo el código del prototipo** y se pide calificarla:

- **¿La fórmula está bien?** — Está bien / Hay que corregirla.
  - Si hay que corregirla → cuál es el error o la fórmula correcta.
- Comentario.

Las fórmulas se revisan desde el panel lateral: al tocar una, **se despliega ahí
mismo** (no se abre ninguna tarjeta encima), la página baja sola y **resalta en
azul el campo que esa fórmula completa**. Hay además una opción para **resaltar
en amarillo los campos que intervienen** en la cuenta, que queda activada para
las fórmulas siguientes. Todo lo resaltado queda por encima del fondo oscuro del
panel, así que se lee claro mientras el resto de la pantalla está atenuado. Una
barra abajo a la izquierda dice qué se está resaltando y permite quitarlo.

Hay además 15 cálculos que el prototipo hace pero no muestra en ningún lado
(el prorrateo de la mortandad por etapa, la cadena de cabezas, los días de
financiamiento, el denominador del precio de equilibrio…). No se piden por
separado — sería pedir opinión sobre algo que no se ve: aparecen como **pasos
intermedios dentro de la fórmula donde impactan**, con su nombre y su cuenta, y
sus campos de entrada entran en el resaltado de esa fórmula.

### Además

- Las dudas abiertas del equipo de Producto y las notas de PLM que venían en
  los CSV aparecen dentro del ítem al que corresponden.
- Negocio puede mover los valores del simulador para ver cómo impacta cada uno
  en el resultado. Eso no se guarda: lo único que se guarda son las respuestas.
- Todas las secciones del simulador arrancan desplegadas y se sacaron los
  botones "Confirmar ✓" de cada sección, que en el flujo del comprador pliegan
  y esconden campos a revisar.
- Se identifica con el nombre al entrar, así después se sabe quién respondió qué.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | El prototipo clonado, con dos líneas agregadas para cargar la capa de revisión |
| `config.js` | **El único archivo a tocar.** Endpoint de guardado + `REV_CAMPOS` y `REV_FORMULAS` |
| `revision.css` | Estilos de la capa de revisión (tokens de `Design_dCaC.md`) |
| `revision.js` | Puntos, popover, panel, guardado |
| `apps-script.gs` | El backend, para pegar en Google Apps Script |

## Puesta en marcha

### 1. La planilla

Creá una planilla nueva en Google Sheets. No hace falta armar nada adentro:
la hoja `respuestas` con sus encabezados se crea sola en el primer guardado.

### 2. El backend

En esa planilla: **Extensiones → Apps Script**. Borrá lo que haya y pegá el
contenido de `apps-script.gs`. Guardá.

Después **Implementar → Nueva implementación → Aplicación web**:

- Descripción: `revisión simulador`
- Ejecutar como: **Yo**
- Quién tiene acceso: **Cualquier usuario** ← importante, si no negocio no puede escribir

Google te va a pedir autorizar el script (aparece una pantalla de "app no
verificada": **Configuración avanzada → Ir a...**, es tu propio script).

Copiá la URL que termina en `/exec`.

### 3. El endpoint

Pegá esa URL en `config.js`:

```js
ENDPOINT: 'https://script.google.com/macros/s/AKfy.../exec',
```

Mientras esté vacío la página funciona igual, pero guarda sólo en el navegador
de cada uno y avisa arriba.

### 4. GitHub Pages

Los cuatro archivos (`index.html`, `config.js`, `revision.js`, `revision.css`)
van juntos en una misma carpeta. Puede ser la raíz de un repo nuevo o, si ya
tenés un GitHub Pages de prototipos con una carpeta por proyecto, la carpeta de
éste: las rutas son relativas y anda igual. `apps-script.gs` podés dejarlo al
lado o no, no se sirve.

Si el repo es nuevo: **Settings → Pages → Source: Deploy from a branch →
main / (root)**. En un par de minutos queda en
`https://<usuario>.github.io/<repo>/<carpeta>/`.

> El repo es público: cualquiera con la URL ve la estructura de costos y
> comisiones del modelo. No pongas datos de operaciones reales ni de clientes.

### 5. Probar antes de compartir

Primero probá el endpoint solo: pegá la URL `/exec` en una ventana de incógnito.
Tiene que devolver `{"ok":true,...}` en texto plano. **Si te pide login de
Google, la Web App quedó restringida** y la página no va a poder guardar nada.

Después abrí la página en incógnito, respondé un campo, recargá y fijate que
siga ahí.

#### Si dice "No se puede guardar — falta permiso"

Es el caso más común y significa que el endpoint devolvió la pantalla de login
de Google en vez de la respuesta. En **Implementar → Administrar implementaciones
→ editar la activa (ícono del lápiz) → Quién tiene acceso: Cualquier usuario**.
Editando la que ya existe se conserva la misma URL; creando una nueva, cambia y
hay que actualizar el `ENDPOINT`.

Tres detalles que suelen ser la causa exacta:

- **"Cualquier usuario" no es lo mismo que "Cualquier usuario con una Cuenta de
  Google".** La segunda sigue pidiendo login.
- **La URL `/dev` siempre pide login**, tenga el acceso que tenga. Sólo sirve
  la `/exec`.
- **Ejecutar como: Yo**, porque la planilla es tuya.

Y si cambiaste el código del script, acordate de **actualizar la implementación**:
editar el `.gs` no cambia lo que está publicado.

Mientras tanto no se pierde nada: lo que se responda queda en el navegador de
esa persona y se sube solo cuando el permiso esté arreglado. La consola del
navegador (F12) tiene el detalle de cada falla.

## Cómo leer las respuestas

**La planilla** — una fila por ítem, con estas columnas:

| Columna | Qué trae |
|---|---|
| `tipo` | `campo` o `formula` |
| `seccion`, `campo` | dónde vive y cómo se llama |
| `valor_o_formula` | el valor precargado, o la fórmula inferida |
| `personalizado_csv` | lo que decía el CSV |
| `personalizado` | lo que respondió negocio |
| `origen`, `origen_detalle` | de dónde sale el valor; si es personalizado, de dónde sale el valor por defecto |
| `precarga` | sólo si SÍ es personalizado |
| `formula_ok`, `correccion` | sólo fórmulas |
| `comentario`, `autor`, `actualizado` | |

También están los botones **Bajar respuestas** (JSON con todo) y **Copiar
resumen** (texto plano) en el panel.

Si dos personas tocan el mismo ítem, gana el último en guardar y queda su
nombre. La página refresca lo que cargaron los demás cada 20 segundos.

## Dudas frecuentes

**¿Puedo ponerle el nombre que quiera a la planilla y al proyecto de Apps
Script?** Sí. El script trabaja sobre la planilla que lo contiene
(`getActiveSpreadsheet()`), así que el nombre del archivo, el del proyecto de
Apps Script y el de la implementación son libres. Lo único con nombre fijo es la
**pestaña**: el script usa una llamada `respuestas` y, si no existe, la crea. Si
le cambiás el nombre a esa pestaña te va a crear una nueva vacía al lado; para
usar otro nombre, cambiá `var HOJA = 'respuestas'` arriba de `apps-script.gs`.

**Si borro algo desde la planilla, ¿la página se entera?** Sí. Borrando la fila
entera, el ítem vuelve a figurar como pendiente; vaciando sólo algunas celdas,
vuelve a quedar incompleto. Se nota al recargar y también sin recargar, en el
refresco de fondo que corre cada 20 segundos. Lo único que no se toca es el ítem
que esa persona tenga abierto en ese momento, para no borrarle lo que está
escribiendo. Si la página no logra hablar con la planilla (avisa "Sin conexión"
arriba a la derecha) sigue mostrando lo último que vio, que es lo que querés en
ese caso.

**¿Anda dentro de una subcarpeta de mi GitHub Pages?** Sí. `index.html` llama a
`config.js`, `revision.js` y `revision.css` por ruta relativa, así que alcanza
con dejar los cuatro archivos juntos en la carpeta del proyecto
(`tu-usuario.github.io/prototipos/simulador-ganadero/`). No hace falta tocar
nada. Probado sirviendo la carpeta anidada: sin 404 y con el guardado andando.

**¿Puedo usar la misma planilla para otros prototipos?** Sí, con el mismo
endpoint: cambiá `DOC` en el `config.js` de cada uno. Cada prototipo escribe sus
propias filas y no se pisan — la columna `doc` es la que los separa.

## Tocar la lista de ítems

Todo sale de `config.js`.

```js
// Un campo editable
{ k:'mortandadPct',        // clave: es la que viaja a la planilla, no la cambies después
  g:'plan',                // sección (ver REV_GRUPOS)
  l:'Mortandad (%)',       // lo que lee negocio
  el:'#in-mortandad',      // selector del campo en pantalla; null = sólo en el panel
  v:'2,0 %',               // lo que trae hoy el prototipo
  def:'si',                // personalización por sociedad según el CSV (viene marcada)
  nota:'...',              // duda abierta de Producto (opcional)
  plm:'...' }              // nota de PLM (opcional)

// Una fórmula
{ k:'f_margenBruto', g:'f-resultado', l:'Margen Bruto',
  out:['fila:Margen Bruto'],                 // dónde se muestra el resultado
  src:['fila:Importe Total Venta',           // los campos de SU fórmula, nada más
       'fila:Importe Total Compra'],
  f:'Importe Total de Venta − Importe Total de Compra' }

// Un cálculo intermedio: no se revisa suelto, se muestra dentro de los que lista
{ k:'f_diasNegocio', g:'f-resultado', l:'Días de Negocio Total',
  interna:true, impacta:['f_margenAnualizado'],
  src:['#in-recria-dias', '#in-term-dias', '#in-plazo-venta'],
  uso:'Es la base para anualizar el margen: 365 ÷ días de negocio.',
  f:'Días de Producción Total + Plazo de Venta' }
```

`src` lleva sólo los campos que aparecen en la fórmula de ese ítem. Lo que entra
por un paso intermedio se declara en el paso: al resaltar, se suman los dos.

`mount` define dónde se cuelga el punto: por defecto se ancla al campo,
`'self'` al elemento exacto y `'table'` a la tabla que lo contiene.

Los selectores de `out` y `src` admiten tres formas:

| Forma | Qué busca |
|---|---|
| `#id` | un elemento por id, como cualquier selector CSS |
| `fila:Etiqueta` | una fila de las tablas de Resultados, por su etiqueta |
| `fila:Etiqueta##Bloque` | lo mismo, acotado a un bloque (`Compra`, `Venta`…) cuando la etiqueta se repite |
| `chip:Etiqueta` | un chip del recorrido de pesos (`Peso Inicial`, `Fin Recría`…) |

`out` vacío significa que el cálculo es intermedio y no se ve en pantalla.
