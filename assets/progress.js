/* Reading progress for case pages: a thin line on the right edge (desktop) / along the bottom (phones) that fills as you scroll to the end. */
(function () {
  'use strict';
  var el = document.createElement('div');
  el.className = 'rp'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i></i><b></b><span class="mono rp-n">0%</span>';
  document.body.appendChild(el);
  var n = el.querySelector('.rp-n'), raf = 0;
  function upd() {
    raf = 0;
    var max = document.documentElement.scrollHeight - innerHeight, p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    el.style.setProperty('--p', p.toFixed(4)); n.textContent = Math.round(p * 100) + '%'; el.classList.toggle('end', p > 0.985);
  }
  function req() { if (!raf) raf = requestAnimationFrame(upd); }
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req); addEventListener('load', req); upd();
})();
