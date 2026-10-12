// =============================================================================
// components/Wordmark.tsx — "Jorvik Web Dev / SITES" lockup
// =============================================================================
// Text, not an image, until this product has its own mark.
import Link from "next/link";

export default function Wordmark({ href }: { href?: string }) {
  const inner = (
    <>
      <div className="wordmark-name">Jorvik Web Dev</div>
      <div className="wordmark-product">SITES</div>
    </>
  );
  return href ? (
    <Link href={href} className="wordmark">
      {inner}
    </Link>
  ) : (
    <div className="wordmark">{inner}</div>
  );
}
