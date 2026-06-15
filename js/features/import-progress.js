(function(){
  var W=window,D=document,STAGE='stage43an-rate-limit-backoff-chunked-image-blob-20260517-1';
  var timer=null;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return ch==='&'?'&amp;':ch==='<'?'&lt;':ch==='>'?'&gt;':ch==='"'?'&quot;':'&#39;'})}
  function elapsed(status){
    var start=status&&status.startedAt?Date.parse(status.startedAt):0;
    if(!start||!isFinite(start)) return '';
    var ms=Math.max(0,Date.now()-start), s=Math.floor(ms/1000), m=Math.floor(s/60); s=s%60;
    return m+':' + String(s).padStart(2,'0');
  }
  function statusTone(status){ if(status&&status.ok===true&&!status.pending)return 'ok'; if(status&&status.ok===false&&!status.pending)return 'error'; return 'pending'; }
  function ensurePanel(status){
    var panel=D.getElementById('stage42sImportProgress');
    if(panel) return panel;
    panel=D.createElement('div'); panel.id='stage42sImportProgress'; panel.setAttribute('role','status'); panel.setAttribute('aria-live','polite');
    panel.innerHTML='<div class="stage42s-head"><div class="stage42s-title">Import progress</div><div class="stage42s-actions"><button type="button" data-stage42s-copy>Copy status</button><button type="button" data-stage42s-close>Close</button></div></div><div data-stage42s-body></div>';
    panel.addEventListener('click',function(ev){
      if(ev.target&&ev.target.closest('[data-stage42s-close]')){ panel.remove(); return; }
      if(ev.target&&ev.target.closest('[data-stage42s-copy]')){
        var text=JSON.stringify(W.__LUMINA_STAGE42S_IMPORT_STATUS||{},null,2);
        if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(function(){});
      }
    });
    D.body.appendChild(panel);
    return panel;
  }
  function render(status){
    status=status||W.__LUMINA_STAGE42S_IMPORT_STATUS||{};
    var panel=ensurePanel(status), body=panel.querySelector('[data-stage42s-body]');
    var tone=statusTone(status);
    panel.classList.toggle('stage42s-ok',tone==='ok'); panel.classList.toggle('stage42s-error',tone==='error');
    var msg=status.message||'Preparing import…';
    var slow='';
    var e=elapsed(status);
    if(status.pending&&e){
      var parts=e.split(':'), secs=(Number(parts[0])||0)*60+(Number(parts[1])||0);
      if(secs>90) slow='<div class="stage42s-sub" style="margin-top:6px">Document AI semantic imports can take a few minutes for 20+ slide PDFs. The page is still waiting for the backend; do not tap Import again unless this fails.</div>';
    }
    var stats='';
    stats+='<div class="stage42s-grid">';
    stats+='<div class="stage42s-stat"><span>Phase</span><b>'+esc(status.phase||'starting')+'</b></div>';
    stats+='<div class="stage42s-stat"><span>Elapsed</span><b>'+esc(e||'—')+'</b></div>';
    stats+='<div class="stage42s-stat"><span>Slides</span><b>'+esc(status.slideCount!=null?status.slideCount:'—')+'</b></div>';
    stats+='<div class="stage42s-stat"><span>HTTP</span><b>'+esc(status.httpStatus!=null?status.httpStatus:'—')+'</b></div>';
    stats+='</div>';
    var detail={phase:status.phase||null,message:status.message||null,endpoint:status.endpoint||null,filename:status.filename||null,extractEngine:status.extractEngine||null,attempt:status.attempt||null,httpStatus:status.httpStatus||null,slideCount:status.slideCount||null,error:status.error||null,responsePreview:status.responsePreview||null,source:status.source||null,meta:status.meta||null,updatedAt:status.updatedAt||null};
    body.innerHTML='<div class="stage42s-card"><div class="stage42s-main">'+esc(msg)+'</div><div class="stage42s-sub">'+esc(status.pending?'Still running…':'Finished')+'</div>'+slow+'</div>'+stats+'<pre class="stage42s-pre">'+esc(JSON.stringify(detail,null,2))+'</pre>';
    var btn=D.getElementById('importFilesBtn'); if(btn) btn.classList.toggle('stage42s-import-visible-busy',!!status.pending);
    if(timer) clearInterval(timer);
    if(status.pending){ timer=setInterval(function(){ render(W.__LUMINA_STAGE42S_IMPORT_STATUS||status); },1000); }
  }
  W.LuminaStage42SUpdateImportPanel=render;
  W.LuminaStage42SOpenImportPanel=function(){ render(W.__LUMINA_STAGE42S_IMPORT_STATUS||{phase:'idle',message:'No import status recorded yet.',pending:false}); };
  try{ W.__LUMINA_STAGE42S_IMPORT_PROGRESS_READY={stage:STAGE,ready:true,at:new Date().toISOString()}; }catch(_e){}
})();
