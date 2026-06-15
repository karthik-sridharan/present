/* Stage 34J: browser-compatible ES module version of theme/style-builder workflow.
   Runtime note: optional parity diagnostics; selected modules may also be used by guarded live ESM runtime. */

var ROOT = (typeof window !== 'undefined') ? window : globalThis;

function createApi(deps){
    deps = deps || {};
    const themeFields = deps.themeFields || {};
    const normalizeTheme = deps.normalizeTheme;
    const rgbaFromHex = deps.rgbaFromHex;
    const showToast = deps.showToast || function(){};
    const getDocument = deps.getDocument || function(){ return ROOT.document; };
    const buildPreview = deps.buildPreview || function(){};
    const renderDeckList = deps.renderDeckList || function(){};
    const scheduleAutosave = deps.scheduleAutosave || function(){};

    if(typeof normalizeTheme !== 'function'){
      throw new Error('LuminaTheme requires normalizeTheme.');
    }
    if(typeof rgbaFromHex !== 'function'){
      throw new Error('LuminaTheme requires rgbaFromHex.');
    }

    function themeFieldValue(name, fallback=''){
      const el = themeFields[name];
      return el ? el.value : fallback;
    }
    function setThemeFieldValue(name, value){
      const el = themeFields[name];
      if(el) el.value = value;
    }
    function currentThemeFromFields(){
      return normalizeTheme({
        name: themeFieldValue('name', 'Default theme'),
        bgColor: themeFieldValue('bgColor', '#ffffff'),
        fontColor: themeFieldValue('fontColor', '#111111'),
        accentColor: themeFieldValue('accentColor', '#2f6fed'),
        panelRadius: themeFieldValue('panelRadius', '22'),
        titleScale: themeFieldValue('titleScale', '1'),
        beamerStyle: themeFieldValue('beamerStyle', 'classic'),
        chromeColor: themeFieldValue('chromeColor', '#17365d'),
        chromeTextColor: themeFieldValue('chromeTextColor', '#ffffff'),
        sidebarWidth: themeFieldValue('sidebarWidth', '118'),
        titleCaps: themeFieldValue('titleCaps', '0')
      });
    }
    function applyThemeToForm(theme){
      const t = normalizeTheme(theme);
      setThemeFieldValue('name', t.name);
      setThemeFieldValue('bgColor', t.bgColor);
      setThemeFieldValue('fontColor', t.fontColor);
      setThemeFieldValue('accentColor', t.accentColor);
      setThemeFieldValue('panelRadius', String(t.panelRadius));
      setThemeFieldValue('titleScale', String(t.titleScale));
      setThemeFieldValue('beamerStyle', t.beamerStyle);
      setThemeFieldValue('chromeColor', t.chromeColor);
      setThemeFieldValue('chromeTextColor', t.chromeTextColor);
      setThemeFieldValue('sidebarWidth', String(t.sidebarWidth));
      setThemeFieldValue('titleCaps', String(t.titleCaps));
    }
    const DEFAULT_EXPORT_CONTROLS = Object.freeze({
      slides: true,
      draw: false,
      exportAnnotated: false,
      pointerMenu: true,
      generatePdf: true
    });
    function normalizeExportControls(options){
      const src = (options && options.exportControls) || {};
      const legacyDraw = !!(options && options.enableLiveDraw);
      return {
        slides: src.slides !== false,
        draw: legacyDraw || !!src.draw,
        exportAnnotated: legacyDraw || !!src.exportAnnotated,
        pointerMenu: src.pointerMenu !== false,
        generatePdf: src.generatePdf !== false
      };
    }
    function getExportControlElement(doc, key){
      if(!doc) return null;
      const idMap = {
        slides: 'exportControlSlides',
        draw: 'exportControlDraw',
        exportAnnotated: 'exportControlExportAnnotated',
        pointerMenu: 'exportControlPointerMenu',
        generatePdf: 'exportControlGeneratePdf'
      };
      if(doc.getElementById && idMap[key]){
        const byId = doc.getElementById(idMap[key]);
        if(byId) return byId;
      }
      if(doc.querySelector) return doc.querySelector('[data-export-control="' + key + '"]');
      return null;
    }
    function updateExportControlsSummary(doc){
      doc = doc || getDocument();
      const root = (typeof window !== 'undefined') ? window : ROOT;
      if(root && typeof root.LuminaUpdateExportControlsSummary === 'function'){
        try{ root.LuminaUpdateExportControlsSummary(); return; }catch(err){}
      }
      const summary = doc && doc.getElementById ? doc.getElementById('exportControlsSummaryValue') : null;
      if(!summary) return;
      const labels = {slides:'Slides',draw:'Draw',exportAnnotated:'Export annotated',pointerMenu:'Pointer menu',generatePdf:'Generate PDF'};
      const selected = [];
      Object.keys(labels).forEach(function(key){
        const el = getExportControlElement(doc, key);
        if(el && el.checked) selected.push(labels[key]);
      });
      summary.textContent = selected.length ? selected.join(', ') : 'No optional controls';
      summary.title = summary.textContent;
    }
    function currentPresentationOptions(){
      const doc = getDocument();
      const controls = Object.assign({}, DEFAULT_EXPORT_CONTROLS);
      Object.keys(controls).forEach(function(key){
        const el = getExportControlElement(doc, key);
        if(el) controls[key] = !!el.checked;
      });
      updateExportControlsSummary(doc);
      return {
        enableLiveDraw: !!(controls.draw || controls.exportAnnotated),
        exportControls: controls
      };
    }
    function applyPresentationOptions(options){
      const doc = getDocument();
      const controls = normalizeExportControls(options || {});
      Object.keys(controls).forEach(function(key){
        const el = getExportControlElement(doc, key);
        if(el) el.checked = !!controls[key];
      });
      const liveDrawEl = doc && doc.getElementById ? doc.getElementById('enableLiveDrawExport') : null;
      if(liveDrawEl) liveDrawEl.checked = !!(controls.draw || controls.exportAnnotated);
      updateExportControlsSummary(doc);
    }
    function currentStyleClass(){
      const t = currentThemeFromFields();
      return 'style-' + String(t.beamerStyle || 'classic').replace(/[^a-z0-9_-]/gi,'').toLowerCase();
    }
    function buildSlideStyle(slide){
      const theme = currentThemeFromFields();
      const useTheme = slide.inheritTheme !== false;
      let bg = useTheme ? theme.bgColor : (slide.bgColor || theme.bgColor);
      let font = useTheme ? theme.fontColor : (slide.fontColor || theme.fontColor);
      const styleId = String(theme.beamerStyle || 'classic').toLowerCase();
      // Stage 36Y: visual theme presets should control their own canvas even on
      // slides that were previously saved with per-slide colours.
      if(styleId === 'chalkboard'){
        bg = theme.bgColor || '#050807';
        font = theme.fontColor || '#f8fafc';
      } else if(styleId === 'notebook'){
        bg = theme.bgColor || '#fffdf3';
        font = theme.fontColor || '#1f2937';
      }
      const muted = rgbaFromHex(font, 0.72);
      const line = rgbaFromHex(font, 0.14);
      const titleTransform = String(theme.titleCaps) === '1' ? 'uppercase' : 'none';
      const titleLetterSpacing = String(theme.titleCaps) === '1' ? '.04em' : 'normal';
      let extra = '';
      if(styleId === 'berkeley'){
        extra += 'padding-left:calc(3.3rem + ' + theme.sidebarWidth + 'px);';
        extra += 'background-image:linear-gradient(90deg,' + theme.chromeColor + ' 0 ' + theme.sidebarWidth + 'px, transparent ' + theme.sidebarWidth + 'px 100%),linear-gradient(180deg,' + theme.accentColor + ' 0 18px, transparent 18px 100%);';
        extra += 'background-repeat:no-repeat;';
      } else if(styleId === 'madrid'){
        extra += 'padding-top:5rem;padding-bottom:5.2rem;';
        extra += 'background-image:linear-gradient(180deg,' + theme.chromeColor + ' 0 58px, transparent 58px calc(100% - 24px),' + theme.accentColor + ' calc(100% - 24px) 100%);';
        extra += 'background-repeat:no-repeat;';
      } else if(styleId === 'annarbor'){
        extra += 'padding-top:4.8rem;padding-bottom:5rem;';
        extra += 'background-image:linear-gradient(180deg,' + theme.chromeColor + ' 0 64px, transparent 64px calc(100% - 18px),' + theme.accentColor + ' calc(100% - 18px) 100%);';
        extra += 'background-repeat:no-repeat;';
      } else if(styleId === 'cambridgeus'){
        extra += 'padding-top:4.7rem;padding-bottom:5rem;';
        extra += 'background-image:linear-gradient(180deg,transparent 0 56px, transparent 56px calc(100% - 18px),' + theme.chromeColor + ' calc(100% - 18px) 100%),linear-gradient(90deg,' + theme.accentColor + ' 0 18px,' + theme.chromeColor + ' 18px 100%);';
        extra += 'background-size:100% 100%,100% 56px;background-repeat:no-repeat;';
      } else if(styleId === 'pittsburgh'){
        extra += 'padding-top:4.2rem;';
        extra += 'background-image:linear-gradient(180deg,' + theme.chromeColor + ' 0 16px, transparent 16px 100%);';
        extra += 'background-repeat:no-repeat;';
      } else if(styleId === 'notebook'){
        extra += 'font-family:"Comic Sans MS","Comic Sans","Comic Neue",cursive;';
        extra += 'background-image:repeating-linear-gradient(180deg, transparent 0 42px, rgba(55,125,210,.32) 42px 44px, transparent 44px 64px);';
        extra += 'background-repeat:repeat;';
      } else if(styleId === 'chalkboard'){
        extra += 'font-family:"Chalkboard SE","Comic Sans MS","Marker Felt",cursive;';
        extra += 'background-image:radial-gradient(circle at 20% 15%, rgba(255,255,255,.055), transparent 25%),radial-gradient(circle at 80% 75%, rgba(255,255,255,.04), transparent 30%),linear-gradient(135deg, rgba(255,255,255,.025), transparent 45%, rgba(255,255,255,.018));';
        extra += 'text-shadow:0 0 1px rgba(255,255,255,.36);';
      }
      return 'background-color:' + bg + ';color:' + font + ';--text:' + font + ';--muted:' + muted + ';--line:' + line + ';--accent:' + theme.accentColor + ';--radius:' + theme.panelRadius + 'px;--title-scale:' + theme.titleScale + ';--chrome-fill:' + theme.chromeColor + ';--chrome-text:' + theme.chromeTextColor + ';--sidebar-width:' + theme.sidebarWidth + 'px;--title-transform:' + titleTransform + ';--title-letter-spacing:' + titleLetterSpacing + ';' + extra;
    }
    function beamerPresetTheme(name){
      const id = String(name || 'classic').toLowerCase();
      const presets = {
        classic: {name:'Classic', bgColor:'#ffffff', fontColor:'#111111', accentColor:'#2f6fed', panelRadius:22, titleScale:1, beamerStyle:'classic', chromeColor:'#17365d', chromeTextColor:'#ffffff', sidebarWidth:118, titleCaps:'0'},
        berkeley: {name:'Berkeley', bgColor:'#ffffff', fontColor:'#111111', accentColor:'#d4a017', panelRadius:18, titleScale:1, beamerStyle:'berkeley', chromeColor:'#17365d', chromeTextColor:'#ffffff', sidebarWidth:118, titleCaps:'0'},
        madrid: {name:'Madrid', bgColor:'#ffffff', fontColor:'#111111', accentColor:'#2f6fed', panelRadius:20, titleScale:1, beamerStyle:'madrid', chromeColor:'#1f4e79', chromeTextColor:'#ffffff', sidebarWidth:118, titleCaps:'0'},
        annarbor: {name:'AnnArbor', bgColor:'#fffaf0', fontColor:'#2f2410', accentColor:'#7a4f01', panelRadius:18, titleScale:1, beamerStyle:'annarbor', chromeColor:'#c99a06', chromeTextColor:'#111111', sidebarWidth:118, titleCaps:'0'},
        cambridgeus: {name:'CambridgeUS', bgColor:'#ffffff', fontColor:'#10233b', accentColor:'#c53030', panelRadius:16, titleScale:1, beamerStyle:'cambridgeus', chromeColor:'#0f4c81', chromeTextColor:'#ffffff', sidebarWidth:118, titleCaps:'1'},
        pittsburgh: {name:'Pittsburgh', bgColor:'#ffffff', fontColor:'#111111', accentColor:'#2f6fed', panelRadius:22, titleScale:1.02, beamerStyle:'pittsburgh', chromeColor:'#2f6fed', chromeTextColor:'#ffffff', sidebarWidth:96, titleCaps:'0'},
        notebook: {name:'Notebook', bgColor:'#fffdf3', fontColor:'#1f2937', accentColor:'#2f6fed', panelRadius:14, titleScale:1.02, beamerStyle:'notebook', chromeColor:'#2f6fed', chromeTextColor:'#ffffff', sidebarWidth:118, titleCaps:'0'},
        chalkboard: {name:'Chalkboard', bgColor:'#050807', fontColor:'#f8fafc', accentColor:'#d1d5db', panelRadius:18, titleScale:1.03, beamerStyle:'chalkboard', chromeColor:'#f8fafc', chromeTextColor:'#050807', sidebarWidth:118, titleCaps:'0'}
      };
      return normalizeTheme(presets[id] || presets.classic);
    }
    function applyStylePreset(name){
      const merged = normalizeTheme({...currentThemeFromFields(), ...beamerPresetTheme(name)});
      applyThemeToForm(merged);
      buildPreview();
      renderDeckList();
      scheduleAutosave('Autosaved after style preset change.');
      showToast('Applied ' + merged.name + ' style.');
    }
    function randomHexColor(){
      const n = Math.floor(Math.random() * 0xffffff);
      return '#' + n.toString(16).padStart(6, '0');
    }
    function applyStyleBuilder(){
      const merged = currentThemeFromFields();
      applyThemeToForm(merged);
      buildPreview();
      renderDeckList();
      scheduleAutosave('Autosaved after style builder update.');
      showToast('Updated master style.');
    }
    function randomizeStyleBuilder(){
      const styles = ['classic','berkeley','madrid','annarbor','cambridgeus','pittsburgh','notebook','chalkboard'];
      setThemeFieldValue('beamerStyle', styles[Math.floor(Math.random() * styles.length)]);
      setThemeFieldValue('chromeColor', randomHexColor());
      setThemeFieldValue('accentColor', randomHexColor());
      setThemeFieldValue('titleCaps', Math.random() > 0.5 ? '1' : '0');
      buildPreview();
      renderDeckList();
      scheduleAutosave('Autosaved after generating style variant.');
      showToast('Generated style variant.');
    }

    return {
      themeFieldValue,
      setThemeFieldValue,
      currentThemeFromFields,
      applyThemeToForm,
      currentPresentationOptions,
      applyPresentationOptions,
      currentStyleClass,
      buildSlideStyle,
      beamerPresetTheme,
      applyStylePreset,
      randomHexColor,
      applyStyleBuilder,
      randomizeStyleBuilder
    };
  }

export { createApi };
export default Object.freeze({ createApi: createApi });
