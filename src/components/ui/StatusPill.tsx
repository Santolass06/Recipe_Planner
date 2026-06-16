interface StatusPillProps {
  status: "ok" | "low" | "out" | "info";
  label: string;
}

export default function StatusPill({ status, label }: StatusPillProps) {
  return (
    <span className={`status-pill ${status}`}>
      <span className="status-dot"></span>
      {label}
    </span>
  );
}
