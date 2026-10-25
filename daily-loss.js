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
  function metric(qty,base){return {status:'complete',qty:rounded(qty),percent:base>0?rounded(qty/base*100):null,base,note:base>0?'':'Dasar persentase 0 L'};}
  function unavailable(date,message){return {date,supply:{...incomplete(),note:message},working:{...incomplete(),note:message}};}

  // DO is counted ONCE per transportir + reference, even when posted to several storages.
  // Supply signed variance: total actual flow - DO; positive is GAIN.
  function calculateSupplyDO(movements=[]){
    const receipts=movements.filter(r=>r.jenis==='RECEIPT');
    if(!receipts.length)return {status:'empty',qty:0,percent:null,note:'Tidak ada penerimaan'};
    const groups=new Map();
    let invalid=0;
    for(const row of receipts){
      const document=code(row.document_reference);
      const transporter=code(row.transporter).replace(/[^A-Z0-9]/g,'');
      const doQty=number(row.do_qty_liter);
      const flow=number(row.transporter_measured_qty);
      if(!document||!transporter||![10000,16000,24000].includes(doQty) || flow===null || flow<=0 || row.do_final==null || row.calculation_method!=='RECEIPT_FLOWMETER_DO'){
        invalid++;
        continue;
      }
      const key=transporter+'|'+document;
      if(!groups.has(key))groups.set(key,{doQty,flow:0,final:0,consistent:true});
      const group=groups.get(key);
      if(group.doQty!==doQty)group.consistent=false;
      group.flow+=flow;
      if(row.do_final===true)group.final++;
    }
    const unfinished=[...groups.values()].filter(g=>!g.consistent||g.final!==1).length;
    if(invalid||unfinished)return {...incomplete(),note:'Belum lengkap: '+invalid+' transaksi tanpa DO baru; '+unfinished+' DO belum selesai/berbeda'};
    const all=[...groups.values()];
    const totalFlow=all.reduce((n,g)=>n+g.flow,0);
    const totalDo=all.reduce((n,g)=>n+g.doQty,0);
    return {...metric(totalFlow-totalDo,totalDo),sign:'actual-minus-do'};
  }
  function calculate({date,openings=[],closings=[],movements=[],fuels=[],master=[]}){
    // Caller loads one operational date, retaining shift 1 and shift 2.
    const onDate=rows=>rows.filter(r=>!r.tanggal||r.tanggal===date);
    openings=onDate(openings);closings=onDate(closings);movements=onDate(movements);
    fuels=onDate(fuels).filter(r=>r.duplicate_of_id==null);
    const supply=calculateSupplyDO(movements);
    const workingByShift={};
    const dailyStorages=new Set([...openings,...closings].map(r=>code(r.storage)));
    const validShifts=![...openings,...closings,...movements,...fuels].some(r=>![1,2].includes(shift(r.shift)));
    for(const sh of [1,2]){
      let workingLoss=0,usage=0,complete=validShifts;
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
      workingByShift[sh]=complete?metric(workingLoss,usage):incomplete();
    }
    const parts=Object.values(workingByShift);
    const working=parts.every(m=>m.status==='complete')?metric(parts.reduce((n,m)=>n+m.qty,0),parts.reduce((n,m)=>n+m.base,0)):incomplete();
    return {date,supply,working,workingByShift};
  }
  async function readDay(db,table,columns,date,endDate=date){
    const all=[],size=500;
    for(let offset=0;;offset+=size){
      let query=db.from(table).select(columns);
      query=date===endDate?query.eq('tanggal',date):query.gte('tanggal',date).lte('tanggal',endDate);
      const {data,error}=await query.order('id',{ascending:true}).range(offset,offset+size-1);
      if(error)throw error;
      const rows=data||[];all.push(...rows);
      if(rows.length<size)return all;
    }
  }
  async function loadRows(db,date,endDate=date){
    const [openings,closings,movements]=await Promise.all([
      readDay(db,'stock_opening','id,tanggal,shift,storage,qty',date,endDate),
      readDay(db,'stock_closing','id,tanggal,shift,storage,actual_qty',date,endDate),
      readDay(db,'stock_movements','id,tanggal,shift,jenis,qty,source_storage,destination_storage,source_measured_qty,destination_measured_qty,transporter_measured_qty,meter_start_liter,meter_end_liter,transporter,document_reference,do_qty_liter,do_final,calculation_method',date,endDate)
    ]);
    return {openings,closings,movements};
  }
  async function load(db,date,fuels,master){
    return calculate({date,...await loadRows(db,date),fuels,master});
  }
  function calculatePeriod({startDate,endDate,openings=[],closings=[],movements=[],fuels=[],master=[]}){
    const start=Date.parse(startDate+'T00:00:00Z'),end=Date.parse(endDate+'T00:00:00Z');
    if(!Number.isFinite(start)||!Number.isFinite(end)||start>end||end-start>31*86400000)throw new Error('Periode MTD tidak valid');
    const index=rows=>{
      const result=new Map();
      for(const row of rows){if(!result.has(row.tanggal))result.set(row.tanggal,[]);result.get(row.tanggal).push(row);}
      return result;
    };
    const os=index(openings),cs=index(closings),ms=index(movements),fs=index(fuels);
    const days=[];
    for(let at=start;at<=end;at+=86400000){
      const date=new Date(at).toISOString().slice(0,10);
      days.push(calculate({date,openings:os.get(date)||[],closings:cs.get(date)||[],movements:ms.get(date)||[],fuels:fs.get(date)||[],master}));
    }
    const aggregate=(parts,working=false)=>{
      const complete=parts.filter(m=>m.status==='complete');
      if(parts.some(m=>m.status==='incomplete'))return {...incomplete(),note:working?`Belum lengkap • ${complete.length}/${parts.length} hari lengkap`:'Belum lengkap'};
      if(!complete.length)return {status:'empty',qty:0,percent:null,note:'Tidak ada penerimaan'};
      return metric(complete.reduce((n,m)=>n+m.qty,0),complete.reduce((n,m)=>n+m.base,0));
    };
    return {startDate,endDate,supply:calculateSupplyDO(movements.filter(r=>r.tanggal>=startDate && r.tanggal<=endDate)),working:aggregate(days.map(d=>d.working),true),
      workingByShift:{1:aggregate(days.map(d=>d.workingByShift[1]),true),2:aggregate(days.map(d=>d.workingByShift[2]),true)}};
  }
  async function loadPeriod(db,startDate,endDate,fuels,master){
    return calculatePeriod({startDate,endDate,...await loadRows(db,startDate,endDate),fuels,master});
  }
  function calculateDashboard(input){
    const period=calculatePeriod(input);
    const daily=calculate({...input,date:input.endDate});
    return {...period,workingDate:input.endDate,working:daily.working,workingByShift:daily.workingByShift};
  }
  async function loadDashboard(db,startDate,endDate,fuels,master){
    return calculateDashboard({startDate,endDate,...await loadRows(db,startDate,endDate),fuels,master});
  }
  function unavailableDashboard(startDate,endDate,message='Memuat...'){
    return {...unavailablePeriod(startDate,endDate,message),workingDate:endDate};
  }
  function unavailablePeriod(startDate,endDate,message='Memuat...'){
    return {startDate,endDate,...unavailable(endDate,message),workingByShift:{1:{...incomplete(),note:message},2:{...incomplete(),note:message}}};
  }
  function valueText(m){
    if(m.status!=='complete')return m.note;
    const state=m.sign==='actual-minus-do' ? (m.qty>0?'GAIN':m.qty<0?'LOSS':'BALANCE') : (m.qty>0?'LOSS':m.qty<0?'GAIN':'BALANCE');
    return `${state} ${fmt(Math.abs(m.qty))} LTR (${m.percent===null?'—':fmt(Math.abs(m.percent))+'%'})`;
  }
  function reportText(result){
    const shift1=result.workingByShift?.[1]||result.working;
    const shift2=result.workingByShift?.[2]||result.working;
    return `LOSS HARIAN (${dateLabel(result.date)} • Shift 1 + 2)\nSUPPLY LOSS = ${valueText(result.supply)}\nWORKING LOSS = ${valueText(result.working)}\n  SHIFT 1 = ${valueText(shift1)}\n  SHIFT 2 = ${valueText(shift2)}`;
  }
  function render(host,result){
    if(!host)return;
    const doc=host.ownerDocument;
    host.replaceChildren();
    const heading=doc.createElement('h3');
    heading.className='daily-loss-heading';
    const isPeriod=!!result.startDate;
    const dailyWorking=!!result.workingDate;
    heading.textContent=isPeriod
      ? `Loss MTD • ${dateLabel(result.startDate)} – ${dateLabel(result.endDate)}`
      : `Loss Harian • ${dateLabel(result.date)} • Shift 1 + 2`;
    if(dailyWorking)heading.textContent=`Supply MTD • ${dateLabel(result.startDate)} – ${dateLabel(result.endDate)} | Working Harian • ${dateLabel(result.workingDate)}`;
    host.appendChild(heading);

    const grid=doc.createElement('div');
    grid.className='daily-loss-grid';
    host.appendChild(grid);
    const cards=isPeriod?[
      ['Supply Loss MTD',result.supply,'% dari total Qty DO MTD','⛽','supply'],
      [dailyWorking?'Total Working Loss Harian':'Total Working Loss MTD',result.working,dailyWorking?'Shift 1 + 2 • % dari total pemakaian harian':'Shift 1 + 2 • % dari total pemakaian MTD','Σ','working-total'],
      [dailyWorking?'Working Loss Harian • Shift 1':'Working Loss MTD • Shift 1',result.workingByShift[1],dailyWorking?'% dari pemakaian Shift 1 harian':'% dari pemakaian Shift 1 MTD','1','working-1'],
      [dailyWorking?'Working Loss Harian • Shift 2':'Working Loss MTD • Shift 2',result.workingByShift[2],dailyWorking?'% dari pemakaian Shift 2 harian':'% dari pemakaian Shift 2 MTD','2','working-2']
    ]:[
      ['Supply Loss',result.supply,'Total Flowmeter − Qty DO (per DO selesai) • % dari Qty DO','⛽','supply'],
      ['Working Loss • Total',result.working,'Shift 1 + 2 • % dari total pemakaian harian','Σ','working-total'],
      ['Working Loss • Shift 1',result.workingByShift?.[1]||result.working,'Stock sistem − closing fisik • % pemakaian Shift 1','1','working-1'],
      ['Working Loss • Shift 2',result.workingByShift?.[2]||result.working,'Stock sistem − closing fisik • % pemakaian Shift 2','2','working-2']
    ];
    for(const [title,m,note,iconText,kind] of cards){
      const card=doc.createElement('div');
      card.className='daily-loss-card';
      card.dataset.kind=kind;
      card.dataset.state=m.status!=='complete'?'pending':m.qty===0?'balance':m.sign==='actual-minus-do'?(m.qty>0?'gain':'loss'):(m.qty>0?'loss':'gain');

      const top=doc.createElement('div');
      top.className='daily-loss-top';
      const icon=doc.createElement('div');
      icon.className='daily-loss-icon';
      icon.textContent=iconText;
      icon.setAttribute('aria-hidden','true');
      const label=doc.createElement('div');
      label.className='daily-loss-label';
      label.textContent=title;
      top.append(icon,label);

      const value=doc.createElement('div');
      value.className='daily-loss-value';
      value.textContent=valueText(m);
      const detail=doc.createElement('div');
      detail.className='daily-loss-note';
      detail.textContent=note;
      card.append(top,value,detail);
      grid.appendChild(card);
    }
  }
  function pending(host,date,message='Memuat...'){render(host,unavailable(date,message));}
  root.KPPDailyLoss=Object.freeze({calculate,load,calculateDashboard,loadDashboard,unavailableDashboard,calculatePeriod,loadPeriod,unavailablePeriod,reportText,render,pending,unavailable});
})(typeof window==='undefined'?globalThis:window);
