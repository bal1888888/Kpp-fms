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
      // Ignore accidental spaces in DO/PO numbers. Keep meaningful punctuation (e.g. /305).
      const document=code(row.document_reference).replace(/\s+/g,'');
      const transporter=code(row.transporter).replace(/[^A-Z0-9]/g,'');
      const doQty=number(row.do_qty_liter);
      const flow=number(row.transporter_measured_qty);
      if(!document||!transporter||![10000,16000,24000].includes(doQty) || flow===null || flow<=0 || row.do_final==null || row.calculation_method!=='RECEIPT_FLOWMETER_DO'){
        invalid++;
        continue;
      }
      const key=transporter+'|'+document;
      if(!groups.has(key))groups.set(key,{
        doQty,flow:0,final:0,consistent:true,
        document:String(row.document_reference||'').trim(),
        transporter:String(row.transporter||'').trim(),
        ids:[]
      });
      const group=groups.get(key);
      if(group.doQty!==doQty)group.consistent=false;
      group.flow+=flow;
      group.ids.push(row.id);
      if(row.do_final===true)group.final++;
    }
    const unfinished=[...groups.values()].filter(g=>!g.consistent||g.final!==1);
    if(invalid||unfinished.length){
      // Give the team a specific DO to inspect instead of an unactionable generic error.
      const problems=unfinished.slice(0,2).map(g=>{
        const why=!g.consistent?'Qty DO berbeda':g.final===0?'belum ada bongkaran terakhir':'bongkaran terakhir ganda';
        const ids=g.ids.filter(id=>id!==undefined && id!==null);
        return g.document+' ('+g.transporter+(ids.length?', ID '+ids.join('/'):'')+
          '; '+why+')';
      });
      return {...incomplete(),detail:
        invalid+' transaksi belum valid; '+unfinished.length+' DO perlu diperiksa'+
        (problems.length?': '+problems.join('; '):'')+
        (unfinished.length>2?'; dan '+(unfinished.length-2)+' DO lainnya':'')+
        '. Buka Stock > History Penerimaan untuk verifikasi.'};
    }
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
    // Use the storage footprint evidenced by this operational date.
    // A master row alone must not make an unrelated or newly added tank
    // invalidate a historical day. Any tank present in either shift's
    // Opening/Closing is still required in BOTH shifts; movements and fuel
    // against a tank without a matching opening are rejected by change().
    // Master remains the authoritative FT/warehouse resolver below.
    const dailyStorages=new Set([...openings,...closings].map(r=>code(r.storage)).filter(Boolean));
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
      if(!dailyStorages.size||balances.size!==dailyStorages.size||physical.size!==dailyStorages.size||balances.size!==physical.size||[...dailyStorages].some(storage=>!balances.has(storage)||!physical.has(storage)))complete=false;
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
    // Keep period aggregates intact; expose the selected day's metrics separately.
    return {...period,workingDate:input.endDate,dailyWorking:daily.working,dailyWorkingByShift:daily.workingByShift};
  }
  async function loadDashboard(db,startDate,endDate,fuels,master){
    return calculateDashboard({startDate,endDate,...await loadRows(db,startDate,endDate),fuels,master});
  }
  function unavailableDashboard(startDate,endDate,message='Memuat...'){
    return {...unavailablePeriod(startDate,endDate,message),workingDate:endDate,dailyWorking:{...incomplete(),note:message},dailyWorkingByShift:{1:{...incomplete(),note:message},2:{...incomplete(),note:message}}};
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
    if(result.dailyWorking){
      const mtd1=result.workingByShift?.[1]||incomplete();
      const mtd2=result.workingByShift?.[2]||incomplete();
      const daily1=result.dailyWorkingByShift?.[1]||incomplete();
      const daily2=result.dailyWorkingByShift?.[2]||incomplete();
      return `LOSS MTD (${dateLabel(result.startDate)} – ${dateLabel(result.endDate)})\nSUPPLY LOSS MTD = ${valueText(result.supply)}\nWORKING LOSS MTD = ${valueText(result.working)}\n  SHIFT 1 MTD = ${valueText(mtd1)}\n  SHIFT 2 MTD = ${valueText(mtd2)}\n\nLOSS HARIAN (${dateLabel(result.workingDate)} • Shift 1 + 2)\nWORKING LOSS HARIAN = ${valueText(result.dailyWorking)}\n  SHIFT 1 = ${valueText(daily1)}\n  SHIFT 2 = ${valueText(daily2)}`;
    }
    const shift1=result.workingByShift?.[1]||result.working;
    const shift2=result.workingByShift?.[2]||result.working;
    return `LOSS HARIAN (${dateLabel(result.date)} • Shift 1 + 2)\nSUPPLY LOSS = ${valueText(result.supply)}\nWORKING LOSS = ${valueText(result.working)}\n  SHIFT 1 = ${valueText(shift1)}\n  SHIFT 2 = ${valueText(shift2)}`;
  }
  function iconSvg(kind,title){
    const common='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    if(kind==='supply')return '<svg '+common+'><path d="M5 21V4.8A1.8 1.8 0 0 1 6.8 3h7.4A1.8 1.8 0 0 1 16 4.8V21"/><path d="M4 21h14M8 7h6v5H8zM16 8h2l2 2v6a2 2 0 0 1-4 0"/><path d="M18 13h2"/></svg>';
    if(kind==='working-1')return '<svg '+common+'><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
    if(kind==='working-2')return '<svg '+common+'><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z"/><path d="m16.5 4 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z"/></svg>';
    if(kind==='working-total' && /MTD/i.test(title))return '<svg '+common+'><path d="M4 7h16M4 12h16M4 17h10"/><circle cx="18" cy="17" r="3"/><path d="M18 15.5v1.7l1.1.7"/></svg>';
    if(kind==='working-total')return '<svg '+common+'><path d="M4 19V5m0 14h17"/><path d="m7 15 4-4 3 2 6-7"/><path d="M16 6h4v4"/></svg>';
    return '<svg '+common+'><path d="M4 19V5m0 14h16"/><path d="M7 15V9m4 6V5m4 10v-4m4 4V7"/></svg>';
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
    if(dailyWorking)heading.textContent=`Supply & Working Loss MTD • ${dateLabel(result.startDate)} – ${dateLabel(result.endDate)} | Working Harian • ${dateLabel(result.workingDate)}`;
    host.appendChild(heading);

    const grid=doc.createElement('div');
    grid.className='daily-loss-grid';
    host.appendChild(grid);
    const cards=isPeriod?(dailyWorking?[
      ['Supply Loss MTD',result.supply,'% dari total Qty DO MTD','⛽','supply'],
      ['Working Loss MTD',result.working,'Akumulasi Shift 1 + 2 • % dari pemakaian MTD','Σ','working-total'],
      ['Total Working Loss Harian',result.dailyWorking,'% dari total pemakaian harian','Σ','working-total'],
      ['Working Loss Harian • Shift 1',result.dailyWorkingByShift?.[1]||incomplete(),'% dari pemakaian Shift 1 harian','1','working-1'],
      ['Working Loss Harian • Shift 2',result.dailyWorkingByShift?.[2]||incomplete(),'% dari pemakaian Shift 2 harian','2','working-2']
    ]:[
      ['Supply Loss MTD',result.supply,'% dari total Qty DO MTD','⛽','supply'],
      ['Total Working Loss MTD',result.working,'Shift 1 + 2 • % dari total pemakaian MTD','Σ','working-total'],
      ['Working Loss MTD • Shift 1',result.workingByShift[1],'% dari pemakaian Shift 1 MTD','1','working-1'],
      ['Working Loss MTD • Shift 2',result.workingByShift[2],'% dari pemakaian Shift 2 MTD','2','working-2']
    ]):[
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
      icon.innerHTML=iconSvg(kind,title);
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
      detail.textContent=m.detail||note;
      card.append(top,value,detail);
      grid.appendChild(card);
    }
  }
  function pending(host,date,message='Memuat...'){render(host,unavailable(date,message));}
  root.KPPDailyLoss=Object.freeze({calculate,load,calculateDashboard,loadDashboard,unavailableDashboard,calculatePeriod,loadPeriod,unavailablePeriod,reportText,render,pending,unavailable});
})(typeof window==='undefined'?globalThis:window);
