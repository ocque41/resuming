import { MainNav } from '@/components/ui/main-nav';
import { checkoutAction } from '@/lib/payments/actions';
import { Check } from 'lucide-react';
import { getStripePrices, getStripeProducts } from '@/lib/payments/stripe';
import { SubmitButton } from './submit-button';
// Prices are fresh for one hour max
export const revalidate = 3600;

export default async function PricingPage() {
  const [prices, products] = await Promise.all([
    getStripePrices(),
    getStripeProducts(),
  ]);

  const proPlan = products.find((product) => product.name === 'Pro');
  const moonlightingPlan = products.find((product) => product.name === 'Moonlighting');
  const ceoPlan = products.find((product) => product.name === 'CEO');

  const proPrice = prices.find((price) => price.productId === proPlan?.id);
  const moonlightingPrice = prices.find((price) => price.productId === moonlightingPlan?.id);
  const ceoPrice = prices.find((price) => price.productId === ceoPlan?.id);

  return (
            <h1 
              className="text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#584235] via-[#B4916C] to-[#2C2420] animate-fade-in"
            >
              Plans and Pricing
            </h1>
            <p className="text-xl text-[#B4916C] font-semibold animate-fade-in-up mt-4">
              Enjoy a 1 day free trial to see if you found your solution
            </p>
            <p className="text-xl text-[#B4916C] font-semibold animate-fade-in-up">
              Change plans as you grow.
            </p>
          </section>

          <div className="grid md:grid-cols-3 gap-8 justify-center mb-8">
            <PricingCard
              name="Pro"
              price={proPrice?.unitAmount || 799}
              interval="month"
              annualPrice={6999}
              features={[
                '20 CV uploads/month ⓘ',
                '10 ATS analyses/month ⓘ',
                '7 Optimizations/month ⓘ',
                'Priority 2 in AI processing ⓘ',
              ]}
              tooltips={{
                '20 CV uploads/month ⓘ': 'Upload up to 20 different CVs each month',
                '10 ATS analyses/month ⓘ': 'Get ATS compatibility analysis for 10 CVs monthly',
                '7 Optimizations/month ⓘ': 'Receive AI-powered optimization suggestions 7 times per month',
                'Priority 2 in AI processing ⓘ': 'Your requests are processed with priority level 2'
              }}
              highlight={false}
              priceId="price_1QoUP9FYYYXM77wGBUVqTaiE"
            />
            <PricingCard
              name="Moonlighting"
              price={moonlightingPrice?.unitAmount || 1499}
              interval="month"
              annualPrice={13999}
              features={[
                'Unlimited CV uploads/month ⓘ',
                '20 ATS analyses/month ⓘ',
                '15 Optimizations/month ⓘ',
                'Access to Analytics Suite ⓘ',
              ]}
              tooltips={{
                'Unlimited CV uploads/month ⓘ': 'Upload as many CVs as you need without any monthly limits',
                '20 ATS analyses/month ⓘ': 'Get detailed analysis of how your CV performs against ATS systems',
                '15 Optimizations/month ⓘ': 'AI-powered suggestions to improve your CV structure and content',
                'Access to Analytics Suite ⓘ': 'Advanced metrics and insights about your CV performance'
              }}
              highlight={true}
              priceId="price_1QoYHcFYYYXM77wGjNJer1nW"
            />
            <PricingCard
              name="CEO"
              price={ceoPrice?.unitAmount || 9999}
              interval="month"
              annualPrice={79900}
              features={[
                'Unlimited CV uploads ⓘ',
                'Unlimited ATS analyses ⓘ',
                'Unlimited Optimizations ⓘ',
                'Access to Analytics Suite ⓘ',
                'Early access to new features ⓘ',
                'Secure a high paying job in 3 months or money back guaranteed ⓘ',
              ]}
              tooltips={{
                'Unlimited CV uploads ⓘ': 'No monthly limit on CV uploads',
                'Unlimited ATS analyses ⓘ': 'Analyze your CVs against ATS systems as many times as you need',
                'Unlimited Optimizations ⓘ': 'Get unlimited AI-powered optimization suggestions',
                'Access to Analytics Suite ⓘ': 'Full access to advanced analytics and insights',
                'Early access to new features ⓘ': 'Be the first to try new platform features',
                'Secure a high paying job in 3 months or money back guaranteed ⓘ': 'Full refund if you don\'t secure a high-paying position within 3 months'
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
  annualPrice,
  features,
  highlight,
  priceId,
  tooltips,
}: {
  name: string;
  price: number;
  interval: string;
  annualPrice?: number;
  features: string[];
  highlight: boolean;
  priceId?: string;
  tooltips?: Record<string, string>;
}) {
  return (
    <div 
      className={`p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 ease-in-out group border ${
        highlight 
          ? 'bg-[#584235] border-[#B4916C]' 
          : 'bg-[#2C2420] border-gray-800 hover:border-gray-700'
      }`}
    >
      <h2 className={`text-2xl font-semibold mb-2 ${highlight ? 'text-[#E8DCC4]' : 'text-[#B4916C]'}`}>
        {name}
        {highlight && <span className="ml-2 text-sm text-[#B4916C]">Most Popular</span>}
      </h2>
      <p className={`text-4xl font-medium mb-2 ${highlight ? 'text-[#E8DCC4]' : 'text-[#B4916C]'}`}>
        ${price / 100}
        <span className={`text-xl font-normal ${highlight ? 'text-[#E8DCC4]/70' : 'text-[#B4916C]/70'}`}>
          /{interval}
        </span>
      </p>
      <ul className="space-y-4 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className={`h-5 w-5 mr-2 mt-0.5 flex-shrink-0 ${highlight ? 'text-[#E8DCC4]' : 'text-[#B4916C]'}`} />
            <span className={highlight ? 'text-[#E8DCC4]' : 'text-[#B4916C]'}>
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
          className={`w-full ${highlight
            ? 'bg-[#2C2420] hover:bg-[#584235] text-white' 
            : 'bg-[#584235] hover:bg-[#2C2420] text-white'}`} 
        />
      </form>
    </div>
  );
}
