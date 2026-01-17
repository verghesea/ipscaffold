/**
 * PromptDetailsModal Component
 * Displays image generation prompt details with copy and edit capabilities
 * Admin-only feature for viewing/editing DALL-E prompts
 */

import { useState } from 'react';
import { Copy, Check, Loader2, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { SectionImage } from '@/lib/api';

interface PromptDetailsModalProps {
  image: SectionImage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPromptUpdate?: (newPrompt: string) => Promise<void>;
  isAdmin?: boolean;
}

export function PromptDetailsModal({
  image,
  open,
  onOpenChange,
  onPromptUpdate,
  isAdmin = false,
}: PromptDetailsModalProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(image.prompt_used);
  const [regenerating, setRegenerating] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(image.prompt_used);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleEditSave = async () => {
    if (!onPromptUpdate || !editedPrompt.trim() || editedPrompt === image.prompt_used) {
      setEditing(false);
      return;
    }

    setRegenerating(true);
    try {
      await onPromptUpdate(editedPrompt.trim());
      setEditing(false);
      onOpenChange(false); // Close modal after successful regeneration
    } catch (error) {
      console.error('Failed to update prompt:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const handleEditCancel = () => {
    setEditedPrompt(image.prompt_used);
    setEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            Image Generation Prompt
            {isAdmin && !editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
                className="ml-auto"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            Fig {image.section_number} — {image.section_title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prompt Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">
                {editing ? 'Edit Prompt' : 'Claude-Generated Prompt'}
              </h3>
              {!editing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              )}
            </div>

            {editing ? (
              <Textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                placeholder="Enter custom prompt for image generation..."
              />
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm whitespace-pre-wrap">
                {image.prompt_used}
              </div>
            )}
          </div>

          {/* DALL-E Revised Prompt (if available) */}
          {!editing && image.generation_metadata?.revised_prompt && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                DALL-E Revised Prompt
              </h3>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg font-mono text-sm whitespace-pre-wrap text-blue-900">
                {image.generation_metadata.revised_prompt}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                DALL-E may revise prompts for safety and clarity
              </p>
            </div>
          )}

          {/* Metadata */}
          {!editing && image.generation_metadata && (
            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Model</p>
                <p className="text-sm font-medium">{image.generation_metadata.model}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Size</p>
                <p className="text-sm font-medium">{image.generation_metadata.size}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Quality</p>
                <p className="text-sm font-medium capitalize">{image.generation_metadata.quality}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Generated</p>
                <p className="text-sm font-medium">
                  {new Date(image.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {editing ? (
            <>
              <Button
                variant="outline"
                onClick={handleEditCancel}
                disabled={regenerating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={regenerating || !editedPrompt.trim()}
              >
                {regenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  'Save & Regenerate'
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
