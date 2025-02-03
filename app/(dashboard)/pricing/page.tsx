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

  const basePlan = products.find((product) => product.name === 'Base');
  const plusPlan = products.find((product) => product.name === 'Plus');

  const basePrice = prices.find((price) => price.productId === basePlan?.id);
  const plusPrice = prices.find((price) => price.productId === plusPlan?.id);

  return (
    <div className="min-h-screen flex flex-col bg-black bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a1a1a]">
      <div className="container mx-auto px-4 py-16 text-center flex-grow">
        <div className="max-w-5xl mx-auto space-y-16">
          <section className="space-y-8">
            <h1 
              className="text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#584235] via-[#B4916C] to-[#2C2420] animate-fade-in"
            >
              Choose Your Plan
            </h1>
            <p 
              className="text-2xl text-gray-300 max-w-3xl mx-auto animate-fade-in-up"
            >
              Unlock the power of AI-driven CV optimization with flexible pricing
            </p>
          </section>

          <div className="grid md:grid-cols-2 gap-8">
            <PricingCard
              name={basePlan?.name || 'Base'}
              price={basePrice?.unitAmount || 800}
              interval={basePrice?.interval || 'month'}
              trialDays={basePrice?.trialPeriodDays || 7}
              features={[
                'Unlimited Usage',
                'Unlimited Workspace Members',
                'Email Support',
              ]}
              priceId={basePrice?.id}
            />
            <PricingCard
              name={plusPlan?.name || 'Plus'}
              price={plusPrice?.unitAmount || 1200}
              interval={plusPrice?.interval || 'month'}
              trialDays={plusPrice?.trialPeriodDays || 7}
              features={[
                'Everything in Base, and:',
                'Early Access to New Features',
                '24/7 Support + Slack Access',
              ]}
              priceId={plusPrice?.id}
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
  trialDays,
  features,
  priceId,
}: {
  name: string;
  price: number;
  interval: string;
  trialDays: number;
  features: string[];
  priceId?: string;
}) {
  return (
    <div 
      className={`${name === 'Base' ? 'bg-[#2C2420]' : 'bg-[#584235]'} p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-base ease-default group border border-gray-800 hover:border-gray-700`}
    >
      <h2 className={`text-2xl font-semibold mb-2 ${name === 'Base' ? 'text-[#B4916C]' : 'text-[#E8DCC4]'}`}>{name}</h2>
      <p className={`text-sm mb-4 ${name === 'Base' ? 'text-[#B4916C]/70' : 'text-[#E8DCC4]/70'}`}>
        with {trialDays} day free trial
      </p>
      <p className={`text-4xl font-medium mb-6 ${name === 'Base' ? 'text-[#B4916C]' : 'text-[#E8DCC4]'}`}>
        ${price / 100}{' '}
        <span className={`text-xl font-normal ${name === 'Base' ? 'text-[#B4916C]/70' : 'text-[#E8DCC4]/70'}`}>
          per user / {interval}
        </span>
      </p>
      <ul className="space-y-4 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className={`h-5 w-5 mr-2 mt-0.5 flex-shrink-0 ${name === 'Base' ? 'text-[#B4916C]' : 'text-[#E8DCC4]'}`} />
            <span className={`${name === 'Base' ? 'text-[#B4916C]' : 'text-[#E8DCC4]'}`}>{feature}</span>
          </li>
        ))}
      </ul>
      <form action={checkoutAction}>
        <input type="hidden" name="priceId" value={priceId} />
        <SubmitButton 
          className={`w-full ${name === 'Base' 
            ? 'bg-[#584235] hover:bg-[#2C2420] text-white' 
            : 'bg-[#2C2420] hover:bg-[#584235] text-white'}`} 
        />
      </form>
    </div>
  );
}
