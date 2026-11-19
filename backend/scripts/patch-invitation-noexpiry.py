from pathlib import Path
import re

base = Path("D:/t-a-p/emc-hr/emc-carrer/backend/src")

def patch(path, replacements):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    for old, new in replacements:
        s = s.replace(old, new)
    p.write_text(s, encoding="utf-8")

# 1) Prisma schema: invitation expiry optional
schema = Path("D:/t-a-p/emc-hr/emc-carrer/backend/prisma/schema.prisma")
s = schema.read_text(encoding="utf-8")
s = s.replace("  expiresAt            DateTime\n", "  expiresAt            DateTime?\n", 1)
schema.write_text(s, encoding="utf-8")

# 2) auth.ts
p = base / "modules" / "auth.ts"
s = p.read_text(encoding="utf-8")
s = s.replace("""function isExpired(d: Date) {
  return d.getTime() < Date.now();
}""", """function isExpired(d: Date) {
  return d.getTime() < Date.now();
}

function employeeLinkAvailable(invitation: { expiresAt?: Date | null }) {
  return !invitation.expiresAt || invitation.expiresAt.getTime() > Date.now();
}""")
s = s.replace("invitation.usedAt || isExpired(invitation.expiresAt)", "!employeeLinkAvailable(invitation)")
s = s.replace("const expiresAt = new Date(Date.now() + env.employeeInviteTtlHours * 60 * 60 * 1000);", "const expiresAt: Date | null = null;")
s = s.replace("if (existing && existing.expiresAt.getTime() > Date.now()) {", "if (existing) {")
p.write_text(s, encoding="utf-8")

# 3) employeeInvitations.ts
p = base / "modules" / "employeeInvitations.ts"
s = p.read_text(encoding="utf-8")
s = s.replace("const expiresAt = new Date(Date.now() + env.employeeInviteTtlHours * 60 * 60 * 1000);", "const expiresAt: Date | null = null;")
s = s.replace('if (existing && existing.expiresAt.getTime() > Date.now()) throw ApiError.conflict("An active invitation already exists for this employee.");', 'if (existing) throw ApiError.conflict("An active invitation already exists for this employee.");')
s = s.replace("          data: { employeeId: employee.id, tokenHash: sha256(token), expiresAt, createdById: req.auth!.subjectId },", "          data: { employeeId: employee.id, tokenHash: sha256(token), createdById: req.auth!.subjectId },")
s = s.replace("      data: { employeeId: inv.employeeId, tokenHash: sha256(token), expiresAt, createdById: req.auth!.subjectId },", "      data: { employeeId: inv.employeeId, tokenHash: sha256(token), expiresAt: null },")
s = s.replace("expiresAt: expiresAt.toISOString() },", "expiresAt: null },")
p.write_text(s, encoding="utf-8")

# 4) employees.ts
p = base / "modules" / "employees.ts"
s = p.read_text(encoding="utf-8")
s = s.replace("if (existing && existing.expiresAt.getTime() > Date.now()) throw ApiError.conflict(\"An active invitation already exists.\");", "if (existing) throw ApiError.conflict(\"An active invitation already exists.\");")
s = s.replace("""        if (existing && existing.expiresAt.getTime() > Date.now()) {
          results.skipped.push({ email, reason: "An active invitation already exists." });
          continue;
        }""", """        if (existing) {
          results.skipped.push({ email, reason: "An active invitation already exists." });
          continue;
        }""")
s = s.replace("const expiresAt = new Date(Date.now() + env.employeeInviteTtlHours * 60 * 60 * 1000);", "const expiresAt: Date | null = null;")
s = s.replace("data: { employeeId: id, tokenHash: sha256(token), expiresAt, createdById: req.auth!.subjectId }", "data: { employeeId: id, tokenHash: sha256(token), createdById: req.auth!.subjectId }")
s = s.replace("data: { employeeId: employee.id, tokenHash: sha256(token), expiresAt, createdById: req.auth!.subjectId },", "data: { employeeId: employee.id, tokenHash: sha256(token), createdById: req.auth!.subjectId },")
s = s.replace("expiresAt: expiresAt.toISOString() },", "expiresAt: null },")
p.write_text(s, encoding="utf-8")
print("backend patched")
