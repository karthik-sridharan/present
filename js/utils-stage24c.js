/* Lumina Presenter shared utilities.
   This file is intentionally a classic browser script, not an ES module yet.
   It creates window.LuminaUtils so the existing legacy runtime can consume
   helpers without changing the app startup path.
*/
(function(){
  'use strict';

  function clone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function escapeHtml(str){
    return String(str ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function escapeAttr(str){
    return escapeHtml(str).replace(/\n/g,'&#10;');
  }

  function preserveMathTokens(str){
    const tokens = [];
    let out = String(str ?? '');
    const patterns = [
      /\$\$[\s\S]+?\$\$/g,
      /\\\[[\s\S]+?\\\]/g,
      /\\\([\s\S]+?\\\)/g,
      /\$(?!\s)[^$\n]+?\$/g
    ];
    patterns.forEach((pattern)=>{
      out = out.replace(pattern, (m)=>{
        const key = '@@MATH' + tokens.length + '@@';
        tokens.push(m);
        return key;
      });
    });
    return { out, tokens };
  }

  function restoreMathTokens(str, tokens){
    return String(str).replace(/@@MATH(\d+)@@/g, (_, i)=>tokens[Number(i)] ?? '');
  }

  function hexToRgb(hex){
    const clean = String(hex || '').trim().replace('#','');
    if(!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(clean)) return null;
    const full = clean.length === 3 ? clean.split('').map(c=>c+c).join('') : clean;
    const num = parseInt(full, 16);
    return { r:(num>>16)&255, g:(num>>8)&255, b:num&255 };
  }

  function rgbaFromHex(hex, alpha){
    const rgb = hexToRgb(hex);
    if(!rgb) return 'rgba(0,0,0,' + alpha + ')';
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
  }

  function normalizeTheme(theme){
    const t = theme || {};
    return {
      name: t.name || 'Default theme',
      bgColor: t.bgColor || '#ffffff',
      fontColor: t.fontColor || '#111111',
      accentColor: t.accentColor || '#2f6fed',
      panelRadius: Number.isFinite(Number(t.panelRadius)) ? Number(t.panelRadius) : 22,
      titleScale: Number.isFinite(Number(t.titleScale)) ? Number(t.titleScale) : 1,
      beamerStyle: t.beamerStyle || 'classic',
      chromeColor: t.chromeColor || '#17365d',
      chromeTextColor: t.chromeTextColor || '#ffffff',
      sidebarWidth: Number.isFinite(Number(t.sidebarWidth)) ? Number(t.sidebarWidth) : 118,
      titleCaps: String(t.titleCaps || '0')
    };
  }

  window.LuminaUtils = {
    clone,
    escapeHtml,
    escapeAttr,
    preserveMathTokens,
    restoreMathTokens,
    hexToRgb,
    rgbaFromHex,
    normalizeTheme
  };
})();
