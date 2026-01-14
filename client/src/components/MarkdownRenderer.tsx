import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReactNode } from 'react';

interface SectionImage {
  id: string;
  sectionHeading: string;
  sectionOrder: number;
  imageUrl: string;
}

interface MarkdownRendererProps {
  content: string;
  images?: SectionImage[];
}

export function MarkdownRenderer({ content, images = [] }: MarkdownRendererProps) {
  const imageMap = new Map(
    images.map(img => [img.sectionHeading.toLowerCase().trim(), img])
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }: { children: ReactNode }) => {
          const headingText = String(children).toLowerCase().trim();
          const image = imageMap.get(headingText);
          
          return (
            <div className="mt-8 mb-4">
              {image && (
                <div className="mb-4 flex justify-center">
                  <img
                    src={image.imageUrl}
                    alt={String(children)}
                    className="w-32 h-32 object-contain opacity-80"
                    loading="lazy"
                  />
                </div>
              )}
              <h2 className="text-xl font-semibold text-primary-900 font-playfair border-b pb-2">
                {children}
              </h2>
            </div>
          );
        },
        h3: ({ children }: { children: ReactNode }) => (
          <h3 className="text-lg font-semibold text-primary-800 mt-6 mb-2">
            {children}
          </h3>
        ),
        p: ({ children }: { children: ReactNode }) => (
          <p className="text-base leading-relaxed text-gray-700 mb-4">
            {children}
          </p>
        ),
        ul: ({ children }: { children: ReactNode }) => (
          <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700">
            {children}
          </ul>
        ),
        ol: ({ children }: { children: ReactNode }) => (
          <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-700">
            {children}
          </ol>
        ),
        li: ({ children }: { children: ReactNode }) => (
          <li className="text-base leading-relaxed">
            {children}
          </li>
        ),
        strong: ({ children }: { children: ReactNode }) => (
          <strong className="font-semibold text-primary-900">
            {children}
          </strong>
        ),
        blockquote: ({ children }: { children: ReactNode }) => (
          <blockquote className="border-l-4 border-amber-500 pl-4 italic text-gray-600 my-4">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
