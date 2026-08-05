/* tira de piezas en movimiento continuo, con arrastre tipo spin y popup.
   El portfolio a mostrar sale de ?p=<id>; por defecto, el principal. */
function marquee(opts){
  opts = opts || {};
  var TAU = opts.tau || 1.6;          // segundos hasta recuperar la velocidad normal
  var MAXSPIN = 3800;
  var SPEED = opts.speed || 58;       // px por segundo

  var rowsEl = document.getElementById('rows');
  var lightbox = document.getElementById('lightbox');
  var lbFigure = document.getElementById('lbFigure');
  var closeBtn = document.getElementById('close');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var row = null, items = [];

  function isVideo(src){ return /\.(mp4|webm|mov|m4v)$/i.test(src); }

  function shuffle(a){
    a = a.slice();
    for(var i=a.length-1;i>0;i--){
      var j = Math.floor(Math.random()*(i+1));
      var t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }

  function makeItem(src){
    var d = document.createElement('div');
    d.className = 'item';
    d.dataset.src = src;
    if(isVideo(src)){
      var v = document.createElement('video');
      v.src = src; v.muted = true; v.loop = true; v.autoplay = true;
      v.playsInline = true; v.setAttribute('playsinline',''); v.preload = 'metadata';
      d.appendChild(v);
    }else{
      var img = document.createElement('img');
      img.src = src; img.alt = ''; img.decoding = 'async';
      d.appendChild(img);
    }
    return d;
  }

  /* medidas: el ancho de pieza queda en ~59% de pantalla estrecha,
     y el alto en 59.5% de pantalla ancha, como en el boceto */
  function applySize(w, h){
    var r = (w && h) ? (w / h) : 0.8;
    var root = document.documentElement;
    var vw = (59 / r).toFixed(1) + 'vw';
    var unit = (window.CSS && CSS.supports && CSS.supports('height','100dvh')) ? 'dvh' : 'vh';
    root.style.setProperty('--ratio', r.toFixed(4));
    root.style.setProperty('--ih', 'min(59.5' + unit + ', ' + vw + ')');
    root.style.setProperty('--gap', 'calc(var(--ih) * ' + (0.144 * r).toFixed(4) + ')');
  }

  function build(){
    rowsEl.innerHTML = '';
    row = null;
    if(!items.length) return;

    var el = document.createElement('div');
    el.className = 'row';
    var track = document.createElement('div');
    track.className = 'track';
    el.appendChild(track);
    rowsEl.appendChild(el);

    var set = shuffle(items);
    while(set.length < 3) set = set.concat(shuffle(items));
    row = { el:track, set:set, offset:Math.random()*300, speed:SPEED, base:SPEED, setW:0 };
    layout();
  }

  function layout(){
    if(!row) return;
    row.el.innerHTML = '';
    var probe = makeItem(row.set[0]);
    row.el.appendChild(probe);
    var itemW = probe.getBoundingClientRect().width;
    var gap = parseFloat(getComputedStyle(row.el).gap) || 0;
    row.el.innerHTML = '';

    row.setW = row.set.length * (itemW + gap);
    var copies = Math.ceil((window.innerWidth * 2) / row.setW) + 1;

    var frag = document.createDocumentFragment();
    for(var c=0;c<copies;c++){
      for(var k=0;k<row.set.length;k++) frag.appendChild(makeItem(row.set[k]));
    }
    row.el.appendChild(frag);
  }

  /* ---- animación ---- */
  var last = null, dragging = false, frenando = false;

  function frame(t){
    if(last === null) last = t;
    var dt = Math.min((t - last)/1000, 0.05);
    last = t;

    if(row){
      if(!dragging){
        var tau = frenando ? 0.3 : TAU;          // al frenar vuelve enseguida a su ritmo
        row.speed += (row.base - row.speed) * (1 - Math.exp(-dt / tau));
        if(frenando && Math.abs(row.speed - row.base) < 3) frenando = false;
        if(!reduce) row.offset += row.speed * dt;
      }
      if(row.setW > 0){
        row.offset = ((row.offset % row.setW) + row.setW) % row.setW;
        row.el.style.transform = 'translate3d(' + (-row.offset).toFixed(2) + 'px,0,0)';
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---- arrastre = spin ---- */
  var lastX = 0, lastT = 0, vel = 0, moved = 0, ibaRapido = false, ignorarClic = false;

  rowsEl.addEventListener('pointerdown', function(e){
    if(e.button && e.button !== 0) return;
    dragging = true; moved = 0; vel = 0;
    // si venía lanzado, este toque es un frenazo, no un clic
    ibaRapido = !!row && Math.abs(row.speed) > Math.abs(row.base) * 1.5;
    frenando = false;
    lastX = e.clientX; lastT = performance.now();
    try{ rowsEl.setPointerCapture(e.pointerId); }catch(err){}
    rowsEl.classList.add('dragging');
  });

  rowsEl.addEventListener('pointermove', function(e){
    if(!dragging || !row) return;
    var now = performance.now();
    var dx = e.clientX - lastX;
    var dt = (now - lastT) / 1000;
    moved += Math.abs(dx);
    row.offset -= dx;
    if(dt > 0) vel = vel * 0.7 + (dx / dt) * 0.3;
    lastX = e.clientX; lastT = now;
  });

  function endDrag(){
    if(!dragging) return;
    dragging = false;
    rowsEl.classList.remove('dragging');
    if(!row) return;
    if(moved <= 8){                              // no arrastró: fue un toque
      if(ibaRapido){                             // iba lanzado, así que frena
        frenando = true;
        ignorarClic = true;
      }
      return;
    }
    row.speed = Math.max(-MAXSPIN, Math.min(MAXSPIN, -vel)) + row.base * 0.15;
  }
  rowsEl.addEventListener('pointerup', endDrag);
  rowsEl.addEventListener('pointercancel', endDrag);
  rowsEl.addEventListener('lostpointercapture', endDrag);

  /* ---- popup ---- */
  rowsEl.addEventListener('click', function(e){
    if(ignorarClic){ ignorarClic = false; return; }
    if(moved > 8) return;
    var item = e.target.closest ? e.target.closest('.item') : null;
    if(item) open(item.dataset.src);
  });

  function open(src){
    lbFigure.innerHTML = '';
    if(isVideo(src)){
      var v = document.createElement('video');
      v.src = src; v.controls = true; v.loop = true;
      v.playsInline = true; v.setAttribute('playsinline','');
      lbFigure.appendChild(v);
      v.play().catch(function(){ v.muted = true; v.play().catch(function(){}); });
    }else{
      var img = document.createElement('img');
      img.src = src; img.alt = '';
      lbFigure.appendChild(img);
    }
    lightbox.classList.add('open');
    closeBtn.focus();
  }
  function close(){
    lightbox.classList.remove('open');
    lbFigure.innerHTML = '';
  }
  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', function(e){ if(e.target === lightbox) close(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') close(); });

  var t;
  window.addEventListener('resize', function(){
    clearTimeout(t);
    t = setTimeout(layout, 150);
  });

  /* ---- datos ---- */
  function aviso(txt){
    rowsEl.innerHTML = '<p style="width:100%;text-align:center;font-size:calc(4 * var(--u))">' + txt + '</p>';
  }

  function id(){
    var m = /[?&]p=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : (opts.defaultId || 'portfolio');
  }

  function pick(data, wanted){
    var list = (data && data.portfolios) || [];
    if(!list.length && data){                       // formato antiguo
      list = Object.keys(data).map(function(k){
        return { id:k, title:k, w:1080, h:(k === 'reels' ? 1920 : 1350), items:data[k] };
      });
    }
    for(var i=0;i<list.length;i++) if(list[i].id === wanted) return list[i];
    return null;
  }

  fetch('data.json', {cache:'no-store'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(data){
      var p = pick(data, id());
      if(!p){ aviso('este portfolio no existe'); return; }
      if(p.title) document.title = p.title + ' — gilda fitnes';
      applySize(p.w, p.h);
      items = (p.items || []).map(function(x){ return typeof x === 'string' ? x : x.src; });
      if(!items.length){ aviso('todavía no hay nada aquí'); return; }
      build();
    })
    .catch(function(){ aviso('no se pudo cargar data.json'); });
}
