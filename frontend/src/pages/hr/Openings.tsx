import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Edit3, ExternalLink, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { hrApi } from "../../lib/api";
import { useDebounced } from "../../hooks/useDebounced";
import { useApiQuery, queryKeys, useInvalidate } from "../../hooks/useApiQuery";
import PageHeading from "../../components/ref/PageHeading";
import Button from "../../components/ref/Button";
import Modal from "../../components/ref/Modal";
import { Input, Select, Textarea } from "../../components/ref/Input";
import StatusPill from "../../components/ref/StatusPill";

const EMPTY = {
  jobCode: "",
  title: "",
  positions: "1",
  location: "",
  employmentTypeId: "",
  requiredQualification: "",
  minExperience: "",
  maxExperience: "",
  deadline: "",
  description: "",
  requiredSkills: "",
  status: "DRAFT",
};

const toNumberOrZero = (value: string | undefined) => (value?.trim() ? Number(value) : 0);

export default function Openings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const invalidate = useInvalidate();
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY });
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [viewStatus, setViewStatus] = useState<"open" | "closed" | "archive" | "all">(() => { const value = searchParams.get("view"); return value === "closed" || value === "archive" ? value : "open"; });
  const debouncedSearch = useDebounced(search);

  useEffect(() => {
    const value = searchParams.get("view");
    setViewStatus(value === "closed" || value === "archive" ? value : "open");
  }, [searchParams]);

  const selectView = (value: "open" | "closed" | "archive" | "all") => {
    setViewStatus(value);
    setSearchParams(value === "open" ? {} : value === "all" ? { view: "all" } : { view: value }, { replace: true });
  };

  const params = useMemo(
    () => ({ page: 1, pageSize: 100, search: debouncedSearch || undefined }),
    [debouncedSearch],
  );

  const { data: items = [], isLoading } = useApiQuery<any[]>(
    queryKeys.openings(params),
    () => hrApi.openings(params).then((r: any) => r?.data?.items ?? []),
  );
  const { data: types = [] } = useApiQuery<any[]>(
    ["employment-types", "dropdown"],
    () => hrApi.employmentTypes().then((r: any) => r?.data?.items ?? r?.data ?? []),
  );

  const visibleItems = useMemo(
    () => items.filter((opening: any) => viewStatus === "all"
      || (viewStatus === "open" && opening.status !== "CLOSED" && opening.status !== "ARCHIVED")
      || (viewStatus === "closed" && opening.status === "CLOSED")
      || (viewStatus === "archive" && opening.status === "ARCHIVED")),
    [items, viewStatus],
  );
  const openCount = items.filter((opening: any) => opening.status !== "CLOSED" && opening.status !== "ARCHIVED").length;
  const closedCount = items.filter((opening: any) => opening.status === "CLOSED").length;
  const archivedCount = items.filter((opening: any) => opening.status === "ARCHIVED").length;

  const openCreate = () => {
    setEditingId("");
    setForm({ ...EMPTY, minExperience: "0" });
    setJdFile(null);
    setError("");
    setShowForm(true);
  };

  const openEdit = (opening: any) => {
    setEditingId(opening.id);
    setForm({
      jobCode: opening.jobCode ?? "",
      title: opening.title ?? "",
      positions: String(opening.positions ?? 1),
      location: opening.location ?? "",
      employmentTypeId: opening.employmentTypeId ?? "",
      requiredQualification: opening.requiredQualification ?? "",
      minExperience: String(opening.minExperience ?? 0),
      maxExperience: opening.maxExperience != null ? String(opening.maxExperience) : "",
      deadline: opening.deadline ? String(opening.deadline).slice(0, 10) : "",
      description: opening.description ?? "",
      requiredSkills: Array.isArray(opening.requiredSkills) ? opening.requiredSkills.join(", ") : opening.requiredSkills ?? "",
      status: opening.status ?? "DRAFT",
    });
    setJdFile(null);
    setError("");
    setShowForm(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const minExperience = toNumberOrZero(form.minExperience);
    const maxExperience = form.maxExperience.trim() ? Number(form.maxExperience) : undefined;
    if (!Number.isFinite(minExperience) || minExperience < 0) {
      setError("Minimum experience must be zero or greater.");
      setSaving(false);
      return;
    }
    const payload = { ...form, minExperience, maxExperience };

    try {
      if (editingId) {
        await hrApi.updateOpening(editingId, payload, jdFile || undefined);
        setMessage("Opening updated.");
      } else {
        await hrApi.createOpening(payload, jdFile || undefined);
        setMessage("Opening saved as a draft.");
      }
      setShowForm(false);
      setEditingId("");
      invalidate(["openings", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (opening: any, status: string) => {
    setError("");
    try {
      if (status === "PUBLISHED") await hrApi.publishOpening(opening.id);
      else if (status === "CLOSED") {
        await hrApi.closeOpening(opening.id);
      }
      else if (status === "ARCHIVED") {
        await hrApi.archiveOpening(opening.id);
        setSearchParams({ view: "archive" }, { replace: true });
      }
      else await hrApi.reopenOpening(opening.id);
      setMessage(`${opening.title} moved to ${status === "CLOSED" ? "archive" : status.toLowerCase()}.`);
      invalidate(["openings", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Action failed.");
    }
  };

  const remove = async (opening: any) => {
    if (!window.confirm(`Delete ${opening.title}? It will be moved to the Archive section instead of permanently being removed.`)) return;
    setError("");
    try {
      await hrApi.archiveOpening(opening.id);
      setMessage(`${opening.title} was archived.`);
      setSearchParams({ view: "archive" }, { replace: true });
      invalidate(["openings", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Archive failed.");
    }
  };

  return (
    <div>
      <PageHeading
        title="Manage openings"
        description="Create, review, publish and archive job openings through the approved hiring SOP."
        action={
          <Button icon={Plus} onClick={openCreate}>
            Create opening
          </Button>
        }
      />

      {(error || message) && (
        <div className={`notice ${error ? "notice--error" : "notice--success"}`} role="status">
          <div className="notice__body">
            <div className="notice__title">{error || message}</div>
          </div>
        </div>
      )}

      <section className="card">
        <div className="table-toolbar">
          <div>
            <h2 className="card__title">Opening register</h2>
            <p className="card__subtitle">Active openings stay here. Closing an opening archives it rather than deleting the record.</p>
          </div>
          <div className="table-toolbar__controls table-toolbar__controls--stack">
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search openings"
              aria-label="Search openings"
            />
            <div className="filters" aria-label="Opening status view">
              <button type="button" className={`ta-filter-chip ${viewStatus === "open" ? "active" : ""}`} onClick={() => selectView("open")}>Open <span className="ta-filter-chip__count">{openCount}</span></button>
              <button type="button" className={`ta-filter-chip ${viewStatus === "closed" ? "active" : ""}`} onClick={() => selectView("closed")}>Close <span className="ta-filter-chip__count">{closedCount}</span></button>
              <button type="button" className={`ta-filter-chip ${viewStatus === "archive" ? "active" : ""}`} onClick={() => selectView("archive")}>Archive <span className="ta-filter-chip__count">{archivedCount}</span></button>
              <button type="button" className={`ta-filter-chip ${viewStatus === "all" ? "active" : ""}`} onClick={() => selectView("all")}>All <span className="ta-filter-chip__count">{items.length}</span></button>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Opening</th>
                <th>Location</th>
                <th>Applicants</th>
                <th>Minimum Experience</th>
                <th>Deadline</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((opening: any) => (
                <tr key={opening.id}>
                  <td>
                    <strong>{opening.title}</strong>
                    <span className="table-muted">{opening.jobCode}</span>
                  </td>
                  <td>{opening.location ?? "—"}</td>
                  <td>{opening._count?.applications ?? 0}</td>
                  <td>{Number(opening.minExperience ?? 0)} years</td>
                  <td>{opening.deadline ? new Date(opening.deadline).toLocaleDateString() : "—"}</td>
                  <td>
                    <StatusPill status={opening.status} />
                  </td>
                  <td>
                    <div className="opening-actions-box" aria-label={`Actions for ${opening.title}`}>
                      <button
                        type="button"
                        className="opening-action opening-action--secondary"
                        onClick={() => openEdit(opening)}
                        aria-label={`Edit ${opening.title}`}
                      >
                        <Edit3 size={15} />
                      </button>
                      {opening.status === "DRAFT" && (
                        <button type="button" className="opening-action opening-action--success" onClick={() => changeStatus(opening, "PUBLISHED")}>
                          Publish
                        </button>
                      )}
                      {opening.status === "PUBLISHED" && (
                        <button type="button" className="opening-action opening-action--danger" onClick={() => changeStatus(opening, "CLOSED")}>
                          <X size={15} aria-hidden="true" /> Close
                        </button>
                      )}
                      {(opening.status === "CLOSED" || opening.status === "ARCHIVED") && (
                        <button type="button" className="opening-action opening-action--success" onClick={() => changeStatus(opening, "PUBLISHED")}>
                          <RotateCcw size={15} aria-hidden="true" /> Reopen
                        </button>
                      )}
                      <button type="button" className="opening-action opening-action--success-solid" onClick={() => navigate(`/hr/submissions?jobOpeningId=${opening.id}`)}>
                        <ExternalLink size={15} aria-hidden="true" /> Applications
                      </button>
                      {opening.status !== "ARCHIVED" && (
                        <button type="button" className="opening-action opening-action--danger-icon" onClick={() => remove(opening)} aria-label={`Delete ${opening.title}`} title="Move to archive">
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">No openings match this view.</div>
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">Loading openings…</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? "Edit opening" : "Create opening"}
        subtitle="Capture the approved role details, then publish when ready."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button icon={Save} type="submit" form="opening-form" loading={saving}>
              {editingId ? "Save changes" : "Save draft"}
            </Button>
          </>
        }
      >
        <form id="opening-form" onSubmit={submit} className="form-grid">
          <Input
            label="Job title"
            required
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="e.g. Senior GIS Analyst"
          />
          <Input
            label="Job code"
            value={form.jobCode}
            onChange={(event) => setForm((current) => ({ ...current, jobCode: event.target.value }))}
            placeholder="Auto-generated when empty"
          />
          <Input
            label="Positions"
            type="number"
            min={1}
            value={form.positions}
            onChange={(event) => setForm((current) => ({ ...current, positions: event.target.value }))}
          />
          <Input
            label="Location"
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            placeholder="City or Remote"
          />
          <Select
            label="Employment type"
            value={form.employmentTypeId}
            onChange={(event) => setForm((current) => ({ ...current, employmentTypeId: event.target.value }))}
            options={types.map((type: any) => ({ value: type.id, label: type.name }))}
            placeholder="Select type"
          />
          <Input
            label="Required qualification"
            value={form.requiredQualification}
            onChange={(event) => setForm((current) => ({ ...current, requiredQualification: event.target.value }))}
          />
          <Input
            label="Minimum experience"
            type="number"
            min={0}
            step="0.5"
            value={form.minExperience}
            onChange={(event) => setForm((current) => ({ ...current, minExperience: event.target.value }))}
            placeholder="0"
          />
          <Input
            label="Maximum experience"
            type="number"
            min={0}
            step="0.5"
            value={form.maxExperience}
            onChange={(event) => setForm((current) => ({ ...current, maxExperience: event.target.value }))}
          />
          <Input
            label="Application deadline"
            type="date"
            value={form.deadline}
            onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            options={[
              { value: "DRAFT", label: "Draft" },
              { value: "PUBLISHED", label: "Published" },
              { value: "CLOSED", label: "Archived" },
            ]}
            placeholder="Select status"
          />
          <Textarea
            className="field--full"
            label="Role summary"
            required
            rows={3}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Responsibilities, must-have skills, and approval notes."
          />
          <Input
            className="field--full"
            label="Required skills"
            value={form.requiredSkills}
            onChange={(event) => setForm((current) => ({ ...current, requiredSkills: event.target.value }))}
            placeholder="Comma separated, e.g. React, Node.js, PostgreSQL"
          />
          <div className="field field--full">
            <label className="field__label" htmlFor="opening-jd">Job description file</label>
            <input
              id="opening-jd"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="input"
              onChange={(event) => setJdFile(event.target.files?.[0] ?? null)}
            />
            <span className="field__hint">PDF, DOC, DOCX or TXT.</span>
          </div>
        </form>
      </Modal>
    </div>
  );
}
