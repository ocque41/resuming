import { Manrope } from "next/font/google";
import localFont from "next/font/local";

const manrope = Manrope({ subsets: ["latin"] });
const safiroFont = localFont({
  src: "/fonts/Safiro-Medium.otf",
  display: "swap",
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${manrope.className} ${safiroFont.className} flex flex-col min-h-screen w-full bg-black text-white`}>
      <main className="flex-1 overflow-y-auto px-4 py-2 mt-4">
        {children}
      </main>
    </div>
  );
}
