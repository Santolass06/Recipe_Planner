interface AvatarProps {
  name: string;
  size?: number;
}

export default function Avatar({ name, size = 40 }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorIndex = (hash % 8) + 1;

  const bgVar = `var(--avatar-${colorIndex}-bg)`;
  const fgVar = `var(--avatar-${colorIndex}-fg)`;

  return (
    <div
      className="item-avatar"
      style={{
        width: size,
        height: size,
        backgroundColor: bgVar,
        color: fgVar,
        fontSize: size * 0.35,
      }}
    >
      {initials}
    </div>
  );
}
