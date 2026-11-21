import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Pencil,
  RefreshCw,
  Search,
  XCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { hrApi } from "../../lib/api";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import { Input, Select, Textarea } from "../../components/ref/Input";
import Modal from "../../components/ref/Modal";
import DataTable, { type Column } from "../../components/DataTable";

const ROUND_OPTIONS = [
  "Screening Round",
  "HR Round",
  "Technical Round 1",
  "Technical Round 2",
  "Managerial Round",
  "Management/CEO Round",
  "Final Round",
];

const RESULT_OPTIONS = [
  { value: "GOOD", label: "Good" },
  { value: "BEST", label: "Best" },
  { value: "NOT_SATISFIED", label: "Not satisfied" },
];

const RESULT_LABELS: Record<string, string> = {
  GOOD: "Good",
  BEST: "Best",
  NOT_SATISFIED: "Not satisfied",
};

const MODE_OPTIONS = [
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
];

const OUTCOME_OPTIONS = [
  { value: "SELECTED", label: "Select for offer" },
  { value: "NEXT_ROUND", label: "Move to next round" },
  { value: "UNDER_REVIEW", label: "Keep under review" },
  { value: "REJECTED", label: "Reject candidate" },
  { value: "ON_HOLD", label: "Put on hold" },
];

const FILTERS = [
  { key: "scheduled", label: "Scheduled" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];
type ScheduleMode = "create" | "edit" | "reschedule";
type InterviewerEntry = { name: string; email: string };

const interviewerEntryKey = (entry: InterviewerEntry) =>
  `${String(entry.name || "").trim().toLowerCase()}::${String(entry.email || "").trim().toLowerCase()}`;

const interviewerEntriesFrom = (row: any): InterviewerEntry[] => {
  const metadata = row?.interviewerMetadata;
  if (Array.isArray(metadata?.interviewers)) {
    return metadata.interviewers
      .map((entry: any) => ({ name: String(entry?.name ?? "").trim(), email: String(entry?.email ?? "").trim() }))
      .filter((entry: InterviewerEntry) => entry.name);
  }
  const names = String(row?.interviewerName ?? "").split(",").map((name: string) => name.trim()).filter(Boolean);
  return names.map((name: string, index: number) => ({ name, email: index === 0 ? row?.interviewerEmail ?? "" : "" }));
};

const emptySchedule = () => ({
  applicationId: "",
  round: "Technical Round 1",
  interviewers: [{ name: "", email: "" }],
  date: "",
  time: "",
  mode: "ONLINE",
  meetingLink: "",
  location: "",
  instructions: "",
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const formatDateTime = (iso: string) => `${formatDate(iso)} · ${formatTime(iso)}`;

const relativeDay = (iso: string) => {
  const target = new Date(iso);
  const today = new Date();
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((a - b) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1) return `In ${diff} days`;
  return `${Math.abs(diff)} days ago`;
};

const initials = (name: string) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export default function Interviews() {
  const navigate = useNavigate();

  const [items, setItems] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FilterKey>("scheduled");
  const [search, setSearch] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("create");
  const [scheduleEntry, setScheduleEntry] = useState<any>(null);
  const [scheduleForm, setScheduleForm] = useState(emptySchedule());
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [feedbackEntry, setFeedbackEntry] = useState<any>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    interviewerName: "",
    result: "",
    remarks: "",
    outcome: "",
    nextRound: "",
    nextDate: "",
  });
  const [feedbackInterviewers, setFeedbackInterviewers] = useState<Array<{ name: string; email: string }>>([{ name: "", email: "" }]);
  const [feedbackErrors, setFeedbackErrors] = useState<Record<string, string>>({});
  const [savingFeedback, setSavingFeedback] = useState(false);



  const [cancelEntry, setCancelEntry] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);

  const [selectedForOffer, setSelectedForOffer] = useState<any>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const [interviews, applicationList] = await Promise.all([
        hrApi.interviews({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? r?.data ?? []),
        hrApi
          .applications({ page: 1, pageSize: 200 })
          .then((r: any) => r?.data?.items ?? r?.data ?? []),
      ]);
      setItems(Array.isArray(interviews) ? interviews : []);
      setApplications(Array.isArray(applicationList) ? applicationList : []);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not load interview records. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scheduled = useMemo(
    () => items.filter((i) => i.status === "SCHEDULED" || i.status === "RESCHEDULED"),
    [items],
  );
  const completed = useMemo(() => items.filter((i) => i.status === "COMPLETED"), [items]);
  const cancelled = useMemo(() => items.filter((i) => i.status === "CANCELLED"), [items]);
  const interviewerOptions = useMemo(() => {
    const map = new Map<string, InterviewerEntry>();
    for (const row of items) {
      for (const entry of interviewerEntriesFrom(row)) {
        const key = interviewerEntryKey(entry);
        if (!map.has(key)) map.set(key, entry);
      }
    }
    return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name) || left.email.localeCompare(right.email));
  }, [items]);

  const counts = {
    scheduled: scheduled.length,
    completed: completed.length,
    cancelled: cancelled.length,
    all: items.length,
  };

  const filterFor = (key: FilterKey) => {
    if (key === "scheduled") return scheduled;
    if (key === "completed") return completed;
    if (key === "cancelled") return cancelled;
    return items;
  };

  const visibleEntries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return [...filterFor(statusFilter)]
      .filter((row) => {
        if (!needle) return true;
        const haystack = [
          row.application?.candidate?.fullName,
          row.application?.jobOpening?.title,
          interviewerSummary(row).names,
          interviewerSummary(row).label,
          row.round,
          row.mode,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, statusFilter, search]);

  const calendarDays = useMemo(() => {
    const groups = new Map<string, any[]>();
    const upcoming = [...scheduled].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
    upcoming.forEach((entry) => {
      const day = formatDate(entry.scheduledAt);
      const list = groups.get(day) || [];
      list.push(entry);
      groups.set(day, list);
    });
    return Array.from(groups.entries());
  }, [scheduled]);

  const latestFeedback = (row: any) => {
    const feedback = row.feedback;
    if (Array.isArray(feedback)) return feedback[feedback.length - 1] || null;
    return feedback || null;
  };

  const interviewerSummary = (row: any) => {
    const metadata = row?.interviewerMetadata;
    const list = Array.isArray(metadata?.interviewers) ? metadata.interviewers : null;
    const names = list?.map((entry: any) => entry.name).filter(Boolean).join(", ") || row.interviewerName || "";
    const type = row.interviewerType || metadata?.interviewerType || (names ? "INDIVIDUAL" : "");
    const label = type === "PANEL" ? "Panel Interview" : type === "MULTIPLE" ? "Multiple Interview" : type === "INDIVIDUAL" ? "Individual Interview" : "Interview";
    return { names, type, label };
  };

  const openCreate = () => {
    setScheduleMode("create");
    setScheduleEntry(null);
    setScheduleForm(emptySchedule());
    setScheduleErrors({});
    setError("");
    setScheduleOpen(true);
  };

  const openEntrySchedule = (entry: any, mode: ScheduleMode) => {
    const date = new Date(entry.scheduledAt);
    const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setScheduleMode(mode);
    setScheduleEntry(entry);
    const metadata = (entry as any).interviewerMetadata;
    const interviewers = Array.isArray(metadata?.interviewers) && metadata.interviewers.length
      ? metadata.interviewers.map((item: any) => ({ name: item.name || "", email: item.email || "" }))
      : [{ name: entry.interviewerName || "", email: entry.interviewerEmail || "" }];
    setScheduleForm({
      applicationId: entry.applicationId || entry.application?.id || "",
      round: entry.round || "Technical Round 1",
      interviewers,
      date: localDate,
      time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
      mode: entry.mode || "ONLINE",
      meetingLink: entry.meetingLink || "",
      location: entry.location || "",
      instructions: entry.instructions || "",
    });
    setScheduleErrors({});
    setError("");
    setScheduleOpen(true);
  };

  const closeSchedule = () => {
    if (savingSchedule) return;
    setScheduleOpen(false);
    setScheduleEntry(null);
  };

  const updateSchedule = (key: string, value: string) => {
    setScheduleForm((current) => ({ ...current, [key]: value }));
    setScheduleErrors((current) => ({ ...current, [key]: "" }));
  };

  const updateInterviewer = (index: number, key: "name" | "email", value: string) => {
    setScheduleForm((current) => ({
      ...current,
      interviewers: current.interviewers.map((entry: any, entryIndex: number) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    }));
    setScheduleErrors((current) => ({ ...current, interviewers: "" }));
  };

  const selectScheduleInterviewer = (index: number, value: string) => {
    const selected = interviewerOptions.find((entry) => interviewerEntryKey(entry) === value);
    setScheduleForm((current) => ({
      ...current,
      interviewers: current.interviewers.map((entry: any, entryIndex: number) => entryIndex === index ? { name: selected?.name ?? "", email: selected?.email ?? "" } : entry),
    }));
    setScheduleErrors((current) => ({ ...current, interviewers: "" }));
  };

  const addInterviewer = () => {
    setScheduleForm((current) => ({ ...current, interviewers: [...current.interviewers, { name: "", email: "" }] }));
  };

  const removeInterviewer = (index: number) => {
    setScheduleForm((current) => ({
      ...current,
      interviewers: current.interviewers.length === 1 ? current.interviewers : current.interviewers.filter((_: any, entryIndex: number) => entryIndex !== index),
    }));
  };

  const submitSchedule = async () => {
    const errors: Record<string, string> = {};
    if (!scheduleForm.applicationId) errors.applicationId = "Choose a shortlisted candidate.";
    if (!scheduleForm.round.trim()) errors.round = "Choose the interview round.";
    const cleanInterviewers = (scheduleForm.interviewers || []).map((entry: any) => ({ name: String(entry.name || "").trim(), email: String(entry.email || "").trim() })).filter((entry: any) => entry.name || entry.email);
    if (cleanInterviewers.length === 0) {
      errors.interviewers = "Add at least one interviewer.";
    } else if (cleanInterviewers.some((entry: any) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(entry.email))) {
      errors.interviewers = "Each interviewer needs a name and a valid email address.";
    }
    if (!scheduleForm.date) errors.date = "Choose the interview date.";
    if (!scheduleForm.time) errors.time = "Choose the interview time.";
    if (scheduleForm.mode === "ONLINE" && !/^https?:\/\/\S+$/i.test(scheduleForm.meetingLink.trim())) {
      errors.meetingLink = "Enter a valid meeting URL (https://…).";
    }
    if (scheduleForm.mode !== "ONLINE" && !scheduleForm.location.trim()) {
      errors.location = "Enter the interview venue.";
    }
    setScheduleErrors(errors);
    if (Object.keys(errors).length) return;

    const scheduledAt = new Date(`${scheduleForm.date}T${scheduleForm.time}`).toISOString();
    const payload: Record<string, unknown> = {
      scheduledAt,
      timezone: "Asia/Kolkata",
      mode: scheduleForm.mode,
      meetingLink: scheduleForm.mode === "ONLINE" ? scheduleForm.meetingLink.trim() : null,
      location: scheduleForm.mode === "ONLINE" ? null : scheduleForm.location.trim(),
      interviewers: cleanInterviewers,
      instructions: scheduleForm.instructions.trim() || null,
    };

    setSavingSchedule(true);
    setError("");
    try {
      if (scheduleMode === "create") {
        const response = await hrApi.createInterview({ ...payload, applicationId: scheduleForm.applicationId, round: scheduleForm.round });
        const failed = response?.data?.interviewerEmails?.failed ?? [];
        setMessage("Interview scheduled successfully.");
        if (failed.length) setError(`Interview saved, but the email could not be delivered to: ${failed.join(", ")}.`);
        setStatusFilter("scheduled");
      } else {
        const response = await hrApi.updateInterview(scheduleEntry.id, {
          ...payload,
          ...(scheduleMode === "reschedule" ? { status: "RESCHEDULED" } : {}),
        });
        const failed = response?.data?.interviewerEmails?.failed ?? [];
        setMessage(scheduleMode === "reschedule" ? "Interview rescheduled successfully." : "Interview updated successfully.");
        if (failed.length) setError(`Interview saved, but the email could not be delivered to: ${failed.join(", ")}.`);
      }
      setScheduleOpen(false);
      setScheduleEntry(null);
      await load(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not save the interview.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const openFeedback = (entry: any) => {
    const latest = latestFeedback(entry);
    const previousInterviewers = interviewerEntriesFrom(entry);
    setFeedbackEntry(entry);
    setFeedbackInterviewers(previousInterviewers.length ? previousInterviewers : [{ name: "", email: "" }]);
    setFeedbackForm({
      interviewerName: entry.interviewerName || "",
      result: latest?.result && RESULT_LABELS[latest.result] ? latest.result : "",
      remarks: latest?.feedback || "",
      outcome: latest?.recommendation && OUTCOME_OPTIONS.some((o) => o.value === latest.recommendation) ? latest.recommendation : "",
      nextRound: "",
      nextDate: "",
    });
    setFeedbackErrors({});
    setError("");
  };

  const closeFeedback = () => {
    if (savingFeedback) return;
    setFeedbackEntry(null);
    setFeedbackInterviewers([{ name: "", email: "" }]);
  };

  const selectFeedbackInterviewer = (index: number, value: string) => {
    const selected = interviewerOptions.find((entry) => interviewerEntryKey(entry) === value);
    setFeedbackInterviewers((current) => current.map((entry, entryIndex) => entryIndex === index ? { name: selected?.name ?? "", email: selected?.email ?? "" } : entry));
    setFeedbackErrors((current) => { const next = { ...current }; delete next.interviewers; return next; });
  };

  const updateFeedbackInterviewer = (index: number, key: "name" | "email", value: string) => {
    setFeedbackInterviewers((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: value } : entry));
    setFeedbackErrors((current) => { const next = { ...current }; delete next.interviewers; return next; });
  };

  const addFeedbackInterviewer = () => {
    setFeedbackInterviewers((current) => [...current, { name: "", email: "" }]);
  };

  const removeFeedbackInterviewer = (index: number) => {
    setFeedbackInterviewers((current) => current.length === 1 ? current : current.filter((_, entryIndex) => entryIndex !== index));
  };

  const updateFeedback = (key: string, value: string) => {
    setFeedbackForm((current) => ({ ...current, [key]: value }));
    setFeedbackErrors((current) => ({ ...current, [key]: "" }));
  };

  const submitFeedback = async () => {
    if (!feedbackEntry) return;
    const errors: Record<string, string> = {};
    if (!feedbackForm.result) errors.result = "Choose the candidate result.";
    if (!feedbackForm.remarks.trim()) errors.remarks = "Add the interview remarks.";
    if (feedbackForm.outcome === "NEXT_ROUND") {
      if (!feedbackForm.nextDate) errors.nextDate = "Choose when the next round is scheduled.";
      const cleanNextInterviewers = feedbackInterviewers.map((entry) => ({ name: entry.name.trim(), email: entry.email.trim() })).filter((entry) => entry.name || entry.email);
      if (cleanNextInterviewers.length === 0) {
        errors.interviewers = "Add at least one interviewer for the next round.";
      } else if (cleanNextInterviewers.some((entry) => !entry.name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(entry.email))) {
        errors.interviewers = "Each interviewer for the next round needs a name and a valid email address.";
      }
    }
    setFeedbackErrors(errors);
    if (Object.keys(errors).length) return;

    setSavingFeedback(true);
    setError("");
    try {
      await hrApi.interviewFeedback(feedbackEntry.id, {
        interviewerName: feedbackInterviewers.map((entry) => entry.name.trim()).filter(Boolean).join(", ") || feedbackForm.interviewerName.trim() || feedbackEntry.interviewerName || undefined,
        feedback: feedbackForm.remarks.trim(),
        recommendation: feedbackForm.outcome || null,
        result: feedbackForm.result || null,
      });

      if (feedbackForm.outcome) {
        const cleanNextInterviewers = feedbackInterviewers.map((entry) => ({ name: entry.name.trim(), email: entry.email.trim() || null })).filter((entry) => entry.name);
        const resultResponse = await hrApi.interviewResult(feedbackEntry.id, {
          result: feedbackForm.outcome,
          remarks: feedbackForm.remarks.trim(),
          nextRound: feedbackForm.outcome === "NEXT_ROUND" ? feedbackForm.nextRound.trim() || undefined : undefined,
          nextScheduledAt:
            feedbackForm.outcome === "NEXT_ROUND" && feedbackForm.nextDate
              ? new Date(feedbackForm.nextDate).toISOString()
              : undefined,
          nextInterviewers: feedbackForm.outcome === "NEXT_ROUND" ? cleanNextInterviewers : undefined,
        });
        const failed = resultResponse?.data?.nextInterviewerEmails?.failed ?? [];
        if (feedbackForm.outcome === "SELECTED") window.setTimeout(() => navigate("/hr/final-selection"), 150);
        setMessage("Interview feedback and outcome recorded.");
        if (failed.length) setError(`Feedback saved, but the next-round email could not be delivered to: ${failed.join(", ")}.`);
      } else {
        setMessage("Interview feedback recorded.");
      }

      setFeedbackEntry(null);
      await load(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not record the interview feedback.");
    } finally {
      setSavingFeedback(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelEntry) return;
    setCancelling(true);
    setError("");
    try {
      await hrApi.cancelInterview(cancelEntry.id, { reason: "Cancelled by HR" });
      setMessage("Interview cancelled.");
      setCancelEntry(null);
      await load(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not cancel the interview.");
    } finally {
      setCancelling(false);
    }
  };

  const columns: Column<any>[] = [
    {
      key: "candidate",
      header: "Candidate",
      render: (row) => (
        <div className="cell-user">
          <div className="avatar">{initials(row.application?.candidate?.fullName || "")}</div>
          <div className="cell-user__text">
            <div className="cell-user__name">{row.application?.candidate?.fullName || "Candidate"}</div>
            <div className="cell-user__sub">{row.application?.jobOpening?.title || "—"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "round",
      header: "Round",
      render: (row) => row.round || "—",
    },
    {
      key: "interviewer",
      header: "Interviewer",
      render: (row) => (
        <div>
          <span>{interviewerSummary(row).names || "—"}</span>
          <div className="cell-muted">{interviewerSummary(row).label}</div>
        </div>
      ),
    },
    {
      key: "scheduledAt",
      header: "Scheduled",
      render: (row) => (
        <div>
          <div>{formatDateTime(row.scheduledAt)}</div>
          <div className="cell-muted">{relativeDay(row.scheduledAt)}</div>
        </div>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      render: (row) => (
        <div>
          <span className={`badge ${row.mode === "ONLINE" ? "badge--blue" : "badge--grey"}`}>
            {row.mode === "ONLINE" ? "Online" : "Offline"}
          </span>
          {row.mode !== "ONLINE" && row.location && <div className="cell-muted">{row.location}</div>}
          {row.mode === "ONLINE" && row.meetingLink && (
            <div className="cell-muted">
              <a href={row.meetingLink} target="_blank" rel="noreferrer">Meeting link</a>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "feedback",
      header: "Feedback",
      render: (row) => {
        const latest = latestFeedback(row);
        if (!latest) return <span className="cell-muted">Not recorded</span>;
        return (
          <div>
            <span className="cell-strong">{latest.result && RESULT_LABELS[latest.result] ? RESULT_LABELS[latest.result] : "Recorded"}</span>
            <div className="cell-muted">{String(latest.recommendation || "No outcome change").replace(/_/g, " ")}</div>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => {
        const active = row.status === "SCHEDULED" || row.status === "RESCHEDULED";
        return (
          <div className="cell-actions">
            {active && (
              <>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  onClick={() => openEntrySchedule(row, "edit")}
                  title="Edit interview"
                  aria-label="Edit interview"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn--danger-ghost btn--icon"
                  onClick={() => setCancelEntry(row)}
                  title="Cancel interview"
                  aria-label="Cancel interview"
                >
                  <XCircle size={16} />
                </button>
              </>
            )}
            {row.status !== "CANCELLED" && (
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                onClick={() => openFeedback(row)}
                title="Record feedback"
                aria-label="Record interview feedback"
              >
                <ClipboardList size={16} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Talent Acquisition"
        title="Interview Management"
        subtitle="Schedule the interview rounds of the shortlisted candidates, track their status and record the interview feedback."
        actions={
          <>
            <Button variant="outline" icon={RefreshCw} onClick={() => void load(true)} loading={refreshing}>
              Refresh data
            </Button>
            <Button icon={CalendarPlus} onClick={openCreate}>
              Schedule Interview
            </Button>
          </>
        }
      />

      {message && (
        <div className="notice notice--success" role="status">
          <div className="notice__body">{message}</div>
        </div>
      )}
      {error && (
        <div className="notice notice--error" role="alert">
          <div className="notice__body">{error}</div>
        </div>
      )}

      <div className="ta-interview-summary">
        <div className="ta-interview-summary__item">
          <span className="ta-interview-summary__label">Upcoming</span>
          <span className="ta-interview-summary__value">{counts.scheduled}</span>
        </div>
        <div className="ta-interview-summary__item">
          <span className="ta-interview-summary__label">Completed</span>
          <span className="ta-interview-summary__value">{counts.completed}</span>
        </div>
        <div className="ta-interview-summary__item">
          <span className="ta-interview-summary__label">Cancelled</span>
          <span className="ta-interview-summary__value">{counts.cancelled}</span>
        </div>
        <div className="ta-interview-summary__item">
          <span className="ta-interview-summary__label">Total records</span>
          <span className="ta-interview-summary__value">{counts.all}</span>
        </div>
      </div>

      <div className="ta-dashboard-grid">
        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title">Interview calendar</div>
              <div className="card__subtitle">Upcoming rounds grouped by day</div>
            </div>
          </div>
          <div className="card__body">
            {calendarDays.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state__icon">
                  <CalendarClock size={28} aria-hidden="true" />
                </span>
                <p className="empty-state__title">No interviews in the calendar</p>
                <p className="empty-state__text">Scheduled rounds appear here as soon as an interview is confirmed.</p>
              </div>
            ) : (
              <div className="ta-calendar">
                {calendarDays.map(([day, entries]) => (
                  <div className="ta-calendar__day" key={day}>
                    <div className="ta-calendar__day-label">{day}</div>
                    <ul className="ta-calendar__list">
                      {entries.map((entry) => (
                        <li className="ta-calendar__item" key={entry.id}>
                          <span className="ta-calendar__time">{formatTime(entry.scheduledAt)}</span>
                          <div className="ta-calendar__body">
                            <div className="ta-calendar__title">
                              {entry.application?.candidate?.fullName || "Candidate"} · {entry.round}
                            </div>
                            <div className="ta-calendar__meta">
                              {entry.interviewerName || "Interviewer"} ·{" "}
                              {entry.mode === "ONLINE" ? "Online" : entry.location || "Offline"}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title">Interview records</div>
              <div className="card__subtitle">All scheduled, completed and cancelled rounds</div>
            </div>
          </div>
          <div className="card__body">
            <div className="page-toolbar">
              <div className="search-box">
                <span className="search-box__icon">
                  <Search size={16} aria-hidden="true" />
                </span>
                <input
                  type="search"
                  className="input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by candidate or interviewer"
                  aria-label="Search interview records"
                />
              </div>
              <div className="filters">
                {FILTERS.map((filter) => (
                  <button
                    type="button"
                    key={filter.key}
                    className={`ta-filter-chip ${statusFilter === filter.key ? "active" : ""}`}
                    onClick={() => setStatusFilter(filter.key)}
                  >
                    {filter.label} <span className="ta-filter-chip__count">{counts[filter.key]}</span>
                  </button>
                ))}
              </div>
            </div>

            <DataTable
              columns={columns}
              rows={visibleEntries}
              rowKey={(row) => row.id}
              loading={loading}
              empty="No interviews in this view. Schedule an interview from the shortlisted candidates to build the interview calendar."
              mobileTitle={(row) => row.application?.candidate?.fullName || "Candidate"}
              mobileMeta={(row) => `${row.round} · ${formatDateTime(row.scheduledAt)}`}
            />
          </div>
        </section>
      </div>

      <Modal
        open={scheduleOpen}
        onClose={closeSchedule}
        title={
          scheduleMode === "reschedule" ? "Reschedule interview" : scheduleMode === "edit" ? "Edit interview" : "Schedule interview"
        }
        subtitle="Interview rounds are validated before they are saved"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeSchedule} disabled={savingSchedule}>
              Cancel
            </Button>
            <Button onClick={submitSchedule} loading={savingSchedule}>
              {scheduleMode === "create" ? "Schedule interview" : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="field field--full">
            <Select
              label="Candidate"
              required
              value={scheduleForm.applicationId}
              onChange={(event) => updateSchedule("applicationId", event.target.value)}
              error={scheduleErrors.applicationId}
              placeholder="Select a shortlisted candidate"
              options={applications
                .filter((application: any) => application.status === "SHORTLISTED" || application.id === scheduleForm.applicationId)
                .map((application: any) => ({
                  value: application.id,
                  label: `${application.candidate?.fullName || "Candidate"} · ${application.jobOpening?.title || "Role"}`,
                }))}
              disabled={scheduleMode !== "create"}
            />
          </div>

          <Select
            label="Interview round"
            required
            value={scheduleForm.round}
            onChange={(event) => updateSchedule("round", event.target.value)}
            error={scheduleErrors.round}
            placeholder="Select the round"
            options={ROUND_OPTIONS}
            disabled={scheduleMode !== "create"}
          />

          <div className="field field--full">
            <div className="field__label">
              Interviewers <span className="field__required" aria-hidden="true">*</span>
            </div>
            <div className="space-y-3">
              {(scheduleForm.interviewers || []).map((entry: any, index: number) => {
                const selectedKey = interviewerOptions.find((option) => interviewerEntryKey(option) === interviewerEntryKey(entry)) ? interviewerEntryKey(entry) : "__MANUAL__";
                return (
                <div key={index} className="interviewer-entry">
                  <div className="interviewer-entry__picker">
                    <label className="field__label" htmlFor={`interviewer-option-${index}`}>Select interviewer</label>
                    <select
                      id={`interviewer-option-${index}`}
                      className="select"
                      value={selectedKey}
                      onChange={(event) => selectScheduleInterviewer(index, event.target.value)}
                    >
                      <option value="__MANUAL__">Other — add name and email manually</option>
                      {interviewerOptions.map((option) => <option key={interviewerEntryKey(option)} value={interviewerEntryKey(option)}>{option.name}{option.email ? ` — ${option.email}` : ""}</option>)}
                    </select>
                  </div>
                  <Input
                    label={`Interviewer ${index + 1} name`}
                    required
                    value={entry.name}
                    onChange={(event) => updateInterviewer(index, "name", event.target.value)}
                    placeholder="Full name"
                  />
                  <Input
                    label="Email"
                    type="email"
                    required
                    value={entry.email}
                    onChange={(event) => updateInterviewer(index, "email", event.target.value)}
                    placeholder="interviewer@company.com"
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    onClick={() => removeInterviewer(index)}
                    disabled={(scheduleForm.interviewers || []).length === 1}
                    aria-label={`Remove interviewer ${index + 1}`}
                    title="Remove interviewer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                );
              })}
              <div className="field__hint">Choose a previously used interviewer, or choose "Other" and add their name and email manually.</div>
              {scheduleErrors.interviewers && <div className="field__error">{scheduleErrors.interviewers}</div>}
              <div className="notice notice--info" role="status">
                <div className="notice__body">
                  <div className="notice__title">
                    Interview type: {(() => { const count = (scheduleForm.interviewers || []).filter((entry: any) => entry.name.trim()).length; return count > 3 ? "Panel Interview" : count >= 2 ? "Multiple Interview" : count === 1 ? "Individual Interview" : "—"; })()}
                  </div>
                  One interviewer is an individual interview, 2–3 is a multiple interview, and 4+ is a panel interview.
                </div>
              </div>
              <Button variant="outline" icon={Plus} onClick={addInterviewer} type="button">Add interviewer</Button>
            </div>
          </div>

          <Input
            label="Interview date"
            type="date"
            required
            value={scheduleForm.date}
            onChange={(event) => updateSchedule("date", event.target.value)}
            error={scheduleErrors.date}
          />

          <Input
            label="Interview time"
            type="time"
            required
            value={scheduleForm.time}
            onChange={(event) => updateSchedule("time", event.target.value)}
            error={scheduleErrors.time}
          />

          <Select
            label="Interview mode"
            required
            value={scheduleForm.mode}
            onChange={(event) => updateSchedule("mode", event.target.value)}
            options={MODE_OPTIONS}
          />

          {scheduleForm.mode === "ONLINE" ? (
            <Input
              label="Meeting link"
              required
              value={scheduleForm.meetingLink}
              onChange={(event) => updateSchedule("meetingLink", event.target.value)}
              error={scheduleErrors.meetingLink}
              placeholder="https://meet.example.com/room"
            />
          ) : (
            <Input
              label="Interview venue"
              required
              value={scheduleForm.location}
              onChange={(event) => updateSchedule("location", event.target.value)}
              error={scheduleErrors.location}
              placeholder="City · Room"
            />
          )}

          <div className="field field--full">
            <Textarea
              label="Interview notes"
              value={scheduleForm.instructions}
              onChange={(event) => updateSchedule("instructions", event.target.value)}
              placeholder="Focus areas for this round"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(feedbackEntry)}
        onClose={closeFeedback}
        title="Interview feedback"
        subtitle={
          feedbackEntry
            ? `${feedbackEntry.application?.candidate?.fullName || "Candidate"} · ${feedbackEntry.round} round`
            : undefined
        }
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeFeedback} disabled={savingFeedback}>
              Cancel
            </Button>
            <Button onClick={submitFeedback} loading={savingFeedback}>
              Submit feedback
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="field field--full">
            <Input
              label="Interviewer name"
              value={feedbackForm.interviewerName}
              onChange={(event) => updateFeedback("interviewerName", event.target.value)}
              placeholder="Who conducted this round?"
            />
          </div>

          <div className="field field--full">
            <Select
              label="Candidate result"
              required
              value={feedbackForm.result}
              onChange={(event) => updateFeedback("result", event.target.value)}
              placeholder="Choose the result"
              options={RESULT_OPTIONS}
              error={feedbackErrors.result}
            />
          </div>

          <div className="field field--full">
            <Select
              label="Outcome"
              value={feedbackForm.outcome}
              onChange={(event) => updateFeedback("outcome", event.target.value)}
              placeholder="No outcome change"
              options={OUTCOME_OPTIONS}
            />
          </div>

          {feedbackForm.outcome === "NEXT_ROUND" && (
            <>
              <div className="field field--full">
                <div className="field__label">Interviewers for the next round <span className="field__required" aria-hidden="true">*</span></div>
                <div className="interviewer-list">
                  {feedbackInterviewers.map((entry, index) => {
                    const selectedKey = interviewerOptions.find((option) => interviewerEntryKey(option) === interviewerEntryKey(entry)) ? interviewerEntryKey(entry) : "__MANUAL__";
                    return (
                      <div className="interviewer-entry" key={index}>
                        <div className="interviewer-entry__picker">
                          <label className="field__label" htmlFor={`next-interviewer-option-${index}`}>Select interviewer</label>
                          <select id={`next-interviewer-option-${index}`} className="select" value={selectedKey} onChange={(event) => selectFeedbackInterviewer(index, event.target.value)}>
                            <option value="__MANUAL__">Other — add name and email manually</option>
                            {interviewerOptions.map((option) => <option key={interviewerEntryKey(option)} value={interviewerEntryKey(option)}>{option.name}{option.email ? ` — ${option.email}` : ""}</option>)}
                          </select>
                        </div>
                        <Input label={`Interviewer ${index + 1} name`} required value={entry.name} onChange={(event) => updateFeedbackInterviewer(index, "name", event.target.value)} placeholder="Full name" />
                        <Input label="Email" type="email" required value={entry.email} onChange={(event) => updateFeedbackInterviewer(index, "email", event.target.value)} placeholder="interviewer@company.com" />
                        <button type="button" className="btn btn--ghost btn--icon" onClick={() => removeFeedbackInterviewer(index)} disabled={feedbackInterviewers.length === 1} aria-label={`Remove interviewer ${index + 1}`} title="Remove interviewer"><Trash2 size={16} /></button>
                      </div>
                    );
                  })}
                  <div className="field__hint">Pick an interviewer used earlier, or choose "Other" and enter their name and email manually.</div>
                  {feedbackErrors.interviewers && <div className="field__error">{feedbackErrors.interviewers}</div>}
                  <Button variant="outline" icon={Plus} onClick={addFeedbackInterviewer} type="button">Add interviewer</Button>
                </div>
              </div>
              <Input
                label="Next round"
                value={feedbackForm.nextRound}
                onChange={(event) => updateFeedback("nextRound", event.target.value)}
                placeholder="Technical Round 2"
              />
              <Input
                label="Next round date & time"
                type="datetime-local"
                required
                value={feedbackForm.nextDate}
                onChange={(event) => updateFeedback("nextDate", event.target.value)}
                error={feedbackErrors.nextDate}
              />
            </>
          )}

          <div className="field field--full">
            <Textarea
              label="Interview remarks"
              required
              value={feedbackForm.remarks}
              onChange={(event) => updateFeedback("remarks", event.target.value)}
              error={feedbackErrors.remarks}
              placeholder="Summarise the strengths and the gaps observed in this round"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(cancelEntry)}
        onClose={() => (cancelling ? undefined : setCancelEntry(null))}
        title="Cancel interview"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelEntry(null)} disabled={cancelling}>
              Keep interview
            </Button>
            <Button variant="danger" onClick={confirmCancel} loading={cancelling}>
              Cancel interview
            </Button>
          </>
        }
      >
        <p>
          {cancelEntry
            ? `The ${cancelEntry.round} round of ${cancelEntry.application?.candidate?.fullName || "the candidate"} will be cancelled and the candidate will be notified.`
            : "The interview will be cancelled."}
        </p>
      </Modal>

      <Modal
        open={Boolean(selectedForOffer)}
        onClose={() => setSelectedForOffer(null)}
        title="Candidate selected"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelectedForOffer(null)}>
              Later
            </Button>
            <Button
              onClick={() => navigate(`/hr/offers?applicationId=${selectedForOffer?.application?.id ?? ""}`)}
            >
              Create Offer Letter
            </Button>
          </>
        }
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#659616]/15 flex items-center justify-center mb-4">
            <CheckCircle2 size={32} className="text-[#659616]" />
          </div>
          <p>
            <span className="font-semibold ink-body">{selectedForOffer?.application?.candidate?.fullName}</span> for{" "}
            <span className="font-semibold ink-body">{selectedForOffer?.application?.jobOpening?.title}</span> has been
            moved to SELECTED and is ready for an offer letter.
          </p>
        </div>
      </Modal>
    </div>
  );
}
