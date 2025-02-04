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
        "bg-[#1A1614]",
        "border border-[#B4916C]/20",
        "shadow-2xl transition-all duration-300",
        "before:absolute before:inset-0 before:z-0",
        "before:bg-[radial-gradient(circle_at_50%_50%,rgba(88,66,53,0.5),rgba(44,36,32,0.2),rgba(26,22,20,0))]",
        "before:blur-xl before:animate-bubble-float",
        "after:absolute after:inset-0 after:z-0",
        "after:bg-[radial-gradient(circle_at_70%_30%,rgba(180,145,108,0.3),rgba(88,66,53,0.1),rgba(26,22,20,0))]",
        "after:blur-xl after:animate-bubble-float-delayed",
        "[&>*]:relative [&>*]:z-10",
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
