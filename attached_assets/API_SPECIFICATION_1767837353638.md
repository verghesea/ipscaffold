# IP Scaffold - API Specification

## Overview

This document defines all HTTP endpoints, request/response formats, and authentication requirements for IP Scaffold.

**Base URL (Development):** `http://localhost:5000`
**Base URL (Production):** `https://your-app.repl.co`

---

## Authentication

### Session-Based Authentication

IP Scaffold uses session-based authentication with Flask-Login.

**Authentication Flow:**
1. User requests magic link (provides email)
2. System sends email with token
3. User clicks link with token
4. Token verified → session created
5. Subsequent requests use session cookie

**Session Cookie:**
- Name: `session`
- HttpOnly: `true`
- Secure: `true` (HTTPS only)
- SameSite: `Lax`
- Expires: 30 days

**Protected Routes:**
Routes marked as **[Auth Required]** need active session. If not authenticated:
- Redirect to `/` with flash message: "Please log in to continue"

---

## Public Endpoints

### 1. GET /

**Description:** Landing page with upload form

**Auth Required:** No

**Response:** HTML page

**Template:** `templates/landing.html`

**Page Elements:**
- Hero section with value proposition
- File upload form (drag-and-drop)
- How it works section (3 steps)
- Example artifacts preview

---

### 2. POST /upload

**Description:** Upload patent PDF and initiate processing

**Auth Required:** No (for first upload)
- If authenticated: Yes (for additional uploads)

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  ```
  pdf_file: <file> (PDF, max 10MB)
  ```

**Validation:**
- File must be present
- File extension must be `.pdf`
- File size <= 10MB
- MIME type must be `application/pdf`

**Process:**
1. Save uploaded file to `/uploads/{uuid}.pdf`
2. Parse PDF (extract title, inventors, assignee, dates, full_text)
3. Create patent record in database (status='processing')
4. If authenticated: Check credits >= 10, deduct credits
5. Generate ELIA15 artifact
6. Update patent status to 'elia15_complete'
7. Redirect to `/preview/{patent_id}`

**Success Response:**
- Status: `302 Redirect`
- Location: `/preview/{patent_id}`

**Error Responses:**

| Status | Error | Message |
|--------|-------|---------|
| 400 | No file uploaded | "Please upload a PDF file" |
| 400 | Invalid file type | "Only PDF files are accepted" |
| 400 | File too large | "File must be less than 10MB" |
| 400 | Insufficient credits | "You need 10 credits to process a patent. You have X remaining." |
| 500 | Processing error | "Error processing PDF. Please try again." |

**Implementation Notes:**
- Use secure filename: `werkzeug.utils.secure_filename()`
- Generate unique filename: `{uuid4()}.pdf`
- Delete uploaded PDF after processing (optional: keep for debugging)
- If PDF parsing fails, save error in patent.error_message and set status='failed'

---

### 3. GET /preview/:patent_id

**Description:** Display ELIA15 artifact and email gate

**Auth Required:** No

**URL Parameters:**
- `patent_id` (integer): Patent ID

**Response:** HTML page

**Template:** `templates/preview.html`

**Page Elements:**
- Patent title and metadata (if parsed)
- ELIA15 artifact (full content, nicely formatted)
- Email input form:
  - Email field
  - "Get Full Access" button
  - Text: "Enter your email to unlock Business Narrative and Golden Circle"

**Data Passed to Template:**
```python
{
    'patent': {
        'id': 123,
        'title': 'Method for Quantum Computing',
        'assignee': 'MIT',
        'status': 'elia15_complete'
    },
    'elia15_content': '# Introduction\n\n...',
    'show_email_gate': True  # False if already authenticated
}
```

**Error Responses:**

| Status | Error | Message |
|--------|-------|---------|
| 404 | Patent not found | "Patent not found" |
| 400 | Still processing | "Your patent is still being processed. Please refresh in a moment." |

---

### 4. POST /request-access

**Description:** Submit email, create account, send magic link

**Auth Required:** No

**Request:**
- Content-Type: `application/x-www-form-urlencoded`
- Body:
  ```
  email: user@example.com
  patent_id: 123
  ```

**Validation:**
- Email must be valid format
- Patent must exist and belong to user (or be unclaimed if first upload)

**Process:**
1. Normalize email (lowercase, trim whitespace)
2. Find or create user by email
3. If new user:
   - Create user record with 100 credits
   - Create credit transaction: type='signup_bonus', amount=100
4. If patent has no user_id, assign to this user
5. Generate magic token (32-byte secure random)
6. Save magic token (expires in 1 hour)
7. Send magic link email
8. Start background job: generate Business Narrative + Golden Circle
9. Redirect to email sent confirmation page

**Success Response:**
- Status: `302 Redirect`
- Location: `/email-sent`

**Error Responses:**

| Status | Error | Message |
|--------|-------|---------|
| 400 | Invalid email | "Please enter a valid email address" |
| 404 | Patent not found | "Patent not found" |
| 429 | Rate limit | "Too many requests. Please try again in a few minutes." |

**Rate Limiting:**
- Max 10 magic link requests per email per hour
- Max 5 magic link requests per IP per hour

---

### 5. GET /email-sent

**Description:** Confirmation page after requesting magic link

**Auth Required:** No

**Response:** HTML page

**Template:** `templates/email_sent.html`

**Page Elements:**
- "Check your email!" heading
- Message: "We sent a magic link to your email. Click the link to access your dashboard."
- "Didn't receive it? Check your spam folder."
- Resend link (optional)

---

## Authentication Endpoints

### 6. GET /auth/verify/:token

**Description:** Verify magic link token and log in user

**Auth Required:** No

**URL Parameters:**
- `token` (string): Magic link token

**Query Parameters (optional):**
- `redirect` (string): URL to redirect to after login (default: `/dashboard`)

**Process:**
1. Find magic token record by token
2. Validate token:
   - Exists
   - Not expired (expires_at > now)
   - Not already used (used_at is NULL)
3. Mark token as used (set used_at = now)
4. Log in user (create session)
5. Update user.last_login
6. Redirect to dashboard (or specified redirect URL)

**Success Response:**
- Status: `302 Redirect`
- Location: `/dashboard` (or query param `redirect`)
- Set session cookie

**Error Responses:**

| Status | Error | Message |
|--------|-------|---------|
| 400 | Invalid token | "Invalid or expired magic link. Please request a new one." |
| 400 | Token expired | "This magic link has expired. Please request a new one." |
| 400 | Token used | "This magic link has already been used. Please request a new one." |

**Implementation:**
```python
@app.route('/auth/verify/<token>')
def verify_magic_link(token):
    magic_token = MagicToken.query.filter_by(token=token).first()

    if not magic_token:
        flash('Invalid magic link', 'error')
        return redirect('/')

    if magic_token.expires_at < datetime.now():
        flash('Magic link expired', 'error')
        return redirect('/')

    if magic_token.used_at is not None:
        flash('Magic link already used', 'error')
        return redirect('/')

    # Mark as used
    magic_token.used_at = datetime.now()
    db.session.commit()

    # Log in user
    user = magic_token.user
    login_user(user)
    user.last_login = datetime.now()
    db.session.commit()

    return redirect('/dashboard')
```

---

### 7. GET /logout

**Description:** Log out current user

**Auth Required:** Yes

**Process:**
1. Clear session
2. Redirect to landing page

**Response:**
- Status: `302 Redirect`
- Location: `/`
- Flash message: "You've been logged out"

---

## Protected Endpoints (Authenticated)

### 8. GET /dashboard

**Description:** User's patent dashboard

**Auth Required:** Yes

**Response:** HTML page

**Template:** `templates/dashboard.html`

**Data Passed to Template:**
```python
{
    'user': {
        'email': 'user@example.com',
        'credits': 90
    },
    'patents': [
        {
            'id': 123,
            'title': 'Method for Quantum Computing',
            'assignee': 'MIT',
            'created_at': '2026-01-07',
            'status': 'completed',
            'artifact_count': 3
        },
        // ... more patents
    ]
}
```

**Page Elements:**
- Header with user email and credit balance
- "Upload New Patent" button
- Table of patents:
  - Columns: Title | Assignee | Date Uploaded | Status | Actions
  - Actions: "View Details" link, "Delete" button
- Empty state if no patents
- Logout link

**Query:**
```sql
SELECT id, title, assignee, created_at, status,
       (SELECT COUNT(*) FROM artifacts WHERE patent_id = patents.id) as artifact_count
FROM patents
WHERE user_id = {current_user.id}
ORDER BY created_at DESC;
```

---

### 9. GET /patent/:id

**Description:** View patent details and all artifacts

**Auth Required:** Yes

**URL Parameters:**
- `id` (integer): Patent ID

**Authorization:**
- Patent must belong to current user (`patent.user_id == current_user.id`)
- If not: Return 403 Forbidden

**Response:** HTML page

**Template:** `templates/patent_detail.html`

**Data Passed to Template:**
```python
{
    'patent': {
        'id': 123,
        'title': 'Method for Quantum Computing',
        'inventors': 'Jane Doe, John Smith',
        'assignee': 'MIT',
        'filing_date': '2022-01-15',
        'issue_date': '2024-03-20',
        'status': 'completed'
    },
    'artifacts': {
        'elia15': '# Introduction\n\n...',
        'business_narrative': '## Problem\n\n...',
        'golden_circle': '## WHY\n\n...'
    }
}
```

**Page Elements:**
- Patent metadata section (title, inventors, dates)
- Tab interface for artifacts:
  - Tab 1: ELIA15
  - Tab 2: Business Narrative
  - Tab 3: Golden Circle
- Download buttons:
  - "Download as PDF"
  - "Download as DOCX"
  - "Download as TXT"
- Back to Dashboard link
- Upload Another Patent button

**Query:**
```sql
SELECT p.*,
       a1.content as elia15,
       a2.content as business_narrative,
       a3.content as golden_circle
FROM patents p
LEFT JOIN artifacts a1 ON p.id = a1.patent_id AND a1.artifact_type = 'elia15'
LEFT JOIN artifacts a2 ON p.id = a2.patent_id AND a2.artifact_type = 'business_narrative'
LEFT JOIN artifacts a3 ON p.id = a3.patent_id AND a3.artifact_type = 'golden_circle'
WHERE p.id = {id} AND p.user_id = {current_user.id};
```

**Error Responses:**

| Status | Error | Message |
|--------|-------|---------|
| 404 | Patent not found | "Patent not found" |
| 403 | Unauthorized | "You don't have permission to view this patent" |
| 400 | Still processing | "Artifacts are still being generated. Please check back in a moment." |

---

### 10. GET /patent/:id/download

**Description:** Download artifacts in specified format

**Auth Required:** Yes

**URL Parameters:**
- `id` (integer): Patent ID

**Query Parameters:**
- `format` (string): `pdf` | `docx` | `txt` (required)

**Authorization:**
- Patent must belong to current user

**Process:**
1. Fetch patent and all artifacts
2. Generate document in requested format
3. Return file as download

**Success Response:**
- Status: `200 OK`
- Content-Type:
  - PDF: `application/pdf`
  - DOCX: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - TXT: `text/plain`
- Content-Disposition: `attachment; filename="{patent_title}_artifacts.{format}"`
- Body: File binary data

**Document Structure (all formats):**

```
{Patent Title}
Inventors: {inventors}
Assignee: {assignee}
Filing Date: {filing_date}
Issue Date: {issue_date}

---

ELIA15: EXPLAIN LIKE I'M 15

{elia15 content}

---

BUSINESS NARRATIVE

{business_narrative content}

---

GOLDEN CIRCLE

{golden_circle content}

---

Generated by IP Scaffold
{current_date}
```

**PDF Formatting:**
- Header: Patent title (large, bold)
- Section headers: 18pt, bold
- Body text: 11pt, readable font
- Page numbers in footer
- Proper margins (1 inch all sides)

**DOCX Formatting:**
- Title: Heading 1
- Section headers: Heading 2
- Body: Normal style
- Preserve markdown formatting where possible

**TXT Formatting:**
- Plain text
- Section separators: `---`
- 80-character line width (optional)

**Error Responses:**

| Status | Error | Message |
|--------|-------|---------|
| 404 | Patent not found | "Patent not found" |
| 403 | Unauthorized | "You don't have permission to download this patent" |
| 400 | Invalid format | "Invalid format. Choose pdf, docx, or txt" |
| 400 | Incomplete artifacts | "Artifacts are still being generated. Please try again in a moment." |

**Implementation Example:**
```python
@app.route('/patent/<int:id>/download')
@login_required
def download_patent(id):
    format = request.args.get('format', 'pdf')

    patent = Patent.query.filter_by(id=id, user_id=current_user.id).first()
    if not patent:
        abort(404)

    artifacts = {a.artifact_type: a.content for a in patent.artifacts}
    if len(artifacts) < 3:
        flash('Artifacts still processing', 'warning')
        return redirect(f'/patent/{id}')

    if format == 'pdf':
        pdf_data = generate_pdf(patent, artifacts)
        return send_file(
            io.BytesIO(pdf_data),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'{patent.title}_artifacts.pdf'
        )
    elif format == 'docx':
        # Similar for DOCX
        pass
    elif format == 'txt':
        # Similar for TXT
        pass
    else:
        abort(400, "Invalid format")
```

---

### 11. DELETE /patent/:id

**Description:** Delete a patent and all its artifacts

**Auth Required:** Yes

**URL Parameters:**
- `id` (integer): Patent ID

**Authorization:**
- Patent must belong to current user

**Process:**
1. Verify ownership
2. Delete patent (cascades to artifacts via foreign key)
3. Optionally: Refund 10 credits (business decision)
4. Redirect to dashboard

**Success Response:**
- Status: `302 Redirect`
- Location: `/dashboard`
- Flash message: "Patent deleted successfully"

**Error Responses:**

| Status | Error | Message |
|--------|-------|---------|
| 404 | Patent not found | "Patent not found" |
| 403 | Unauthorized | "You don't have permission to delete this patent" |

---

## Utility Endpoints

### 12. GET /credits

**Description:** View credit balance and transaction history

**Auth Required:** Yes

**Response:** HTML page

**Template:** `templates/credits.html`

**Data Passed to Template:**
```python
{
    'user': {
        'email': 'user@example.com',
        'credits': 90
    },
    'transactions': [
        {
            'id': 1,
            'amount': -10,
            'balance_after': 90,
            'transaction_type': 'ip_processing',
            'description': 'Processed patent: Quantum Computing Method',
            'created_at': '2026-01-07 10:30:00'
        },
        {
            'id': 2,
            'amount': 100,
            'balance_after': 100,
            'transaction_type': 'signup_bonus',
            'description': 'Welcome bonus',
            'created_at': '2026-01-06 15:22:00'
        }
    ]
}
```

**Page Elements:**
- Current credit balance (large, prominent)
- "Purchase Credits" button (Phase 2)
- Transaction history table:
  - Columns: Date | Description | Amount | Balance
  - Sort: Newest first

---

### 13. GET /health

**Description:** Health check endpoint (for monitoring)

**Auth Required:** No

**Response:**
```json
{
    "status": "ok",
    "timestamp": "2026-01-07T10:30:00Z",
    "database": "connected",
    "ai_service": "available"
}
```

**Status Codes:**
- 200: All systems operational
- 503: Service degraded or unavailable

---

## Error Handling

### Standard Error Response (JSON endpoints)

```json
{
    "error": true,
    "message": "Error description",
    "code": "ERROR_CODE"
}
```

### Standard Error Pages (HTML endpoints)

**404 Not Found:**
- Template: `templates/errors/404.html`
- Message: "Page not found"
- Link back to dashboard or landing page

**500 Internal Server Error:**
- Template: `templates/errors/500.html`
- Message: "Something went wrong. Please try again."
- Log error details to server logs

**403 Forbidden:**
- Template: `templates/errors/403.html`
- Message: "You don't have permission to access this resource"

---

## Rate Limiting

**Endpoints to Rate Limit:**

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /upload | 5 requests | Per hour per IP |
| POST /request-access | 10 requests | Per hour per email |
| POST /request-access | 5 requests | Per hour per IP |

**Implementation:**
Use Flask-Limiter or similar middleware.

**Rate Limit Response:**
- Status: `429 Too Many Requests`
- Body: "Too many requests. Please try again later."
- Header: `Retry-After: 3600` (seconds)

---

## CORS Policy

**For MVP:**
- No CORS needed (all requests from same origin)

**For API Access (Future):**
- Allow specific origins
- Require API key authentication

---

## Webhook Endpoints (Future)

### POST /webhooks/stripe

**Description:** Handle Stripe payment webhooks for credit purchases

**Auth Required:** No (validated via Stripe signature)

**Process:**
1. Verify Stripe signature
2. Handle events:
   - `payment_intent.succeeded`: Add credits to user account
   - `payment_intent.failed`: Log failure
3. Return 200 OK

---

## API Versioning (Future)

When creating public API:
- Version in URL: `/api/v1/`
- Current endpoints remain unversioned (web app only)

---

## Testing Endpoints

### Development Only

**GET /dev/test-email**
- Send test magic link email to specified address
- Only available when `FLASK_ENV=development`

**GET /dev/seed-data**
- Populate database with sample patents
- Only available when `FLASK_ENV=development`

**GET /dev/clear-db**
- Clear all data from database
- Only available when `FLASK_ENV=development`

---

## Complete Route List

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Landing page |
| POST | `/upload` | Optional | Upload patent PDF |
| GET | `/preview/:patent_id` | No | Preview ELIA15 |
| POST | `/request-access` | No | Request magic link |
| GET | `/email-sent` | No | Confirmation page |
| GET | `/auth/verify/:token` | No | Verify magic link |
| GET | `/logout` | Yes | Logout |
| GET | `/dashboard` | Yes | User dashboard |
| GET | `/patent/:id` | Yes | Patent details |
| GET | `/patent/:id/download` | Yes | Download artifacts |
| DELETE | `/patent/:id` | Yes | Delete patent |
| GET | `/credits` | Yes | Credit history |
| GET | `/health` | No | Health check |

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
