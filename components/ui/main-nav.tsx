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
    <nav className="uk-navbar-container">
      <div className="uk-container">
        <div uk-navbar>
          <div className="uk-navbar-left">
            <ul className="uk-navbar-nav">
              <li className={pathname === '/dashboard' ? 'uk-active' : ''}>
                <Link href="/dashboard">Dashboard</Link>
              </li>
              <li className={pathname === '/dashboard/products' ? 'uk-active' : ''}>
                <Link href="/dashboard/pricing">Products</Link>
              </li>
              <li className={pathname === '/docs' ? 'uk-active' : ''}>
                <Link href="https://chromad.vercel.app/docs/products/resuming/overview" target="_blank">Docs</Link>
              </li>
              <li>
                <a href="#">Settings</a>
                <div className="uk-navbar-dropdown">
                  <ul className="uk-nav uk-navbar-dropdown-nav">
                    <li><Link href="/dashboard/profile">Profile</Link></li>
                    <li><Link href="/dashboard/billing">Billing</Link></li>
                    <li className="uk-nav-divider"></li>
                    <li><button onClick={handleSignOut} className="uk-button uk-button-link">Sign Out</button></li>
                  </ul>
                </div>
              </li>
            </ul>
          </div>
          
          <div className="uk-navbar-right">
            <ul className="uk-navbar-nav">
              <li>
                <Link href="/dashboard/profile">
                  {user?.name || 'Account'}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}
