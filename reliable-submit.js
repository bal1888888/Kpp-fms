/* Durable, one-at-a-time requests. No automatic background replay. */
(function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const timeWib=iso=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(iso));
  function create({key,storage,transport,lock,newId,now=()=>new Date().toISOString(),token,onChange=()=>{}}){
    const read=()=>{const value=storage.getItem(key);if(!value)return {};const state=JSON.parse(value);if(state.version!==1)throw Error('Draf tidak dikenali. Hubungi Admin sebelum melanjutkan.');return state;};
    const write=state=>{storage.setItem(key,JSON.stringify({...state,version:1}));onChange();};
    const locked=fn=>lock(key,fn);
    async function execute(state){
      const request=state.request;
      if(!request)return {data:null,error:{message:'Tidak ada permintaan untuk diperiksa.'}};
      if(request.status==='success')return {data:request.result,error:null};
      write({...state,request:{...request,status:'pending'}});
      let response;
      try{
        const payload=clone(request.payload);
        if(token)payload.p_token=token;
        response=await transport({p_request_id:request.id,p_action:request.action,p_payload:payload,p_recorded_at:request.recordedAt});
      }catch(error){response={error:{message:error.message}};}
      // HTTP errors, timeouts and missing responses are ambiguous: keep the SAME request ID.
      if(response.error || !response.data || typeof response.data.ok!=='boolean'){
        write({...state,request:{...request,status:'pending',message:'Hasil belum terkonfirmasi. Gunakan Cek / kirim ulang; jangan membuat pengisian baru.'}});
        return {data:null,error:{message:'Hasil belum terkonfirmasi. Draf aman di perangkat ini. Tekan Cek / kirim ulang.'}};
      }
      if(!response.data.ok){
        write({...state,request:{...request,status:'rejected',message:response.data.message}});
        return {data:null,error:{message:response.data.message}};
      }
      write({request:{...request,status:'success',result:response.data.data,message:'Berhasil tersimpan di server.'}});
      return {data:response.data.data,error:null};
    }
    return {
      read,
      saveDraft:values=>locked(async()=>{const state=read();if(state.request)return;write({...state,draft:clone(values)});}),
      send:(action,payload)=>locked(async()=>{
        const state=read();
        if(state.request)return {data:null,error:{message:'Selesaikan pengiriman sebelumnya di panel Status pengiriman terlebih dahulu.'}};
        const recordedAt=payload.p_observed_at || now();
        const frozen=clone(payload);delete frozen.p_token;
        if('p_jam' in frozen)frozen.p_jam=timeWib(recordedAt);
        const request={id:newId(),action,payload:frozen,recordedAt,status:'pending'};
        write({...state,request});return execute({...state,request});
      }),
      retry:()=>locked(async()=>execute(read())),
      release:()=>locked(async()=>{const state=read();if(state.request?.status==='pending')throw Error('Hasil belum pasti. Periksa pengiriman dahulu.');write(state.request?.status==='success'?{}:{draft:state.draft});})
    };
  }
  function mount({scope,client,host,fields=[],token,restoreAllowed=()=>true,context=()=>null,onSuccess=()=>location.reload()}){
    let busy=false;let manager;let storageError='';
    host.classList.add('delivery-panel');
    host.innerHTML='<strong>Status pengiriman</strong><p role="status" aria-live="polite"></p><div class="delivery-actions"><button type="button" data-action="retry">Cek / kirim ulang</button><button type="button" data-action="restore">Pulihkan isian</button><button type="button" data-action="release">Input berikutnya</button></div>';
    const status=host.querySelector('p');const buttons=Object.fromEntries([...host.querySelectorAll('button')].map(b=>[b.dataset.action,b]));
    function render(){
      let state={};try{state=manager.read();}catch(e){storageError=e.message;}
      const r=state.request;
      status.textContent=storageError || (busy?'Sedang mengirim. Jangan tutup halaman.':r?`${r.status==='success'?'Berhasil':r.status==='rejected'?'Ditolak server':'Belum terkonfirmasi'} · ${r.payload.p_unit || state.draft?.values?.unitInput || ''} · ${timeWib(r.recordedAt)} WIB. ${r.message || 'Gunakan Cek / kirim ulang saat sinyal tersedia.'}`:state.draft?'Draf tersimpan di perangkat ini. Cek/scan unit kembali, lalu pulihkan isian. HM terkunci tetap mengikuti server.':'Isian disimpan di perangkat ini. Tekan simpan saat mencatat kejadian.');
      if(!navigator.onLine)status.textContent+=' Koneksi sedang offline.';
      buttons.retry.hidden=!r || r.status==='success';
      buttons.restore.hidden=!state.draft || !!r;
      buttons.release.hidden=!r || r.status==='pending';
      buttons.release.textContent=r?.status==='success'?'Input berikutnya':'Koreksi draf';
      for(const b of Object.values(buttons))b.disabled=busy||!!storageError;
    }
    manager=create({key:'kpp-delivery-v1:'+scope,storage:localStorage,transport:async p=>{
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
        try{return await client.rpc('submit_reliable',p).abortSignal(controller.signal);}finally{clearTimeout(timer);}
      },token,
      lock:(key,fn)=>{if(!navigator.locks)return Promise.reject(Error('Browser belum mendukung pengiriman aman. Gunakan Chrome/Edge terbaru.'));return navigator.locks.request(key,fn);},
      newId:()=>crypto.randomUUID(),onChange:render});
    async function run(fn){if(busy)return {error:{message:'Pengiriman sedang diproses.'}};busy=true;render();try{return await fn();}catch(e){storageError='Penyimpanan perangkat tidak tersedia: '+e.message;return {error:{message:storageError}};}finally{busy=false;render();}}
    buttons.retry.addEventListener('click',async()=>{const result=await run(()=>manager.retry());if(!result.error)onSuccess(result.data);});
    buttons.release.addEventListener('click',async()=>{const old=manager.read();await run(()=>manager.release());if(old.request?.status==='success')location.reload();});
    buttons.restore.addEventListener('click',()=>{
      const draft=manager.read().draft;if(!draft)return;
      if(!restoreAllowed(draft.context)){status.textContent='Draf berasal dari sesi berbeda. Isian tidak dipindahkan ke shift baru; hubungi Admin/GL.';return;}
      for(const id of fields){const el=document.getElementById(id);if(el && !el.readOnly && !el.disabled && id in draft.values){el.value=draft.values[id];el.dispatchEvent(new Event('input',{bubbles:true}));}}
    });
    const save=()=>{const values={};for(const id of fields){const el=document.getElementById(id);if(el)values[id]=el.value;}manager.saveDraft({values,context:context()}).catch(e=>{storageError='Draf belum tersimpan: '+e.message;render();});};
    for(const id of fields){const el=document.getElementById(id);el?.addEventListener('input',save);el?.addEventListener('change',save);}
    window.addEventListener('online',render);window.addEventListener('offline',render);window.addEventListener('storage',render);
    render();return {send:(action,payload)=>run(()=>manager.send(action,payload)),read:manager.read};
  }
  root.KPPReliable={create,mount,timeWib};
})(globalThis);
