import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../style/Dashboard.css";

const DEFAULT_USER = { name: "xyz", role: "Employee" };

const getUser = () => {
    try {
        const stored = (localStorage.getItem("emc_user") || DEFAULT_USER.name).trim();
        let name = stored;
        if (stored.includes("@")) {
            const raw = stored.split("@")[0];
            const parts = raw.split(/[._\-+]+/).filter(Boolean);
            name = parts
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(" ");
        }
        return { name, role: DEFAULT_USER.role };
    } catch {
        return DEFAULT_USER;
    }
};

const QUICK = [
    { label: "Apply Leave", app: "greythr" },
    { label: "Raise IT Request", app: "emcitone" },
    { label: "Fill Timesheet", app: "pms" },
    { label: "Open Mail", app: "workmail" },
];

const ANNOUNCEMENTS = [
    "Welcome to the EMC employee portal",
    "Fill your timesheet before the week ends",
    "Need IT help? Raise a request in EMCITOne",
    "Check Workmail regularly for important updates",
];

const SERVICES = [
    {
        id: "greythr",
        title: "GreytHR",
        desc: "Manage HR processes, payroll, leaves and employee services.",
        g: ["#9b7bff", "#5a3fc0"],
        url: "#",
        icon: <span className="dx-glyph">g</span>,
    },
    {
        id: "emcitone",
        title: "EMCITOne",
        desc: "IT services, requests, assets and support management.",
        g: ["#8fdc52", "#3f8a1f"],
        url: "#",
        icon: (
            <Svg>
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <path d="M8 20h8M12 16v4" />
            </Svg>
        ),
    },
    {
        id: "talent",
        title: "Talent Acquisition Portal",
        desc: "Manage talent acquisition, recruitment and onboarding.",
        g: ["#62a8ff", "#2457c9"],
        url: "https://talent-aquisition-swart.vercel.app/auth/hr/login",
        icon: (
            <Svg>
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20c0-3.6 3-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
                <path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2.2.6 3.5 2.2 3.5 5.2" />
            </Svg>
        ),
    },
    {
        id: "dms",
        title: "Document Management System",
        desc: "Securely store, manage and access organizational documents.",
        g: ["#ffb85c", "#d9640d"],
        url: "#",
        icon: (
            <Svg>
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </Svg>
        ),
    },
    {
        id: "apra",
        title: "APRA System",
        desc: "Audit, risk, compliance and assurance management.",
        g: ["#45d8d0", "#127a80"],
        url: "#",
        icon: (
            <Svg>
                <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
                <path d="M8.5 12l2.5 2.5L15.5 10" />
            </Svg>
        ),
    },
    {
        id: "emcconnect",
        title: "EMCConnect",
        desc: "Connect, collaborate and stay updated with organization news.",
        g: ["#ff80a0", "#c02a52"],
        url: "#",
        icon: (
            <Svg>
                <circle cx="6" cy="12" r="2.5" />
                <circle cx="18" cy="6" r="2.5" />
                <circle cx="18" cy="18" r="2.5" />
                <path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" />
            </Svg>

        ),
    },
    {
        id: "workmail",
        title: "Workmail",
        desc: "Access your corporate email and calendar.",
        g: ["#8195ff", "#3548c9"],
        url: "#",
        icon: (
            <Svg>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
            </Svg>
        ),
    },
    {
        id: "pms",
        title: "PMS-Timesheet",
        desc: "Manage your goals, performance and timesheets efficiently.",
        g: ["#ffd75e", "#c98300"],
        url: "#",
        icon: (
            <Svg>
                <rect x="3" y="4.5" width="18" height="16" rx="2" />
                <path d="M3 9.5h18M8 3v3M16 3v3M8.5 14.5l2.2 2.2 4.3-4.4" />
            </Svg>
        ),
    },
];

function openUrl(url) {
    if (!url || url === "#") return;
    if (url.startsWith("http")) window.open(url, "_blank", "noopener,noreferrer");
    else window.location.href = url;
}

function loadPins() {
    try {
        const raw = JSON.parse(localStorage.getItem("emc_pins") || "[]");
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

export default function Dashboard() {
    const navigate = useNavigate();
    const USER = getUser();
    const [query, setQuery] = useState("");
    const [now, setNow] = useState(() => new Date());
    const [pins, setPins] = useState(loadPins);
    const [confirm, setConfirm] = useState(null);
    const searchRef = useRef(null);

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem("emc_pins", JSON.stringify(pins));
        } catch {
        }
    }, [pins]);

    const togglePin = (id) =>
        setPins((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        const base = q
            ? SERVICES.filter(
                (s) => s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)
            )
            : SERVICES;
        return [...base].sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)));
    }, [query, pins]);

    const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const date = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
    const initials = USER.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const logout = () => {
        localStorage.removeItem("emc_auth");
        localStorage.removeItem("emc_user");
        navigate("/", { replace: true });
    };

    const onSearch = (e) => {
        e.preventDefault();
        const first = results[0];
        if (!query.trim() || !first) return;
        setConfirm(first);
    };
    const spot = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
    };

    const filtering = query.trim().length > 0;
    return (
        <div className="dx">
            <span className="dx-blob dx-blob--1" aria-hidden="true" />
            <span className="dx-blob dx-blob--2" aria-hidden="true" />
            <span className="dx-blob dx-blob--3" aria-hidden="true" />
            <span className="dx-dots" aria-hidden="true" />
            <header className="dx-bar">
                <div className="dx-bar-in">
                    <span className="dx-logo-chip">
                        <img src="/Image/img1.png" alt="EMC - Unlocking Transformation" />
                    </span>
                    <form className="dx-search" role="search" onSubmit={onSearch}>
                        <SearchIcon />
                        <input
                            ref={searchRef}
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Escape" && (setQuery(""), e.target.blur())}
                            placeholder="Search for services, applications and more..."
                            aria-label="Search services"
                        />
                        {filtering && (
                            <button
                                type="button"
                                className="dx-clear"
                                onClick={() => {
                                    setQuery("");
                                    searchRef.current?.focus();
                                }}
                                aria-label="Clear search"
                            >
                                <CloseIcon />
                            </button>
                        )}
                        <button type="submit" className="dx-search-btn">
                            <span>Search</span>
                        </button>
                    </form>

                    <div className="dx-user">
                        <span className="dx-avatar" aria-hidden="true">{initials}</span>
                        <div className="dx-user-text">
                            <strong>{USER.name}</strong>
                            <span>{USER.role}</span>
                        </div>
                    </div>

                    <button type="button" className="dx-logout" onClick={logout}>
                        <LogoutIcon />
                        <span>Logout</span>
                    </button>
                </div>
            </header>

            <div className="dx-wrap">
                <section className="dx-hello">
                    <div className="dx-hello-main">
                        <h1>
                            Welcome back, <span className="dx-name">{USER.name.split(" ")[0]}!</span>{" "}
                            <span className="dx-wave">👋</span>
                        </h1>
                        <p>Access your tools and applications in one place.</p>
                        <div className="dx-quick" aria-label="Quick actions">
                            <span className="dx-quick-label">Quick actions</span>
                            {QUICK.map((q) => {
                                const app = SERVICES.find((s) => s.id === q.app);
                                return (
                                    <button
                                        key={q.label}
                                        type="button"
                                        className="dx-qbtn"
                                        style={{ "--g1": app.g[0], "--g2": app.g[1] }}
                                        onClick={() => setConfirm(app)}
                                    >
                                        <i aria-hidden="true" />
                                        {q.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="dx-clock" aria-label="Current date and time">
                        <strong>{time}</strong>
                        <span>{date}</span>
                    </div>
                </section>

                <section className="dx-services" aria-labelledby="dx-title">
                    <div className="dx-head">
                        <div>
                            <h2 id="dx-title">Your Services</h2>
                            <p>Quick access to the applications you use the most.</p>
                        </div>
                        <span className="dx-count">
                            {results.length} {results.length === 1 ? "app" : "apps"}
                        </span>
                    </div>

                    {results.length ? (
                        <ul className={`dx-grid ${filtering ? "is-flat" : ""}`}>
                            {results.map((s, i) => {
                                return (
                                    <li key={s.id} style={{ "--g1": s.g[0], "--g2": s.g[1], "--i": i }}>
                                        <a
                                            className="dx-card"
                                            href={s.url}
                                            onMouseMove={spot}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setConfirm(s);
                                            }}
                                        >
                                            <span className="dx-icon">{s.icon}</span>
                                            <span className="dx-text">
                                                <h3>{s.title}</h3>
                                                <p>{s.desc}</p>
                                            </span>
                                            <span className="dx-go" aria-hidden="true">
                                                <ArrowIcon />
                                            </span>

                                        </a>
                                        <button
                                            type="button"
                                            className={`dx-pin ${pins.includes(s.id) ? "is-on" : ""}`}
                                            onClick={() => togglePin(s.id)}
                                            aria-pressed={pins.includes(s.id)}
                                            aria-label={pins.includes(s.id) ? `Unpin ${s.title}` : `Pin ${s.title}`}
                                            title={pins.includes(s.id) ? "Unpin" : "Pin to top"}
                                        >
                                            <StarIcon filled={pins.includes(s.id)} />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="dx-empty">
                            <strong>No results for "{query}"</strong>
                            <span>Try a different name, like "mail" or "HR".</span>
                        </div>
                    )}
                </section>

                <div className="dx-ticker" role="region" aria-label="Announcements">
                    <span className="dx-ticker-tag">
                        <i aria-hidden="true" /> Notice
                    </span>
                    <div className="dx-ticker-view">
                        <div className="dx-ticker-track">
                            {[...ANNOUNCEMENTS, ...ANNOUNCEMENTS].map((t, i) => (
                                <span key={i} aria-hidden={i >= ANNOUNCEMENTS.length}>{t}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {confirm && (
                <ConfirmDialog
                    service={confirm}
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => {
                        openUrl(confirm.url);
                        setConfirm(null);
                    }}
                />
            )}
        </div>
    );
}


function ConfirmDialog({ service, onCancel, onConfirm }) {
    const yesRef = useRef(null);

    useEffect(() => {
        yesRef.current?.focus();
        const onKey = (e) => e.key === "Escape" && onCancel();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onCancel]);

    let host = "";
    try {
        if (service.url.startsWith("http")) host = new URL(service.url).host;
    } catch {
    }

    return (
        <div className="dx-modal-back" onMouseDown={onCancel}>
            <div
                className="dx-modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="dx-modal-title"
                aria-describedby="dx-modal-desc"
                style={{ "--g1": service.g[0], "--g2": service.g[1] }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <button type="button" className="dx-modal-x" onClick={onCancel} aria-label="Close">
                    <CloseIcon />
                </button>

                <span className="dx-modal-badge" aria-hidden="true">
                    <ExitIcon />
                </span>

                <h2 id="dx-modal-title">
                    You are about to leave <span className="dx-name">EMCOne</span>
                </h2>
                <p id="dx-modal-desc">
                    This link will redirect you to another service / window. Do you want to continue?
                </p>

                <div className="dx-modal-dest">
                    <span className="dx-modal-ico">{service.icon}</span>
                    <span className="dx-modal-dest-text">
                        <small>You will be redirected to</small>
                        <strong>{service.title}</strong>
                        {host && <em>{host}</em>}
                    </span>
                    <InfoIcon />
                </div>

                <div className="dx-modal-actions">
                    <button type="button" className="dx-btn dx-btn--ghost" onClick={onCancel}>
                        No, Cancel
                    </button>
                    <button type="button" className="dx-btn dx-btn--go" onClick={onConfirm} ref={yesRef}>
                        Yes, Continue
                        <ArrowIcon />
                    </button>
                </div> 
            </div>
        </div>
    );
}

function Svg({ children }) {
    return (
        <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

const line = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

function SearchIcon() {
    return (
        <svg width="19" height="19" viewBox="0 0 24 24" {...line} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
        </svg>
    );
}
function StarIcon({ filled }) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            {...line}
            fill={filled ? "currentColor" : "none"}
            aria-hidden="true"
        >
            <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5z" />
        </svg>
    );
}
function ExitIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" {...line} aria-hidden="true">
            <path d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4" />
            <path d="M16 8l4 4-4 4M20 12H9" />
        </svg>
    );
}
function InfoIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...line} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" {...line} aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
        </svg>
    );
}
function LogoutIcon() {
    return (
        <svg width="17" height="17" viewBox="0 0 24 24" {...line} aria-hidden="true">
            <path d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4" />
            <path d="M16 8l4 4-4 4M20 12H9" />
        </svg>
    );
}
function ArrowIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" {...line} strokeWidth="2.2" aria-hidden="true">
            <path d="M7 17L17 7M9 7h8v8" />
        </svg>
    );
}