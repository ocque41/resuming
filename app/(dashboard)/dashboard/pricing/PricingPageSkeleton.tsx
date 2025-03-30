export default function PricingPageSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-12 bg-[#161616] rounded-lg w-3/4 mb-6"></div>
      <div className="h-6 bg-[#161616] rounded-lg w-1/2 mb-8"></div>
      
      <div className="grid md:grid-cols-2 gap-8">
        <PricingCardSkeleton />
        <PricingCardSkeleton highlight={true} />
      </div>
    </div>
  );
}

// Individual pricing card skeleton for loading state
function PricingCardSkeleton({ highlight = false }: { highlight?: boolean }) {
  return (
    <div 
      className={`rounded-xl overflow-hidden border ${
        highlight 
          ? "border-[#B4916C] bg-[#0A0A0A]" 
          : "border-[#222222] bg-[#111111]"
      }`}
    >
      <div className={`${
        highlight 
          ? "bg-gradient-to-r from-[#B4916C]/30 to-[#B4916C]/10" 
          : "bg-[#0D0D0D]"
        } py-6 px-6 relative`}
      >
        <div className="h-8 bg-[#161616] rounded-lg w-1/2 mb-3"></div>
        <div className="h-8 bg-[#161616] rounded-lg w-3/4"></div>
      </div>
      <div className="p-6 space-y-6">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((j) => (
            <div key={j} className="h-5 bg-[#161616] rounded-lg flex items-center">
              <div className="h-4 w-4 bg-[#222222] rounded-full mr-3"></div>
              <div className="h-4 bg-[#161616] rounded-lg w-full"></div>
            </div>
          ))}
        </div>
        <div className="h-10 bg-[#161616] rounded-lg w-full"></div>
      </div>
    </div>
  );
} 