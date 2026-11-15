export default function Logo({ size = 40, onDark = false }: { size?: number; onDark?: boolean }) {
  const img = (
    <img
      src="/assets/ecometrix-logo.png"
      alt="Ecometrix Logo"
      width={size}
      height={size}
      style={{ display: "block", objectFit: "contain" }}
    />
  );
  if (onDark) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-xl bg-white p-1.5 shadow-sm"
        style={{ lineHeight: 0 }}
      >
        {img}
      </span>
    );
  }
  return img;
}
