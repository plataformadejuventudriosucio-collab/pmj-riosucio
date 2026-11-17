/* =========================================================
   Redes → Página  ·  Plataforma Municipal de Juventud de Riosucio
   Toma las publicaciones de la Página de Facebook (data/facebook.json,
   que actualiza cada hora el robot de GitHub) y las convierte
   en contenido de la página: noticias, inicio, galería y proyectos.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- CONFIGURACIÓN (se puede editar) ---------- */
  var CONFIG = {
    feed: 'data/facebook.json',
    red: 'Facebook',
    perfil: 'https://www.facebook.com/profile.php?id=100081625983376',
    // En "Noticias" solo entran publicaciones desde esta fecha (las anteriores ya están en la página).
    noticiasDesde: '2026-11-10',
    // Publicaciones con esta etiqueta NO aparecen en la página.
    ocultarCon: ['nooficial', 'nopagina'],
    // Etiqueta (sin #) → categoría de la noticia.
    categorias: {
      'escueladetecnologias': 'Proyectos', 'educandoconlastic': 'Proyectos', 'delterritorioalfuturo': 'Proyectos',
      'lavozdelajuventud': 'Proyectos', '3rparasalvararío': 'Proyectos', '3rparasalvarario': 'Proyectos', 'casadelajuventud': 'Proyectos',
      'saludmental': 'Salud', 'diadeescucha': 'Salud', 'medicosdelmundo': 'Salud', 'primerosauxilios': 'Salud',
      'incidencia': 'Incidencia', 'concertacion': 'Incidencia', 'politicapublica': 'Incidencia',
      'deporte': 'Deporte', 'cultura': 'Cultura', 'comunidad': 'Comunidad'
    },
    categoriaPorDefecto: 'Desde Facebook',
    // Etiqueta (sin #) → sección de proyectos.html donde se muestra como novedad.
    proyectos: {
      'escueladetecnologias': 'escuela', 'educandoconlastic': 'escuela', 'delterritorioalfuturo': 'escuela',
      'lavozdelajuventud': 'voz',
      'diadeescucha': 'escucha',
      '3rparasalvarario': 'tresr',
      'casadelajuventud': 'casa'
    },
    cacheMin: 5
  };

  /* ---------- utilidades ---------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function fecha(ts) {
    var d = new Date(String(ts).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function fechaD(ts) { var d = new Date(String(ts).replace(/([+-]\d{2})(\d{2})$/, '$1:$2')); return isNaN(d) ? new Date(0) : d; }
  function img(o, size) {
    if (!o) return '';
    var s = o.sizes || {};
    var pick = (s[size] && s[size].mediaUrl) || (s.large && s.large.mediaUrl) || (s.medium && s.medium.mediaUrl) || (s.full && s.full.mediaUrl);
    if (pick) return pick;
    if (o.mediaType === 'VIDEO') return o.thumbnailUrl || '';
    return o.mediaUrl || o.thumbnailUrl || '';
  }
  function fotos(p, size) {
    if (p.images) return p.images.slice();
    var list = [];
    if (p.children && p.children.length) p.children.forEach(function (c) { var u = img(c, size); if (u) list.push(u); });
    if (!list.length) { var u = img(p, size); if (u) list.push(u); }
    return list;
  }
  function tags(p) {
    var t = (p.hashtags && p.hashtags.length) ? p.hashtags : (String(p.caption || '').match(/#[\p{L}\p{N}_]+/gu) || []).map(function (x) { return x.slice(1); });
    return t.map(function (x) { return String(x).replace(/^#/, ''); });
  }
  function partes(caption) {
    var lines = String(caption || '').split(/\r?\n/).map(function (l) { return l.trim(); });
    var limpio = function (l) { return l.replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\s{2,}/g, ' ').trim(); };
    var i = 0; while (i < lines.length && !limpio(lines[i])) i++;
    var titulo = limpio(lines[i] || '').replace(/^[^\p{L}\p{N}¡¿"“«]+/u, '').trim();
    var letras = titulo.replace(/[^\p{L}]/gu, '');
    if (letras.length > 8 && letras === letras.toUpperCase()) {
      titulo = titulo.toLowerCase().replace(/(^|[¡¿"“«]\s*)(\p{L})/u, function (m, a, b) { return a + b.toUpperCase(); })
        .replace(/\b(riosucio|chocó|choco|tdea|pmj|ajpmjr|médicos del mundo|villa rufina|bajo atrato|colombia|quibdó|bogotá)\b/giu, function (w) { return w.toUpperCase() === 'TDEA' || w.toUpperCase() === 'PMJ' || w.toUpperCase() === 'AJPMJR' ? w.toUpperCase() : w.replace(/(^|\s)(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase(); }); });
    }
    if (titulo.length > 120) { titulo = titulo.slice(0, 117).replace(/\s+\S*$/, '') + '…'; }
    var cuerpo = [], buf = [];
    lines.slice(i + 1).forEach(function (l) {
      var c = limpio(l);
      var soloTags = /^([#@][\p{L}\p{N}_.]+\s*)+$/u.test(l);
      if (!c || soloTags) { if (buf.length) { cuerpo.push(buf.join(' ')); buf = []; } return; }
      buf.push(c);
    });
    if (buf.length) cuerpo.push(buf.join(' '));
    return { titulo: titulo || 'Publicación en Facebook', cuerpo: cuerpo };
  }
  function categoria(t) {
    for (var i = 0; i < t.length; i++) { var k = norm(t[i]); if (CONFIG.categorias[k]) return CONFIG.categorias[k]; }
    return CONFIG.categoriaPorDefecto;
  }
  function visible(p) {
    var t = tags(p).map(norm);
    return !CONFIG.ocultarCon.some(function (o) { return t.indexOf(o) > -1; });
  }

  /* ---------- carga con caché ---------- */
  function cargar() {
    var key = 'pmj-fb-v1', now = Date.now();
    try {
      var c = JSON.parse(localStorage.getItem(key) || 'null');
      if (c && now - c.t < CONFIG.cacheMin * 60000) return Promise.resolve(c.d);
    } catch (e) {}
    return fetch(CONFIG.feed, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { try { localStorage.setItem(key, JSON.stringify({ t: now, d: d })); } catch (e) {} return d; });
  }

  /* ---------- Noticias ---------- */
  function articulo(p) {
    var pa = partes(p.caption), t = tags(p), fs = fotos(p, 'large'), cat = categoria(t);
    var id = 'ig-' + esc(p.id);
    var cover = fs[0] ? '<div class="acover"><img src="' + esc(fs[0]) + '" alt="' + esc(pa.titulo) + '" loading="lazy"></div>' : '';
    var gal = fs.length > 1 ? '<div class="gallery">' + fs.slice(1).map(function (u) { return '<figure><img src="' + esc(u) + '" alt="Foto de la actividad: ' + esc(pa.titulo) + '" loading="lazy"></figure>'; }).join('') + '</div>' : '';
    var chips = t.length ? '<p class="igtags">' + t.slice(0, 8).map(function (x) { return '<span>#' + esc(x) + '</span>'; }).join('') + '</p>' : '';
    return '<article class="article igart" id="' + id + '" data-cat="' + esc(cat) + '">' +
      '<div class="nmeta"><span class="ncat" data-c="' + esc(cat) + '">' + esc(cat) + '</span><span>' + esc(fecha(p.timestamp)) + '</span><span class="igsrc fbsrc">Publicado en Facebook</span></div>' +
      '<div class="agrid"><div class="atext"><h2>' + esc(pa.titulo) + '</h2>' + pa.cuerpo.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + chips + '</div>' + cover + '</div>' + gal +
      '<div class="share"><button type="button" data-copy="url" data-hash="#' + id + '">Copiar enlace</button><a href="' + esc(p.permalink || CONFIG.perfil) + '" target="_blank" rel="noopener">Ver en Facebook ↗</a></div>' +
      '</article>';
  }
  function noticias(posts) {
    var lista = $('#lista .wrap'); if (!lista) return;
    var desde = new Date(CONFIG.noticiasDesde + 'T00:00:00-05:00');
    var nuevos = posts.filter(function (p) { return fechaD(p.timestamp) >= desde; });
    if (!nuevos.length) return;
    var primero = $('#lista .article');
    var html = nuevos.map(articulo).join('');
    if (primero) primero.insertAdjacentHTML('beforebegin', html); else lista.insertAdjacentHTML('beforeend', html);
    document.dispatchEvent(new CustomEvent('pmj:news-updated'));
    if (location.hash && location.hash.indexOf('#ig-') === 0) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  }

  /* ---------- Inicio (últimas de Facebook) ---------- */
  function enlace(p) {
    var desde = new Date(CONFIG.noticiasDesde + 'T00:00:00-05:00');
    return fechaD(p.timestamp) >= desde ? 'noticias.html#ig-' + p.id : (p.permalink || CONFIG.perfil);
  }
  function inicio(posts) {
    var box = $('#fb-feed'); if (!box) return;
    var top = posts.slice(0, 6);
    if (!top.length) return;
    box.innerHTML = '<div class="iggrid">' + top.map(function (p) {
      var pa = partes(p.caption), u = fotos(p, 'medium')[0] || '', ext = enlace(p).indexOf('http') === 0;
      return '<a class="igpost' + (u ? '' : ' txt') + '" href="' + esc(enlace(p)) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy">' : '<i>' + esc(fecha(p.timestamp)) + '</i>') + '<span><b>' + esc(pa.titulo) + '</b></span></a>';
    }).join('') + '</div><div class="igmore"><a class="btn fb" href="' + esc(CONFIG.perfil) + '" target="_blank" rel="noopener">Ver todo en Facebook</a><a class="golink" href="noticias.html#lista">Ir a Noticias →</a></div>';
  }

  /* ---------- Galería ---------- */
  function galeria(posts) {
    if (location.pathname.indexOf('galeria') < 0) return;
    var hero = $('main .phero'); if (!hero) return;
    var items = [];
    posts.forEach(function (p) { var pa = partes(p.caption); fotos(p, 'medium').forEach(function (u) { items.push({ u: u, t: pa.titulo, f: fecha(p.timestamp) }); }); });
    items = items.slice(0, 36); if (!items.length) return;
    hero.insertAdjacentHTML('afterend', '<section class="block tight" id="recientes"><div class="wrap"><div class="head"><span class="label">Facebook</span><h2>Fotos <em>recientes</em></h2><p style="color:var(--muted)">Se actualiza sola con lo que publicamos en nuestra Página de Facebook.</p></div><div class="gallery iggal">' +
      items.map(function (x) { return '<figure><img src="' + esc(x.u) + '" alt="' + esc(x.t) + '" loading="lazy"><figcaption>' + esc(x.f) + '</figcaption></figure>'; }).join('') +
      '</div></div></section>');
  }

  /* ---------- Proyectos ---------- */
  function proyectos(posts) {
    if (location.pathname.indexOf('proyectos') < 0) return;
    var grupos = {};
    posts.forEach(function (p) {
      var hecho = {};
      tags(p).forEach(function (x) { var s = CONFIG.proyectos[norm(x)]; if (s && !hecho[s]) { hecho[s] = 1; (grupos[s] = grupos[s] || []).push(p); } });
    });
    Object.keys(grupos).forEach(function (s) {
      var sec = document.getElementById(s); if (!sec) return;
      var html = '<div class="ignovedades"><h3>Novedades desde nuestras redes</h3><p class="igproc">' + grupos[s].length + (grupos[s].length === 1 ? ' publicación reciente' : ' publicaciones recientes') + ' · Última actividad: ' + esc(fecha(grupos[s][0].timestamp)) + '</p><div class="iggrid small">' + grupos[s].slice(0, 3).map(function (p) {
        var pa = partes(p.caption), u = fotos(p, 'medium')[0] || '', l = enlace(p), ext = l.indexOf('http') === 0;
        return '<a class="igpost' + (u ? '' : ' txt') + '" href="' + esc(l) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy">' : '<i>' + esc(fecha(p.timestamp)) + '</i>') + '<span><b>' + esc(fecha(p.timestamp)) + ' · ' + esc(pa.titulo) + '</b></span></a>';
      }).join('') + '</div></div>';
      sec.insertAdjacentHTML('beforeend', html);
    });
  }


  /* ---------- Nombres de los procesos ---------- */
  var PROCESOS = { escuela: 'Escuela de Tecnologías', voz: 'La Voz de la Juventud', escucha: 'Día de Escucha', tresr: '3R para salvar a Río', casa: 'Casa de la Juventud' };
  function procesosDe(p) { var out = {}; tags(p).forEach(function (x) { var s = CONFIG.proyectos[norm(x)]; if (s) out[s] = 1; }); return Object.keys(out); }
  var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function leerFecha(t) { var m = norm(t).match(/(\d{1,2}) de ([a-z]+) de (\d{4})/); if (!m) return null; var i = MESES.indexOf(m[2]); return i < 0 ? null : new Date(+m[3], i, +m[1], 12); }

  /* ---------- Inicio: "Lo más reciente" se actualiza con las redes ---------- */
  function heroReciente(posts) {
    var card = $('.hx-card'); if (!card) return;
    var items = [].slice.call(card.querySelectorAll('.hx-item')).map(function (a) { var sm = a.querySelector('small'); return { d: leerFecha(sm ? sm.textContent : '') || new Date(0), html: a.outerHTML }; });
    posts.slice(0, 6).forEach(function (p) {
      var pa = partes(p.caption), u = fotos(p, 'medium')[0] || '', l = enlace(p), ext = l.indexOf('http') === 0;
      items.push({ d: fechaD(p.timestamp), html: '<a class="hx-item" href="' + esc(l) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + (u ? '<img src="' + esc(u) + '" alt="" loading="eager">' : '<img src="img/logo.png" alt="" loading="eager">') + '<span><b>' + esc(pa.titulo) + '</b><small>' + esc(fecha(p.timestamp)) + ' · Facebook</small></span></a>' });
    });
    items.sort(function (a, b) { return b.d - a.d; });
    [].slice.call(card.querySelectorAll('.hx-item')).forEach(function (a) { a.remove(); });
    card.insertAdjacentHTML('beforeend', items.slice(0, 3).map(function (x) { return x.html; }).join(''));
  }

  /* ---------- Inicio: indicadores automáticos ---------- */
  function indicadores(posts) {
    var hero = $('section.hx'); if (!hero || document.getElementById('indicadores')) return;
    var ahora = Date.now(), dia = 864e5;
    var ult = posts[0], u30 = posts.filter(function (p) { return ahora - fechaD(p.timestamp) <= 30 * dia; }).length;
    var act = {}; posts.forEach(function (p) { if (ahora - fechaD(p.timestamp) <= 90 * dia) procesosDe(p).forEach(function (k) { act[k] = (act[k] || 0) + 1; }); });
    var ks = Object.keys(act).sort(function (a, b) { return act[b] - act[a]; });
    var chips = ks.length ? ks.map(function (k) { return '<a class="indchip" href="proyectos.html#' + k + '"><b>' + act[k] + '</b>' + esc(PROCESOS[k] || k) + '</a>'; }).join('') : '<span class="indnone">Usa las etiquetas de los proyectos en las publicaciones de Facebook para que aparezcan aquí.</span>';
    hero.insertAdjacentHTML('afterend', '<section class="block tight" id="indicadores"><div class="wrap"><div class="indband">' +
      '<div class="indhead"><span class="label">En movimiento</span><h2>La plataforma <em>hoy</em></h2><p>Estos datos se calculan solos con lo que publicamos en nuestra Página de Facebook.</p></div>' +
      '<div class="indgrid">' +
      '<div class="ind"><strong>' + esc(fechaD(ult.timestamp).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })) + '</strong><span>Última actividad publicada</span></div>' +
      '<div class="ind"><strong>' + u30 + '</strong><span>' + (u30 === 1 ? 'Actividad' : 'Actividades') + ' en los últimos 30 días</span></div>' +
      '<div class="ind"><strong>' + posts.filter(function (p) { return fechaD(p.timestamp).getFullYear() === new Date().getFullYear(); }).length + '</strong><span>Publicaciones en ' + new Date().getFullYear() + '</span></div>' +
      '<div class="ind"><strong>' + ks.length + '</strong><span>' + (ks.length === 1 ? 'Proceso activo' : 'Procesos activos') + ' en los últimos 3 meses</span></div>' +
      '</div><div class="indchips">' + chips + '</div></div></div></section>');
  }

  /* ---------- arranque ---------- */
  function run() {
    cargar().then(function (d) {
      var posts = ((d && d.posts) || []).filter(visible).sort(function (a, b) { return fechaD(b.timestamp) - fechaD(a.timestamp); });
      if (!posts.length) return;
      try { inicio(posts); } catch (e) {}
      if (document.querySelector('.hx-card')) { try { heroReciente(posts); } catch (e) {} try { indicadores(posts); } catch (e) {} }
      try { noticias(posts); } catch (e) {}
      try { galeria(posts); } catch (e) {}
      try { proyectos(posts); } catch (e) {}
    }).catch(function () { /* sin conexión al feed: la página sigue igual */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
