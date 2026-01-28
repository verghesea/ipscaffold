/**
 * ImageWatermark Component
 * Non-destructive watermark overlay for section images
 * Layers on top of images without modifying the original
 * Visible both on-screen and in PDF exports
 */

import { cn } from '@/lib/utils';

interface ImageWatermarkProps {
  className?: string;
}

export function ImageWatermark({ className }: ImageWatermarkProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none z-20',
        'flex items-end justify-end p-4',
        className
      )}
    >
      {/* Diagonal watermark pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 100px,
            rgba(37, 99, 235, 0.1) 100px,
            rgba(37, 99, 235, 0.1) 102px
          )`,
        }}
      />

      {/* Bottom-right watermark text */}
      <div className="relative bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded shadow-sm border border-gray-200">
        <p className="font-mono text-xs text-gray-600 select-none">
          IPScaffold.io
        </p>
      </div>
    </div>
  );
}
