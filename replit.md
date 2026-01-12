# IP Scaffold

## Overview

IP Scaffold is a web application that transforms patent PDFs into business-ready artifacts using AI. Users upload patent documents, and the system generates three AI-powered outputs:

1. **ELIA15** - A simplified explanation written as if explaining to a 15-year-old
2. **Business Narrative** - Investor-ready pitch content for commercialization
3. **Golden Circle** - Strategic WHY/HOW/WHAT framework based on Simon Sinek's methodology

The application uses a credit-based system (100 credits per new user) with Supabase authentication (magic links and Google OAuth).

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
- **State Management**: TanStack React Query for server state, Zustand for client state
- **Routing**: Wouter for client-side routing
- **Analytics**: Umami for privacy-friendly usage tracking

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript compiled with tsx
- **File Uploads**: Multer for handling PDF uploads (10MB limit)
- **Build Process**: Custom build script using esbuild for server and Vite for client

### Data Storage
- **Database**: Supabase (PostgreSQL)
- **Schema**: Core tables:
  - `profiles` - User accounts linked to Supabase Auth with credit balance
  - `patents` - Uploaded patent documents and metadata
  - `artifacts` - AI-generated content (ELIA15, Business Narrative, Golden Circle)
  - `credit_transactions` - Credit usage tracking and audit trail
  - `promo_codes` - Promotional codes for bonus credits
  - `promo_code_redemptions` - Tracks code usage per user
  - `notifications` - In-app notification system

### Authentication
- **Provider**: Supabase Auth
- **Methods**: 
  - Magic link (passwordless) email authentication
  - Google OAuth
- **Session Management**: JWT tokens stored in localStorage, verified on each API request
- **Admin Access**: Controlled via `is_admin` flag in profiles table

### AI Generation
- **Provider**: Anthropic Claude API (Claude Sonnet model)
- **Services**: Separate generation functions for each artifact type
- **Processing**: Async generation with status tracking (processing → elia15_complete → completed)
- **Retry Logic**: Failed artifacts can be regenerated via admin or user action

### Key Application Routes
- `/` - Landing page with PDF upload
- `/preview/:id` - Shows ELIA15 preview with email gate for remaining artifacts
- `/dashboard` - User's patent library with grid/table view toggle
- `/patent/:id` - Full patent detail with all artifacts
- `/admin` - Admin dashboard with user management, analytics, and promo codes
- `/auth/callback` - OAuth callback handler

### Visual Design
- **Patent Tiles**: DiceBear-generated unique patterns for each patent
- **Artifact Colors**: 
  - ELIA15: Amber/Gold (💡)
  - Business Narrative: Blue (📈)
  - Golden Circle: Purple (🎯)
- **Status Badges**: Color-coded processing states

## External Dependencies

### Third-Party Services
- **Supabase** - Database, authentication, and real-time subscriptions
- **Anthropic Claude API** - AI content generation (~$0.27 per patent processed)
- **SendGrid** - Email delivery for notifications (optional)
- **Umami** - Privacy-friendly web analytics (optional)

### Key NPM Packages
- `@supabase/supabase-js` - Supabase client
- `@anthropic-ai/sdk` - Anthropic API client
- `@sendgrid/mail` - SendGrid email client
- `pdf-parse` - PDF text extraction
- `multer` - File upload handling
- `docx` - Document generation for exports
- `nanoid` - Unique ID generation
- `@dicebear/core` - Avatar/pattern generation
- `zustand` - Client-side state management

### Environment Variables Required
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `ANTHROPIC_API_KEY` - Anthropic API key
- `APP_URL` - Application base URL (for OAuth redirects)
- `SENDGRID_API_KEY` - SendGrid API key (optional)
- `SENDGRID_FROM_EMAIL` - Verified sender email (optional)

## Admin Features
- User management with credit adjustments
- Detailed user profiles with patent history
- Promo code creation and management
- System metrics and analytics dashboard
- Patent retry functionality for failed processing
