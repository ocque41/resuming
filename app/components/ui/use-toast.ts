// Adapted from shadcn/ui: https://ui.shadcn.com/docs/components/toast
// This is a simplified version just for this project

type ToastProps = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

// In a real implementation, this would use React context
// For now, we'll implement a simple function that console logs and returns the toast
export const toast = (props: ToastProps) => {
  console.log(`Toast: ${props.variant || 'default'}`, props.title, props.description);
  return {
    id: Date.now(),
    ...props,
  };
};

// Hook implementation to match the component usage
export const useToast = () => {
  return { toast };
}; 