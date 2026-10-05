/* Fill neutral light surfaces left behind by a site's native dark theme. */
(function (scope) {
  const BG = 'data-night-native-bg', FG = 'data-night-native-fg', PROBE = 'data-night-native-probe';
  const EXCLUDE = 'img,video,audio,picture,canvas,svg,iframe,object,embed,script,style,link,meta,noscript';
  function create(doc) {
    const C = scope.NightColors;
    let active = false, timer, observer, sheet;
    const marked = new Set();
    function clearMarks() {
      for (const el of marked) { el.removeAttribute(BG); el.removeAttribute(FG); }
      marked.clear();
    }
    function visible(el) {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 &&
        r.top < scope.innerHeight && r.left < scope.innerWidth;
    }
    function background(el) {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const s = scope.getComputedStyle(n);
        if (s.backgroundImage !== 'none') return null;
        const c = C.parse(s.backgroundColor);
        if (!c) return null;
        layers.push(c);
        if (c[3] >= .99) break;
      }
      let result = [255, 255, 255, 1];
      for (let i = layers.length - 1; i >= 0; i--) result = C.composite(layers[i], result);
      return result;
    }
    function scan() {
      if (!active || !doc.body) return;
      observer.disconnect();
      doc.documentElement.setAttribute(PROBE, "");
      clearMarks();
      const elements = [...doc.body.querySelectorAll('*')].filter(el => !el.closest(EXCLUDE) && visible(el));
      // Read original surfaces before applying any overrides. Preserve artwork and colored controls.
      const surfaces = elements.filter(el => {
        const s = scope.getComputedStyle(el), c = C.parse(s.backgroundColor);
        return s.backgroundImage === 'none' && c && c[3] >= .8 && C.luminance(c) > .65 &&
          Math.max(...c.slice(0, 3)) - Math.min(...c.slice(0, 3)) < 35;
      });
      for (const el of surfaces) { el.setAttribute(BG, ''); marked.add(el); }
      for (const el of elements) {
        if (!el.closest(`[${BG}]`)) continue;
        const s = scope.getComputedStyle(el), bg = background(el), fg = C.parse(s.color);
        if (!bg || !fg || fg[3] < .99 || C.contrast(fg, bg) >= 4.5) continue;
        const replacement = C.foreground(fg, el.matches('a'));
        if (!replacement || C.contrast(C.parse(replacement), bg) < 4.5) {
          el.setAttribute(FG, 'text');
        } else {
          el.setAttribute(FG, Object.keys(C.palette).find(key => C.palette[key] === replacement) || 'text');
        }
        marked.add(el);
      }
      // Force the final styles while transitions are suppressed, before resuming observation.
      for (const el of marked) scope.getComputedStyle(el).backgroundColor;
      doc.documentElement.removeAttribute(PROBE);
      observe();
    }
    function schedule() { if (active) { clearTimeout(timer); timer = setTimeout(scan, 120); } }
    function observe() {
      observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'href', 'media', 'disabled'] });
    }
    function start() {
      if (active) { schedule(); return; }
      active = true;
      if (!sheet) {
        sheet = doc.createElement('style'); sheet.id = 'night-native-fallback';
        sheet.textContent = `html body [${BG}][${BG}] { background-color: ${C.palette.panel} !important; border-color: ${C.palette.border} !important; transition: none !important; }\n` +
          Object.entries(C.palette).map(([key, value]) => `html body [${FG}="${key}"][${FG}] { transition: none !important; color: ${value} !important; -webkit-text-fill-color: ${value} !important; }`).join('\n') + `\nhtml[${PROBE}] body, html[${PROBE}] body * { transition: none !important; }`;
        (doc.head || doc.documentElement).append(sheet);
      }
      observer = new MutationObserver(records => {
        if (records.some(r => r.target !== sheet && !sheet.contains(r.target) &&
          !(r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].every(n => n === sheet)))) schedule();
      });
      scope.addEventListener('scroll', schedule, true);
      scope.addEventListener('resize', schedule);
      doc.addEventListener('load', schedule, true);
      scan();
    }
    function pause() {
      active = false; clearTimeout(timer); observer?.disconnect();
      if (sheet) doc.documentElement.setAttribute(PROBE, '');
      clearMarks();
    }
    function stop() {
      active = false; clearTimeout(timer); observer?.disconnect();
      scope.removeEventListener('scroll', schedule, true);
      scope.removeEventListener('resize', schedule);
      doc.removeEventListener('load', schedule, true);
      clearMarks(); sheet?.remove(); sheet = null;
      doc.documentElement.removeAttribute(PROBE);
    }
    return { start, stop, pause };
  }
  scope.NightNativeFallback = { create };
})(globalThis);
