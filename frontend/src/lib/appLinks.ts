export const careerSiteUrl =
  (import.meta.env.VITE_CAREER_SITE_URL as string | undefined) ||
  (import.meta.env.DEV ? "http://localhost:5000/careers.html" : "/careers.html");
