// «Enviar a Tréboles»: marcador (bookmarklet) para el mapa oficial de Club
// MAPFRE. Se pulsa en el mapa, en tu navegador: espera a que el propio mapa
// descargue su lista (lo hace con cada búsqueda, y siempre trae toda España),
// la sube a Tréboles (server/capturas.js), que devuelve un código de un solo
// uso, y «Enviar a Tréboles» abre la app con ese código para revisarla.
//
// No usa las credenciales de MAPFRE ni hace peticiones a MAPFRE por su cuenta:
// solo lee la respuesta que el mapa ya ha recibido en tu visita, igual que un HAR.

export const MAPA_OFICIAL = 'https://www.mapfretecuidamos.com/gasolineras/';
export const MAPFRE_ORIGINS = ['https://www.mapfretecuidamos.com', 'https://mapfretecuidamos.com'];
export const isMapfreOrigin = (o) => MAPFRE_ORIGINS.includes(String(o));
/** A partir de cuántas gasolineras leídas es la lista de toda España. */
export const TODA_ESPANA = 1500;

// Se ejecuta en la página del mapa oficial (por eso no importa nada y usa
// solo comentarios de bloque: se convierte en una sola línea).
function capturar(APP) {
  var ID = 'treboles-captura';
  if (!/(^|\.)mapfretecuidamos\.com$/.test(location.hostname)) {
    if (confirm('Este botón se usa en el mapa oficial de Club MAPFRE. ¿Abrirlo ahora? Luego vuelve a pulsar el botón allí.')) {
      location.href = 'https://www.mapfretecuidamos.com/gasolineras/';
    }
    return;
  }
  var box = document.getElementById(ID);
  if (box) {
    box.style.display = 'block';
    return;
  }
  box = document.createElement('div');
  box.id = ID;
  box.setAttribute('style', 'position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);width:min(560px,92vw);'
    + 'background:#fff;color:#1b1b1b;border:3px solid #1f8a4c;border-radius:12px;padding:12px 16px;'
    + 'font:15px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)');
  document.body.appendChild(box);
  var datos = null;
  var BTN = 'style="margin-top:8px;padding:8px 14px;border:0;border-radius:8px;background:#1f8a4c;color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer"';
  function msg(h) {
    box.innerHTML = '<a href="#" data-x title="Cerrar" style="float:right;color:#666;text-decoration:none">✕</a><b>🍀 Tréboles</b><br>' + h;
    box.querySelector('[data-x]').onclick = function (e) {
      e.preventDefault();
      box.style.display = 'none';
    };
    var b = box.querySelector('[data-enviar]');
    if (b) b.onclick = enviar;
  }
  var codigo = null, total = 0;
  function listo() {
    msg('Leídas <b>' + total + '</b> gasolineras del mapa oficial.<br><button type="button" data-enviar ' + BTN + '>Enviar a Tréboles</button>');
  }
  /* Sube la lista a Tréboles (que despierta si dormía) y guarda el código para abrir la app. */
  function subir() {
    msg('Leídas <b>' + total + '</b> gasolineras. Preparando el envío a Tréboles… (si el servidor dormía, hasta un minuto)');
    fetch(APP + '/api/adheridas/captura', { method: 'POST', body: JSON.stringify(datos) })
      .then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(b.error || ('error ' + r.status)); return b; }); })
      .then(function (b) { codigo = b.id; listo(); })
      .catch(function (err) {
        msg('No se pudo conectar con Tréboles (' + String(err.message || err) + ').<br><button type="button" data-reintentar ' + BTN + '>Reintentar</button>');
        box.querySelector('[data-reintentar]').onclick = subir;
      });
  }
  function leido(j) {
    var lista = j && j.message && j.message.contenido;
    if (!lista || !lista.length) return;
    datos = j;
    total = lista.length;
    subir();
  }
  function enviar() {
    var w = window.open(APP + '/?accion=importar-mapa&captura=' + encodeURIComponent(codigo), 'treboles');
    if (!w) {
      msg('El navegador ha bloqueado la ventana nueva. Permite las ventanas emergentes de esta página y vuelve a pulsar.<br><button type="button" data-enviar ' + BTN + '>Enviar a Tréboles</button>');
      return;
    }
    msg('✓ Enviadas. Sigue en la pestaña de Tréboles para revisar los cambios y guardarlos. Para enviarlas otra vez, busca de nuevo en el mapa.');
    codigo = null;
  }
  var P = XMLHttpRequest.prototype, open = P.open, send = P.send;
  P.open = function (m, u) {
    this.__treboles = String(u);
    return open.apply(this, arguments);
  };
  P.send = function () {
    var x = this;
    if (/collaborating-center/.test(x.__treboles || '')) {
      x.addEventListener('load', function () {
        try {
          leido(x.responseType === 'json' ? x.response : JSON.parse(x.responseText));
        } catch (err) { /* respuesta que no es JSON */ }
      });
    }
    return send.apply(this, arguments);
  };
  if (window.fetch) {
    var f = window.fetch;
    window.fetch = function (i) {
      var p = f.apply(this, arguments);
      if (/collaborating-center/.test(String((i && i.url) || i))) {
        p.then(function (r) { return r.clone().json(); }).then(leido, function () {});
      }
      return p;
    };
  }
  msg('Escribe cualquier ciudad en el buscador del mapa (por ejemplo, <b>Madrid</b>) y elígela en la lista. El mapa descarga entonces las gasolineras de toda España y aquí aparecerá el botón para enviarlas.');
}

/** El marcador listo para guardar, que abre la app en `appOrigin`. */
export function bookmarklet(appOrigin) {
  const code = `(${capturar.toString()})(${JSON.stringify(String(appOrigin))})`
    .replace(/\s*\n\s*/g, ' ');
  return `javascript:${encodeURIComponent(code)}`;
}
