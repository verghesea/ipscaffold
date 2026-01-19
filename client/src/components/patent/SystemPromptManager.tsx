/**
 * SystemPromptManager Component
 * Super-admin interface for managing AI generation system prompts
 * Controls prompts for Scientific Narrative, Business Narrative, and Golden Circle
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, History, RotateCcw, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, type SystemPrompt } from '@/lib/api';
import { cn } from '@/lib/utils';

type PromptType = 'elia15' | 'business_narrative' | 'golden_circle';

const PROMPT_LABELS: Record<PromptType, { title: string; description: string }> = {
  elia15: {
    title: 'Scientific Narrative (Explain Like I\'m 15)',
    description: 'Simplified technical explanation for accessibility',
  },
  business_narrative: {
    title: 'Business Narrative',
    description: 'Commercial value and market opportunity analysis',
  },
  golden_circle: {
    title: 'Golden Circle',
    description: 'Strategic WHY-HOW-WHAT framework analysis',
  },
};

interface PromptEditorProps {
  promptType: PromptType;
}

function PromptEditor({ promptType }: PromptEditorProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Fetch active system prompts
  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ['system-prompts'],
    queryFn: () => api.getAllSystemPrompts(),
  });

  // Fetch version history
  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['system-prompt-versions', promptType],
    queryFn: () => api.getSystemPromptVersions(promptType),
    enabled: showHistory,
  });

  const activePrompt = prompts.find(p => p.prompt_type === promptType && p.is_active);

  // Update prompt mutation
  const updateMutation = useMutation({
    mutationFn: ({ newPrompt, notes }: { newPrompt: string; notes?: string }) =>
      api.updateSystemPrompt(promptType, newPrompt, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-prompts'] });
      queryClient.invalidateQueries({ queryKey: ['system-prompt-versions', promptType] });
      setEditing(false);
      setNotes('');
    },
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => api.rollbackSystemPrompt(promptType, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-prompts'] });
      queryClient.invalidateQueries({ queryKey: ['system-prompt-versions', promptType] });
      setShowHistory(false);
    },
  });

  const handleEdit = () => {
    if (activePrompt) {
      setEditedPrompt(activePrompt.system_prompt);
      setEditing(true);
    }
  };

  const handleSave = () => {
    if (!editedPrompt.trim()) return;
    updateMutation.mutate({ newPrompt: editedPrompt.trim(), notes: notes.trim() || undefined });
  };

  const handleCancel = () => {
    setEditedPrompt('');
    setNotes('');
    setEditing(false);
  };

  const handleRollback = (versionId: string) => {
    if (confirm('Are you sure you want to rollback to this version? This will deactivate the current prompt.')) {
      rollbackMutation.mutate(versionId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activePrompt) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Info className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No active prompt found for this type.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Run database migrations to seed default prompts.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Prompt Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="font-playfair">Current Prompt</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-2">
                <Badge variant="outline">Version {activePrompt.version}</Badge>
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(activePrompt.updated_at).toLocaleDateString()}
                </span>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(true)}
              >
                <History className="w-4 h-4 mr-2" />
                History
              </Button>
              {!editing && (
                <Button size="sm" onClick={handleEdit}>
                  Edit Prompt
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div>
                <Label>System Prompt</Label>
                <Textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="Enter system prompt..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This prompt controls how Claude generates {PROMPT_LABELS[promptType].title} artifacts.
                </p>
              </div>

              <div>
                <Label>Version Notes (Optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Improved clarity, added examples..."
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={!editedPrompt.trim() || updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save as New Version
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>

              {updateMutation.isError && (
                <p className="text-sm text-destructive">
                  Failed to update prompt. Please try again.
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto">
              {activePrompt.system_prompt}
            </div>
          )}

          {!editing && activePrompt.notes && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="font-medium text-blue-900 mb-1">Version Notes:</p>
              <p className="text-blue-800">{activePrompt.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              View and rollback to previous versions of this system prompt
            </DialogDescription>
          </DialogHeader>

          {versionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No version history available
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version) => (
                <Card
                  key={version.id}
                  className={cn(
                    version.is_active && 'border-primary bg-primary/5'
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={version.is_active ? 'default' : 'secondary'}>
                            Version {version.version}
                          </Badge>
                          {version.is_active && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(version.created_at).toLocaleString()}
                        </p>
                        {version.notes && (
                          <p className="text-sm mt-2">{version.notes}</p>
                        )}
                      </div>
                      {!version.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRollback(version.id)}
                          disabled={rollbackMutation.isPending}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <details className="cursor-pointer">
                      <summary className="text-sm font-medium hover:text-primary">
                        View Prompt
                      </summary>
                      <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg font-mono text-xs whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                        {version.system_prompt}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistory(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SystemPromptManager() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-playfair text-2xl">System Prompt Management</CardTitle>
        <CardDescription>
          Configure Claude system prompts for artifact generation (Scientific Narrative, Business Narrative, Golden Circle)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="elia15">
          <TabsList className="grid grid-cols-3 w-full">
            {Object.entries(PROMPT_LABELS).map(([key, { title }]) => (
              <TabsTrigger key={key} value={key}>
                {title}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.keys(PROMPT_LABELS).map((promptType) => (
            <TabsContent key={promptType} value={promptType} className="mt-6">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  {PROMPT_LABELS[promptType as PromptType].description}
                </p>
              </div>
              <PromptEditor promptType={promptType as PromptType} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
