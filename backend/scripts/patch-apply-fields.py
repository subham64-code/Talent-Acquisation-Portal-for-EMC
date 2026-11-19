from pathlib import Path
p = Path("D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/public/Apply.tsx")
s = p.read_text(encoding="utf-8")
start = s.index('            <Field label="Date of Birth" required')
end = s.index('            <div className="sm:col-span-2">', start)
insert = """            {selectedJob ? (
              <div className="sm:col-span-2 careers-apply-role">
                <span className="careers-apply-role__icon"><BriefcaseBusiness size={20} aria-hidden="true" /></span>
                <span>
                  <span className="careers-apply-role__label">Applying for</span>
                  <span className="careers-apply-role__title">{selectedJob.title}</span>
                  <span className="careers-apply-role__meta">{selectedJob.department?.name || "EMC"}{selectedJob.location ? ` · ${selectedJob.location}` : ""}</span>
                </span>
              </div>
            ) : (
              <div className="sm:col-span-2 careers-apply-role careers-apply-role--missing">
                <span><span className="careers-apply-role__label">Application unavailable</span><span className="careers-apply-role__title">Please choose a position from Careers first.</span></span>
              </div>
            )}
"""
s = s[:start] + insert + s[end:]
p.write_text(s, encoding="utf-8")
print("fields patched")
