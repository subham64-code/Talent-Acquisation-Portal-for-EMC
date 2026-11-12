export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <img
      src="https://ecometrix.co.in/wp-content/uploads/2026/05/cropped-EMC-Logo-White-UT-1-e1780053104843.png"
      alt="EMC Logo"
      width={size}
      height={size}
      style={{ display: "block" }}
    />
  );
}
