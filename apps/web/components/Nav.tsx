'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { useRouter } from 'next/navigation';

export default function Nav() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    router.push('/login');
    setMobileMenuOpen(false);
  }

  return (
    <nav className="navbar">
      <div className="container !py-0">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="text-xl font-heading font-bold text-primary-600">
            ClinIQ Lite
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {user && (
              <div className="flex items-center gap-4">
                <Link href="/dashboard" className="nav-link">
                  Dashboard
                </Link>
                {/* Add more nav links here */}
              </div>
            )}

            <div className="flex items-center gap-4">
              {loading ? (
                <span className="text-sm text-gray-400">...</span>
              ) : user ? (
                <>
                  <span className="text-sm text-gray-600 hidden lg:inline">{user.email}</span>
                  <button onClick={handleLogout} className="nav-link">
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/login" className="btn-primary text-sm">
                  Sign in
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 py-4 space-y-3">
            {user && (
              <>
                <Link
                  href="/dashboard"
                  className="block py-2 px-3 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                {/* Add more mobile nav links here */}
              </>
            )}

            <div className="pt-3 border-t border-gray-100">
              {loading ? (
                <span className="text-sm text-gray-400 px-3">...</span>
              ) : user ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 text-sm text-gray-600">{user.email}</div>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left py-2 px-3 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="block py-2 px-3 btn-primary text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
