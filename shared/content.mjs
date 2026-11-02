export const SERVICE_NAMES = ['Pavers', 'Artificial Turf', 'Gravel', 'Irrigation', 'Custom Designs'];
export const ORIGINAL_HERO = 'https://res.cloudinary.com/dgxsmxiax/image/upload/v1774069471/7193972578042583984_dprn9i.jpg';
export const ORIGINAL_FEATURED = 'https://res.cloudinary.com/dgxsmxiax/image/upload/v1774069465/5228158948893782823_lnqlq1.jpg';
export const DEFAULT_SERVICE_AREA = Object.freeze({
  region: 'Greater Phoenix Area',
  cities: Object.freeze(['Scottsdale', 'Mesa', 'Chandler', 'Gilbert'])
});

export function initialServiceArea(data = {}) {
  return {
    region: data.serviceArea?.region || DEFAULT_SERVICE_AREA.region,
    cities: Array.isArray(data.serviceArea?.cities) ? [...data.serviceArea.cities] : [...DEFAULT_SERVICE_AREA.cities]
  };
}

export function initialContent(data) {
  return {
    hero: ORIGINAL_HERO,
    featured: ORIGINAL_FEATURED,
    services: data.services.map(service => service.image),
    gallery: data.gallery.map((photo, i) => ({ id: `original-${i + 1}`, url: photo.url, title: photo.title.trim() })),
    serviceArea: initialServiceArea(data),
    license: { businessName: '', number: '', verificationUrl: '' }
  };
}

export function validateServiceArea(serviceArea) {
  if (!serviceArea || typeof serviceArea.region !== 'string' || !Array.isArray(serviceArea.cities)) {
    return 'Please check the service-area details.';
  }
  const region = serviceArea.region.trim();
  if (!region || region.length > 100) return 'Enter the service area name (up to 100 characters).';
  if (serviceArea.cities.length > 30 || serviceArea.cities.some(city =>
    typeof city !== 'string' || !city.trim() || city.trim().length > 80
  )) return 'Check the city list. Use up to 30 city names, each up to 80 characters.';
  const normalized = serviceArea.cities.map(city => city.trim().toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) return 'Remove duplicate city names.';
  return '';
}

export function isOfficialROCLink(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'roc.az.gov' || url.hostname.endsWith('.roc.az.gov') ||
        url.hostname === 'azroc.my.site.com');
  } catch { return false; }
}

export function validateLicense(license) {
  if (!license || ['businessName', 'number', 'verificationUrl'].some(key => typeof license[key] !== 'string')) {
    return 'Please complete the business license fields.';
  }
  const { businessName, number, verificationUrl } = license;
  if (!businessName && !number && !verificationUrl) return '';
  if (!businessName.trim() || businessName.length > 160) return 'Enter the registered business name.';
  if (!/^[0-9]{6}$/.test(number)) return 'Enter the six-digit Arizona ROC license number, without “ROC”.';
  if (verificationUrl.length > 500 || !isOfficialROCLink(verificationUrl)) return 'Use an official Arizona ROC website or contractor-search link, or leave the link blank.';
  return '';
}

export function movePhoto(gallery, id, direction) {
  const index = gallery.findIndex(photo => photo.id === id);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= gallery.length) return false;
  [gallery[index], gallery[destination]] = [gallery[destination], gallery[index]];
  return true;
}

export function removePhoto(content, section, key) {
  if (section === 'gallery') content.gallery = content.gallery.filter(photo => photo.id !== key);
  else if (section === 'services') content.services[key] = null;
  else content[section] = null;
}
