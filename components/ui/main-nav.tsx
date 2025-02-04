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

  <nav class="uk-navbar-container">
  <div class="uk-container">
    <div uk-navbar>
      <div class="uk-navbar-left">
        <ul class="uk-navbar-nav">
          <li class="uk-active"><a href="#">Active</a></li>
          <li>
            <a href="#">Parent</a>
            <div class="uk-navbar-dropdown">
              <ul class="uk-nav uk-navbar-dropdown-nav">
                <li class="uk-active"><a href="#">Active</a></li>
                <li><a href="#">Item</a></li>
                <li><a href="#">Item</a></li>
              </ul>
            </div>
          </li>
          <li><a href="#">Item</a></li>
        </ul>
      </div>
    </div>
  </div>
</nav>

  <nav class="uk-navbar-container">
  <div class="uk-container">
    <div uk-navbar>…</div>
  </div>
</nav>

<nav class="uk-navbar-container">
  <div class="uk-container">
    <div uk-navbar>
      <div class="uk-navbar-left">
        <ul class="uk-navbar-nav">
          <li class="uk-active"><a href="#">Active</a></li>
          <li>
            <a href="#">Parent</a>
            <div class="uk-navbar-dropdown">
              <ul class="uk-nav uk-navbar-dropdown-nav">
                <li class="uk-active"><a href="#">Active</a></li>
                <li><a href="#">Item</a></li>
                <li><a href="#">Item</a></li>
              </ul>
            </div>
          </li>
          <li><a href="#">Item</a></li>
        </ul>
      </div>
    </div>
  </div>
</nav>
