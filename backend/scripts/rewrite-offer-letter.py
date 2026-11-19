from pathlib import Path
p = Path("D:/t-a-p/emc-hr/emc-carrer/backend/src/modules/offers.ts")
s = p.read_text(encoding="utf-8")
start = s.index("function formatOfferDate")
end = s.index("router.get(", start)
new_block = r'''function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatOfferDate(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${pad2(date.getDate())} ${date.toLocaleDateString("en-GB", { month: "long" })} ${date.getFullYear()}`;
}

function ordinalDate(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const day = date.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${day}${suffix} ${date.toLocaleDateString("en-GB", { month: "long" })} ${date.getFullYear()}`;
}

function appointmentReference(offer: any, issueDate: Date) {
  const suffix = String(offer?.id ?? "HR").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `EMC/HR/${issueDate.getFullYear()}/${pad2(issueDate.getMonth() + 1)}${pad2(issueDate.getDate())}-${suffix}`;
}

function fullName(candidate: any) {
  return String(candidate?.fullName ?? "Candidate").trim() || "Candidate";
}

function salutationName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "Candidate";
}

function parseJson(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function candidateAddress(candidate: any): string[] {
  const extra = parseJson(candidate?.additionalInfo);
  const lines: string[] = [];
  const address = String(extra?.currentAddress ?? extra?.address ?? candidate?.currentLocation ?? "").trim();
  if (address) lines.push(address);
  const locality = [extra?.city, extra?.state, extra?.pinCode ?? extra?.pincode, extra?.country]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (locality) lines.push(locality);
  return lines.length ? lines : ["Address available with HR"];
}

function extractSalaryStructureGrade(candidate: any): string | null {
  const extra = parseJson(candidate?.salaryStructure ?? candidate?.additionalInfo);
  const raw = String(candidate?.salaryStructure ?? extra?.grade ?? candidate?.additionalInfo ?? "");
  const match = raw.match(/grade\s*[:=-]?\s*([A-Z0-9-]+)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function buildOfferPdf(offer: any, application: any, candidate: any, job: any, dept: any, et: any): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const issueDate = offer?.createdAt && !Number.isNaN(new Date(offer.createdAt).getTime()) ? new Date(offer.createdAt) : new Date();
    const ordinalIssue = ordinalDate(issueDate);
    const reference = appointmentReference(offer, issueDate);
    const name = fullName(candidate);
    const last = salutationName(name);
    const addressLines = candidateAddress(candidate);
    const designation = String(offer?.designation ?? job?.title ?? "Designation to be assigned").trim();
    const grade = extractSalaryStructureGrade(offer) ?? "_____";

    const companyLegal = "EcoMetrix Consultants Private Limited";
    const companyAddress = "Unit No.: DCB-119, Idco Info Park, DLF Cyber City, Chandaka Industrial Estate, Patia, Bhubaneswar, Odisha – 751024";
    const companyPhone = "Telephone - +91 674 2973849";
    const companyEmail = "E-mail – ecometrix@outlook.com";
    const companyCin = "CIN - U74200OR2015PTC018759";
    const appointmentOffice = "DCB-120, DLF Cybercity, Idco Infopark, Patia, Bhubaneswar.";

    const logoCandidates = [
      path.resolve(process.cwd(), "frontend", "public", "assets", "ecometrix-logo.png"),
      path.resolve(process.cwd(), "..", "frontend", "public", "assets", "ecometrix-logo.png"),
      path.resolve(process.cwd(), "assets", "ecometrix-logo.png"),
    ];
    const logoPath = logoCandidates.find((candidatePath) => fs.existsSync(candidatePath));

    const doc = new PDFDocument({
      size: "A4",
      margin: 45,
      bufferPages: true,
      info: {
        Title: "Appointment Letter",
        Author: companyLegal,
        Subject: "Appointment letter",
        Creator: "Ecometrix Consultants Private Limited",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const green = "#659616";
    const greenDark = "#4C730D";
    const ink = "#111A30";
    const muted = "#4d5a72";
    const left = 45;
    const right = doc.page.width - 45;
    const bodyWidth = right - left;
    let pageIndex = 1;

    const drawFooter = () => {
      const y = doc.page.height - 54;
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(greenDark).text(companyLegal, left, y, { lineBreak: false });
      const nameWidth = doc.widthOfString(companyLegal, { font: "Helvetica-Bold", size: 8.5 });
      doc.moveTo(left + nameWidth + 8, y + 5).lineTo(right, y + 5).lineWidth(0.7).strokeColor(green).stroke();
      doc.font("Helvetica").fontSize(6.4).fillColor(ink)
        .text(companyAddress, left, y + 11, { width: bodyWidth, lineBreak: true })
        .text(companyPhone, left, y + 22, { width: bodyWidth })
        .text(companyEmail, left, y + 31, { width: bodyWidth })
        .text(companyCin, left, y + 40, { width: bodyWidth });
    };

    const addPage = () => {
      pageIndex += 1;
      doc.addPage();
      drawFooter();
    };

    // Letterhead
    if (logoPath) {
      try {
        doc.image(logoPath, left, 34, { width: 82 });
      } catch {
        doc.circle(left + 22, 62, 22).fill(green);
      }
    }

    // Reference and date
    let y = 112;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(greenDark).text("Ref:", left, y, { width: 30 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(ink).text(reference, left + 34, y, { width: 260 });
    y += 15;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(greenDark).text("Date:", left, y, { width: 34 });
    doc.font("Helvetica").fontSize(9).fillColor(ink).text(ordinalIssue, left + 39, y, { width: 260 });

    // Candidate block
    y = 162;
    doc.font("Helvetica").fontSize(10.2).fillColor(ink).text("To,", left, y);
    y += 14;
    doc.font("Helvetica-Bold").fontSize(10.5).text(name, left, y);
    for (const line of addressLines) {
      y += 14;
      doc.font("Helvetica").fontSize(9.5).text(line, left, y, { width: bodyWidth });
    }

    // Document title
    y += 32;
    doc.font("Helvetica-Bold").fontSize(15.5).fillColor(ink).text("Appointment Letter", left, y, { width: bodyWidth, align: "center", underline: true });

    // Salutation
    y += 30;
    doc.font("Helvetica").fontSize(10.2).text(`Dear ${last},`, left, y);

    // Introduction
    y += 24;
    doc.text("This has reference to your application and subsequent discussions; we have pleasure in offering you employment in our Organization as:", left, y, { width: bodyWidth, align: "justify" });

    // Employment details
    y = doc.y + 14;
    doc.font("Helvetica-Bold").fontSize(10.2).fillColor(greenDark).text("Designation:", left, y);
    doc.font("Helvetica").fontSize(10.2).fillColor(ink).text(designation, left + 86, y);
    y += 17;
    doc.font("Helvetica-Bold").fontSize(10.2).fillColor(greenDark).text("Grade:", left, y);
    doc.font("Helvetica").fontSize(10.2).fillColor(ink).text(grade, left + 86, y);
    y += 17;
    doc.font("Helvetica-Bold").fontSize(10.2).fillColor(greenDark).text("Eligibility:", left, y);
    doc.font("Helvetica").fontSize(10.2).fillColor(ink).text("Benefits as per Employee Handbook (EHB) specific to the grade.", left + 86, y, { width: bodyWidth - 86 });

    // Terms
    y = doc.y + 24;
    doc.font("Helvetica").fontSize(10).fillColor(ink)
      .text("You are required to agree to the Terms and Conditions as described in Annexure – I.", left, y, { width: bodyWidth })
      .text("You will be paid total compensations as detailed in Annexure – II.", left, doc.y + 10, { width: bodyWidth });

    // Verification clause
    y = doc.y + 16;
    doc.text("Your offer has been made based on the information furnished by you. However, if there is a discrepancy in the copies of documents or certificates given by you as a proof of above, we retain the right to review our offer of employment / appointment.", left, y, { width: bodyWidth, align: "justify" });

    // Joining instructions
    y = doc.y + 22;
    doc.text("Please sign and return duplicate copy of this letter in token of your acceptance.", left, y, { width: bodyWidth });
    doc.text(`You are requested to report at our office at ${appointmentOffice}`, left, doc.y + 13, { width: bodyWidth });

    // Congratulatory message
    y = doc.y + 22;
    doc.text("We congratulate you on being selected for employment with the company and wish you a long and successful career with this Organization. We are confident that your contribution will take us further in our journey towards becoming Industry leaders. We assure you of our support for your professional development and growth.", left, y, { width: bodyWidth, align: "justify" });
    y = doc.y + 14;
    doc.text("Looking forward to our long-term professional relationship.", left, y, { width: bodyWidth });

    // Signature block
    y = doc.y + 28;
    if (y > doc.page.height - 210) {
      addPage();
      y = 62;
    }
    doc.font("Helvetica-Bold").fontSize(10).fillColor(greenDark).text("Faithfully yours,", left, y);
    doc.text(`For ${companyLegal}`, left, y + 17);
    doc.moveTo(left, y + 84).lineTo(left + 150, y + 84).lineWidth(0.6).strokeColor(ink).stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(ink).text("________________________", left, y + 62, { width: 160, lineBreak: false });
    doc.text("________________________", left, y + 78, { width: 160, lineBreak: false });
    doc.font("Helvetica").fontSize(9).text("Authorized Signatory", left, y + 90);
    doc.font("Helvetica").fontSize(9).fillColor(ink).text("Authorized Signatory Name", left, y + 104);
    doc.font("Helvetica").fontSize(9).fillColor(ink).text("Authorized Signatory Designation", left, y + 118);
    doc.font("Helvetica-Bold").fontSize(9).text("Encl.: As above", left, y + 142);

    doc.on("pageAdded", drawFooter);
    drawFooter();
    doc.end();
  });
}

'''
s = s[:start] + new_block + s[end:]
p.write_text(s, encoding="utf-8")
print("offer pdf replaced")
