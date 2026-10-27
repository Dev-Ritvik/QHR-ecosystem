# Builds AUDIT.md (the re-audit of 24 October 2026) from head.md + f1..f3.txt + tail.md + status.txt.
#   python gen.py
# Findings are numbered in file order. [[slug]] anywhere becomes "#n". {{COUNTS}}, {{STATUS}},
# {{STATUS_COUNTS}}, {{EVIDENCE}} and {{TOTAL}} are filled in.
# status.txt: one line per finding of 9 October:  n | slug | STATUS | how checked | note | evidence,...
import re, os, sys, io
from collections import Counter, OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
EV = os.path.join(ROOT, 'ev')
sys.stdout.reconfigure(encoding='utf-8')

def read(name):
    with io.open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read().replace('\r\n', '\n')

FIELDS = OrderedDict([('L', 'Location'), ('E', 'Element'), ('O', 'Observation'), ('V', 'Visual evidence'),
                      ('W', 'Why it matters'), ('X', 'Expected behavior/design')])
ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'AI-SLOP', 'SYSTEMIC']

findings = []
sections = []
for name in ('f1.txt', 'f2.txt', 'f3.txt'):
    cur = None
    for raw in read(name).split('\n'):
        line = raw.rstrip()
        if line.startswith('## '):
            sections.append((line[3:].strip(), []))
            cur = None
            continue
        if line.startswith('@@ '):
            parts = [p.strip() for p in line[3:].split('|')]
            while len(parts) < 5: parts.append('')
            slug, sev, scope, rel, orig = parts[:5]
            assert sev in ORDER, (slug, sev)
            assert scope in ('isolated', 'repeated', 'systemic'), (slug, scope)
            cur = {'slug': slug, 'sev': sev, 'scope': scope, 'rel': [r.strip() for r in rel.split(',') if r.strip()],
                   'orig': orig, 'N': '', 'F': '', 'T': ''}
            findings.append(cur)
            sections[-1][1].append(len(findings) - 1)
            continue
        m = re.match(r'^([LEOVWXNFT]): (.*)$', line)
        if m and cur is not None:
            cur[m.group(1)] = m.group(2).strip()
        elif line.strip() and cur is not None:
            raise SystemExit('unparsed line in %s: %r' % (name, line[:80]))

slugs = [f['slug'] for f in findings]
dup = [s for s, n in Counter(slugs).items() if n > 1]
assert not dup, ('duplicate slugs', dup)
num = {s: i + 1 for i, s in enumerate(slugs)}

missing_ev = []
def ev_links(fstr):
    out = []
    for name in [x.strip() for x in fstr.split(',') if x.strip()]:
        if not os.path.exists(os.path.join(EV, name)): missing_ev.append(name)
        out.append('[%s](ev/%s)' % (name, name))
    return ', '.join(out)

unknown = set()
def resolve(text):
    def rep(m):
        s = m.group(1)
        if s not in num:
            unknown.add(s); return '#?(' + s + ')'
        return '#%d' % num[s]
    return re.sub(r'\[\[([a-z0-9-]+)\]\]', rep, text)

def title_of(f):
    if f['T']: return f['T']
    t = f['E'].rstrip('.')
    t = re.split(r'[.:;]', t)[0].strip()
    return t[:1].upper() + t[1:] if len(t) <= 78 else t[:75].rstrip() + '…'

blocks = []
for title, idxs in sections:
    blocks.append('## ' + title + '\n')
    for i in idxs:
        f = findings[i]
        for k in FIELDS:
            assert f.get(k), (f['slug'], 'missing', k)
        b = ['### ISSUE #%d — %s\n' % (i + 1, title_of(f)),
             '**Severity:** %s\n' % f['sev']]
        if f['orig']:
            b.append('**Since 9 October:** %s\n' % f['orig'])
        for k, label in FIELDS.items():
            b.append('**%s:** %s\n' % (label, f[k]))
        b.append('**Likely scope:** %s\n' % f['scope'])
        rel = []
        for r in f['rel']:
            if r not in num: unknown.add(r)
            else: rel.append('#%d' % num[r])
        b.append('**Related issues:** %s\n' % (', '.join(rel) if rel else 'none'))
        if f['N']: b.append('**Note:** %s\n' % f['N'])
        if f['F']: b.append('**Evidence files:** %s\n' % ev_links(f['F']))
        blocks.append('\n'.join(b))

counts = Counter(f['sev'] for f in findings)
new = [f for f in findings if not f['orig']]
carried = [f for f in findings if f['orig']]
count_md = ['| Class | New today | Carried over, partly fixed | Total |', '|---|---|---|---|']
for k in ORDER:
    a = sum(1 for f in new if f['sev'] == k); b = sum(1 for f in carried if f['sev'] == k)
    count_md.append('| %s | %d | %d | %d |' % (k, a, b, a + b))
count_md.append('| **Total** | **%d** | **%d** | **%d** |' % (len(new), len(carried), len(findings)))
scope = Counter(f['scope'] for f in findings)
count_md += ['', 'By scope: %d isolated, %d repeated in several places, %d systemic. %d carry a note about a decision of the client or something only he can supply.' % (
    scope['isolated'], scope['repeated'], scope['systemic'], sum(1 for f in findings if f['N']))]

# the 9 October findings, one row each
STATUS_ORDER = ['FIXED', 'PARTLY', 'CLIENT', 'DECLINED']
rows = []
for raw in read('status.txt').split('\n'):
    if not raw.strip() or raw.startswith('#'): continue
    p = [x.strip() for x in raw.split('|')]
    assert len(p) == 6, raw
    n, slug, st, how, note, ev = p
    assert st in STATUS_ORDER, raw
    rows.append((int(n), slug, st, how, note, ev))
assert [r[0] for r in rows] == list(range(1, 120)), 'status.txt must list 1..119 in order'
sc = Counter(r[2] for r in rows)
how = Counter(r[3] for r in rows if r[2] == 'FIXED')
status_counts = ['| Status | Count |', '|---|---|',
                 '| Fixed | %d (%d measured, %d seen on the captures, %d taken from the fix ledger and not exercised) |' % (
                     sc['FIXED'], how['measured'], how['seen'], how['ledger']),
                 '| Partly fixed (the rest is a finding of this pass, or waits on the client) | %d |' % sc['PARTLY'],
                 '| Unchanged, waiting on the client | %d |' % sc['CLIENT'],
                 '| Declined by the user | %d |' % sc['DECLINED'],
                 '| **Total** | **%d** |' % len(rows)]
LABEL = {'FIXED': 'Fixed', 'PARTLY': 'Partly', 'CLIENT': 'Client', 'DECLINED': 'Declined'}
status_md = ['| 9 Oct # | Finding | Status | Checked | Today | Evidence |', '|---|---|---|---|---|---|']
for n, slug, st, hw, note, ev in rows:
    evl = ev_links(ev) if ev and ev != '-' else ''
    status_md.append('| %d | %s | %s | %s | %s | %s |' % (n, slug, LABEL[st], hw, resolve(note), evl))

ev_files = sorted(os.listdir(EV))
ev_md = ['%d images.' % len(ev_files), ''] + ['- [%s](ev/%s)' % (n, n) for n in ev_files]

doc = read('head.md') + '\n' + '\n'.join(blocks) + '\n' + read('tail.md')
doc = (doc.replace('{{COUNTS}}', '\n'.join(count_md)).replace('{{EVIDENCE}}', '\n'.join(ev_md))
          .replace('{{TOTAL}}', str(len(findings))).replace('{{NEW}}', str(len(new))).replace('{{CARRIED}}', str(len(carried)))
          .replace('{{STATUS}}', '\n'.join(status_md)).replace('{{STATUS_COUNTS}}', '\n'.join(status_counts))
          .replace('{{FIXED}}', str(sc['FIXED'])).replace('{{PARTLY}}', str(sc['PARTLY']))
          .replace('{{CLIENTN}}', str(sc['CLIENT'])).replace('{{DECLINED}}', str(sc['DECLINED'])))
doc = resolve(doc)

with io.open(os.path.join(ROOT, 'AUDIT.md'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(doc)

used = set()
for f in findings:
    for n in [x.strip() for x in f['F'].split(',') if x.strip()]: used.add(n)
for r in rows:
    for n in [x.strip() for x in r[5].split(',') if x.strip() and x.strip() != '-']: used.add(n)
for n in re.findall(r'\(ev/([^)]+)\)', read('head.md') + read('tail.md')): used.add(n)
print('findings', len(findings), dict(counts), 'new', len(new), 'carried', len(carried))
print('scope', dict(scope))
print('9 Oct status', dict(sc), 'fixed checked', dict(how))
print('unknown slugs', sorted(unknown))
print('missing evidence files', sorted(set(missing_ev)))
print('evidence files never cited', sorted(set(ev_files) - used))
print('words', len(doc.split()), 'chars', len(doc))
for title, idxs in sections: print('  %-48s %d' % (title, len(idxs)))
