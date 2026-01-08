export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-card py-12 mt-auto">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="font-display font-bold text-lg text-primary-900 mb-2">IP Scaffold</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Transforming technical intellectual property into business-ready narratives.
            </p>
          </div>
          
          <div className="flex gap-8 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary-900 transition-colors">Terms</a>
            <a href="#" className="hover:text-primary-900 transition-colors">Contact</a>
          </div>
        </div>
        <div className="mt-12 text-center text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} IP Scaffold. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
