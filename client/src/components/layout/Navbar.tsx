import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { api, type User } from "@/lib/api";
import { LayoutDashboard } from "lucide-react";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { UserAvatarDropdown } from "@/components/layout/UserAvatarDropdown";

export function Navbar() {
  const [location, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await api.getUser();
      setUser(userData);
    } catch (error) {
      // Not authenticated, ignore
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setLocation('/');
  };

  return (
    <nav className="w-full border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-display font-bold text-xl md:text-2xl text-primary-900 tracking-tight hover:opacity-80 transition-opacity" data-testid="link-home">
          IP Scaffold
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {/* Dashboard link - desktop only */}
              <Link
                href="/dashboard"
                className={`hidden md:flex text-sm font-medium transition-colors hover:text-accent-600 items-center gap-2 ${location === '/dashboard' ? 'text-accent-600' : 'text-muted-foreground'}`}
                data-testid="link-dashboard"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              {/* Credits badge - desktop only */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-secondary rounded-full" data-testid="text-credits">
                <span className="text-sm font-medium text-primary-900">{user.credits} Credits</span>
              </div>

              {/* Notification bell */}
              <NotificationDropdown />

              {/* User avatar dropdown */}
              <UserAvatarDropdown user={user} onLogout={handleLogout} />
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
