from pathlib import Path
p = Path('D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/hr/Approvals.tsx')
s = p.read_text(encoding='utf-8', errors='ignore')
i = s.find(r'${Number(offeredSalary)')
print(repr(s[i-30:i+5]))
s = s.replace('??? ', '₹ ')
s = s.replace('`? ', '`₹ ')
s = s.replace('`\ufffd ', '`₹ ')
p.write_text(s, encoding='utf-8')
