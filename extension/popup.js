const api = globalThis.browser || globalThis.chrome;
const enabled = document.querySelector("#enabled"), mode = document.querySelector("#mode");
let activeTab, host;
async function refreshStatus() {
  try {
    const reply = await api.tabs.sendMessage(activeTab.id, { type: "night-status" }, { frameId: 0 });
    document.querySelector("#status").textContent = reply.reason;
    document.querySelector("#dot").style.background = reply.state === "off" ? "#8b949e" : "#3fb950";
  } catch { document.querySelector("#status").textContent = "刷新网页后生效，或检查网站访问权限"; }
}
async function saveSite() {
  try {
    mode.disabled = true;
    const { sites = {} } = await api.storage.local.get("sites");
    if (mode.value === "auto") delete sites[host]; else sites[host] = mode.value;
    await api.storage.local.set({ sites });
    setTimeout(refreshStatus, 350);
  } catch { document.querySelector("#status").textContent = "设置未保存，请重试"; }
  finally { mode.disabled = !host; }
}
enabled.addEventListener("change", async () => {
  try { await api.storage.local.set({ enabled: enabled.checked }); setTimeout(refreshStatus, 350); }
  catch { document.querySelector("#status").textContent = "设置未保存，请重试"; }
});
mode.addEventListener("change", saveSite);
(async () => {
  try {
    const saved = await api.storage.local.get(["enabled", "sites"]);
    enabled.checked = saved.enabled !== false;
    [activeTab] = await api.tabs.query({ active: true, currentWindow: true });
    const url = new URL(activeTab.url);
    if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported page");
    host = url.hostname;
    mode.disabled = false;
    document.querySelector("#host").textContent = host;
    mode.value = saved.sites?.[host] || "auto";
    await refreshStatus();
  } catch {
    mode.disabled = true;
    document.querySelector("#status").textContent = "请打开一个普通网页，再使用 Night";
  }
})();
