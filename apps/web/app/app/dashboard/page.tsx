'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Dashboard is hidden - redirect all users to Daily Queue
export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/app/queue');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-gray-500">Redirecting to Daily Queue...</div>
    </div>
  );
}
