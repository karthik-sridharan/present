(function(){
  'use strict';
  var W = window, D = document, STAGE = 'stage38n-20260427-1';
  function qs(sel,root){ return (root||D).querySelector(sel); }
  function qsa(sel,root){ return Array.prototype.slice.call((root||D).querySelectorAll(sel)); }
  function px(value){ var n = parseFloat(value || '0'); return isFinite(n) ? n : 0; }
  function status(){
    var rail = qs('#slideRailShell');
    var deck = qs('#deckList');
    var outline = qs('#stage35n-deck-outline-panel');
    var visibleActions = qsa('#deckList .stage38e-rail-actions').filter(function(el){ return getComputedStyle(el).display !== 'none'; });
    var deckStyle = deck ? getComputedStyle(deck) : null;
    var firstThumb = qs('#deckList .deck-thumb');
    var firstItem = qs('#deckList .deck-thumb-item');
    var outlineHidden = !outline || getComputedStyle(outline).display === 'none';
    var thumbWidth = firstThumb ? Math.round(firstThumb.getBoundingClientRect().width) : 0;
    var itemMinHeight = firstItem ? px(getComputedStyle(firstItem).minHeight) : 0;
    var gap = deckStyle ? px(deckStyle.gap || deckStyle.rowGap) : 0;
    var pass = !!(rail && deck && outlineHidden && gap <= 6 && (!firstThumb || thumbWidth <= 92) && (!firstItem || itemMinHeight <= 74));
    return {
      stage: STAGE,
      railDeclutter: true,
      outlinePanelPreserved: !!outline,
      outlineHiddenInRail: outlineHidden,
      thumbnailRailCompact: !!(deck && gap <= 6),
      deckGapPx: gap,
      thumbWidthPx: thumbWidth,
      itemMinHeightPx: itemMinHeight,
      visibleRailActionBars: visibleActions.length,
      totalRailActionBars: qsa('#deckList .stage38e-rail-actions').length,
      activeOnlyActions: visibleActions.length <= 1,
      safeCommandDeckSyncPreserved: !!(W.__LUMINA_STAGE38I_SAFE_DECK_SYNC && W.__LUMINA_STAGE38I_SAFE_DECK_SYNC.safeCommandDeckSync),
      tests: {
        slideRail: !!rail,
        deckList: !!deck,
        outlineHiddenInRail: outlineHidden,
        compactGap: gap <= 6,
        compactThumb: !firstThumb || thumbWidth <= 92,
        compactItem: !firstItem || itemMinHeight <= 74,
        pass: pass
      },
      pass: pass
    };
  }
  function publish(){ W.__LUMINA_STAGE38J_RAIL_DECLUTTER = status(); return W.__LUMINA_STAGE38J_RAIL_DECLUTTER; }
  function patchDiagnostics(){
    var LD = W.LuminaDiagnostics;
    if(!LD || LD.__stage38jRailDeclutterPatched) return false;
    var prev = (typeof LD.collectReport === 'function' ? LD.collectReport.bind(LD) : (typeof LD.getReport === 'function' ? LD.getReport.bind(LD) : null));
    if(!prev) return false;
    function wrap(){
      var report = {};
      try { report = prev() || {}; } catch(e) { report = { stage: STAGE, stage38jPreviousReportError: String(e && (e.stack || e.message) || e) }; }
      var st = publish();
      report.stage38JRailDeclutterStatus = st;
      report.stage38JRailDeclutterDiagnostics = {
        outlinePanelDisplay: qs('#stage35n-deck-outline-panel') ? getComputedStyle(qs('#stage35n-deck-outline-panel')).display : 'missing',
        deckGapPx: st.deckGapPx,
        thumbWidthPx: st.thumbWidthPx,
        itemMinHeightPx: st.itemMinHeightPx,
        visibleRailActionBars: st.visibleRailActionBars,
        totalRailActionBars: st.totalRailActionBars
      };
      return report;
    }
    LD.collectReport = wrap;
    LD.getReport = wrap;
    LD.__stage38jRailDeclutterPatched = true;
    return true;
  }
  function init(){ publish(); patchDiagnostics(); [120,360,900,1800,3200].forEach(function(ms){ setTimeout(function(){ publish(); patchDiagnostics(); }, ms); }); }
  if(D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else init();
  W.LuminaStage38JRailDeclutter = { stage: STAGE, status: status, publish: publish };
})();
