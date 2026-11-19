from pathlib import Path
p = Path('D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/hr/Offers.tsx')
s = p.read_text(encoding='utf-8')
s = s.replace('        {letterPreview && (\n          {(() => {', '        {letterPreview && (() => {')
s = s.replace('          })()}\n\n        )}', '          })()}')
p.write_text(s, encoding='utf-8')
print('patched', s.count('{letterPreview && (() => {'), s.count('})()}\n\n        )}'))
