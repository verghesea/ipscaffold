import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SectionImage {
  sectionHeading: string;
  imageUrl: string;
}

interface MarkdownRendererProps {
  content: string;
  images?: SectionImage[];
}

/**
 * Enhanced markdown renderer with support for images, proper styling, and GitHub Flavored Markdown.
 * Automatically embeds section images after ## headers.
 */
export function MarkdownRenderer({ content, images = [] }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Main heading (# Header)
        h1: ({ children, ...props }) => (
          <h1
            className="text-3xl font-display font-bold text-primary-900 mt-8 mb-4 first:mt-0"
            {...props}
          >
            {children}
          </h1>
        ),

        // Section heading (## Header) with image support
        h2: ({ children, ...props }) => {
          const heading = children?.toString() || '';
          const image = images?.find(img => img.sectionHeading === heading);

          return (
            <div>
              <h2
                className="text-2xl font-display font-bold text-primary-900 mt-6 mb-3"
                {...props}
              >
                {children}
              </h2>
              {image && (
                <div className="flex justify-center my-6">
                  <img
                    src={image.imageUrl}
                    alt={heading}
                    className="max-w-md rounded-lg shadow-md border border-gray-200"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          );
        },

        // Subsection heading (### Header)
        h3: ({ children, ...props }) => (
          <h3
            className="text-xl font-display font-semibold text-primary-900 mt-4 mb-2"
            {...props}
          >
            {children}
          </h3>
        ),

        // Paragraphs
        p: ({ children, ...props }) => (
          <p
            className="mb-4 text-muted-foreground leading-relaxed"
            {...props}
          >
            {children}
          </p>
        ),

        // Unordered lists
        ul: ({ children, ...props }) => (
          <ul
            className="list-disc ml-6 mb-4 space-y-2 text-muted-foreground"
            {...props}
          >
            {children}
          </ul>
        ),

        // Ordered lists
        ol: ({ children, ...props }) => (
          <ol
            className="list-decimal ml-6 mb-4 space-y-2 text-muted-foreground"
            {...props}
          >
            {children}
          </ol>
        ),

        // List items
        li: ({ children, ...props }) => (
          <li
            className="leading-relaxed"
            {...props}
          >
            {children}
          </li>
        ),

        // Bold text
        strong: ({ children, ...props }) => (
          <strong
            className="font-semibold text-primary-900"
            {...props}
          >
            {children}
          </strong>
        ),

        // Italic text
        em: ({ children, ...props }) => (
          <em
            className="italic text-primary-800"
            {...props}
          >
            {children}
          </em>
        ),

        // Inline code
        code: ({ children, ...props }) => (
          <code
            className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary-900"
            {...props}
          >
            {children}
          </code>
        ),

        // Code blocks
        pre: ({ children, ...props }) => (
          <pre
            className="p-4 bg-muted rounded-lg overflow-x-auto mb-4 text-sm"
            {...props}
          >
            {children}
          </pre>
        ),

        // Blockquotes
        blockquote: ({ children, ...props }) => (
          <blockquote
            className="border-l-4 border-accent-600 pl-4 my-4 italic text-muted-foreground"
            {...props}
          >
            {children}
          </blockquote>
        ),

        // Horizontal rules
        hr: ({ ...props }) => (
          <hr
            className="my-8 border-border"
            {...props}
          />
        ),

        // Links
        a: ({ children, ...props }) => (
          <a
            className="text-accent-600 hover:text-accent-500 underline transition-colors"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          >
            {children}
          </a>
        ),

        // Tables
        table: ({ children, ...props }) => (
          <div className="overflow-x-auto my-4">
            <table
              className="min-w-full divide-y divide-border"
              {...props}
            >
              {children}
            </table>
          </div>
        ),

        thead: ({ children, ...props }) => (
          <thead
            className="bg-muted"
            {...props}
          >
            {children}
          </thead>
        ),

        tbody: ({ children, ...props }) => (
          <tbody
            className="divide-y divide-border"
            {...props}
          >
            {children}
          </tbody>
        ),

        tr: ({ children, ...props }) => (
          <tr {...props}>
            {children}
          </tr>
        ),

        th: ({ children, ...props }) => (
          <th
            className="px-4 py-2 text-left text-sm font-semibold text-primary-900"
            {...props}
          >
            {children}
          </th>
        ),

        td: ({ children, ...props }) => (
          <td
            className="px-4 py-2 text-sm text-muted-foreground"
            {...props}
          >
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
