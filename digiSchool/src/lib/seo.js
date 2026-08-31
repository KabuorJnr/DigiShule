import { useEffect } from 'react';

// Lightweight per-page <head> management for our client-rendered SPA. Avoids a
// heavyweight helmet dependency: each public page calls useSEO() with its own
// title/description and we patch the shared meta tags (title, description,
// canonical, Open Graph, Twitter) on mount. Google executes JS and reads these.

export const SITE_URL = 'https://www.edu1app.tech';
export const BRAND = 'EduOne';
const DEFAULT_IMAGE = `${SITE_URL}/dashboard_mockup.png`;
const DEFAULT_TITLE = 'EduOne — School Management System for Modern Schools';

function setMeta(attr, key, content) {
  if (content == null) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * useSEO — set the document's title and social/SEO meta for the current page.
 * @param {object} opts
 * @param {string} opts.title       Full page title (already brand-suffixed).
 * @param {string} opts.description Meta + OG/Twitter description.
 * @param {string} opts.path        Path portion for canonical/og:url (e.g. '/book-demo').
 * @param {string} [opts.image]     Absolute OG/Twitter image URL.
 * @param {boolean}[opts.noindex]   When true, ask crawlers not to index the page.
 */
export function useSEO({ title, description, path = '', image = DEFAULT_IMAGE, noindex = false } = {}) {
  useEffect(() => {
    const pageTitle = title || DEFAULT_TITLE;
    const url = `${SITE_URL}${path}`;

    document.title = pageTitle;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    setMeta('property', 'og:title', pageTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);

    setMeta('name', 'twitter:title', pageTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);

    setCanonical(url);
  }, [title, description, path, image, noindex]);
}
