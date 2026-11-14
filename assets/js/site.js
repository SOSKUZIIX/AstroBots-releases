/* AstroBots website script. No dependencies, no storage, no cookies, no tracking.
   The only request it makes to anyone but this site is the one to GitHub's public releases API, to fill in the download buttons.
   Every public address comes from config.json (see README.md). With no script at all the pages still read. */
(() => {
  'use strict';

  const doc = document;
  const me = doc.currentScript || doc.querySelector('script[src$="site.js"]');
  const SITE = new URL('../../', me.src); // this site's own root, wherever it is published
  const $ = (sel, el = doc) => el.querySelector(sel);
  const $$ = (sel, el = doc) => Array.from(el.querySelectorAll(sel));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const ready = (fn) => (doc.readyState === 'loading' ? doc.addEventListener('DOMContentLoaded', fn) : fn());

  /** The public settings, read once. A missing or broken file means "nothing configured yet", never an error. */
  const config = fetch(new URL('config.json', SITE), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));

  const text = (el, value) => { el.textContent = value; return el; };
  const make = (tag, props = {}, children = []) => {
    const el = doc.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c != null) el.append(c);
    return el;
  };

  /* ---------------------------------------------------------------- navigation, small things */

  function initNav() {
    const nav = $('.nav');
    const toggle = $('.nav-toggle');
    if (!nav || !toggle) return;
    const set = (open) => { nav.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', String(open)); };
    toggle.addEventListener('click', () => set(!nav.classList.contains('is-open')));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    doc.addEventListener('click', (e) => { if (!nav.contains(e.target)) set(false); });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); toggle.focus(); }
    });
  }

  function initReveal() {
    const items = $$('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || reduceMotion.matches) { items.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((el) => io.observe(el));
  }

  /** Addresses that come from the settings: the contact email, the releases page. */
  function initConfigLinks() {
    config.then((c) => {
      $$('[data-contact-item]').forEach((item) => {
        const link = $('[data-contact]', item);
        if (c.contactEmail && link) {
          link.href = `mailto:${c.contactEmail}`;
          const label = $('[data-contact-text]', link);
          if (label) text(label, c.contactEmail);
          item.hidden = false;
        }
      });
      $$('[data-releases-link]').forEach((a) => { if (c.releasesRepo) a.href = `https://github.com/${c.releasesRepo}/releases`; else a.hidden = true; });
      $$('[data-contact-inline]').forEach((el) => {
        if (c.contactEmail) {
          el.replaceChildren(el.dataset.prefix || '', make('a', { href: `mailto:${c.contactEmail}`, text: c.contactEmail }));
          el.hidden = false;
        }
      });
    });
  }

  /* ---------------------------------------------------------------- the hero: the logo's ring with the crew riding it */

  function initOrbit() {
    const stage = $('[data-orbit]');
    const svg = stage && $('.stage__rings', stage);
    if (!stage || !svg) return;
    const moons = $$('[data-moon]', stage);
    const NS = 'http://www.w3.org/2000/svg';
    const TILT = (-24 * Math.PI) / 180;     // the logo's tilt
    const RATIO = 74 / 27;                  // the logo's ring: wide by tall
    const REACH = 0.66;                     // the ring's half width, as a share of the stage's width
    const LAP = 110;                        // seconds for one lap
    const rings = [1, 1.2].map(() => svg.appendChild(doc.createElementNS(NS, 'ellipse')));
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    let t0 = performance.now();

    const layout = () => {
      w = stage.clientWidth; h = stage.clientHeight;
      if (!w || !h) return;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      rings.forEach((el, i) => {
        const rx = w * REACH * (i ? 1.2 : 1);
        el.setAttribute('cx', w / 2); el.setAttribute('cy', h / 2);
        el.setAttribute('rx', rx); el.setAttribute('ry', rx / RATIO);
        el.setAttribute('transform', `rotate(-24 ${w / 2} ${h / 2})`);
      });
      place(performance.now());
    };

    const place = (now) => {
      if (!w) return;
      const a = w * REACH;
      const b = a / RATIO;
      const spin = reduceMotion.matches ? 0 : ((now - t0) / 1000 / LAP) * Math.PI * 2;
      moons.forEach((m) => {
        const phase = Number(m.dataset.phase) * Math.PI + spin;
        const ex = a * Math.cos(phase);
        const ey = b * Math.sin(phase);
        const x = w / 2 + ex * Math.cos(TILT) - ey * Math.sin(TILT);
        const y = h / 2 + ex * Math.sin(TILT) + ey * Math.cos(TILT);
        m.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        m.style.zIndex = Math.sin(phase) > 0 ? '3' : '0'; // the near half of the ring passes in front of the picture
      });
    };

    const tick = (now) => {
      raf = 0;
      place(now);
      if (visible && !reduceMotion.matches && !doc.hidden) raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf && visible && !reduceMotion.matches && !doc.hidden) raf = requestAnimationFrame(tick); };

    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(stage); else addEventListener('resize', layout);
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; start(); }).observe(stage);
    doc.addEventListener('visibilitychange', start);
    reduceMotion.addEventListener?.('change', () => { t0 = performance.now(); place(t0); start(); });
    layout();
    stage.classList.add('is-live');
    start();
  }

  /* ---------------------------------------------------------------- downloads */

  const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/></svg>';
  const ICON_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18V9.5A1.5 1.5 0 0 1 7.5 8H10"/></svg>';

  /** Which of the four platforms is the visitor on? Browsers cannot tell Apple silicon from Intel, so that is left to the visitor. */
  function detectPlatform() {
    const ua = navigator.userAgent || '';
    const old = String(navigator.platform || '').toLowerCase();
    const p = String((navigator.userAgentData && navigator.userAgentData.platform) || '').toLowerCase() || old;
    // an iPad that asks for desktop sites says it is a Mac, but a Mac has no touch screen
    if (/iphone|ipad|ipod/i.test(ua) || (old === 'macintel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/android/i.test(ua) || p === 'android') return 'android';
    if (p.startsWith('win') || /windows/i.test(ua)) return 'windows';
    if (p.startsWith('mac') || /macintosh|mac os x/i.test(ua)) return 'mac';
    return null;
  }

  // The file names the release workflow publishes. The exact name is tried first; a pattern is the fallback.
  const FILES = {
    'mac-arm64': (v) => [`AstroBots-${v}-mac-arm64.dmg`, /^AstroBots-.+-mac-arm64\.dmg$/i],
    'mac-x64': (v) => [`AstroBots-${v}-mac-x64.dmg`, /^AstroBots-.+-mac-x64\.dmg$/i],
    windows: (v) => [`AstroBots-Setup-${v}-x64.exe`, /^AstroBots-Setup-.+-x64\.exe$/i],
    android: (v) => [`AstroBots-${v}.apk`, /^AstroBots-.+\.apk$/i],
  };

  let releaseOnce;
  /** Asks GitHub for the latest release, once per page. Never throws: the answer says what happened. */
  function loadRelease() {
    releaseOnce ||= config.then(async (c) => {
      if (!c.releasesRepo) return { state: 'none', c };
      const api = String(c.githubApi || 'https://api.github.com').replace(/\/+$/, '');
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 9000);
      try {
        const r = await fetch(`${api}/repos/${c.releasesRepo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, signal: ctl.signal });
        if (r.status === 404) return { state: 'none', c };
        if (!r.ok) return { state: 'error', c };
        const rel = await r.json();
        const version = String(rel.tag_name || rel.name || '').replace(/^v/i, '');
        const assets = Array.isArray(rel.assets) ? rel.assets : [];
        const found = {};
        for (const [key, want] of Object.entries(FILES)) {
          const [exact, loose] = want(version);
          const a = assets.find((x) => x.name === exact) || assets.find((x) => loose.test(x.name));
          if (a && a.browser_download_url) {
            found[key] = { name: a.name, size: a.size, url: a.browser_download_url, sha: /^sha256:([0-9a-f]{64})$/i.exec(a.digest || '')?.[1] || '' };
          }
        }
        if (!version) return { state: 'none', c };
        return { state: 'ok', c, version, date: rel.published_at, page: rel.html_url, found };
      } catch {
        return { state: 'error', c };
      } finally { clearTimeout(timer); }
    });
    return releaseOnce;
  }

  const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(n >= 1.048576e8 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const fmtDate = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); };
  const releasesUrl = (c) => (c.releasesRepo ? `https://github.com/${c.releasesRepo}/releases` : '');

  const dlButton = (file, label, primary = true) => {
    const a = make('a', { class: `btn ${primary ? 'btn--primary' : 'btn--ghost'}`, href: file.url, rel: 'noopener', download: '' });
    a.insertAdjacentHTML('beforeend', ICON_DOWN);
    a.append(label);
    return a;
  };
  const quiet = (label) => make('span', { class: 'btn btn--quiet', text: label });
  const linkButton = (href, label) => {
    const a = make('a', { class: 'btn btn--ghost', href, rel: 'noopener' });
    a.append(label);
    a.insertAdjacentHTML('beforeend', ICON_OUT);
    return a;
  };

  function renderCards(host, r, platform) {
    const { c } = r;
    const all = releasesUrl(c);
    $$('.dl-card', host).forEach((card) => {
      const key = card.dataset.platform;
      const meta = $('[data-meta]', card);
      const actions = $('[data-actions]', card);
      const sums = $('[data-sums]', card);
      const badge = $('.badge', card);
      const current = platform === key;
      card.dataset.current = current ? 'true' : 'false';
      if (badge) badge.hidden = !current;
      actions.replaceChildren();
      meta.replaceChildren();
      if (sums) { sums.hidden = true; $('.sum', sums)?.replaceChildren(); }

      if (key === 'ios') {
        if (c.testflightUrl) {
          actions.append(linkButton(c.testflightUrl, 'Join on TestFlight'));
          meta.append('TestFlight keeps it up to date.');
        } else {
          actions.append(quiet('Coming soon'));
          meta.append('The TestFlight link is not ready yet.');
        }
        return;
      }

      const keys = key === 'mac' ? ['mac-arm64', 'mac-x64'] : [key];
      if (r.state === 'ok') {
        const files = keys.map((k) => [k, r.found[k]]).filter(([, f]) => f);
        if (files.length) {
          const labels = { 'mac-arm64': 'Apple silicon', 'mac-x64': 'Intel', windows: 'Download the installer', android: 'Download the .apk' };
          files.forEach(([k, f]) => actions.append(dlButton(f, labels[k], true)));
          const when = fmtDate(r.date);
          const sizes = files.map(([k, f]) => (key === 'mac' ? `${fmtSize(f.size)} ${k === 'mac-arm64' ? 'Apple silicon' : 'Intel'}` : fmtSize(f.size)));
          meta.append(`Version ${r.version}${when ? ` · ${when}` : ''} · ${sizes.join(' · ')}`);
          if (files.length < keys.length) {
            const missing = keys.find((k) => !r.found[k]);
            actions.append(quiet(`${missing === 'mac-x64' ? 'Intel' : 'Apple silicon'}: coming soon`));
          }
          const withSha = files.filter(([, f]) => f.sha);
          if (sums && withSha.length) {
            const list = $('.sum', sums);
            for (const [, f] of withSha) list.append(make('div', {}, [make('span', { text: f.name }), make('code', { text: f.sha })]));
            sums.hidden = false;
          }
          return;
        }
        actions.append(quiet('Coming soon'));
        meta.append('Not in the latest release yet.');
        if (all) actions.append(linkButton(all, 'All releases'));
        return;
      }

      if (r.state === 'none') {
        actions.append(quiet('Coming soon'));
        meta.append('The first release is not out yet.');
        return;
      }
      // the request failed: say so, and give a real way forward
      meta.append('Could not reach GitHub just now.');
      if (all) actions.append(linkButton(all, 'Open the releases page')); else actions.append(quiet('Coming soon'));
    });
    host.dataset.state = r.state;
  }

  function initDownloads() {
    const hosts = $$('[data-downloads]');
    if (!hosts.length) return;
    const platform = detectPlatform();
    hosts.forEach((host) => {
      $$('[data-meta]', host).forEach((m) => { m.replaceChildren(make('span', { class: 'skeleton' }, [make('span', { class: 'spin', 'aria-hidden': 'true' }), 'Looking for the latest version…'])); });
    });
    loadRelease().then((r) => hosts.forEach((host) => renderCards(host, r, platform)));
  }

  /** The invite page's step 1: the right download first, the rest one click away. */
  function initQuickDownload() {
    const hosts = $$('[data-quick]');
    if (!hosts.length) return;
    const platform = detectPlatform();
    hosts.forEach((h) => h.replaceChildren(make('span', { class: 'skeleton' }, [make('span', { class: 'spin', 'aria-hidden': 'true' }), 'Looking for the latest version…'])));
    loadRelease().then((r) => hosts.forEach((host) => {
      const box = make('div', { class: 'dl-card__actions' });
      const note = make('p', { class: 'fine' });
      const all = releasesUrl(r.c);
      if (r.state === 'ok') {
        const order = platform === 'windows' ? ['windows', 'mac-arm64', 'mac-x64'] : ['mac-arm64', 'mac-x64', 'windows'];
        const names = { windows: 'Windows', 'mac-arm64': 'Mac, Apple silicon', 'mac-x64': 'Mac, Intel' };
        order.filter((k) => r.found[k]).forEach((k, i) => box.append(dlButton(r.found[k], names[k], i === 0)));
        if (!box.children.length) box.append(quiet('Coming soon'));
        note.append(`Version ${r.version}. Not sure which Mac you have? Apple menu, About This Mac: "Chip: Apple" is Apple silicon, "Processor: Intel" is Intel.`);
      } else if (r.state === 'none') {
        box.append(quiet('Coming soon'));
        note.append('The first release is not out yet.');
      } else {
        note.append('Could not reach GitHub just now.');
        if (all) box.append(linkButton(all, 'Open the releases page'));
      }
      host.replaceChildren(box, note);
    }));
  }

  /* ---------------------------------------------------------------- request an invite */

  function initInviteForm() {
    $$('[data-invite-form]').forEach((root) => {
      const form = $('form', root);
      if (!form) return;
      const err = $('[data-error]', root);
      const status = $('[data-status]', root);
      const done = $('[data-done]', root);
      const closed = $('[data-closed]', root);
      const submit = $('[type="submit"]', form);
      const email = form.elements.email;
      const note = form.elements.note;
      const trap = form.elements.website;
      const idle = submit.textContent;
      let mode = 'wait';

      const say = (kind, message) => {
        err.textContent = kind === 'error' ? message : '';
        status.textContent = kind === 'info' ? message : '';
        email.setAttribute('aria-invalid', kind === 'error' && /email/i.test(message) ? 'true' : 'false');
      };
      const busy = (on) => {
        submit.disabled = on; submit.classList.toggle('is-busy', on); form.setAttribute('aria-busy', String(on));
        email.readOnly = on; note.readOnly = on;
        submit.textContent = on ? 'Sending…' : idle;
      };

      config.then((c) => {
        if (c.accessUrl) mode = 'api';
        else if (c.contactEmail) mode = 'mail';
        else mode = 'closed';
        if (mode === 'closed') {
          form.hidden = true;
          if (closed) closed.hidden = false;
        }
        root.dataset.mode = mode;
      });

      email.addEventListener('input', () => email.setAttribute('aria-invalid', 'false'));

      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const c = await config;
        if (mode === 'closed') return;
        const address = email.value.trim();
        if (!address || !email.checkValidity()) {
          say('error', 'Please enter a valid email address, so we know where to send your code.');
          email.focus();
          return;
        }
        const payload = { email: address, note: note.value.trim(), website: trap ? trap.value : '' };

        if (mode === 'mail') {
          const subject = 'AstroBots invite request';
          const body = `Hello,\n\nI would like an AstroBots invite.\n\nMy email: ${address}\nWhat I will use it for: ${payload.note || '(not said)'}\n`;
          say('info', `Your email app should open with the request ready to send. If nothing happens, write to ${c.contactEmail}.`);
          location.href = `mailto:${c.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          return;
        }

        say('info', '');
        busy(true);
        try {
          const res = await fetch(`${String(c.accessUrl).replace(/\/+$/, '')}/v1/request-invite`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });
          let json = null;
          try { json = await res.json(); } catch { /* no body */ }
          if (res.status === 202 && json && json.ok === true) {
            form.hidden = true;
            say('info', '');
            if (done) { done.hidden = false; const h = $('[data-done-title]', done); if (h) h.focus(); }
          } else if (json && json.error && typeof json.error.message === 'string' && json.error.message) {
            say('error', json.error.message);
          } else {
            say('error', `We could not send that (the invite service answered ${res.status}). Please try again in a moment.`);
          }
        } catch {
          say('error', 'We could not reach the invite service. Check your connection and try again.');
        } finally { busy(false); }
      });

      const again = $('[data-again]', root);
      if (again) again.addEventListener('click', () => { form.reset(); form.hidden = false; if (done) done.hidden = true; say('info', ''); email.focus(); });
    });
  }

  /* ---------------------------------------------------------------- the invite page */

  const CODE = /^[A-Z0-9][A-Z0-9-]{3,38}[A-Z0-9]$/;
  const tidy = (raw) => String(raw || '').trim().toUpperCase().replace(/[\s_]+/g, '-').replace(/-{2,}/g, '-');

  function flash(button, message) {
    const old = button.dataset.label || button.textContent;
    button.dataset.label = old;
    button.textContent = message;
    clearTimeout(Number(button.dataset.timer));
    button.dataset.timer = String(setTimeout(() => { button.textContent = old; }, 2200));
  }

  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); return true; } catch { /* fall through */ }
    const t = make('textarea', { 'aria-hidden': 'true', readonly: true });
    t.value = value; t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    doc.body.append(t); t.select();
    let ok = false;
    try { ok = doc.execCommand('copy'); } catch { ok = false; }
    t.remove();
    return ok;
  }

  function initInvitePage() {
    const page = $('[data-invite-page]');
    if (!page) return;
    const has = $('[data-has-code]', page);
    const none = $('[data-no-code]', page);
    const out = $('[data-code]', page);
    const bad = $('[data-bad-code]', page);
    const title = $('[data-title]', page);
    const form = $('[data-code-form]', page);
    const steps = $('[data-steps]', page);

    const show = (code, wasBad) => {
      const ok = CODE.test(code);
      has.hidden = !ok; none.hidden = ok; bad.hidden = !(wasBad && !ok);
      if (steps) steps.dataset.hasCode = String(ok);
      if (ok) { text(out, code); text(title, 'Your invite is ready.'); doc.title = 'Your AstroBots invite'; }
      else { text(title, 'Have an invite?'); doc.title = 'Have an invite? · AstroBots'; }
      $$('[data-typed]', page).forEach((el) => text(el, ok ? code : 'your code'));
    };
    const params = new URLSearchParams(location.search);
    const first = tidy(params.get('code'));
    show(first, Boolean(params.get('code')));

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = tidy(form.elements.code.value);
      if (!CODE.test(code)) { show('', true); form.elements.code.focus(); return; }
      history.replaceState(null, '', `?code=${encodeURIComponent(code)}`);
      show(code, false);
      const b = $('[data-copy]', page); if (b) b.focus();
    });
  }

  function initCopy() {
    $$('[data-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        const source = $(button.dataset.copy);
        if (!source) return;
        const ok = await copyText(source.textContent.trim());
        flash(button, ok ? 'Copied' : 'Press Ctrl or Cmd+C');
        const live = $('[data-live]');
        if (live) text(live, ok ? 'Copied to the clipboard.' : 'Select the code and copy it.');
      });
    });
  }

  ready(() => {
    initNav();
    initReveal();
    initConfigLinks();
    initOrbit();
    initDownloads();
    initQuickDownload();
    initInviteForm();
    initInvitePage();
    initCopy();
  });
})();
