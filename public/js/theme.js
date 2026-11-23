// Tema claro / oscuro / automático (como el del sistema). Se carga en el
// <head> sin «defer» para poner el tema antes de pintar y que no parpadee.
(function () {
  var KEY = 'gm.theme.v1';
  var ORDER = ['auto', 'light', 'dark'];
  var LABEL = { auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: oscuro' };
  var ICON = { auto: '🌗', light: '☀️', dark: '🌙' };

  function read() {
    try { var v = localStorage.getItem(KEY); return ORDER.indexOf(v) >= 0 ? v : 'auto'; } catch (e) { return 'auto'; }
  }
  function isDark(mode) {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function apply(mode) {
    var root = document.documentElement;
    if (mode === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    // La barra del sistema del móvil, del color del fondo.
    var color = isDark(mode) ? '#101923' : '#f5f7fa';
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', color);
    var btn = document.getElementById('theme-btn');
    if (btn) {
      btn.textContent = ICON[mode];
      btn.setAttribute('aria-label', LABEL[mode]);
      btn.title = LABEL[mode] + ' (toca para cambiar)';
    }
  }

  var mode = read();
  apply(mode);

  document.addEventListener('DOMContentLoaded', function () {
    apply(mode);
    // Alto de la cabecera flotante, para pegar las pestañas justo debajo.
    var bar = document.querySelector('.topbar');
    if (bar && window.ResizeObserver) {
      new ResizeObserver(function () {
        document.documentElement.style.setProperty('--topbar-h', Math.ceil(bar.getBoundingClientRect().height) + 'px');
      }).observe(bar);
    }
    var btn = document.getElementById('theme-btn');
    if (btn) btn.addEventListener('click', function () {
      mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
      try { localStorage.setItem(KEY, mode); } catch (e) { /* sin almacenamiento: solo esta vez */ }
      apply(mode);
    });
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (mode === 'auto') apply(mode); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }
})();
