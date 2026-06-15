(function(){
  'use strict';
  var W=window,D=document,STAGE='stage38n-20260427-1';
  var STATUS={stage:STAGE,toolbarPolish:true,inspectorReset:true,selectionAwareInspector:true,modes:['Slide','Text','Figure','Demo','Deck'],mode:'Slide',lastReason:'init',lastUpdatedAt:'',tests:{},pass:false};
  var lastIntent={kind:'Slide',at:0,reason:'init'};
  function byId(id){return D.getElementById(id)}
  function qs(sel,root){return (root||D).querySelector(sel)}
  function qsa(sel,root){return Array.prototype.slice.call((root||D).querySelectorAll(sel))}
  function textOf(el){return String(el && (el.value || el.textContent || el.getAttribute && el.getAttribute('value')) || '').replace(/\s+/g,' ').trim()}
  function clickEl(el){if(el&&typeof el.click==='function'){el.click();return true}return false}
  function setDrawer(open){if(W.LuminaStage38A&&typeof W.LuminaStage38A.setDrawerOpen==='function') W.LuminaStage38A.setDrawerOpen(open!==false);}
  function openTab(tab,subtab){setDrawer(true);setTimeout(function(){clickEl(qs('[data-left-tab-proxy="'+tab+'"]')||qs('[data-left-tab="'+tab+'"]')); if(subtab) clickEl(qs('[data-subtab="'+subtab+'"]'));},0);}
  function runTopAction(action){
    var api=W.LuminaStage38B||W.LuminaStage38C||{};
    if(api&&typeof api.runAction==='function'&&api.runAction(action)!==false) return true;
    var map={add:'addSlideBtn',update:'updateSlideBtn',duplicate:'duplicateSlideBtn'};
    return map[action]?clickEl(byId(map[action])):false;
  }
  function selectedFigure(){
    var p=byId('preview');
    return p && qs('.figure-box.selected,.figure-box[data-stage35z-selected="1"],[data-stage35v-figure-selected="1"]',p);
  }
  function selectedPreviewBlock(){
    var p=byId('preview');
    return p && qs('.preview-block.selected',p);
  }
  function selectedPreviewTitle(){
    var p=byId('preview');
    return p && qs('.preview-title.selected',p);
  }
  function selectedKindFromDom(){
    if(selectedFigure()) return 'Figure';
    var block=selectedPreviewBlock();
    if(block){
      var mode=String(block.dataset.blockMode||'').toLowerCase();
      if(mode==='custom'||mode==='demo'||!!qs('.custom-frame,.custom-frame-wrap,iframe',block)) return 'Demo';
      return 'Text';
    }
    if(selectedPreviewTitle()) return 'Text';
    var label=textOf(byId('previewBlockLabel'));
    if(/custom|demo|html/i.test(label)) return 'Demo';
    if(label && !/^No block selected/i.test(label)) return /figure/i.test(label)?'Figure':'Text';
    return 'Slide';
  }
  function inferKind(){
    var now=Date.now();
    if(lastIntent.kind && now-lastIntent.at<4200) return lastIntent.kind;
    return selectedKindFromDom();
  }
  function setLastIntent(kind,reason){lastIntent={kind:kind,at:Date.now(),reason:reason||'event'}; setMode(kind,reason||'event');}
  function selectedLabel(kind){
    if(kind==='Figure'){
      var fig=selectedFigure();
      if(!fig) return 'No figure selected.';
      var hasSvg=!!(fig.querySelector&&fig.querySelector('svg'));
      return hasSvg?'Selected SVG / diagram figure.':'Selected image / figure.';
    }
    if(kind==='Demo') return textOf(byId('previewBlockLabel')) || 'Selected custom HTML demo.';
    if(kind==='Text') return textOf(byId('previewBlockLabel')) || (selectedPreviewTitle()?'Slide title':'Selected text block.');
    if(kind==='Deck'){
      var count=textOf(byId('deckCount'))||String(qsa('#deckList .deck-item,#deckList .deck-thumb-item').length||'');
      return count?('Deck rail · '+count):'Deck rail and slide order.';
    }
    return textOf(byId('previewTitle')) || 'Current slide.';
  }
  function slideSummary(){
    var title=textOf(byId('previewTitle'))||'Current slide';
    var type=textOf(qs('#slideType option:checked'))||textOf(byId('slideType'))||'Slide';
    var count=textOf(byId('deckCount'))||String(qsa('#deckList .deck-item,#deckList .deck-thumb-item').length||'0');
    return {title:title,type:type,count:count};
  }
  function ensureToolbarPolish(){
    var bar=byId('stage38cTopToolbar')||byId('stage38bTopToolbar');
    if(!bar) return false;
    bar.classList.add('stage38c-toolbar-polished');
    bar.dataset.stage38cToolbarPolished='1';
    var labels={
      add:'Add a new slide',update:'Update current slide from editor fields',duplicate:'Duplicate current slide',
      undo:'Undo last change',redo:'Redo last change',copilot:'Open AI Copilot',edit:'Open slide editor',
      theme:'Open theme controls',present:'Open export controls',advanced:'Open advanced/deck controls',diagnostics:'Copy diagnostics report'
    };
    qsa('[data-stage38c-action],[data-stage38b-action]',bar).forEach(function(btn){
      var action=btn.getAttribute('data-stage38c-action')||btn.getAttribute('data-stage38b-action');
      if(action&&labels[action]){btn.title=labels[action];btn.setAttribute('aria-label',labels[action]);}
    });
    if(!byId('stage38cToolbarSelectionChip')){
      var chip=D.createElement('span');
      chip.id='stage38cToolbarSelectionChip';
      chip.className='stage38c-selection-chip';
      chip.setAttribute('aria-live','polite');
      chip.textContent='Slide';
      var right=qs('.stage38c-toolbar-right',bar)||qs('.stage38b-toolbar-right',bar)||bar;
      right.insertBefore(chip,right.firstChild);
    }
    return true;
  }
  function makeButton(label,attrs,primary){
    var b=D.createElement('button'); b.type='button'; b.textContent=label; if(primary) b.setAttribute('data-primary','1');
    Object.keys(attrs||{}).forEach(function(k){b.setAttribute(k,attrs[k]);});
    return b;
  }
  function card(mode,title,body){
    var c=D.createElement('section');
    c.className='stage38c-inspector-card';
    c.id='stage38cInspectorCard'+mode;
    c.setAttribute('data-stage38c-card',mode);
    c.innerHTML='<h4>'+title+'</h4><p>'+body+'</p>';
    return c;
  }
  function ensureInspector(){
    var panel=qs('#stage38aInspectorColumn .preview-block-props')||qs('.preview-block-props');
    panel=panel&&panel.closest?panel.closest('.panel'):null;
    if(!panel) return false;
    if(panel.dataset.stage38cInspectorReset==='1') return true;
    panel.dataset.stage38cInspectorReset='1';
    panel.classList.add('stage38c-inspector-reset');

    var originalProps=qs('.preview-block-props',panel);
    var head=D.createElement('div');
    head.className='stage38c-inspector-head';
    head.innerHTML='<div><div class="smallcaps">Selection-aware inspector</div><h3 id="stage38cInspectorTitle">Slide</h3><p id="stage38cInspectorHelp">Slide-level summary and quick actions.</p></div><span class="stage38c-inspector-badge" id="stage38cInspectorBadge">Slide</span>';

    var tabs=D.createElement('div');
    tabs.className='stage38c-inspector-tabs';
    tabs.setAttribute('role','tablist');
    STATUS.modes.forEach(function(mode){
      var b=makeButton(mode,{'data-stage38c-mode':mode,'role':'tab','aria-selected':'false'});
      tabs.appendChild(b);
    });

    var cards=D.createElement('div');
    cards.className='stage38c-inspector-cards';

    var slide=card('Slide','Slide','Use this when no object is selected, or when you want slide-level actions.');
    slide.innerHTML+='<div class="stage38c-inspector-kv"><div><span>Title</span><b id="stage38cSlideTitle">Current slide</b></div><div><span>Layout</span><b id="stage38cSlideType">Slide</b></div><div><span>Deck</span><b id="stage38cSlideCount">0 slides</b></div></div><div class="stage38c-action-grid"><button type="button" data-stage38c-action="update" data-primary="1">Update slide</button><button type="button" data-stage38c-open-tab="edit">Slide editor</button><button type="button" data-stage38c-open-tab="styles">Theme</button><button type="button" data-stage38c-action="duplicate">Duplicate</button></div>';

    var text=card('Text','Text','Typography and list controls for the selected slide title or text block.');
    if(originalProps) text.appendChild(originalProps);
    var textNote=D.createElement('div');
    textNote.className='stage38c-mode-note';
    textNote.textContent='Select the title or a preview text block. These controls write back to the same style fields and JSON workflow as before.';
    text.appendChild(textNote);
    var textActions=D.createElement('div');
    textActions.className='stage38c-action-grid';
    textActions.innerHTML='<button type="button" data-stage38c-block-action="update" data-primary="1">Update block</button><button type="button" data-stage38c-block-action="duplicate">Duplicate block</button><button type="button" data-stage38c-block-action="delete" class="danger">Delete block</button><button type="button" data-stage38c-open-tab="edit">Block editor</button>';
    text.appendChild(textActions);

    var fig=card('Figure','Figure','Fast access to the existing figure actions. Single-click a figure in the slide to activate these controls.');
    fig.innerHTML+='<div class="stage38c-figure-status" id="stage38cFigureStatus">No figure selected.</div><div class="stage38c-action-grid"><button type="button" data-stage38c-figure-action="edit" data-primary="1">Edit</button><button type="button" data-stage38c-figure-action="duplicate">Duplicate</button><button type="button" data-stage38c-figure-action="delete" class="danger">Delete block</button><button type="button" data-stage38c-figure-action="front">Bring front</button><button type="button" data-stage38c-figure-action="back">Send back</button><button type="button" data-stage38c-figure-action="crop">Crop</button><button type="button" data-stage38c-figure-action="reset">Reset</button></div><div class="stage38c-action-grid"><button type="button" data-stage38c-figure-action="snap">Snap</button><button type="button" data-stage38c-open-tab="tools">Figure tools</button></div>';

    var demo=card('Demo','Demo','Custom HTML demo blocks stay in the deck, but their editing controls are separated from text styling.');
    demo.innerHTML+='<div class="stage38c-inspector-kv"><div><span>Selected</span><b id="stage38cDemoLabel">Custom HTML demo</b></div><div><span>Sandbox</span><b>iframe srcdoc</b></div></div><div class="stage38c-action-grid"><button type="button" data-stage38c-open-tab="edit" data-primary="1">Open block editor</button><button type="button" data-stage38c-block-action="duplicate">Duplicate block</button><button type="button" data-stage38c-block-action="delete" class="danger">Delete block</button><button type="button" data-stage38c-open-tab="slides">JSON</button><button type="button" data-stage38c-open-tab="copilot">Ask Copilot</button></div><div class="stage38c-mode-note">Detected when the selected preview block is mode <b>custom</b> or contains an embedded demo iframe.</div>';

    var deck=card('Deck','Deck','Deck-level navigation and slide-management actions for the left rail.');
    deck.innerHTML+='<div class="stage38c-inspector-kv"><div><span>Slides</span><b id="stage38cDeckCount">0</b></div><div><span>Rail</span><b>Thumbnail cards</b></div></div><div class="stage38c-action-grid"><button type="button" data-stage38c-action="add" data-primary="1">Add slide</button><button type="button" data-stage38c-action="duplicate">Duplicate</button><button type="button" data-stage38c-open-tab="files">Export / save</button><button type="button" data-stage38c-open-tab="slides">Deck JSON</button></div>';

    [slide,text,fig,demo,deck].forEach(function(x){cards.appendChild(x);});
    panel.insertBefore(head,panel.firstChild);
    panel.insertBefore(tabs,head.nextSibling);
    panel.appendChild(cards);

    panel.addEventListener('click',function(evt){
      var modeBtn=evt.target&&evt.target.closest&&evt.target.closest('[data-stage38c-mode]');
      if(modeBtn){evt.preventDefault();setLastIntent(modeBtn.getAttribute('data-stage38c-mode'),'manual-tab');return;}
      var figBtn=evt.target&&evt.target.closest&&evt.target.closest('[data-stage38c-figure-action]');
      if(figBtn){evt.preventDefault();runFigureAction(figBtn.getAttribute('data-stage38c-figure-action'));return;}
      var blockBtn=evt.target&&evt.target.closest&&evt.target.closest('[data-stage38c-block-action]');
      if(blockBtn){evt.preventDefault();runBlockAction(blockBtn.getAttribute('data-stage38c-block-action'));return;}
      var open=evt.target&&evt.target.closest&&evt.target.closest('[data-stage38c-open-tab]');
      if(open){evt.preventDefault();openTab(open.getAttribute('data-stage38c-open-tab'));return;}
      var act=evt.target&&evt.target.closest&&evt.target.closest('[data-stage38c-action]');
      if(act){evt.preventDefault();runTopAction(act.getAttribute('data-stage38c-action'));return;}
    },true);
    return true;
  }
  function runBlockAction(action){
    var map={update:'updateBlockBtn',duplicate:'duplicateBlockBtn',delete:'deleteBlockBtn'};
    if(action==='edit') return openTab('edit');
    return map[action]?clickEl(byId(map[action])):false;
  }
  function runFigureAction(action){
    var api=W.LuminaStage35ZFigureSelectionActions;
    if(api&&typeof api.runAction==='function') return api.runAction(action);
    var map={duplicate:'duplicateFigureBtn',delete:'deleteSelectedFigureBtn',front:'bringForwardBtn',back:'sendBackwardBtn',crop:'cropFigureBtn',snap:'snapFigureBtn',reset:'resetFigureBtn'};
    if(action==='edit'){
      var btn=byId('stage35vFigureEditButton');
      if(clickEl(btn)) return true;
    }
    return map[action]?clickEl(byId(map[action])):false;
  }
  function updateDetails(kind){
    var s=slideSummary();
    var st=byId('stage38cSlideTitle'); if(st) st.textContent=s.title;
    var ty=byId('stage38cSlideType'); if(ty) ty.textContent=s.type;
    var sc=byId('stage38cSlideCount'); if(sc) sc.textContent=s.count;
    var dc=byId('stage38cDeckCount'); if(dc) dc.textContent=s.count;
    var dl=byId('stage38cDemoLabel'); if(dl) dl.textContent=selectedLabel('Demo');
    var fs=byId('stage38cFigureStatus');
    if(fs){
      var fig=selectedFigure();
      if(fig){
        var r={w:0,h:0};
        try{var br=fig.getBoundingClientRect(); r.w=Math.round(br.width||0); r.h=Math.round(br.height||0);}catch(_e){}
        fs.textContent=(fig.querySelector&&fig.querySelector('svg')?'SVG/diagram figure selected. ':'Figure selected. ')+(r.w&&r.h?('Size '+r.w+'×'+r.h+' px. '):'')+'Use the actions below or the floating palette.';
      } else fs.textContent='No figure selected. Click a figure on the slide.';
    }
  }
  function modeHelp(kind){
    return {
      Slide:'Slide-level summary and quick actions.',
      Text:'Style the selected title or text block.',
      Figure:'Edit, duplicate, crop, snap, or reorder the selected figure.',
      Demo:'Open and update the selected custom HTML demo block.',
      Deck:'Manage the deck rail, slide order, save/export, and raw JSON.'
    }[kind]||'Selection-aware inspector.';
  }
  function setMode(kind,reason){
    if(STATUS.modes.indexOf(kind)<0) kind='Slide';
    STATUS.mode=kind; STATUS.lastReason=reason||STATUS.lastReason||'auto'; STATUS.lastUpdatedAt=new Date().toISOString();
    D.body.setAttribute('data-stage38c-inspector-mode',kind);
    qsa('.stage38c-inspector-tabs [data-stage38c-mode]').forEach(function(b){var on=b.getAttribute('data-stage38c-mode')===kind;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false');});
    qsa('[data-stage38c-card]').forEach(function(c){var on=c.getAttribute('data-stage38c-card')===kind;c.classList.toggle('active',on);c.hidden=!on;});
    var title=byId('stage38cInspectorTitle'); if(title) title.textContent=kind;
    var help=byId('stage38cInspectorHelp'); if(help) help.textContent=modeHelp(kind)+' '+selectedLabel(kind);
    var badge=byId('stage38cInspectorBadge'); if(badge) badge.textContent=kind;
    var chip=byId('stage38cToolbarSelectionChip'); if(chip){chip.textContent=kind;chip.dataset.kind=kind;}
    updateDetails(kind);
    publish();
  }
  function eventIntent(evt){
    var t=evt.target;
    if(!t||!t.closest) return;
    if(t.closest('#stage38aInspectorColumn,.stage38c-inspector-reset,#stage38cTopToolbar,#stage38bTopToolbar')) return;
    if(t.closest('#slideRailShell,#deckList,.stage38a-rail-col')){setLastIntent('Deck','deck-click');return;}
    var p=byId('preview');
    if(p&&p.contains(t)){
      if(t.closest('.figure-box,[data-stage35v-figure-selected],.figure-embed')){setTimeout(function(){setLastIntent('Figure','figure-click');},30);return;}
      var block=t.closest('.preview-block');
      if(block){
        var mode=String(block.dataset.blockMode||'').toLowerCase();
        setTimeout(function(){setLastIntent((mode==='custom'||!!qs('.custom-frame,.custom-frame-wrap,iframe',block))?'Demo':'Text','block-click');},45);
        return;
      }
      if(t.closest('.preview-title')){setTimeout(function(){setLastIntent('Text','title-click');},45);return;}
      setLastIntent('Slide','slide-background-click');
    }
  }
  function runTests(){
    var bar=byId('stage38cTopToolbar')||byId('stage38bTopToolbar');
    var panel=qs('.stage38c-inspector-reset');
    STATUS.tests={
      toolbar:!!bar,
      toolbarPolished:!!(bar&&bar.classList.contains('stage38c-toolbar-polished')),
      selectionChip:!!byId('stage38cToolbarSelectionChip'),
      inspector:!!panel,
      modeTabs:qsa('.stage38c-inspector-tabs [data-stage38c-mode]').length,
      cards:qsa('[data-stage38c-card]').length,
      toolbarWorkspaceModes:qsa('#stage38cTopToolbar [data-stage38c-mode],#stage38bTopToolbar [data-stage38b-mode]').length,
      textPropsStillPresent:!!(panel&&panel.querySelector('.preview-block-props #previewBlockFontScale')),
      figureActions:qsa('[data-stage38c-figure-action]').length,
      canvasFirst:!!byId('stage38aCanvasCenter')
    };
    STATUS.tests.pass=STATUS.tests.toolbar&&STATUS.tests.toolbarPolished&&STATUS.tests.selectionChip&&STATUS.tests.inspector&&STATUS.tests.modeTabs===5&&STATUS.tests.cards===5&&STATUS.tests.textPropsStillPresent&&STATUS.tests.figureActions>=6&&STATUS.tests.canvasFirst;
    STATUS.pass=!!STATUS.tests.pass;
    W.__LUMINA_STAGE38C_TESTS=Object.assign({},STATUS.tests);
    publish();
  }
  function publish(){
    W.__LUMINA_STAGE38C_STATUS=Object.assign({},STATUS,{tests:Object.assign({},STATUS.tests)});
    return W.__LUMINA_STAGE38C_STATUS;
  }
  function patchDiagnostics(){
    var LD=W.LuminaDiagnostics;
    if(!LD||LD.__stage38cInspectorPatched) return;
    var prev=(typeof LD.collectReport==='function'?LD.collectReport.bind(LD):(typeof LD.getReport==='function'?LD.getReport.bind(LD):null));
    if(!prev) return;
    function wrap(){
      var report={};
      try{report=prev()||{};}catch(e){report={stage:STAGE,stage38cPreviousReportError:String(e&&(e.stack||e.message)||e)};}
      runTests();
      report.stage38CToolbarPolishStatus={
        stage:STAGE,
        toolbarPolished:STATUS.tests.toolbarPolished,
        selectionChip:STATUS.tests.selectionChip,
        buttonCount:qsa('#stage38cTopToolbar [data-stage38c-action],#stage38bTopToolbar [data-stage38b-action]').length,
        pass:!!(STATUS.tests.toolbarPolished&&STATUS.tests.selectionChip)
      };
      report.stage38CSelectionAwareInspectorStatus=publish();
      report.stage38CSelectionAwareInspectorDiagnostics={
        activeMode:STATUS.mode,
        modes:STATUS.modes.slice(),
        cards:qsa('[data-stage38c-card]').map(function(c){return c.getAttribute('data-stage38c-card')}),
        textControlsMoved:!!qs('.stage38c-inspector-reset .preview-block-props #previewBlockFontScale'),
        figureActionCount:qsa('[data-stage38c-figure-action]').length,
        inspectorModeTabCount:qsa('.stage38c-inspector-tabs [data-stage38c-mode]').length,
        toolbarWorkspaceModeCount:qsa('#stage38cTopToolbar [data-stage38c-mode],#stage38bTopToolbar [data-stage38b-mode]').length,
        demoCard:!!byId('stage38cInspectorCardDemo'),
        deckCard:!!byId('stage38cInspectorCardDeck')
      };
      return report;
    }
    LD.collectReport=wrap;
    LD.getReport=wrap;
    LD.__stage38cInspectorPatched=true;
  }
  function init(){
    D.body.classList.add('stage38c-polish-inspector-reset');
    ensureToolbarPolish();
    ensureInspector();
    patchDiagnostics();
    setMode(inferKind(),'init');
    runTests();
    D.addEventListener('click',eventIntent,true);
    D.addEventListener('pointerup',function(){setTimeout(function(){setMode(inferKind(),'pointerup-sync');},80);},true);
    D.addEventListener('keyup',function(){setTimeout(function(){setMode(inferKind(),'keyup-sync');},80);},true);
    setInterval(function(){ensureToolbarPolish();ensureInspector();setMode(inferKind(),'interval-sync');runTests();patchDiagnostics();},900);
    setTimeout(function(){ensureToolbarPolish();ensureInspector();setMode(inferKind(),'late-sync');runTests();patchDiagnostics();},1600);
  }
  if(D.readyState==='loading') D.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  W.LuminaStage38C={stage:STAGE,init:init,publishStatus:publish,setInspectorMode:setMode,runFigureAction:runFigureAction,runTests:runTests};
})();
