import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle } from 'lucide-react';

interface ProgressData {
  stage: string;
  current: number;
  total: number;
  message: string;
  complete: boolean;
}

interface GenerationProgressProps {
  patentId: string;
  onComplete?: () => void;
}

export function GenerationProgress({ patentId, onComplete }: GenerationProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(`/api/patent/${patentId}/progress`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);

        if (data.complete) {
          setIsComplete(true);
          eventSource.close();

          // Call onComplete callback after a short delay
          setTimeout(() => {
            onComplete?.();
          }, 2000);
        }
      } catch (error) {
        console.error('Failed to parse progress data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [patentId, onComplete]);

  // Don't show anything if no progress or already complete
  if (!progress || (isComplete && progress.complete)) {
    return null;
  }

  const percentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <Card className="mb-6 border-2 border-primary/20 bg-primary/5">
      <CardContent className="py-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {isComplete ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {progress.message}
              </p>
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {percentage}%
            </span>
          </div>

          <Progress value={percentage} className="h-2" />

          <p className="text-xs text-muted-foreground">
            Step {progress.current} of {progress.total} • {progress.stage.replace('_', ' ')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
