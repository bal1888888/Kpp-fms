from pathlib import Path
p=Path('scripts/apply-fc-click-anomaly-v2.py')
s=p.read_text(encoding='utf-8')
old="'      .kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}\\n'"
new="'.kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}\\n'"
count=s.count(old)
if count<2:
    raise SystemExit(f'expected two CSS anchor strings, found {count}')
p.write_text(s.replace(old,new,2),encoding='utf-8')
print('FC patch anchor repaired')
