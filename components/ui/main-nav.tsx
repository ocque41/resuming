'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/(login)/actions';

export function MainNav() {
  const pathname = usePathname();

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
                    <Link href="/pricing" className="text-white hover:text-white transition-colors">
                      Products
                    </Link>
                  </li>
                  <li>
                    <a 
                      href="https://chromad.vercel.app/docs/products/resuming/overview" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-white hover:text-white transition-colors"
                    >
                      Documentation
                    </a>
                  </li>
                  <li>
                    <Link href="/sign-in" className="text-white hover:text-white transition-colors">
                      Sign in
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
