"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="uk-navbar-container">
      <div className="uk-container">
        <div uk-navbar>
          <div className="uk-navbar-left">
            <Link href="/" className="uk-navbar-item uk-logo">
              ResumeAI
            </Link>
            <ul className="uk-navbar-nav">
              <li className={cn(pathname === "/" && "uk-active")}>
                <Link href="/">Home</Link>
              </li>
              <li className={cn(pathname === "/pricing" && "uk-active")}>
                <Link href="/pricing">Pricing</Link>
              </li>
              <li>
                <Link href="#">Features <span uk-navbar-parent-icon></span></Link>
                <div className="uk-navbar-dropdown">
                  <ul className="uk-nav uk-navbar-dropdown-nav">
                    <li><Link href="/features/cv-analysis">CV Analysis</Link></li>
                    <li><Link href="/features/ats-optimization">ATS Optimization</Link></li>
                    <li><Link href="/features/ai-suggestions">AI Suggestions</Link></li>
                  </ul>
                </div>
              </li>
            </ul>
          </div>
          <div className="uk-navbar-right">
            <ul className="uk-navbar-nav">
              <li>
                <Link href="/login">Login</Link>
              </li>
              <li>
                <Link href="/signup" className="uk-button uk-button-primary">Sign Up</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  )
}
