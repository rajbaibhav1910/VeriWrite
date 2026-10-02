import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative flex size-9 shrink-0 select-none overflow-hidden rounded-full text-2xs font-semibold uppercase",
  {
    variants: {
      size: {
        xs: "size-6",
        sm: "size-8",
        md: "size-9",
        lg: "size-11",
        xl: "size-14 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const Avatar = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> &
    VariantProps<typeof avatarVariants>
>(function Avatar({ className, size, ...props }, ref) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    />
  );
});
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(function AvatarImage({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn("aspect-square h-full w-full object-cover", className)}
      {...props}
    />
  );
});
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(function AvatarFallback({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-primary-soft text-primary",
        className,
      )}
      {...props}
    />
  );
});
AvatarFallback.displayName = "AvatarFallback";

// Two letters read better than one for single-word display names.
export function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.slice(0, 2).map((word) => word.charAt(0));
  return letters.join("").toUpperCase();
}

export interface AvatarWithFallbackProps
  extends Omit<React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>, "children">,
    VariantProps<typeof avatarVariants> {
  src?: string;
  name: string;
}

const AvatarWithFallback = React.forwardRef<HTMLSpanElement, AvatarWithFallbackProps>(
  function AvatarWithFallback({ src, name, className, size, ...props }, ref) {
    return (
      <Avatar ref={ref} size={size} className={className} {...props}>
        {src ? <AvatarImage src={src} alt={name} /> : null}
        <AvatarFallback>{avatarInitials(name)}</AvatarFallback>
      </Avatar>
    );
  },
);
AvatarWithFallback.displayName = "AvatarWithFallback";

export { Avatar, AvatarImage, AvatarFallback, AvatarWithFallback, avatarVariants };
