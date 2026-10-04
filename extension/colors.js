/* Shared pure color helpers. No networking, eval, or dependencies. */
(function (scope) {
  const palette = Object.freeze({
    canvas: "#0d1117", panel: "#161b22", raised: "#21262d",
    text: "#e6edf3", muted: "#8b949e", border: "#30363d",
    link: "#4493f8", red: "#f85149", green: "#3fb950", amber: "#d29922"
  });
  function parse(value) {
    if (!value || value === "transparent") return [0, 0, 0, 0];
    const hex = value.match(/^#([\da-f]{6})$/i);
    if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
    const match = value.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return null; // Unsupported wide-gamut colors are left alone.
    const parts = match[1].replace(/\//g, " ").split(/[,\s]+/).filter(Boolean);
    const rgb = parts.slice(0, 3).map(s => s.endsWith("%") ? parseFloat(s) * 2.55 : Number(s));
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : Number(parts[3]);
    return [...rgb, alpha].every(Number.isFinite) ? [...rgb, alpha] : null;
  }
  function luminance(rgb) {
    const c = rgb.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }
  function composite(top, bottom) {
    return top.slice(0, 3).map((v, i) => v * top[3] + bottom[i] * (1 - top[3])).concat(1);
  }
  function foreground(rgb, link = false) {
    if (!rgb || rgb[3] === 0) return null;
    if (luminance(rgb) >= .35) return null;
    const [r, g, b] = rgb, spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (spread > 45) {
      if (r > g * 1.4 && r > b * 1.3) return palette.red;
      if (g > r * 1.2 && g > b * 1.1) return palette.green;
      if (r > b * 1.5 && g > b * 1.2) return palette.amber;
      return palette.link;
    }
    return Math.max(r, g, b) >= 95 ? palette.muted : palette.text;
  }
  scope.NightColors = { palette, parse, luminance, contrast, composite, foreground };
  if (typeof module !== "undefined") module.exports = scope.NightColors;
})(globalThis);
