import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-blush-100 disabled:pointer-events-none disabled:bg-neutral-200 disabled:text-neutral-700",
  {
    variants: {
      variant: {
        primary:
          "bg-burgundy-800 text-blush-50 shadow-md hover:bg-burgundy-700 active:bg-burgundy-900",
        secondary:
          "border border-rose-500 bg-blush-100 text-burgundy-900 hover:bg-rose-100 active:bg-blush-200",
        outline:
          "border-2 border-rose-600 bg-transparent text-burgundy-900 hover:bg-rose-100 active:bg-blush-200",
        ghost: "text-burgundy-800 hover:bg-blush-200 active:bg-rose-100",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

/**
 * @param {{
 *   className?: string,
 *   variant?: "primary" | "secondary" | "outline" | "ghost",
 *   size?: "sm" | "md" | "lg",
 *   [key: string]: any
 * }} props
 */
export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
