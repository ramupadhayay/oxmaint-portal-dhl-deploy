import * as React from "react";
import { Check } from "lucide-react";
import { cn } from '../lib/cn';
const Checkbox = React.forwardRef(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
    const handleChange = (e) => {
      const isChecked = e.target.checked;
      onCheckedChange?.(isChecked);
      onChange?.(e);
    };
    return <div className="relative inline-flex items-center">
        <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={handleChange}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        "appearance-none bg-white checked:bg-primary checked:border-primary",
        className
      )}
      {...props}
    />
        {checked && <Check className="absolute h-3 w-3 text-white pointer-events-none left-0.5 top-0.5" />}
      </div>;
  }
);
Checkbox.displayName = "Checkbox";
export {
  Checkbox
};
