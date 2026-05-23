import {
  COMMISSION_LABEL,
  commissionHref,
  hasCommissionContact,
} from "../lib/contact";

export function CommissionFooter() {
  if (!hasCommissionContact()) return null;

  const href = commissionHref();
  return (
    <footer className="commission-footer">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {COMMISSION_LABEL}
      </a>
    </footer>
  );
}
