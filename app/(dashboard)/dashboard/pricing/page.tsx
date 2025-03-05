import { redirect } from "next/navigation";
import { getUser } from "@/lib/db/queries.server";
import { Check } from "lucide-react";
import { getStripePrices, getStripeProducts } from "@/lib/payments/stripe";
import { checkoutAction } from "@/lib/payments/actions";
import { ArticleTitle } from "@/components/ui/article";
import { Card } from "@/components/ui/card";

// Revalidate prices every hour
export const revalidate = 3600;

export default async function DashboardPricingPage() {
  // Ensure user is authenticated
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }

  const [prices, products] = await Promise.all([
    getStripePrices(),
    getStripeProducts(),
  ]);

  const proPlan = products.find((product) => product.name === "Pro");
  const moonlightingPlan = products.find((product) => product.name === "Moonlighting");
  const ceoPlan = products.find((product) => product.name === "CEO");

  const proPrice = prices.find((price) => price.productId === proPlan?.id);
  const moonlightingPrice = prices.find((price) => price.productId === moonlightingPlan?.id);
  const ceoPrice = prices.find((price) => price.productId === ceoPlan?.id);

  return (
    <>
      <header className="flex items-center justify-between p-4 lg:p-8 mx-auto max-w-6xl">
        <ArticleTitle className="text-md lg:text-xl font-medium ml-4 text-[#B4916C]">
          Upgrade Your Plan
        </ArticleTitle>
      </header>
      
      <Card className="py-8 px-4 mb-8 mx-auto max-w-6xl border border-[#B4916C]/20 bg-[#050505] shadow-lg">
        <div className="max-w-5xl mx-auto space-y-8">
          <section className="space-y-6">
            <h2 className="text-4xl font-bold text-[#B4916C]">
              Choose Your Plan
            </h2>
            <p className="text-lg text-white font-medium">
              Upgrade your subscription to unlock more features and capabilities
            </p>
            <p className="text-lg text-white font-medium">
              Change plans as you grow.
            </p>
          </section>

          <div className="grid md:grid-cols-3 gap-8 justify-center">
            <PricingCard
              name="Pro"
              price={proPrice?.unitAmount || 799}
              interval="month"
              features={[
                "20 CV uploads/month ⓘ",
                "10 ATS analyses/month ⓘ",
                "7 Optimizations/month ⓘ",
                "Priority 2 in AI processing ⓘ",
              ]}
              tooltips={{
                "20 CV uploads/month ⓘ": "Upload up to 20 different CVs each month",
                "10 ATS analyses/month ⓘ": "Get ATS compatibility analysis for 10 CVs monthly",
                "7 Optimizations/month ⓘ": "Receive AI-powered optimization suggestions 7 times per month",
                "Priority 2 in AI processing ⓘ": "Your requests are processed with priority level 2",
              }}
              highlight={false}
              priceId="price_1QoUP9FYYYXM77wGBUVqTaiE"
            />
            <PricingCard
              name="Moonlighting"
              price={moonlightingPrice?.unitAmount || 1499}
              interval="month"
              features={[
                "Unlimited CV uploads/month ⓘ",
                "20 ATS analyses/month ⓘ",
                "15 Optimizations/month ⓘ",
                "Access to Analytics Suite ⓘ",
              ]}
              tooltips={{
                "Unlimited CV uploads/month ⓘ": "Upload as many CVs as you need without any monthly limits",
                "20 ATS analyses/month ⓘ": "Get detailed analysis of how your CV performs against ATS systems",
                "15 Optimizations/month ⓘ": "AI-powered suggestions to improve your CV structure and content",
                "Access to Analytics Suite ⓘ": "Advanced metrics and insights about your CV performance",
              }}
              highlight={true}
              priceId={moonlightingPrice?.id}
            />
            <PricingCard
              name="CEO"
              price={ceoPrice?.unitAmount || 9999}
              interval="month"
              features={[
                "Unlimited CV uploads ⓘ",
                "Unlimited ATS analyses ⓘ",
                "Unlimited Optimizations ⓘ",
                "Access to Analytics Suite ⓘ",
                "Early access to new features ⓘ",
              ]}
              tooltips={{
                "Unlimited CV uploads ⓘ": "No monthly limit on CV uploads",
                "Unlimited ATS analyses ⓘ": "Analyze your CVs against ATS systems as many times as you need",
                "Unlimited Optimizations ⓘ": "Get unlimited AI-powered optimization suggestions",
                "Access to Analytics Suite ⓘ": "Full access to advanced analytics and insights",
                "Early access to new features ⓘ": "Be the first to try new platform features",
              }}
              highlight={false}
              priceId="price_1QoYTrFYYYXM77wGffciG20i"
            />
          </div>
        </div>
      </Card>
    </>
  );
}

function PricingCard({
  name,
  price,
  interval,
  features,
  highlight,
  priceId,
  tooltips,
}: {
  name: string;
  price: number;
  interval: string;
  features: string[];
  highlight: boolean;
  priceId?: string;
  tooltips?: Record<string, string>;
}) {
  // For standard cards use #050505 background with #B4916C accent
  // For highlighted card, use a different style to make it stand out
  const cardClass = highlight
    ? "border border-[#B4916C] bg-[#B4916C]/10 shadow-lg hover:shadow-xl"
    : "border border-[#B4916C]/20 bg-[#050505] shadow-lg hover:shadow-xl";

  return (
    <div className={`rounded-lg transition-all duration-300 ${cardClass}`}>
      <div className={`${highlight ? 'bg-[#B4916C]/20' : 'bg-[#B4916C]/10'} py-4 px-6 rounded-t-lg`}>
        <h2 className="text-2xl font-bold text-[#B4916C] mb-2">
          {name}
          {highlight && <span className="ml-2 text-sm bg-[#B4916C]/20 text-[#B4916C] px-2 py-1 rounded-full">Most Popular</span>}
        </h2>
        <p className="text-4xl font-semibold text-white mb-1">
          ${price / 100}
          <span className="text-xl font-normal text-gray-300 ml-1">
            /{interval}
          </span>
        </p>
      </div>
      
      <div className="p-6">
        <ul className="space-y-4 mb-8">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start group relative">
              <Check className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-[#B4916C]" />
              <span className="text-gray-300">
                {feature.replace(" ⓘ", "")}
                {tooltips?.[feature] && (
                  <span className="opacity-0 group-hover:opacity-100 absolute left-0 -top-12 w-64 bg-[#050505] border border-[#B4916C]/20 text-gray-300 text-sm p-2 rounded z-10 transition-opacity duration-300">
                    {tooltips[feature]}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <form action={checkoutAction} className="w-full mt-auto">
          <input type="hidden" name="priceId" value={priceId} />
          <button
            type="submit"
            className={`w-full py-2 rounded-md ${
              highlight
                ? "bg-[#B4916C] hover:bg-[#B4916C]/90 text-white"
                : "bg-[#B4916C]/20 hover:bg-[#B4916C]/30 text-[#B4916C]"
            } transition-colors duration-200 font-medium`}
          >
            Upgrade Now
          </button>
        </form>
      </div>
    </div>
  );
} 