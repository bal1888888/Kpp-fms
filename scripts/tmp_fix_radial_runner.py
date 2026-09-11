from pathlib import Path
p=Path('scripts/tmp_radial_all_patch.py')
s=p.read_text(encoding='utf-8')
s=s.replace('card_pattern.subn(new_card, block, count=1)','card_pattern.subn(lambda _m: new_card, block, count=1)')
s=s.replace('map_pattern.subn(new_map, block, count=1)','map_pattern.subn(lambda _m: new_map, block, count=1)')
p.write_text(s,encoding='utf-8')
