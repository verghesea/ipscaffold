/**
 * EnhancedMarkdownRenderer Component
 * Renders markdown with integrated section images
 * Design matches hybrid mockup style (Future Lab + 4-color pen accents)
 */

import { useMemo } from 'react';
import { parseMarkdownSections, mapImagesToSections } from '@/lib/markdownParser';
import { SectionImage } from './SectionImage';
import { ImagePlaceholder } from './ImagePlaceholder';
import type { SectionImage as SectionImageType } from '@/lib/api';
import { cn } from '@/lib/utils';

interface EnhancedMarkdownRendererProps {
  content: string;
  images: SectionImageType[];
  generating: boolean;
  onRegenerateImage?: (sectionNumber: number) => Promise<void>;
  onUpdateImagePrompt?: (imageId: string, newPrompt: string) => Promise<void>;
  isAdmin?: boolean;
  className?: string;
}

// Helper to render line content with bold text
function renderLineContent(line: string): React.ReactNode {
  const boldPattern = /\*\*(.+?)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = boldPattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`bold-${key++}`} className="text-[#2563eb] font-bold">
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts.length > 0 ? parts : line;
}

// Section content renderer
function SectionContent({ lines }: { lines: string[] }) {
  return (
    <div className="bg-white p-6 sm:p-8 border-l-[3px] border-[#2563eb] shadow-sm">
      {lines.map((line, i) => {
        // Skip ## headers (rendered separately)
        if (line.match(/^##\s+/)) return null;

        // Handle ### headers
        if (line.startsWith('### ')) {
          return (
            <h4 key={i} className="text-lg font-semibold text-gray-900 mt-6 mb-3 first:mt-0">
              {renderLineContent(line.replace('### ', ''))}
            </h4>
          );
        }

        // Handle bullet points
        if (line.trim().startsWith('- ')) {
          return (
            <li key={i} className="ml-8 mb-2 text-gray-700 leading-relaxed list-disc marker:text-[#2563eb]">
              {renderLineContent(line.replace(/^[\s]*- /, ''))}
            </li>
          );
        }

        // Handle numbered lists
        if (line.trim().match(/^\d+\./)) {
          return (
            <li key={i} className="ml-8 mb-2 text-gray-700 leading-relaxed list-decimal marker:text-[#2563eb]">
              {renderLineContent(line.replace(/^\d+\.\s*/, ''))}
            </li>
          );
        }

        // Handle empty lines
        if (line.trim() === '') {
          return <div key={i} className="h-3" />;
        }

        // Regular paragraphs
        return (
          <p key={i} className="mb-4 text-gray-700 leading-relaxed last:mb-0">
            {renderLineContent(line)}
          </p>
        );
      })}
    </div>
  );
}

export function EnhancedMarkdownRenderer({
  content,
  images,
  generating,
  onRegenerateImage,
  onUpdateImagePrompt,
  isAdmin = false,
  className,
}: EnhancedMarkdownRendererProps) {
  const sections = useMemo(() => parseMarkdownSections(content), [content]);
  const imageMap = useMemo(() => mapImagesToSections(sections, images), [sections, images]);

  return (
    <div className={cn('space-y-12', className)}>
      {sections.map((section, index) => {
        const image = imageMap.get(section.number);
        const isGenerating = generating && !image;

        return (
          <div
            key={section.number}
            className="section"
            style={{
              animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
            }}
          >
            {/* Image (above section header) */}
            {image ? (
              <SectionImage
                image={image}
                onRegenerate={
                  onRegenerateImage
                    ? () => onRegenerateImage(section.number)
                    : undefined
                }
                onPromptUpdate={
                  onUpdateImagePrompt
                    ? (newPrompt) => onUpdateImagePrompt(image.id, newPrompt)
                    : undefined
                }
                isAdmin={isAdmin}
              />
            ) : (
              <ImagePlaceholder
                sectionNumber={section.number}
                sectionTitle={section.title}
                loading={isGenerating}
                onGenerate={
                  onRegenerateImage && !isGenerating
                    ? () => onRegenerateImage(section.number)
                    : undefined
                }
              />
            )}

            {/* Section Header */}
            <div className="flex items-baseline gap-4 mb-6 flex-wrap">
              <div className="font-mono text-xs font-bold text-[#dc2626] bg-white px-3 py-1 border-2 border-[#dc2626] uppercase tracking-wider flex-shrink-0">
                Section {String(section.number).padStart(2, '0')}
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 relative flex-1 min-w-0">
                {section.title}
                <span className="absolute bottom-[-4px] left-0 w-2/5 h-[2px] bg-[#2563eb]" />
              </h3>
            </div>

            {/* Section Content */}
            <SectionContent lines={section.rawLines.slice(1)} />

            {/* Section Divider (except last) */}
            {index < sections.length - 1 && (
              <div className="relative h-[1px] my-12 bg-gradient-to-r from-transparent via-[#2563eb]/40 to-transparent">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#2563eb] border-2 border-white shadow-sm" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
