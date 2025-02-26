import { Navbar } from "@/components/ui/navbar";
import { checkoutAction } from "@/lib/payments/actions";
import { Check } from "lucide-react";
import { getStripePrices, getStripeProducts } from "@/lib/payments/stripe";
import { SubmitButton } from "./submit-button";

// Revalidate prices every hour
export const revalidate = 3600;

export default async function PricingPage() {
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
    <div className="flex flex-col bg-[#050505] min-h-screen">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16 text-left flex-grow">
        <div className="max-w-5xl mx-auto space-y-16">
          <section className="space-y-8">
            <h1
              className="text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#584235] via-[#B4916C] to-[#2C2420] animate-fade-in"
            >
              Plans and Pricing
            </h1>
            <p className="text-xl text-white font-semibold animate-fade-in-up mt-4">
              Enjoy a 1 day free trial to see if you found your solution
            </p>
            <p className="text-xl text-white font-semibold animate-fade-in-up">
              Change plans as you grow.
            </p>
          </section>

          <div className="grid md:grid-cols-3 gap-8 justify-center mb-8">
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
                "Secure a high paying job in 3 months or money back guaranteed ⓘ",
              ]}
              tooltips={{
                "Unlimited CV uploads ⓘ": "No monthly limit on CV uploads",
                "Unlimited ATS analyses ⓘ": "Analyze your CVs against ATS systems as many times as you need",
                "Unlimited Optimizations ⓘ": "Get unlimited AI-powered optimization suggestions",
                "Access to Analytics Suite ⓘ": "Full access to advanced analytics and insights",
                "Early access to new features ⓘ": "Be the first to try new platform features",
                "Secure a high paying job in 3 months or money back guaranteed ⓘ":
                  "Full refund if you don't secure a high-paying position within 3 months",
              }}
              highlight={false}
              priceId="price_1QoYTrFYYYXM77wGffciG20i"
            />
          </div>
        </div>
      </div>
    </div>
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
  // For side cards: use background #050505, border #E8DCC4, text white.
  // For the highlighted card (middle): use background #E8DCC4, border #050505, text #050505.
  const cardClass = highlight
    ? "bg-[#E8DCC4] border border-[#050505] mx-auto"
    : "bg-[#050505] border border-[#E8DCC4]";
  const textClass = highlight ? "text-[#050505]" : "text-white";

  return (
    <div className={`p-6 rounded-lg shadow-md transition-all duration-300 ease-in-out group ${cardClass}`}>
      <h2 className={`text-2xl font-semibold mb-2 ${textClass}`}>
        {name}
        {highlight && <span className="ml-2 text-sm text-[#050505]">Most Popular</span>}
      </h2>
      <p className={`text-4xl font-medium mb-2 ${textClass}`}>
        ${price / 100}
        <span className={`text-xl font-normal ${textClass} opacity-70`}>
          /{interval}
        </span>
      </p>
      <ul className="space-y-4 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className={`h-5 w-5 mr-2 mt-0.5 flex-shrink-0 ${textClass}`} />
            <span className={textClass}>
              {feature}
              {tooltips?.[feature] && (
                <span className="relative inline-block">
                  <span className="invisible hover:visible absolute left-0 -top-12 w-64 bg-black/90 text-white text-sm p-2 rounded z-10">
                    {tooltips[feature]}
                  </span>
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <form action={checkoutAction} className="w-full mt-auto">
        <input type="hidden" name="priceId" value={priceId} />
        <SubmitButton
          className={`w-full ${
            highlight
              ? "bg-[#2C2420] hover:bg-[#584235] text-white"
              : "bg-[#584235] hover:bg-[#2C2420] text-white"
          }`}
        />
      </form>
    </div>
  );
}
