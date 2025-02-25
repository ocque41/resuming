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
        "bg-gradient-to-r from-[#584235] via-[#E8DCC4] to-[#B4916C]",
        "border border-[#B4916C]/20",
        "shadow-2xl transition-all duration-300",
        "backdrop-blur-lg",
        "text-center",
        variant === 'default' ? 'w-80' : 'w-full min-h-screen',
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
