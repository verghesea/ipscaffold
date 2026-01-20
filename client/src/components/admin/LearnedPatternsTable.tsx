/**
 * Learned Patterns Table
 * Shows all deployed patterns with success tracking
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Code2, TrendingUp, TrendingDown } from 'lucide-react';
import { getAuthHeaders } from '@/lib/api';

interface LearnedPattern {
  id: string;
  field_name: string;
  pattern: string;
  pattern_description: string;
  priority: number;
  is_active: boolean;
  source: string;
  times_used: number;
  times_succeeded: number;
  success_rate: number;
  created_at: string;
}

export function LearnedPatternsTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [toggling, setToggling] = useState<string | null>(null);

  const { data: patternsData, isLoading } = useQuery({
    queryKey: ['/api/admin/patterns'],
    queryFn: async () => {
      const response = await fetch('/api/admin/patterns', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch patterns');
      return response.json() as Promise<{ patterns: LearnedPattern[] }>;
    },
  });

  const patterns = patternsData?.patterns || [];

  const togglePattern = async (patternId: string, isActive: boolean) => {
    setToggling(patternId);

    try {
      const response = await fetch(`/api/admin/patterns/${patternId}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle pattern');
      }

      toast({
        title: isActive ? 'Pattern activated' : 'Pattern deactivated',
        description: isActive
          ? 'Pattern is now used for extraction'
          : 'Pattern temporarily disabled',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/admin/patterns'] });
    } catch (error) {
      toast({
        title: 'Toggle failed',
        description: 'Failed to update pattern status',
        variant: 'destructive',
      });
    } finally {
      setToggling(null);
    }
  };

  const getFieldDisplayName = (fieldName: string): string => {
    const names: Record<string, string> = {
      assignee: 'Assignee',
      inventors: 'Inventors',
      filingDate: 'Filing Date',
      applicationNumber: 'Application Number',
      patentNumber: 'Patent Number',
      issueDate: 'Issue Date',
      patentClassification: 'Classification',
    };
    return names[fieldName] || fieldName;
  };

  const getSourceBadge = (source: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      ai_generated: { color: 'bg-purple-600', label: 'AI' },
      manual: { color: 'bg-blue-600', label: 'Manual' },
      original: { color: 'bg-gray-600', label: 'Built-in' },
    };
    const badge = badges[source] || { color: 'bg-gray-600', label: source };
    return <Badge className={badge.color}>{badge.label}</Badge>;
  };

  const getSuccessRateBadge = (rate: number, timesUsed: number) => {
    if (timesUsed === 0) {
      return <Badge variant="outline">Not Used</Badge>;
    }
    if (rate >= 90) {
      return (
        <Badge className="bg-green-600">
          <TrendingUp className="w-3 h-3 mr-1" />
          {rate.toFixed(0)}%
        </Badge>
      );
    } else if (rate >= 70) {
      return <Badge className="bg-blue-600">{rate.toFixed(0)}%</Badge>;
    } else {
      return (
        <Badge variant="destructive">
          <TrendingDown className="w-3 h-3 mr-1" />
          {rate.toFixed(0)}%
        </Badge>
      );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (patterns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Learned Patterns</CardTitle>
          <CardDescription>No patterns deployed yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="w-5 h-5" />
          Learned Patterns ({patterns.length})
        </CardTitle>
        <CardDescription>
          Active extraction patterns sorted by priority
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {patterns.map((pattern) => (
            <div
              key={pattern.id}
              className={`p-4 border rounded-lg ${
                pattern.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{getFieldDisplayName(pattern.field_name)}</span>
                    {getSourceBadge(pattern.source)}
                    <Badge variant="outline">Priority: {pattern.priority}</Badge>
                    {getSuccessRateBadge(pattern.success_rate, pattern.times_used)}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-2">{pattern.pattern_description}</p>

                  {/* Pattern */}
                  <div className="bg-gray-50 p-2 rounded border">
                    <code className="text-xs font-mono break-all">/{pattern.pattern}/i</code>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>
                      Used: {pattern.times_used} times
                    </span>
                    <span>
                      Succeeded: {pattern.times_succeeded}/{pattern.times_used}
                    </span>
                    <span>
                      Added: {new Date(pattern.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={pattern.is_active}
                    onCheckedChange={(checked) => togglePattern(pattern.id, checked)}
                    disabled={toggling === pattern.id}
                  />
                  <span className="text-sm text-gray-600">
                    {pattern.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
