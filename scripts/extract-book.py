"""Build offline book pages and the character catalogue from the supplied PDF."""
import json, re
from pathlib import Path
import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
doc = pymupdf.open(ROOT / 'assets/livro.pdf')
out = ROOT / 'public/assets/book'
out.mkdir(parents=True, exist_ok=True)

def clean(text):
    text = re.sub(r'\xad\s*\n\s*', '', text)
    text = re.sub(r'-\s*\n\s*(?=[a-zà-ÿ])', '', text)
    return re.sub(r'\s+', ' ', text.replace('\xad', '')).strip()

pages, entries = [], []
current = None
category = 'Antecedentes'
for index, page in enumerate(doc):
    blocks, seen = [], set()
    for block in page.get_text('dict')['blocks']:
        if 'lines' not in block or block['bbox'][1] > 584:
            continue
        text = '\n'.join(''.join(s['text'] for s in line['spans']) for line in block['lines'])
        key = (tuple(round(v, 1) for v in block['bbox']), text)
        if key in seen:
            continue
        seen.add(key)
        spans = [s for line in block['lines'] for s in line['spans']]
        heading = all('EurostileBold' in s['font'] for s in spans if s['text'].strip())
        blocks.append({'x':block['bbox'][0], 'y':block['bbox'][1], 'text':clean(text), 'heading':heading})
    # Read down the left column, then down the right, rather than across both.
    blocks.sort(key=lambda b: (b['x'] >= page.rect.width * .49, round(b['y'], 1)))
    paragraphs = [b['text'] for b in blocks if b['text']]
    pages.append({'page': index+1, 'text':'\n\n'.join(paragraphs), 'blocks': paragraphs})
    target = out / f'{index+1}.webp'
    if not target.exists():
        pix = page.get_pixmap(matrix=pymupdf.Matrix(3, 3), alpha=False)
        Image.frombytes('RGB', (pix.width, pix.height), pix.samples).save(target, 'WEBP', quality=85)
    if not 32 <= index <= 53:
        continue
    for b in blocks:
        text = b['text']
        if b['heading'] and text.startswith('VANTAGENS'):
            category = text.replace('VANTAGENS DE ', '').replace('VANTAGENS ', '').capitalize()
            current = None
            continue
        hindrance = re.fullmatch(r'(.+?)\s*\((MENOR|MAIOR|MENOR OU MAIOR)\)', text) if b['heading'] else None
        is_edge = b['heading'] and text == text.upper() and '(' not in text and not text.startswith(('COMPLICAÇÕES', 'VANTAGENS'))
        if hindrance or (is_edge and index >= 37):
            current = {'name':(hindrance[1] if hindrance else text).title(), 'kind':'hindrances' if hindrance else 'advantages', 'page':index+1, 'category':'Complicações' if hindrance else category, 'description':'', 'requirements':'', 'severities':(['Menor','Maior'] if hindrance and ' OU ' in hindrance[2] else [hindrance[2].title()] if hindrance else [])}
            entries.append(current)
        elif current and not b['heading'] and not (index == 32 and b['x'] > 205):
            if text.startswith('Requisitos'):
                current['requirements'] = text.split(':', 1)[-1].strip()
            else:
                current['description'] += ('\n\n' if current['description'] else '') + text

entries = [e for e in entries if e['description'] and (e['kind'] == 'hindrances' or e['requirements'])]
for i, entry in enumerate(entries):
    entry['id'] = f"{entry['kind']}-{i}"
(ROOT/'public/assets/book.json').write_text(json.dumps({'title':'Savage Worlds — Edição Brasileira (Deluxe)', 'pages':pages}, ensure_ascii=False), encoding='utf8')
(ROOT/'src/catalog.json').write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding='utf8')
print(f'{len(pages)} pages; {sum(e["kind"]=="advantages" for e in entries)} advantages; {sum(e["kind"]=="hindrances" for e in entries)} hindrances')
