from pathlib import Path
import re

files = [Path('src/modules/auth.ts'), Path('src/modules/employees.ts'), Path('src/modules/employeeInvitations.ts')]
pat_create = re.compile(r'tokenHash:\s*hashSecret\(token\)')
pat_lookup = re.compile(r'where:\s*\{\s*tokenHash:\s*hashSecret\(token\)\s*\}')
for path in files:
    text = path.read_text(encoding='utf-8')
    text = pat_create.sub('tokenHash: sha256(token)', text)
    text = pat_lookup.sub('where: { tokenHash: sha256(token) }', text)
    # normalize import line to include sha256 once
    m = re.search(r'import \{([^}]+)\} from "../utils/crypto";', text)
    if m:
        names = [x.strip() for x in m.group(1).split(',') if x.strip()]
        for needed in ('hashSecret', 'randomToken', 'sha256'):
            if needed in text and needed not in names:
                names.append(needed)
        # keep unique, preserve order as found in names list
        seen = []
        for n in names:
            if n not in seen:
                seen.append(n)
        text = re.sub(r'import \{[^}]+\} from "../utils/crypto";', 'import { ' + ', '.join(seen) + ' } from "../utils/crypto";', text, count=1)
    path.write_text(text, encoding='utf-8')
print('done')
