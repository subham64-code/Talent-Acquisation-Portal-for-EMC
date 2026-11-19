const API = "http://localhost:4000/api/v1";
const email = "subhambehera2023@gift.edu.in";

async function jr(path, options = {}, token) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep raw text */ }
  if (!res.ok) {
    const payload = json?.error?.message ?? text;
    throw new Error(`${res.status} ${path}: ${payload}`);
  }
  return json?.data ?? json;
}

async function main() {
  const login = await jr("/auth/password/login", {
    method: "POST",
    body: JSON.stringify({ email: "it.admin@emc.example", password: "Emc@ItAdmin2026" }),
  });
  const token = login.token;
  if (!token) throw new Error("Login returned no token.");

  const send = await jr(
    "/employee-invitations/send",
    { method: "POST", body: JSON.stringify({ email, fullName: "EMC Test Invitation" }) },
    token,
  );
  console.log("invitation sent:", send.expiresAt);
  const inviteToken = new URL(send.link).searchParams.get("token");
  if (!inviteToken) throw new Error("Invitation link did not contain a token.");

  const publicEmployee = await jr(`/auth/employee/invitation/${inviteToken}`);
  console.log("public invitation access:", publicEmployee.employee.employeeCode, "status:", publicEmployee.status);

  const draft = {
    fullName: "EMC Test Invitation",
    personalEmail: "subhambehera2023@gift.edu.in",
    mobile: "+91 9876543210",
    qualification: "B.Tech",
    specialization: "Computer Science",
    totalExperience: "5",
    relevantExperience: "3",
    previousOrganization: "EMC Test Labs",
    workLocation: "Bhubaneswar",
    additionalInfo: "Smoke-tested self-service invitation flow.",
  };
  await jr(`/auth/employee/invitation/${inviteToken}/draft`, { method: "PUT", body: JSON.stringify(draft) });
  const before = await jr(`/auth/employee/invitation/${inviteToken}`);
  console.log("draft saved:", before.status, "draftUpdatedAt:", before.draft ? "yes" : "no");

  const fd = new FormData();
  for (const [key, value] of Object.entries(draft)) fd.append(key, String(value));
  fd.append(
    "cv",
    new Blob([
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Kids[3 0 R]/Type/Pages/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
    ], { type: "application/pdf" }),
    "employee-test-cv.pdf",
  );
  const submit = await jr(`/auth/employee/invitation/${inviteToken}/submit`, { method: "POST", body: fd });
  console.log("submission accepted:", submit.message);

  const hrSubmissions = await jr("/employee-submissions", { method: "GET" }, token);
  const submission = hrSubmissions.submissions.find((item) => item.email === email && item.status === "PENDING");
  if (!submission) throw new Error("The submission did not appear in the HR queue.");
  console.log("submission queued:", submission.status, submission.completion + "%", "cv:", submission.hasCv);

  const validate = await jr(`/employee-submissions/${submission.id}/validate`, { method: "POST", body: JSON.stringify({}) }, token);
  console.log("validated:", validate.message);

  const employee = await jr(`/employees/${validate.employeeId}`, { method: "GET" }, token);
  const fileId = employee.item?.cvFileId;
  console.log("employee updated:", employee.item?.fullName, "cvFileId:", fileId || "none");

  const invites = await jr("/employee-invitations", { method: "GET" }, token);
  const invitation = invites.invitations.find((item) => item.id === send.invitationId);
  console.log("invitation after validation:", invitation?.status, "reminders:", invitation?.reminderCount ?? 0);
  console.log("SMOKE_TEST_FILE_ID:" + fileId);
  console.log("SMOKE_TEST_INVITATION_ID:" + send.invitationId);
  console.log("SMOKE_TEST_EMPLOYEE_ID:" + validate.employeeId);

  // Clean up the database test data, but keep/return the file id so the caller can
  // delete the Filebase object explicitly.
  await jr(`/employees/${validate.employeeId}`, { method: "DELETE" }, token);
  console.log("test employee deleted");
}

main().catch((error) => {
  console.error("SMOKE FAILED:", error.message);
  process.exit(1);
});
