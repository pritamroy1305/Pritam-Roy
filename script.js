// ---------- theme toggle (persisted per-viewer) ----------
(function () {
  var root = document.documentElement;
  var toggle = document.getElementById('themeToggle');
  var saved = null;
  try { saved = localStorage.getItem('pr-theme'); } catch (e) {}
  if (saved === 'light') {
    root.setAttribute('data-theme', 'light');
    toggle.setAttribute('aria-pressed', 'true');
  }
  toggle.addEventListener('click', function () {
    var isLight = root.getAttribute('data-theme') === 'light';
    if (isLight) {
      root.removeAttribute('data-theme');
      toggle.setAttribute('aria-pressed', 'false');
    } else {
      root.setAttribute('data-theme', 'light');
      toggle.setAttribute('aria-pressed', 'true');
    }
    try { localStorage.setItem('pr-theme', isLight ? 'dark' : 'light'); } catch (e) {}
  });
})();

// ---------- smooth cursor: spring-physics custom cursor ----------
(function () {
  var el = document.getElementById('smoothCursor');
  if (!el) return;

  var pointerMQ = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  var motionMQ = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motionMQ && motionMQ.matches) return; // respect reduced motion entirely

  function spring(initial) { return { value: initial, target: initial, v: 0 }; }
  var sx = spring(0), sy = spring(0), srot = spring(0), sscale = spring(1);

  var CFG_POS = { stiffness: 400, damping: 45, mass: 1 };
  var CFG_ROT = { stiffness: 300, damping: 60, mass: 1 };
  var CFG_SCALE = { stiffness: 500, damping: 35, mass: 1 };

  function stepSpring(s, cfg, dt) {
    var force = -cfg.stiffness * (s.value - s.target);
    var damp = -cfg.damping * s.v;
    var acc = (force + damp) / cfg.mass;
    s.v += acc * dt;
    s.value += s.v * dt;
  }

  var lastPos = { x: 0, y: 0 };
  var lastMoveTime = Date.now();
  var velocity = { x: 0, y: 0 };
  var prevAngle = 0;
  var accumRot = 0;
  var scaleTimeout = null;
  var visible = false;
  var enabled = false;
  var rafId = null;
  var lastFrame = null;

  function loop(now) {
    if (lastFrame == null) lastFrame = now;
    var dt = Math.min((now - lastFrame) / 1000, 0.032);
    lastFrame = now;
    stepSpring(sx, CFG_POS, dt);
    stepSpring(sy, CFG_POS, dt);
    stepSpring(srot, CFG_ROT, dt);
    stepSpring(sscale, CFG_SCALE, dt);
    el.style.transform =
      'translate(' + sx.value + 'px,' + sy.value + 'px) translate(-50%, -50%) rotate(' + srot.value + 'deg) scale(' + sscale.value + ')';
    rafId = requestAnimationFrame(loop);
  }

  function handleMove(e) {
    if (e.pointerType === 'touch') return;
    if (!visible) { visible = true; el.classList.add('visible'); }

    var now = Date.now();
    var dt = now - lastMoveTime;
    var pos = { x: e.clientX, y: e.clientY };
    if (dt > 0) {
      velocity.x = (pos.x - lastPos.x) / dt;
      velocity.y = (pos.y - lastPos.y) / dt;
    }
    lastMoveTime = now;
    lastPos = pos;

    sx.target = pos.x;
    sy.target = pos.y;

    var speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    if (speed > 0.1) {
      var angle = Math.atan2(velocity.y, velocity.x) * (180 / Math.PI) + 90;
      var diff = angle - prevAngle;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      accumRot += diff;
      srot.target = accumRot;
      prevAngle = angle;

      sscale.target = 0.9;
      if (scaleTimeout) clearTimeout(scaleTimeout);
      scaleTimeout = setTimeout(function () { sscale.target = 1; }, 150);
    }
  }

  var rafMove = 0;
  function throttledMove(e) {
    if (e.pointerType === 'touch') return;
    if (rafMove) return;
    rafMove = requestAnimationFrame(function () { handleMove(e); rafMove = 0; });
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    lastFrame = null;
    window.addEventListener('pointermove', throttledMove, { passive: true });
    rafId = requestAnimationFrame(loop);
  }

  function disable() {
    enabled = false;
    visible = false;
    el.classList.remove('visible');
    window.removeEventListener('pointermove', throttledMove);
    if (rafId) cancelAnimationFrame(rafId);
    if (scaleTimeout) clearTimeout(scaleTimeout);
  }

  function sync() {
    if (pointerMQ.matches) enable(); else disable();
  }
  sync();
  if (pointerMQ.addEventListener) pointerMQ.addEventListener('change', sync);
  else if (pointerMQ.addListener) pointerMQ.addListener(sync);
})();

// ---------- projects timeline: scroll beam + active row highlight ----------
(function () {
  var track = document.getElementById('ptTrack');
  var fill = document.getElementById('ptTrackFill');
  var rows = Array.prototype.slice.call(document.querySelectorAll('.pt-row'));
  if (!track || !fill) return;

  var ticking = false;

  function updateBeam() {
    ticking = false;
    var rect = track.getBoundingClientRect();
    var vh = window.innerHeight;
    var startLine = vh * 0.82;  // beam starts filling once track top crosses here
    var endLine = vh * 0.32;    // beam finishes filling once track bottom crosses here
    var span = (rect.height) + (startLine - endLine);
    var progressed = startLine - rect.top;
    var progress = span > 0 ? progressed / span : 0;
    progress = Math.max(0, Math.min(1, progress));
    fill.style.height = (progress * 100) + '%';
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateBeam);
    }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  updateBeam();

  if (rows.length) {
    var rowIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        en.target.classList.toggle('in-view', en.isIntersecting);
      });
    }, { threshold: 0.35, rootMargin: '-15% 0px -15% 0px' });
    rows.forEach(function (r) { rowIO.observe(r); });
  }
})();

// ---------- encrypted text: scramble-to-reveal effect ----------
var SCRAMBLE_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!<>-_\\/[]{}—=+*^?#0123456789";
var reduceMotionMQ = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

function scrambleReveal(el, opts) {
  opts = opts || {};
  var speed = opts.speed || 28;      // ms between frames
  var step = opts.step || 1;         // how many extra chars lock per frame
  var final = el.getAttribute('data-final') || el.textContent;
  el.setAttribute('data-final', final);

  if (reduceMotionMQ && reduceMotionMQ.matches) {
    el.textContent = final;
    return;
  }

  clearInterval(el._scrambleTimer);
  var revealed = 0;
  var frame = 0;
  var framesPerLock = 3; // scramble passes before each character locks in

  el._scrambleTimer = setInterval(function () {
    frame += 1;
    if (frame % framesPerLock === 0) revealed += step;

    var out = '';
    for (var i = 0; i < final.length; i++) {
      var ch = final[i];
      if (ch === ' ') { out += ' '; continue; }
      if (i < revealed) {
        out += ch;
      } else {
        out += SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)];
      }
    }
    el.textContent = out;

    if (revealed >= final.length) {
      clearInterval(el._scrambleTimer);
      el.textContent = final;
    }
  }, speed);
}

// scroll-triggered scramble for section headings
(function () {
  var headingEls = Array.prototype.slice.call(document.querySelectorAll('h2.h[data-scramble]'));
  if (headingEls.length) {
    var headingIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          scrambleReveal(en.target);
          headingIO.unobserve(en.target);
        }
      });
    }, { threshold: 0.4 });
    headingEls.forEach(function (el) { headingIO.observe(el); });
  }

  // hero name: scramble in shortly after the boot lines type out
  var nameEl = document.querySelector('h1.name[data-scramble]');
  if (nameEl) {
    setTimeout(function () { scrambleReveal(nameEl, { speed: 24 }); }, 780);
  }
})();

// ---------- hero role line: terminal typewriter ----------
(function () {
  var target = document.getElementById('roleText');
  var cursor = document.getElementById('roleCursor');
  if (!target) return;

  var full = "Full-stack engineer building real-time, AI-powered web platforms — from voice-driven learning apps to scalable e-commerce systems. Final-year CSE student, based in Kolkata.";
  var boldWords = ["real-time, AI-powered web platforms"];

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function renderWithBold(text) {
    var html = text;
    boldWords.forEach(function (w) {
      if (text.indexOf(w) !== -1 && text.length >= 0) {
        // only bold once the full phrase has been typed
        if (text.indexOf(w) + w.length <= text.length) {
          html = html.split(w).join('<b>' + w + '</b>');
        }
      }
    });
    return html;
  }

  if (reduceMotion) {
    target.innerHTML = renderWithBold(full);
    if (cursor) cursor.style.display = 'none';
    return;
  }

  var i = 0;
  var speed = 14; // ms per character — fast, terminal-like
  function type() {
    i += 1;
    var slice = full.slice(0, i);
    target.innerHTML = renderWithBold(slice);
    if (i < full.length) {
      setTimeout(type, speed);
    } else if (cursor) {
      cursor.style.animation = 'blink 1s step-end infinite';
    }
  }
  setTimeout(type, 850); // start after boot lines animate in
})();

// ---------- now-playing: generative lo-fi loop via Web Audio API ----------
(function () {
  var widget = document.getElementById('nowPlaying');
  var btn = document.getElementById('npToggle');
  if (!widget || !btn) return;

  var ctx, masterGain, beatTimer, playing = false, step = 0;
  var notes = [220.0, 261.63, 293.66, 329.63, 392.0]; // A3 C4 D4 E4 G4

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.05;
      masterGain.connect(ctx.destination);
    }
  }

  function pluck(freq, time, dur, gainVal) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gainVal, time + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g).connect(masterGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function scheduleLoop() {
    if (!playing) return;
    var now = ctx.currentTime;
    var root = notes[step % notes.length];
    pluck(root, now, 1.1, 0.6);
    pluck(root * 2, now + 0.5, 0.6, 0.3);
    step += 1;
    beatTimer = setTimeout(scheduleLoop, 900);
  }

  var userToggled = false;

  function setUI() {
    widget.classList.toggle('playing', playing);
    btn.setAttribute('aria-pressed', String(playing));
    btn.setAttribute('aria-label', playing ? 'Pause now-playing track' : 'Play now-playing track');
  }

  function start() {
    if (playing) return;
    try {
      ensureCtx();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { return; }
    playing = true;
    setUI();
    scheduleLoop();
  }

  function stop() {
    playing = false;
    setUI();
    clearTimeout(beatTimer);
  }

  btn.addEventListener('click', function () {
    userToggled = true;
    if (playing) stop(); else start();
  });

  // Play by default. Browsers block audio until the visitor interacts,
  // so try immediately and fall back to the first click / key / tap.
  function armGesture() {
    function onGesture(e) {
      if (userToggled || playing) { cleanup(); return; }
      if (e.target && e.target.closest && e.target.closest('#npToggle')) return; // button handles itself
      cleanup();
      start();
    }
    function cleanup() {
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
        window.removeEventListener(ev, onGesture, true);
      });
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, onGesture, true);
    });
  }

  try {
    ensureCtx();
    var p = ctx.resume();
    Promise.resolve(p).then(function () {
      if (ctx.state === 'running') start(); else armGesture();
    }, armGesture);
  } catch (e) { armGesture(); }
})();

// ---------- project card cursor glow ----------
document.querySelectorAll('.card').forEach(function (card) {
  card.addEventListener('mousemove', function (e) {
    var r = card.getBoundingClientRect();
    card.style.setProperty('--px', (e.clientX - r.left) + 'px');
    card.style.setProperty('--py', (e.clientY - r.top) + 'px');
  });
});

// ---------- scroll reveal ----------
(function () {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
})();
