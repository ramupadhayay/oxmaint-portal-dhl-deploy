import { cn } from '../lib/cn';
function Textarea({ className, style, ...props }) {
  return <textarea
    data-slot="textarea"
    className={cn(
      // `break-all` broke every line at whatever character reached the edge, so
      // a note read "no hot work in prog / ress". What it was there for is the
      // pasted id or URL with no spaces in it, and `break-words` handles that
      // case alone: words wrap at their boundaries, and only a word too long
      // for the line is broken inside.
      "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 max-h-[200px] w-full break-words overflow-y-auto rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      className
    )}
    style={{ minHeight: "4rem", maxHeight: "200px", overflowY: "auto", resize: "vertical", ...style }}
    {...props}
  />;
}
export {
  Textarea
};
