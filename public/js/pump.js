// Precios «de surtidor»: la tercera cifra decimal, pequeña y en alto, como en
// los carteles de las gasolineras (1,62⁹ €). Se aplica sola a los precios
// grandes de la app cuando aparecen en pantalla; el texto sigue siendo el
// mismo para el lector de pantalla y al copiar.

const SELECTOR = '.price .eff, .best .big, .advise-main .big, .fav-price, .brand-price, .result .eff';
const PRICE = /^(\d{1,2},\d{2})(\d) €$/;

function pumpify(root = document) {
  for (const el of root.querySelectorAll(SELECTOR)) {
    if (el.dataset.pump === el.textContent) continue;
    const m = PRICE.exec(el.textContent.trim());
    if (!m || el.children.length) continue;
    const text = el.textContent;
    el.innerHTML = `${m[1]}<sup>${m[2]}</sup><span class="eur">€</span>`;
    el.setAttribute('aria-label', text.trim());
    el.dataset.pump = el.textContent;
  }
}

let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; pumpify(); });
}).observe(document.body, { childList: true, subtree: true });
pumpify();
