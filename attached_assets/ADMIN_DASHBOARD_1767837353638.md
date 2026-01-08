# IP Scaffold - Admin Dashboard Specification

## Overview

Admin dashboard provides platform oversight including user management, usage analytics, and IP monitoring.

**Access:** Separate admin login at `/admin`

**Key Features:**
- User list with usage statistics
- Patent/IP analytics
- Credit usage tracking
- System health monitoring
- Individual user activity drill-down

---

## Admin Authentication

### Database Schema Addition

Add `is_admin` flag to users table:

```sql
-- Add column to existing users table
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Create first admin user (run once)
UPDATE users SET is_admin = TRUE WHERE email = 'your-admin-email@example.com';
```

**Alternative: Separate Admin Table**

```sql
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_admins_email ON admins(email);
```

**Recommendation:** Use `is_admin` flag for MVP (simpler). Separate table for production (better security).

---

## Admin Routes

### Route Structure

```
/admin/                          # Admin login page
/admin/login                     # Handle login POST
/admin/logout                    # Logout
/admin/dashboard                 # Main admin dashboard
/admin/users                     # User management
/admin/users/<id>                # Individual user detail
/admin/patents                   # Patent analytics
/admin/patents/<id>              # Patent detail view
/admin/analytics                 # System analytics
```

---

## Admin Dashboard Views

### 1. Admin Login Page

**Route:** `GET /admin`

**Template:** `templates/admin/login.html`

**Features:**
- Simple email + password form
- Session-based auth
- Separate from user sessions

**Implementation:**

```python
# routes/admin.py

from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from functools import wraps

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

def admin_required(f):
    """Decorator to require admin authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return redirect(url_for('admin.login'))
        return f(*args, **kwargs)
    return decorated_function

@admin_bp.route('/')
def index():
    if session.get('admin_logged_in'):
        return redirect(url_for('admin.dashboard'))
    return redirect(url_for('admin.login'))

@admin_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        # Simple check: user exists and is_admin=True
        user = User.query.filter_by(email=email, is_admin=True).first()

        if user:  # In production, verify password hash
            session['admin_logged_in'] = True
            session['admin_email'] = email
            return redirect(url_for('admin.dashboard'))

        flash('Invalid credentials', 'error')

    return render_template('admin/login.html')

@admin_bp.route('/logout')
def logout():
    session.pop('admin_logged_in', None)
    session.pop('admin_email', None)
    return redirect(url_for('admin.login'))
```

---

### 2. Main Admin Dashboard

**Route:** `GET /admin/dashboard`

**Template:** `templates/admin/dashboard.html`

**Metrics Displayed:**

```python
@admin_bp.route('/dashboard')
@admin_required
def dashboard():
    from datetime import datetime, timedelta
    from sqlalchemy import func

    # Key metrics
    total_users = User.query.count()
    total_patents = Patent.query.count()
    patents_processed_today = Patent.query.filter(
        Patent.created_at >= datetime.utcnow().date()
    ).count()

    # Active users (logged in last 7 days)
    active_users = User.query.filter(
        User.last_login >= datetime.utcnow() - timedelta(days=7)
    ).count()

    # Credits statistics
    total_credits_used = db.session.query(
        func.sum(CreditTransaction.amount)
    ).filter(
        CreditTransaction.transaction_type == 'ip_processing'
    ).scalar() or 0

    # Revenue estimate (absolute value of credits used)
    revenue_estimate = abs(total_credits_used) * 0.20  # $0.20 per credit

    # Recent activity
    recent_patents = Patent.query.order_by(
        Patent.created_at.desc()
    ).limit(10).all()

    recent_users = User.query.order_by(
        User.created_at.desc()
    ).limit(10).all()

    # Processing status breakdown
    status_breakdown = db.session.query(
        Patent.status,
        func.count(Patent.id)
    ).group_by(Patent.status).all()

    return render_template(
        'admin/dashboard.html',
        metrics={
            'total_users': total_users,
            'active_users': active_users,
            'total_patents': total_patents,
            'patents_today': patents_processed_today,
            'total_credits_used': abs(total_credits_used),
            'revenue_estimate': revenue_estimate
        },
        status_breakdown=status_breakdown,
        recent_patents=recent_patents,
        recent_users=recent_users
    )
```

**Dashboard Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  IP Scaffold Admin Dashboard                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📊 KEY METRICS                                         │
│  ┌──────────┬──────────┬──────────┬──────────┐        │
│  │  Users   │  Active  │ Patents  │ Today    │        │
│  │   150    │    42    │   523    │   12     │        │
│  └──────────┴──────────┴──────────┴──────────┘        │
│                                                          │
│  💰 REVENUE                                             │
│  Credits Used: 5,230  |  Est. Revenue: $1,046          │
│                                                          │
│  📈 PROCESSING STATUS                                   │
│  ┌─────────────────────────────────────┐               │
│  │ Completed: 480 (92%)                │               │
│  │ Processing: 15 (3%)                 │               │
│  │ Failed: 28 (5%)                     │               │
│  └─────────────────────────────────────┘               │
│                                                          │
│  🕐 RECENT ACTIVITY                                     │
│  [Table of recent patents]                              │
│  [Table of recent user signups]                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### 3. User Management View

**Route:** `GET /admin/users`

**Template:** `templates/admin/users.html`

**Features:**
- Searchable/filterable user list
- Sort by: signup date, last login, credits used, patents processed
- Click user to see detail view

**Implementation:**

```python
@admin_bp.route('/users')
@admin_required
def users():
    from sqlalchemy import func

    # Get query parameters
    search = request.args.get('search', '')
    sort_by = request.args.get('sort', 'created_at')
    order = request.args.get('order', 'desc')

    # Base query with aggregations
    query = db.session.query(
        User,
        func.count(Patent.id).label('patent_count'),
        func.coalesce(func.sum(
            db.case(
                (CreditTransaction.transaction_type == 'ip_processing',
                 CreditTransaction.amount),
                else_=0
            )
        ), 0).label('credits_used')
    ).outerjoin(Patent).outerjoin(CreditTransaction).group_by(User.id)

    # Apply search filter
    if search:
        query = query.filter(User.email.ilike(f'%{search}%'))

    # Apply sorting
    if sort_by == 'email':
        query = query.order_by(User.email.desc() if order == 'desc' else User.email.asc())
    elif sort_by == 'credits':
        query = query.order_by(User.credits.desc() if order == 'desc' else User.credits.asc())
    elif sort_by == 'patents':
        query = query.order_by(func.count(Patent.id).desc() if order == 'desc' else func.count(Patent.id).asc())
    else:  # created_at
        query = query.order_by(User.created_at.desc() if order == 'desc' else User.created_at.asc())

    users_data = query.all()

    return render_template(
        'admin/users.html',
        users_data=users_data,
        search=search,
        sort_by=sort_by,
        order=order
    )
```

**Table Structure:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Users (150 total)                          [Search: _________]      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Email ↓           Joined        Last Login   Credits  Patents  Actn│
│  ────────────────────────────────────────────────────────────────   │
│  jane@mit.edu      Jan 5, 2026   Today        45      12       View │
│  john@stanford.edu Jan 4, 2026   Yesterday    90      2        View │
│  sarah@caltech.edu Jan 3, 2026   3 days ago   0       10       View │
│  ...                                                                  │
│                                                                       │
│  [Pagination: 1 2 3 ... 10]                                         │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 4. Individual User Detail View

**Route:** `GET /admin/users/<id>`

**Template:** `templates/admin/user_detail.html`

**Information Displayed:**
- User profile (email, signup date, last login)
- Credit balance and transaction history
- All patents uploaded by user
- Usage statistics
- Actions: Add credits, deactivate user

**Implementation:**

```python
@admin_bp.route('/users/<int:id>')
@admin_required
def user_detail(id):
    user = User.query.get_or_404(id)

    # Get user's patents
    patents = Patent.query.filter_by(user_id=id).order_by(
        Patent.created_at.desc()
    ).all()

    # Get credit transactions
    transactions = CreditTransaction.query.filter_by(user_id=id).order_by(
        CreditTransaction.created_at.desc()
    ).limit(50).all()

    # Calculate statistics
    from sqlalchemy import func

    stats = {
        'total_patents': len(patents),
        'completed_patents': len([p for p in patents if p.status == 'completed']),
        'failed_patents': len([p for p in patents if p.status == 'failed']),
        'total_credits_used': abs(sum([
            t.amount for t in transactions
            if t.transaction_type == 'ip_processing'
        ])),
        'total_credits_purchased': sum([
            t.amount for t in transactions
            if t.transaction_type == 'purchase'
        ])
    }

    return render_template(
        'admin/user_detail.html',
        user=user,
        patents=patents,
        transactions=transactions,
        stats=stats
    )
```

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  User: jane@mit.edu                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  PROFILE                                                 │
│  Email: jane@mit.edu                                     │
│  Joined: January 5, 2026                                 │
│  Last Login: Today at 10:30 AM                           │
│  Status: Active                                          │
│  Admin: No                                               │
│                                                          │
│  CREDITS                                                 │
│  Current Balance: 45 credits                             │
│  Total Used: 120 credits (12 patents)                    │
│  Total Purchased: 65 credits                             │
│                                                          │
│  USAGE STATISTICS                                        │
│  Total Patents: 12                                       │
│  ├─ Completed: 11                                        │
│  ├─ Processing: 0                                        │
│  └─ Failed: 1                                            │
│                                                          │
│  PATENTS PROCESSED                                       │
│  ┌────────────────────────────────────────────────┐    │
│  │ Title                    Date       Status      │    │
│  ├────────────────────────────────────────────────┤    │
│  │ Quantum Computing...     Jan 5     Completed    │    │
│  │ AI Neural Networks...    Jan 3     Completed    │    │
│  │ ...                                             │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  CREDIT HISTORY                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Date       Type           Amount    Balance     │    │
│  ├────────────────────────────────────────────────┤    │
│  │ Jan 5      IP Processing  -10      45          │    │
│  │ Jan 4      Purchase       +100     55          │    │
│  │ ...                                             │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ACTIONS                                                 │
│  [Add Credits] [Deactivate User] [View All Patents]     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### 5. Patent Analytics View

**Route:** `GET /admin/patents`

**Template:** `templates/admin/patents.html`

**Features:**
- All patents processed
- Filter by: status, date range, institution
- Search by title or assignee
- Export to CSV

**Implementation:**

```python
@admin_bp.route('/patents')
@admin_required
def patents():
    # Query parameters
    status_filter = request.args.get('status', 'all')
    search = request.args.get('search', '')
    sort_by = request.args.get('sort', 'created_at')

    # Base query with user join
    query = db.session.query(Patent, User).join(User)

    # Apply filters
    if status_filter != 'all':
        query = query.filter(Patent.status == status_filter)

    if search:
        query = query.filter(
            db.or_(
                Patent.title.ilike(f'%{search}%'),
                Patent.assignee.ilike(f'%{search}%')
            )
        )

    # Sort
    if sort_by == 'title':
        query = query.order_by(Patent.title.asc())
    elif sort_by == 'assignee':
        query = query.order_by(Patent.assignee.asc())
    else:
        query = query.order_by(Patent.created_at.desc())

    patents_data = query.limit(100).all()

    # Get status counts for filter buttons
    status_counts = db.session.query(
        Patent.status,
        func.count(Patent.id)
    ).group_by(Patent.status).all()

    return render_template(
        'admin/patents.html',
        patents_data=patents_data,
        status_counts=dict(status_counts),
        status_filter=status_filter,
        search=search
    )
```

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  Patents (523 total)                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Filter: [All: 523] [Completed: 480] [Processing: 15]       │
│          [Failed: 28]                                        │
│                                                              │
│  Search: [_________________________]                         │
│                                                              │
│  Title              Assignee      User           Date   Stat│
│  ─────────────────────────────────────────────────────────  │
│  Quantum Computing  MIT           jane@mit.edu  Jan 5  ✓    │
│  AI Neural Net...   Stanford      john@sta...   Jan 5  ✓    │
│  Drug Discovery...  Pfizer        sarah@pf...   Jan 4  ⏳   │
│  ...                                                         │
│                                                              │
│  [Export to CSV]                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 6. Patent Detail View (Admin)

**Route:** `GET /admin/patents/<id>`

**Template:** `templates/admin/patent_detail.html`

**Information:**
- All patent metadata
- User who uploaded it
- All generated artifacts
- Processing times and token usage
- Actions: Regenerate artifacts, delete

**Implementation:**

```python
@admin_bp.route('/patents/<int:id>')
@admin_required
def patent_detail(id):
    patent = Patent.query.get_or_404(id)
    user = User.query.get(patent.user_id)

    # Get all artifacts with metadata
    artifacts = Artifact.query.filter_by(patent_id=id).all()

    # Calculate total processing time and tokens
    total_time = sum([a.generation_time_seconds or 0 for a in artifacts])
    total_tokens = sum([a.tokens_used or 0 for a in artifacts])

    return render_template(
        'admin/patent_detail.html',
        patent=patent,
        user=user,
        artifacts=artifacts,
        total_time=total_time,
        total_tokens=total_tokens
    )
```

---

### 7. System Analytics View

**Route:** `GET /admin/analytics`

**Template:** `templates/admin/analytics.html`

**Visualizations (using Chart.js):**

1. **Patents Processed Over Time** (Line chart)
2. **User Signups Over Time** (Line chart)
3. **Processing Status Distribution** (Pie chart)
4. **Top Institutions by Patent Count** (Bar chart)
5. **Credit Usage Over Time** (Area chart)
6. **Average Processing Time by Artifact** (Bar chart)

**Implementation:**

```python
@admin_bp.route('/analytics')
@admin_required
def analytics():
    from datetime import datetime, timedelta
    from sqlalchemy import func

    # Patents processed over last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    patents_by_day = db.session.query(
        func.date(Patent.created_at).label('date'),
        func.count(Patent.id).label('count')
    ).filter(
        Patent.created_at >= thirty_days_ago
    ).group_by(
        func.date(Patent.created_at)
    ).order_by('date').all()

    # User signups over last 30 days
    users_by_day = db.session.query(
        func.date(User.created_at).label('date'),
        func.count(User.id).label('count')
    ).filter(
        User.created_at >= thirty_days_ago
    ).group_by(
        func.date(User.created_at)
    ).order_by('date').all()

    # Top 10 institutions
    top_institutions = db.session.query(
        Patent.assignee,
        func.count(Patent.id).label('count')
    ).filter(
        Patent.assignee.isnot(None)
    ).group_by(
        Patent.assignee
    ).order_by(
        func.count(Patent.id).desc()
    ).limit(10).all()

    # Average processing time by artifact type
    avg_processing_time = db.session.query(
        Artifact.artifact_type,
        func.avg(Artifact.generation_time_seconds).label('avg_time')
    ).group_by(
        Artifact.artifact_type
    ).all()

    # Status distribution
    status_dist = db.session.query(
        Patent.status,
        func.count(Patent.id)
    ).group_by(Patent.status).all()

    return render_template(
        'admin/analytics.html',
        patents_by_day=patents_by_day,
        users_by_day=users_by_day,
        top_institutions=top_institutions,
        avg_processing_time=avg_processing_time,
        status_dist=status_dist
    )
```

---

## Analytics Visualization with Chart.js

### Include Chart.js in Base Template

```html
<!-- templates/admin/base.html -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

### Example Chart: Patents Over Time

```html
<!-- templates/admin/analytics.html -->

<div class="chart-container">
    <canvas id="patentsOverTimeChart"></canvas>
</div>

<script>
const ctx = document.getElementById('patentsOverTimeChart');

new Chart(ctx, {
    type: 'line',
    data: {
        labels: {{ patents_by_day | map(attribute='date') | list | tojson }},
        datasets: [{
            label: 'Patents Processed',
            data: {{ patents_by_day | map(attribute='count') | list | tojson }},
            borderColor: 'rgb(26, 86, 160)',
            backgroundColor: 'rgba(26, 86, 160, 0.1)',
            fill: true,
            tension: 0.3
        }]
    },
    options: {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: 'Patents Processed (Last 30 Days)'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0
                }
            }
        }
    }
});
</script>
```

### Example Chart: Top Institutions

```html
<div class="chart-container">
    <canvas id="topInstitutionsChart"></canvas>
</div>

<script>
const ctx2 = document.getElementById('topInstitutionsChart');

new Chart(ctx2, {
    type: 'bar',
    data: {
        labels: {{ top_institutions | map(attribute='assignee') | list | tojson }},
        datasets: [{
            label: 'Number of Patents',
            data: {{ top_institutions | map(attribute='count') | list | tojson }},
            backgroundColor: 'rgba(26, 86, 160, 0.7)',
            borderColor: 'rgb(26, 86, 160)',
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: 'Top 10 Institutions by Patent Count'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0
                }
            }
        }
    }
});
</script>
```

---

## Export Functionality

### CSV Export of Users

```python
@admin_bp.route('/users/export')
@admin_required
def export_users():
    import csv
    from io import StringIO

    users = User.query.all()

    # Create CSV in memory
    output = StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(['Email', 'Joined', 'Last Login', 'Credits', 'Is Admin'])

    # Data
    for user in users:
        writer.writerow([
            user.email,
            user.created_at.strftime('%Y-%m-%d'),
            user.last_login.strftime('%Y-%m-%d') if user.last_login else 'Never',
            user.credits,
            'Yes' if user.is_admin else 'No'
        ])

    # Prepare response
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={
            'Content-Disposition': 'attachment; filename=users.csv'
        }
    )
```

### CSV Export of Patents

```python
@admin_bp.route('/patents/export')
@admin_required
def export_patents():
    import csv
    from io import StringIO

    patents = Patent.query.join(User).all()

    output = StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        'Title', 'Assignee', 'User Email', 'Status',
        'Created', 'Filing Date', 'Issue Date'
    ])

    # Data
    for patent in patents:
        writer.writerow([
            patent.title,
            patent.assignee or '',
            patent.user.email if patent.user else '',
            patent.status,
            patent.created_at.strftime('%Y-%m-%d'),
            patent.filing_date.strftime('%Y-%m-%d') if patent.filing_date else '',
            patent.issue_date.strftime('%Y-%m-%d') if patent.issue_date else ''
        ])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={
            'Content-Disposition': 'attachment; filename=patents.csv'
        }
    )
```

---

## Security Considerations

### 1. Admin Authentication

**For MVP (Simple):**
```python
# Check is_admin flag + session
if not (session.get('admin_logged_in') and
        User.query.filter_by(
            email=session.get('admin_email'),
            is_admin=True
        ).first()):
    abort(403)
```

**For Production (Recommended):**
- Separate admin table with password hashing
- Two-factor authentication
- IP whitelisting
- Audit logging of all admin actions

### 2. Rate Limiting

Apply stricter rate limits to admin routes:
```python
from flask_limiter import Limiter

limiter = Limiter(app, key_func=get_remote_address)

@admin_bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    # ...
```

### 3. Audit Logging

Create audit log table:

```sql
CREATE TABLE admin_audit_log (
    id SERIAL PRIMARY KEY,
    admin_email VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    target_type VARCHAR(50),  -- 'user', 'patent', etc.
    target_id INTEGER,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Log all admin actions:
```python
def log_admin_action(action, target_type=None, target_id=None, details=None):
    log_entry = AdminAuditLog(
        admin_email=session.get('admin_email'),
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=request.remote_addr
    )
    db.session.add(log_entry)
    db.session.commit()

# Usage
log_admin_action('view_user_detail', 'user', user_id)
```

---

## Quick Setup Instructions

### 1. Update Database

```sql
-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Make yourself admin
UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';
```

### 2. Create Admin Routes File

Create `routes/admin.py` with all route handlers from above.

### 3. Register Blueprint

In `app.py`:
```python
from routes.admin import admin_bp
app.register_blueprint(admin_bp)
```

### 4. Create Templates

Create these templates:
- `templates/admin/login.html`
- `templates/admin/base.html`
- `templates/admin/dashboard.html`
- `templates/admin/users.html`
- `templates/admin/user_detail.html`
- `templates/admin/patents.html`
- `templates/admin/patent_detail.html`
- `templates/admin/analytics.html`

---

## Complete Admin Routes Summary

| Route | Method | Purpose |
|-------|--------|---------|
| `/admin/` | GET | Redirect to login or dashboard |
| `/admin/login` | GET/POST | Admin login |
| `/admin/logout` | GET | Admin logout |
| `/admin/dashboard` | GET | Main overview |
| `/admin/users` | GET | User list with filters |
| `/admin/users/<id>` | GET | Individual user detail |
| `/admin/users/export` | GET | Export users to CSV |
| `/admin/patents` | GET | Patent list with filters |
| `/admin/patents/<id>` | GET | Patent detail |
| `/admin/patents/export` | GET | Export patents to CSV |
| `/admin/analytics` | GET | Charts and visualizations |

---

## Next Steps

1. Implement admin authentication
2. Create admin templates
3. Add Chart.js visualizations
4. Test with sample data
5. Add audit logging (optional)
6. Deploy and secure admin access

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
