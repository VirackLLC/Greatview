export const MAX_SERVICES = 20;
export const MAX_SERVICE_TITLE_LENGTH = 80;
export const MAX_SERVICE_DESCRIPTION_LENGTH = 600;
export const SERVICE_ICONS = Object.freeze(['grid', 'sprout', 'mountain', 'droplets', 'pen-tool']);
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
    services: normalizeServices(data.services, data.services),
    gallery: data.gallery.map((photo, i) => ({ id: `original-${i + 1}`, url: photo.url, title: photo.title.trim() })),
    serviceArea: initialServiceArea(data),
    license: { businessName: '', number: '', verificationUrl: '' }
  };
}

export function normalizeServices(services, defaults = []) {
  if (!Array.isArray(services)) return [];
  const legacyImages = services.length === defaults.length &&
    services.every(image => image === null || typeof image === 'string');
  if (legacyImages) {
    return defaults.map((service, index) => ({
      id: `service-${index + 1}`,
      title: service.title,
      description: service.description || '',
      icon: SERVICE_ICONS.includes(service.icon) ? service.icon : 'grid',
      image: services[index]
    }));
  }
  return services.filter(service => service && typeof service === 'object' && !Array.isArray(service)).map((service, index) => ({
    id: typeof service.id === 'string' ? service.id : `service-${index + 1}`,
    title: typeof service.title === 'string' ? service.title : '',
    description: typeof service.description === 'string' ? service.description : '',
    icon: SERVICE_ICONS.includes(service.icon) ? service.icon : 'grid',
    image: typeof service.image === 'string' ? service.image : null
  }));
}

export function validateServices(services) {
  if (!Array.isArray(services) || services.length > MAX_SERVICES) {
    return `You can add up to ${MAX_SERVICES} services.`;
  }
  const ids = new Set();
  for (const service of services) {
    if (!service || typeof service !== 'object' || Array.isArray(service) ||
      typeof service.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(service.id) ||
      ids.has(service.id)) {
      return 'Please check the service list and remove any duplicate services.';
    }
    ids.add(service.id);
    if (typeof service.title !== 'string' || !service.title.trim() || service.title.length > MAX_SERVICE_TITLE_LENGTH) {
      return `Enter a name for every service (up to ${MAX_SERVICE_TITLE_LENGTH} characters).`;
    }
    if (typeof service.description !== 'string' || !service.description.trim() ||
      service.description.length > MAX_SERVICE_DESCRIPTION_LENGTH) {
      return `Enter a short description for every service (up to ${MAX_SERVICE_DESCRIPTION_LENGTH} characters).`;
    }
    if (!SERVICE_ICONS.includes(service.icon)) return 'Please check the service details.';
    if (service.image !== null && (typeof service.image !== 'string' || service.image.length > 1000 ||
      !/^https:\/\/res\.cloudinary\.com\/dgxsmxiax\/image\/upload\/[A-Za-z0-9_./-]+$/.test(service.image) &&
      !/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/site-photos\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/.test(service.image))) {
      return 'Please choose a valid photo for each service.';
    }
  }
  return '';
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

export function moveService(services, id, direction) {
  return movePhoto(services, id, direction);
}

export function removePhoto(content, section, key) {
  if (section === 'gallery') content.gallery = content.gallery.filter(photo => photo.id !== key);
  else if (section === 'services') {
    const service = content.services.find(item => item.id === key);
    if (service) service.image = null;
  }
  else content[section] = null;
}
