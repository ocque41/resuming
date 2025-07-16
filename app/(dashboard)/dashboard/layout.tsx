import { Manrope } from "next/font/google";
import localFont from "next/font/local";
import { getUser, getTeamForUser } from "@/lib/db/queries.server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Team } from "@/lib/db/schema";

const manrope = Manrope({ subsets: ["latin"] });
const safiroFont = localFont({
  src: "../../fonts/Safiro-Medium.otf",
  display: "swap",
});
const bornaFont = localFont({
  src: "../../fonts/Borna-Medium.otf",
  display: "swap",
});

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const nextUrl = headersList.get('next-url');
  let pathname: string | null = nextUrl ?? null;
  if (nextUrl) {
    try {
      pathname = new URL(nextUrl, 'http://internal').pathname;
    } catch {
      // next-url may already be a pathname
      pathname = nextUrl;
    }
  }
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser(user.id) as Team | null;
  const hasPlan = team?.planName && team.subscriptionStatus === 'active';

  if (!hasPlan && pathname && !pathname.startsWith('/dashboard/pricing')) {
    redirect('/dashboard/pricing');
  }

  return (
    <div className={`${manrope.className} ${safiroFont.className} ${bornaFont.className} flex flex-col min-h-screen w-full bg-[#050505] text-white`}>
      <main className="flex-1 overflow-y-auto px-4 py-2 mt-4">
        {children}
      </main>
    </div>
  );
}
