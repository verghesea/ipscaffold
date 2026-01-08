# IP Scaffold - Admin Dashboard (Refined Editorial)

Admin templates styled with the refined editorial aesthetic.

---

## Admin-Specific Design Adjustments

**Differences from User Frontend:**
- Darker, more authoritative color scheme for headers
- Monospace fonts for data tables and metrics
- Data-dense layouts with clear hierarchy
- More utilitarian but still sophisticated
- Charts styled with editorial color palette

---

## Admin Templates

### 1. Admin Base Template

**File:** `templates/admin/base_editorial.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}Admin Dashboard{% endblock %} — IP Scaffold</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/editorial.css') }}">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        /* Admin-specific overrides */
        body {
            background: var(--neutral-50);
        }

        .admin-nav {
            background: var(--primary-900);
            color: var(--bg-primary);
            padding: 0;
        }

        .admin-nav a {
            color: rgba(255, 254, 249, 0.8);
            transition: var(--transition-smooth);
        }

        .admin-nav a:hover,
        .admin-nav a.active {
            color: var(--accent-400);
            background: rgba(255, 255, 255, 0.05);
        }

        .stat-card {
            background: var(--bg-primary);
            border: 1px solid var(--neutral-200);
            padding: var(--space-lg);
            transition: var(--transition-smooth);
        }

        .stat-card:hover {
            border-color: var(--primary-600);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .stat-number {
            font-family: 'Playfair Display', serif;
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--primary-900);
            line-height: 1;
        }

        .data-table {
            width: 100%;
            background: var(--bg-primary);
            border-collapse: collapse;
            font-size: 0.9rem;
        }

        .data-table thead {
            background: var(--neutral-100);
            border-bottom: 2px solid var(--neutral-300);
        }

        .data-table th {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 500;
            color: var(--neutral-600);
            padding: var(--space-md);
            text-align: left;
        }

        .data-table td {
            padding: var(--space-md);
            border-bottom: 1px solid var(--neutral-200);
            color: var(--neutral-800);
        }

        .data-table tbody tr {
            transition: var(--transition-smooth);
        }

        .data-table tbody tr:hover {
            background: var(--neutral-50);
        }

        .chart-container {
            position: relative;
            background: var(--bg-primary);
            padding: var(--space-xl);
            border: 1px solid var(--neutral-200);
            margin-bottom: var(--space-xl);
        }
    </style>
</head>
<body>
    <!-- Admin Navigation -->
    <nav class="admin-nav">
        <div style="max-width: 1400px; margin: 0 auto; padding: 0 var(--space-lg);">
            <div style="display: flex; justify-content: space-between; align-items: center; height: 70px;">
                <!-- Logo -->
                <div style="display: flex; align-items: center; gap: var(--space-lg);">
                    <a href="/admin/dashboard" style="font-family: 'Playfair Display', serif; font-size: 1.5rem; font-weight: 700; color: var(--bg-primary); letter-spacing: -0.02em;">
                        IP Scaffold
                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent-400); margin-left: var(--space-xs);">Admin</span>
                    </a>

                    <!-- Nav Links -->
                    <div style="display: flex; gap: 0;">
                        <a href="/admin/dashboard" class="{% if request.endpoint == 'admin.dashboard' %}active{% endif %}" style="padding: var(--space-md) var(--space-lg); display: block;">
                            Dashboard
                        </a>
                        <a href="/admin/users" class="{% if 'users' in request.endpoint %}active{% endif %}" style="padding: var(--space-md) var(--space-lg); display: block;">
                            Users
                        </a>
                        <a href="/admin/patents" class="{% if 'patents' in request.endpoint %}active{% endif %}" style="padding: var(--space-md) var(--space-lg); display: block;">
                            Patents
                        </a>
                        <a href="/admin/analytics" class="{% if request.endpoint == 'admin.analytics' %}active{% endif %}" style="padding: var(--space-md) var(--space-lg); display: block;">
                            Analytics
                        </a>
                    </div>
                </div>

                <!-- User Info -->
                <div style="display: flex; align-items: center; gap: var(--space-lg);">
                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: rgba(255, 254, 249, 0.7);">
                        {{ session.admin_email }}
                    </span>
                    <a href="/admin/logout" class="btn" style="
                        background: transparent;
                        border: 1px solid rgba(255, 254, 249, 0.3);
                        color: var(--bg-primary);
                        padding: 0.5rem 1rem;
                        font-size: 0.875rem;
                    ">
                        Logout
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <!-- Flash Messages -->
    {% with messages = get_flashed_messages(with_categories=true) %}
        {% if messages %}
            <div style="max-width: 1400px; margin: 0 auto; padding: var(--space-lg) var(--space-lg) 0;">
                {% for category, message in messages %}
                    <div style="
                        padding: var(--space-md) var(--space-lg);
                        margin-bottom: var(--space-md);
                        border-left: 4px solid {% if category == 'error' %}var(--error){% else %}var(--success){% endif %};
                        background: {% if category == 'error' %}rgba(127, 42, 42, 0.05){% else %}rgba(45, 95, 63, 0.05){% endif %};
                        color: {% if category == 'error' %}var(--error){% else %}var(--success){% endif %};
                    ">
                        {{ message }}
                    </div>
                {% endfor %}
            </div>
        {% endif %}
    {% endwith %}

    <!-- Main Content -->
    <main style="max-width: 1400px; margin: 0 auto; padding: var(--space-2xl) var(--space-lg);">
        {% block content %}{% endblock %}
    </main>

    <!-- Footer -->
    <footer style="border-top: 1px solid var(--neutral-200); background: var(--bg-primary); margin-top: var(--space-3xl);">
        <div style="max-width: 1400px; margin: 0 auto; padding: var(--space-lg); text-align: center;">
            <p style="font-size: 0.875rem; color: var(--neutral-500); margin: 0;">
                IP Scaffold Admin Dashboard
            </p>
        </div>
    </footer>
</body>
</html>
```

---

### 2. Admin Login

**File:** `templates/admin/login_editorial.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login — IP Scaffold</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/editorial.css') }}">
</head>
<body style="background: linear-gradient(135deg, var(--primary-900) 0%, var(--primary-700) 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center;">
    <div style="max-width: 450px; width: 100%; padding: var(--space-lg);">
        <div style="text-align: center; margin-bottom: var(--space-2xl);">
            <div style="margin-bottom: var(--space-lg);">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--accent-400);">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            </div>

            <h1 style="font-size: 2rem; color: var(--bg-primary); margin-bottom: var(--space-sm);">
                Admin Access
            </h1>
            <p class="label" style="color: rgba(255, 254, 249, 0.7);">
                IP Scaffold Administration
            </p>
        </div>

        {% with messages = get_flashed_messages(with_categories=true) %}
            {% if messages %}
                {% for category, message in messages %}
                    <div style="
                        padding: var(--space-md);
                        margin-bottom: var(--space-lg);
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        color: var(--bg-primary);
                        border-radius: 4px;
                    ">
                        {{ message }}
                    </div>
                {% endfor %}
            {% endif %}
        {% endwith %}

        <form method="POST" action="/admin/login" style="background: var(--bg-primary); padding: var(--space-2xl); border: 1px solid var(--neutral-200);">
            <div style="margin-bottom: var(--space-lg);">
                <label for="email" class="label" style="display: block; margin-bottom: var(--space-sm); color: var(--neutral-700);">
                    Email Address
                </label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    style="width: 100%; padding: var(--space-md); border: 2px solid var(--neutral-300); background: var(--bg-primary);"
                    placeholder="admin@ipscaffold.com"
                >
            </div>

            <div style="margin-bottom: var(--space-xl);">
                <label for="password" class="label" style="display: block; margin-bottom: var(--space-sm); color: var(--neutral-700);">
                    Password
                </label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    style="width: 100%; padding: var(--space-md); border: 2px solid var(--neutral-300); background: var(--bg-primary);"
                    placeholder="••••••••"
                >
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">
                Sign In
                <span style="font-size: 1.25rem;">→</span>
            </button>
        </form>

        <p style="text-align: center; font-size: 0.75rem; color: rgba(255, 254, 249, 0.6); margin-top: var(--space-lg);">
            Note: For MVP, password validation is simplified
        </p>
    </div>
</body>
</html>
```

---

### 3. Admin Dashboard

**File:** `templates/admin/dashboard_editorial.html`

```html
{% extends "admin/base_editorial.html" %}

{% block content %}

<!-- Header -->
<div style="margin-bottom: var(--space-2xl);">
    <div class="ornament"></div>
    <h1 style="font-size: 3rem; margin-bottom: var(--space-sm);">
        System Overview
    </h1>
    <p class="lead" style="margin: 0;">
        Platform metrics and recent activity
    </p>
</div>

<!-- Key Metrics Grid -->
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--space-lg); margin-bottom: var(--space-2xl);">
    <!-- Total Users -->
    <div class="stat-card">
        <p class="label" style="margin-bottom: var(--space-sm);">Total Users</p>
        <div class="stat-number">{{ metrics.total_users }}</div>
        <p style="font-size: 0.875rem; color: var(--neutral-600); margin-top: var(--space-sm); margin-bottom: 0;">
            <span class="badge badge-success" style="font-size: 0.7rem;">{{ metrics.active_users }}</span> active (7d)
        </p>
    </div>

    <!-- Total Patents -->
    <div class="stat-card">
        <p class="label" style="margin-bottom: var(--space-sm);">Total Patents</p>
        <div class="stat-number">{{ metrics.total_patents }}</div>
        <p style="font-size: 0.875rem; color: var(--neutral-600); margin-top: var(--space-sm); margin-bottom: 0;">
            <span class="badge badge-success" style="font-size: 0.7rem;">+{{ metrics.patents_today }}</span> today
        </p>
    </div>

    <!-- Credits Used -->
    <div class="stat-card">
        <p class="label" style="margin-bottom: var(--space-sm);">Credits Used</p>
        <div class="stat-number" style="color: var(--accent-600);">{{ metrics.total_credits_used }}</div>
        <p style="font-size: 0.875rem; color: var(--neutral-600); margin-top: var(--space-sm); margin-bottom: 0;">
            {{ metrics.total_credits_used // 10 }} patents processed
        </p>
    </div>

    <!-- Revenue -->
    <div class="stat-card">
        <p class="label" style="margin-bottom: var(--space-sm);">Est. Revenue</p>
        <div class="stat-number" style="color: var(--success);">${{ "%.2f"|format(metrics.revenue_estimate) }}</div>
        <p style="font-size: 0.875rem; color: var(--neutral-600); margin-top: var(--space-sm); margin-bottom: 0;">
            @ $0.20 per credit
        </p>
    </div>
</div>

<!-- Processing Status -->
<div style="background: var(--bg-primary); border: 1px solid var(--neutral-200); padding: var(--space-xl); margin-bottom: var(--space-2xl);">
    <h2 style="font-size: 1.5rem; margin-bottom: var(--space-lg);">Processing Status</h2>

    <div style="display: grid; gap: var(--space-md);">
        {% for status, count in status_breakdown %}
            <div style="display: grid; grid-template-columns: 150px 1fr 100px; align-items: center; gap: var(--space-md);">
                <span class="label" style="text-transform: capitalize;">{{ status.replace('_', ' ') }}</span>

                <div style="background: var(--neutral-200); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="
                        height: 100%;
                        background: {% if status == 'completed' %}var(--success){% elif status == 'failed' %}var(--error){% else %}var(--warning){% endif %};
                        width: {{ (count / metrics.total_patents * 100)|round }}%;
                        transition: width 0.5s ease;
                    "></div>
                </div>

                <div style="text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem;">
                    {{ count }} <span style="color: var(--neutral-500);">({{ (count / metrics.total_patents * 100)|round }}%)</span>
                </div>
            </div>
        {% endfor %}
    </div>
</div>

<!-- Two Column Layout: Recent Activity -->
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-xl);">
    <!-- Recent Patents -->
    <div>
        <h2 style="font-size: 1.5rem; margin-bottom: var(--space-lg); display: flex; justify-content: space-between; align-items: center;">
            Recent Patents
            <a href="/admin/patents" class="link-underline" style="font-size: 0.875rem; font-weight: 400;">View All →</a>
        </h2>

        <div style="background: var(--bg-primary); border: 1px solid var(--neutral-200);">
            {% for patent in recent_patents %}
                <div style="padding: var(--space-md); border-bottom: 1px solid var(--neutral-200); {% if loop.last %}border-bottom: none;{% endif %}">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <h4 style="font-size: 0.95rem; margin: 0; flex: 1; line-height: 1.4;">
                            {{ patent.title[:60] }}{% if patent.title|length > 60 %}...{% endif %}
                        </h4>
                        <span class="badge {% if patent.status == 'completed' %}badge-success{% elif patent.status == 'failed' %}badge-error{% else %}badge-warning{% endif %}" style="font-size: 0.65rem; margin-left: var(--space-sm);">
                            {{ patent.status }}
                        </span>
                    </div>
                    <p style="font-size: 0.8rem; color: var(--neutral-600); margin: 0;">
                        {{ patent.assignee or 'Unknown' }} • {{ patent.created_at.strftime('%b %d') }}
                    </p>
                </div>
            {% endfor %}
        </div>
    </div>

    <!-- Recent Users -->
    <div>
        <h2 style="font-size: 1.5rem; margin-bottom: var(--space-lg); display: flex; justify-content: space-between; align-items: center;">
            Recent Users
            <a href="/admin/users" class="link-underline" style="font-size: 0.875rem; font-weight: 400;">View All →</a>
        </h2>

        <div style="background: var(--bg-primary); border: 1px solid var(--neutral-200);">
            {% for user in recent_users %}
                <div style="padding: var(--space-md); border-bottom: 1px solid var(--neutral-200); {% if loop.last %}border-bottom: none;{% endif %}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="font-size: 0.95rem; margin: 0 0 0.25rem 0;">
                                {{ user.email }}
                            </h4>
                            <p style="font-size: 0.8rem; color: var(--neutral-600); margin: 0;">
                                Joined {{ user.created_at.strftime('%b %d, %Y') }}
                            </p>
                        </div>
                        <div style="text-align: right;">
                            <p style="font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; font-weight: 500; margin: 0; color: var(--accent-600);">
                                {{ user.credits }}
                            </p>
                            <p style="font-size: 0.75rem; color: var(--neutral-500); margin: 0;">
                                credits
                            </p>
                        </div>
                    </div>
                </div>
            {% endfor %}
        </div>
    </div>
</div>

{% endblock %}
```

---

### 4. Users List (Admin)

**File:** `templates/admin/users_editorial.html`

```html
{% extends "admin/base_editorial.html" %}

{% block content %}

<!-- Header with Search -->
<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-2xl);">
    <div>
        <div class="ornament"></div>
        <h1 style="font-size: 3rem; margin-bottom: var(--space-sm);">
            Users
        </h1>
        <p class="lead" style="margin: 0;">
            {{ users_data|length }} users found
        </p>
    </div>

    <div style="display: flex; gap: var(--space-md);">
        <form method="GET" action="/admin/users" style="display: flex; gap: var(--space-sm);">
            <input
                type="text"
                name="search"
                value="{{ search }}"
                placeholder="Search by email..."
                style="width: 300px; padding: var(--space-sm) var(--space-md); border: 2px solid var(--neutral-300);"
            >
            <button type="submit" class="btn btn-secondary">Search</button>
        </form>
        <a href="/admin/users/export" class="btn btn-accent">Export CSV</a>
    </div>
</div>

<!-- Users Table -->
<div style="background: var(--bg-primary); border: 1px solid var(--neutral-200); overflow: hidden;">
    <table class="data-table">
        <thead>
            <tr>
                <th>
                    <a href="?sort=email&order={{ 'asc' if sort_by == 'email' and order == 'desc' else 'desc' }}">
                        Email {{ '↓' if sort_by == 'email' and order == 'desc' else '↑' if sort_by == 'email' else '' }}
                    </a>
                </th>
                <th>Joined</th>
                <th>Last Login</th>
                <th>
                    <a href="?sort=credits&order={{ 'asc' if sort_by == 'credits' and order == 'desc' else 'desc' }}">
                        Credits
                    </a>
                </th>
                <th>
                    <a href="?sort=patents&order={{ 'asc' if sort_by == 'patents' and order == 'desc' else 'desc' }}">
                        Patents
                    </a>
                </th>
                <th>Used</th>
                <th style="text-align: right;">Actions</th>
            </tr>
        </thead>
        <tbody>
            {% for user, patent_count, credits_used in users_data %}
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: var(--space-sm);">
                            {{ user.email }}
                            {% if user.is_admin %}
                                <span class="badge" style="background: rgba(147, 51, 234, 0.1); color: #9333ea; border-color: #9333ea; font-size: 0.65rem;">Admin</span>
                            {% endif %}
                        </div>
                    </td>
                    <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">
                        {{ user.created_at.strftime('%b %d, %Y') }}
                    </td>
                    <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: var(--neutral-600);">
                        {{ user.last_login.strftime('%b %d, %Y') if user.last_login else 'Never' }}
                    </td>
                    <td style="font-family: 'JetBrains Mono', monospace; font-weight: 500; color: var(--accent-600);">
                        {{ user.credits }}
                    </td>
                    <td style="font-family: 'JetBrains Mono', monospace;">
                        {{ patent_count }}
                    </td>
                    <td style="font-family: 'JetBrains Mono', monospace; color: var(--neutral-600);">
                        {{ abs(credits_used) }}
                    </td>
                    <td style="text-align: right;">
                        <a href="/admin/users/{{ user.id }}" class="link-underline" style="font-size: 0.875rem;">
                            View →
                        </a>
                    </td>
                </tr>
            {% endfor %}
        </tbody>
    </table>
</div>

{% endblock %}
```

---

### 5. Analytics with Charts

**File:** `templates/admin/analytics_editorial.html`

```html
{% extends "admin/base_editorial.html" %}

{% block content %}

<div style="margin-bottom: var(--space-2xl);">
    <div class="ornament"></div>
    <h1 style="font-size: 3rem; margin-bottom: var(--space-sm);">
        Analytics
    </h1>
    <p class="lead" style="margin: 0;">
        Usage insights and system trends
    </p>
</div>

<!-- Charts Grid -->
<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-xl);">
    <!-- Patents Over Time -->
    <div class="chart-container">
        <h3 style="font-size: 1.25rem; margin-bottom: var(--space-lg); color: var(--primary-900);">
            Patents Processed (Last 30 Days)
        </h3>
        <canvas id="patentsChart"></canvas>
    </div>

    <!-- User Signups -->
    <div class="chart-container">
        <h3 style="font-size: 1.25rem; margin-bottom: var(--space-lg); color: var(--primary-900);">
            User Signups (Last 30 Days)
        </h3>
        <canvas id="usersChart"></canvas>
    </div>

    <!-- Status Distribution -->
    <div class="chart-container">
        <h3 style="font-size: 1.25rem; margin-bottom: var(--space-lg); color: var(--primary-900);">
            Processing Status Distribution
        </h3>
        <canvas id="statusChart"></canvas>
    </div>

    <!-- Top Institutions -->
    <div class="chart-container">
        <h3 style="font-size: 1.25rem; margin-bottom: var(--space-lg); color: var(--primary-900);">
            Top 10 Institutions
        </h3>
        <canvas id="institutionsChart"></canvas>
    </div>

    <!-- Processing Time -->
    <div class="chart-container" style="grid-column: span 2;">
        <h3 style="font-size: 1.25rem; margin-bottom: var(--space-lg); color: var(--primary-900);">
            Average Processing Time by Artifact
        </h3>
        <canvas id="processingTimeChart"></canvas>
    </div>
</div>

<script>
// Editorial color palette for charts
const colors = {
    primary: '#0A1F3D',
    accent: '#B8860B',
    success: '#2D5F3F',
    warning: '#8B5A00',
    error: '#7F2A2A'
};

// Patents Over Time
new Chart(document.getElementById('patentsChart'), {
    type: 'line',
    data: {
        labels: {{ patents_by_day | map(attribute='date') | map('string') | list | tojson }},
        datasets: [{
            label: 'Patents',
            data: {{ patents_by_day | map(attribute='count') | list | tojson }},
            borderColor: colors.primary,
            backgroundColor: 'rgba(10, 31, 61, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: colors.primary
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { precision: 0, font: { family: 'JetBrains Mono' } },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
            },
            x: {
                ticks: { font: { family: 'JetBrains Mono', size: 10 } },
                grid: { display: false }
            }
        }
    }
});

// Users Over Time
new Chart(document.getElementById('usersChart'), {
    type: 'line',
    data: {
        labels: {{ users_by_day | map(attribute='date') | map('string') | list | tojson }},
        datasets: [{
            label: 'New Users',
            data: {{ users_by_day | map(attribute='count') | list | tojson }},
            borderColor: colors.success,
            backgroundColor: 'rgba(45, 95, 63, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: colors.success
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { precision: 0, font: { family: 'JetBrains Mono' } },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
            },
            x: {
                ticks: { font: { family: 'JetBrains Mono', size: 10 } },
                grid: { display: false }
            }
        }
    }
});

// Status Pie Chart
new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: {
        labels: {{ status_dist | map(attribute=0) | list | tojson }},
        datasets: [{
            data: {{ status_dist | map(attribute=1) | list | tojson }},
            backgroundColor: [colors.success, colors.warning, colors.error, colors.accent],
            borderWidth: 0
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    font: { family: 'Work Sans', size: 12 },
                    padding: 15
                }
            }
        }
    }
});

// Top Institutions
new Chart(document.getElementById('institutionsChart'), {
    type: 'bar',
    data: {
        labels: {{ top_institutions | map(attribute='assignee') | list | tojson }},
        datasets: [{
            label: 'Patents',
            data: {{ top_institutions | map(attribute='count') | list | tojson }},
            backgroundColor: colors.accent,
            borderWidth: 0
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        indexAxis: 'y',
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                beginAtZero: true,
                ticks: { precision: 0, font: { family: 'JetBrains Mono' } },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
            },
            y: {
                ticks: { font: { family: 'Work Sans', size: 11 } },
                grid: { display: false }
            }
        }
    }
});

// Processing Time
new Chart(document.getElementById('processingTimeChart'), {
    type: 'bar',
    data: {
        labels: {{ avg_processing_time | map(attribute='artifact_type') | list | tojson }},
        datasets: [{
            label: 'Avg Time (seconds)',
            data: {{ avg_processing_time | map(attribute='avg_time') | map('float') | list | tojson }},
            backgroundColor: colors.primary,
            borderWidth: 0
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { font: { family: 'JetBrains Mono' } },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
            },
            x: {
                ticks: { font: { family: 'Work Sans' } },
                grid: { display: false }
            }
        }
    }
});
</script>

{% endblock %}
```

---

## Summary

**Refined Editorial Design Complete:**

✅ **Global Design System** - Typography, colors, spacing, animations
✅ **User Templates** - Landing, Preview, Dashboard, Patent Detail
✅ **Admin Templates** - Login, Dashboard, Users, Analytics
✅ **Chart Styling** - Chart.js with editorial color palette
✅ **Interactions** - Smooth scrolling, hover effects, form validation

**Key Design Features:**
- Playfair Display serif for authority and prestige
- Work Sans for clean readability
- JetBrains Mono for technical/data elements
- Deep scholarly blues with refined amber accents
- Generous whitespace and asymmetric layouts
- Subtle grain texture overlay
- Orchestrated animations with staggered reveals
- Editorial pull quotes and side notes
- Data tables with sophisticated styling

**Next Steps:**
1. Replace old templates with these new editorial versions
2. Test responsiveness on mobile/tablet
3. Add scroll-triggered animations for content sections
4. Consider adding more editorial flourishes (decorative borders, pull quotes for key insights)

