"""Read-only check of normalized future booking CSVs; never imports or contacts customers."""
import argparse,csv,json
from datetime import datetime
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('fresha',type=Path)
p.add_argument('--symmetry',type=Path,help='Optional same-format export to reconcile')
a=p.parse_args()
def read(path):
    result=[]; errors=[]
    with path.open(newline='',encoding='utf-8-sig') as f:
        for n,row in enumerate(csv.DictReader(f),2):
            try:
                start=datetime.strptime(row['date']+' '+row['time'],'%Y-%m-%d %H:%M')
                duration=int(row['duration_minutes']); barber=row['barber'].strip().lower()
                if duration<=0 or duration>480 or barber not in {'sean','travis','dylan'}: raise ValueError('Invalid barber or duration')
                if not row['reference'].strip(): raise ValueError('Reference is required')
                result.append(dict(reference=row['reference'],start=start,duration=duration,barber=barber,service=row['service'].strip().lower()))
            except (KeyError,ValueError) as e:errors.append({'line':n,'error':str(e)})
    return result,errors
def key(r):return (r['start'].isoformat(),r['barber'],r['duration'],r['service'])
rows,errors=read(a.fresha);clashes=[];seen=set();duplicates=[]
for i,r in enumerate(rows):
    if r['reference'] in seen:duplicates.append(r['reference'])
    seen.add(r['reference'])
    for other in rows[:i]:
        delta=(r['start']-other['start']).total_seconds()/60
        if r['barber']==other['barber'] and -r['duration']<delta<other['duration']:clashes.append([other['reference'],r['reference']])
report={'rows':len(rows),'invalid_rows':errors,'duplicate_references':duplicates,'overlapping_bookings':clashes}
if a.symmetry:
    comparison,more_errors=read(a.symmetry)
    from collections import Counter
    counts=Counter(key(r) for r in comparison);missing=[]
    for r in rows:
        k=key(r)
        if counts[k]:counts[k]-=1
        else:missing.append(r['reference'])
    report.update(symmetry_invalid_rows=more_errors,missing_from_symmetry=missing,extra_symmetry_bookings=sum(counts.values()))
print(json.dumps(report,indent=2))
raise SystemExit(1 if errors or duplicates or clashes or report.get('missing_from_symmetry') or report.get('symmetry_invalid_rows') or report.get('extra_symmetry_bookings') else 0)
