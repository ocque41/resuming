import { Navbar } from "@/components/ui/navbar";
import { checkoutAction } from "@/lib/payments/actions";
import { Check } from "lucide-react";
import { getStripePrices, getStripeProducts } from "@/lib/payments/stripe";
import { SubmitButton } from "./submit-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      {/* Use a full-screen container with extra top padding to separate from the sticky navbar */}
      <div className="min-h-screen pt-40 pb-16 container mx-auto px-4 text-left flex-grow">
        <div className="max-w-5xl mx-auto space-y-16">
          <section className="space-y-8">
            <h2 className="text-6xl font-bold text-white animate-fade-in">
              Plans and Pricing
            </h2>
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
  // For standard cards use #050505 background with #B4916C accent
  // For highlighted card, use a different style to make it stand out
  const cardClass = highlight
    ? "border border-[#B4916C] bg-[#B4916C]/10 shadow-lg hover:shadow-xl"
    : "border border-[#B4916C]/20 bg-[#050505] shadow-lg hover:shadow-xl";

  return (
    <div className={`rounded-lg transition-all duration-300 ${cardClass}`}>
      <div className={`${highlight ? 'bg-[#B4916C]/20' : 'bg-[#B4916C]/10'} py-4 px-6 rounded-t-lg`}>
        <h2 className="text-2xl font-bold text-[#B4916C] mb-1">
          {name}
        </h2>
        {highlight && 
          <div className="mb-3">
            <span className="inline-block text-sm bg-[#B4916C]/20 text-[#B4916C] px-2 py-1 rounded-full">
              Most Popular
            </span>
          </div>
        }
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
        <form action="/api/stripe/checkout" method="POST">
          <input type="hidden" name="priceId" value={priceId} />
          <Button
            className={cn(
              "w-full",
              highlight
                ? "bg-gradient-to-r from-[#B4916C] to-[#A3815C] text-white hover:from-[#A3815C] hover:to-[#B4916C]"
                : "bg-primary"
            )}
            size="lg"
          >
            {highlight ? "Upgrade to Pro" : "Subscribe"}
          </Button>
        </form>
      </div>
    </div>
  );
}
