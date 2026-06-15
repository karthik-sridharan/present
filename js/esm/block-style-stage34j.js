/* Stage 34J: browser-compatible ES module version of block/title style helpers. */

function fallbackEscapeAttr(str){
  return String(str == null ? '' : str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;')
    .replace(/\n/g,'&#10;');
}

function finiteNumber(value, fallback){
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}

function contains(list, value){
  return list.indexOf(value) >= 0;
}

function normalizeFontSize(value){
  if(value === undefined || value === null || value === '') return '';
  var raw = String(value).trim();
  var n = Number(raw.replace(/px$/i, ''));
  if(isFinite(n)) return Math.max(8, Math.min(120, n)) + 'px';
  if(/^\d+(?:\.\d+)?(?:px|rem|em|pt)$/i.test(raw)) return raw;
  return '';
}

export function createApi(deps){
  deps = deps || {};
  var escapeAttr = deps.escapeAttr || fallbackEscapeAttr;

  function normalizeBlockStyle(style){
    var s = style || {};
    var fontScale = finiteNumber(s.fontScale, 1);
    return {
      fontScale: Math.max(0.6, Math.min(2.5, fontScale)),
      fontSize: normalizeFontSize(s.fontSize),
      fontFamily: s.fontFamily || 'inherit',
      fontColor: s.fontColor || '#111111',
      bulletType: s.bulletType || 'disc'
    };
  }

  function normalizeAnimation(anim){
    var a = anim || {};
    var buildIn = contains(['none','appear','fade'], a.buildIn) ? a.buildIn : 'none';
    var buildOut = contains(['none','disappear','fade'], a.buildOut) ? a.buildOut : 'none';
    var stepMode = contains(['all','by-item'], a.stepMode) ? a.stepMode : 'all';
    var order = finiteNumber(a.order, 0);
    return { buildIn: buildIn, buildOut: buildOut, stepMode: stepMode, order: order };
  }

  function animationDataAttrs(anim){
    var a = normalizeAnimation(anim);
    return ' data-build-in="' + escapeAttr(a.buildIn) + '" data-build-out="' + escapeAttr(a.buildOut) + '" data-step-mode="' + escapeAttr(a.stepMode) + '" data-anim-order="' + escapeAttr(String(a.order)) + '"';
  }

  function blockWrapperStyle(block){
    var s = normalizeBlockStyle((block && block.style) || {});
    return '--block-font-scale:' + s.fontScale + ';' + (s.fontSize ? '--block-font-size:' + escapeAttr(s.fontSize) + ';font-size:' + escapeAttr(s.fontSize) + ';' : '') + '--block-font-family:' + escapeAttr(s.fontFamily) + ';--block-font-color:' + s.fontColor + ';--block-bullet-type:' + s.bulletType + ';';
  }

  function titleWrapperStyle(style, heading){
    var s = normalizeBlockStyle(style || {});
    var baseMap = { h1:'5.6rem', h2:'3.1rem', h3:'2.45rem', h4:'2.1rem', h5:'1.8rem', h6:'1.55rem' };
    return '--block-font-scale:' + s.fontScale + ';' + (s.fontSize ? '--block-font-size:' + escapeAttr(s.fontSize) + ';font-size:' + escapeAttr(s.fontSize) + ';' : '') + '--block-font-family:' + escapeAttr(s.fontFamily) + ';--block-font-color:' + s.fontColor + ';--title-base-size:' + (baseMap[String(heading || 'h2').toLowerCase()] || '3.1rem') + ';';
  }

  return {
    normalizeBlockStyle: normalizeBlockStyle,
    normalizeAnimation: normalizeAnimation,
    animationDataAttrs: animationDataAttrs,
    blockWrapperStyle: blockWrapperStyle,
    titleWrapperStyle: titleWrapperStyle
  };
}

export default Object.freeze({ createApi: createApi });
