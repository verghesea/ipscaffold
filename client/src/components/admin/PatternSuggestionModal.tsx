/**
 * Pattern Suggestion Modal
 * Shows AI-generated pattern with test results and deployment option
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { getAuthHeaders } from '@/lib/api';

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

interface PatternSuggestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldName: string;
  suggestion: PatternSuggestion;
  onDeploy: () => void;
}

export function PatternSuggestionModal({
  open,
  onOpenChange,
  fieldName,
  suggestion,
  onDeploy,
}: PatternSuggestionModalProps) {
  const { toast } = useToast();
  const [deploying, setDeploying] = useState(false);
  const [editedPattern, setEditedPattern] = useState(suggestion.pattern);
  const [editedDescription, setEditedDescription] = useState(suggestion.description);
  const [priority, setPriority] = useState('50');

  const handleDeploy = async () => {
    setDeploying(true);

    try {
      const correctionIds = suggestion.testResults.map((r) => r.correctionId);

      const response = await fetch('/api/admin/patterns/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          fieldName,
          pattern: editedPattern,
          description: editedDescription,
          correctionIds,
          priority: parseInt(priority),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to deploy pattern');
      }

      toast({
        title: 'Pattern deployed!',
        description: `New extraction pattern is now active for ${fieldName}`,
      });

      onDeploy();
    } catch (error: any) {
      toast({
        title: 'Deployment failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeploying(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-600';
      case 'medium':
        return 'bg-blue-600';
      case 'low':
        return 'bg-amber-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getRecommendationBadge = (recommendation: string) => {
    switch (recommendation) {
      case 'auto_deploy':
        return (
          <Badge className="bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Recommended for Auto-Deploy
          </Badge>
        );
      case 'review':
        return (
          <Badge className="bg-blue-600">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Review Before Deploy
          </Badge>
        );
      case 'needs_more_data':
        return (
          <Badge variant="secondary">
            <XCircle className="w-3 h-3 mr-1" />
            Needs More Data
          </Badge>
        );
      default:
        return null;
    }
  };

  const passedTests = suggestion.testResults.filter((r) => r.matched).length;
  const failedTests = suggestion.testResults.length - passedTests;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <DialogTitle>AI-Generated Pattern for {fieldName}</DialogTitle>
          </div>
          <DialogDescription>
            Claude analyzed {suggestion.testedAgainst} corrections and suggested this pattern
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Confidence & Recommendation */}
          <div className="flex items-center gap-3">
            <Badge className={getConfidenceColor(suggestion.confidence)}>
              {suggestion.confidence.toUpperCase()} Confidence
            </Badge>
            {getRecommendationBadge(suggestion.recommendation)}
            <span className="text-sm text-gray-600">
              Pass Rate: {(suggestion.passRate * 100).toFixed(0)}% ({passedTests}/{suggestion.testedAgainst})
            </span>
          </div>

          {/* Pattern */}
          <div>
            <Label>Regex Pattern</Label>
            <Textarea
              value={editedPattern}
              onChange={(e) => setEditedPattern(e.target.value)}
              className="font-mono text-sm"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              JavaScript regex (case-insensitive)
            </p>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Priority */}
          <div>
            <Label>Priority (lower = tried first)</Label>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              min="1"
              max="100"
            />
            <p className="text-xs text-gray-500 mt-1">
              1-49: Learned patterns, 50-99: AI-generated, 100+: Built-in fallbacks
            </p>
          </div>

          {/* Test Results */}
          <div>
            <Label className="mb-2">Test Results</Label>
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {suggestion.testResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-3 flex items-start gap-3 ${
                    result.matched ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  {result.matched ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      Expected: "{result.correctedValue}"
                    </p>
                    {!result.matched && (
                      <p className="text-sm text-red-700">
                        Extracted: {result.extractedValue || '(nothing)'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {suggestion.recommendation === 'needs_more_data' && (
            <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">Low confidence pattern</p>
                <p className="text-amber-700">
                  Consider collecting more corrections before deploying. This pattern may not
                  generalize well.
                </p>
              </div>
            </div>
          )}

          {failedTests > 0 && (
            <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900">Some tests failed</p>
                <p className="text-blue-700">
                  {failedTests} correction(s) won't be matched by this pattern. Review and edit
                  if needed.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deploying}>
            Cancel
          </Button>
          <Button onClick={handleDeploy} disabled={deploying || !editedPattern}>
            {deploying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Deploy Pattern
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
