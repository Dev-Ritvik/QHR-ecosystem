# Builds AUDIT.md from head.md + f1..f4.txt + tail.md.
#   python gen.py
# Findings are numbered in file order. [[slug]] anywhere becomes "#n". Counts and the evidence index are filled in.
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

findings = []      # dicts in order
sections = []      # (title, [finding indexes])
for name in ('f1.txt', 'f2.txt', 'f3.txt', 'f4.txt'):
    cur = None
    for raw in read(name).split('\n'):
        line = raw.rstrip()
        if line.startswith('## '):
            sections.append((line[3:].strip(), []))
            cur = None
            continue
        if line.startswith('@@ '):
            parts = [p.strip() for p in line[3:].split('|')]
            while len(parts) < 4: parts.append('')
            slug, sev, scope, rel = parts[:4]
            assert sev in ORDER, (slug, sev)
            assert scope in ('isolated', 'repeated', 'systemic'), (slug, scope)
            cur = {'slug': slug, 'sev': sev, 'scope': scope, 'rel': [r.strip() for r in rel.split(',') if r.strip()], 'N': '', 'F': ''}
            findings.append(cur)
            sections[-1][1].append(len(findings) - 1)
            continue
        m = re.match(r'^([LEOVWXNF]): (.*)$', line)
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
count_md = ['| Class | Count |', '|---|---|'] + ['| %s | %d |' % (k, counts.get(k, 0)) for k in ORDER] + ['| **Total** | **%d** |' % len(findings)]
scope = Counter(f['scope'] for f in findings)
count_md += ['', 'By scope: %d isolated, %d repeated in several places, %d systemic. %d findings carry a note: a decision of the client that they touch, something only he can supply, or where an element came from.' % (
    scope['isolated'], scope['repeated'], scope['systemic'], sum(1 for f in findings if f['N']))]
count_md += ['', 'Each finding has one class. A finding classed AI-SLOP or SYSTEMIC also has a seriousness, which is stated in its "Why it matters".']

ev_files = sorted(os.listdir(EV))
ev_md = ['%d images.' % len(ev_files), ''] + ['- [%s](ev/%s)' % (n, n) for n in ev_files]

doc = read('head.md') + '\n' + '\n'.join(blocks) + '\n' + read('tail.md')
doc = doc.replace('{{COUNTS}}', '\n'.join(count_md)).replace('{{EVIDENCE}}', '\n'.join(ev_md)).replace('{{TOTAL}}', str(len(findings)))
doc = resolve(doc)

with io.open(os.path.join(ROOT, 'AUDIT.md'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(doc)

used = set()
for f in findings:
    for n in [x.strip() for x in f['F'].split(',') if x.strip()]: used.add(n)
print('findings', len(findings), dict(counts))
print('scope', dict(scope), 'with notes', sum(1 for f in findings if f['N']))
print('unknown slugs', sorted(unknown))
print('missing evidence files', sorted(set(missing_ev)))
print('evidence files never cited', sorted(set(ev_files) - used))
print('words', len(doc.split()), 'chars', len(doc))
for title, idxs in sections: print('  %-48s %d' % (title, len(idxs)))
