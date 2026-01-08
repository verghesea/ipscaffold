# IP Scaffold - Refined Editorial Frontend (Part 2)

Continuation of refined editorial templates.

---

### 3. Preview Page (ELIA15 + Email Gate)

**File:** `templates/preview_editorial.html`

```html
{% extends "base_editorial.html" %}

{% block content %}

<!-- Hero Section -->
<section style="padding: var(--space-2xl) 0; background: var(--bg-secondary); border-bottom: 1px solid var(--neutral-200);">
    <div class="container-narrow text-center">
        <div class="ornament ornament-center animate-in-1"></div>
        <h1 class="animate-in-2" style="margin-bottom: var(--space-md);">
            Analysis Complete
        </h1>
        <p class="lead animate-in-3" style="margin: 0 auto;">
            Your simplified explanation is ready below
        </p>
    </div>
</section>

<!-- Patent Metadata -->
<section style="padding: var(--space-xl) 0; background: var(--bg-primary); border-bottom: 3px solid var(--neutral-200);">
    <div class="container-narrow">
        <div style="background: var(--bg-secondary); padding: var(--space-xl); border: 1px solid var(--neutral-200);">
            <h2 style="font-size: 1.75rem; margin-bottom: var(--space-lg); line-height: 1.3;">
                {{ patent.title or 'Untitled Patent' }}
            </h2>

            <div style="display: grid; grid-template-columns: auto 1fr; gap: var(--space-sm) var(--space-lg); font-size: 0.9rem;">
                {% if patent.assignee %}
                <span class="label">Assignee:</span>
                <span style="color: var(--neutral-700);">{{ patent.assignee }}</span>
                {% endif %}

                {% if patent.inventors %}
                <span class="label">Inventors:</span>
                <span style="color: var(--neutral-700);">{{ patent.inventors }}</span>
                {% endif %}

                {% if patent.filing_date %}
                <span class="label">Filed:</span>
                <span style="color: var(--neutral-700);">{{ patent.filing_date.strftime('%B %d, %Y') }}</span>
                {% endif %}

                {% if patent.issue_date %}
                <span class="label">Issued:</span>
                <span style="color: var(--neutral-700);">{{ patent.issue_date.strftime('%B %d, %Y') }}</span>
                {% endif %}
            </div>
        </div>
    </div>
</section>

<!-- ELIA15 Content -->
<section style="padding: var(--space-2xl) 0;">
    <div class="container-narrow">
        <div class="divider-thick" style="margin-bottom: var(--space-2xl);"></div>

        <div style="margin-bottom: var(--space-xl);">
            <p class="label" style="margin-bottom: var(--space-sm);">Artifact 01 of 03</p>
            <h2 style="font-size: 2.5rem; margin-bottom: var(--space-md);">
                ELIA15
            </h2>
            <p class="lead" style="color: var(--neutral-600); margin: 0;">
                Explain Like I'm 15 — A clear, accessible explanation of this technology
            </p>
        </div>

        <!-- ELIA15 Article Content -->
        <article style="
            font-size: 1.1rem;
            line-height: 1.8;
            color: var(--neutral-800);
            max-width: 65ch;
        ">
            {{ elia15_content | safe }}
        </article>

        <div class="divider" style="margin-top: var(--space-2xl);"></div>
    </div>
</section>

<!-- Email Gate -->
{% if show_email_gate %}
<section style="padding: var(--space-3xl) 0; background: linear-gradient(135deg, var(--primary-900) 0%, var(--primary-700) 100%); color: var(--bg-primary);">
    <div class="container-narrow text-center">
        <div style="margin-bottom: var(--space-xl);">
            <h2 style="color: var(--bg-primary); font-size: 2.5rem; margin-bottom: var(--space-md);">
                Unlock the Complete Analysis
            </h2>
            <p style="font-size: 1.1rem; color: rgba(255, 254, 249, 0.9); line-height: 1.7; max-width: 600px; margin: 0 auto;">
                Enter your email to receive access to the <strong>Business Narrative</strong> and <strong>Golden Circle</strong> frameworks, plus create your free account with 100 credits.
            </p>
        </div>

        <form action="/request-access" method="POST" style="max-width: 500px; margin: 0 auto;">
            <input type="hidden" name="patent_id" value="{{ patent.id }}">

            <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-md);">
                <input
                    type="email"
                    name="email"
                    placeholder="your.email@university.edu"
                    required
                    style="
                        flex: 1;
                        padding: var(--space-md) var(--space-lg);
                        font-size: 1rem;
                        background: var(--bg-primary);
                        border: 2px solid transparent;
                        color: var(--neutral-900);
                    "
                >
                <button type="submit" class="btn" style="
                    background: var(--accent-600);
                    color: var(--bg-primary);
                    border: 2px solid var(--accent-600);
                    white-space: nowrap;
                ">
                    Get Access
                    <span style="font-size: 1.25rem;">→</span>
                </button>
            </div>

            <p style="font-size: 0.85rem; color: rgba(255, 254, 249, 0.7); margin: 0;">
                We'll send you a magic link to access your dashboard. No password needed.
            </p>
        </form>

        <!-- What You'll Get -->
        <div style="margin-top: var(--space-2xl); padding-top: var(--space-2xl); border-top: 1px solid rgba(255, 254, 249, 0.2);">
            <p class="label" style="color: rgba(255, 254, 249, 0.7); margin-bottom: var(--space-lg);">
                Included in Full Access
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-lg); text-align: left;">
                <div>
                    <h4 style="color: var(--accent-400); font-size: 1.1rem; margin-bottom: 0.5rem;">Business Narrative</h4>
                    <p style="font-size: 0.9rem; color: rgba(255, 254, 249, 0.8); margin: 0;">
                        Investor-ready pitch deck content with market analysis
                    </p>
                </div>
                <div>
                    <h4 style="color: var(--accent-400); font-size: 1.1rem; margin-bottom: 0.5rem;">Golden Circle</h4>
                    <p style="font-size: 0.9rem; color: rgba(255, 254, 249, 0.8); margin: 0;">
                        WHY, HOW, WHAT framework for compelling communication
                    </p>
                </div>
                <div>
                    <h4 style="color: var(--accent-400); font-size: 1.1rem; margin-bottom: 0.5rem;">100 Free Credits</h4>
                    <p style="font-size: 0.9rem; color: rgba(255, 254, 249, 0.8); margin: 0;">
                        Analyze 10 more patents with your welcome bonus
                    </p>
                </div>
            </div>
        </div>
    </div>
</section>
{% else %}
<!-- Continue to Dashboard (if authenticated) -->
<section style="padding: var(--space-2xl) 0; background: var(--bg-secondary); text-align: center;">
    <div class="container-narrow">
        <p style="color: var(--neutral-600); margin-bottom: var(--space-lg);">
            Your remaining artifacts are being generated...
        </p>
        <a href="/dashboard" class="btn btn-primary">
            Go to Dashboard
            <span>→</span>
        </a>
    </div>
</section>
{% endif %}

{% endblock %}
```

---

### 4. Email Sent Confirmation

**File:** `templates/email_sent_editorial.html`

```html
{% extends "base_editorial.html" %}

{% block content %}

<section style="min-height: 70vh; display: flex; align-items: center; justify-content: center; padding: var(--space-2xl) 0;">
    <div class="container-narrow text-center">
        <div style="max-width: 600px; margin: 0 auto;">
            <!-- Icon -->
            <div style="margin-bottom: var(--space-xl);">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--accent-600); margin: 0 auto;">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
            </div>

            <div class="ornament ornament-center"></div>

            <h1 style="margin-bottom: var(--space-lg);">
                Check Your Email
            </h1>

            <p class="lead" style="margin-bottom: var(--space-xl);">
                We've sent a magic link to your inbox. Click the link to access your dashboard and view all generated artifacts.
            </p>

            <div style="background: var(--bg-secondary); border: 2px solid var(--neutral-200); padding: var(--space-xl); margin-bottom: var(--space-lg);">
                <p class="label" style="margin-bottom: var(--space-sm);">What's Happening Now</p>
                <p style="color: var(--neutral-700); margin: 0;">
                    While you're checking your email, we're generating your <strong>Business Narrative</strong> and <strong>Golden Circle</strong> frameworks. They'll be ready when you log in.
                </p>
            </div>

            <p style="font-size: 0.9rem; color: var(--neutral-600);">
                Didn't receive the email? Check your spam folder or contact support.
            </p>
        </div>
    </div>
</section>

{% endblock %}
```

---

### 5. Dashboard

**File:** `templates/dashboard_editorial.html`

```html
{% extends "base_editorial.html" %}

{% block content %}

<!-- Header -->
<section style="padding: var(--space-2xl) 0; background: var(--bg-secondary); border-bottom: 1px solid var(--neutral-200);">
    <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
                <div class="ornament animate-in-1"></div>
                <h1 class="animate-in-2" style="margin-bottom: var(--space-sm);">
                    Your Portfolio
                </h1>
                <p class="lead animate-in-3" style="margin: 0;">
                    {{ patents|length }} patent{{ 's' if patents|length != 1 else '' }} analyzed
                </p>
            </div>

            <div class="animate-in-4" style="text-align: right;">
                <p class="label" style="margin-bottom: var(--space-sm);">Available Credits</p>
                <div style="font-family: 'Playfair Display', serif; font-size: 3rem; font-weight: 700; color: var(--accent-600); line-height: 1;">
                    {{ user.credits }}
                </div>
                <p style="font-size: 0.875rem; color: var(--neutral-600); margin-top: var(--space-xs);">
                    {{ (user.credits // 10) }} patent{{ 's' if (user.credits // 10) != 1 else '' }} remaining
                </p>
            </div>
        </div>
    </div>
</section>

<!-- Upload New Patent -->
<section style="padding: var(--space-xl) 0; background: var(--bg-primary); border-bottom: 3px solid var(--neutral-200);">
    <div class="container">
        <div style="background: linear-gradient(135deg, var(--primary-900) 0%, var(--primary-700) 100%); padding: var(--space-xl); display: flex; justify-content: space-between; align-items: center; color: var(--bg-primary);">
            <div>
                <h3 style="color: var(--bg-primary); font-size: 1.5rem; margin-bottom: var(--space-sm);">
                    Analyze Another Patent
                </h3>
                <p style="color: rgba(255, 254, 249, 0.9); margin: 0;">
                    Upload a new patent to generate fresh business insights
                </p>
            </div>
            <a href="/#upload" class="btn" style="
                background: var(--accent-600);
                color: var(--bg-primary);
                border: 2px solid var(--accent-600);
            ">
                Upload Patent
                <span style="font-size: 1.25rem;">→</span>
            </a>
        </div>
    </div>
</section>

<!-- Patents List -->
<section style="padding: var(--space-2xl) 0;">
    <div class="container">
        {% if patents %}
            <div style="display: grid; gap: var(--space-xl);">
                {% for patent in patents %}
                    <div class="card" style="
                        display: grid;
                        grid-template-columns: 1fr auto;
                        gap: var(--space-xl);
                        align-items: start;
                        position: relative;
                        border-left: 4px solid {% if patent.status == 'completed' %}var(--success){% elif patent.status == 'failed' %}var(--error){% else %}var(--warning){% endif %};
                    ">
                        <!-- Left: Content -->
                        <div>
                            <!-- Status Badge -->
                            <div style="margin-bottom: var(--space-md);">
                                <span class="badge {% if patent.status == 'completed' %}badge-success{% elif patent.status == 'failed' %}badge-error{% else %}badge-warning{% endif %}">
                                    {{ patent.status.replace('_', ' ').title() }}
                                </span>
                            </div>

                            <!-- Title -->
                            <h3 style="font-size: 1.75rem; margin-bottom: var(--space-sm); line-height: 1.3;">
                                {{ patent.title or 'Untitled Patent' }}
                            </h3>

                            <!-- Metadata -->
                            <div style="display: flex; gap: var(--space-lg); margin-bottom: var(--space-lg); font-size: 0.9rem; color: var(--neutral-600);">
                                {% if patent.assignee %}
                                <div>
                                    <span class="label" style="display: block; margin-bottom: 0.25rem;">Assignee</span>
                                    {{ patent.assignee }}
                                </div>
                                {% endif %}
                                <div>
                                    <span class="label" style="display: block; margin-bottom: 0.25rem;">Uploaded</span>
                                    {{ patent.created_at.strftime('%b %d, %Y') }}
                                </div>
                            </div>

                            <!-- Artifacts Count -->
                            {% if patent.status == 'completed' %}
                            <div style="display: flex; gap: var(--space-md); font-size: 0.875rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <div style="width: 8px; height: 8px; background: var(--success); border-radius: 50%;"></div>
                                    <span>ELIA15</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <div style="width: 8px; height: 8px; background: var(--success); border-radius: 50%;"></div>
                                    <span>Business Narrative</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <div style="width: 8px; height: 8px; background: var(--success); border-radius: 50%;"></div>
                                    <span>Golden Circle</span>
                                </div>
                            </div>
                            {% endif %}
                        </div>

                        <!-- Right: Actions -->
                        <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
                            {% if patent.status == 'completed' %}
                                <a href="/patent/{{ patent.id }}" class="btn btn-primary">
                                    View Artifacts
                                </a>
                                <a href="/patent/{{ patent.id }}/download?format=pdf" class="btn btn-secondary" style="font-size: 0.875rem;">
                                    Download PDF
                                </a>
                            {% elif patent.status == 'failed' %}
                                <button class="btn" style="background: var(--error); color: white; border-color: var(--error); cursor: not-allowed;" disabled>
                                    Processing Failed
                                </button>
                            {% else %}
                                <button class="btn" style="background: var(--warning); color: white; border-color: var(--warning); cursor: wait;" disabled>
                                    Processing...
                                </button>
                            {% endif %}
                        </div>
                    </div>
                {% endfor %}
            </div>
        {% else %}
            <!-- Empty State -->
            <div style="text-align: center; padding: var(--space-3xl) 0;">
                <div class="ornament ornament-center"></div>
                <h2 style="margin-bottom: var(--space-md);">No Patents Yet</h2>
                <p class="lead" style="margin-bottom: var(--space-xl);">
                    Upload your first patent to get started
                </p>
                <a href="/#upload" class="btn btn-primary">
                    Upload Patent
                    <span style="font-size: 1.25rem;">→</span>
                </a>
            </div>
        {% endif %}
    </div>
</section>

{% endblock %}
```

---

### 6. Patent Detail Page

**File:** `templates/patent_detail_editorial.html`

```html
{% extends "base_editorial.html" %}

{% block content %}

<!-- Header -->
<section style="padding: var(--space-2xl) 0; background: var(--bg-secondary); border-bottom: 1px solid var(--neutral-200);">
    <div class="container">
        <a href="/dashboard" class="link-underline" style="display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: var(--space-lg); font-size: 0.9rem;">
            <span style="font-size: 1.25rem;">←</span>
            Back to Dashboard
        </a>

        <div class="ornament animate-in-1"></div>

        <h1 class="animate-in-2" style="margin-bottom: var(--space-lg); max-width: 900px;">
            {{ patent.title or 'Untitled Patent' }}
        </h1>

        <!-- Metadata Grid -->
        <div class="animate-in-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-lg); margin-bottom: var(--space-lg);">
            {% if patent.assignee %}
            <div>
                <p class="label" style="margin-bottom: 0.25rem;">Assignee</p>
                <p style="color: var(--neutral-700); margin: 0;">{{ patent.assignee }}</p>
            </div>
            {% endif %}

            {% if patent.inventors %}
            <div>
                <p class="label" style="margin-bottom: 0.25rem;">Inventors</p>
                <p style="color: var(--neutral-700); margin: 0;">{{ patent.inventors }}</p>
            </div>
            {% endif %}

            {% if patent.filing_date %}
            <div>
                <p class="label" style="margin-bottom: 0.25rem;">Filing Date</p>
                <p style="color: var(--neutral-700); margin: 0;">{{ patent.filing_date.strftime('%B %d, %Y') }}</p>
            </div>
            {% endif %}

            {% if patent.issue_date %}
            <div>
                <p class="label" style="margin-bottom: 0.25rem;">Issue Date</p>
                <p style="color: var(--neutral-700); margin: 0;">{{ patent.issue_date.strftime('%B %d, %Y') }}</p>
            </div>
            {% endif %}
        </div>

        <!-- Download Buttons -->
        <div class="animate-in-4" style="display: flex; gap: var(--space-md); flex-wrap: wrap;">
            <a href="/patent/{{ patent.id }}/download?format=pdf" class="btn btn-primary">
                Download PDF
            </a>
            <a href="/patent/{{ patent.id }}/download?format=docx" class="btn btn-secondary">
                Download DOCX
            </a>
            <a href="/patent/{{ patent.id }}/download?format=txt" class="btn btn-secondary">
                Download TXT
            </a>
        </div>
    </div>
</section>

<!-- Artifacts -->
<section style="padding: var(--space-2xl) 0;">
    <div class="container-narrow">

        <!-- Artifact 1: ELIA15 -->
        <div id="elia15" style="margin-bottom: var(--space-3xl);">
            <div class="divider-thick" style="margin-bottom: var(--space-2xl);"></div>

            <div style="margin-bottom: var(--space-xl);">
                <p class="label" style="margin-bottom: var(--space-sm);">Artifact 01 of 03</p>
                <h2 style="font-size: 2.5rem; margin-bottom: var(--space-md);">
                    ELIA15
                </h2>
                <p class="lead" style="color: var(--neutral-600); margin: 0;">
                    Explain Like I'm 15 — A clear, accessible explanation of this technology
                </p>
            </div>

            <article style="
                font-size: 1.1rem;
                line-height: 1.8;
                color: var(--neutral-800);
                max-width: 65ch;
            ">
                {{ artifacts.elia15 | safe }}
            </article>
        </div>

        <!-- Artifact 2: Business Narrative -->
        <div id="business-narrative" style="margin-bottom: var(--space-3xl);">
            <div class="divider-thick" style="margin-bottom: var(--space-2xl);"></div>

            <div style="margin-bottom: var(--space-xl);">
                <p class="label" style="margin-bottom: var(--space-sm);">Artifact 02 of 03</p>
                <h2 style="font-size: 2.5rem; margin-bottom: var(--space-md);">
                    Business Narrative
                </h2>
                <p class="lead" style="color: var(--neutral-600); margin: 0;">
                    Investor-ready content for pitch decks, grant applications, and partnership discussions
                </p>
            </div>

            <article style="
                font-size: 1.1rem;
                line-height: 1.8;
                color: var(--neutral-800);
                max-width: 65ch;
            ">
                {{ artifacts.business_narrative | safe }}
            </article>
        </div>

        <!-- Artifact 3: Golden Circle -->
        <div id="golden-circle" style="margin-bottom: var(--space-3xl);">
            <div class="divider-thick" style="margin-bottom: var(--space-2xl);"></div>

            <div style="margin-bottom: var(--space-xl);">
                <p class="label" style="margin-bottom: var(--space-sm);">Artifact 03 of 03</p>
                <h2 style="font-size: 2.5rem; margin-bottom: var(--space-md);">
                    Golden Circle
                </h2>
                <p class="lead" style="color: var(--neutral-600); margin: 0;">
                    Simon Sinek's WHY • HOW • WHAT framework applied to your innovation
                </p>
            </div>

            <article style="
                font-size: 1.1rem;
                line-height: 1.8;
                color: var(--neutral-800);
                max-width: 65ch;
            ">
                {{ artifacts.golden_circle | safe }}
            </article>
        </div>

        <!-- Quick Nav -->
        <div style="position: fixed; right: var(--space-xl); top: 50%; transform: translateY(-50%); background: var(--bg-primary); border: 1px solid var(--neutral-200); padding: var(--space-md); display: none;" id="quickNav">
            <p class="label" style="margin-bottom: var(--space-sm);">Jump To</p>
            <nav style="display: flex; flex-direction: column; gap: var(--space-sm); font-size: 0.875rem;">
                <a href="#elia15" class="link-underline">ELIA15</a>
                <a href="#business-narrative" class="link-underline">Business Narrative</a>
                <a href="#golden-circle" class="link-underline">Golden Circle</a>
            </nav>
        </div>

    </div>
</section>

<script>
// Show quick nav on desktop only
if (window.innerWidth > 1024) {
    document.getElementById('quickNav').style.display = 'block';
}

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});
</script>

{% endblock %}
```

---

### 7. JavaScript Enhancements

**File:** `static/js/editorial.js`

```javascript
// Smooth scroll for all anchor links
document.addEventListener('DOMContentLoaded', () => {
    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe all cards and content sections
    document.querySelectorAll('.card, article').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        observer.observe(el);
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add subtle parallax effect to hero sections
    const heroSections = document.querySelectorAll('section');
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        heroSections.forEach((section, index) => {
            if (index === 0) {
                section.style.transform = `translateY(${scrolled * 0.3}px)`;
            }
        });
    });
});

// Form validation with elegant feedback
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function(e) {
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                field.style.borderColor = 'var(--error)';
                field.style.animation = 'shake 0.3s ease';
            } else {
                field.style.borderColor = 'var(--neutral-300)';
            }
        });

        if (!isValid) {
            e.preventDefault();
        }
    });
});

// Shake animation for form errors
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);
```

---

**Document Status:** Part 2 of 2 (User Templates Complete)
**Next:** Admin templates with refined editorial design
