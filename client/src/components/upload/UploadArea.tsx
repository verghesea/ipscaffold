import { useCallback, useState } from 'react';
import { UploadCloud, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { analytics } from '@/lib/analytics';
import { Progress } from '@/components/ui/progress';

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  patentId?: string;
  error?: string;
}

export function UploadArea() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<FileUploadStatus[]>([]);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const isUploading = uploads.some(u => u.status === 'uploading' || u.status === 'pending');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: FileUploadStatus[] = [];
    const errors: string[] = [];

    // Validate all files
    for (const file of fileArray) {
      if (file.type !== 'application/pdf') {
        errors.push(`${file.name}: Only PDF files allowed`);
      } else if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: File must be under 10MB`);
      } else {
        validFiles.push({ file, status: 'pending', progress: 0 });
      }
    }

    if (errors.length > 0) {
      toast({
        title: 'Some files skipped',
        description: errors.join('\n'),
        variant: 'destructive',
      });
    }

    if (validFiles.length === 0) return;

    setUploads(validFiles);

    // Process sequentially
    for (let i = 0; i < validFiles.length; i++) {
      setUploads(prev => prev.map((u, idx) =>
        idx === i ? { ...u, status: 'uploading', progress: 10 } : u
      ));

      try {
        const result = await api.uploadPatent(validFiles[i].file);

        analytics.trackPatentUpload(validFiles[i].file.name);

        setUploads(prev => prev.map((u, idx) =>
          idx === i ? {
            ...u,
            status: 'success',
            progress: 100,
            patentId: result.patentId
          } : u
        ));

      } catch (error: any) {
        setUploads(prev => prev.map((u, idx) =>
          idx === i ? {
            ...u,
            status: 'error',
            progress: 0,
            error: error.message || 'Upload failed'
          } : u
        ));
      }
    }

    // Navigate after all uploads complete
    const successful = validFiles.filter((_, i) => {
      const upload = uploads[i];
      return upload && upload.status === 'success';
    });

    setTimeout(() => {
      const currentUploads = uploads.filter(u => u.status === 'success');

      if (currentUploads.length > 1) {
        toast({
          title: 'Uploads complete!',
          description: `${currentUploads.length} patents uploaded successfully`,
        });
        setLocation('/dashboard');
      } else if (currentUploads.length === 1 && currentUploads[0].patentId) {
        toast({
          title: 'Upload successful',
          description: 'Your patent is being analyzed.',
        });
        setLocation(`/preview/${currentUploads[0].patentId}`);
      }
    }, 1000);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
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
      data-testid="upload-area"
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept=".pdf"
        multiple
        onChange={handleChange}
        disabled={isUploading}
        data-testid="input-file"
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
            data-testid="button-select-file"
          >
            Select File{uploads.length > 0 ? 's' : ''}
          </label>
        )}
      </div>

      {isUploading && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-secondary overflow-hidden">
          <div className="h-full bg-accent-600 animate-progress origin-left"></div>
        </div>
      )}

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="mt-6 space-y-2">
          {uploads.map((upload, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg"
            >
              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{upload.file.name}</p>
                {upload.status === 'uploading' && (
                  <Progress value={upload.progress} className="mt-1 h-1" />
                )}
                {upload.error && (
                  <p className="text-xs text-red-500 mt-1">{upload.error}</p>
                )}
              </div>
              {upload.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />}
              {upload.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
              {upload.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
              {upload.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
