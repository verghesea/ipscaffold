import { Link, useLocation } from "wouter";
import { LogOut, LayoutDashboard, Shield } from "lucide-react";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { useAuth } from "@/hooks/useAuth";

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { user, currentOrganization, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  return (
    <nav className="w-full border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-display font-bold text-xl md:text-2xl text-primary-900 tracking-tight hover:opacity-80 transition-opacity" data-testid="link-home">
          IP Scaffold
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <OrganizationSwitcher />

              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-secondary rounded-full" data-testid="text-credits">
                <span className="text-sm font-medium text-primary-900">
                  {currentOrganization?.credits ?? user.credits} Credits
                </span>
              </div>

              <NotificationDropdown />

              <Link href="/dashboard" className={`text-sm font-medium transition-colors hover:text-accent-600 flex items-center gap-2 ${location === '/dashboard' ? 'text-accent-600' : 'text-muted-foreground'}`} data-testid="link-dashboard">
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>

              {user.isAdmin && (
                <Link href="/admin" className={`text-sm font-medium transition-colors hover:text-amber-600 flex items-center gap-2 ${location === '/admin' ? 'text-amber-600' : 'text-muted-foreground'}`} data-testid="link-admin">
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="text-sm font-medium text-muted-foreground hover:text-destructive transition-colors flex items-center gap-2"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
              data-testid="link-login"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
