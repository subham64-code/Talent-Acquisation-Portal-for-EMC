import { useState } from "react";
import { AlertCircle, CheckCircle2, Copy, ExternalLink, Mail, Send, UsersRound, UserPlus } from "lucide-react";
import Modal from "../../../components/ref/Modal";
import Button from "../../../components/ref/Button";
import { Input, Textarea } from "../../../components/ref/Input";
import { hrApi } from "../../../lib/api";
import { useInvalidate } from "../../../hooks/useApiQuery";

type Mode = "individual" | "bulk";

export default function InvitationFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [mode, setMode] = useState<Mode>("individual");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ link: string; expiresAt: string; email: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ invited: number; created: number; skipped: Array<{ email: string; reason: string }>; failed: Array<{ email: string; reason: string }> } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail("");
    setFullName("");
    setBulkEmails("");
    setError("");
    setResult(null);
    setBulkResult(null);
    setCopied(false);
  };

  const closeModal = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const submitIndividual = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Enter a valid employee email address.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await hrApi.sendEmployeeInvitation({ email: email.trim(), fullName: fullName.trim() || undefined });
      const data = res?.data ?? res;
      setResult({ link: data.link, expiresAt: data.expiresAt, email: email.trim() });
      invalidate(["employee-invitations", "employees", "dashboard"]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The invitation could not be created.");
    } finally {
      setSending(false);
    }
  };

  const submitBulk = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const emails = Array.from(new Set(bulkEmails.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean)));
    const invalid = emails.filter((item) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(item));
    if (emails.length === 0) {
      setError("Paste at least one employee email address.");
      return;
    }
    if (invalid.length) {
      setError(`Invalid email address${invalid.length === 1 ? "" : "es"}: ${invalid.join(", ")}`);
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await hrApi.bulkInvitations(emails);
      const data = res?.data ?? res;
      setBulkResult({
        invited: Number(data.invited ?? 0),
        created: Number(data.created ?? 0),
        skipped: Array.isArray(data.skipped) ? data.skipped : [],
        failed: Array.isArray(data.failed) ? data.failed : [],
      });
      invalidate(["employee-invitations", "employees", "dashboard"]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not send the bulk invitations.");
    } finally {
      setSending(false);
    }
  };

  const copy = async (link?: string) => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy automatically. Select the link and copy it manually.");
    }
  };

  const errorNotice = error ? (
    <div className="form-alert form-alert--error" role="alert">
      <AlertCircle size={17} aria-hidden="true" />
      <span>{error}</span>
    </div>
  ) : null;

  const successIndividual = result ? (
    <div className="invite-result">
      <div className="invite-result__head">
        <span className="invite-result__icon"><CheckCircle2 size={22} aria-hidden="true" /></span>
        <div>
          <h3 className="invite-result__title">Invitation sent</h3>
          <p className="invite-result__text">For <strong>{result.email}</strong></p>
        </div>
      </div>
      <div className="notice notice--info">
        <span className="notice__icon"><Mail size={18} aria-hidden="true" /></span>
        <div className="notice__body">
          <div className="notice__title">Self-service invitation sent</div>
          <div>The secure link asks the employee to update profile, professional and education details plus upload a CV. HR validates the submission and the Employee Databank is updated.</div>
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="invite-result-link">Employee invitation link</label>
        <div className="invite-result__link-row">
          <input
            id="invite-result-link"
            className="input"
            value={result.link}
            readOnly
            onFocus={(event) => event.target.select()}
          />
          <Button variant="outline" icon={Copy} onClick={() => copy(result.link)} type="button">{copied ? "Copied" : "Copy"}</Button>
        </div>
        <span className="field__hint">This link never expires.</span>
      </div>
      <div className="form-actions">
        <Button variant="outline" onClick={reset} type="button">Send another invitation</Button>
        <a className="btn btn--primary" href={result.link} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true" /> Open invitation</a>
        <Button onClick={() => { reset(); onClose(); }} type="button">Done</Button>
      </div>
    </div>
  ) : null;

  const successBulk = bulkResult ? (
    <div className="invite-result">
      <div className="invite-result__head">
        <span className="invite-result__icon"><CheckCircle2 size={22} aria-hidden="true" /></span>
        <div>
          <h3 className="invite-result__title">Bulk invitations sent</h3>
          <p className="invite-result__text">{bulkResult.invited} invitations queued · {bulkResult.created} new employee records created</p>
        </div>
      </div>
      <div className="notice notice--info">
        <span className="notice__icon"><UsersRound size={18} aria-hidden="true" /></span>
        <div className="notice__body">
          <div className="notice__title">Self-service invitations sent</div>
          <div>Every recipient receives an email with the instructions. When HR validates each submission, the Employee Databank is updated automatically.</div>
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-item"><div className="detail-item__label">Invited</div><div className="detail-item__value">{bulkResult.invited}</div></div>
        <div className="detail-item"><div className="detail-item__label">New records</div><div className="detail-item__value">{bulkResult.created}</div></div>
        <div className="detail-item"><div className="detail-item__label">Skipped</div><div className="detail-item__value">{bulkResult.skipped.length}</div></div>
        <div className="detail-item"><div className="detail-item__label">Failed</div><div className="detail-item__value">{bulkResult.failed.length}</div></div>
      </div>
      {(bulkResult.skipped.length > 0 || bulkResult.failed.length > 0) && (
        <div className="detail-section">
          <div className="detail-section__title">Skipped and failed</div>
          <ul className="reminder-history">
            {[...bulkResult.skipped.map((item) => ({ ...item, tone: "skipped" })), ...bulkResult.failed.map((item) => ({ ...item, tone: "failed" }))].map((item, index) => (
              <li className="reminder-history__item" key={`${item.email}-${index}`}>
                <div>
                  <div className="reminder-history__title">{item.email}</div>
                  <div className="reminder-history__meta">{item.reason}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="form-actions">
        <Button variant="outline" onClick={reset} type="button">Send more invitations</Button>
        <Button onClick={() => { reset(); onClose(); }} type="button">Done</Button>
      </div>
    </div>
  ) : null;

  const individualForm = (
    <form onSubmit={submitIndividual} noValidate>
      {errorNotice}
      <div className="form-grid">
        <Input label="Employee Full Name" optional value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Ananya Sharma" autoComplete="name" disabled={sending} className="field--full" />
        <Input label="Employee Email Address" required type="email" icon={Mail} value={email} onChange={(event) => { setEmail(event.target.value); if (error) setError(""); }} placeholder="employee@company.com" autoComplete="email" disabled={sending} className="field--full" />
      </div>
      <div className="notice notice--info" style={{ marginTop: "1rem" }}>
        <span className="notice__icon"><Mail size={17} aria-hidden="true" /></span>
        <div className="notice__body">
          <div className="notice__title">Self-service invitation</div>
          The link asks the employee to update personal, professional and education details plus upload a CV. Email delivery follows the SMTP/simulated environment.
        </div>
      </div>
      <div className="form-actions">
        <Button type="submit" icon={Send} loading={sending}>{sending ? "Creating invitation…" : "Send Invitation"}</Button>
      </div>
    </form>
  );

  const bulkForm = (
    <form onSubmit={submitBulk} noValidate>
      {errorNotice}
      <div className="field field--full">
        <Textarea label="Employee Email Addresses" required value={bulkEmails} onChange={(event) => { setBulkEmails(event.target.value); if (error) setError(""); }} placeholder={"Paste emails, one per line (or separated by commas / semicolons)"} rows={7} disabled={sending} />
        <p className="field__hint">Send many profile-copy invitations at once. New employees are created as placeholders automatically.</p>
      </div>
      <div className="notice notice--info" style={{ marginTop: "0.75rem" }}>
        <span className="notice__icon"><UsersRound size={17} aria-hidden="true" /></span>
        <div className="notice__body">
          <div className="notice__title">Bulk operation</div>
          Every email is logged. Employees open the link, update details and upload a CV. HR validates each submission and the Employee Databank is synced.
        </div>
      </div>
      <div className="form-actions">
        <Button type="submit" icon={Send} loading={sending}>{sending ? "Sending invitations…" : "Send Bulk Invitations"}</Button>
      </div>
    </form>
  );

  const tabs = (
    <div className="ta-applications-toolbar__row" style={{ marginBottom: "1rem" }}>
      <button type="button" className={`ta-filter-chip ${mode === "individual" ? "active" : ""}`} onClick={() => { setMode("individual"); setError(""); }}>
        <UserPlus size={15} aria-hidden="true" /> Individual invite
      </button>
      <button type="button" className={`ta-filter-chip ${mode === "bulk" ? "active" : ""}`} onClick={() => { setMode("bulk"); setError(""); }}>
        <UsersRound size={15} aria-hidden="true" /> Bulk invite
      </button>
    </div>
  );

  const content = result || bulkResult ? (successIndividual ?? successBulk) : (
    <>
      {tabs}
      {mode === "individual" ? individualForm : bulkForm}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Send Employee Invitation"
      subtitle="Create individual or bulk self-service invitations for profile updates, education details and CV uploads."
      size="md"
    >
      {content}
    </Modal>
  );
}
