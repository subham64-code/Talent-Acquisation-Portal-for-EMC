from pathlib import Path
import re
p = Path("D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/public/Apply.tsx")
s = p.read_text(encoding="utf-8")
pattern = re.compile(r"\n\s*\{selectedJob && \(\s*<div className=\"flex flex-col justify-end[^}]+?\)\}\n", re.S)
new, count = pattern.subn("\n", s)
print("removed", count)
if count != 1:
    start = s.find('            {selectedJob && (')
    end = s.find('          </div>\n\n          <div>', start)
    print("start", start, "end", end)
else:
    p.write_text(new, encoding="utf-8")
