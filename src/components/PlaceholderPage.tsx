export default function PlaceholderPage({ name }: { name: string }) {
  return (
    <div className="empty">
      <p style={{ fontFamily: "var(--mono)", fontSize: 11,
                   color: "var(--text-3)", margin: 0 }}>
        {name} — em breve
      </p>
    </div>
  );
}