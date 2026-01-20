/**
 * Pattern Learning Dashboard
 * Shows pattern opportunities and allows AI-driven pattern generation
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2, CheckCircle, AlertCircle, TrendingUp, Eye, Play } from 'lucide-react';
import { getAuthHeaders } from '@/lib/api';
import { PatternSuggestionModal } from './PatternSuggestionModal';
import { LearnedPatternsTable } from './LearnedPatternsTable';

interface PatternOpportunity {
  fieldName: string;
  count: number;
  ready: boolean;
}

interface PatternSuggestion {
  pattern: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  passRate: number;
  testedAgainst: number;
  testResults: Array<{
    correctionId: string;
    correctedValue: string;
    matched: boolean;
    extractedValue: string | null;
  }>;
  recommendation: 'auto_deploy' | 'review' | 'needs_more_data';
}

interface AnalysisResult {
  success: boolean;
  fieldName: string;
  suggestionsCount: number;
  suggestions: PatternSuggestion[];
}

export function PatternLearningDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<{
    fieldName: string;
    suggestion: PatternSuggestion;
  } | null>(null);

  // Fetch pattern opportunities
  const { data: opportunitiesData, isLoading } = useQuery({
    queryKey: ['/api/admin/patterns/opportunities'],
    queryFn: async () => {
      const response = await fetch('/api/admin/patterns/opportunities', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch opportunities');
      return response.json() as Promise<{ opportunities: PatternOpportunity[] }>;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const opportunities = opportunitiesData?.opportunities || [];

  // Analyze corrections mutation
  const analyzeCorrections = async (fieldName: string) => {
    setAnalyzing(fieldName);

    try {
      const response = await fetch('/api/admin/patterns/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ fieldName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to analyze corrections');
      }

      const result: AnalysisResult = await response.json();

      if (result.suggestionsCount === 0) {
        toast({
          title: 'No patterns generated',
          description: `Not enough corrections or no common patterns found for ${fieldName}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Pattern analysis complete!',
          description: `Generated ${result.suggestionsCount} pattern suggestion(s)`,
        });

        // Show the first suggestion
        if (result.suggestions.length > 0) {
          setSelectedSuggestion({
            fieldName: result.fieldName,
            suggestion: result.suggestions[0],
          });
        }
      }
    } catch (error: any) {
      toast({
        title: 'Analysis failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(null);
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

  const getConfidenceBadge = (count: number, ready: boolean) => {
    if (ready && count >= 10) {
      return <Badge className="bg-green-600">High Confidence ({count})</Badge>;
    } else if (ready) {
      return <Badge className="bg-blue-600">Ready ({count})</Badge>;
    } else if (count >= 3) {
      return <Badge variant="secondary">Collecting ({count}/5)</Badge>;
    } else {
      return <Badge variant="outline">Low Data ({count})</Badge>;
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

  const readyOpportunities = opportunities.filter((o) => o.ready);
  const collectingOpportunities = opportunities.filter((o) => !o.ready);

  return (
    <div className="space-y-6">
      {/* Pattern Opportunities */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Pattern Learning Opportunities
              </CardTitle>
              <CardDescription>
                AI analyzes your corrections to generate extraction patterns
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {readyOpportunities.length} Ready
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {opportunities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No corrections yet</p>
              <p className="text-sm">
                Make some manual corrections to start building patterns
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Ready for analysis */}
              {readyOpportunities.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Ready for Analysis ({readyOpportunities.length})
                  </h3>
                  <div className="space-y-2">
                    {readyOpportunities.map((opp) => (
                      <div
                        key={opp.fieldName}
                        className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <TrendingUp className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="font-medium">{getFieldDisplayName(opp.fieldName)}</p>
                            <p className="text-sm text-gray-600">
                              {opp.count} corrections collected
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getConfidenceBadge(opp.count, opp.ready)}
                          <Button
                            onClick={() => analyzeCorrections(opp.fieldName)}
                            disabled={analyzing === opp.fieldName}
                            size="sm"
                          >
                            {analyzing === opp.fieldName ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                Analyze Patterns
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Still collecting */}
              {collectingOpportunities.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                    <Loader2 className="w-4 h-4" />
                    Collecting Data ({collectingOpportunities.length})
                  </h3>
                  <div className="space-y-2">
                    {collectingOpportunities.map((opp) => (
                      <div
                        key={opp.fieldName}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Eye className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{getFieldDisplayName(opp.fieldName)}</p>
                            <p className="text-sm text-gray-500">
                              {opp.count} corrections ({5 - opp.count} more needed)
                            </p>
                          </div>
                        </div>
                        {getConfidenceBadge(opp.count, opp.ready)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Learned Patterns Table */}
      <LearnedPatternsTable />

      {/* Pattern Suggestion Modal */}
      {selectedSuggestion && (
        <PatternSuggestionModal
          open={!!selectedSuggestion}
          onOpenChange={(open) => !open && setSelectedSuggestion(null)}
          fieldName={selectedSuggestion.fieldName}
          suggestion={selectedSuggestion.suggestion}
          onDeploy={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/patterns/opportunities'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/patterns'] });
            setSelectedSuggestion(null);
          }}
        />
      )}
    </div>
  );
}
