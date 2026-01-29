import { UploadArea } from "@/components/upload/UploadArea";
import { CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";

export function LandingPage() {
  return (
    <Layout>
      <div className="flex flex-col items-center">
        {/* Hero Section */}
        <section className="w-full py-24 md:py-32 lg:py-40 bg-background relative overflow-hidden">
          {/* Background Ornament */}
          <div className="absolute top-0 right-0 w-1/3 h-full bg-secondary/30 -skew-x-12 translate-x-1/4 -z-10" />
          
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-400/10 border border-accent-400/20 text-accent-600 text-sm font-medium tracking-wide uppercase">
                <span className="w-2 h-2 rounded-full bg-accent-600 animate-pulse" />
                AI-Powered IP Analysis
              </div>
              
              <h1 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl lg:text-7xl leading-[1.1] text-primary-900 tracking-tight" data-testid="text-hero-title">
                Transform Patents into <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-900 via-primary-700 to-accent-600">
                  Business Assets
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
                Instantly generate simplified explanations, investor narratives, and strategic frameworks from any patent PDF.
              </p>
            </div>

            <div className="max-w-2xl mx-auto mt-16 animate-in fade-in slide-in-from-bottom-12 duration-1000 fill-mode-backwards delay-300">
              <UploadArea />
              <p className="text-center text-xs text-muted-foreground mt-4">
                Supported format: PDF up to 10MB. No credit card required.
              </p>
            </div>
          </div>
        </section>

        {/* Value Props */}
        <section className="w-full py-24 bg-card border-y border-border">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12">
              {[
                {
                  title: "Scientific Narrative",
                  desc: "Clear, jargon-free summaries explained as if to a 15-year-old.",
                  delay: "0ms"
                },
                {
                  title: "Business Narrative",
                  desc: "Investor-ready pitch content highlighting market opportunity.",
                  delay: "150ms"
                },
                {
                  title: "Golden Circle",
                  desc: "Strategic WHY-HOW-WHAT framework for compelling positioning.",
                  delay: "300ms"
                }
              ].map((feature, i) => (
                <div 
                  key={i} 
                  className="space-y-4 p-8 bg-background border border-border/50 hover:border-accent-400/50 transition-colors duration-300 group"
                  style={{ animationDelay: feature.delay }}
                >
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-primary-900 group-hover:bg-primary-900 group-hover:text-primary-foreground transition-colors duration-300">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-primary-900">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
