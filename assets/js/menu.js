(function(){
/* Paquetes de hospedaje — Sheraton Pilar.
 * Lee data/alojamiento.json (lo publica el Apps Script) y arma:
 *   - portada: título, bajada, un botón por cada fila de "menu" que hoy tenga precios, reservas y pie.
 *   - #<boton_id>: los paquetes del grupo de ese botón, filtrados por fecha.
 * La fecha de hoy decide qué es vigente / próximo / vencido. Para probar otra: ?fecha=2026-12-24
 */
var qs=new URLSearchParams(location.search);
var lang=['es','en','pt'].indexOf(qs.get('lang'))>=0?qs.get('lang'):'es';
var HOY=/^\d{4}-\d{2}-\d{2}$/.test(qs.get('fecha')||'')?qs.get('fecha'):hoyLocal();
var TODOS='todos';
var data=null,app=document.getElementById('app'),bar=document.getElementById('bar');

var UI={
 es:{indice:'Menú principal',sig:'Siguiente',noexiste:'Esa sección no está disponible.',error:'No pudimos cargar las tarifas. Escribanos a reservas para consultar.',
     act:'Actualizado',incluye:'Qué incluye',off:'OFF',desde:'Desde',cuotas:function(n,m){return'en '+n+' x '+m+' sin interés'},paquetes:function(n){return n===1?'1 paquete':n+' paquetes'},
     reservar:'Reservas',reservarTxt:'Consulte disponibilidad y reserve su estadía.',wa:'WhatsApp',mail:'Escribir un mail',consultar:'Consultar',vacio:'Por el momento no hay tarifas publicadas.'},
 en:{indice:'Main menu',sig:'Next',noexiste:'This section is not available.',error:'Rates could not be loaded. Please contact reservations.',
     act:'Updated',incluye:'What is included',off:'OFF',desde:'From',cuotas:function(n,m){return'or '+n+' x '+m+' interest-free'},paquetes:function(n){return n===1?'1 package':n+' packages'},
     reservar:'Reservations',reservarTxt:'Check availability and book your stay.',wa:'WhatsApp',mail:'Send an email',consultar:'Ask us',vacio:'There are no published rates at the moment.'},
 pt:{indice:'Menu principal',sig:'Próxima',noexiste:'Esta seção não está disponível.',error:'Não foi possível carregar as tarifas. Entre em contato com reservas.',
     act:'Atualizado',incluye:'O que inclui',off:'OFF',desde:'A partir de',cuotas:function(n,m){return'em '+n+' x '+m+' sem juros'},paquetes:function(n){return n===1?'1 pacote':n+' pacotes'},
     reservar:'Reservas',reservarTxt:'Consulte a disponibilidade e reserve sua estadia.',wa:'WhatsApp',mail:'Enviar e-mail',consultar:'Consultar',vacio:'No momento não há tarifas publicadas.'}};
var IC={
 flecha:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
 atras:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
 wa:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.2-.2-.2-.5-.4z"/></svg>',
 mail:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'};

function hoyLocal(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function t(o){if(!o)return'';if(typeof o==='string')return o;return o[lang]||o.es||''}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
// Escapa primero y después aplica **negrita**, *itálica* y saltos de línea (seguro anti-XSS).
function fmt(s){s=esc(s);s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');s=s.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>');return s.replace(/\r\n|\r|\n/g,'<br>')}
function plata(n){return(data.simbolo||'$')+Number(n).toLocaleString('es-AR',{maximumFractionDigits:0})}
function precio(v){if(v==='CONSULTAR')return UI[lang].consultar;return plata(v)}
function tagInfo(g){var x=data.tags&&data.tags[g];if(!x)return{nombre:g};if(typeof x.es==='string')return{nombre:x};return x}
function href(id){return '#'+encodeURIComponent(id)}

/* ---------- reglas de fecha (las mismas que usa el Apps Script) ---------- */
function estado(desde,hasta){if(hasta&&hasta<HOY)return'vencida';if(desde&&desde>HOY)return'proxima';return'vigente'}
function okMostrar(m,e){if(m==='vigentes')return e==='vigente';if(m==='proximas')return e==='proxima';return e!=='vencida'}
function tiene(gr,g){return gr&&gr.indexOf(g)>=0}

// Qué muestra un botón hoy: paquetes con sus vigencias/precios que corresponden.
function pagina(b){
 var out=[],principal=false;
 data.paquetes.forEach(function(p){
  var vigs=p.vigencias.filter(function(v){return(tiene(v.grupos,b.grupo)||tiene(v.grupos,TODOS))&&okMostrar(b.mostrar,estado(v.desde,v.hasta))});
  var directo=p.items.length&&(tiene(p.grupos,b.grupo)||tiene(p.grupos,TODOS))&&okMostrar(b.mostrar,estado(p.desde,p.hasta));
  if(!vigs.length&&!directo)return;
  var esPrincipal=vigs.some(function(v){return tiene(v.grupos,b.grupo)})||(directo&&tiene(p.grupos,b.grupo));
  if(esPrincipal)principal=true;
  out.push({p:p,vigs:vigs,directo:!!directo,extra:!esPrincipal});
 });
 return principal?out:[];   // los "todos" (Extras) solos no alcanzan para mostrar un botón
}
function botonesVisibles(){return data.menu.map(function(b){return{b:b,pag:pagina(b)}}).filter(function(x){return x.pag.length})}

/* ---------- arranque y rutas ---------- */
if(window.__DATA__){data=window.__DATA__;arrancar()}
else fetch('data/alojamiento.json?v='+Date.now()).then(function(r){if(!r.ok)throw 0;return r.json()})
 .then(function(d){data=d;arrancar()}).catch(function(){app.innerHTML='<div class="wrap"><p class="empty">'+esc(UI[lang].error)+'</p></div>'});

function arrancar(){window.addEventListener('hashchange',function(){route(true)});route(false)}
function route(scrollTop){
 document.documentElement.lang=lang;
 var id=decodeURIComponent(location.hash.replace(/^#\/?/,''));
 if(id)vistaBoton(id);else vistaMenu();
 if(scrollTop)window.scrollTo(0,0);
}
function setLang(l){lang=l;qs.set('lang',lang);history.replaceState(null,'','?'+qs.toString()+location.hash);route(false)}
function langHTML(){var ids=data.carta.idiomas&&data.carta.idiomas.length?data.carta.idiomas:['es'];
 return ids.length>1?'<div class="lang">'+ids.map(function(l){return'<button type="button" data-lang="'+l+'" aria-pressed="'+(l===lang)+'">'+l.toUpperCase()+'</button>'}).join('')+'</div>':''}
function bindLang(root){root.querySelectorAll('.lang button').forEach(function(b){b.addEventListener('click',function(){setLang(b.dataset.lang)})})}

function cardHTML(x,meta){
 var nota=t(x.b.nota)||UI[lang].paquetes(x.pag.filter(function(e){return!e.extra}).length);
 return '<a class="card" href="'+href(x.b.id)+'"><span>'+(meta?'<span class="card__meta">'+esc(meta)+'</span>':'')+
  '<span class="card__name">'+esc(t(x.b.nombre))+'</span>'+(!meta?'<span class="card__meta">'+esc(nota)+'</span>':'')+'</span>'+IC.flecha+'</a>';
}
function reservarHTML(){
 var c=data.carta;if(!c.whatsapp&&!c.mail)return'';
 return '<section class="reservar"><h2 class="reservar__title">'+esc(UI[lang].reservar)+'</h2><p>'+esc(UI[lang].reservarTxt)+'</p><div class="acciones">'+
  (c.whatsapp?'<a class="btn btn--fill" href="https://wa.me/'+esc(c.whatsapp)+'" target="_blank" rel="noopener">'+IC.wa+esc(UI[lang].wa)+'</a>':'')+
  (c.mail?'<a class="btn" href="mailto:'+esc(c.mail)+'">'+IC.mail+esc(UI[lang].mail)+'</a>':'')+'</div></section>';
}
function pieHTML(){
 var c=data.carta,f=new Date(c.actualizado).toLocaleDateString(lang==='en'?'en-GB':lang==='pt'?'pt-BR':'es-AR');
 return '<footer class="foot">'+(t(c.pie)?'<p>'+fmt(t(c.pie))+'</p>':'')+'<p>'+esc(UI[lang].act)+': '+f+'</p></footer>';
}

/* ---------- portada ---------- */
function vistaMenu(){
 var c=data.carta,vis=botonesVisibles();
 bar.hidden=true;bar.innerHTML='';document.title=c.nombre+' · Sheraton Pilar';
 app.innerHTML='<div class="wrap"><header class="hero">'+langHTML()+'<h1 class="hero__name">'+esc(c.nombre)+'</h1>'+
  (t(c.bajada)?'<p class="hero__desc">'+fmt(t(c.bajada))+'</p>':'')+'</header>'+
  (vis.length?'<nav class="cards">'+vis.map(function(x){return cardHTML(x)}).join('')+'</nav>':'<p class="empty">'+esc(UI[lang].vacio)+'</p>')+
  reservarHTML()+pieHTML()+'</div>';
 bindLang(app);
}

/* ---------- página de un botón ---------- */
function vistaBoton(id){
 var vis=botonesVisibles(),idx=-1;vis.forEach(function(x,k){if(x.b.id===id)idx=k});
 var x=vis[idx];
 bar.hidden=false;
 bar.innerHTML='<div class="bar__in"><a class="volver" href="#">'+IC.atras+esc(UI[lang].indice)+'</a>'+langHTML()+'</div>'+
  (x?'<div class="bar__ident"><span class="bar__title">'+esc(t(x.b.nombre))+'</span>'+(t(x.b.nota)?'<span class="bar__sub">'+esc(t(x.b.nota))+'</span>':'')+'</div>':'')+
  (x&&x.pag.length>2?'<nav class="chips" id="chips">'+x.pag.map(function(e){return'<button type="button" data-ir="p-'+esc(e.p.id)+'">'+esc(t(e.p.nombre))+'</button>'}).join('')+'</nav>':'');
 bindLang(bar);
 bar.querySelector('.volver').addEventListener('click',function(e){e.preventDefault();history.pushState(null,'',location.pathname+location.search);route(true)});
 bar.querySelectorAll('[data-ir]').forEach(function(b){b.addEventListener('click',function(){var el=document.getElementById(b.dataset.ir);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})})});
 if(!x){app.innerHTML='<div class="wrap"><p class="empty">'+esc(UI[lang].noexiste)+'</p></div>';return}
 document.title=t(x.b.nombre)+' · '+data.carta.nombre;
 var sig=vis[idx+1];
 app.innerHTML='<div class="wrap"><header class="page__head"><h1 class="page__title">'+esc(t(x.b.nombre))+'</h1>'+
  (t(x.b.nota)?'<p class="page__note">'+fmt(t(x.b.nota))+'</p>':'')+'</header>'+
  x.pag.map(function(e){return paqueteHTML(e,x)}).join('')+reservarHTML()+
  (sig?'<nav class="navsec">'+cardHTML(sig,UI[lang].sig)+'</nav>':'')+pieHTML()+'</div>';
 watchTitle();spy();
}

// Separa la nota del paquete en condiciones (se ven siempre) e "Incluye: a; b; c" (desplegable).
function partirNota(s){
 var m=/(^|[\s.])(Incluye|Includes|Inclui)\s*:\s*/i.exec(s);
 if(!m)return{cond:s,inc:[]};
 var cond=s.slice(0,m.index+m[1].length).trim(),resto=s.slice(m.index+m[0].length);
 var inc=resto.split(';').map(function(x){x=x.trim().replace(/\.$/,'');return x.charAt(0).toUpperCase()+x.slice(1)}).filter(Boolean);
 return{cond:cond,inc:inc};
}
// Precio con el formato de la referencia: lista tachada + % OFF, precio final, cuotas y etiquetas.
function precioHTML(i,ptags){
 if(i.precio==='CONSULTAR')return'<div class="pr"><div class="pr__now">'+esc(UI[lang].consultar)+'</div></div>';
 var d=i.descuento>0?i.descuento:0,final=Math.round(i.precio*(1-d)),h='<div class="pr">';
 if(d)h+='<div class="pr__old"><s>'+esc(plata(i.precio))+'</s><span class="pill pill--oferta">'+Math.round(d*100)+'% '+UI[lang].off+'</span></div>';
 h+='<div class="pr__now">'+(i.desde?'<span class="pr__desde">'+esc(UI[lang].desde)+'</span>':'')+esc(plata(final))+'</div>';
 var cq=0;(i.tags||[]).concat(ptags||[]).forEach(function(g){var x=tagInfo(g);if(x.cuotas>cq)cq=x.cuotas});
 if(cq>1)h+='<div class="pr__cuotas">'+esc(UI[lang].cuotas(cq,plata(Math.ceil(final/cq))))+'</div>';
 return h+'</div>';
}
function pills(list){return(list||[]).map(function(g){var x=tagInfo(g);return'<span class="pill pill--'+esc(x.estilo||'neutro')+'">'+esc(t(x.nombre))+'</span>'}).join('')}
function roomsHTML(items,ptags){
 return '<ul class="rooms">'+items.map(function(i){
  var tags=pills(i.tags);
  return '<li class="room"><div class="room__name">'+esc(t(i.nombre))+
   (t(i.descripcion)?'<p class="room__desc">'+fmt(t(i.descripcion))+'</p>':'')+'</div>'+precioHTML(i,ptags)+
   (tags?'<div class="room__tags">'+tags+'</div>':'')+'</li>'}).join('')+'</ul>';
}
function norm(s){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()}
function paqueteHTML(e,x){
 var p=e.p,n=partirNota(t(p.nota)),h='<section class="paq'+(e.extra?' paq--extra':'')+'" id="p-'+esc(p.id)+'">';
 // Si el paquete se llama igual que la página (ej. Fines de semana largos), no se repite el título.
 if(norm(t(p.nombre))!==norm(t(x.b.nombre)))h+='<h2 class="paq__name">'+esc(t(p.nombre))+'</h2>';
 if(n.cond)h+='<p class="paq__cond">'+fmt(n.cond)+'</p>';
 if(t(p.destacado))h+='<p class="paq__dest">'+fmt(t(p.destacado))+'</p>';
 if(p.tags&&p.tags.length)h+='<div class="paq__tags">'+pills(p.tags)+'</div>';
 e.vigs.forEach(function(v){
  h+='<div class="vig">'+(t(v.nombre)?'<p class="vig__name">'+esc(t(v.nombre))+'</p>':'')+
   (t(v.nota)?'<p class="vig__note">'+fmt(t(v.nota))+'</p>':'')+roomsHTML(v.items,p.tags)+'</div>';
 });
 if(e.directo)h+=roomsHTML(p.items,p.tags);
 if(n.inc.length)h+='<details class="incluye"><summary>'+esc(UI[lang].incluye)+IC.flecha+'</summary><ul>'+
  n.inc.map(function(i){return'<li>'+fmt(i)+'</li>'}).join('')+'</ul></details>';
 return h+'</section>';
}

// El nombre del botón aparece en la barra cuando el título grande sale de pantalla.
function watchTitle(){
 var h=app.querySelector('.page__head');
 if(window.__tObs)window.__tObs.disconnect();
 if(!h||!('IntersectionObserver'in window)){bar.classList.add('compact');return}
 bar.classList.remove('compact');
 window.__tObs=new IntersectionObserver(function(es){es.forEach(function(en){bar.classList.toggle('compact',!en.isIntersecting)})},{rootMargin:'-56px 0px 0px 0px'});
 window.__tObs.observe(h);
}
// Marca en los chips el paquete que se está viendo.
function spy(){
 var chips=bar.querySelectorAll('#chips button');
 if(window.__spyObs)window.__spyObs.disconnect();
 if(!chips.length||!('IntersectionObserver'in window))return;
 window.__spyObs=new IntersectionObserver(function(es){es.forEach(function(en){if(!en.isIntersecting)return;
  chips.forEach(function(b){var on=b.dataset.ir===en.target.id;b.setAttribute('aria-current',on);if(on)b.scrollIntoView({block:'nearest',inline:'center'})})})},{rootMargin:'-130px 0px -65% 0px'});
 app.querySelectorAll('.paq').forEach(function(s){window.__spyObs.observe(s)});
}
})();
