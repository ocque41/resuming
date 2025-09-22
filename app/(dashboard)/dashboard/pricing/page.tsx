import { Suspense } from "react";
import { getStripePrices, getStripeProducts } from "@/lib/payments/stripe";
import ClientPricingPage from "../../pricing/ClientPricingPage";
import { PageTransition } from "@/components/ui/page-transition";

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

const FALLBACK_PRICES: StripePrice[] = [
  {
    id: "price_pro_fallback",
    productId: "pro-fallback",
    unitAmount: 4900,
    currency: "usd",
    interval: "month",
    trialPeriodDays: null,
  },
];

const FALLBACK_PRODUCTS: StripeProduct[] = [
  { id: "pro-fallback", name: "Pro" },
];

export const revalidate = 3600;

async function loadPricingData(): Promise<{ prices: StripePrice[]; products: StripeProduct[] }> {
  let prices: StripePrice[] = FALLBACK_PRICES;
  let products: StripeProduct[] = FALLBACK_PRODUCTS;

  try {
    const [fetchedPrices, fetchedProducts] = await Promise.all([
      getStripePrices(),
      getStripeProducts(),
    ]);

    if (Array.isArray(fetchedPrices) && fetchedPrices.length > 0) {
      prices = fetchedPrices;
    }

    if (Array.isArray(fetchedProducts) && fetchedProducts.length > 0) {
      products = fetchedProducts;
    }
  } catch (error) {
    console.error("Error loading Stripe pricing data:", error);
  }

  return { prices, products };
}

export default async function DashboardPricingPage() {
  const { prices, products } = await loadPricingData();

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-12">
        <Suspense fallback={<PricingPageSkeleton />}>
          <ClientPricingPage prices={prices} products={products} />
        </Suspense>
      </div>
    </PageTransition>
  );
}

function PricingPageSkeleton() {
  return (
    <div className="space-y-12 animate-pulse">
      <div className="space-y-4">
        <div className="h-12 w-3/4 rounded-lg bg-[#111111]" />
        <div className="h-5 w-1/2 rounded-lg bg-[#111111]" />
        <div className="h-5 w-2/3 rounded-lg bg-[#111111]" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[0, 1].map((key) => (
          <div key={key} className="overflow-hidden rounded-xl border border-[#222222] bg-[#111111]">
            <div className="h-28 bg-[#0D0D0D]" />
            <div className="space-y-4 p-6">
              {[0, 1, 2, 3].map((line) => (
                <div key={line} className="h-4 w-full rounded bg-[#161616]" />
              ))}
              <div className="h-10 w-full rounded bg-[#161616]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
