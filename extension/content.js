(() => {
  "use strict";
  const api = globalThis.browser || globalThis.chrome;
  const C = NightColors;
  const STATE = "data-night-state", MARK = "data-night-node";
  const IGNORE = "img,video,audio,picture,canvas,svg,iframe,object,embed,script,style,link,meta,noscript";
  let root, sheet, observer, timer, running = false, rerun = false;
  let settings = { enabled: true, sites: {} }, state = "pending", reason = "正在识别网页主题";
  let marked = [], serial = 0, disposed = false;
  const host = location.hostname;
  const mode = () => !settings.enabled ? "off" : settings.sites[host] || "auto";
  const nativeThemes = NightNativeTheme.create(document, query => matchMedia(query).matches);
  let wikipediaAttempts = 0;
  function activateWikipediaTheme() {
    if (!/(^|\.)wikipedia\.org$/.test(host) || mode() !== "auto") return false;
    const input = document.getElementById("skin-client-pref-skin-theme-value-night");
    if (!input || input.disabled || input.type !== "radio") return false;
    if (root.classList.contains("skin-theme-clientpref-night")) return true;
    if (wikipediaAttempts >= 3) return false;
    wikipediaAttempts++;
    // MediaWiki's own change handler applies the class, saves the preference,
    // and notifies its theme hooks. No guessed storage keys or account API calls.
    const previous = input.checked;
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    if (!root.classList.contains("skin-theme-clientpref-night")) input.checked = previous;
    return root.classList.contains("skin-theme-clientpref-night");
  }

  // Verified against Bilibili's laputa-home theme startup: theme_style + bili_dark.
  // Limit the adapter to the homepage; other Bilibili apps may not ship this theme.
  function activateBilibiliTheme() {
    if (host !== "www.bilibili.com" || location.pathname !== "/" || mode() !== "auto") return false;
    if (!document.cookie.split("; ").includes("theme_style=dark"))
      document.cookie = "theme_style=dark; Path=/; Domain=.bilibili.com; Max-Age=31536000; SameSite=Lax; Secure";
    if (![...document.scripts].some(s => s.src.includes("/laputa-home/assets/"))) return false;
    if (!root.classList.contains("bili_dark")) root.classList.add("bili_dark");
    return true;
  }

  function setState(next, message) {
    state = next; reason = message;
    root?.setAttribute(STATE, next);
  }
  function clearEngine() {
    if (sheet) sheet.textContent = "";
    for (const el of marked) el.removeAttribute(MARK);
    marked = [];
  }
  function effectiveBackground(el) {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const style = getComputedStyle(n);
      // A photograph/gradient cannot be judged using backgroundColor alone.
      if (style.backgroundImage !== "none") return null;
      const color = C.parse(style.backgroundColor);
      if (!color) return null;
      layers.push(color);
      if (color[3] >= .99) break;
    }
    let result = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) result = C.composite(layers[i], result);
    return result;
  }
  function nativeDark() {
    if (!document.body) return false;
    let dark = 0, count = 0;
    for (const x of [.18, .5, .82]) for (const y of [.2, .5, .8]) {
      const el = document.elementFromPoint(innerWidth * x, innerHeight * y);
      if (!el || el.closest(IGNORE)) continue;
      const bg = effectiveBackground(el);
      if (!bg) continue;
      count++;
      const fg = C.parse(getComputedStyle(el).color);
      if (C.luminance(bg) < .12 && fg && C.contrast(fg, bg) >= 3) dark++;
    }
    // Visible coverage matters: a dark header on a white article is not dark mode.
    return count >= 3 && dark / count >= .75;
  }
  function baseRules() {
    return `html[${STATE}="converted"] { color-scheme: dark !important; background-color: ${C.palette.canvas} !important; color: ${C.palette.text} !important; }
html[${STATE}="converted"] body { background-color: ${C.palette.canvas} !important; color: ${C.palette.text} !important; }
html[${STATE}="converted"] ::selection { background-color: #264f78 !important; color: #e6edf3 !important; }`;
  }
  function declarations(el) {
    const style = getComputedStyle(el), rules = [];
    const bg = C.parse(style.backgroundColor);
    if (bg && bg[3] > 0 && C.luminance(bg) > .12 && style.backgroundImage === "none") {
      const rect = el.getBoundingClientRect();
      const large = el === root || el === document.body || rect.width * rect.height > innerWidth * innerHeight * .6;
      const token = large ? C.palette.canvas : /^(PRE|CODE|INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName) ? C.palette.panel : C.palette.raised;
      const rgb = C.parse(token);
      rules.push(`background-color:rgba(${rgb.slice(0, 3).join(",")},${bg[3]})!important`);
    }
    // Do not recolor labels laid over media: their original contrast may be deliberate.
    if (effectiveBackground(el) !== null) {
      const fg = C.foreground(C.parse(style.color), !!el.closest("a[href]"));
      if (fg) { rules.push(`color:${fg}!important`); rules.push(`-webkit-text-fill-color:${fg}!important`); }
    }
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      const color = C.parse(style[`border${side}Color`]);
      if (parseFloat(style[`border${side}Width`]) > 0 && color?.[3] > 0 && C.luminance(color) > .15)
        rules.push(`border-${side.toLowerCase()}-color:${C.palette.border}!important`);
    }
    return rules.join(";");
  }
  async function rebuild() {
    if (disposed) return;
    if (running) { rerun = true; return; }
    if (!document.body) return;
    running = true;
    try {
      const choice = mode();
      if (choice !== "auto") nativeThemes.restore();
      // All original-color reads occur with our engine disabled, within a single
      // task/frame. It is restored before yielding, so no light frame is painted.
      sheet.media = "not all";
      const alreadyDark = nativeDark();
      const wikipediaTheme = choice === "auto" && activateWikipediaTheme();
      const biliTheme = choice === "auto" && !alreadyDark && activateBilibiliTheme();
      const biliBackground = biliTheme && C.parse(getComputedStyle(root).getPropertyValue("--bg3").trim());
      const activated = choice === "auto" && !alreadyDark && !(biliBackground && C.luminance(biliBackground) < .12)
        && nativeThemes.tryActivate(nativeDark);
      const native = alreadyDark || (wikipediaTheme && nativeDark()) || (biliBackground && C.luminance(biliBackground) < .12) || activated;
      sheet.media = "all";
      if (choice === "off" || choice === "native" || (choice === "auto" && native)) {
        clearEngine();
        setState(choice === "off" ? "off" : "native", choice === "off" ? "此网站已停用" : choice === "native" ? "使用网站主题" : wikipediaTheme ? "已自动开启维基百科原生深色" : biliTheme ? "已自动开启 B 站原生深色" : activated ? "已自动开启网站原生深色" : "已识别网站原生深色");
        return;
      }
      const nodes = [root, ...document.body.querySelectorAll("*"), document.body].filter(el => !el.closest(IGNORE));
      const nextMarked = [], assignments = [], rules = [baseRules()];
      const oldMarked = marked;
      // Batch original layout reads. Keep the previous complete theme active
      // until the next complete theme can be committed in one task.
      for (let start = 0; start < nodes.length; start += 180) {
        sheet.media = "not all";
        const batch = nodes.slice(start, start + 180).filter(el => el.isConnected).map(el => [el, declarations(el)]);
        sheet.media = "all";
        for (const [el, css] of batch) {
          if (!css) continue;
          const id = el.getAttribute(MARK) || String(++serial);
          assignments.push([el, id]); nextMarked.push(el);
          rules.push(`html[${STATE}="converted"] [${MARK}="${id}"],html[${STATE}="converted"][${MARK}="${id}"]{${css}}`);
        }
        // Keep the initial shield until the complete initial pass is finished.
        if (start + 180 < nodes.length) await new Promise(requestAnimationFrame);
      }
      const keep = new Set(nextMarked);
      for (const [el, id] of assignments) el.setAttribute(MARK, id);
      sheet.textContent = rules.join("\n");
      for (const el of oldMarked) if (!keep.has(el)) el.removeAttribute(MARK);
      marked = nextMarked;
      setState("converted", choice === "force" ? "强制使用 Night 深色" : "浅色网页已转换为 Night 深色");
    } catch (error) {
      console.warn("Night theme failed:", error);
      clearEngine(); setState("off", "转换失败，已恢复网页");
    } finally {
      if (sheet) sheet.media = "all";
      running = false;
      if (rerun) { rerun = false; schedule(); }
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 100);
  }
  async function initialize() {
    root = document.documentElement;
    if (!root) { setTimeout(initialize, 0); return; }
    setState("pending", reason);
    // JS failsafe complements the CSS failsafe; never leave a permanent mask.
    setTimeout(() => { if (state === "pending") setState("off", "加载保护已超时"); }, 1700);
    sheet = document.createElement("style"); sheet.id = "night-engine";
    root.append(sheet);
    observer = new MutationObserver(records => {
      if (records.some(r => r.target !== sheet && !sheet.contains(r.target) &&
        !(r.type === "attributes" && (r.attributeName === STATE || r.attributeName === MARK)))) schedule();
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-color-mode", "data-dark-theme", "data-bs-theme", "data-mode", "href", "media", "disabled"] });
    try {
      const saved = await api.storage.local.get(["enabled", "sites"]);
      settings = { enabled: saved.enabled !== false, sites: saved.sites || {} };
    } catch { /* Keep local defaults if storage is temporarily unavailable. */ }
    activateBilibiliTheme();
    if (mode() === "off" || mode() === "native") setState(mode() === "off" ? "off" : "native", "使用网站主题");
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.enabled) settings.enabled = changes.enabled.newValue !== false;
      if (changes.sites) settings.sites = changes.sites.newValue || {};
      schedule();
    });
    api.runtime.onMessage.addListener((message, sender, respond) => {
      if (message.type === "night-status") respond({ state, reason, host, mode: mode() });
      return false;
    });
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
    document.addEventListener("load", schedule, true);
    addEventListener("pageshow", schedule);
    addEventListener("popstate", schedule);
    addEventListener("resize", schedule);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", schedule);
    schedule();
  }
  initialize();
})();
