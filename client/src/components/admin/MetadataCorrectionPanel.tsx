/**
 * Metadata Correction Panel
 * Allows admins to re-extract or manually correct patent metadata
 */

import { useState } from 'react';
import { api, type Patent } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, RefreshCw, Edit2, Check, X, Loader2, Sparkles, TrendingUp, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface MetadataCorrectionPanelProps {
  patents: Patent[];
  onPatentUpdate: () => void;
}

export function MetadataCorrectionPanel({ patents, onPatentUpdate }: MetadataCorrectionPanelProps) {
  const { toast } = useToast();
  const [reExtracting, setReExtracting] = useState<Set<string>>(new Set());
  const [editingPatent, setEditingPatent] = useState<Patent | null>(null);
  const [editForm, setEditForm] = useState<{
    inventors: string;
    assignee: string;
    filingDate: string;
    issueDate: string;
    patentNumber: string;
    applicationNumber: string;
    patentClassification: string;
  }>({
    inventors: '',
    assignee: '',
    filingDate: '',
    issueDate: '',
    patentNumber: '',
    applicationNumber: '',
    patentClassification: '',
  });
  const [saving, setSaving] = useState(false);
  const [showPdfText, setShowPdfText] = useState(false);

  // Filter patents with missing metadata
  const patentsWithMissingMetadata = patents.filter(p =>
    !p.assignee || !p.inventors || !p.filingDate || !p.applicationNumber
  );

  const handleReExtract = async (patentId: string) => {
    setReExtracting(prev => new Set(prev).add(patentId));

    try {
      await api.reExtractMetadata(patentId);

      toast({
        title: 'Metadata re-extracted',
        description: 'Patent metadata has been updated from the PDF.',
      });

      onPatentUpdate();
    } catch (error: any) {
      toast({
        title: 'Re-extraction failed',
        description: error.message || 'Failed to re-extract metadata',
        variant: 'destructive',
      });
    } finally {
      setReExtracting(prev => {
        const next = new Set(prev);
        next.delete(patentId);
        return next;
      });
    }
  };

  const handleEditOpen = (patent: Patent) => {
    setEditingPatent(patent);
    setEditForm({
      inventors: patent.inventors || '',
      assignee: patent.assignee || '',
      filingDate: patent.filingDate || '',
      issueDate: patent.issueDate || '',
      patentNumber: patent.patentNumber || '',
      applicationNumber: patent.applicationNumber || '',
      patentClassification: patent.patentClassification || '',
    });
  };

  const handleSaveManualEdit = async () => {
    if (!editingPatent) return;

    setSaving(true);
    try {
      const result = await api.updatePatentMetadata(editingPatent.id, {
        inventors: editForm.inventors || null,
        assignee: editForm.assignee || null,
        filingDate: editForm.filingDate || null,
        issueDate: editForm.issueDate || null,
        patentNumber: editForm.patentNumber || null,
        applicationNumber: editForm.applicationNumber || null,
        patentClassification: editForm.patentClassification || null,
      });

      // Primary success toast
      toast({
        title: 'Metadata updated',
        description: 'Patent metadata has been manually corrected.',
      });

      // Show smart notifications for pattern learning opportunities
      if (result.opportunities && result.opportunities.length > 0) {
        result.opportunities.forEach((opp) => {
          const fieldDisplayName = getFieldDisplayName(opp.fieldName);

          if (opp.ready) {
            // Pattern analysis ready - exciting notification
            toast({
              title: (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Pattern Analysis Ready!</span>
                </div>
              ),
              description: (
                <div>
                  <p>{opp.count} corrections collected for {fieldDisplayName}.</p>
                  <p className="text-xs mt-1 text-gray-600">
                    Visit the Pattern Learning tab to generate patterns
                  </p>
                </div>
              ),
              duration: 8000, // Longer for important notifications
            });
          } else {
            // Still collecting - subtle progress update
            toast({
              title: (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span>Progress: {fieldDisplayName}</span>
                </div>
              ),
              description: `${opp.count} correction(s) collected. ${5 - opp.count} more needed for pattern analysis.`,
              duration: 4000,
            });
          }
        });
      }

      setEditingPatent(null);
      onPatentUpdate();
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update metadata',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
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

  const getMissingFields = (patent: Patent): string[] => {
    const missing: string[] = [];
    if (!patent.assignee) missing.push('Assignee');
    if (!patent.inventors) missing.push('Inventors');
    if (!patent.filingDate) missing.push('Filing Date');
    if (!patent.applicationNumber) missing.push('Application Number');
    return missing;
  };

  if (patentsWithMissingMetadata.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            All Metadata Complete
          </CardTitle>
          <CardDescription>
            All patents have complete metadata. Great job!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Patents with Missing Metadata ({patentsWithMissingMetadata.length})
          </CardTitle>
          <CardDescription>
            Re-extract metadata from PDFs or manually correct the information below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {patentsWithMissingMetadata.map((patent) => {
              const isReExtracting = reExtracting.has(patent.id);
              const missingFields = getMissingFields(patent);
              const hasPdfFile = !!patent.pdfFilename;

              return (
                <div
                  key={patent.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">
                      {patent.friendlyTitle || patent.title || 'Untitled Patent'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Missing: {missingFields.join(', ')}
                    </p>
                    {patent.assignee && (
                      <p className="text-xs text-gray-600 mt-1">
                        Assignee: {patent.assignee}
                      </p>
                    )}
                    {!hasPdfFile && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        PDF file not available - use Manual Edit
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    {hasPdfFile ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReExtract(patent.id)}
                        disabled={isReExtracting}
                      >
                        {isReExtracting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Re-extracting...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Re-extract
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="opacity-50 cursor-not-allowed"
                        title="PDF file no longer available"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Re-extract (N/A)
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleEditOpen(patent)}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Manual Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Manual Edit Dialog */}
      <Dialog open={!!editingPatent} onOpenChange={(open) => !open && setEditingPatent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manually Correct Metadata</DialogTitle>
            <DialogDescription>
              {editingPatent?.friendlyTitle || editingPatent?.title || 'Untitled Patent'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* PDF Text Reference - Collapsible */}
            {editingPatent?.fullText && (
              <Collapsible open={showPdfText} onOpenChange={setShowPdfText}>
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between hover:bg-blue-100"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">
                            View PDF Text (for reference)
                          </span>
                        </div>
                        {showPdfText ? (
                          <ChevronUp className="w-4 h-4 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-blue-600" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="max-h-96 overflow-y-auto bg-white p-4 rounded border text-xs font-mono whitespace-pre-wrap">
                        {editingPatent.fullText}
                      </div>
                      <p className="text-xs text-blue-700 mt-2">
                        💡 Use Cmd+F (Mac) or Ctrl+F (Windows) to search for fields like "Assignee", "Inventor", etc.
                      </p>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
            <div>
              <Label htmlFor="assignee">Assignee</Label>
              <Input
                id="assignee"
                value={editForm.assignee}
                onChange={(e) => setEditForm({ ...editForm, assignee: e.target.value })}
                placeholder="e.g., Howard University, Washington, DC"
              />
            </div>

            <div>
              <Label htmlFor="inventors">Inventors</Label>
              <Textarea
                id="inventors"
                value={editForm.inventors}
                onChange={(e) => setEditForm({ ...editForm, inventors: e.target.value })}
                placeholder="e.g., John Doe, Jane Smith"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="filingDate">Filing Date</Label>
                <Input
                  id="filingDate"
                  value={editForm.filingDate}
                  onChange={(e) => setEditForm({ ...editForm, filingDate: e.target.value })}
                  placeholder="e.g., Mar. 1, 2016"
                />
              </div>

              <div>
                <Label htmlFor="issueDate">Issue Date</Label>
                <Input
                  id="issueDate"
                  value={editForm.issueDate}
                  onChange={(e) => setEditForm({ ...editForm, issueDate: e.target.value })}
                  placeholder="e.g., Jun. 15, 2018"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="patentNumber">Patent Number</Label>
                <Input
                  id="patentNumber"
                  value={editForm.patentNumber}
                  onChange={(e) => setEditForm({ ...editForm, patentNumber: e.target.value })}
                  placeholder="e.g., US 9,999,999 B2"
                />
              </div>

              <div>
                <Label htmlFor="applicationNumber">Application Number</Label>
                <Input
                  id="applicationNumber"
                  value={editForm.applicationNumber}
                  onChange={(e) => setEditForm({ ...editForm, applicationNumber: e.target.value })}
                  placeholder="e.g., 15/123,456"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="patentClassification">Patent Classification</Label>
              <Input
                id="patentClassification"
                value={editForm.patentClassification}
                onChange={(e) => setEditForm({ ...editForm, patentClassification: e.target.value })}
                placeholder="e.g., A61K 31/00"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingPatent(null)}
              disabled={saving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveManualEdit}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
