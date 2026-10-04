const root = document.documentElement;
const testCase = new URLSearchParams(location.search).get("case") || "light";
root.dataset.case = testCase;
document.querySelector("#case").textContent = testCase;
if (testCase === "native") root.dataset.darkTheme = "dark";
if (testCase === "delayed") setTimeout(() => { root.dataset.darkTheme = "dark"; }, 750);
document.querySelector("#toggle").onclick = () => { root.dataset.darkTheme = root.dataset.darkTheme === "dark" ? "light" : "dark"; };
document.querySelector("#add").onclick = () => {
  const card = document.createElement("article"); card.className = "card";
  card.innerHTML = "<h2>动态加入的卡片</h2><p>这个组件在页面加载完成后才出现，也需要正确处理。</p>";
  document.querySelector("#cards").append(card);
};
const image = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="140"><rect width="280" height="140" fill="#ffffff"/><rect width="93" height="140" fill="#ef4444"/><rect x="93" width="94" height="140" fill="#22c55e"/><rect x="187" width="93" height="140" fill="#3b82f6"/></svg>`;
document.querySelector("#photo").src = "data:image/svg+xml," + encodeURIComponent(image);
const ctx = document.querySelector("#canvas").getContext("2d");
["#ef4444", "#22c55e", "#3b82f6"].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * 94, 0, 94, 140); });
if (testCase === "large") for (let i = 0; i < 100; i++) document.querySelector("#add").click();
