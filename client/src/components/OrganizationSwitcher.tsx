import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api, type Organization } from '@/lib/api';
import { Building2, Check, ChevronsUpDown, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';

export function OrganizationSwitcher() {
  const { currentOrganization, refetch } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isOpen) {
      loadOrganizations();
    }
  }, [isOpen]);

  const loadOrganizations = async () => {
    try {
      const data = await api.getOrganizations();
      setOrganizations(data.organizations);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  };

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrganization?.id) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      await api.switchOrganization(orgId);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['auth-user'] });
      toast({
        title: 'Organization switched',
        description: 'Successfully switched organization',
      });
      setIsOpen(false);
      setLocation('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Failed to switch organization',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const goToSettings = () => {
    setIsOpen(false);
    setLocation('/organization/settings');
  };

  if (!currentOrganization) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-[200px] justify-between"
          disabled={isLoading}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{currentOrganization.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => handleSwitch(org.id)}
            className="cursor-pointer"
          >
            <Check
              className={`mr-2 h-4 w-4 ${
                org.id === currentOrganization.id ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <div className="flex flex-col flex-1">
              <span className="truncate">{org.name}</span>
              <span className="text-xs text-muted-foreground">
                {org.credits} credits · {org.role}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={goToSettings} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Organization Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
