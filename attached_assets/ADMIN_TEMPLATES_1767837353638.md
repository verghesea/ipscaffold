# IP Scaffold - Admin Dashboard Templates

Complete HTML templates for admin dashboard using Tailwind CSS and Chart.js.

---

## 1. Admin Base Template

**File:** `templates/admin/base.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}Admin Dashboard{% endblock %} - IP Scaffold</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body class="bg-gray-100">
    <!-- Admin Navigation -->
    <nav class="bg-gray-900 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center space-x-8">
                    <a href="/admin/dashboard" class="text-xl font-bold">
                        🔧 IP Scaffold Admin
                    </a>
                    <div class="hidden md:flex space-x-4">
                        <a href="/admin/dashboard" class="px-3 py-2 rounded hover:bg-gray-700 {% if request.endpoint == 'admin.dashboard' %}bg-gray-700{% endif %}">
                            Dashboard
                        </a>
                        <a href="/admin/users" class="px-3 py-2 rounded hover:bg-gray-700 {% if 'users' in request.endpoint %}bg-gray-700{% endif %}">
                            Users
                        </a>
                        <a href="/admin/patents" class="px-3 py-2 rounded hover:bg-gray-700 {% if 'patents' in request.endpoint %}bg-gray-700{% endif %}">
                            Patents
                        </a>
                        <a href="/admin/analytics" class="px-3 py-2 rounded hover:bg-gray-700 {% if request.endpoint == 'admin.analytics' %}bg-gray-700{% endif %}">
                            Analytics
                        </a>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <span class="text-sm text-gray-300">{{ session.admin_email }}</span>
                    <a href="/admin/logout" class="px-4 py-2 bg-red-600 rounded hover:bg-red-700">
                        Logout
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <!-- Flash Messages -->
    {% with messages = get_flashed_messages(with_categories=true) %}
        {% if messages %}
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                {% for category, message in messages %}
                    <div class="bg-{{ 'red' if category == 'error' else 'green' }}-100 border border-{{ 'red' if category == 'error' else 'green' }}-400 text-{{ 'red' if category == 'error' else 'green' }}-700 px-4 py-3 rounded mb-4">
                        {{ message }}
                    </div>
                {% endfor %}
            </div>
        {% endif %}
    {% endwith %}

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {% block content %}{% endblock %}
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t mt-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-gray-500 text-sm">
            IP Scaffold Admin Dashboard
        </div>
    </footer>
</body>
</html>
```

---

## 2. Admin Login

**File:** `templates/admin/login.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - IP Scaffold</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
    <div class="min-h-screen flex items-center justify-center">
        <div class="max-w-md w-full space-y-8">
            <div>
                <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    🔧 Admin Login
                </h2>
                <p class="mt-2 text-center text-sm text-gray-600">
                    IP Scaffold Administration
                </p>
            </div>

            {% with messages = get_flashed_messages(with_categories=true) %}
                {% if messages %}
                    {% for category, message in messages %}
                        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {{ message }}
                        </div>
                    {% endfor %}
                {% endif %}
            {% endwith %}

            <form class="mt-8 space-y-6 bg-white p-8 rounded-lg shadow" method="POST" action="/admin/login">
                <div class="rounded-md shadow-sm space-y-4">
                    <div>
                        <label for="email" class="block text-sm font-medium text-gray-700">
                            Email address
                        </label>
                        <input id="email" name="email" type="email" required
                               class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                               placeholder="admin@example.com">
                    </div>
                    <div>
                        <label for="password" class="block text-sm font-medium text-gray-700">
                            Password
                        </label>
                        <input id="password" name="password" type="password" required
                               class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                               placeholder="Password">
                    </div>
                </div>

                <div>
                    <button type="submit"
                            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Sign in
                    </button>
                </div>
            </form>

            <p class="text-center text-xs text-gray-500">
                Note: For MVP, password check is simplified. Use production auth for deployment.
            </p>
        </div>
    </div>
</body>
</html>
```

---

## 3. Admin Dashboard

**File:** `templates/admin/dashboard.html`

```html
{% extends "admin/base.html" %}

{% block content %}
<div class="space-y-6">
    <!-- Header -->
    <div>
        <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p class="mt-1 text-sm text-gray-600">System overview and recent activity</p>
    </div>

    <!-- Key Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <!-- Total Users -->
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-600">Total Users</p>
                    <p class="text-3xl font-bold text-gray-900">{{ metrics.total_users }}</p>
                </div>
                <div class="text-blue-600 text-4xl">👥</div>
            </div>
            <p class="mt-2 text-xs text-gray-500">Active (7d): {{ metrics.active_users }}</p>
        </div>

        <!-- Total Patents -->
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-600">Total Patents</p>
                    <p class="text-3xl font-bold text-gray-900">{{ metrics.total_patents }}</p>
                </div>
                <div class="text-green-600 text-4xl">📄</div>
            </div>
            <p class="mt-2 text-xs text-gray-500">Today: {{ metrics.patents_today }}</p>
        </div>

        <!-- Credits Used -->
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-600">Credits Used</p>
                    <p class="text-3xl font-bold text-gray-900">{{ metrics.total_credits_used }}</p>
                </div>
                <div class="text-purple-600 text-4xl">💳</div>
            </div>
            <p class="mt-2 text-xs text-gray-500">{{ metrics.total_credits_used // 10 }} patents processed</p>
        </div>

        <!-- Revenue Estimate -->
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-600">Est. Revenue</p>
                    <p class="text-3xl font-bold text-gray-900">${{ "%.2f"|format(metrics.revenue_estimate) }}</p>
                </div>
                <div class="text-yellow-600 text-4xl">💰</div>
            </div>
            <p class="mt-2 text-xs text-gray-500">At $0.20/credit</p>
        </div>
    </div>

    <!-- Processing Status -->
    <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Processing Status</h2>
        <div class="space-y-2">
            {% for status, count in status_breakdown %}
                <div class="flex items-center">
                    <div class="w-32 text-sm text-gray-600 capitalize">{{ status }}</div>
                    <div class="flex-1 bg-gray-200 rounded-full h-4">
                        <div class="bg-blue-600 h-4 rounded-full"
                             style="width: {{ (count / metrics.total_patents * 100)|round|int }}%">
                        </div>
                    </div>
                    <div class="w-20 text-right text-sm font-medium text-gray-900">
                        {{ count }} ({{ (count / metrics.total_patents * 100)|round|int }}%)
                    </div>
                </div>
            {% endfor %}
        </div>
    </div>

    <!-- Two Column Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent Patents -->
        <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
                <h2 class="text-lg font-semibold text-gray-900">Recent Patents</h2>
            </div>
            <div class="divide-y divide-gray-200">
                {% for patent in recent_patents %}
                    <div class="px-6 py-4 hover:bg-gray-50">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-900 truncate">
                                    {{ patent.title or 'Untitled' }}
                                </p>
                                <p class="text-xs text-gray-500 mt-1">
                                    {{ patent.assignee or 'Unknown assignee' }} • {{ patent.created_at.strftime('%b %d, %Y') }}
                                </p>
                            </div>
                            <span class="ml-2 px-2 py-1 text-xs rounded
                                {% if patent.status == 'completed' %}bg-green-100 text-green-800
                                {% elif patent.status == 'processing' or patent.status == 'elia15_complete' %}bg-yellow-100 text-yellow-800
                                {% else %}bg-red-100 text-red-800{% endif %}">
                                {{ patent.status }}
                            </span>
                        </div>
                        <div class="mt-2">
                            <a href="/admin/patents/{{ patent.id }}" class="text-xs text-blue-600 hover:text-blue-800">
                                View Details →
                            </a>
                        </div>
                    </div>
                {% endfor %}
            </div>
            <div class="px-6 py-3 bg-gray-50 text-center">
                <a href="/admin/patents" class="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    View All Patents →
                </a>
            </div>
        </div>

        <!-- Recent Users -->
        <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
                <h2 class="text-lg font-semibold text-gray-900">Recent Users</h2>
            </div>
            <div class="divide-y divide-gray-200">
                {% for user in recent_users %}
                    <div class="px-6 py-4 hover:bg-gray-50">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-900">
                                    {{ user.email }}
                                </p>
                                <p class="text-xs text-gray-500 mt-1">
                                    Joined {{ user.created_at.strftime('%b %d, %Y') }}
                                </p>
                            </div>
                            <div class="text-right">
                                <p class="text-sm font-medium text-gray-900">{{ user.credits }} credits</p>
                            </div>
                        </div>
                        <div class="mt-2">
                            <a href="/admin/users/{{ user.id }}" class="text-xs text-blue-600 hover:text-blue-800">
                                View Profile →
                            </a>
                        </div>
                    </div>
                {% endfor %}
            </div>
            <div class="px-6 py-3 bg-gray-50 text-center">
                <a href="/admin/users" class="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    View All Users →
                </a>
            </div>
        </div>
    </div>
</div>
{% endblock %}
```

---

## 4. Users List

**File:** `templates/admin/users.html`

```html
{% extends "admin/base.html" %}

{% block content %}
<div class="space-y-6">
    <!-- Header with Search -->
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold text-gray-900">Users</h1>
            <p class="mt-1 text-sm text-gray-600">{{ users_data|length }} users found</p>
        </div>
        <div class="flex items-center space-x-4">
            <form method="GET" action="/admin/users" class="flex items-center space-x-2">
                <input type="text" name="search" value="{{ search }}"
                       placeholder="Search by email..."
                       class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Search
                </button>
            </form>
            <a href="/admin/users/export" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Export CSV
            </a>
        </div>
    </div>

    <!-- Users Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <a href="?sort=email&order={{ 'asc' if sort_by == 'email' and order == 'desc' else 'desc' }}">
                            Email {{ '↓' if sort_by == 'email' and order == 'desc' else '↑' if sort_by == 'email' else '' }}
                        </a>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Login
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <a href="?sort=credits&order={{ 'asc' if sort_by == 'credits' and order == 'desc' else 'desc' }}">
                            Credits
                        </a>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <a href="?sort=patents&order={{ 'asc' if sort_by == 'patents' and order == 'desc' else 'desc' }}">
                            Patents
                        </a>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credits Used
                    </th>
                    <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                    </th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                {% for user, patent_count, credits_used in users_data %}
                    <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex items-center">
                                <div class="text-sm font-medium text-gray-900">
                                    {{ user.email }}
                                    {% if user.is_admin %}
                                        <span class="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">Admin</span>
                                    {% endif %}
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {{ user.created_at.strftime('%b %d, %Y') }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {{ user.last_login.strftime('%b %d, %Y') if user.last_login else 'Never' }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {{ user.credits }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {{ patent_count }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {{ abs(credits_used) }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <a href="/admin/users/{{ user.id }}" class="text-blue-600 hover:text-blue-900">
                                View
                            </a>
                        </td>
                    </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
</div>
{% endblock %}
```

---

## 5. Analytics Dashboard

**File:** `templates/admin/analytics.html`

```html
{% extends "admin/base.html" %}

{% block content %}
<div class="space-y-8">
    <!-- Header -->
    <div>
        <h1 class="text-3xl font-bold text-gray-900">Analytics</h1>
        <p class="mt-1 text-sm text-gray-600">System usage insights and trends</p>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Patents Over Time -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Patents Processed (Last 30 Days)</h2>
            <canvas id="patentsOverTimeChart"></canvas>
        </div>

        <!-- User Signups -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">User Signups (Last 30 Days)</h2>
            <canvas id="usersOverTimeChart"></canvas>
        </div>

        <!-- Processing Status Distribution -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Processing Status Distribution</h2>
            <canvas id="statusDistChart"></canvas>
        </div>

        <!-- Top Institutions -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Top 10 Institutions</h2>
            <canvas id="topInstitutionsChart"></canvas>
        </div>

        <!-- Average Processing Time -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Avg Processing Time by Artifact</h2>
            <canvas id="avgProcessingTimeChart"></canvas>
        </div>
    </div>
</div>

<script>
// Patents Over Time Chart
const patentsCtx = document.getElementById('patentsOverTimeChart');
new Chart(patentsCtx, {
    type: 'line',
    data: {
        labels: {{ patents_by_day | map(attribute='date') | map('string') | list | tojson }},
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
        maintainAspectRatio: true,
        scales: {
            y: {
                beginAtZero: true,
                ticks: { precision: 0 }
            }
        }
    }
});

// User Signups Chart
const usersCtx = document.getElementById('usersOverTimeChart');
new Chart(usersCtx, {
    type: 'line',
    data: {
        labels: {{ users_by_day | map(attribute='date') | map('string') | list | tojson }},
        datasets: [{
            label: 'New Users',
            data: {{ users_by_day | map(attribute='count') | list | tojson }},
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.3
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
            y: {
                beginAtZero: true,
                ticks: { precision: 0 }
            }
        }
    }
});

// Status Distribution Pie Chart
const statusCtx = document.getElementById('statusDistChart');
new Chart(statusCtx, {
    type: 'pie',
    data: {
        labels: {{ status_dist | map(attribute=0) | list | tojson }},
        datasets: [{
            data: {{ status_dist | map(attribute=1) | list | tojson }},
            backgroundColor: [
                'rgb(34, 197, 94)',   // completed - green
                'rgb(251, 191, 36)',  // processing - yellow
                'rgb(239, 68, 68)',   // failed - red
                'rgb(59, 130, 246)'   // other - blue
            ]
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom'
            }
        }
    }
});

// Top Institutions Bar Chart
const institutionsCtx = document.getElementById('topInstitutionsChart');
new Chart(institutionsCtx, {
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
        maintainAspectRatio: true,
        indexAxis: 'y',
        scales: {
            x: {
                beginAtZero: true,
                ticks: { precision: 0 }
            }
        }
    }
});

// Average Processing Time Chart
const processingTimeCtx = document.getElementById('avgProcessingTimeChart');
new Chart(processingTimeCtx, {
    type: 'bar',
    data: {
        labels: {{ avg_processing_time | map(attribute='artifact_type') | list | tojson }},
        datasets: [{
            label: 'Avg Time (seconds)',
            data: {{ avg_processing_time | map(attribute='avg_time') | map('float') | list | tojson }},
            backgroundColor: 'rgba(147, 51, 234, 0.7)',
            borderColor: 'rgb(147, 51, 234)',
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});
</script>
{% endblock %}
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
