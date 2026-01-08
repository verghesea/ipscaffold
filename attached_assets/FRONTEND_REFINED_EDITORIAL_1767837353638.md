# IP Scaffold - Refined Editorial Frontend Design

## Design Philosophy

**Aesthetic Direction:** Refined Editorial

**Core Characteristics:**
- Sophisticated serif typography for authority and prestige
- Generous whitespace and breathing room
- Asymmetric, editorial-style layouts
- Subtle, purposeful animations
- Deep, rich color palette avoiding common tech clichés
- High-contrast typography hierarchy
- Academic credibility meets modern sophistication

**Target Emotion:** Users should feel they're accessing a premium, scholarly service - like reading a prestigious academic journal but with modern digital convenience.

---

## Design System

### Typography

**Display Font:** Playfair Display (serif, elegant, authoritative)
- Used for: Main headings, hero text, patent titles
- Weights: 400, 600, 700

**Body Font:** Work Sans (geometric sans, clean, professional)
- Used for: Body text, UI elements, navigation
- Weights: 300, 400, 500, 600

**Accent Font:** JetBrains Mono (monospace, technical)
- Used for: Status indicators, metadata, technical details
- Weights: 400, 500

### Color Palette

```css
:root {
  /* Primary - Deep Scholarly Blue */
  --primary-900: #0A1F3D;
  --primary-800: #143154;
  --primary-700: #1E446B;
  --primary-600: #285682;
  --primary-500: #326899;

  /* Accent - Refined Amber */
  --accent-600: #B8860B;
  --accent-500: #D4A528;
  --accent-400: #E8C547;

  /* Neutrals - Warm Grays */
  --neutral-50: #FAFAF9;
  --neutral-100: #F5F5F4;
  --neutral-200: #E7E5E4;
  --neutral-300: #D6D3D1;
  --neutral-400: #A8A29E;
  --neutral-500: #78716C;
  --neutral-600: #57534E;
  --neutral-700: #44403C;
  --neutral-800: #292524;
  --neutral-900: #1C1917;

  /* Semantic Colors */
  --success: #2D5F3F;
  --warning: #8B5A00;
  --error: #7F2A2A;

  /* Background */
  --bg-primary: #FFFEF9;
  --bg-secondary: #F8F7F2;
  --bg-tertiary: #EFEDE5;
}
```

### Spacing Scale

Editorial layouts use generous, proportional spacing:

```css
:root {
  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2.5rem;
  --space-xl: 4rem;
  --space-2xl: 6rem;
  --space-3xl: 9rem;
}
```

### Animation Principles

**Subtle and Purposeful:**
- Orchestrated page loads with staggered reveals
- Smooth, slower transitions (400-600ms)
- Scroll-triggered fade-ins for content sections
- Hover states that add sophistication without distraction

```css
:root {
  --transition-smooth: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-bounce: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  --animation-stagger: 0.1s;
}
```

---

## Global Styles

**File:** `static/css/editorial.css`

```css
/* Import Fonts */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Work+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

/* CSS Variables (from Design System above) */
:root {
  --primary-900: #0A1F3D;
  --primary-800: #143154;
  --primary-700: #1E446B;
  --primary-600: #285682;
  --primary-500: #326899;

  --accent-600: #B8860B;
  --accent-500: #D4A528;
  --accent-400: #E8C547;

  --neutral-50: #FAFAF9;
  --neutral-100: #F5F5F4;
  --neutral-200: #E7E5E4;
  --neutral-300: #D6D3D1;
  --neutral-400: #A8A29E;
  --neutral-500: #78716C;
  --neutral-600: #57534E;
  --neutral-700: #44403C;
  --neutral-800: #292524;
  --neutral-900: #1C1917;

  --success: #2D5F3F;
  --warning: #8B5A00;
  --error: #7F2A2A;

  --bg-primary: #FFFEF9;
  --bg-secondary: #F8F7F2;
  --bg-tertiary: #EFEDE5;

  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2.5rem;
  --space-xl: 4rem;
  --space-2xl: 6rem;
  --space-3xl: 9rem;

  --transition-smooth: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-bounce: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Reset & Base */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Work Sans', -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  color: var(--neutral-800);
  background-color: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Typography Scale */
h1, h2, h3, h4, h5, h6 {
  font-family: 'Playfair Display', serif;
  font-weight: 600;
  line-height: 1.2;
  color: var(--primary-900);
  margin-bottom: var(--space-md);
}

h1 {
  font-size: clamp(2.5rem, 5vw, 4.5rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}

h2 {
  font-size: clamp(2rem, 4vw, 3rem);
  letter-spacing: -0.01em;
}

h3 {
  font-size: clamp(1.5rem, 3vw, 2rem);
}

h4 {
  font-size: clamp(1.25rem, 2vw, 1.5rem);
}

p {
  margin-bottom: var(--space-md);
  max-width: 65ch;
}

.lead {
  font-size: 1.25rem;
  font-weight: 300;
  color: var(--neutral-600);
  line-height: 1.6;
}

.label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 500;
  color: var(--neutral-500);
}

/* Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-in {
  animation: fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
}

.animate-in-1 { animation-delay: 0.1s; }
.animate-in-2 { animation-delay: 0.2s; }
.animate-in-3 { animation-delay: 0.3s; }
.animate-in-4 { animation-delay: 0.4s; }
.animate-in-5 { animation-delay: 0.5s; }

/* Links */
a {
  color: var(--primary-700);
  text-decoration: none;
  transition: var(--transition-smooth);
  position: relative;
}

a:hover {
  color: var(--accent-600);
}

a.link-underline::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 1px;
  background-color: var(--accent-500);
  transition: width 0.3s ease;
}

a.link-underline:hover::after {
  width: 100%;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
  font-family: 'Work Sans', sans-serif;
  font-size: 1rem;
  font-weight: 500;
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: var(--transition-smooth);
  position: relative;
  overflow: hidden;
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.1);
  transition: left 0.4s ease;
}

.btn:hover::before {
  left: 100%;
}

.btn-primary {
  background-color: var(--primary-900);
  color: var(--bg-primary);
  border: 2px solid var(--primary-900);
}

.btn-primary:hover {
  background-color: var(--primary-800);
  border-color: var(--primary-800);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(10, 31, 61, 0.2);
}

.btn-secondary {
  background-color: transparent;
  color: var(--primary-900);
  border: 2px solid var(--primary-900);
}

.btn-secondary:hover {
  background-color: var(--primary-900);
  color: var(--bg-primary);
}

.btn-accent {
  background-color: var(--accent-600);
  color: var(--bg-primary);
  border: 2px solid var(--accent-600);
}

.btn-accent:hover {
  background-color: var(--accent-500);
  border-color: var(--accent-500);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(184, 134, 11, 0.25);
}

/* Cards */
.card {
  background: var(--bg-primary);
  border: 1px solid var(--neutral-200);
  padding: var(--space-xl);
  transition: var(--transition-smooth);
}

.card:hover {
  border-color: var(--neutral-300);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
  transform: translateY(-4px);
}

/* Form Elements */
input[type="text"],
input[type="email"],
input[type="password"],
textarea,
select {
  width: 100%;
  padding: var(--space-md);
  font-family: 'Work Sans', sans-serif;
  font-size: 1rem;
  color: var(--neutral-800);
  background-color: var(--bg-primary);
  border: 2px solid var(--neutral-300);
  border-radius: 0;
  transition: var(--transition-smooth);
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--primary-600);
  box-shadow: 0 0 0 3px rgba(40, 86, 130, 0.1);
}

/* Upload Area */
.upload-area {
  border: 3px dashed var(--neutral-300);
  background: var(--bg-secondary);
  padding: var(--space-2xl);
  text-align: center;
  transition: var(--transition-smooth);
  cursor: pointer;
}

.upload-area:hover {
  border-color: var(--primary-600);
  background: var(--bg-primary);
  border-style: solid;
}

.upload-area.dragover {
  border-color: var(--accent-600);
  background: var(--accent-400);
  background: linear-gradient(135deg, var(--bg-primary), var(--accent-400) 10%, var(--bg-primary));
}

/* Status Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 0.375rem 0.875rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
  border-radius: 0;
}

.badge-success {
  background-color: rgba(45, 95, 63, 0.1);
  color: var(--success);
  border: 1px solid var(--success);
}

.badge-warning {
  background-color: rgba(139, 90, 0, 0.1);
  color: var(--warning);
  border: 1px solid var(--warning);
}

.badge-error {
  background-color: rgba(127, 42, 42, 0.1);
  color: var(--error);
  border: 1px solid var(--error);
}

/* Dividers */
.divider {
  height: 1px;
  background: linear-gradient(to right, transparent, var(--neutral-300), transparent);
  margin: var(--space-xl) 0;
}

.divider-thick {
  height: 3px;
  background: var(--primary-900);
  margin: var(--space-2xl) 0;
  position: relative;
}

.divider-thick::after {
  content: '';
  position: absolute;
  left: 0;
  top: -2px;
  width: 100px;
  height: 7px;
  background: var(--accent-600);
}

/* Utilities */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
}

.container-narrow {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
}

.text-center {
  text-align: center;
}

.text-muted {
  color: var(--neutral-500);
}

.mb-lg { margin-bottom: var(--space-lg); }
.mb-xl { margin-bottom: var(--space-xl); }
.mb-2xl { margin-bottom: var(--space-2xl); }
.mt-lg { margin-top: var(--space-lg); }
.mt-xl { margin-top: var(--space-xl); }
.mt-2xl { margin-top: var(--space-2xl); }

/* Grid System */
.grid {
  display: grid;
  gap: var(--space-xl);
}

.grid-2 {
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.grid-3 {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

/* Decorative Elements */
.ornament {
  width: 80px;
  height: 4px;
  background: var(--accent-600);
  margin: var(--space-lg) 0;
}

.ornament-center {
  margin: var(--space-lg) auto;
}

/* Grain Overlay (subtle texture) */
body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.03;
  z-index: 9999;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}
```

---

## Page Templates

### 1. Base Template

**File:** `templates/base_editorial.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}IP Scaffold{% endblock %} — Transform Patents into Business Insights</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/editorial.css') }}">
</head>
<body>
    <!-- Navigation -->
    <nav style="position: sticky; top: 0; z-index: 1000; background: rgba(255, 254, 249, 0.95); backdrop-filter: blur(10px); border-bottom: 1px solid var(--neutral-200);">
        <div class="container" style="display: flex; justify-content: space-between; align-items: center; padding-top: var(--space-md); padding-bottom: var(--space-md);">
            <a href="/" style="font-family: 'Playfair Display', serif; font-size: 1.5rem; font-weight: 700; color: var(--primary-900); letter-spacing: -0.02em;">
                IP Scaffold
            </a>

            <div style="display: flex; align-items: center; gap: var(--space-lg);">
                {% if current_user.is_authenticated %}
                    <span class="label" style="color: var(--neutral-500);">
                        Credits: <strong style="color: var(--primary-900);">{{ current_user.credits }}</strong>
                    </span>
                    <a href="/dashboard" class="link-underline" style="font-weight: 500;">Dashboard</a>
                    <a href="/logout" style="font-weight: 500; color: var(--neutral-600);">Logout</a>
                {% else %}
                    <span class="label">Scholarly AI for Deep Tech</span>
                {% endif %}
            </div>
        </div>
    </nav>

    <!-- Flash Messages -->
    {% with messages = get_flashed_messages(with_categories=true) %}
        {% if messages %}
            <div class="container" style="margin-top: var(--space-lg);">
                {% for category, message in messages %}
                    <div class="animate-in" style="
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
    <main>
        {% block content %}{% endblock %}
    </main>

    <!-- Footer -->
    <footer style="margin-top: var(--space-3xl); padding: var(--space-2xl) 0; border-top: 1px solid var(--neutral-200); background: var(--bg-secondary);">
        <div class="container">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--space-xl);">
                <div>
                    <h3 style="font-size: 1.25rem; margin-bottom: var(--space-sm);">IP Scaffold</h3>
                    <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 0;">
                        Transform intellectual property into actionable business intelligence.
                    </p>
                </div>
                <div>
                    <p class="label" style="margin-bottom: var(--space-sm);">Platform</p>
                    <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
                        <a href="/" class="link-underline" style="font-size: 0.9rem;">Home</a>
                        <a href="/dashboard" class="link-underline" style="font-size: 0.9rem;">Dashboard</a>
                    </div>
                </div>
                <div>
                    <p class="label" style="margin-bottom: var(--space-sm);">Resources</p>
                    <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
                        <a href="#" class="link-underline" style="font-size: 0.9rem;">Documentation</a>
                        <a href="#" class="link-underline" style="font-size: 0.9rem;">Support</a>
                    </div>
                </div>
            </div>

            <div class="divider" style="margin-top: var(--space-xl); margin-bottom: var(--space-lg);"></div>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; color: var(--neutral-500);">
                <p>&copy; 2026 IP Scaffold. All rights reserved.</p>
                <p class="label">Scholarly AI for Deep Technology</p>
            </div>
        </div>
    </footer>

    <script src="{{ url_for('static', filename='js/editorial.js') }}"></script>
</body>
</html>
```

---

### 2. Landing Page

**File:** `templates/landing_editorial.html`

```html
{% extends "base_editorial.html" %}

{% block content %}

<!-- Hero Section -->
<section style="padding: var(--space-3xl) 0; background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);">
    <div class="container">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2xl); align-items: center;">

            <!-- Left: Content -->
            <div>
                <div class="ornament animate-in-1"></div>

                <h1 class="animate-in-2" style="margin-bottom: var(--space-lg);">
                    Transform<br>
                    Patents into<br>
                    <span style="color: var(--accent-600);">Business Intelligence</span>
                </h1>

                <p class="lead animate-in-3" style="margin-bottom: var(--space-xl);">
                    IP Scaffold converts complex technical patents into clear, actionable business narratives—bridging the gap between innovation and commercialization.
                </p>

                <div class="animate-in-4" style="display: flex; gap: var(--space-md);">
                    <a href="#upload" class="btn btn-primary">
                        Upload Patent
                        <span style="font-size: 1.25rem;">→</span>
                    </a>
                    <a href="#how-it-works" class="btn btn-secondary">
                        How It Works
                    </a>
                </div>

                <div class="animate-in-5" style="margin-top: var(--space-xl); padding-top: var(--space-xl); border-top: 1px solid var(--neutral-200);">
                    <p class="label" style="margin-bottom: var(--space-sm);">Trusted By</p>
                    <p style="font-size: 0.9rem; color: var(--neutral-600);">
                        Technology Transfer Offices • Researchers • Deep Tech Founders • Investors
                    </p>
                </div>
            </div>

            <!-- Right: Visual Element -->
            <div class="animate-in-3" style="position: relative;">
                <div style="
                    background: var(--bg-primary);
                    border: 2px solid var(--neutral-200);
                    padding: var(--space-xl);
                    position: relative;
                    box-shadow: 20px 20px 0 var(--accent-600);
                ">
                    <p class="label" style="margin-bottom: var(--space-md);">What You Get</p>
                    <div style="display: flex; flex-direction: column; gap: var(--space-md);">
                        <div style="border-left: 3px solid var(--primary-900); padding-left: var(--space-md);">
                            <h4 style="font-size: 1.1rem; margin-bottom: 0.25rem; color: var(--primary-900);">ELIA15</h4>
                            <p style="font-size: 0.9rem; margin: 0; color: var(--neutral-600);">Simplified technical explanation</p>
                        </div>
                        <div style="border-left: 3px solid var(--primary-900); padding-left: var(--space-md);">
                            <h4 style="font-size: 1.1rem; margin-bottom: 0.25rem; color: var(--primary-900);">Business Narrative</h4>
                            <p style="font-size: 0.9rem; margin: 0; color: var(--neutral-600);">Investor-ready pitch content</p>
                        </div>
                        <div style="border-left: 3px solid var(--primary-900); padding-left: var(--space-md);">
                            <h4 style="font-size: 1.1rem; margin-bottom: 0.25rem; color: var(--primary-900);">Golden Circle</h4>
                            <p style="font-size: 0.9rem; margin: 0; color: var(--neutral-600);">WHY • HOW • WHAT framework</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Upload Section -->
<section id="upload" style="padding: var(--space-3xl) 0;">
    <div class="container-narrow">
        <div style="text-align: center; margin-bottom: var(--space-2xl);">
            <div class="ornament ornament-center"></div>
            <h2>Upload Your Patent</h2>
            <p class="lead text-center" style="margin: var(--space-lg) auto 0;">
                Begin your transformation journey
            </p>
        </div>

        <form action="/upload" method="POST" enctype="multipart/form-data" id="uploadForm">
            <div class="upload-area" id="uploadArea">
                <div style="margin-bottom: var(--space-lg);">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--neutral-400);">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                </div>

                <h3 style="font-size: 1.5rem; margin-bottom: var(--space-sm); color: var(--primary-900);">
                    Drop your patent PDF here
                </h3>
                <p style="color: var(--neutral-600); margin-bottom: var(--space-lg);">
                    or click to browse
                </p>

                <input type="file" name="pdf_file" id="pdfFile" accept=".pdf" style="display: none;" required>

                <button type="button" onclick="document.getElementById('pdfFile').click()" class="btn btn-secondary">
                    Select PDF File
                </button>

                <p style="font-size: 0.875rem; color: var(--neutral-500); margin-top: var(--space-md); margin-bottom: 0;">
                    Maximum file size: 10MB • US Patents Only (MVP)
                </p>
            </div>

            <div id="fileSelected" style="display: none; margin-top: var(--space-lg); padding: var(--space-lg); background: var(--bg-secondary); border: 2px solid var(--primary-600);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <p class="label" style="margin-bottom: 0.25rem;">Selected File</p>
                        <p id="fileName" style="font-weight: 500; color: var(--primary-900); margin: 0;"></p>
                    </div>
                    <button type="submit" class="btn btn-primary">
                        Analyze Patent
                        <span>→</span>
                    </button>
                </div>
            </div>
        </form>
    </div>
</section>

<!-- How It Works -->
<section id="how-it-works" style="padding: var(--space-3xl) 0; background: var(--bg-secondary);">
    <div class="container">
        <div style="text-align: center; margin-bottom: var(--space-2xl);">
            <div class="ornament ornament-center"></div>
            <h2>How It Works</h2>
            <p class="lead text-center" style="margin: var(--space-lg) auto 0; max-width: 600px;">
                A scholarly approach to patent analysis, powered by advanced AI
            </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-xl); margin-top: var(--space-2xl);">
            <!-- Step 1 -->
            <div class="card">
                <div style="font-family: 'Playfair Display', serif; font-size: 4rem; font-weight: 700; color: var(--accent-600); line-height: 1; margin-bottom: var(--space-md);">
                    01
                </div>
                <h3 style="font-size: 1.5rem; margin-bottom: var(--space-sm);">Upload</h3>
                <p style="color: var(--neutral-600); margin-bottom: 0;">
                    Upload your patent PDF. We parse and extract all technical details, claims, and innovations automatically.
                </p>
            </div>

            <!-- Step 2 -->
            <div class="card">
                <div style="font-family: 'Playfair Display', serif; font-size: 4rem; font-weight: 700; color: var(--accent-600); line-height: 1; margin-bottom: var(--space-md);">
                    02
                </div>
                <h3 style="font-size: 1.5rem; margin-bottom: var(--space-sm);">Transform</h3>
                <p style="color: var(--neutral-600); margin-bottom: 0;">
                    Our AI analyzes your IP and generates three distinct business artifacts tailored for different audiences.
                </p>
            </div>

            <!-- Step 3 -->
            <div class="card">
                <div style="font-family: 'Playfair Display', serif; font-size: 4rem; font-weight: 700; color: var(--accent-600); line-height: 1; margin-bottom: var(--space-md);">
                    03
                </div>
                <h3 style="font-size: 1.5rem; margin-bottom: var(--space-sm);">Export</h3>
                <p style="color: var(--neutral-600); margin-bottom: 0;">
                    Download your artifacts as PDF, DOCX, or TXT. Use them in pitch decks, grant applications, or investor meetings.
                </p>
            </div>
        </div>
    </div>
</section>

<!-- Pricing Teaser -->
<section style="padding: var(--space-3xl) 0;">
    <div class="container-narrow text-center">
        <div class="ornament ornament-center"></div>
        <h2>Start Free</h2>
        <p class="lead" style="margin: var(--space-lg) auto var(--space-xl);">
            Every new account receives <strong>100 free credits</strong>—enough to analyze 10 patents.
        </p>

        <div style="background: var(--bg-secondary); border: 2px solid var(--neutral-200); padding: var(--space-2xl); max-width: 500px; margin: 0 auto;">
            <p class="label" style="margin-bottom: var(--space-sm);">Pricing</p>
            <div style="font-family: 'Playfair Display', serif; font-size: 3rem; font-weight: 700; color: var(--primary-900); margin-bottom: var(--space-sm);">
                $2
                <span style="font-size: 1.5rem; font-weight: 400; color: var(--neutral-600);">/ patent</span>
            </div>
            <p style="color: var(--neutral-600); font-size: 0.9rem; margin: 0;">
                10 credits per patent • $20 for 100 credits
            </p>
        </div>
    </div>
</section>

<script>
// File upload interactivity
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('pdfFile');
const fileSelected = document.getElementById('fileSelected');
const fileName = document.getElementById('fileName');

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        fileInput.files = files;
        showSelectedFile(files[0]);
    }
});

// Click to upload
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// File selected
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        showSelectedFile(e.target.files[0]);
    }
});

function showSelectedFile(file) {
    fileName.textContent = file.name;
    fileSelected.style.display = 'block';
    fileSelected.style.animation = 'fadeInUp 0.5s ease forwards';
}
</script>

{% endblock %}
```

---

*This document continues with more templates in the next section...*

**Document Status:** Part 1 of 2
**Next:** Preview, Dashboard, Patent Detail, Admin templates
