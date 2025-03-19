import PageHeader from "./PageHeader";
import AnimatedContainer from "./AnimatedContainer";

interface PageLayoutProps {
  title: string;
  backUrl?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full";
  animation?: "fade" | "slide" | "scale";
  animationDelay?: number;
  animationDuration?: number;
}

/**
 * A consistent page layout component with header and consistent spacing
 */
export default function PageLayout({ 
  title, 
  backUrl, 
  headerExtra, 
  children, 
  maxWidth = "4xl",
  animation = "slide",
  animationDelay = 0.1,
  animationDuration = 0.5 
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-[#050505] text-[#F9F6EE]">
      <div className={`max-w-${maxWidth} mx-auto px-4 sm:px-6 py-8 relative`}>
        <PageHeader title={title} backUrl={backUrl}>
          {headerExtra}
        </PageHeader>
        
        <AnimatedContainer 
          animationType={animation} 
          delay={animationDelay} 
          duration={animationDuration}
        >
          <main className="space-y-6">
            {children}
          </main>
        </AnimatedContainer>
      </div>
    </div>
  );
} 