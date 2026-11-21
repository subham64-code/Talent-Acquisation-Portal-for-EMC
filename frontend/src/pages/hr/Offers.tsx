import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { BellRing, FileSearch, FileText, Pencil, Plus, RefreshCw, Search, Send } from "lucide-react";
import { hrApi } from "../../lib/api";
import { useInvalidate } from "../../hooks/useApiQuery";
import DataTable, { type Column } from "../../components/DataTable";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Badge from "../../components/ref/Badge";
import EmptyState from "../../components/ref/EmptyState";
import Modal from "../../components/ref/Modal";
import { Select, Input, Textarea } from "../../components/ref/Input";
import { formatDate, initials } from "./databank/shared";

const OFFER_META: Record<string, { label: string; variant: "green" | "orange" | "blue" | "red" | "grey" }> = {
  DRAFT: { label: "Draft", variant: "grey" },
  SENT: { label: "Sent", variant: "orange" },
  VIEWED: { label: "Viewed", variant: "blue" },
  PENDING: { label: "Pending response", variant: "orange" },
  ACCEPTED: { label: "Accepted", variant: "green" },
  DECLINED: { label: "Rejected", variant: "red" },
  EXPIRED: { label: "Expired", variant: "grey" },
  WITHDRAWN: { label: "Withdrawn", variant: "grey" },
};

export default function Offers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [, setPreselectId] = useState("");
  const [form, setForm] = useState<Record<string, string>>({ status: "DRAFT" });
  const [saving, setSaving] = useState(false);
  const [sendTarget, setSendTarget] = useState<any>(null);
  const [remindTarget, setRemindTarget] = useState<any>(null);
  const [previewing, setPreviewing] = useState<any>(null);
  const [letterPreview, setLetterPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = useInvalidate();

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

  const honorificOf = (candidate: any) => {
    const extra = parseJsonSafe(candidate?.additionalInfo);
    const raw = String(extra?.gender ?? candidate?.gender ?? "").trim().toLowerCase();
    if (raw.startsWith("m")) return "Mr.";
      if (raw.startsWith("f") || raw.startsWith("w")) return "Mrs.";
    return "";
  };

  const deriveGrade = (offer: any) => {
    const raw = String(offer?.salaryStructure ?? "") + " " + JSON.stringify(parseJsonSafe(offer?.additionalConditions) ?? {});
    const match = raw.match(/grade\s*[:=-]?\s*([A-Za-z0-9-]+)/i);
    return match?.[1]?.toUpperCase() ?? "_____";
  };

  const appId = searchParams.get("applicationId");
  const salaryParam = searchParams.get("ctc");
  useEffect(() => {
    if (appId || salaryParam) {
      setFormOpen(true);
      const params = new URLSearchParams(searchParams);
      const applicationId = appId ?? undefined;
      setPreselectId(appId || "");
      setForm((current) => ({ ...current, applicationId: applicationId || current.applicationId, ctc: salaryParam || current.ctc }));
      params.delete("applicationId");
      params.delete("ctc");
      setSearchParams(params, { replace: true });
    }
  }, [appId, salaryParam, searchParams, setSearchParams]);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      hrApi.offers({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? r?.data ?? []).catch(() => []),
      hrApi.applications({ page: 1, pageSize: 100, status: "SELECTED", full: 1 }).then((r: any) => r?.data?.items ?? []).catch(() => []),
      hrApi.employmentTypes({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? r?.data ?? []).catch(() => []),
    ])
      .then(([offerRows, selected, employmentTypes]) => {
        setItems(offerRows);
        setApplications(selected);
        setTypes(employmentTypes);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const offeredApplicationIds = useMemo(() => new Set(items.map((o: any) => o.applicationId).filter(Boolean)), [items]);
  const editingApplication = editingId ? items.find((offer: any) => offer.id === editingId)?.application : null;
  const eligibleApplications = useMemo(() => {
    const base = applications.filter((a: any) => !offeredApplicationIds.has(a.id) && Boolean(a.adminApprovedAt));
    if (editingApplication && !base.some((a: any) => a.id === editingApplication.id)) return [editingApplication, ...base];
    return base;
  }, [applications, offeredApplicationIds, editingApplication]);

  const counts = {
    draft: items.filter((o) => o.status === "DRAFT").length,
    pending: items.filter((o) => o.status === "SENT" || o.status === "VIEWED").length,
    accepted: items.filter((o) => o.status === "ACCEPTED").length,
    declined: items.filter((o) => o.status === "DECLINED").length,
    hold: items.filter((o) => o.application?.status === "ON_HOLD" || o.status === "EXPIRED").length,
    all: items.length,
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((offer) => {
      const matchesStatus = !statusFilter
        || (statusFilter === "PENDING" ? ["SENT", "VIEWED"].includes(offer.status)
          : statusFilter === "HOLD" ? (offer.application?.status === "ON_HOLD" || offer.status === "EXPIRED")
          : offer.status === statusFilter);
      if (!matchesStatus) return false;
      if (!term) return true;
      return [offer.application?.candidate?.fullName, offer.application?.candidate?.email, offer.application?.jobOpening?.title, offer.designation, offer.application?.applicationCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [items, search, statusFilter]);

  useEffect(() => {
    const selected = applications.find((a: any) => a.id === form.applicationId);
    if (selected) {
      setForm((current) => ({
        ...current,
        designation: current.designation?.trim() ? current.designation : selected.jobOpening?.title ?? "",
      }));
    }
  }, [form.applicationId, applications]);

  const openCreate = (applicationId = "") => {
    setEditingId("");
    setForm({ status: "DRAFT", applicationId });
    setPreselectId(applicationId);
    setFormOpen(true);
    setNotice("");
  };

  const openEdit = (offer: any) => {
    const dateValue = (value: any) => value ? new Date(value).toISOString().slice(0, 10) : "";
    setEditingId(offer.id);
    setForm({
      status: offer.status ?? "DRAFT",
      applicationId: offer.applicationId ?? "",
      designation: offer.designation ?? "",
      ctc: offer.ctc != null ? String(offer.ctc) : "",
      employmentTypeId: offer.employmentTypeId ?? "",
      joiningDate: dateValue(offer.joiningDate),
      workLocation: offer.workLocation ?? "",
      expiryDate: dateValue(offer.expiryDate),
      additionalConditions: offer.additionalConditions ?? "",
      salaryStructure: offer.salaryStructure ?? "",
    });
    setPreselectId(offer.applicationId ?? "");
    setFormOpen(true);
    setNotice("");
    setError("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ctcValue = form.ctc ? Number(form.ctc) : NaN;
    if (!form.applicationId) {
      setError("Choose the approved candidate for this offer.");
      return;
    }
    if (!form.designation?.trim()) {
      setError("Enter the designation for the offer.");
      return;
    }
    if (!Number.isFinite(ctcValue) || ctcValue <= 0) {
      setError("Enter the annual salary package in INR.");
      return;
    }
    if (!form.joiningDate) {
      setError("Choose the joining date for the offer.");
      return;
    }
    if (form.expiryDate && new Date(form.expiryDate).getTime() < new Date(form.joiningDate).getTime()) {
      setError("The offer expiry date cannot be before the joining date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        applicationId: form.applicationId,
        ctc: form.ctc ? Number(form.ctc) : undefined,
      };
      if (editingId) {
        await hrApi.updateOffer(editingId, payload);
        setNotice("Offer updated. Generate the revised PDF and share it with the candidate.");
      } else {
        await hrApi.createOffer(payload);
        setNotice("Offer letter created as a draft.");
      }
      setFormOpen(false);
      invalidate(["offers", "applications", "dashboard"]);
      load(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Offer creation failed.");
    } finally {
      setSaving(false);
    }
  };

  const generatePdf = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await hrApi.generateOfferPdf(id);
      setNotice("Offer letter PDF generated.");
      load(true);
    } catch (err: any) { setError(err.response?.data?.error?.message || "PDF generation failed."); } finally { setBusy(false); }
  };

  const confirmSend = async () => {
    if (!sendTarget) return;
    setBusy(true);
    setError("");
    try {
      // The offer email carries the PDF — generate it first when it does not exist yet.
      if (!sendTarget.pdfFileId) {
        await hrApi.generateOfferPdf(sendTarget.id);
      }
      await hrApi.sendOffer(sendTarget.id);
      setNotice(`The offer email for ${sendTarget.application?.candidate?.fullName} was sent.`);
      setSendTarget(null);
      load(true);
    } catch (err: any) { setError(err.response?.data?.error?.message || "Send failed."); } finally { setBusy(false); }
  };

  const confirmRemind = async () => {
    if (!remindTarget) return;
    setBusy(true);
    setError("");
    try {
      await hrApi.remindOffer(remindTarget.id);
      setNotice(`A reminder was sent to ${remindTarget.application?.candidate?.fullName}.`);
      setRemindTarget(null);
      load(true);
    } catch (err: any) { setError(err.response?.data?.error?.message || "Reminder failed."); } finally { setBusy(false); }
  };

  const columns: Column<any>[] = [
    { key: "candidate", header: "Candidate", render: (o) => <div className="cell-user"><div className="avatar">{initials(o.application?.candidate?.fullName || "")}</div><div className="cell-user__text"><div className="cell-user__name">{o.application?.candidate?.fullName}</div><div className="cell-user__sub">{o.application?.candidate?.email}</div></div></div> },
    { key: "position", header: "Position", render: (o) => <div><div>{o.application?.jobOpening?.title}</div><div className="cell-muted">{o.designation}</div></div> },
    { key: "ctc", header: "CTC", render: (o) => o.ctc != null ? `₹ ${Number(o.ctc).toLocaleString()}` : "—" },
    { key: "joining", header: "Joining", render: (o) => <span className="cell-muted">{formatDate(o.joiningDate)}</span> },
    { key: "expiry", header: "Expiry", render: (o) => <div><span className="cell-muted">{formatDate(o.expiryDate)}</span>{["SENT", "VIEWED"].includes(o.status) && o.sentAt && <div className="cell-muted">{Math.min(7, Math.floor((Date.now() - new Date(o.sentAt).getTime()) / 86400000) + 1)} of 7 days to respond</div>}</div> },
    { key: "status", header: "Status", render: (o) => { const meta = OFFER_META[o.status] ?? (o.status === "PENDING" ? OFFER_META.PENDING : { label: o.status, variant: "grey" as const }); return <Badge variant={meta.variant} dot>{meta.label}</Badge>; } },
    { key: "response", header: "Candidate response", render: (o) => o.responseRemarks ? <div className="offer-response" title={o.responseRemarks}><span>{o.responseRemarks}</span>{o.respondedAt && <small>{formatDate(o.respondedAt)}</small>}</div> : <span className="cell-muted">—</span> },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (o) => (
        <div className="cell-actions">
          <button type="button" className="btn btn--ghost btn--icon" title="Edit offer" aria-label="Edit offer" onClick={() => openEdit(o)}><Pencil size={16} /></button>
          <button type="button" className="btn btn--ghost btn--icon" title="Preview appointment letter" aria-label="Preview appointment letter" onClick={() => setLetterPreview(o)}><FileSearch size={16} /></button>
          {!o.pdfFileId && <button type="button" className="btn btn--outline btn--sm" title="Generate PDF" aria-label="Generate PDF" onClick={() => void generatePdf(o.id)} disabled={busy}>Generate PDF</button>}
          {o.pdfFileId && <button type="button" className="btn btn--outline btn--sm" title={o.status === "DRAFT" ? "Generate PDF" : "Regenerate PDF with the latest details"} aria-label="Regenerate PDF" onClick={() => void generatePdf(o.id)} disabled={busy}>Regenerate PDF</button>}
          {o.pdfFileId && ["DRAFT", "SENT", "VIEWED"].includes(o.status) && <button type="button" className="btn btn--primary btn--sm" title="Share offer with candidate" aria-label="Share offer" onClick={() => setSendTarget(o)}>{o.status === "DRAFT" ? "Send Offer" : "Share Offer"}</button>}
          {["SENT", "VIEWED"].includes(o.status) && <button type="button" className="btn btn--outline btn--sm" title="Send offer reminder" aria-label="Send offer reminder" onClick={() => setRemindTarget(o)}>Remind</button>}
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Talent Acquisition"
        title="Offer Management"
        subtitle="Create the offer of an approved candidate, dispatch it via email and track the candidate's response."
        actions={<><Button variant="outline" icon={RefreshCw} onClick={() => load(true)}>Refresh data</Button><Button icon={Plus} onClick={() => openCreate("")}>Create Offer</Button></>}
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      {eligibleApplications.length > 0 && (
        <section className="card">
          <div className="card__header"><div><div className="card__title">Approved — Awaiting HR Offer</div><div className="card__subtitle">These candidates were approved by the administrator and are waiting for you to prepare their offer. Approval does not create an offer automatically.</div></div></div>
          <div className="card__body">
            <ul className="ta-list">
              {eligibleApplications.map((entry: any) => (
                <li className="ta-list__item" key={entry.id}>
                  <div className="ta-list__body"><div className="ta-list__title">{entry.candidate?.fullName}</div><div className="ta-list__meta">{entry.jobOpening?.title} · {entry.applicationCode}</div></div>
                  <Button size="sm" variant="outline" onClick={() => openCreate(entry.id)}>Prepare offer</Button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="ta-interview-summary">
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Draft</span><span className="ta-interview-summary__value">{counts.draft}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Pending response</span><span className="ta-interview-summary__value">{counts.pending}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Accepted</span><span className="ta-interview-summary__value">{counts.accepted}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Declined</span><span className="ta-interview-summary__value">{counts.declined}</span></div>
        <div className="ta-interview-summary__item"><span className="ta-interview-summary__label">Hold</span><span className="ta-interview-summary__value">{counts.hold}</span></div>
      </div>

      <div className="page-toolbar">
        <div className="search-box"><span className="search-box__icon"><Search size={16} aria-hidden="true" /></span><input type="search" className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by candidate, application ID or position" aria-label="Search offers" /></div>
        <div className="filters">
          {["", "DRAFT", "PENDING", "ACCEPTED", "DECLINED", "HOLD"].map((value) => <button type="button" key={value || "all"} className={`ta-filter-chip ${statusFilter === value ? "active" : ""}`} onClick={() => setStatusFilter(value)}>{value ? (value === "HOLD" ? "Hold" : OFFER_META[value]?.label ?? value) : "All"} <span className="ta-filter-chip__count">{value === "" ? counts.all : value === "PENDING" ? counts.pending : value === "HOLD" ? counts.hold : items.filter((o) => o.status === value).length}</span></button>)}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        empty={<EmptyState icon={FileText} title="No offers in this view" description="Create an offer for an approved candidate to build the outgoing offer list." action={eligibleApplications.length > 0 && <Button size="sm" icon={Plus} onClick={() => openCreate(eligibleApplications[0].id)}>Create Offer</Button>} />}
        footer={<><span>Showing <strong>{filtered.length}</strong> of <strong>{items.length}</strong> offers</span><span className="cell-muted">Email delivery is logged in the audit trail</span></>}
      />

      <Modal
        open={formOpen}
        onClose={() => (saving ? undefined : setFormOpen(false))}
        title={editingId ? "Edit Offer Letter" : "Create Offer Letter"}
        subtitle={editingId ? "After saving, regenerate the PDF and share the revised letter with the candidate" : "The offer is saved as a draft until HR explicitly sends it"}
        size="lg"
        footer={<><Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" form="offer-form" loading={saving}>{editingId ? "Save changes" : "Create draft offer"}</Button></>}
      >
        <form id="offer-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field field--full">
              <Select label="Approved candidate" required value={form.applicationId || ""} onChange={(event) => setForm((p) => ({ ...p, applicationId: event.target.value }))} placeholder="Select candidate" options={applications.map((a: any) => ({ value: a.id, label: `${a.candidate?.fullName} · ${a.jobOpening?.title}` }))} error={!form.applicationId && error ? error : undefined} />
              {eligibleApplications.length === 0 && <span className="field__hint">No approved candidates are waiting for an offer.</span>}
            </div>
            <Input label="Designation" required value={form.designation || ""} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))} placeholder="e.g. Senior Engineer" />
            <Input label="Annual CTC" type="number" value={form.ctc || ""} onChange={(e) => setForm((p) => ({ ...p, ctc: e.target.value }))} placeholder="e.g. 1200000" />
            <Select label="Employment Type" value={form.employmentTypeId || ""} onChange={(e) => setForm((p) => ({ ...p, employmentTypeId: e.target.value }))} placeholder="Select employment type" options={types.map((t: any) => ({ value: t.id, label: t.name }))} />
            <Input label="Joining Date" type="date" value={form.joiningDate || ""} onChange={(e) => setForm((p) => ({ ...p, joiningDate: e.target.value }))} />
            <Input label="Work Location" value={form.workLocation || ""} onChange={(e) => setForm((p) => ({ ...p, workLocation: e.target.value }))} placeholder="e.g. Bhubaneswar" />
            <Input label="Offer Expiry" type="date" value={form.expiryDate || ""} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} />
            <div className="field field--full"><Textarea label="Additional Conditions" value={form.additionalConditions || ""} onChange={(e) => setForm((p) => ({ ...p, additionalConditions: e.target.value }))} placeholder="Add conditions, probation, notice period…" rows={3} /></div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(sendTarget)}
        onClose={() => (busy ? undefined : setSendTarget(null))}
        title="Send offer letter"
        size="sm"
        footer={<><Button variant="outline" onClick={() => setSendTarget(null)} disabled={busy}>Cancel</Button><Button icon={Send} onClick={confirmSend} loading={busy}>Send offer</Button></>}
      >
        <p>{sendTarget ? `Sure you want to send the offer to ${sendTarget.application?.candidate?.fullName}?` : "The offer will be sent."}</p>
      </Modal>

      <Modal
        open={Boolean(remindTarget)}
        onClose={() => (busy ? undefined : setRemindTarget(null))}
        title="Send offer reminder"
        size="sm"
        footer={<><Button variant="outline" onClick={() => setRemindTarget(null)} disabled={busy}>Cancel</Button><Button icon={BellRing} onClick={confirmRemind} loading={busy}>Send reminder</Button></>}
      >
        <p>{remindTarget ? `A reminder email will be sent to ${remindTarget.application?.candidate?.fullName} at ${remindTarget.application?.candidate?.email}. They will receive a fresh secure offer-response link.` : "The reminder will be sent."}</p>
      </Modal>

      <Modal
        open={Boolean(previewing)}
        onClose={() => { if (previewing?.url?.startsWith("blob:")) URL.revokeObjectURL(previewing.url); setPreviewing(null); }}
        title="Offer Letter"
        size="lg"
      >
        {previewing && <iframe title={previewing.name} src={previewing.url} style={{ width: "100%", height: 520, border: 0 }} />}
      </Modal>

      <Modal
        open={Boolean(letterPreview)}
        onClose={() => setLetterPreview(null)}
        title="Offer letter"
        subtitle={letterPreview ? `${letterPreview.designation} · ${letterPreview.application?.candidate?.fullName}` : undefined}
        size="lg"
        footer={letterPreview ? (
          <>
            <span className="modal__footer-note">The preview is generated from the stored offer record.</span>
            <Button variant="outline" onClick={() => setLetterPreview(null)}>Close</Button>
            <Button variant="outline" icon={RefreshCw} onClick={() => void generatePdf(letterPreview.id)} loading={busy}>{letterPreview.pdfFileId ? "Regenerate PDF" : "Generate PDF"}</Button>
            <Button icon={Send} disabled={!letterPreview.pdfFileId} onClick={() => { const target = letterPreview; setLetterPreview(null); setSendTarget(target); }}>Send PDF to candidate</Button>
          </>
        ) : undefined}
      >
        {letterPreview && (() => {
            const issueDate = letterPreview?.createdAt ? new Date(letterPreview.createdAt) : new Date();
            const candidate = letterPreview?.application?.candidate;
            const name = candidate?.fullName || "Candidate";
            const hon = honorificOf(candidate);
            const addressLines = deriveCandidateAddress(candidate);
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
                    <p><strong>{[hon, name].filter(Boolean).join(" ")}</strong></p>
                    {addressLines.map((line, index) => <p key={index}>{line}</p>)}
                  </div>
                </div>

                <h3 className="appointment-letter__title">Appointment Letter</h3>
                <div className="appointment-letter__body">
                  <p className="appointment-letter__salutation">Dear {[hon, name].filter(Boolean).join(" ")},</p>
                  <p>Candidate ID: {candidate?.candidateCode} &nbsp;|&nbsp; Application ID: {letterPreview?.application?.applicationCode}</p>
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
                  <div className="appointment-letter__signature-stamp" aria-label="Digitally signed by EMC Authorised">
                    <span className="appointment-letter__signature-stamp-eyebrow">Digitally signed</span>
                    <span className="appointment-letter__signature-stamp-script">EMC Authorised</span>
                    <span className="appointment-letter__signature-stamp-date">Date: {ordinalDate(issueDate)}</span>
                  </div>
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
      </Modal>
    </div>
  );
}
