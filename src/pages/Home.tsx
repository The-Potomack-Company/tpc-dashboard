import { DashboardAppMark } from '../ui/icons/AppIcons';

export function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <DashboardAppMark size={64} />
      <h1 className="text-2xl font-semibold text-ink mt-2">
        TPC Dashboard
      </h1>
      <p className="text-sm text-ink-3 max-w-md">
        v2.0 under construction. Team Activity, Cataloger Extension analytics,
        and Live Sale tracking are being built next.
      </p>
    </div>
  );
}

export default HomePage;
