import { initialContent, initialServiceArea, validateLicense } from './shared/content.mjs';

export async function loadSiteContent(original) {
  let content = initialContent(original);
  try {
    const response = await fetch('/api/content', { cache: 'no-store' });
    if (!response.ok) throw new Error('Published content could not be loaded');
    const published = await response.json();
    if (published.configured) {
      if (!published.content || !Array.isArray(published.content.services) || !Array.isArray(published.content.gallery)) {
        throw new Error('Published content is not ready');
      }
      content = {
        ...initialContent(original),
        ...published.content,
        serviceArea: initialServiceArea({ serviceArea: published.content.serviceArea })
      };
    }
  } catch (error) {
    // Keep the imported site available during provider outages, without claiming a save succeeded.
    console.warn('Using original website photos while published content is unavailable.', error.message);
  }
  const hero = document.getElementById('homepage-cover');
  if (content.hero) hero.src = content.hero;
  else hero.remove();

  const spotlight = document.getElementById('featured-project-photo');
  if (content.featured) spotlight.src = content.featured;
  else {
    spotlight.closest('.reveal-right').remove();
    document.getElementById('spotlight-layout').classList.remove('lg:grid-cols-2');
  }
  document.querySelectorAll('[data-service-area-region]').forEach(element => {
    element.textContent = content.serviceArea.region;
  });
  document.querySelectorAll('[data-service-area-cities]').forEach(element => {
    element.textContent = content.serviceArea.cities.join(', ');
    element.hidden = content.serviceArea.cities.length === 0;
  });
  if (!content.gallery.length) {
    document.getElementById('gallery').hidden = true;
    document.querySelectorAll('a[href="#gallery"]').forEach(link => { link.hidden = true; });
  }
  const license = content.license;
  if (license?.number && !validateLicense(license)) {
    document.getElementById('license-business-name').textContent = license.businessName;
    document.getElementById('license-number').textContent = `ROC ${license.number}`;
    document.getElementById('license-verification').href = license.verificationUrl || 'https://roc.az.gov';
    document.getElementById('business-license').hidden = false;
  }
  return {
    services: original.services.map((service, i) => ({ ...service, image: content.services[i] || null })),
    gallery: content.gallery
  };
}
