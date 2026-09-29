(function () {
  'use strict';

  var LANG_LABELS = { es: 'ES', en: 'EN', pt: 'PT' };
  var LOCALE = { es: 'es-AR', en: 'en-US', pt: 'pt-BR' };
  var UI = {
    es: {
      eyebrow: 'Sheraton Pilar Hotel & Convention Center',
      tag: 'Un espacio para promover el equilibrio y la armonía interior.',
      loading: 'Cargando la carta…',
      error: 'No pudimos cargar la carta. Actualizá la página en unos minutos.',
      empty: 'La carta no tiene secciones publicadas todavía.',
      noResults: 'No encontramos resultados para tu búsqueda.',
      searchPlaceholder: 'Buscar un servicio…',
      updated: 'Actualizado el',
      consultar: 'Consultar',
    },
    en: {
      eyebrow: 'Sheraton Pilar Hotel & Convention Center',
      tag: 'A space to promote balance and inner harmony.',
      loading: 'Loading the menu…',
      error: "We couldn't load the menu. Please refresh the page in a few minutes.",
      empty: 'This menu has no published sections yet.',
      noResults: 'No results found for your search.',
      searchPlaceholder: 'Search a service…',
      updated: 'Updated on',
      consultar: 'Ask staff',
    },
    pt: {
      eyebrow: 'Sheraton Pilar Hotel & Convention Center',
      tag: 'Um espaço para promover o equilíbrio e a harmonia interior.',
      loading: 'Carregando o cardápio…',
      error: 'Não foi possível carregar o cardápio. Atualize a página em alguns minutos.',
      empty: 'Este cardápio ainda não tem seções publicadas.',
      noResults: 'Nenhum resultado encontrado para sua busca.',
      searchPlaceholder: 'Buscar um serviço…',
      updated: 'Atualizado em',
      consultar: 'Consultar',
    },
  };

  var state = { data: null, lang: 'es', query: '' };

  function texto(campo) {
    if (!campo) return '';
    return campo[state.lang] || campo.es || '';
  }

  function ui(clave) {
    var d = UI[state.lang] || UI.es;
    return d[clave] || UI.es[clave] || '';
  }

  function normalizar(s) {
    return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function formatearPrecio(valor, simbolo) {
    if (String(valor).toUpperCase() === 'CONSULTAR') return ui('consultar');
    var n = Number(valor);
    var f = new Intl.NumberFormat(LOCALE[state.lang] || 'es-AR', { maximumFractionDigits: 0 }).format(n);
    return (simbolo || '$') + ' ' + f + '.-';
  }

  function el(tag, cls, texto) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function idiomasDisponibles() {
    var lista = (state.data && state.data.carta && state.data.carta.idiomas) || ['es'];
    return lista.filter(function (l) { return LANG_LABELS[l]; });
  }

  function renderLangSwitchEn(contenedorId) {
    var box = document.getElementById(contenedorId);
    if (!box) return;
    var disponibles = idiomasDisponibles();
    box.innerHTML = '';
    if (disponibles.length < 2) return; // nada que elegir
    disponibles.forEach(function (code) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = LANG_LABELS[code];
      btn.setAttribute('aria-pressed', String(code === state.lang));
      btn.addEventListener('click', function () {
        if (state.lang === code) return;
        state.lang = code;
        try { localStorage.setItem('spa_lang', code); } catch (e) {}
        renderTodo();
      });
      box.appendChild(btn);
    });
  }

  function renderLangSwitches() {
    renderLangSwitchEn('langSwitchSticky');
  }

  function renderHero() {
    var eyebrow = document.getElementById('heroEyebrow');
    var tag = document.getElementById('heroTag');
    var title = document.getElementById('heroTitle');
    var brand = document.getElementById('brandName');
    var search = document.getElementById('searchInput');
    var carta = state.data && state.data.carta;
    if (eyebrow) eyebrow.textContent = ui('eyebrow');
    if (title && carta && carta.nombre) title.textContent = carta.nombre;
    if (brand && carta && carta.nombre) brand.textContent = carta.nombre;
    if (tag) tag.textContent = (carta && carta.bajada) ? carta.bajada : ui('tag');
    if (search) {
      search.placeholder = ui('searchPlaceholder');
      search.setAttribute('aria-label', ui('searchPlaceholder'));
    }
  }

  function aplicarFiltro() {
    var app = document.getElementById('app');
    var nav = document.getElementById('nav');
    var q = normalizar(state.query.trim());
    var huboResultados = false;

    app.querySelectorAll('.section').forEach(function (secEl) {
      var visiblesEnSeccion = 0;
      secEl.querySelectorAll('.item').forEach(function (itemEl) {
        var match = !q || normalizar(itemEl.dataset.buscar || '').indexOf(q) >= 0;
        itemEl.classList.toggle('is-hidden', !match);
        if (match) visiblesEnSeccion++;
      });
      secEl.querySelectorAll('.subsection').forEach(function (subEl) {
        var visiblesEnSub = subEl.querySelectorAll('.item:not(.is-hidden)').length;
        subEl.classList.toggle('is-hidden', visiblesEnSub === 0);
      });
      secEl.classList.toggle('is-hidden', visiblesEnSeccion === 0);
      if (visiblesEnSeccion > 0) huboResultados = true;

      var navLink = nav.querySelector('a[href="#' + secEl.id + '"]');
      if (navLink) navLink.classList.toggle('is-hidden', visiblesEnSeccion === 0);
    });

    var vacio = app.querySelector('.no-results');
    if (!huboResultados && q) {
      if (!vacio) {
        vacio = el('p', 'error no-results', ui('noResults'));
        app.appendChild(vacio);
      } else {
        vacio.textContent = ui('noResults');
      }
    } else if (vacio) {
      vacio.remove();
    }
  }

  function renderContenido() {
    var app = document.getElementById('app');
    var nav = document.getElementById('nav');
    var foot = document.getElementById('foot');
    var data = state.data;
    app.innerHTML = '';
    nav.innerHTML = '';
    foot.innerHTML = '';

    if (!data) return;

    var simbolo = texto(data.config && data.config.simbolo) || '$';
    var tagsMap = data.tags || {};

    if (!data.secciones || !data.secciones.length) {
      app.appendChild(el('p', 'error', ui('empty')));
      return;
    }

    data.secciones.forEach(function (sec) {
      var navLink = el('a', null, texto(sec.nombre));
      navLink.href = '#' + sec.id;
      nav.appendChild(navLink);

      var section = el('section', 'section');
      section.id = sec.id;

      var head = el('div', 'section-head');
      head.appendChild(el('h2', 'section-title', texto(sec.nombre)));
      head.appendChild(el('div', 'section-rule'));
      section.appendChild(head);

      if (texto(sec.nota)) {
        section.appendChild(el('p', 'section-note', texto(sec.nota)));
      }

      function renderItem(item) {
        var row = el('article', 'item');
        row.dataset.buscar = normalizar(texto(item.nombre) + ' ' + texto(item.descripcion));

        var top = el('div', 'item-row');
        top.appendChild(el('h3', 'item-name', texto(item.nombre)));
        top.appendChild(el('span', 'item-leader'));
        top.appendChild(el('span', 'item-price', formatearPrecio(item.precio, simbolo)));
        row.appendChild(top);

        if (texto(item.descripcion)) {
          row.appendChild(el('p', 'item-desc', texto(item.descripcion)));
        }

        (item.tags || []).forEach(function (tagId) {
          var label = texto(tagsMap[tagId]);
          if (label) row.appendChild(el('span', 'item-tag', label));
        });

        return row;
      }

      (sec.items || []).forEach(function (item) { section.appendChild(renderItem(item)); });

      (sec.subsecciones || []).forEach(function (sub) {
        var subBlock = el('div', 'subsection');
        subBlock.id = sub.id;
        subBlock.appendChild(el('h3', 'subsection-title', texto(sub.nombre)));
        if (texto(sub.nota)) {
          subBlock.appendChild(el('p', 'subsection-note', texto(sub.nota)));
        }
        sub.items.forEach(function (item) { subBlock.appendChild(renderItem(item)); });
        section.appendChild(subBlock);
      });

      app.appendChild(section);
    });

    if (texto(data.carta && data.carta.pie)) {
      foot.appendChild(el('p', null, texto(data.carta.pie)));
    }
    if (data.carta && data.carta.actualizado) {
      var d = new Date(data.carta.actualizado);
      var f = isNaN(d) ? '' : d.toLocaleDateString(LOCALE[state.lang] || 'es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
      if (f) foot.appendChild(el('span', 'updated', ui('updated') + ' ' + f));
    }

    aplicarFiltro();
  }

  function renderTodo() {
    renderHero();
    renderLangSwitches();
    renderContenido();
  }

  function idiomaInicial() {
    // Español por defecto siempre, salvo que el usuario ya haya elegido otro idioma antes.
    var disponibles = idiomasDisponibles();
    var guardado = null;
    try { guardado = localStorage.getItem('spa_lang'); } catch (e) {}
    if (guardado && disponibles.indexOf(guardado) >= 0) return guardado;
    return disponibles.indexOf('es') >= 0 ? 'es' : (disponibles[0] || 'es');
  }

  function cargar() {
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(el('p', 'loading', ui('loading')));

    fetch('./data/spa.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        state.data = data;
        state.lang = idiomaInicial();
        renderTodo();
      })
      .catch(function () {
        app.innerHTML = '';
        app.appendChild(el('p', 'error', ui('error')));
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    cargar();
    var search = document.getElementById('searchInput');
    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value || '';
        aplicarFiltro();
      });
    }
  });
})();
