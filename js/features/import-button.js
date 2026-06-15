(function(){
  var W=window,D=document,STAGE='stage43an-rate-limit-backoff-chunked-image-blob-20260517-1';
  var awaitingFilePick=false;
  function toast(msg){
    try{ if(typeof W.showToast==='function'){ W.showToast(msg); return; } }catch(_e){}
    try{ var t=D.getElementById('toast'); if(t){ t.textContent=msg; t.classList.add('show'); setTimeout(function(){t.classList.remove('show')},2800); } }catch(_e){}
  }
  function getApi(){
    return W.__LUMINA_STAGE41T_FILE_IO_API || W.__LUMINA_FILE_IO_API || W.LuminaStage41TFileIoApi || null;
  }
  function setButtonBusy(btn,busy){
    if(!btn) return;
    btn.disabled=!!busy;
    btn.classList.toggle('stage41t-import-busy',!!busy);
    if(busy) btn.dataset.stage41tBusy='1';
    else delete btn.dataset.stage41tBusy;
  }
  function setAwaitingFile(btn,waiting){
    awaitingFilePick=!!waiting;
    if(btn) btn.classList.toggle('stage42r-awaiting-file',!!waiting);
    W.__LUMINA_STAGE42R_IMPORT_AWAITING_FILE=!!waiting;
  }
  async function runImport(e, opts){
    opts=opts||{};
    if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); }
    var btn=D.getElementById('importFilesBtn');
    var input=D.getElementById('importFilesInput');
    var files=input&&input.files?input.files:[];
    var api=getApi();
    var status={stage:STAGE,clickedAt:new Date().toISOString(),fileCount:files.length,apiReady:!!(api&&api.importSelectedFiles),trigger:opts.trigger||'button'};
    W.__LUMINA_STAGE41T_LAST_IMPORT_CLICK=status;
    W.__LUMINA_STAGE42R_LAST_IMPORT_CLICK=status;
    if(!api||typeof api.importSelectedFiles!=='function'){
      var msg='Import system is not ready yet. Wait a moment, then tap Import again. If this repeats, reload with the newest stage URL.';
      status.error=msg; toast(msg); alert(msg); return false;
    }
    if(!files.length){
      status.waitingForFile=true;
      setAwaitingFile(btn,true);
      toast('Choose a PDF/PPT/image/text file to import.');
      try{ if(input&&typeof input.showPicker==='function') input.showPicker(); else if(input&&typeof input.click==='function') input.click(); }catch(err){ status.filePickerError=err&&err.message?err.message:String(err); }
      setTimeout(function(){
        var fresh=D.getElementById('importFilesInput');
        if(fresh&&fresh.files&&fresh.files.length){ runImport(null,{trigger:'file-picker-delay'}); }
      },450);
      return false;
    }
    setAwaitingFile(btn,false);
    setButtonBusy(btn,true);
    toast('Importing '+files.length+' file'+(files.length===1?'':'s')+'…');
    try{
      await api.importSelectedFiles(files);
      status.ok=true; status.finishedAt=new Date().toISOString();
      toast('Import finished.');
    }catch(err){
      var m=err&&err.message?err.message:String(err||'Import failed.');
      status.ok=false; status.error=m; status.finishedAt=new Date().toISOString();
      alert(m||'Could not import selected files.');
    }finally{
      setButtonBusy(btn,false);
    }
    return false;
  }
  function updateFileLabel(){
    var btn=D.getElementById('importFilesBtn');
    var input=D.getElementById('importFilesInput');
    var count=input&&input.files?input.files.length:0;
    if(btn){
      btn.textContent=count?'Import '+count+' selected file'+(count===1?'':'s'):'Choose / import files';
      btn.title=count?'Import the selected file(s)':'Open file picker, then import the selected file(s)';
    }
  }
  function bind(){
    W.LUMINA_STAGE=STAGE; W.LUMINA_STAGE_SIGNATURE='index-inline-'+STAGE;
    try{ D.documentElement.setAttribute('data-lumina-stage',STAGE); D.documentElement.setAttribute('data-lumina-stage-signature','index-inline-'+STAGE); }catch(_e){}
    var btn=D.getElementById('importFilesBtn');
    var input=D.getElementById('importFilesInput');
    if(btn&&!btn.__luminaStage42RBound){
      btn.__luminaStage42RBound=true;
      btn.addEventListener('click',function(e){ return runImport(e,{trigger:'button'}); },true);
      btn.dataset.stage41tImportRescue='1';
      btn.dataset.stage42rImportRescue='1';
    }
    if(input&&!input.__luminaStage42RBound){
      input.__luminaStage42RBound=true;
      input.addEventListener('change',function(){
        updateFileLabel();
        if(awaitingFilePick&&input.files&&input.files.length){ runImport(null,{trigger:'file-input-change'}); }
      },true);
    }
    updateFileLabel();
    W.__LUMINA_STAGE41T_IMPORT_BUTTON_RESCUE={stage:STAGE,bound:!!btn,boundAt:new Date().toISOString(),buttonId:'importFilesBtn',fileInput:!!input,oneTapPicker:true};
    W.__LUMINA_STAGE42R_IMPORT_BUTTON_RESCUE=W.__LUMINA_STAGE41T_IMPORT_BUTTON_RESCUE;
  }
  function init(){ bind(); [80,200,500,1000,2000,4000].forEach(function(ms){ setTimeout(bind,ms); }); }
  W.LuminaStage42RRunImport=runImport;
  if(D.readyState==='loading') D.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
