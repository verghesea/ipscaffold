# IP Scaffold - Database Schema

## Overview

IP Scaffold uses PostgreSQL as the primary database. This document defines all tables, relationships, indexes, and constraints.

---

## Entity Relationship Diagram

```
users (1) ──── (many) patents
users (1) ──── (many) magic_tokens
users (1) ──── (many) credit_transactions
patents (1) ──── (many) artifacts
```

---

## Table Definitions

### 1. users

Stores user account information and credit balance.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    credits INTEGER DEFAULT 100 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

**Columns:**
- `id`: Primary key, auto-increment
- `email`: User's email address (unique, used for login)
- `created_at`: Account creation timestamp
- `last_login`: Last successful login timestamp
- `credits`: Current credit balance (starts at 100)
- `is_active`: Account status (for future admin functionality)

**Business Rules:**
- Email must be unique
- Credits cannot go negative (enforced in application logic)
- New users receive 100 free credits
- Email is case-insensitive (normalize to lowercase in app)

---

### 2. magic_tokens

Stores magic link authentication tokens.

```sql
CREATE TABLE magic_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    patent_id INTEGER REFERENCES patents(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_magic_tokens_token ON magic_tokens(token);
CREATE INDEX idx_magic_tokens_user_id ON magic_tokens(user_id);
CREATE INDEX idx_magic_tokens_expires_at ON magic_tokens(expires_at);
```

**Columns:**
- `id`: Primary key
- `user_id`: Foreign key to users table
- `token`: Secure random token (URL-safe, 32-64 characters)
- `created_at`: When token was generated
- `expires_at`: When token expires (1 hour from creation)
- `used_at`: When token was used (NULL if unused)
- `patent_id`: Optional reference to patent that triggered this login

**Business Rules:**
- Tokens expire after 1 hour
- Tokens are single-use only (used_at must be NULL to be valid)
- Token must be cryptographically secure (use secrets.token_urlsafe(32) in Python)
- Old tokens should be cleaned up periodically

**Validation Logic:**
```python
def is_token_valid(token_record):
    now = datetime.now()
    return (
        token_record.used_at is None and
        token_record.expires_at > now
    )
```

---

### 3. patents

Stores uploaded patent documents and metadata.

```sql
CREATE TABLE patents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    inventors TEXT,
    assignee TEXT,
    filing_date DATE,
    issue_date DATE,
    full_text TEXT NOT NULL,
    pdf_filename VARCHAR(255),
    status VARCHAR(50) DEFAULT 'processing' NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_patents_user_id ON patents(user_id);
CREATE INDEX idx_patents_status ON patents(status);
CREATE INDEX idx_patents_created_at ON patents(created_at DESC);

-- Composite index for user's patents ordered by date
CREATE INDEX idx_patents_user_created ON patents(user_id, created_at DESC);
```

**Columns:**
- `id`: Primary key
- `user_id`: Foreign key to users table (owner of patent)
- `title`: Patent title (extracted from PDF)
- `inventors`: Inventor names (extracted from PDF, stored as comma-separated or JSON)
- `assignee`: Institution/company that owns the patent
- `filing_date`: Date patent was filed
- `issue_date`: Date patent was issued
- `full_text`: Complete text content of patent
- `pdf_filename`: Original filename of uploaded PDF
- `status`: Processing status (see below)
- `error_message`: Error details if status is 'failed'
- `created_at`: When patent was uploaded
- `updated_at`: Last modification timestamp

**Status Values:**
- `processing`: PDF uploaded, parsing in progress
- `elia15_complete`: ELIA15 generated, other artifacts pending
- `completed`: All 3 artifacts generated successfully
- `failed`: Error occurred during processing

**Business Rules:**
- Status transitions: processing → elia15_complete → completed
- If error: any status → failed
- updated_at should be automatically updated on any change (use trigger or ORM hook)
- full_text is required (cannot be NULL)

**Storage Considerations:**
- full_text can be large (10k-50k characters typical)
- Consider using TEXT type (unlimited length in PostgreSQL)
- For very large patents, consider storing separately or compressing

---

### 4. artifacts

Stores AI-generated content artifacts.

```sql
CREATE TABLE artifacts (
    id SERIAL PRIMARY KEY,
    patent_id INTEGER NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tokens_used INTEGER,
    generation_time_seconds DECIMAL(10, 2)
);

-- Indexes
CREATE INDEX idx_artifacts_patent_id ON artifacts(patent_id);
CREATE INDEX idx_artifacts_type ON artifacts(artifact_type);

-- Composite index for patent's artifacts
CREATE INDEX idx_artifacts_patent_type ON artifacts(patent_id, artifact_type);

-- Unique constraint: one artifact of each type per patent
CREATE UNIQUE INDEX idx_artifacts_patent_type_unique ON artifacts(patent_id, artifact_type);
```

**Columns:**
- `id`: Primary key
- `patent_id`: Foreign key to patents table
- `artifact_type`: Type of artifact (see below)
- `content`: Generated text content (markdown formatted)
- `created_at`: When artifact was generated
- `tokens_used`: AI tokens consumed (for cost tracking)
- `generation_time_seconds`: How long generation took

**Artifact Types:**
- `elia15`: Explain Like I'm 15
- `business_narrative`: Business pitch narrative
- `golden_circle`: Golden Circle framework (WHY/HOW/WHAT)

**Business Rules:**
- Each patent can have exactly one artifact of each type
- Unique constraint enforced: (patent_id, artifact_type)
- Content stored as markdown for easy rendering
- If regenerating an artifact, update existing record (don't create duplicate)

**Query Examples:**
```sql
-- Get all artifacts for a patent
SELECT * FROM artifacts
WHERE patent_id = 123
ORDER BY artifact_type;

-- Get specific artifact
SELECT content FROM artifacts
WHERE patent_id = 123 AND artifact_type = 'elia15';

-- Check if all artifacts are complete
SELECT COUNT(*) FROM artifacts
WHERE patent_id = 123;
-- Should return 3 if all complete
```

---

### 5. credit_transactions

Tracks all credit additions and deductions.

```sql
CREATE TABLE credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    description TEXT,
    patent_id INTEGER REFERENCES patents(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_created ON credit_transactions(created_at DESC);
```

**Columns:**
- `id`: Primary key
- `user_id`: Foreign key to users table
- `amount`: Credit change (negative for usage, positive for additions)
- `balance_after`: User's credit balance after this transaction
- `transaction_type`: Type of transaction (see below)
- `description`: Human-readable description
- `patent_id`: Optional reference to patent (for ip_processing type)
- `created_at`: Transaction timestamp

**Transaction Types:**
- `signup_bonus`: Initial 100 credits for new user (+100)
- `ip_processing`: Credits used to process patent (-10)
- `purchase`: User purchased credits (+amount)
- `refund`: Credits refunded due to error (+10)
- `admin_adjustment`: Manual adjustment by admin (+/- amount)

**Business Rules:**
- Amount can be positive or negative
- balance_after must match users.credits after transaction
- Transactions are immutable (insert-only, never update/delete)
- Acts as audit log for all credit changes

**Transaction Flow:**
```python
# Example: Deduct credits for patent processing
def deduct_credits_for_patent(user_id, patent_id):
    user = get_user(user_id)
    if user.credits < 10:
        raise InsufficientCreditsError()

    # Deduct credits
    new_balance = user.credits - 10
    update_user_credits(user_id, new_balance)

    # Log transaction
    create_transaction(
        user_id=user_id,
        amount=-10,
        balance_after=new_balance,
        transaction_type='ip_processing',
        description=f'Processed patent: {patent_title}',
        patent_id=patent_id
    )
```

---

## Database Initialization

### Setup Script

```sql
-- Create database (run as postgres superuser)
CREATE DATABASE ipscaffold;

-- Connect to database
\c ipscaffold;

-- Create tables in order (respecting foreign key dependencies)
-- 1. Users (no dependencies)
CREATE TABLE users (...);

-- 2. Tables that depend on users
CREATE TABLE magic_tokens (...);
CREATE TABLE patents (...);
CREATE TABLE credit_transactions (...);

-- 3. Tables that depend on patents
CREATE TABLE artifacts (...);

-- Create all indexes
CREATE INDEX ...;

-- Create triggers (optional)
CREATE TRIGGER update_patents_updated_at
    BEFORE UPDATE ON patents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Cleanup Job (Optional)

```sql
-- Delete expired magic tokens (run daily)
DELETE FROM magic_tokens
WHERE expires_at < NOW() - INTERVAL '24 hours';

-- Delete old unused tokens (run weekly)
DELETE FROM magic_tokens
WHERE used_at IS NULL
  AND expires_at < NOW() - INTERVAL '7 days';
```

---

## Sample Data (for Development/Testing)

```sql
-- Insert test user
INSERT INTO users (email, credits, created_at)
VALUES ('test@example.com', 100, NOW());

-- Insert test patent
INSERT INTO patents (
    user_id,
    title,
    inventors,
    assignee,
    filing_date,
    issue_date,
    full_text,
    pdf_filename,
    status
) VALUES (
    1,
    'Method and System for Quantum Computing',
    'Jane Doe, John Smith',
    'MIT',
    '2022-01-15',
    '2024-03-20',
    'Abstract: This invention relates to quantum computing...',
    'patent_12345.pdf',
    'completed'
);

-- Insert test artifacts
INSERT INTO artifacts (patent_id, artifact_type, content)
VALUES
    (1, 'elia15', 'Imagine if computers could solve problems...'),
    (1, 'business_narrative', '## Problem\n\nCurrent computing limits...'),
    (1, 'golden_circle', '## WHY\n\nWe believe quantum computing...');

-- Insert test credit transaction
INSERT INTO credit_transactions (
    user_id,
    amount,
    balance_after,
    transaction_type,
    description
)
VALUES (1, 100, 100, 'signup_bonus', 'Welcome bonus');
```

---

## Migrations Strategy

**For Replit/MVP:**
- Use simple SQL scripts in a `/migrations` folder
- Name files with timestamps: `001_initial_schema.sql`, `002_add_column.sql`
- Apply manually or use simple Python script

**For Production (Future):**
- Use Alembic (Python migration tool)
- Track migrations in version control
- Auto-generate migrations from SQLAlchemy models

---

## Backup & Recovery

**Replit Automatic Backups:**
- Replit automatically backs up PostgreSQL databases
- Restore from Replit dashboard if needed

**Manual Backup:**
```bash
# Backup database
pg_dump ipscaffold > backup.sql

# Restore database
psql ipscaffold < backup.sql
```

**Backup Strategy (Production):**
- Daily automated backups
- Keep backups for 30 days
- Test restore process monthly

---

## Performance Optimization

**Current Indexes:**
All critical queries are indexed (see CREATE INDEX statements above)

**Query Optimization Tips:**

1. **Dashboard query** (list user's patents):
```sql
-- Optimized with idx_patents_user_created
SELECT id, title, assignee, created_at, status
FROM patents
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT 20;
```

2. **Patent detail query** (get patent + artifacts):
```sql
-- Optimized with idx_artifacts_patent_id
SELECT p.*,
       array_agg(json_build_object(
           'type', a.artifact_type,
           'content', a.content
       )) as artifacts
FROM patents p
LEFT JOIN artifacts a ON p.id = a.patent_id
WHERE p.id = ?
GROUP BY p.id;
```

3. **Credit balance check**:
```sql
-- Indexed on primary key
SELECT credits FROM users WHERE id = ?;
```

**Future Optimizations (if needed):**
- Full-text search on patent titles: `CREATE INDEX idx_patents_title_fts ON patents USING gin(to_tsvector('english', title));`
- Partitioning for large tables (>1M rows)
- Read replicas for heavy read loads

---

## Data Retention Policy

**Current (MVP):**
- Keep all data indefinitely
- Users can delete their own patents

**Future:**
- Delete unused accounts after 1 year of inactivity
- Archive old patents (>2 years, not accessed)
- GDPR compliance: user data deletion on request

---

## Security Considerations

**SQL Injection Prevention:**
- Always use parameterized queries (SQLAlchemy ORM does this automatically)
- Never concatenate user input into SQL strings

**Sensitive Data:**
- Email addresses: Consider encrypting at rest (future)
- Patent content: Contains proprietary information, treat as confidential
- Magic tokens: Store hashed (future enhancement)

**Access Control:**
- Users can only access their own patents
- Enforce user_id checks in all queries
- Example: `SELECT * FROM patents WHERE id = ? AND user_id = ?`

---

## Monitoring & Logging

**Track These Metrics:**
- Total users created per day
- Total patents processed per day
- Average processing time per patent
- Credit usage patterns
- Failed patent processing (errors)

**Queries for Metrics:**

```sql
-- Daily user signups
SELECT DATE(created_at) as date, COUNT(*) as new_users
FROM users
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Daily patent processing
SELECT DATE(created_at) as date, COUNT(*) as patents_processed
FROM patents
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Processing success rate
SELECT
    status,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM patents
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status;

-- Average generation time by artifact type
SELECT
    artifact_type,
    AVG(generation_time_seconds) as avg_time,
    AVG(tokens_used) as avg_tokens
FROM artifacts
GROUP BY artifact_type;
```

---

## SQLAlchemy Models (Python)

For implementation, use these SQLAlchemy model definitions:

```python
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Numeric
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    credits = Column(Integer, default=100, nullable=False)
    is_active = Column(Boolean, default=True)

    # Relationships
    patents = relationship('Patent', back_populates='user', cascade='all, delete-orphan')
    magic_tokens = relationship('MagicToken', back_populates='user', cascade='all, delete-orphan')
    credit_transactions = relationship('CreditTransaction', back_populates='user')

class MagicToken(Base):
    __tablename__ = 'magic_tokens'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    token = Column(String(64), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime)
    patent_id = Column(Integer, ForeignKey('patents.id'))

    # Relationships
    user = relationship('User', back_populates='magic_tokens')
    patent = relationship('Patent')

class Patent(Base):
    __tablename__ = 'patents'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    title = Column(Text)
    inventors = Column(Text)
    assignee = Column(Text)
    filing_date = Column(DateTime)
    issue_date = Column(DateTime)
    full_text = Column(Text, nullable=False)
    pdf_filename = Column(String(255))
    status = Column(String(50), default='processing', nullable=False)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship('User', back_populates='patents')
    artifacts = relationship('Artifact', back_populates='patent', cascade='all, delete-orphan')

class Artifact(Base):
    __tablename__ = 'artifacts'

    id = Column(Integer, primary_key=True)
    patent_id = Column(Integer, ForeignKey('patents.id'), nullable=False)
    artifact_type = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    tokens_used = Column(Integer)
    generation_time_seconds = Column(Numeric(10, 2))

    # Relationships
    patent = relationship('Patent', back_populates='artifacts')

class CreditTransaction(Base):
    __tablename__ = 'credit_transactions'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    transaction_type = Column(String(50), nullable=False)
    description = Column(Text)
    patent_id = Column(Integer, ForeignKey('patents.id'))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship('User', back_populates='credit_transactions')
    patent = relationship('Patent')
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
