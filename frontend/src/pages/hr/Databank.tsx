import { useMemo, useState } from "react";
import { hrApi } from "../../lib/api";
import { useDebounced } from "../../hooks/useDebounced";
import { useApiQuery, queryKeys } from "../../hooks/useApiQuery";
import DataTable, { type Column } from "../../components/DataTable";

const CAT_LABEL: Record<string, string> = {
  EXISTING: "Existing Employee",
  FORMER: "Former Employee",
  PIPELINE: "Pipeline Candidate",
  ON_HOLD: "On Hold",
};

const CAT_TONE: Record<string, string> = {
  EXISTING: "border-[#659616]/30 bg-[#659616]/10 text-[#659616]/80",
  FORMER: "border-[#171717]/15 bg-[#171717]/5 ink-soft",
  PIPELINE: "border-[#FF9412]/30 bg-[#FF9412]/10 text-[#FF9412]/80",
  ON_HOLD: "border-[#5C5C5C]/25 bg-[#5C5C5C]/10 text-[#5C5C5C]",
};

export default function Databank() {
  const [filters, setFilters] = useState({ category: "", search: "", skills: "", expMin: "" });
  const debouncedSearch = useDebounced(filters.search);
  const debouncedSkills = useDebounced(filters.skills);

  const params = useMemo(
    () => ({
      page: 1, pageSize: 100,
      category: filters.category || undefined,
      search: debouncedSearch || undefined,
      skills: debouncedSkills || undefined,
      experienceMin: filters.expMin || undefined,
    }),
    [filters.category, debouncedSearch, debouncedSkills, filters.expMin],
  );

  const { data: items = [], isLoading } = useApiQuery<any[]>(
    queryKeys.databank(params),
    () => hrApi.cvDatabank(params).then((r: any) => r?.data?.items ?? []),
  );

  const viewCV = async (fileId: string) => {
    try {
      const r = await hrApi.fileAccessToken(fileId);
      window.open(r.data.url, "_blank");
    } catch { /* not permitted for this user */ }
  };

  const columns: Column<any>[] = [
    { key: "idx", header: "#", render: (_r, i) => <span className="ink-soft">{i + 1}</span> },
    { key: "name", header: "Name", render: (r) => <span className="font-medium ink-body">{r.name}</span> },
    { key: "code", header: "ID", hideOnMobile: true, render: (r) => <span className="font-mono text-xs ink-soft">{r.code}</span> },
    { key: "cat", header: "Category", render: (r) => <span className={`badge whitespace-nowrap ${CAT_TONE[r.category]}`}>{CAT_LABEL[r.category]}</span> },
    { key: "dept", header: "Department", hideOnMobile: true, render: (r) => <span className="ink-soft">{r.department || "—"}</span> },
    { key: "desig", header: "Designation", hideOnMobile: true, render: (r) => <span className="ink-soft">{r.designation || "—"}</span> },
    { key: "exp", header: "Exp", hideOnMobile: true, render: (r) => <span className="ink-soft">{r.totalExperience ?? "—"} yrs</span> },
    { key: "qual", header: "Qualification", hideOnMobile: true, render: (r) => <span className="ink-soft">{r.qualification || "—"}</span> },
    { key: "skills", header: "Skills", hideOnMobile: true, render: (r) => <span className="text-xs ink-soft max-w-[180px] truncate block">{Array.isArray(r.skills) ? r.skills.slice(0, 4).join(", ") : "—"}</span> },
    { key: "email", header: "Email", hideOnMobile: true, render: (r) => <span className="ink-soft">{r.email}</span> },
    {
      key: "cv", header: "CV",
      render: (r) => r.cv
        ? <button className="btn-xs btn-ghost whitespace-nowrap" onClick={() => viewCV(r.cv.id)}>View</button>
        : <span className="text-xs ink-soft">—</span>,
    },
  ];

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold ink-body tracking-tight">CV Databank</h1>
        <p className="text-sm ink-soft mt-0.5">One searchable repository for employees, alumni and candidates.</p>
      </div>

      <div className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select className="select" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">All categories</option>
          {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input" placeholder="Search name, email…" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <input className="input" placeholder="Filter by skills" value={filters.skills} onChange={(e) => setFilters({ ...filters, skills: e.target.value })} />
        <input className="input" type="number" placeholder="Min experience (yrs)" value={filters.expMin} onChange={(e) => setFilters({ ...filters, expMin: e.target.value })} />
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={isLoading}
          empty="No records match your filters."
          mobileTitle={(r) => r.name}
          mobileMeta={(r) => (
            <>
              <div>{r.code} · {CAT_LABEL[r.category]}</div>
              <div>{r.email}{r.mobile ? ` · ${r.mobile}` : ""}</div>
            </>
          )}
          mobileActions={(r) => r.cv ? <button className="btn-xs btn-ghost" onClick={() => viewCV(r.cv.id)}>View CV</button> : null}
        />
      </div>
    </div>
  );
}
