import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  iconBgColor?: string;
  iconColor?: string;
  fullWidth?: boolean;
}

/**
 * A reusable feature card component for navigation throughout the app
 */
export default function FeatureCard({
  href,
  icon: Icon,
  title,
  description,
  iconBgColor = "bg-[#050505]",
  iconColor = "text-[#B4916C]",
  fullWidth = false,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between p-4 md:p-5 bg-[#111111] border border-[#222222] rounded-xl shadow-lg hover:bg-[#0D0D0D] transition-colors duration-200 ${
        fullWidth ? "md:col-span-2" : ""
      }`}
    >
      <div className="flex items-center">
        <div className={`flex items-center justify-center h-10 w-10 rounded-full ${iconBgColor} ${iconColor} mr-3`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base md:text-lg font-safiro font-medium text-[#F9F6EE]">{title}</h3>
          <p className="text-sm text-[#F9F6EE]/60 font-borna">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-[#B4916C]" />
    </Link>
  );
} 