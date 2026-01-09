# IP Scaffold

## Overview

IP Scaffold is a web application that transforms patent PDFs into business-ready artifacts using AI. Users upload patent documents, and the system generates three AI-powered outputs:

1. **ELIA15** - A simplified explanation written as if explaining to a 15-year-old
2. **Business Narrative** - Investor-ready pitch content for commercialization
3. **Golden Circle** - Strategic WHY/HOW/WHAT framework based on Simon Sinek's methodology

The application uses a credit-based system (100 credits per new user) and magic link authentication for passwordless login.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **Styling**: Tailwind CSS with a "Refined Editorial" design system featuring:
  - Playfair Display (serif) for display typography
  - Work Sans (sans-serif) for body text
  - JetBrains Mono for technical elements
  - Deep scholarly blue primary palette with refined amber accents
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **State Management**: TanStack React Query for server state
- **Routing**: Wouter for client-side routing

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript compiled with tsx
- **Session Management**: express-session with PostgreSQL session store (connect-pg-simple)
- **File Uploads**: Multer for handling PDF uploads (10MB limit)
- **Build Process**: Custom build script using esbuild for server and Vite for client

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Five core tables:
  - `users` - Account info and credit balance
  - `patents` - Uploaded patent documents and metadata
  - `artifacts` - AI-generated content (ELIA15, Business Narrative, Golden Circle)
  - `magicTokens` - Passwordless authentication tokens
  - `creditTransactions` - Credit usage tracking
- **Migrations**: Drizzle Kit for schema migrations

### Authentication
- **Method**: Magic link (passwordless) authentication
- **Flow**: User provides email → receives magic link → clicks to authenticate → session created
- **Session Duration**: 30 days with HTTP-only cookies

### AI Generation
- **Provider**: Anthropic Claude API (Claude Sonnet model)
- **Services**: Separate generation functions for each artifact type
- **Processing**: Async generation with status tracking (processing → elia15_complete → completed)

### Key Application Routes
- `/` - Landing page with PDF upload
- `/preview/:id` - Shows ELIA15 preview with email gate for remaining artifacts
- `/dashboard` - User's patent library
- `/patent/:id` - Full patent detail with all artifacts

## External Dependencies

### Third-Party Services
- **Anthropic Claude API** - AI content generation (~$0.27 per patent processed)
- **SendGrid** - Email delivery for magic links (free tier: 100 emails/day)

### Key NPM Packages
- `@anthropic-ai/sdk` - Anthropic API client
- `@sendgrid/mail` - SendGrid email client
- `pdf-parse` - PDF text extraction
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `express-session` / `connect-pg-simple` - Session management
- `multer` - File upload handling
- `docx` - Document generation for exports
- `nanoid` - Unique ID generation

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - Anthropic API key
- `SENDGRID_API_KEY` - SendGrid API key
- `SENDGRID_FROM_EMAIL` - Verified sender email
- `SESSION_SECRET` - Session encryption key
- `APP_URL` - Application base URL for magic links