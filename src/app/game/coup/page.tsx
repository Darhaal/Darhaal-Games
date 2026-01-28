import { Suspense } from 'react';
import CoupGameClient from './CoupGameClient';

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        Loading game…
      </div>
    }>
      <CoupGameClient />
    </Suspense>
  );
}
