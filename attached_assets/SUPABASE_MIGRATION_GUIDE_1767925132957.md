# IP Scaffold - Supabase Migration Guide

## Why Migrate to Supabase?

Supabase simplifies IP Scaffold's architecture while adding powerful features:

**Current Stack Issues:**
- ❌ Custom magic link implementation (complex)
- ❌ SendGrid for emails (another service to manage)
- ❌ Flask-Login for sessions (manual management)
- ❌ No built-in OAuth support
- ❌ Manual database management

**Supabase Benefits:**
- ✅ Magic links built-in (no SendGrid needed)
- ✅ OAuth (Google/GitHub) built-in
- ✅ Authentication handled by Supabase Auth
- ✅ Better text storage (optimized for large content)
- ✅ Real-time updates (can show processing status live)
- ✅ Row Level Security (automatic authorization)
- ✅ Generous free tier (500MB database, 50k MAU)
- ✅ Same PostgreSQL database (schema stays mostly the same)

---

## Architecture Changes

### Before (Current):
```
Flask App
├── PostgreSQL (database)
├── Flask-Login (sessions)
├── SendGrid (emails)
├── Custom magic tokens table
└── Manual authorization checks
```

### After (Supabase):
```
Flask App
├── Supabase (handles everything)
│   ├── PostgreSQL database
│   ├── Auth (magic links, OAuth)
│   ├── Email templates
│   └── Row Level Security
└── Supabase Python Client
```

**What Gets Removed:**
- ❌ `models/magic_token.py` - Supabase Auth handles this
- ❌ `services/email_service.py` - Supabase sends auth emails
- ❌ Flask-Login - Supabase manages sessions
- ❌ SendGrid dependency
- ❌ Custom magic link routes

**What Gets Added:**
- ✅ Supabase Python client
- ✅ Supabase Auth integration
- ✅ Row Level Security policies
- ✅ Optional: OAuth login buttons

---

## Step 1: Set Up Supabase

### 1.1 Create Supabase Project

1. Go to https://supabase.com
2. Sign up / Log in
3. Create new project
4. Choose region (closest to your users)
5. Set database password (save this!)

### 1.2 Get Credentials

From Supabase Dashboard → Settings → API:
- **Project URL**: `https://xxxxx.supabase.co`
- **Anon (public) key**: `eyJhbGc...` (safe for frontend)
- **Service role key**: `eyJhbGc...` (SECRET - backend only)

### 1.3 Update .env

```bash
# Replace PostgreSQL connection
# DATABASE_URL=postgresql://...  # OLD - Remove this

# Add Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...  # Service role key
SUPABASE_ANON_KEY=eyJhbGc...  # Anon key (for frontend if needed)

# Remove SendGrid (no longer needed)
# SENDGRID_API_KEY=...  # OLD - Remove this
# SENDGRID_FROM_EMAIL=...  # OLD - Remove this

# Keep these
ANTHROPIC_API_KEY=sk-ant-...
FLASK_SECRET_KEY=...
FLASK_ENV=development
APP_URL=https://your-app.repl.co
```

---

## Step 2: Update Database Schema

### 2.1 Simplified Schema (Supabase Version)

Supabase Auth handles users automatically. You don't need custom `users` or `magic_tokens` tables.

**Keep these tables:**
- `patents` - Patent data
- `artifacts` - Generated content
- `credit_transactions` - Credit tracking

**Remove these tables:**
- ❌ `users` - Supabase Auth handles this
- ❌ `magic_tokens` - Supabase Auth handles this

**Modified schema:**

```sql
-- Supabase Auth creates 'auth.users' automatically
-- We just need to extend it with credits

-- Create public.profiles table (extends auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    credits INTEGER DEFAULT 100,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Patents table (updated to use UUID)
CREATE TABLE public.patents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    inventors TEXT,
    assignee TEXT,
    filing_date DATE,
    issue_date DATE,
    full_text TEXT NOT NULL,
    pdf_filename TEXT,
    status TEXT DEFAULT 'processing',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.patents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own patents
CREATE POLICY "Users can view own patents"
    ON public.patents FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own patents
CREATE POLICY "Users can insert own patents"
    ON public.patents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own patents
CREATE POLICY "Users can update own patents"
    ON public.patents FOR UPDATE
    USING (auth.uid() = user_id);

-- Artifacts table (updated to use UUID)
CREATE TABLE public.artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patent_id UUID REFERENCES public.patents(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL,
    content TEXT NOT NULL,
    tokens_used INTEGER,
    generation_time_seconds NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view artifacts for their patents
CREATE POLICY "Users can view artifacts for own patents"
    ON public.artifacts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.patents
            WHERE patents.id = artifacts.patent_id
            AND patents.user_id = auth.uid()
        )
    );

-- Credit transactions (updated to use UUID)
CREATE TABLE public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    description TEXT,
    patent_id UUID REFERENCES public.patents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view own transactions"
    ON public.credit_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_patents_user_id ON public.patents(user_id);
CREATE INDEX idx_patents_status ON public.patents(status);
CREATE INDEX idx_artifacts_patent_id ON public.artifacts(patent_id);
CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, credits)
    VALUES (NEW.id, NEW.email, 100);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patents_updated_at
    BEFORE UPDATE ON public.patents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Run this in Supabase SQL Editor:**
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Paste schema above
4. Run

---

## Step 3: Update Dependencies

### 3.1 Update requirements.txt

```txt
# Core
Flask==3.0.0
python-dotenv==1.0.0
werkzeug==3.0.1

# Supabase (replaces psycopg2, Flask-Login, sendgrid)
supabase==2.3.0

# AI & Processing
anthropic==0.8.0
pdfplumber==0.10.3

# Document Generation
python-docx==1.1.0
WeasyPrint==60.1

# Remove these (no longer needed):
# Flask-Login==0.6.3  # Supabase handles auth
# Flask-SQLAlchemy==3.1.1  # Using Supabase client
# psycopg2-binary==2.9.9  # Using Supabase client
# sendgrid==6.11.0  # Supabase sends emails
```

### 3.2 Install

```bash
pip install supabase anthropic pdfplumber python-docx WeasyPrint
```

---

## Step 4: Update Application Code

### 4.1 Create Supabase Client

**File:** `config.py`

```python
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

class Config:
    # Flask
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY')
    DEBUG = os.getenv('FLASK_ENV') == 'development'

    # Supabase
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')
    SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')

    # API Keys
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')

    # App Settings
    APP_URL = os.getenv('APP_URL', 'http://localhost:5000')
    MAX_UPLOAD_SIZE_MB = int(os.getenv('MAX_UPLOAD_SIZE_MB', 10))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_SIZE_MB * 1024 * 1024

    # Upload Settings
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'pdf'}

# Create Supabase client (singleton)
supabase: Client = create_client(
    Config.SUPABASE_URL,
    Config.SUPABASE_KEY
)
```

### 4.2 Update app.py

**File:** `app.py`

```python
from flask import Flask, render_template, request, redirect, session
from config import Config, supabase
import os

# Create Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Create upload folder
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Authentication decorator
def require_auth(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is authenticated via Supabase
        access_token = session.get('access_token')
        if not access_token:
            return redirect('/')

        # Verify token with Supabase
        try:
            user = supabase.auth.get_user(access_token)
            if not user:
                session.clear()
                return redirect('/')
        except:
            session.clear()
            return redirect('/')

        return f(*args, **kwargs)
    return decorated_function

# Import and register blueprints
from routes.public import public_bp
from routes.auth import auth_bp
from routes.dashboard import dashboard_bp
from routes.admin import admin_bp

app.register_blueprint(public_bp)
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(dashboard_bp)
app.register_blueprint(admin_bp, url_prefix='/admin')

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return render_template('errors/404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('errors/500.html'), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=Config.DEBUG)
```

### 4.3 Update Authentication Routes

**File:** `routes/auth.py`

```python
from flask import Blueprint, request, redirect, session, flash, render_template
from config import supabase, Config

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/magic-link', methods=['POST'])
def send_magic_link():
    """Send magic link email via Supabase Auth"""
    email = request.form.get('email', '').strip().lower()

    if not email:
        flash('Please enter a valid email', 'error')
        return redirect(request.referrer or '/')

    try:
        # Supabase handles everything: creating user, sending email, magic link
        supabase.auth.sign_in_with_otp({
            'email': email,
            'options': {
                'email_redirect_to': f'{Config.APP_URL}/auth/callback'
            }
        })

        return redirect('/email-sent')

    except Exception as e:
        flash(f'Error sending magic link: {str(e)}', 'error')
        return redirect(request.referrer or '/')

@auth_bp.route('/callback')
def callback():
    """Handle magic link callback from Supabase"""
    # Supabase redirects here with access_token in URL hash
    # This is handled by frontend JavaScript
    return render_template('auth/callback.html')

@auth_bp.route('/google')
def google_login():
    """Login with Google OAuth"""
    # Supabase handles OAuth
    response = supabase.auth.sign_in_with_oauth({
        'provider': 'google',
        'options': {
            'redirect_to': f'{Config.APP_URL}/auth/callback'
        }
    })
    return redirect(response.url)

@auth_bp.route('/logout')
def logout():
    """Logout user"""
    access_token = session.get('access_token')
    if access_token:
        try:
            supabase.auth.sign_out()
        except:
            pass

    session.clear()
    flash('You have been logged out', 'info')
    return redirect('/')
```

### 4.4 Update Dashboard Routes

**File:** `routes/dashboard.py`

```python
from flask import Blueprint, render_template, session, redirect, flash
from config import supabase
from app import require_auth

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/dashboard')
@require_auth
def dashboard():
    """User dashboard"""
    access_token = session.get('access_token')
    user = supabase.auth.get_user(access_token)

    # Get user profile
    profile = supabase.table('profiles').select('*').eq('id', user.user.id).single().execute()

    # Get user's patents
    patents = supabase.table('patents')\
        .select('*')\
        .eq('user_id', user.user.id)\
        .order('created_at', desc=True)\
        .execute()

    return render_template(
        'dashboard_editorial.html',
        user=profile.data,
        patents=patents.data
    )

@dashboard_bp.route('/patent/<patent_id>')
@require_auth
def patent_detail(patent_id):
    """View patent details"""
    access_token = session.get('access_token')
    user = supabase.auth.get_user(access_token)

    # Get patent (RLS automatically filters by user_id)
    patent = supabase.table('patents')\
        .select('*')\
        .eq('id', patent_id)\
        .single()\
        .execute()

    if not patent.data:
        flash('Patent not found', 'error')
        return redirect('/dashboard')

    # Get artifacts
    artifacts_response = supabase.table('artifacts')\
        .select('*')\
        .eq('patent_id', patent_id)\
        .execute()

    # Build artifacts dict
    artifacts = {}
    for artifact in artifacts_response.data:
        artifacts[artifact['artifact_type']] = artifact['content']

    return render_template(
        'patent_detail_editorial.html',
        patent=patent.data,
        artifacts=artifacts
    )
```

### 4.5 Update Upload Route

**File:** `routes/public.py`

```python
from flask import Blueprint, render_template, request, redirect, session, flash
from werkzeug.utils import secure_filename
from config import supabase, Config
import os
import uuid
from services.pdf_parser import PDFParser
from services.ai_generator import AIGenerator
from threading import Thread

public_bp = Blueprint('public', __name__)

@public_bp.route('/')
def landing():
    return render_template('landing_editorial.html')

@public_bp.route('/upload', methods=['POST'])
def upload():
    """Handle PDF upload"""
    if 'pdf_file' not in request.files:
        flash('No file uploaded', 'error')
        return redirect('/')

    file = request.files['pdf_file']

    if file.filename == '':
        flash('No file selected', 'error')
        return redirect('/')

    if not file.filename.endswith('.pdf'):
        flash('Only PDF files are accepted', 'error')
        return redirect('/')

    try:
        # Save file
        filename = f"{uuid.uuid4()}.pdf"
        filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
        file.save(filepath)

        # Parse PDF
        parser = PDFParser()
        parsed_data = parser.parse_patent_pdf(filepath)

        # Create patent record (no user_id yet - unauthenticated upload)
        patent_data = {
            'title': parsed_data['title'],
            'inventors': parsed_data['inventors'],
            'assignee': parsed_data['assignee'],
            'filing_date': parsed_data['filing_date'].isoformat() if parsed_data['filing_date'] else None,
            'issue_date': parsed_data['issue_date'].isoformat() if parsed_data['issue_date'] else None,
            'full_text': parsed_data['full_text'],
            'pdf_filename': filename,
            'status': 'processing'
        }

        # Insert into Supabase (using service role, no auth required)
        patent = supabase.table('patents').insert(patent_data).execute()
        patent_id = patent.data[0]['id']

        # Generate ELIA15
        ai_generator = AIGenerator()
        elia15_result = ai_generator.generate_elia15(
            parsed_data['full_text'],
            parsed_data['title']
        )

        # Save ELIA15 artifact
        artifact_data = {
            'patent_id': patent_id,
            'artifact_type': 'elia15',
            'content': elia15_result['content'],
            'tokens_used': elia15_result['tokens_used'],
            'generation_time_seconds': elia15_result['generation_time']
        }
        supabase.table('artifacts').insert(artifact_data).execute()

        # Update status
        supabase.table('patents')\
            .update({'status': 'elia15_complete'})\
            .eq('id', patent_id)\
            .execute()

        # Store patent_id in session for later association with user
        session['pending_patent_id'] = patent_id

        return redirect(f'/preview/{patent_id}')

    except Exception as e:
        flash(f'Error processing PDF: {str(e)}', 'error')
        return redirect('/')

@public_bp.route('/preview/<patent_id>')
def preview(patent_id):
    """Display ELIA15 and email gate"""
    # Get patent (no auth required for preview)
    patent = supabase.table('patents')\
        .select('*')\
        .eq('id', patent_id)\
        .single()\
        .execute()

    if not patent.data:
        flash('Patent not found', 'error')
        return redirect('/')

    # Get ELIA15 artifact
    elia15 = supabase.table('artifacts')\
        .select('*')\
        .eq('patent_id', patent_id)\
        .eq('artifact_type', 'elia15')\
        .single()\
        .execute()

    # Check if user is authenticated
    access_token = session.get('access_token')
    show_email_gate = not access_token

    return render_template(
        'preview_editorial.html',
        patent=patent.data,
        elia15_content=elia15.data['content'],
        show_email_gate=show_email_gate
    )

@public_bp.route('/email-sent')
def email_sent():
    return render_template('email_sent_editorial.html')
```

---

## Step 5: Configure Supabase Auth

### 5.1 Enable Magic Links

In Supabase Dashboard → Authentication → Providers:
1. Enable **Email** provider
2. Check "Enable email confirmations" = OFF (for magic links)
3. Check "Enable Magic Link"

### 5.2 Enable OAuth (Optional)

For Google login:
1. Go to Authentication → Providers → Google
2. Enable Google provider
3. Add Google OAuth credentials:
   - Create OAuth app in Google Cloud Console
   - Get Client ID and Client Secret
   - Add authorized redirect: `https://your-project.supabase.co/auth/v1/callback`

### 5.3 Customize Email Templates

In Supabase Dashboard → Authentication → Email Templates:

**Magic Link Template:**
```html
<h2>Your Magic Link</h2>
<p>Click the link below to log in to IP Scaffold:</p>
<p><a href="{{ .ConfirmationURL }}">Log In to IP Scaffold</a></p>
<p>This link expires in 1 hour.</p>
```

### 5.4 Set Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://your-app.repl.co`
- Redirect URLs: `https://your-app.repl.co/auth/callback`

---

## Step 6: Update Frontend Templates

### 6.1 Add Callback Handler Template

**File:** `templates/auth/callback.html`

```html
<!DOCTYPE html>
<html>
<head>
    <title>Logging in...</title>
</head>
<body>
    <p>Logging you in...</p>

    <script>
        // Extract access_token from URL hash (Supabase puts it there)
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
            // Send to backend to set session
            fetch('/auth/set-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    access_token: accessToken,
                    refresh_token: refreshToken
                })
            }).then(() => {
                // Redirect to dashboard
                window.location.href = '/dashboard';
            });
        } else {
            // No token, redirect home
            window.location.href = '/';
        }
    </script>
</body>
</html>
```

### 6.2 Add Session Route

**In `routes/auth.py`:**

```python
@auth_bp.route('/set-session', methods=['POST'])
def set_session():
    """Set session from frontend callback"""
    data = request.get_json()
    access_token = data.get('access_token')
    refresh_token = data.get('refresh_token')

    if access_token:
        session['access_token'] = access_token
        session['refresh_token'] = refresh_token

        # Associate pending patent with user
        pending_patent_id = session.get('pending_patent_id')
        if pending_patent_id:
            user = supabase.auth.get_user(access_token)
            supabase.table('patents')\
                .update({'user_id': user.user.id})\
                .eq('id', pending_patent_id)\
                .execute()
            session.pop('pending_patent_id')

            # Start background artifact generation
            from threading import Thread
            thread = Thread(target=generate_remaining_artifacts, args=(pending_patent_id,))
            thread.daemon = True
            thread.start()

    return {'success': True}
```

### 6.3 Update Email Gate Form

**In `templates/preview_editorial.html`:**

Change form action from `/request-access` to `/auth/magic-link`:

```html
<form action="/auth/magic-link" method="POST">
    <input type="hidden" name="patent_id" value="{{ patent.id }}">
    <input type="email" name="email" placeholder="your.email@university.edu" required>
    <button type="submit" class="btn btn-primary">Get Access →</button>
</form>
```

### 6.4 Add Google Login Button (Optional)

```html
<div style="margin-top: var(--space-lg);">
    <p style="text-align: center; color: var(--neutral-600); margin-bottom: var(--space-sm);">Or</p>
    <a href="/auth/google" class="btn btn-secondary" style="width: 100%; justify-content: center;">
        <svg width="20" height="20" viewBox="0 0 24 24"><!-- Google icon --></svg>
        Continue with Google
    </a>
</div>
```

---

## Step 7: Handle Credit System with Supabase

### 7.1 Update Credit Manager

**File:** `services/credit_manager.py`

```python
from config import supabase

class CreditManager:
    COST_PER_PATENT = 10

    @staticmethod
    def has_sufficient_credits(user_id):
        """Check if user has enough credits"""
        profile = supabase.table('profiles')\
            .select('credits')\
            .eq('id', user_id)\
            .single()\
            .execute()

        return profile.data['credits'] >= CreditManager.COST_PER_PATENT

    @staticmethod
    def deduct_credits_for_patent(user_id, patent_id, patent_title):
        """Deduct credits for patent processing"""
        # Get current credits
        profile = supabase.table('profiles')\
            .select('credits')\
            .eq('id', user_id)\
            .single()\
            .execute()

        current_credits = profile.data['credits']

        if current_credits < CreditManager.COST_PER_PATENT:
            raise ValueError(f"Insufficient credits")

        new_credits = current_credits - CreditManager.COST_PER_PATENT

        # Update credits
        supabase.table('profiles')\
            .update({'credits': new_credits})\
            .eq('id', user_id)\
            .execute()

        # Log transaction
        supabase.table('credit_transactions').insert({
            'user_id': user_id,
            'amount': -CreditManager.COST_PER_PATENT,
            'balance_after': new_credits,
            'transaction_type': 'ip_processing',
            'description': f'Processed patent: {patent_title}',
            'patent_id': patent_id
        }).execute()

    @staticmethod
    def refund_credits_for_failed_patent(user_id, patent_id, patent_title):
        """Refund credits if processing failed"""
        profile = supabase.table('profiles')\
            .select('credits')\
            .eq('id', user_id)\
            .single()\
            .execute()

        new_credits = profile.data['credits'] + CreditManager.COST_PER_PATENT

        supabase.table('profiles')\
            .update({'credits': new_credits})\
            .eq('id', user_id)\
            .execute()

        supabase.table('credit_transactions').insert({
            'user_id': user_id,
            'amount': CreditManager.COST_PER_PATENT,
            'balance_after': new_credits,
            'transaction_type': 'refund',
            'description': f'Refund for failed processing: {patent_title}',
            'patent_id': patent_id
        }).execute()
```

---

## Step 8: Admin Dashboard with Supabase

### 8.1 Update Admin Authentication

**In `routes/admin.py`:**

```python
def admin_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        access_token = session.get('access_token')
        if not access_token:
            return redirect('/admin/login')

        user = supabase.auth.get_user(access_token)
        profile = supabase.table('profiles')\
            .select('is_admin')\
            .eq('id', user.user.id)\
            .single()\
            .execute()

        if not profile.data['is_admin']:
            return redirect('/')

        return f(*args, **kwargs)
    return decorated_function
```

### 8.2 Update Admin Queries

Use Supabase queries instead of SQLAlchemy:

```python
# Get all users with patent counts
users = supabase.rpc('get_users_with_stats').execute()

# Get all patents
patents = supabase.table('patents')\
    .select('*, profiles(email)')\
    .order('created_at', desc=True)\
    .execute()

# Get metrics
total_users = supabase.table('profiles').select('id', count='exact').execute()
total_patents = supabase.table('patents').select('id', count='exact').execute()
```

### 8.3 Create RPC Functions (in Supabase SQL Editor)

```sql
-- Function to get users with stats
CREATE OR REPLACE FUNCTION get_users_with_stats()
RETURNS TABLE (
    id UUID,
    email TEXT,
    credits INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    patent_count BIGINT,
    credits_used INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.email,
        p.credits,
        p.created_at,
        COUNT(pat.id) as patent_count,
        COALESCE(SUM(ct.amount), 0)::INTEGER as credits_used
    FROM profiles p
    LEFT JOIN patents pat ON p.id = pat.user_id
    LEFT JOIN credit_transactions ct ON p.id = ct.user_id
        AND ct.transaction_type = 'ip_processing'
    GROUP BY p.id, p.email, p.credits, p.created_at
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Step 9: Benefits Realized

### What You Gain:

1. **Simpler Code:**
   - Removed ~200 lines of auth code
   - No SendGrid integration
   - No custom magic link implementation

2. **Better UX:**
   - Magic links "just work"
   - Optional Google OAuth
   - Better email deliverability

3. **Security:**
   - Row Level Security (automatic authorization)
   - JWT tokens managed by Supabase
   - No manual session management

4. **Scalability:**
   - Optimized for large text storage
   - Real-time capabilities for status updates
   - Better connection pooling

5. **Cost:**
   - Free tier: 500MB DB + 50k MAU
   - No SendGrid costs
   - Fewer services to maintain

---

## Step 10: Testing Migration

### Test Checklist:

1. ✅ User can sign up with magic link
2. ✅ Magic link email received and works
3. ✅ User profile created with 100 credits
4. ✅ Patent associated with user after login
5. ✅ Dashboard shows user's patents (RLS works)
6. ✅ Credits deducted correctly
7. ✅ Google OAuth works (if enabled)
8. ✅ Admin can view all users/patents
9. ✅ Downloads work
10. ✅ Background artifact generation works

---

## Migration Checklist

- [ ] Create Supabase project
- [ ] Get API keys
- [ ] Update .env with Supabase credentials
- [ ] Run database schema in Supabase SQL Editor
- [ ] Update requirements.txt
- [ ] Install supabase-py
- [ ] Update config.py with Supabase client
- [ ] Update app.py (remove Flask-Login)
- [ ] Update auth routes
- [ ] Update dashboard routes
- [ ] Update upload route
- [ ] Add callback.html template
- [ ] Configure Supabase Auth settings
- [ ] Customize email templates
- [ ] Update credit manager
- [ ] Update admin dashboard
- [ ] Test complete user flow
- [ ] Test admin functionality
- [ ] Deploy!

---

## Troubleshooting

**Issue: Magic links not sending**
- Check Supabase Auth settings → Email provider enabled
- Verify email templates configured
- Check Supabase logs for errors

**Issue: RLS blocking queries**
- Ensure policies are created
- Use service role key for admin operations
- Check auth.uid() is set correctly

**Issue: OAuth not working**
- Verify OAuth credentials in Supabase
- Check redirect URLs match exactly
- Enable OAuth provider in Supabase Auth

**Issue: Session not persisting**
- Check access_token stored in Flask session
- Verify token refresh logic
- Check cookie settings (httpOnly, secure)

---

## Cost Comparison

**Before (PostgreSQL + SendGrid + Flask-Login):**
- Database: $0-10/month
- SendGrid: $0-15/month (after free tier)
- Infrastructure: Time maintaining 3 services

**After (Supabase):**
- Supabase: $0/month (free tier: 500MB DB, 50k MAU)
- All-in-one: Database + Auth + Email
- Infrastructure: Single service to maintain

**Savings:** $10-25/month + reduced complexity

---

## Next Steps

1. Migrate to Supabase following this guide
2. Test thoroughly with sample patents
3. Deploy to production
4. Monitor Supabase dashboard for usage
5. Consider Supabase Pro ($25/month) when you hit limits

---

**Supabase is the perfect fit for IP Scaffold!** 🚀

It simplifies architecture, reduces costs, and provides better features out of the box.
