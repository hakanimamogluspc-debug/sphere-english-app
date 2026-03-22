import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

// BUTTON
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground shadow hover:bg-primary/90 hover:shadow-md hover:-translate-y-0.5",
      destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
      outline: "border-2 border-border bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent/10 hover:text-accent",
      link: "text-primary underline-offset-4 hover:underline",
    };
    const sizes = {
      default: "h-11 px-5 py-2",
      sm: "h-9 rounded-lg px-3 text-xs",
      lg: "h-12 rounded-xl px-8 text-lg font-semibold",
      icon: "h-10 w-10",
    };

    return (
      <button
        ref={ref}
        disabled={isLoading || props.disabled}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading ? <span className="mr-2 animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// INPUT
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type, error, icon, ...props }, ref) => {
  return (
    <div className="relative w-full">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>}
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          icon && "pl-10",
          error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/10",
          className
        )}
        ref={ref}
        {...props}
      />
      {error && <span className="text-xs text-destructive mt-1 absolute -bottom-5 left-1">{error}</span>}
    </div>
  );
});
Input.displayName = "Input";

// LABEL
export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn("text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground mb-2 block", className)} {...props} />
));
Label.displayName = "Label";

// CARD
export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-2xl border border-border/50 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow duration-300", className)} {...props} />
));
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-2xl font-bold tracking-tight text-foreground", className)} {...props} />
));
CardTitle.displayName = "CardTitle";

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

// BADGE
export const Badge = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "destructive" | "outline" | "success" }>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-primary/10 text-primary border-primary/20",
      secondary: "bg-secondary text-secondary-foreground border-transparent",
      destructive: "bg-destructive/10 text-destructive border-destructive/20",
      outline: "text-foreground border-border",
      success: "bg-green-100 text-green-700 border-green-200",
    };
    return (
      <div ref={ref} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors", variants[variant], className)} {...props} />
    );
  }
);
Badge.displayName = "Badge";

// DIALOG / MODAL
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}
export function Modal({ isOpen, onClose, title, description, children, maxWidth = "max-w-md" }: DialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn("fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 p-4 outline-none sm:p-0", maxWidth)}
          >
            <div className="w-full rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
                <div>
                  <h2 className="text-xl font-bold">{title}</h2>
                  {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
                </div>
                <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 max-h-[80vh] overflow-y-auto">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// AVATAR
export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  return (
    <div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-background shadow-sm bg-primary/10 text-primary", className)}>
      {src ? (
        <img src={src} alt={name} className="aspect-square h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-bold font-display tracking-wider">
          {initials}
        </div>
      )}
    </div>
  );
}
