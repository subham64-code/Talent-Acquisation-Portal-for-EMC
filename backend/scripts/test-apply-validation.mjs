async function test(name, body) {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) form.append(key, String(value));
  const file = new Blob(["%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"], { type: "application/pdf" });
  form.append("cv", file, "test-cv.pdf");
  const response = await fetch("http://localhost:4000/api/v1/career/applications", { method: "POST", body: form });
  const text = await response.text();
  console.log(name, response.status, text.slice(0, 160));
}

async function main() {
  const base = {
    jobOpeningId: "cmwcdz2tn00acvy1s7glbuzo9",
    fullName: "Validation Test",
    email: "validation-test@example.com",
    mobile: "9876543210",
    dateOfBirth: "1995-01-01",
    gender: "Male",
    highestQualification: "Graduate",
    technicalSkills: "React, Node.js",
    totalExperience: "2",
    country: "India",
    state: "Odisha",
    city: "Bhubaneswar",
  };
  await test("missing-mobile", { ...base, mobile: "" });
  await test("invalid-mobile-letters", { ...base, mobile: "abcdefghij" });
  await test("invalid-mobile-9digits", { ...base, mobile: "987654321" });
}

main().catch((error) => { console.error(error); process.exit(1); });
