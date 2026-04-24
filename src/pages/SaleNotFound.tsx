// 404 surface for /sales/:saleNumber when the requested sale_number is
// not in the DB (or the URL was tampered / the sale was deleted).
//
// Copy locked by 03-UI-SPEC.md § Copywriting → 404 page heading/body/CTA.
// The heading uses role="alert" per 03-UI-SPEC.md § Accessibility Floor
// (error-state headings announce via screen readers). The embedded
// saleNumber is interpolated via React text children — JSX auto-escapes
// it, so T-03-01 XSS via URL-param tampering is mitigated.

import { BackLink } from '../components/BackLink';

interface SaleNotFoundProps {
  saleNumber: string;
}

export function SaleNotFound({ saleNumber }: SaleNotFoundProps) {
  return (
    <>
      <BackLink to="/sales">Back to sales</BackLink>
      <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center text-center">
        <h1
          role="alert"
          className="text-xl font-semibold text-gray-900 dark:text-gray-100"
        >
          Sale not found
        </h1>
        <p className="mt-4 text-base text-gray-500 dark:text-gray-400">
          We couldn&apos;t find a sale with number &quot;{saleNumber}&quot;. It
          may have been removed, or the URL might be wrong.
        </p>
      </div>
    </>
  );
}

export default SaleNotFound;
