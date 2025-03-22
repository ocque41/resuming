'use client';

import Link from 'next/link';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-white p-4">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-8">
          <img src="/white.png" alt="Logo" className="h-16 mx-auto" />
        </div>
        
        <h1 className="text-3xl font-bold mb-6 font-safiro">We're experiencing technical difficulties</h1>
        
        <div className="bg-[#0D0D0D] p-6 rounded-lg border border-[#222222] mb-8">
          <p className="text-[#C5C2BA] mb-4 font-borna">
            We've encountered a database issue and our team has been notified. 
            We're working to resolve this as quickly as possible.
          </p>
          
          <div className="flex flex-col space-y-4">
            <div className="bg-[#1A1A1A] p-4 rounded-lg">
              <h3 className="font-bold text-[#B4916C] mb-2">What you can do:</h3>
              <ul className="text-left text-[#C5C2BA] space-y-2 font-borna">
                <li>• Try refreshing the page</li>
                <li>• Come back in a few minutes</li>
                <li>• Clear your browser cache</li>
                <li>• Contact support if the issue persists</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <button className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] px-6 py-2 rounded-full font-safiro">
              Return to Home
            </button>
          </Link>
          
          <button 
            onClick={() => window.location.reload()} 
            className="border border-[#B4916C] text-[#B4916C] px-6 py-2 rounded-full hover:bg-[#1A1A1A] font-safiro"
          >
            Try Again
          </button>
        </div>
        
        <p className="mt-8 text-[#8A8782] font-borna">
          Error Code: DB-CONN-ERR • 
          <a href="/contact" className="text-[#B4916C] hover:underline ml-1">
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
} 