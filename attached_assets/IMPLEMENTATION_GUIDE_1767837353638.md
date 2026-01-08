# IP Scaffold - Implementation Guide for Replit AI

## Overview

This guide provides step-by-step instructions for building IP Scaffold MVP in Replit. Follow each phase sequentially.

---

## Prerequisites

Before starting:
1. Create a new Python Replit project
2. Enable PostgreSQL database in Replit
3. Obtain these API keys:
   - **Anthropic API key** (for Claude AI) - get from https://console.anthropic.com
   - **SendGrid API key** (for email) - get from https://sendgrid.com (free tier)

---

## Project Structure

Create this folder structure:

```
ipscaffold/
├── app.py                      # Main Flask application entry point
├── config.py                   # Configuration settings
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables (DO NOT COMMIT)
├── .gitignore                  # Git ignore file
│
├── models/
│   ├── __init__.py
│   ├── database.py             # Database connection and Base
│   ├── user.py                 # User model
│   ├── patent.py               # Patent model
│   ├── artifact.py             # Artifact model
│   └── magic_token.py          # MagicToken model
│
├── services/
│   ├── __init__.py
│   ├── pdf_parser.py           # PDF parsing logic
│   ├── ai_generator.py         # AI artifact generation
│   ├── email_service.py        # Email sending (magic links)
│   ├── document_generator.py   # PDF/DOCX/TXT generation
│   └── credit_manager.py       # Credit deduction/tracking
│
├── routes/
│   ├── __init__.py
│   ├── public.py               # Public routes (landing, upload, preview)
│   ├── auth.py                 # Auth routes (magic link verification)
│   └── dashboard.py            # Protected routes (dashboard, patent view)
│
├── templates/
│   ├── base.html               # Base template with navbar, footer
│   ├── landing.html            # Landing page with upload form
│   ├── preview.html            # ELIA15 preview + email gate
│   ├── email_sent.html         # Email confirmation page
│   ├── dashboard.html          # User dashboard
│   ├── patent_detail.html      # Patent + artifacts view
│   ├── credits.html            # Credit balance and history
│   ├── email/
│   │   └── magic_link.html     # Magic link email template
│   └── errors/
│       ├── 404.html
│       ├── 403.html
│       └── 500.html
│
├── static/
│   ├── css/
│   │   └── style.css           # Main stylesheet
│   ├── js/
│   │   └── main.js             # JavaScript for interactivity
│   └── images/
│       └── logo.png            # Logo (optional)
│
└── uploads/                    # Temporary PDF storage (gitignored)
```

---

## Phase 1: Project Setup & Configuration

### Step 1.1: Create requirements.txt

```txt
Flask==3.0.0
Flask-Login==0.6.3
Flask-SQLAlchemy==3.1.1
psycopg2-binary==2.9.9
anthropic==0.8.0
pdfplumber==0.10.3
python-docx==1.1.0
WeasyPrint==60.1
sendgrid==6.11.0
python-dotenv==1.0.0
werkzeug==3.0.1
```

### Step 1.2: Create .env file

```bash
# Database (Replit provides this automatically)
DATABASE_URL=postgresql://username:password@hostname:5432/database_name

# Anthropic API
ANTHROPIC_API_KEY=your_anthropic_key_here

# SendGrid Email
SENDGRID_API_KEY=your_sendgrid_key_here
SENDGRID_FROM_EMAIL=noreply@your-domain.com

# Flask
FLASK_SECRET_KEY=your_random_secret_key_here
FLASK_ENV=development

# App Settings
APP_URL=https://your-app.repl.co
MAX_UPLOAD_SIZE_MB=10
```

**Generate SECRET_KEY:**
```python
import secrets
print(secrets.token_hex(32))
```

### Step 1.3: Create .gitignore

```
.env
__pycache__/
*.pyc
*.pyo
*.db
uploads/
venv/
.replit
replit.nix
```

### Step 1.4: Create config.py

```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Flask
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY')
    DEBUG = os.getenv('FLASK_ENV') == 'development'

    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # API Keys
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
    SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')
    SENDGRID_FROM_EMAIL = os.getenv('SENDGRID_FROM_EMAIL')

    # App Settings
    APP_URL = os.getenv('APP_URL', 'http://localhost:5000')
    MAX_UPLOAD_SIZE_MB = int(os.getenv('MAX_UPLOAD_SIZE_MB', 10))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_SIZE_MB * 1024 * 1024  # bytes

    # Upload Settings
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'pdf'}
```

---

## Phase 2: Database Setup

### Step 2.1: Create models/database.py

```python
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def init_db(app):
    """Initialize database with Flask app"""
    db.init_app(app)
    with app.app_context():
        db.create_all()
```

### Step 2.2: Create models/user.py

```python
from datetime import datetime
from models.database import db
from flask_login import UserMixin

class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    credits = db.Column(db.Integer, default=100, nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    patents = db.relationship('Patent', back_populates='user', cascade='all, delete-orphan')
    magic_tokens = db.relationship('MagicToken', back_populates='user', cascade='all, delete-orphan')
    credit_transactions = db.relationship('CreditTransaction', back_populates='user')

    def __repr__(self):
        return f'<User {self.email}>'

    @staticmethod
    def find_or_create_by_email(email):
        """Find user by email or create new user"""
        email = email.lower().strip()
        user = User.query.filter_by(email=email).first()

        if not user:
            user = User(email=email, credits=100)
            db.session.add(user)
            db.session.commit()

            # Create signup bonus transaction
            from models.credit_transaction import CreditTransaction
            CreditTransaction.create_transaction(
                user_id=user.id,
                amount=100,
                transaction_type='signup_bonus',
                description='Welcome bonus'
            )

        return user
```

### Step 2.3: Create models/patent.py

```python
from datetime import datetime
from models.database import db

class Patent(db.Model):
    __tablename__ = 'patents'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Nullable for unclaimed uploads
    title = db.Column(db.Text)
    inventors = db.Column(db.Text)
    assignee = db.Column(db.Text)
    filing_date = db.Column(db.Date)
    issue_date = db.Column(db.Date)
    full_text = db.Column(db.Text, nullable=False)
    pdf_filename = db.Column(db.String(255))
    status = db.Column(db.String(50), default='processing', nullable=False)
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', back_populates='patents')
    artifacts = db.relationship('Artifact', back_populates='patent', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Patent {self.id}: {self.title}>'

    def get_artifact(self, artifact_type):
        """Get specific artifact by type"""
        return next((a for a in self.artifacts if a.artifact_type == artifact_type), None)

    def is_processing_complete(self):
        """Check if all 3 artifacts are generated"""
        return len(self.artifacts) >= 3 and self.status == 'completed'
```

### Step 2.4: Create models/artifact.py

```python
from datetime import datetime
from models.database import db

class Artifact(db.Model):
    __tablename__ = 'artifacts'
    __table_args__ = (
        db.UniqueConstraint('patent_id', 'artifact_type', name='uix_patent_artifact'),
    )

    id = db.Column(db.Integer, primary_key=True)
    patent_id = db.Column(db.Integer, db.ForeignKey('patents.id'), nullable=False)
    artifact_type = db.Column(db.String(50), nullable=False)  # elia15, business_narrative, golden_circle
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    tokens_used = db.Column(db.Integer)
    generation_time_seconds = db.Column(db.Numeric(10, 2))

    # Relationships
    patent = db.relationship('Patent', back_populates='artifacts')

    def __repr__(self):
        return f'<Artifact {self.artifact_type} for Patent {self.patent_id}>'
```

### Step 2.5: Create models/magic_token.py

```python
from datetime import datetime, timedelta
from models.database import db
import secrets

class MagicToken(db.Model):
    __tablename__ = 'magic_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime)
    patent_id = db.Column(db.Integer, db.ForeignKey('patents.id'))

    # Relationships
    user = db.relationship('User', back_populates='magic_tokens')
    patent = db.relationship('Patent')

    def __repr__(self):
        return f'<MagicToken {self.token[:8]}...>'

    @staticmethod
    def create_token(user_id, patent_id=None, expires_hours=1):
        """Create a new magic link token"""
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=expires_hours)

        magic_token = MagicToken(
            user_id=user_id,
            token=token,
            expires_at=expires_at,
            patent_id=patent_id
        )
        db.session.add(magic_token)
        db.session.commit()

        return magic_token

    def is_valid(self):
        """Check if token is valid (not used and not expired)"""
        return self.used_at is None and self.expires_at > datetime.utcnow()

    def mark_as_used(self):
        """Mark token as used"""
        self.used_at = datetime.utcnow()
        db.session.commit()
```

### Step 2.6: Create models/credit_transaction.py

```python
from datetime import datetime
from models.database import db

class CreditTransaction(db.Model):
    __tablename__ = 'credit_transactions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    balance_after = db.Column(db.Integer, nullable=False)
    transaction_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    patent_id = db.Column(db.Integer, db.ForeignKey('patents.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', back_populates='credit_transactions')
    patent = db.relationship('Patent')

    def __repr__(self):
        return f'<CreditTransaction {self.transaction_type}: {self.amount}>'

    @staticmethod
    def create_transaction(user_id, amount, transaction_type, description, patent_id=None):
        """Create a credit transaction and update user balance"""
        from models.user import User

        user = User.query.get(user_id)
        new_balance = user.credits + amount
        user.credits = new_balance

        transaction = CreditTransaction(
            user_id=user_id,
            amount=amount,
            balance_after=new_balance,
            transaction_type=transaction_type,
            description=description,
            patent_id=patent_id
        )

        db.session.add(transaction)
        db.session.commit()

        return transaction
```

### Step 2.7: Create models/__init__.py

```python
from models.database import db, init_db
from models.user import User
from models.patent import Patent
from models.artifact import Artifact
from models.magic_token import MagicToken
from models.credit_transaction import CreditTransaction

__all__ = ['db', 'init_db', 'User', 'Patent', 'Artifact', 'MagicToken', 'CreditTransaction']
```

---

## Phase 3: Core Services

### Step 3.1: Create services/pdf_parser.py

```python
import pdfplumber
import re
from datetime import datetime

class PDFParser:
    @staticmethod
    def parse_patent_pdf(pdf_path):
        """
        Parse patent PDF and extract structured data.
        Returns dict with title, inventors, assignee, dates, full_text
        """
        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Extract all text
                full_text = ""
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        full_text += text + "\n"

            if not full_text.strip():
                raise ValueError("PDF contains no extractable text")

            # Extract structured fields
            data = {
                'title': PDFParser._extract_title(full_text),
                'inventors': PDFParser._extract_inventors(full_text),
                'assignee': PDFParser._extract_assignee(full_text),
                'filing_date': PDFParser._extract_filing_date(full_text),
                'issue_date': PDFParser._extract_issue_date(full_text),
                'full_text': full_text
            }

            return data

        except Exception as e:
            raise Exception(f"Error parsing PDF: {str(e)}")

    @staticmethod
    def _extract_title(text):
        """Extract patent title from text"""
        # Look for title patterns in first 1000 chars
        header = text[:1000]

        # Common pattern: Title appears after "Title:" or on second line
        title_match = re.search(r'(?:Title|TITLE):\s*(.+?)(?:\n|$)', header, re.IGNORECASE)
        if title_match:
            return title_match.group(1).strip()

        # Fallback: Second non-empty line
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        if len(lines) >= 2:
            return lines[1]

        return "Untitled Patent"

    @staticmethod
    def _extract_inventors(text):
        """Extract inventor names"""
        inventor_match = re.search(r'Inventor[s]?:\s*(.+?)(?:\n\n|Assignee)', text, re.IGNORECASE | re.DOTALL)
        if inventor_match:
            return inventor_match.group(1).strip().replace('\n', ', ')
        return None

    @staticmethod
    def _extract_assignee(text):
        """Extract assignee/institution"""
        assignee_match = re.search(r'Assignee:\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if assignee_match:
            return assignee_match.group(1).strip()
        return None

    @staticmethod
    def _extract_filing_date(text):
        """Extract filing date"""
        date_match = re.search(r'(?:Filed|Filing Date):\s*([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})', text, re.IGNORECASE)
        if date_match:
            try:
                return datetime.strptime(date_match.group(1), '%B %d, %Y').date()
            except:
                return None
        return None

    @staticmethod
    def _extract_issue_date(text):
        """Extract issue/grant date"""
        date_match = re.search(r'(?:Patent No\.|Issued|Grant Date).*?([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})', text, re.IGNORECASE)
        if date_match:
            try:
                return datetime.strptime(date_match.group(1), '%B %d, %Y').date()
            except:
                return None
        return None
```

### Step 3.2: Create services/ai_generator.py

See CODE_EXAMPLES.md for complete implementation (too long for this section).

Key methods:
- `generate_elia15(full_text, title)` → returns ELIA15 content
- `generate_business_narrative(full_text, elia15_content)` → returns business narrative
- `generate_golden_circle(elia15_content, business_narrative)` → returns golden circle

### Step 3.3: Create services/email_service.py

```python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from config import Config
from flask import render_template

class EmailService:
    @staticmethod
    def send_magic_link(to_email, magic_link_url, patent_title=None):
        """Send magic link email"""
        try:
            # Render email HTML
            html_content = render_template(
                'email/magic_link.html',
                magic_link_url=magic_link_url,
                patent_title=patent_title
            )

            message = Mail(
                from_email=Config.SENDGRID_FROM_EMAIL,
                to_emails=to_email,
                subject='Access Your IP Scaffold Analysis',
                html_content=html_content
            )

            sg = SendGridAPIClient(Config.SENDGRID_API_KEY)
            response = sg.send(message)

            return response.status_code == 202

        except Exception as e:
            print(f"Error sending email: {e}")
            return False
```

### Step 3.4: Create services/document_generator.py

See CODE_EXAMPLES.md for complete implementation.

Key methods:
- `generate_pdf(patent, artifacts)` → returns PDF binary data
- `generate_docx(patent, artifacts)` → returns DOCX binary data
- `generate_txt(patent, artifacts)` → returns TXT string

### Step 3.5: Create services/credit_manager.py

```python
from models.database import db
from models.user import User
from models.credit_transaction import CreditTransaction

class CreditManager:
    COST_PER_PATENT = 10

    @staticmethod
    def has_sufficient_credits(user_id):
        """Check if user has enough credits to process a patent"""
        user = User.query.get(user_id)
        return user and user.credits >= CreditManager.COST_PER_PATENT

    @staticmethod
    def deduct_credits_for_patent(user_id, patent_id, patent_title):
        """Deduct credits for patent processing"""
        user = User.query.get(user_id)

        if user.credits < CreditManager.COST_PER_PATENT:
            raise ValueError(f"Insufficient credits. Need {CreditManager.COST_PER_PATENT}, have {user.credits}")

        CreditTransaction.create_transaction(
            user_id=user_id,
            amount=-CreditManager.COST_PER_PATENT,
            transaction_type='ip_processing',
            description=f'Processed patent: {patent_title}',
            patent_id=patent_id
        )

    @staticmethod
    def refund_credits_for_failed_patent(user_id, patent_id, patent_title):
        """Refund credits if processing failed"""
        CreditTransaction.create_transaction(
            user_id=user_id,
            amount=CreditManager.COST_PER_PATENT,
            transaction_type='refund',
            description=f'Refund for failed processing: {patent_title}',
            patent_id=patent_id
        )
```

---

## Phase 4: Routes Implementation

See CODE_EXAMPLES.md for complete route implementations.

Key files:
- `routes/public.py` - Landing, upload, preview, request-access
- `routes/auth.py` - Magic link verification, logout
- `routes/dashboard.py` - Dashboard, patent detail, downloads

---

## Phase 5: Frontend Templates

### Step 5.1: Create templates/base.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}IP Scaffold{% endblock %}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
</head>
<body class="bg-gray-50">
    <nav class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center">
                    <a href="/" class="text-2xl font-bold text-blue-600">IP Scaffold</a>
                </div>
                <div class="flex items-center space-x-4">
                    {% if current_user.is_authenticated %}
                        <span class="text-gray-700">Credits: {{ current_user.credits }}</span>
                        <a href="/dashboard" class="text-gray-700 hover:text-blue-600">Dashboard</a>
                        <a href="/logout" class="text-gray-700 hover:text-blue-600">Logout</a>
                    {% endif %}
                </div>
            </div>
        </div>
    </nav>

    <main>
        {% with messages = get_flashed_messages(with_categories=true) %}
            {% if messages %}
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                    {% for category, message in messages %}
                        <div class="bg-{{ 'red' if category == 'error' else 'green' }}-100 border border-{{ 'red' if category == 'error' else 'green' }}-400 text-{{ 'red' if category == 'error' else 'green' }}-700 px-4 py-3 rounded">
                            {{ message }}
                        </div>
                    {% endfor %}
                </div>
            {% endif %}
        {% endwith %}

        {% block content %}{% endblock %}
    </main>

    <footer class="bg-white border-t mt-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <p class="text-center text-gray-500">&copy; 2026 IP Scaffold. All rights reserved.</p>
        </div>
    </footer>

    <script src="{{ url_for('static', filename='js/main.js') }}"></script>
</body>
</html>
```

See CODE_EXAMPLES.md for remaining templates:
- landing.html
- preview.html
- dashboard.html
- patent_detail.html
- email_sent.html
- email/magic_link.html

---

## Phase 6: Main Application

### Step 6.1: Create app.py

```python
from flask import Flask, render_template
from flask_login import LoginManager
from config import Config
from models import db, init_db, User
import os

# Create Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Initialize database
init_db(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = '/'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Create upload folder
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Import and register blueprints
from routes.public import public_bp
from routes.auth import auth_bp
from routes.dashboard import dashboard_bp

app.register_blueprint(public_bp)
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(dashboard_bp)

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return render_template('errors/404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('errors/500.html'), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=Config.DEBUG)
```

---

## Phase 7: Testing & Deployment

### Step 7.1: Test with Sample Patent

1. Upload sample patent PDF
2. Verify ELIA15 generation
3. Submit email
4. Check email received
5. Click magic link
6. Verify dashboard shows patent
7. View patent details
8. Download PDF/DOCX/TXT
9. Upload another patent (check credit deduction)

### Step 7.2: Deploy to Replit

1. Click "Run" in Replit
2. Configure custom domain (optional)
3. Set environment variables in Replit Secrets
4. Test production URL

---

## Checklist

- [ ] Phase 1: Project setup complete
- [ ] Phase 2: Database models created
- [ ] Phase 3: Services implemented
- [ ] Phase 4: Routes implemented
- [ ] Phase 5: Templates created
- [ ] Phase 6: Main app configured
- [ ] Phase 7: Tested and deployed

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
