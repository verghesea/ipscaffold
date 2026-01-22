import { Link } from 'wouter';
import type { User } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { User as UserIcon, Shield, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react';

interface UserAvatarDropdownProps {
  user: User;
  onLogout: () => void;
}

/**
 * Generate a consistent avatar background color based on user ID
 */
function generateAvatarColor(userId: string): string {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-teal-500',
  ];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

/**
 * Extract initials from a name
 * - If name has multiple words, use first letter of first and last word
 * - Otherwise, use first two characters
 */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.substring(0, 2).toUpperCase();
}

/**
 * Get display initials from user data
 * Prioritizes displayName, falls back to email
 */
function getUserInitials(user: User): string {
  if (user.displayName) {
    return getInitials(user.displayName);
  }
  // Use first letter of email
  return user.email[0].toUpperCase();
}

/**
 * Get greeting name from user data
 */
function getGreetingName(user: User): string {
  if (user.displayName) {
    // Use first name only for greeting
    const firstName = user.displayName.split(/\s+/)[0];
    return `Hi, ${firstName}!`;
  }
  return 'Hi there!';
}

export function UserAvatarDropdown({ user, onLogout }: UserAvatarDropdownProps) {
  const initials = getUserInitials(user);
  const avatarColor = generateAvatarColor(user.id);
  const greeting = getGreetingName(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2 h-9"
          data-testid="button-user-avatar"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${avatarColor}`}
          >
            {initials}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Header with greeting */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{greeting}</p>
            {user.organization && (
              <p className="text-xs text-muted-foreground leading-none">
                {user.organization}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Credits - shown on mobile only */}
        <DropdownMenuItem className="md:hidden cursor-default" disabled>
          <span className="text-sm font-medium text-primary-900">
            {user.credits} Credits
          </span>
        </DropdownMenuItem>

        {/* Dashboard link - shown on mobile only */}
        <DropdownMenuItem asChild className="md:hidden cursor-pointer">
          <Link href="/dashboard" className="flex items-center gap-2 w-full">
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="md:hidden" />

        {/* Edit Profile */}
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/profile" className="flex items-center gap-2 w-full">
            <UserIcon className="w-4 h-4" />
            <span>Edit Profile</span>
          </Link>
        </DropdownMenuItem>

        {/* Admin Panel - only for admins */}
        {user.isAdmin && (
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/admin" className="flex items-center gap-2 w-full">
              <Shield className="w-4 h-4" />
              <span>Admin Panel</span>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Sign Out */}
        <DropdownMenuItem
          onClick={onLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
