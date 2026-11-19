from pathlib import Path

path = Path("src/pages/hr/Interviews.tsx")
text = path.read_text(encoding="utf-8")
text = text.replace('inviteEntry.mode === "ONLINE" ? "Online" : inviteEntry.mode === "PHONE" ? "Phone" : "In person"', 'inviteEntry.mode === "ONLINE" ? "Online" : "Offline"')
text = text.replace('inviteEntry.mode === "ONLINE" ? "Online" : inviteEntry.mode === "PHONE" ? "Phone" : "Offline"', 'inviteEntry.mode === "ONLINE" ? "Online" : "Offline"')
text = text.replace('row.mode === "ONLINE" ? "Online" : row.mode === "PHONE" ? "Phone" : "Offline"', 'row.mode === "ONLINE" ? "Online" : "Offline"')
text = text.replace('entry.mode === "ONLINE" ? "Online" : entry.mode === "PHONE" ? "Phone" : entry.location || "Offline"', 'entry.mode === "ONLINE" ? "Online" : entry.location || "Offline"')
path.write_text(text, encoding="utf-8")
print("PHONE occurrences:", text.count("PHONE"))
