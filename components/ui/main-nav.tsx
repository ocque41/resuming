'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/auth';
import { signOut } from '@/app/(login)/actions';

export function MainNav() {
  const pathname = usePathname();
  const { user, setUser } = useUser();

  const handleSignOut = async () => {
    setUser(null);
    await signOut();
  };

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
              <div className="uk-navbar-right">
                <ul className="uk-navbar-nav uk-navbar-transparent">
                  <li className="uk-active"><a href="#">Active</a></li>
                  <li>
                    <a href="#">Parent</a>
                    <div className="uk-navbar-dropdown">
                      <ul className="uk-nav uk-navbar-dropdown-nav">
                        <li className="uk-active"><a href="#">Active</a></li>
                        <li><a href="#">Item</a></li>
                        <li className="uk-nav-header">Header</li>
                        <li><a href="#">Item</a></li>
                        <li><a href="#">Item</a></li>
                        <li className="uk-nav-divider"></li>
                        <li><a href="#">Item</a></li>
                      </ul>
                    </div>
                  </li>
                  <li>
                    <a href="#">Parent</a>
                    <div className="uk-navbar-dropdown uk-navbar-dropdown-width-2">
                      <div className="uk-drop-grid uk-child-width-1-2" uk-grid>
                        <div>
                          <ul className="uk-nav uk-navbar-dropdown-nav">
                            <li className="uk-active"><a href="#">Active</a></li>
                            <li><a href="#">Item</a></li>
                            <li className="uk-nav-header">Header</li>
                            <li><a href="#">Item</a></li>
                            <li><a href="#">Item</a></li>
                            <li className="uk-nav-divider"></li>
                            <li><a href="#">Item</a></li>
                          </ul>
                        </div>
                        <div>
                          <ul className="uk-nav uk-navbar-dropdown-nav">
                            <li className="uk-active"><a href="#">Active</a></li>
                            <li><a href="#">Item</a></li>
                            <li className="uk-nav-header">Header</li>
                            <li><a href="#">Item</a></li>
                            <li><a href="#">Item</a></li>
                            <li className="uk-nav-divider"></li>
                            <li><a href="#">Item</a></li>
                          </ul>
                        </div>
                      </div>
                    </div>
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
