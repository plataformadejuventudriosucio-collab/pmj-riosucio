# Cómo conectar la Página de Facebook con la página web

Cuando esto quede configurado, **cada publicación de la Página "Plataforma de Juventud Riosucio Chocó"** llega sola a la web: noticias, inicio, galería, proyectos e indicadores.

## Cómo funciona

1. Un **robot de GitHub** revisa la Página de Facebook **cada hora**.
2. Guarda las publicaciones nuevas (texto y fotos) en `data/facebook.json` y en `img/fb-auto/`.
3. **Netlify publica la página sola**. Ya no hay que subir el zip.

## Paso 1. Sacar el permiso (token) de la Página en Meta

1. Entra a **developers.facebook.com** con el Facebook que administra la Página. Si te lo pide, regístrate como desarrollador (es gratis).
2. **Mis apps → Crear app.** Como caso de uso elige **"Otro"** y como tipo **"Empresa"**. Ponle de nombre `PMJ Web`.
3. Abre **Herramientas → Explorador de la API Graph**.
   - En **"App de Meta"** elige `PMJ Web`.
   - En **"Permisos"** agrega `pages_show_list` y `pages_read_engagement`.
   - Haz clic en **"Generate Access Token"** y acepta. Cuando te pregunte, elige la Página **Plataforma de Juventud Riosucio Chocó**.
4. **Convierte el token en uno largo.**
   - Copia el token generado.
   - Abre **Herramientas → Depurador de tokens de acceso**, pégalo y haz clic en **"Ampliar token de acceso"**.
   - Copia el token nuevo.
5. **Saca el token de la Página.**
   - Vuelve al Explorador, pega el token largo arriba y consulta: `me/accounts`.
   - En la respuesta busca la Página **Plataforma de Juventud Riosucio Chocó** y copia su **`access_token`**.
   - Ese es el token de la Página.
   - Si lo revisas en el Depurador de tokens, debe decir **"Caduca: Nunca"**.

> ⚠️ Ese token es como una contraseña. No lo publiques ni lo compartas por WhatsApp. Solo va en GitHub como "secreto" (paso 3).

## Paso 2. Subir la página a GitHub

1. Crea una cuenta gratis en **github.com**.
2. **New repository** → nombre `pmj-riosucio` → **Create repository**.
3. Instala **GitHub Desktop**: es más fácil que la web, porque la página tiene muchas fotos.
   - Clona el repositorio en tu computador.
   - Copia dentro de esa carpeta **todo el contenido de este zip**, incluida la carpeta `.github`.
   - Haz **Commit** y luego **Push**.

## Paso 3. Guardar el token en GitHub

1. En el repositorio entra a **Settings → Secrets and variables → Actions → New repository secret**.
2. Llena los campos:
   - **Name:** `FB_PAGE_TOKEN`
   - **Secret:** el token de la Página (paso 1.5).
3. Abre la pestaña **Actions**. Si te lo pide, activa los workflows.
4. Elige **"Sincronizar Facebook" → Run workflow**.
5. En uno o dos minutos debe quedar en verde ✅ y aparecer un cambio nuevo en `data/facebook.json`.

## Paso 4. Conectar Netlify con GitHub

1. En Netlify, abre el sitio `pmjriosucio` → **Site configuration → Build & deploy → Link repository**.
2. Elige **GitHub** y el repositorio `pmj-riosucio`.
3. **Build command:** vacío. **Publish directory:** `/`.
4. Guarda. Desde ahora **cada vez que el robot encuentre publicaciones nuevas, Netlify publica sola la página**.

## Cómo publicar en Facebook para que se vea bien en la página

- **Título:** la **primera línea** del texto es el título de la noticia.
- **Cuerpo:** el resto es el contenido.
- **Fotos:** las fotos del álbum salen como galería.
- **Etiquetas de proceso** (alimentan Proyectos e indicadores):
  - `#EscuelaDeTecnologias` / `#EducandoConLasTIC` / `#DelTerritorioAlFuturo` → Escuela de Tecnologías
  - `#LaVozDeLaJuventud` → Radio juvenil
  - `#DiaDeEscucha` → Día de Escucha
  - `#3RParaSalvarARio` → 3R para salvar a Río
  - `#CasaDeLaJuventud` → Casa de la Juventud
- **Categorías:**
  - `#SaludMental` y `#MedicosDelMundo` → **Salud**
  - `#Incidencia` y `#Concertacion` → **Incidencia**
  - `#Deporte`, `#Cultura` y `#Comunidad` → la categoría con ese mismo nombre
- **`#nooficial`** → esa publicación **no** sale en la página.

## Qué se puede cambiar

Todo está al inicio del archivo `js/redes.js`, en la parte `CONFIG`:

- `noticiasDesde`: desde qué fecha entran publicaciones a "Noticias" (hoy: 10 de noviembre de 2026, para no repetir las que ya estaban).
- Las etiquetas y sus categorías o proyectos.

## Si algo falla

- **El robot sale en rojo ❌ en Actions:** abre el error. Si dice *"token"* o *"OAuthException"*, el token caducó o le faltan permisos: repite el paso 1 y actualiza el secreto.
- **La versión de la API de Meta deja de servir:** en GitHub, en **Settings → Secrets and variables → Actions → Variables**, crea `GRAPH_VERSION` con la versión nueva (por ejemplo `v24.0`).
