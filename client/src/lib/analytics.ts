export const trackEvent = (eventName: string, eventData?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).umami) {
    (window as any).umami.track(eventName, eventData);
  }
};

export const analytics = {
  trackPatentUpload: (title: string) => {
    trackEvent('patent-upload', { title });
  },

  trackArtifactView: (artifactType: string) => {
    trackEvent('artifact-view', { type: artifactType });
  },

  trackDownload: (format: string, artifactType: string) => {
    trackEvent('download', { format, artifactType });
  },

  trackMagicLinkSent: (email: string) => {
    trackEvent('magic-link-sent', { email });
  },

  trackLogin: () => {
    trackEvent('login-success');
  },

  trackPromoCodeRedeemed: (code: string, credits: number) => {
    trackEvent('promo-redeemed', { code, credits });
  },

  trackPageView: (page: string) => {
    trackEvent('page-view', { page });
  }
};
