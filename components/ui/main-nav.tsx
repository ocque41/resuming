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
      className="uk-preserve-color uk-inverse-light uk-background-cover uk-section-secondary"
      style={{ backgroundImage: 'url("/images/dark.jpg")' }}
    >
      <div
        uk-sticky="sel-target: .uk-navbar-container; cls-active: uk-navbar-sticky; end: ! *; offset: 80"
      >
        <nav
          className="uk-navbar-container uk-navbar-transparent uk-position-relative uk-position-z-index-high"
          uk-inverse="sel-active: .uk-navbar-transparent"
        >
          <div className="uk-container">
            <div
              uk-navbar="dropbar: true; dropbar-transparent-mode: behind; dropbar-anchor: !.uk-navbar-container; target-y: !.uk-navbar-container"
            >
              <div className="uk-navbar-right">
                <ul className="uk-navbar-nav">
                  <li><Link href="/">Home</li>
                  {user ? (
                    <>
                      <li><Link href="/dashboard">Dashboard</Link></li>
                      <li><button onClick={handleSignOut}>Sign Out</button></li>
                    </>
                  ) : (
                    <>
                      <li><Link href="/sign-in">Sign In</Link></li>
                      <li><Link href="/sign-up">Sign Up</Link></li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
