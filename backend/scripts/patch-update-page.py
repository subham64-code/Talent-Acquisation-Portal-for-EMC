from pathlib import Path

p = Path("D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/employee/Update.tsx")
s = p.read_text(encoding="utf-8")
s = s.replace('<div key={f.key} className="flex flex-col gap-1">', '<div key={f.key} id={`field-${f.key}`} className="flex flex-col gap-1">')
s = s.replace('<label className="text-sm font-medium ink-soft">{f.label}</label>', '<label className="text-sm font-medium ink-soft">{f.label}<span className="text-red-500 ml-0.5">*</span></label>')
s = s.replace(': <input className="input" type={f.type as any} value={form[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)} />}', ': <input className="input" type={f.type as any} value={form[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)} />}\n                  {errors[f.key] && <p className="text-[11px] font-medium text-red-600">{errors[f.key]}</p>}')
p.write_text(s, encoding="utf-8")
print("ok", s.count("errors[f.key]"), s.count("field-${f.key}"))
