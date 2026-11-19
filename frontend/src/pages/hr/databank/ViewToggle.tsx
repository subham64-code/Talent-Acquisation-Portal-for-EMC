import { LayoutGrid, List } from "lucide-react";

export default function ViewToggle({ value, onChange, label = "Switch view" }: { value: "table" | "cards"; onChange: (value: "table" | "cards") => void; label?: string }) {
  return (
    <div className="view-toggle" role="group" aria-label={label}>
      <button type="button" className={`view-toggle__btn ${value === "table" ? "active" : ""}`} onClick={() => onChange("table")} aria-pressed={value === "table"}>
        <List size={15} aria-hidden="true" />
        Table
      </button>
      <button type="button" className={`view-toggle__btn ${value === "cards" ? "active" : ""}`} onClick={() => onChange("cards")} aria-pressed={value === "cards"}>
        <LayoutGrid size={15} aria-hidden="true" />
        Cards
      </button>
    </div>
  );
}
