import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Admin index page - redirects to dashboard
 */
export default function Index() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-800">Redirecting to dashboard...</h1>
        <div className="mt-4">
          <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    </div>
  );
}