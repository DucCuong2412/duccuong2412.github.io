/* Shared WebGL player for the portfolio games.
   The builds are gzip-compressed without Unity's "Decompression Fallback", and GitHub Pages
   can't send Content-Encoding for them, so the files are inflated here (DecompressionStream)
   and handed to Unity as blob URLs. Each game page sets window.GAME before loading this. */
(function(){
  var g=window.GAME,base='Build/'+g.build;
  var canvas=document.getElementById('unity-canvas'),loading=document.getElementById('loading'),
      bar=document.getElementById('bar'),msg=document.getElementById('msg');

  function fail(t){loading.hidden=false;loading.classList.add('error');msg.textContent=t;}
  function setProgress(p){bar.style.width=(p*100).toFixed(1)+'%';}

  if(location.protocol==='file:'){fail('Browsers block WebGL games opened straight from disk. Open this page through a web server (GitHub Pages, or "python -m http.server" for local testing).');return;}
  if(!('DecompressionStream' in window)){fail('This browser is too old to run the game. Please update Chrome, Edge, Firefox or Safari.');return;}

  // [file suffix, MIME type of the inflated blob]
  var files=[['.data.gz','application/octet-stream'],['.framework.js.gz','text/javascript'],['.wasm.gz','application/wasm']];
  var loaded=[0,0,0],totals=[0,0,0];
  function downloadProgress(){
    var l=0,t=0;for(var i=0;i<files.length;i++){l+=loaded[i];t+=totals[i];}
    if(t)setProgress(.85*Math.min(l/t,1));
  }

  function get(i){
    return fetch(base+files[i][0]).then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);
      totals[i]=+r.headers.get('content-length')||0;
      var reader=r.body.getReader(),chunks=[];
      function pump(){
        return reader.read().then(function(s){
          if(s.done)return new Blob(chunks);
          chunks.push(s.value);loaded[i]+=s.value.length;downloadProgress();
          return pump();
        });
      }
      return pump();
    }).then(function(blob){
      // If a server ever does send Content-Encoding, fetch has already inflated it: only gunzip real gzip data.
      return blob.slice(0,2).arrayBuffer().then(function(h){
        var b=new Uint8Array(h);
        if(b[0]!==0x1f||b[1]!==0x8b)return blob;
        return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();
      });
    }).then(function(b){return URL.createObjectURL(new Blob([b],{type:files[i][1]}));});
  }

  Promise.all(files.map(function(f,i){return get(i);})).then(function(urls){
    var s=document.createElement('script');
    s.src=base+'.loader.js';
    s.onload=function(){
      createUnityInstance(canvas,{
        dataUrl:urls[0],frameworkUrl:urls[1],codeUrl:urls[2],
        companyName:'DefaultCompany',productName:g.product,productVersion:'1.0',
        // Blob URLs change on every visit, so Unity's IndexedDB cache would only pile up copies.
        cacheControl:function(){return 'no-store';},
        devicePixelRatio:Math.min(window.devicePixelRatio||1,2),
        showBanner:function(t,type){if(type==='error')fail(t);}
      },function(p){setProgress(.85+.15*p);}).then(function(){
        loading.hidden=true;canvas.focus();
      }).catch(function(e){fail(String(e));});
    };
    s.onerror=function(){fail('Could not load the game loader. Please reload the page.');};
    document.body.appendChild(s);
  }).catch(function(e){fail('Could not download the game ('+e.message+'). Please reload the page.');});
})();
