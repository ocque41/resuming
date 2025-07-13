import * as React from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, easeInOut } from "framer-motion";
import { cn } from "@/lib/utils";

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  showCloseButton?: boolean;
  variant?: "default" | "glass" | "dark" | "accent";
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  overlayClassName?: string;
  footer?: React.ReactNode;
  closeOnOutsideClick?: boolean;
  animationType?: "fade" | "zoom" | "slide";
}

/**
 * A premium modal component with luxury glass effects and smooth animations
 */
export function PremiumModal({
  isOpen,
  onClose,
  children,
  title,
  description,
  showCloseButton = true,
  variant = "default",
  size = "md",
  className,
  contentClassName,
  headerClassName,
  footerClassName,
  overlayClassName,
  footer,
  closeOnOutsideClick = true,
  animationType = "zoom",
}: PremiumModalProps) {
  // Handle ESC key to close the modal
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
    }
    
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, onClose]);
  
  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);
  
  // Variant styles
  const variantStyles = {
    default: "bg-[#111111] border border-[#222222]",
    glass: "backdrop-blur-xl bg-[rgba(17,17,17,0.8)] border border-[rgba(34,34,34,0.8)]",
    dark: "bg-[#050505] border border-[#161616]",
    accent: "bg-[#111111] border border-[#B4916C]",
  };
  
  // Size styles
  const sizeStyles = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-[95vw] h-[90vh]",
  };
  
  // Animation variants based on type
  const modalVariants = {
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.2 } },
      exit: { opacity: 0, transition: { duration: 0.2 } },
    },
    zoom: {
      hidden: { opacity: 0, scale: 0.95 },
      visible: { 
        opacity: 1, 
        scale: 1, 
        transition: { 
          duration: 0.3,
          ease: easeInOut,
        } 
      },
      exit: { 
        opacity: 0, 
        scale: 0.95, 
        transition: { 
          duration: 0.2,
          ease: easeInOut,
        } 
      },
    },
    slide: {
      hidden: { opacity: 0, y: 30 },
      visible: { 
        opacity: 1, 
        y: 0, 
        transition: { 
          duration: 0.3,
          ease: easeInOut,
        } 
      },
      exit: { 
        opacity: 0, 
        y: 30, 
        transition: { 
          duration: 0.2,
          ease: easeInOut,
        } 
      },
    },
  };
  
  // Overlay variants
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { 
        duration: 0.2,
      } 
    },
    exit: { 
      opacity: 0, 
      transition: { 
        duration: 0.2,
        delay: 0.1,
      } 
    },
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop/overlay */}
          <motion.div
            className={cn(
              "fixed inset-0 bg-black/70 backdrop-blur-sm",
              overlayClassName
            )}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={overlayVariants}
            onClick={closeOnOutsideClick ? onClose : undefined}
          />
          
          {/* Modal container */}
          <motion.div
            className={cn(
              "relative z-50 w-full m-4",
              sizeStyles[size],
              className
            )}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants[animationType]}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal content */}
            <div className={cn(
              "rounded-xl shadow-lg overflow-hidden",
              variantStyles[variant],
              contentClassName
            )}>
              {/* Modal header */}
              {(title || showCloseButton) && (
                <div className={cn(
                  "flex items-center justify-between px-6 py-4 border-b border-[rgba(34,34,34,0.8)]",
                  headerClassName
                )}>
                  {title && (
                    <div>
                      <h3 className="text-lg font-safiro font-medium text-[#F9F6EE]">
                        {title}
                      </h3>
                      {description && (
                        <p className="text-sm text-[#8A8782] font-borna mt-1">
                          {description}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {showCloseButton && (
                    <button
                      className="rounded-lg p-1.5 text-[#8A8782] hover:text-[#F9F6EE] hover:bg-[rgba(34,34,34,0.5)] transition-colors"
                      onClick={onClose}
                      aria-label="Close modal"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}
              
              {/* Modal body */}
              <div className="px-6 py-4">
                {children}
              </div>
              
              {/* Modal footer */}
              {footer && (
                <div className={cn(
                  "px-6 py-4 border-t border-[rgba(34,34,34,0.8)]",
                  footerClassName
                )}>
                  {footer}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
} 