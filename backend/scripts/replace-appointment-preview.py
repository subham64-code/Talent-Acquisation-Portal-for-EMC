from pathlib import Path
p = Path("D:/t-a-p/emc-hr/emc-carrer/frontend/src/pages/hr/Offers.tsx")
s = p.read_text(encoding="utf-8")

# Insert helpers after the formatSalary const line.
anchor = "  const formatSalary = (value: any) => value != null ? `₹ ${Number(value).toLocaleString()}` : \"—\";\n"
if "const deriveCandidateAddress" not in s:
    helpers = anchor + r'''

  const parseJsonSafe = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "string") return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  };

  const ordinalDate = (value?: string | Date | null) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const day = date.getDate();
    const suffix = day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th";
    return `${day}${suffix} ${date.toLocaleDateString("en-GB", { month: "long" })} ${date.getFullYear()}`;
  };

  const appointmentReference = (offer: any) => {
    const source = offer?.createdAt ? new Date(offer.createdAt) : new Date();
    const dd = String(source.getDate()).padStart(2, "0");
    const mm = String(source.getMonth() + 1).padStart(2, "0");
    const id = String(offer?.id ?? "HR").replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase();
    return `EMC/HR/${source.getFullYear()}/${mm}${dd}-${id}`;
  };

  const deriveCandidateAddress = (candidate: any): string[] => {
    const extra = parseJsonSafe(candidate?.additionalInfo);
    const lines: string[] = [];
    const address = String(extra?.currentAddress ?? extra?.address ?? candidate?.currentLocation ?? "").trim();
    if (address) lines.push(address);
    const locality = [extra?.city, extra?.state, extra?.pinCode ?? extra?.pincode].filter(Boolean).map(String).join(", ");
    if (locality) lines.push(locality);
    return lines.length ? lines : ["Address available with HR"];
  };

  const salutationName = (name?: string) => {
    const parts = String(name ?? "Candidate").trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "Candidate";
  };

  const deriveGrade = (offer: any) => {
    const raw = String(offer?.salaryStructure ?? "") + " " + JSON.stringify(parseJsonSafe(offer?.additionalConditions) ?? {});
    const match = raw.match(/grade\s*[:=-]?\s*([A-Za-z0-9-]+)/i);
    return match?.[1]?.toUpperCase() ?? "_____";
  };
'''
    s = s.replace(anchor, helpers, 1)

start_marker = '          <div className="ta-offer-letter">'
end_marker = '\n        )}\n      </Modal>'
start = s.index(start_marker)
end = s.index(end_marker, start)
new = r'''          {(() => {
            const issueDate = letterPreview?.createdAt ? new Date(letterPreview.createdAt) : new Date();
            const name = letterPreview?.application?.candidate?.fullName || "Candidate";
            const addressLines = deriveCandidateAddress(letterPreview?.application?.candidate);
            return (
              <div className="appointment-letter">
                <div className="appointment-letter__head">
                  <img className="appointment-letter__logo" src="/assets/ecometrix-logo.png" alt="EcoMetrix Consultants Private Limited" />
                  <div className="appointment-letter__meta">
                    <strong>Ref:</strong><span>{appointmentReference(letterPreview)}</span>
                    <strong>Date:</strong><span>{ordinalDate(issueDate)}</span>
                  </div>
                  <div>
                    <p>To,</p>
                    <p><strong>{name}</strong></p>
                    {addressLines.map((line, index) => <p key={index}>{line}</p>)}
                  </div>
                </div>

                <h3 className="appointment-letter__title">Appointment Letter</h3>
                <div className="appointment-letter__body">
                  <p className="appointment-letter__salutation">Dear {salutationName(name)},</p>
                  <p>This has reference to your application and subsequent discussions; we have pleasure in offering you employment in our Organization as:</p>
                  <div className="appointment-letter__details">
                    <strong>Designation:</strong><span>{letterPreview?.designation || "_____"}</span>
                    <strong>Grade:</strong><span>{deriveGrade(letterPreview)}</span>
                    <strong>Eligibility:</strong><span>Benefits as per Employee Handbook (EHB) specific to the grade.</span>
                  </div>
                  <p>You are required to agree to the Terms and Conditions as described in Annexure – I.</p>
                  <p>You will be paid total compensations as detailed in Annexure – II.</p>
                  <p>Your offer has been made based on the information furnished by you. However, if there is a discrepancy in the copies of documents or certificates given by you as a proof of above, we retain the right to review our offer of employment / appointment.</p>
                  <p>Please sign and return duplicate copy of this letter in token of your acceptance.</p>
                  <p>You are requested to report at our office at DCB-120, DLF Cybercity, Idco Infopark, Patia, Bhubaneswar.</p>
                  <p>We congratulate you on being selected for employment with the company and wish you a long and successful career with this Organization. We are confident that your contribution will take us further in our journey towards becoming Industry leaders. We assure you of our support for your professional development and growth.</p>
                  <p>Looking forward to our long-term professional relationship.</p>
                </div>

                <div className="appointment-letter__signature">
                  <div className="appointment-letter__signature-company">Faithfully yours,</div>
                  <div className="appointment-letter__signature-company">For EcoMetrix Consultants Private Limited</div>
                  <div className="appointment-letter__signature-space" />
                  <div className="appointment-letter__signature-label">Authorized Signatory</div>
                  <div className="appointment-letter__signature-label">Authorized Signatory Name</div>
                  <div className="appointment-letter__signature-label">Authorized Signatory Designation</div>
                  <div className="appointment-letter__enclosure">Encl.: As above</div>
                </div>

                <footer className="appointment-letter__footer">
                  <strong>EcoMetrix Consultants Private Limited</strong><br />
                  Unit No.: DCB-119, Idco Info Park, DLF Cyber City, Chandaka Industrial Estate, Patia, Bhubaneswar, Odisha – 751024<br />
                  Telephone - +91 674 2973849<br />
                  E-mail – ecometrix@outlook.com<br />
                  CIN - U74200OR2015PTC018759
                </footer>
              </div>
            );
          })()}
'''
s = s[:start] + new + s[end:]
p.write_text(s, encoding="utf-8")
print("preview replaced")
