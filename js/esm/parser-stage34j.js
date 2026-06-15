/* Stage 34J: browser-compatible ES module version of structured text parser. */

export function createApi(deps){
  deps = deps || {};
  var preserveMathTokens = deps.preserveMathTokens;
  var restoreMathTokens = deps.restoreMathTokens;
  var escapeHtml = deps.escapeHtml;
  var escapeAttr = deps.escapeAttr;

  if(typeof preserveMathTokens !== 'function') throw new Error('LuminaParser missing dependency: preserveMathTokens');
  if(typeof restoreMathTokens !== 'function') throw new Error('LuminaParser missing dependency: restoreMathTokens');
  if(typeof escapeHtml !== 'function') throw new Error('LuminaParser missing dependency: escapeHtml');
  if(typeof escapeAttr !== 'function') throw new Error('LuminaParser missing dependency: escapeAttr');

  function parseStructuredText(raw, meta){
    var text = String(raw == null ? '' : raw).replace(/\r\n/g, '\n').trim();
    if(!text) return '';
    function safeWithMath(str){
      var p = preserveMathTokens(str);
      return restoreMathTokens(escapeHtml(p.out), p.tokens);
    }
    var lines = text.split('\n');
    var parts = [];
    var paragraph = [];
    var listType = null;
    var listItems = [];
    function flushParagraph(){
      if(!paragraph.length) return;
      var joined = paragraph.join(' ').trim();
      if(joined) parts.push('<p>' + safeWithMath(joined) + '</p>');
      paragraph = [];
    }
    function flushList(){
      if(!listItems.length) return;
      var tag = listType === 'enumerate' ? 'ol' : 'ul';
      parts.push('<' + tag + '>' + listItems.map(function(item){ return '<li>' + safeWithMath(item) + '</li>'; }).join('') + '</' + tag + '>');
      listItems = [];
      listType = null;
    }
    function collectUntil(endPattern, startIndex){
      var chunk = [];
      var i = startIndex;
      while(i < lines.length && !endPattern.test(lines[i].trim())){
        chunk.push(lines[i]);
        i += 1;
      }
      return { body: chunk.join('\n').trim(), endIndex: i };
    }
    function simpleCardBody(body){
      var trimmed = body.trim();
      if(!trimmed) return '';
      return trimmed.split(/\n\s*\n/).map(function(block){ return '<p>' + safeWithMath(block.replace(/\s*\n\s*/g, ' ').trim()) + '</p>'; }).join('');
    }

    for(var i = 0; i < lines.length; i += 1){
      var line = lines[i].trim();
      if(!line){ flushParagraph(); flushList(); continue; }
      var paragraphMatch = line.match(/^\\paragraph\{([\s\S]*)\}$/);
      if(paragraphMatch){ flushParagraph(); flushList(); parts.push('<p>' + safeWithMath(paragraphMatch[1].trim()) + '</p>'); continue; }
      if(/^\\begin\{itemize\}$/i.test(line)){
        flushParagraph(); flushList();
        var items = [];
        i += 1;
        while(i < lines.length && !/^\\end\{itemize\}$/i.test(lines[i].trim())){
          var itemLine = lines[i].trim();
          if(itemLine){
            var itemMatch = itemLine.match(/^\\item\s+([\s\S]*)$/);
            if(itemMatch) items.push(itemMatch[1].trim());
          }
          i += 1;
        }
        parts.push('<ul>' + items.map(function(item){ return '<li>' + safeWithMath(item) + '</li>'; }).join('') + '</ul>');
        continue;
      }
      if(/^\\begin\{enumerate\}$/i.test(line)){
        flushParagraph(); flushList();
        var enumItems = [];
        i += 1;
        while(i < lines.length && !/^\\end\{enumerate\}$/i.test(lines[i].trim())){
          var enumLine = lines[i].trim();
          if(enumLine){
            var enumMatch = enumLine.match(/^\\item\s+([\s\S]*)$/);
            if(enumMatch) enumItems.push(enumMatch[1].trim());
          }
          i += 1;
        }
        parts.push('<ol>' + enumItems.map(function(item){ return '<li>' + safeWithMath(item) + '</li>'; }).join('') + '</ol>');
        continue;
      }
      if(/^\\begin\{equation\}$/i.test(line)){
        flushParagraph(); flushList();
        var collected = collectUntil(/^\\end\{equation\}$/i, i + 1);
        parts.push('<div class="display-math">\\[\\begin{aligned}' + escapeHtml(collected.body) + '\\end{aligned}\\]</div>');
        i = collected.endIndex;
        continue;
      }
      var cardBegin = line.match(/^\\begin\{card\}\{([\s\S]*)\}$/i);
      if(cardBegin){
        flushParagraph(); flushList();
        var cardCollected = collectUntil(/^\\end\{card\}$/i, i + 1);
        parts.push('<div class="bullet-card"><b>' + safeWithMath(cardBegin[1].trim()) + '</b><div>' + simpleCardBody(cardCollected.body) + '</div></div>');
        i = cardCollected.endIndex;
        continue;
      }
      if(/^\\begin\{figurehtml\}$/i.test(line)){
        flushParagraph(); flushList();
        var figCollected = collectUntil(/^\\end\{figurehtml\}$/i, i + 1);
        var figAttrs = meta ? (' data-column="' + escapeAttr(meta.column || '') + '" data-block-index="' + meta.blockIndex + '" data-figure-index="' + (meta.figureIndex++) + '"') : '';
        parts.push('<div class="figure-embed"' + figAttrs + '>' + figCollected.body + '</div>');
        i = figCollected.endIndex;
        continue;
      }
      if(/^UL:/i.test(line)){ flushParagraph(); if(listType && listType !== 'itemize') flushList(); listType = 'itemize'; listItems.push(line.replace(/^UL:/i, '').trim()); continue; }
      if(line.indexOf('- ') === 0){ flushParagraph(); if(listType && listType !== 'itemize') flushList(); listType = 'itemize'; listItems.push(line.slice(2).trim()); continue; }
      flushList();
      if(line.indexOf('### ') === 0){ flushParagraph(); parts.push('<h3>' + safeWithMath(line.slice(4).trim()) + '</h3>'); continue; }
      if(/^P:/i.test(line)){ flushParagraph(); parts.push('<p>' + safeWithMath(line.replace(/^P:/i, '').trim()) + '</p>'); continue; }
      if(/^EQ:/i.test(line)){ flushParagraph(); parts.push('<div class="display-math">' + safeWithMath(line.replace(/^EQ:/i, '').trim()) + '</div>'); continue; }
      if(/^CARD:/i.test(line)){
        flushParagraph();
        var payload = line.replace(/^CARD:/i, '').trim();
        var pieces = payload.split('|');
        var cardTitle = pieces.shift() || '';
        var cardBody = pieces.join('|');
        parts.push('<div class="bullet-card"><b>' + safeWithMath(cardTitle) + '</b><div><p>' + safeWithMath(cardBody) + '</p></div></div>');
        continue;
      }
      if((/^\\\([\s\S]+\\\)$/).test(line)){ flushParagraph(); parts.push('<div class="display-math">\\[' + escapeHtml(line.replace(/^\\\(/, '').replace(/\\\)$/, '')) + '\\]</div>'); continue; }
      if((/^\\\[[\s\S]+\\\]$/).test(line) || (/^\$\$[\s\S]+\$\$$/).test(line)){ flushParagraph(); parts.push('<div class="display-math">' + safeWithMath(line) + '</div>'); continue; }
      paragraph.push(line);
    }
    flushParagraph(); flushList();
    return parts.join('\\n');
  }

  return { parseStructuredText: parseStructuredText };
}

export default Object.freeze({ createApi: createApi });
