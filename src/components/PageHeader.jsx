export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[hsl(222,47%,7%)] sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}