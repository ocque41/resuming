'use client';

import Link from 'next/link';

export function DashboardTopNav() {
  return (
    <div
      className="uk-preserve-color uk-inverse-light uk-background-cover"
      style={{ backgroundColor: '#050505' }}
    >
      <div
        uk-sticky="sel-target: .uk-navbar-container; cls-active: uk-navbar-sticky; end: ! *; offset: 80"
        style={{ '--uk-navbar-dropdown-background': '#050505' } as React.CSSProperties}
      >
        <nav
          className="uk-navbar-container uk-position-relative uk-position-z-index-high"
          style={{ backgroundColor: '#050505', borderBottom: 'none' }}
        >
          <div className="uk-container">
            <div
              uk-navbar="dropbar: true; dropbar-transparent-mode: behind; dropbar-anchor: !.uk-navbar-container; target-y: !.uk-navbar-container"
            >
              <div className="uk-navbar-left">
                <Link href="/" className="uk-navbar-item">
                  <img 
                    src="/Resuming white.png" 
                    alt="Resuming Logo" 
                    className="h-8 w-auto"
                  />
                </Link>
              </div>
              <div className="uk-navbar-right">
                <ul className="uk-navbar-nav uk-navbar-transparent">
                  <li>
                    <Link href="/dashboard" className="text-white hover:text-white transition-colors">
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/profile" className="text-white hover:text-white transition-colors">
                      Profile
                    </Link>
                  </li>
                  <li>
                    <Link href="/settings" className="text-white hover:text-white transition-colors">
                      Settings
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
