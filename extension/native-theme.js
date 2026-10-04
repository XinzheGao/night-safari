/* Conservative native-theme discovery. Only use selectors shipped by the site. */
(function (scope) {
  function candidates(selector) {
    const result = [];
    for (const part of selector.split(',')) {
      const match = part.trim().match(/^(?:html|body|:root)?(\.(dark|dark-mode|dark-theme|theme-dark)|\[(data-theme|data-color-mode|data-bs-theme|data-mode)\s*=\s*["']?dark["']?\])/i);
      if (!match || !/^(?:$|[\s.#:\[>+~])/.test(part.trim().slice(match[0].length))) continue;
      result.push(match[2] ? { kind: 'class', name: match[2], selector: match[0] } :
        { kind: 'attribute', name: match[3], selector: match[0] });
    }
    return result;
  }
  function create(doc, mediaMatches) {
    const attempted = new Set();
    let active = null;
    function restore() {
      if (!active) return;
      const { el, candidate, previous } = active;
      if (candidate.kind === 'class') el.classList.remove(candidate.name);
      else if (el.getAttribute(candidate.name) === 'dark') {
        if (previous === null) el.removeAttribute(candidate.name);
        else el.setAttribute(candidate.name, previous);
      }
      active = null;
    }
    function tryActivate(verify) {
      if (active) {
        if (verify()) return '网站原生深色';
        restore();
      }
      const found = [];
      let budget = 5000;
      function walk(rules) {
        for (const rule of rules) {
          if (--budget < 0) return;
          if (rule.selectorText) found.push(...candidates(rule.selectorText));
          else if (rule.cssRules) {
            if (rule.media && !mediaMatches(rule.media.mediaText)) continue;
            if (rule.conditionText && !rule.media && typeof CSS !== 'undefined' && !CSS.supports(rule.conditionText)) continue;
            walk(rule.cssRules);
          }
        }
      }
      for (const sheet of doc.styleSheets) {
        if (sheet.disabled || sheet.ownerNode?.id === 'night-engine') continue;
        if (sheet.media?.mediaText && !mediaMatches(sheet.media.mediaText)) continue;
        try { walk(sheet.cssRules); } catch { /* Cross-origin styles are not readable. */ }
      }
      for (const candidate of found) {
        for (const el of [doc.documentElement, doc.body].filter(Boolean)) {
          const key = `${el.tagName}:${candidate.kind}:${candidate.name}`;
          if (attempted.has(key)) continue;
          // Require the observed selector to actually target this root element.
          const previous = candidate.kind === 'class' ? el.classList.contains(candidate.name) : el.getAttribute(candidate.name);
          if (previous === true || previous === 'dark') continue;
          attempted.add(key);
          if (candidate.kind === 'class') el.classList.add(candidate.name);
          else el.setAttribute(candidate.name, 'dark');
          active = { el, candidate, previous };
          if (el.matches(candidate.selector) && verify()) return '网站原生深色';
          restore();
        }
      }
      return null;
    }
    return { tryActivate, restore: () => { restore(); attempted.clear(); } };
  }
  const api = { candidates, create };
  scope.NightNativeTheme = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
