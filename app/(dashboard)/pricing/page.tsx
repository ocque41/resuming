import { Suspense } from "react";
import { getStripePrices, getStripeProducts } from "@/lib/payments/stripe";
import ClientPricingPage from "./ClientPricingPage";
import { ClientNavbar } from "./ClientNavbar";

// Define types for Stripe data
interface StripePrice {
  id: string;
  productId: string;
  unitAmount: number | null;
  currency?: string;
  interval?: string;
  trialPeriodDays?: number | null;
}

interface StripeProduct {
  id: string;
  name: string;
}

// Create fallback data for static rendering
const fallbackPrices: StripePrice[] = [
  { id: "price_1QoUP9FYYYXM77wGBUVqTaiE", productId: "pro-fallback", unitAmount: 799 },
  { id: "price-moonlighting-fallback", productId: "moonlighting-fallback", unitAmount: 1499 },
  { id: "price_1QoYTrFYYYXM77wGffciG20i", productId: "ceo-fallback", unitAmount: 9999 }
];

const fallbackProducts: StripeProduct[] = [
  { id: "pro-fallback", name: "Pro" },
  { id: "moonlighting-fallback", name: "Moonlighting" },
  { id: "ceo-fallback", name: "CEO" }
];

// Revalidate prices every hour
export const revalidate = 3600;

export default async function PricingPage() {
  // Safely fetch data with fallbacks
  let prices: StripePrice[] = fallbackPrices;
  let products: StripeProduct[] = fallbackProducts;
  
  try {
    // Attempt to fetch real Stripe data
    const [fetchedPrices, fetchedProducts] = await Promise.all([
      getStripePrices(),
      getStripeProducts(),
    ]);
    
    // Only use fetched data if it's valid
    if (fetchedPrices && fetchedPrices.length > 0) {
      prices = fetchedPrices;
    }
    
    if (fetchedProducts && fetchedProducts.length > 0) {
      products = fetchedProducts;
    }
  } catch (error) {
    console.error("Error fetching Stripe data:", error);
    // Use fallback data already set
  }

  return (
    <div className="flex flex-col bg-[#050505] min-h-screen text-[#F9F6EE]">
      <ClientNavbar />
      <main className="min-h-screen pt-24 pb-16 container mx-auto px-4 text-left flex-grow">
        <Suspense fallback={<PricingPageSkeleton />}>
          <ClientPricingPage prices={prices} products={products} />
        </Suspense>
      </main>
    </div>
  );
}

// Simple skeleton loader for the pricing page
function PricingPageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-16 animate-pulse">
      <div className="space-y-8">
        <div className="h-16 bg-[#111111] rounded-lg w-3/4"></div>
        <div className="h-6 bg-[#111111] rounded-lg w-1/2"></div>
        <div className="h-6 bg-[#111111] rounded-lg w-2/3"></div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[#222222] bg-[#111111] overflow-hidden">
            <div className="h-32 bg-[#0D0D0D] p-6"></div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-5 bg-[#161616] rounded-lg"></div>
                ))}
              </div>
              <div className="h-10 bg-[#161616] rounded-lg w-full"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
