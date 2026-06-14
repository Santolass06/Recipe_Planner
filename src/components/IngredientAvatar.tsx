const PALETTE = [
  { bg: "var(--avatar-1-bg)", color: "var(--avatar-1-fg)" },
  { bg: "var(--avatar-2-bg)", color: "var(--avatar-2-fg)" },
  { bg: "var(--avatar-3-bg)", color: "var(--avatar-3-fg)" },
  { bg: "var(--avatar-4-bg)", color: "var(--avatar-4-fg)" },
  { bg: "var(--avatar-5-bg)", color: "var(--avatar-5-fg)" },
  { bg: "var(--avatar-6-bg)", color: "var(--avatar-6-fg)" },
  { bg: "var(--avatar-7-bg)", color: "var(--avatar-7-fg)" },
  { bg: "var(--avatar-8-bg)", color: "var(--avatar-8-fg)" },
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function IngredientAvatar({ name }: { name: string }) {
  const { bg, color } = PALETTE[hashName(name) % PALETTE.length];
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="ingredient-avatar"
      style={{ background: bg, color }}
      title={name}
    >
      {initials || "?"}
    </div>
  );
}
