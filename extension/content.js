(() => {
  "use strict";
  const api = globalThis.browser || globalThis.chrome;
  const C = NightColors;
  const STATE = "data-night-state";
  const IGNORE = "img,video,audio,picture,canvas,svg,iframe,object,embed,script,style,link,meta,noscript";
  let root, observer, timer, running = false, rerun = false;
  let settings = { enabled: true, sites: {} }, state = "pending", reason = "正在识别网页主题";
  const host = location.hostname;
  const mode = () => !settings.enabled ? "off" : settings.sites[host] || "auto";
  const nativeFallback = NightNativeFallback.create(document);
  const nativeThemes = NightNativeTheme.create(document, query => matchMedia(query).matches);
  const darkPreference = matchMedia("(prefers-color-scheme: dark)");
  let siteTheme = null;
  function restoreSiteTheme() {
    if (!siteTheme) return;
    const { added, removed } = siteTheme;
    // If the site's own controls changed the theme, preserve that choice.
    if (root.classList.contains(added)) {
      root.classList.remove(added);
      for (const name of removed) root.classList.add(name);
    }
    siteTheme = null;
  }
  function activateSiteTheme() {
    if (mode() !== "auto" || !darkPreference.matches) return false;
    let added, alternatives;
    if (/(^|\.)wikipedia\.org$/.test(host)) {
      added = "skin-theme-clientpref-night";
      alternatives = ["skin-theme-clientpref-day", "skin-theme-clientpref-os"];
    } else if (host === "www.bilibili.com" && location.pathname === "/" &&
      [...document.scripts].some(s => s.src.includes("/laputa-home/assets/"))) {
      added = "bili_dark";
      alternatives = [];
    } else return false;
    if (root.classList.contains(added)) return false;
    const removed = alternatives.filter(name => root.classList.contains(name));
    for (const name of removed) root.classList.remove(name);
    root.classList.add(added);
    siteTheme = { added, removed };
    if (nativeDark()) return true;
    restoreSiteTheme();
    return false;
  }

  function setState(next, message) {
    state = next; reason = message;
    root?.setAttribute(STATE, next);
  }
  function clearEngine() {
    if (DarkReader.isEnabled()) DarkReader.disable();
  }
  function observe() {
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeOldValue: true,
      attributeFilter: ["class", "style", "data-theme", "data-color-mode", "data-dark-theme", "data-bs-theme", "data-mode", "href", "media", "disabled"] });
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
  async function rebuild() {
    if (running) { rerun = true; return; }
    if (!document.body) return;
    running = true;
    observer.disconnect();
    try {
      nativeFallback.pause();
      const choice = mode();
      const wantsDark = choice === "force" || (choice === "auto" && darkPreference.matches);
      if (!wantsDark || choice !== "auto") {
        nativeThemes.restore();
        restoreSiteTheme();
      }
      if (!wantsDark) {
        nativeFallback.stop();
        clearEngine();
        setState(choice === "native" ? "native" : "off", choice === "off" ? "此网站已停用" : choice === "native" ? "使用网站主题" : "浏览器偏好浅色，保留网站主题");
        return;
      }
      // Force mode needs no native-theme probe or engine restart.
      if (choice === "force" && DarkReader.isEnabled()) {
        nativeFallback.stop();
        setState("converted", "强制使用 Night 深色");
        return;
      }
      // Read the site's original colors without counting our own stylesheet.
      clearEngine();
      let native = false;
      if (choice === "auto") {
        native = nativeDark();
        if (!native) native = activateSiteTheme();
        if (!native) native = !!nativeThemes.tryActivate(nativeDark);
      }

      if (native) {
        clearEngine();
        nativeFallback.start();
        setState("native", "使用网站原生深色，Night 补齐遗漏区域");
        return;
      }
      nativeFallback.stop();
      DarkReader.enable({
        brightness: 100, contrast: 100, sepia: 0,
        darkSchemeBackgroundColor: C.palette.canvas,
        darkSchemeTextColor: C.palette.text,
      }, { disableStyleSheetsProxy: true, disableCustomElementRegistryProxy: true });
      setState("converted", choice === "force" ? "强制使用 Night 深色" : "浅色网页已转换为 Night 深色");
    } catch (error) {
      console.warn("Night theme failed:", error);
      nativeFallback.stop();
      clearEngine(); setState("off", "转换失败，已恢复网页");
    } finally {
      observe();
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
    // Wait for saved policy before showing a loading shield.
    setState("off", "正在读取设置");
    // Keep resource requests subject to normal browser CORS rules in this prototype.
    DarkReader.setFetchMethod(url => fetch(url, { credentials: "omit" }));
    const owned = node => node.nodeType === 1 &&
      (node.matches(".darkreader, #night-preload, #night-native-fallback") || node.closest(".darkreader"));
    function siteStyle(css) {
      const style = document.createElement("span").style;
      style.cssText = css || "";
      return [...style].filter(name => !name.startsWith("--darkreader"))
        .sort().map(name => `${name}:${style.getPropertyValue(name)}:${style.getPropertyPriority(name)}`).join(";");
    }
    observer = new MutationObserver(records => {
      if (records.some(r => {
        if (owned(r.target)) return false;
        if (r.type === "attributes") {
          if (r.attributeName === "style")
            return (r.target === root || r.target === document.body) &&
              siteStyle(r.oldValue) !== siteStyle(r.target.getAttribute("style"));
          return r.target === root || r.target === document.body ||
            r.target.matches("style, link[rel~=stylesheet]");
        }
        // Dark Reader already observes ordinary content and inline-style updates.
        // Night only rechecks theme roots and changes to site stylesheets.
        return r.target.nodeType === 1 && r.target.matches("style") ||
          [...r.addedNodes, ...r.removedNodes].some(n => !owned(n) && n.nodeType === 1 &&
            (n.matches("style, link[rel~=stylesheet], body") ||
              n.querySelector("style, link[rel~=stylesheet]")));
      })) schedule();
    });
    observe();
    try {
      const saved = await api.storage.local.get(["enabled", "sites"]);
      settings = { enabled: saved.enabled !== false, sites: saved.sites || {} };
    } catch { /* Keep local defaults if storage is temporarily unavailable. */ }
    if (mode() === "force" || (mode() === "auto" && darkPreference.matches)) {
      setState("pending", "正在识别网页主题");
      setTimeout(() => { if (state === "pending") setState("off", "加载保护已超时"); }, 1700);
    }
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
    document.addEventListener("load", event => {
      if (!owned(event.target) && event.target.matches?.("link[rel~=stylesheet]")) schedule();
    }, true);
    addEventListener("pageshow", schedule);
    addEventListener("popstate", schedule);
    addEventListener("resize", () => { if (!DarkReader.isEnabled()) schedule(); });
    darkPreference.addEventListener("change", schedule);
    schedule();
  }
  initialize();
})();
