import { useCallback, useState } from 'react';
import { UploadCloud, FileText, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useStore } from '@/lib/mockStore';
import { useToast } from '@/hooks/use-toast';

export function UploadArea() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [, setLocation] = useLocation();
  const { uploadPatent } = useStore();
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    // Simulate upload delay
    setTimeout(() => {
      const id = uploadPatent(file);
      setIsUploading(false);
      setLocation(`/preview/${id}`);
    }, 2000);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-none border-2 border-dashed p-12 text-center transition-all duration-300
        ${isDragging 
          ? 'border-accent-600 bg-accent-400/10 scale-[1.02]' 
          : 'border-border bg-secondary hover:border-primary-500 hover:bg-card'
        }
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept=".pdf"
        onChange={handleChange}
        disabled={isUploading}
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className={`
          p-4 rounded-full bg-background border border-border shadow-sm transition-transform duration-500
          ${isUploading ? 'animate-pulse' : ''}
        `}>
          {isUploading ? (
            <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8 text-primary-900" />
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="font-display text-xl font-semibold text-primary-900">
            {isUploading ? "Analyzing Patent..." : "Upload Patent PDF"}
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {isUploading 
              ? "Our AI is extracting key insights and generating your summary."
              : "Drag and drop your file here, or click to browse."
            }
          </p>
        </div>

        {!isUploading && (
          <label
            htmlFor="file-upload"
            className="mt-4 px-6 py-3 bg-primary-900 text-primary-foreground font-medium hover:bg-primary-800 transition-colors cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm duration-200"
          >
            Select File
          </label>
        )}
      </div>

      {isUploading && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-secondary overflow-hidden">
          <div className="h-full bg-accent-600 animate-progress origin-left"></div>
        </div>
      )}
    </div>
  );
}
