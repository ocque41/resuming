'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/(login)/actions';

export function MainNav() {
  const pathname = usePathname();

  return (
    <header
      className="uk-preserve-color uk-inverse-light uk-background-cover"
      style={{ backgroundColor: '#050505' }}
      role="banner"
      aria-label="Main site header"
    >
      <div
        uk-sticky="sel-target: .uk-navbar-container; cls-active: uk-navbar-sticky; end: ! *; offset: 80"
        style={{ '--uk-navbar-dropdown-background': '#050505' } as React.CSSProperties}
      >
        <nav
          className="uk-navbar-container uk-position-relative uk-position-z-index-high"
          style={{ backgroundColor: '#050505', borderBottom: 'none' }}
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="uk-container">
            <div
              uk-navbar="dropbar: true; dropbar-transparent-mode: behind; dropbar-anchor: !.uk-navbar-container; target-y: !.uk-navbar-container"
            >
              <div className="uk-navbar-left">
                <Link 
                  href="/" 
                  className="uk-navbar-item"
                  title="Resuming - Home"
                  aria-label="Go to Resuming homepage"
                >
                  <img 
                    src="/Resuming white.png" 
                    alt="Resuming Logo" 
                    className="h-8 w-auto"
                    width="150"
                    height="40"
                  />
                </Link>
              </div>
              <div className="uk-navbar-right">
                <ul className="uk-navbar-nav uk-navbar-transparent" role="menubar">
                  <li role="none">
                    <Link 
                      href="/pricing" 
                      className="text-white hover:text-white transition-colors"
                      title="Resuming products and pricing" 
                      role="menuitem"
                      aria-current={pathname === '/pricing' ? 'page' : undefined}
                    >
                      Products
                    </Link>
                  </li>
                  <li role="none">
                    <a 
                      href="https://chromad.vercel.app/docs/products/resuming/overview" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-white hover:text-white transition-colors"
                      title="Resuming documentation"
                      role="menuitem"
                    >
                      Documentation
                    </a>
                  </li>
                  <li role="none">
                    <Link 
                      href="/sign-in" 
                      className="text-white hover:text-white transition-colors"
                      title="Sign in to your Resuming account"
                      role="menuitem" 
                      aria-current={pathname === '/sign-in' ? 'page' : undefined}
                    >
                      Sign in
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
