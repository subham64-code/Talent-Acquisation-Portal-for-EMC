from pathlib import Path

path = Path("src/modules/interviews.ts")
text = path.read_text(encoding="utf-8")
replacements = {
  "interviewerType, instructions: rest.instructions": "interviewType, instructions: rest.instructions",
  "interviewId: interview.id, applicationId, interviewerType }": "interviewId: interview.id, applicationId, interviewType }",
  "applicationId, interviewerType, interviewer: entry.name }": "applicationId, interviewType, interviewer: entry.name }",
  "data.interviewerType = interviewerType;": "data.interviewerType = interviewType as string;",
  "data.interviewerMetadata = { interviewers, interviewerType };": "data.interviewerMetadata = { interviewers, interviewerType: interviewType };",
  "const interviewType = (data.interviewerType as string)": "const interviewType = (data.interviewerType as string)",
  "interviewId: id, interviewerType }": "interviewId: id, interviewType }",
  "interviewId: id, interviewerType, interviewer: entry.name }": "interviewId: id, interviewType, interviewer: entry.name }",
}
for old, new in replacements.items():
    text = text.replace(old, new)
path.write_text(text, encoding="utf-8")
print("remaining interviewerType:", text.count("interviewerType"), "interviewType references ok")
