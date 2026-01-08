import { Link, useLocation } from "wouter";
import { useStore } from "@/lib/mockStore";
import { LogOut, LayoutDashboard, User } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useStore();

  return (
    <nav className="w-full border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-display font-bold text-xl md:text-2xl text-primary-900 tracking-tight hover:opacity-80 transition-opacity">
          IP Scaffold
        </Link>

        <div className="flex items-center gap-6">
          {user ? (
            <>
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-secondary rounded-full">
                <span className="text-sm font-medium text-primary-900">{user.credits} Credits</span>
              </div>
              
              <Link href="/dashboard">
                <a className={`text-sm font-medium transition-colors hover:text-accent-600 flex items-center gap-2 ${location === '/dashboard' ? 'text-accent-600' : 'text-muted-foreground'}`}>
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </a>
              </Link>
              
              <button 
                onClick={() => logout()}
                className="text-sm font-medium text-muted-foreground hover:text-destructive transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link href="/">
              <a className="text-sm font-medium text-primary-900 hover:text-accent-600 transition-colors">
                About
              </a>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
