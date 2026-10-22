/* NovaCTRL Cinema — scroll-driven movie experience */
(function () {
  'use strict';
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initReveals() {
    var els = document.querySelectorAll('.reveal, .scene');
    if (!els.length) return;
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      els.forEach(function(e){ e.classList.add('visible'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    els.forEach(function(e){ io.observe(e); });
  }

  function splitHero() {
    var heroes = document.querySelectorAll('[data-split]');
    heroes.forEach(function(el){
      var text = el.textContent;
      el.textContent = '';
      var words = text.split(/(\s+)/);
      var idx = 0;
      words.forEach(function(w){
        if (/^\s+$/.test(w)) { el.appendChild(document.createTextNode(w)); return; }
        var span = document.createElement('span');
        span.className = 'word';
        span.style.transitionDelay = (idx * 60) + 'ms';
        span.textContent = w;
        el.appendChild(span);
        idx++;
      });
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){ el.classList.add('split-visible'); });
      });
    });
  }

  function init3D() {
    var mount = document.getElementById('nova-3d');
    if (!mount) return;
    if (prefersReducedMotion) { mount.style.display = 'none'; return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = function () { buildScene(mount); };
    s.onerror = function () { mount.style.display = 'none'; };
    document.head.appendChild(s);
  }

  function buildScene(mount) {
    var THREE = window.THREE;
    if (!THREE) return;

    // Ensure mount has size — if not, wait and retry
    var w = mount.clientWidth, h = mount.clientHeight;
    if (w === 0 || h === 0) {
      setTimeout(function(){ buildScene(mount); }, 200);
      return;
    }

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.z = 4;

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    var geom = new THREE.IcosahedronGeometry(1.4, 1);
    var wireMat = new THREE.LineBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0.65 });
    var wire = new THREE.LineSegments(new THREE.EdgesGeometry(geom), wireMat);
    scene.add(wire);

    var coreGeom = new THREE.IcosahedronGeometry(0.55, 1);
    var coreMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff, wireframe: true, transparent: true, opacity: 0.3 });
    var core = new THREE.Mesh(coreGeom, coreMat);
    scene.add(core);

    var pCount = 200;
    var pGeom = new THREE.BufferGeometry();
    var positions = new Float32Array(pCount * 3);
    for (var i = 0; i < pCount; i++) {
      var r = 2 + Math.random() * 0.9;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    pGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var pMat = new THREE.PointsMaterial({ color: 0x5fb9ff, size: 0.028, sizeAttenuation: true, transparent: true, opacity: 0.85 });
    var points = new THREE.Points(pGeom, pMat);
    scene.add(points);

    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('mousemove', function(e){
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 0.7;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 0.4;
    }, { passive: true });

    var scrollY = 0;
    window.addEventListener('scroll', function(){ scrollY = window.scrollY; }, { passive: true });

    function onResize() {
      var nw = mount.clientWidth, nh = mount.clientHeight;
      if (!nw || !nh) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    }
    window.addEventListener('resize', onResize, { passive: true });

    function loop(t) {
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      var time = t * 0.0001;
      wire.rotation.x = time * 1.2 + mouse.y;
      wire.rotation.y = time * 1.6 + mouse.x;
      core.rotation.x = -time * 0.8;
      core.rotation.y = -time * 1.0;
      points.rotation.y = time * 0.4 - scrollY * 0.0008;
      points.rotation.x = time * 0.2 + scrollY * 0.0004;
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function start() {
    splitHero();
    initReveals();
    init3D();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
