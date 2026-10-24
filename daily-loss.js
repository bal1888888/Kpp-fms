/* Read-only daily loss metrics shared by Dashboard, Daily and copied reports. */
(function(root){
  'use strict';
  const code=v=>String(v||'').trim().toUpperCase();
  const wh=v=>code(v).replace(/^WH\s*/,'').replace(/\s+/g,'');
  const number=v=>v===null||v===undefined||String(v).trim()===''?null:(Number.isFinite(Number(v))?Number(v):null);
  const shift=v=>Number(String(v||'').replace(/^shift\s*/i,''));
  const rounded=v=>Math.round((v+Number.EPSILON)*1000000)/1000000;
  const fmt=v=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(v);
  const dateLabel=date=>String(date||'').split('-').reverse().join('/');
  const incomplete=()=>({status:'incomplete',qty:null,percent:null,note:'Belum lengkap'});
  function metric(qty,base){return {status:'complete',qty:rounded(qty),percent:base>0?rounded(qty/base*100):null,note:base>0?'':'Dasar persentase 0 L'};}
  function unavailable(date,message){return {date,supply:{...incomplete(),note:message},working:{...incomplete(),note:message}};}
  function calculate({date,openings=[],closings=[],movements=[],fuels=[],master=[]}){
    // Caller loads one operational date, retaining shift 1 and shift 2.
    const onDate=rows=>rows.filter(r=>!r.tanggal||r.tanggal===date);
    openings=onDate(openings);closings=onDate(closings);movements=onDate(movements);
    fuels=onDate(fuels).filter(r=>r.duplicate_of_id==null);
    const receipts=movements.filter(r=>r.jenis==='RECEIPT');
    let supplyLoss=0,supplyBase=0,supplyComplete=true;
    for(const r of receipts){
      let supplied=number(r.transporter_measured_qty);
      if(supplied===null){
        const start=number(r.meter_start_liter),end=number(r.meter_end_liter);
        if(start!==null&&end!==null&&end>=start)supplied=end-start;
      }
      const received=number(r.destination_measured_qty);
      if(supplied===null||supplied<=0||received===null||received<0){supplyComplete=false;continue;}
      supplyLoss+=supplied-received;supplyBase+=supplied;
    }
    const supply=!receipts.length?{status:'empty',qty:0,percent:null,note:'Tidak ada penerimaan'}:
      supplyComplete?metric(supplyLoss,supplyBase):incomplete();
    let workingLoss=0,usage=0,complete=true;
    const dailyStorages=new Set([...openings,...closings].map(r=>code(r.storage)));
    if([...openings,...closings,...movements,...fuels].some(r=>![1,2].includes(shift(r.shift))))complete=false;
    for(const sh of [1,2]){
      const os=openings.filter(r=>shift(r.shift)===sh),cs=closings.filter(r=>shift(r.shift)===sh);
      const balances=new Map(),physical=new Map();
      for(const r of os){const key=code(r.storage),qty=number(r.qty);
        if(!key||qty===null||qty<0||balances.has(key)){complete=false;continue;}
        balances.set(key,qty);
      }
      for(const r of cs){const key=code(r.storage),qty=number(r.actual_qty);
        if(!key||qty===null||qty<0||physical.has(key)){complete=false;continue;}
        physical.set(key,qty);
      }
      if(!balances.size||balances.size!==physical.size||[...dailyStorages].some(storage=>!balances.has(storage)||!physical.has(storage)))complete=false;
      const change=(storage,qty,sign)=>{
        const key=code(storage);
        if(qty===null||qty<0||!balances.has(key)){complete=false;return;}
        balances.set(key,balances.get(key)+sign*qty);
      };
      for(const r of movements.filter(r=>shift(r.shift)===sh)){
        if(r.jenis==='RECEIPT')change(r.destination_storage,number(r.destination_measured_qty??r.qty),1);
        else if(r.jenis==='TRANSFER'){
          change(r.source_storage,number(r.source_measured_qty??r.qty),-1);
          change(r.destination_storage,number(r.destination_measured_qty??r.qty),1);
        }else complete=false;
      }
      for(const r of fuels.filter(r=>shift(r.shift)===sh)){
        let source=code(r.fuel_truck);
        if(!source){
          const matches=master.filter(m=>code(m.storage_type)==='FT'&&wh(r.wh)&&wh(m.warehouse)===wh(r.wh));
          source=matches.length===1?code(matches[0].code):'';
        }
        const qty=number(r.fuel);
        change(source,qty,-1);
        if(qty!==null&&qty>=0)usage+=qty;
      }
      for(const [storage,balance] of balances){
        if(!physical.has(storage))complete=false;
        else workingLoss+=balance-physical.get(storage);
      }
    }
    return {date,supply,working:complete?metric(workingLoss,usage):incomplete()};
  }
  async function readDay(db,table,columns,date){
    const all=[],size=500;
    for(let offset=0;;offset+=size){
      const {data,error}=await db.from(table).select(columns).eq('tanggal',date).order('id',{ascending:true}).range(offset,offset+size-1);
      if(error)throw error;
      const rows=data||[];all.push(...rows);
      if(rows.length<size)return all;
    }
  }
  async function load(db,date,fuels,master){
    const [openings,closings,movements]=await Promise.all([
      readDay(db,'stock_opening','id,tanggal,shift,storage,qty',date),
      readDay(db,'stock_closing','id,tanggal,shift,storage,actual_qty',date),
      readDay(db,'stock_movements','id,tanggal,shift,jenis,qty,source_storage,destination_storage,source_measured_qty,destination_measured_qty,transporter_measured_qty,meter_start_liter,meter_end_liter',date)
    ]);
    return calculate({date,openings,closings,movements,fuels,master});
  }
  function valueText(m){
    if(m.status!=='complete')return m.note;
    const state=m.qty>0?'LOSS':m.qty<0?'GAIN':'BALANCE';
    return `${state} ${fmt(Math.abs(m.qty))} LTR (${m.percent===null?'—':fmt(Math.abs(m.percent))+'%'})`;
  }
  function reportText(result){
    return `LOSS HARIAN (${dateLabel(result.date)} • Shift 1 + 2)\nSUPPLY LOSS = ${valueText(result.supply)}\nWORKING LOSS = ${valueText(result.working)}`;
  }
  function render(host,result){
    if(!host)return;
    const doc=host.ownerDocument;host.replaceChildren();
    const heading=doc.createElement('h3');heading.className='daily-loss-heading';
    heading.textContent=`Loss Harian • ${dateLabel(result.date)} • Shift 1 + 2`;host.appendChild(heading);
    const grid=doc.createElement('div');grid.className='daily-loss-grid';host.appendChild(grid);
    for(const [title,m,note] of [
      ['Supply Loss',result.supply,'Flowmeter transportir − aktual masuk tangki • % dari qty transportir'],
      ['Working Loss',result.working,'Stock sistem − closing fisik • % dari pemakaian harian']
    ]){
      const card=doc.createElement('div');card.className='daily-loss-card';
      card.dataset.state=m.status!=='complete'?'pending':m.qty>0?'loss':m.qty<0?'gain':'balance';
      const label=doc.createElement('div');label.className='daily-loss-label';label.textContent=title;
      const value=doc.createElement('div');value.className='daily-loss-value';value.textContent=valueText(m);
      const detail=doc.createElement('div');detail.className='daily-loss-note';detail.textContent=note;
      card.append(label,value,detail);grid.appendChild(card);
    }
  }
  function pending(host,date,message='Memuat...'){render(host,unavailable(date,message));}
  root.KPPDailyLoss=Object.freeze({calculate,load,reportText,render,pending,unavailable});
})(typeof window==='undefined'?globalThis:window);
