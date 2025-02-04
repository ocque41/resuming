import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface GradientCardProps extends Omit<HTMLMotionProps<"div">, "className"> {
  children: React.ReactNode;
  variant?: 'default' | 'wide';
  className?: string;
}

export function GradientCard({ 
  children, 
  className,
  variant = 'default',
  ...props 
}: GradientCardProps) {
  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-3xl p-12",
        "bg-gradient-to-br from-[#584235] via-[#2C2420] to-[#1A1614]",
        "border border-[#B4916C]/20",
        "shadow-2xl transition-all duration-300",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-[#B4916C]/10 before:to-transparent",
        "before:animate-gradient-shine",
        variant === 'default' ? 'w-80' : 'w-full',
        "text-center",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
