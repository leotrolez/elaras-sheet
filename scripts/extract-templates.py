import json, re
from pathlib import Path
root = Path(__file__).resolve().parents[1]
pages = json.loads((root/'public/assets/book.json').read_text(encoding='utf8'))['pages']
race_names = {'ANDROIDE':'Androide','ANÕES':'Anão','ATLANTE':'Atlante','AVIANO':'Aviano','ELFOS':'Elfo','HUMANOS':'Humano','MEIO-ELFOS':'Meio-elfo','MEIO-ORCS':'Meio-orc','PEQUENINOS':'Pequenino','RAKASHANOS':'Rakashano','SÁURIOS':'Sáurio'}
races = []
active = None
for p in pages[21:25]:
    for block in p['blocks']:
        if block in race_names:
            active = {'id':race_names[block], 'page':p['page'], 'text':[]}
            races.append(active)
        elif block == 'CRIANDO RAÇAS':
            active = None
        elif active:
            active['text'].append(block)
(root/'src/races.json').write_text(json.dumps(races,ensure_ascii=False,indent=2),encoding='utf8')

aliases={'Intimidação':'Intimidar','Persuasão':'Persuadir','Investigação':'Investigar','Conjuração':'Conjurar'}
archetypes=[]
for p in pages[18:21]:
    blocks=p['blocks']
    for i,block in enumerate(blocks):
        if not block.startswith('Atributos:'):
            continue
        name=blocks[i-1].strip('“”').title()
        attrs=dict((key,int(die)) for key,die in re.findall(r'([A-Za-zÀ-ÿ]+) d(\d+)',block))
        skilltext=blocks[i+1]
        skills={}
        for key,die in re.findall(r'([^,:]+?) d(\d+)',skilltext.split(':',1)[1]):
            key=key.strip(); skills[aliases.get(key,key)]=int(die)
        edgeblock=next(x for x in blocks[i+2:] if x.startswith('Vantagens:'))
        edges=[x.strip() for x in edgeblock.split(':',1)[1].split(',')]
        edges=[{'Alerta':'Prontidão','McGyver':'McGyver'}.get(x,x) for x in edges]
        extra=re.search(r'\+(\d+) ponto',skilltext)
        archetypes.append({'id':name,'page':p['page'],'attributes':attrs,'skills':skills,'advantages':edges,'extraSkills':int(extra[1]) if extra else 0})
(root/'src/archetypes.json').write_text(json.dumps(archetypes,ensure_ascii=False,indent=2),encoding='utf8')
print(len(races),'races;',len(archetypes),'archetypes')
