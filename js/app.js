/* Culture — rendu du catalogue. Données : data.json (aucune étape de build). */
(() => {
  const CATS = {
    film:      { label: 'Films',      one: 'Film',      color: '#C8442B' },
    serie:     { label: 'Séries',     one: 'Série',     color: '#7A4E9C' },
    livre:     { label: 'Livres',     one: 'Livre',     color: '#2F6B4F' },
    musique:   { label: 'Musique',    one: 'Musique',   color: '#D08A1E' },
    podcast:   { label: 'Podcasts',   one: 'Podcast',   color: '#2E6E8E' },
    expo:      { label: 'Expos',      one: 'Expo',      color: '#B5486F' },
    spectacle: { label: 'Spectacles', one: 'Spectacle', color: '#8C3B2E' },
    jeu:       { label: 'Jeux',       one: 'Jeu vidéo', color: '#3F4FA8' },
    lieu:      { label: 'Lieux',      one: 'Lieu',      color: '#5E7A2E' },
    autre:     { label: 'Autres',     one: 'Autre',     color: '#6B6259' },
  };
  const STATUSES = ['à découvrir', 'en cours', 'découvert'];
  const STATUS_LABEL = { 'à découvrir': 'À découvrir', 'en cours': 'En cours', 'découvert': 'Découvert' };

  const state = { items: [], cat: 'tout', status: 'tous', q: '', sort: 'recent' };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Typographie française : apostrophe courbe, espaces fines insécables avant : ; ? !
  const typo = (s) => esc(s).replace(/&#39;/g, '’').replace(/ ([:;?!»])/g, '\u202F$1').replace(/« /g, '«\u202F');
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fmtDate = (iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => {
    const d = new Date(iso + (iso && iso.length === 10 ? 'T12:00:00' : ''));
    return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', opts);
  };
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const stars = (r) => r ? `<span class="stars" aria-label="${r} sur 5">${'★'.repeat(r)}<span>${'★'.repeat(5 - r)}</span></span>` : '';
  const statusClass = (s) => 's-' + norm(s).replace(/\s+/g, '-');
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'lien'; } };

  async function load() {
    try {
      const res = await fetch('data.json', { cache: 'no-store' });
      const data = await res.json();
      state.items = Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('data.json illisible', e);
      state.items = [];
    }
    if (new URLSearchParams(location.search).has('vide')) state.items = []; // aperçu de l'état vide
    renderMasthead();
    renderFilters();
    document.querySelector('.toolbar').hidden = !state.items.length;
    render();
    openFromHash();
  }

  function renderMasthead() {
    const now = new Date();
    $('#today').textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('#issue').textContent = `N° ${String(state.items.length).padStart(2, '0')} · Paris`;
    const c = (s) => state.items.filter((i) => i.status === s).length;
    $('#stats').innerHTML = `
      <div><dt>Recommandations</dt><dd>${state.items.length}</dd></div>
      <div><dt>À découvrir</dt><dd>${c('à découvrir')}</dd></div>
      <div><dt>En cours</dt><dd>${c('en cours')}</dd></div>
      <div><dt>Découvertes</dt><dd>${c('découvert')}</dd></div>`;
  }

  function renderFilters() {
    const count = (k) => state.items.filter((i) => i.category === k).length;
    const pills = [`<button class="pill" role="tab" data-cat="tout">Tout <sup>${state.items.length}</sup></button>`]
      .concat(Object.entries(CATS).filter(([k]) => count(k) > 0).map(([k, v]) =>
        `<button class="pill" role="tab" data-cat="${k}" style="--c:${v.color}"><i></i>${v.label} <sup>${count(k)}</sup></button>`));
    $('#cats').innerHTML = pills.join('');
    $('#statuses').innerHTML = ['tous', ...STATUSES].map((s) =>
      `<button data-status="${s}">${s === 'tous' ? 'Tous' : STATUS_LABEL[s]}</button>`).join('');
    syncFilterUI();
  }

  function syncFilterUI() {
    document.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-selected', b.dataset.cat === state.cat));
    document.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.status === state.status));
  }

  function filtered() {
    const q = norm(state.q.trim());
    let list = state.items.filter((i) =>
      (state.cat === 'tout' || i.category === state.cat) &&
      (state.status === 'tous' || i.status === state.status) &&
      (!q || norm([i.title, i.creator, i.recommended_by, i.description, (i.tags || []).join(' '), CATS[i.category]?.one].join(' ')).includes(q)));
    list.sort(state.sort === 'alpha'
      ? (a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
      : (a, b) => String(b.date_added).localeCompare(String(a.date_added)));
    return list;
  }

  function card(i, idx) {
    const cat = CATS[i.category] || CATS.autre;
    const media = i.image
      ? `<img src="${esc(i.image)}" alt="" loading="${idx < 8 ? 'eager' : 'lazy'}" onerror="this.parentNode.classList.add('noimg');this.remove()">`
      : '';
    return `
      <a class="card" href="#${esc(i.id)}" data-id="${esc(i.id)}" style="--c:${cat.color}; --i:${idx}">
        <figure class="card__media ${i.image ? '' : 'noimg'}" data-initial="${esc((i.title || '?')[0])}">
          ${media}
          <span class="badge ${statusClass(i.status)}">${STATUS_LABEL[i.status] || esc(i.status)}</span>
        </figure>
        <div class="card__body">
          <p class="kicker"><i></i>${cat.one}${i.year ? ` <span>· ${esc(i.year)}</span>` : ''}</p>
          <h2 class="card__title">${typo(i.title)}</h2>
          <p class="card__creator">${typo(i.creator)}</p>
          <p class="card__from"><span>${i.recommended_by ? `Conseillé par <b>${esc(i.recommended_by)}</b>` : ''}</span>${i.rating ? stars(i.rating) : ''}</p>
        </div>
      </a>`;
  }

  function render() {
    const list = filtered();
    const grid = $('#grid'), empty = $('#empty');
    syncFilterUI();
    if (!state.items.length) {
      grid.innerHTML = ''; $('#resultLine').textContent = '';
      empty.hidden = false;
      empty.innerHTML = `
        <div class="empty__art" aria-hidden="true"><span></span><span></span><span></span></div>
        <h2>La pile est vide.</h2>
        <p>Aucune recommandation pour l’instant. Le prochain film qu’un ami vous glisse, le livre d’une newsletter, l’expo dont tout le monde parle&nbsp;: <em>tout atterrira ici.</em></p>`;
      return;
    }
    if (!list.length) {
      grid.innerHTML = ''; $('#resultLine').textContent = '';
      empty.hidden = false;
      empty.innerHTML = `
        <div class="empty__art" aria-hidden="true"><span></span><span></span><span></span></div>
        <h2>Rien ne correspond.</h2>
        <p>Aucune recommandation ne répond à ces critères${state.q ? ` pour « <em>${esc(state.q)}</em> »` : ''}.</p>
        <button class="btn" id="reset">Réinitialiser les filtres</button>`;
      $('#reset').onclick = () => { Object.assign(state, { cat: 'tout', status: 'tous', q: '' }); $('#q').value = ''; render(); };
      return;
    }
    empty.hidden = true;
    const catLabel = state.cat === 'tout' ? 'toutes catégories' : CATS[state.cat].label.toLowerCase();
    $('#resultLine').innerHTML = `<b>${plural(list.length, 'recommandation', 'recommandations')}</b> — ${catLabel}${state.status !== 'tous' ? `, ${STATUS_LABEL[state.status].toLowerCase()}` : ''}`;
    grid.innerHTML = list.map(card).join('');
  }

  /* ---------- Panneau de détail ---------- */
  let lastFocus = null;
  function openItem(id) {
    const i = state.items.find((x) => x.id === id);
    if (!i) return;
    const cat = CATS[i.category] || CATS.autre;
    lastFocus = document.activeElement;
    $('#drawerBody').innerHTML = `
      <div class="d__media" style="--c:${cat.color}">
        ${i.image ? `<img class="d__bg" src="${esc(i.image)}" alt=""><img class="d__img" src="${esc(i.image)}" alt="${esc(i.title)}">` : `<div class="d__ph">${esc((i.title || '?')[0])}</div>`}
      </div>
      <div class="d__body" style="--c:${cat.color}">
        <p class="kicker"><i></i>${cat.one}${i.year ? ` <span>· ${esc(i.year)}</span>` : ''}</p>
        <h2 id="dTitle" class="d__title">${typo(i.title)}</h2>
        <p class="d__creator">${typo(i.creator)}</p>
        <p class="d__desc">${typo(i.description)}</p>
        <dl class="d__meta">
          <div><dt>Conseillé par</dt><dd>${esc(i.recommended_by) || '—'}</dd></div>
          <div><dt>Ajouté le</dt><dd>${fmtDate(i.date_added)}</dd></div>
          <div><dt>Statut</dt><dd><span class="badge ${statusClass(i.status)}">${STATUS_LABEL[i.status] || esc(i.status)}</span></dd></div>
          ${i.rating ? `<div><dt>Note</dt><dd>${stars(i.rating)}</dd></div>` : ''}
        </dl>
        ${(i.tags || []).length ? `<ul class="tags">${i.tags.map((t) => `<li><button data-tag="${esc(t)}">#${esc(t)}</button></li>`).join('')}</ul>` : ''}
        ${i.link ? `<a class="btn btn--ink" href="${esc(i.link)}" target="_blank" rel="noopener">Voir sur ${esc(host(i.link))} <span aria-hidden="true">↗</span></a>` : ''}
      </div>`;
    const d = $('#drawer');
    d.hidden = false;
    requestAnimationFrame(() => d.classList.add('is-open'));
    document.body.classList.add('lock');
    d.querySelector('.drawer__panel').focus();
    d.querySelectorAll('[data-tag]').forEach((b) => b.onclick = () => {
      state.q = b.dataset.tag; $('#q').value = state.q; state.cat = 'tout'; state.status = 'tous';
      closeItem(); render();
    });
  }
  function closeItem() {
    const d = $('#drawer');
    if (d.hidden) return;
    d.classList.remove('is-open');
    document.body.classList.remove('lock');
    setTimeout(() => { d.hidden = true; }, 280);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    lastFocus?.focus?.({ preventScroll: true });
  }
  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    id ? openItem(id) : closeItem();
  }

  /* ---------- Événements ---------- */
  document.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) { state.cat = cat.dataset.cat; render(); return; }
    const st = e.target.closest('[data-status]');
    if (st) { state.status = st.dataset.status; render(); return; }
    if (e.target.closest('[data-close]')) closeItem();
  });
  window.addEventListener('hashchange', openFromHash);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeItem();
    if (e.key === '/' && document.activeElement !== $('#q')) { e.preventDefault(); $('#q').focus(); }
  });
  $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

  /* ---------- Application installable (PWA) ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker non enregistré', e));
    });
  }

  const install = (() => {
    const KEY = 'culture:install-dismissed';
    const params = new URLSearchParams(location.search);
    const demo = params.has('install-demo') ? (params.get('install-demo') || 'chrome') : null; // ?install-demo ou ?install-demo=ios
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa\//i.test(ua);
    const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const dismissed = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };
    const remember = () => { try { localStorage.setItem(KEY, new Date().toISOString()); } catch {} };
    let deferred = null, el = null;

    const shareIcon = '<svg class="install__share" viewBox="0 0 24 24" aria-label="Partager" role="img"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16"/></svg>';
    const closeBtn = '<button class="install__close" type="button" aria-label="Fermer" data-install-close><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';

    function show(kind) {
      if (el) return;
      el = document.createElement('aside');
      el.className = `install install--${kind}`;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Installer Culture');
      el.innerHTML = kind === 'ios' ? `
        <span class="install__mark" aria-hidden="true">C<i>.</i></span>
        <div class="install__text">
          <p class="install__title">Culture, sur ton écran d’accueil</p>
          <p class="install__hint">Touche ${shareIcon} <b>Partager</b>, puis <b>Sur l’écran d’accueil</b>.</p>
        </div>
        ${closeBtn}` : `
        <span class="install__mark" aria-hidden="true">C<i>.</i></span>
        <div class="install__text">
          <p class="install__title">Installer Culture sur ton appareil</p>
          <p class="install__hint">Plein écran · hors ligne</p>
        </div>
        <button class="install__cta" type="button" data-install-go>Installer</button>
        ${closeBtn}`;
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el && el.classList.add('is-in')));
      el.querySelector('[data-install-close]').onclick = () => { remember(); hide(); };
      const go = el.querySelector('[data-install-go]');
      if (go) go.onclick = async () => {
        if (!deferred) { hide(); return; }
        deferred.prompt();
        const { outcome } = await deferred.userChoice.catch(() => ({}));
        deferred = null;
        if (outcome === 'dismissed') remember();
        hide();
      };
    }
    function hide() {
      if (!el) return;
      const node = el; el = null;
      node.classList.remove('is-in');
      setTimeout(() => node.remove(), 400);
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); // on remplace la mini-barre native par notre bandeau
      deferred = e;
      if (!standalone() && !dismissed()) setTimeout(() => show('chrome'), 1200);
    });
    window.addEventListener('appinstalled', () => { remember(); deferred = null; hide(); });
    matchMedia('(display-mode: standalone)').addEventListener?.('change', (e) => e.matches && hide());

    if (demo) setTimeout(() => show(demo === 'ios' ? 'ios' : 'chrome'), 300);
    else if (isIOSSafari && !standalone() && !dismissed()) {
      // iOS n'a pas d'invite automatique : indice discret, une seule fois
      setTimeout(() => { show('ios'); remember(); }, 2500);
    }
    return { show, hide };
  })();

  load();
})();
