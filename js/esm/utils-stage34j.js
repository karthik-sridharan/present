/* Stage 34J: browser-compatible ES module version of utility helpers.
   Runtime note: optional parity diagnostics; selected modules may also be used by guarded live ESM runtime. */

export function clone(obj){
  return JSON.parse(JSON.stringify(obj));
}

export function escapeHtml(str){
  return String(str == null ? '' : str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

export function escapeAttr(str){
  return escapeHtml(str).replace(/\n/g,'&#10;');
}

export function preserveMathTokens(str){
  var tokens = [];
  var out = String(str == null ? '' : str);
  var patterns = [
    /\$\$[\s\S]+?\$\$/g,
    /\\\[[\s\S]+?\\\]/g,
    /\\\([\s\S]+?\\\)/g,
    /\$(?!\s)[^$\n]+?\$/g
  ];
  patterns.forEach(function(pattern){
    out = out.replace(pattern, function(m){
      var key = '@@MATH' + tokens.length + '@@';
      tokens.push(m);
      return key;
    });
  });
  return { out: out, tokens: tokens };
}

export function restoreMathTokens(str, tokens){
  tokens = tokens || [];
  return String(str).replace(/@@MATH(\d+)@@/g, function(_, i){ return tokens[Number(i)] || ''; });
}

export function hexToRgb(hex){
  var clean = String(hex || '').trim().replace('#','');
  if(!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(clean)) return null;
  var full = clean.length === 3 ? clean.split('').map(function(c){ return c + c; }).join('') : clean;
  var num = parseInt(full, 16);
  return { r:(num>>16)&255, g:(num>>8)&255, b:num&255 };
}

export function rgbaFromHex(hex, alpha){
  var rgb = hexToRgb(hex);
  if(!rgb) return 'rgba(0,0,0,' + alpha + ')';
  return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
}

function finiteNumber(value, fallback){
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}

export function normalizeTheme(theme){
  var t = theme || {};
  return {
    name: t.name || 'Default theme',
    bgColor: t.bgColor || '#ffffff',
    fontColor: t.fontColor || '#111111',
    accentColor: t.accentColor || '#2f6fed',
    panelRadius: finiteNumber(t.panelRadius, 22),
    titleScale: finiteNumber(t.titleScale, 1),
    beamerStyle: t.beamerStyle || 'classic',
    chromeColor: t.chromeColor || '#17365d',
    chromeTextColor: t.chromeTextColor || '#ffffff',
    sidebarWidth: finiteNumber(t.sidebarWidth, 118),
    titleCaps: String(t.titleCaps || '0')
  };
}

export default Object.freeze({
  clone: clone,
  escapeHtml: escapeHtml,
  escapeAttr: escapeAttr,
  preserveMathTokens: preserveMathTokens,
  restoreMathTokens: restoreMathTokens,
  hexToRgb: hexToRgb,
  rgbaFromHex: rgbaFromHex,
  normalizeTheme: normalizeTheme
});
