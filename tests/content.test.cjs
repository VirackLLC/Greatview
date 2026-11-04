const { test } = require('node:test');
const assert = require('node:assert/strict');
const data = require('../data.json');
const load = () => import('../shared/content.mjs');

test('migration preserves every existing photo, defaults the service area, and leaves the license empty', async () => {
  const { initialContent, ORIGINAL_HERO, ORIGINAL_FEATURED } = await load();
  const content = initialContent(data);
  assert.equal(content.hero, ORIGINAL_HERO);
  assert.equal(content.featured, ORIGINAL_FEATURED);
  assert.deepEqual(content.services.map(service => service.image), data.services.map(service => service.image));
  assert.deepEqual(content.services.map(service => service.photos.map(photo => photo.url)), data.services.map(service => [service.image]));
  assert.ok(content.services.every(service => service.coverPhotoId === service.photos[0].id));
  assert.deepEqual(content.services.map(service => service.title), data.services.map(service => service.title));
  assert.deepEqual(content.services.map(service => service.description), data.services.map(service => service.description));
  assert.deepEqual(content.gallery.map(photo => photo.url), data.gallery.map(photo => photo.url));
  assert.deepEqual(content.serviceArea, data.serviceArea);
  assert.deepEqual(content.license, { businessName: '', number: '', verificationUrl: '' });
});
test('legacy photo-only service data upgrades without losing existing names or images', async () => {
  const { normalizeServices } = await load();
  const migrated = normalizeServices(data.services.map(service => service.image), data.services);
  assert.deepEqual(migrated.map(service => service.title), data.services.map(service => service.title));
  assert.deepEqual(migrated.map(service => service.image), data.services.map(service => service.image));
  assert.deepEqual(migrated.map(service => service.photos[0]?.url), data.services.map(service => service.image));
  assert.ok(migrated.every(service => service.id && service.description && service.icon));
});
test('service validation allows growth but rejects unsafe or incomplete records', async () => {
  const { initialContent, validateServices, moveService, MAX_SERVICES } = await load();
  const services = initialContent(data).services;
  assert.equal(validateServices(services), '');
  services.push({ id: 'service-new', title: 'Outdoor Kitchens', description: 'Built for Arizona evenings.', icon: 'grid', image: null, photos: [], coverPhotoId: null });
  assert.equal(validateServices(services), '');
  assert.equal(moveService(services, 'service-new', -1), true);
  assert.equal(services.at(-2).id, 'service-new');
  assert.ok(validateServices([{ ...services[0], title: ' ' }]));
  assert.ok(validateServices([{ ...services[0], description: '  ' }]));
  assert.ok(validateServices([{ ...services[0], id: 'bad id' }]));
  assert.ok(validateServices(Array.from({ length: MAX_SERVICES + 1 }, (_, i) => ({
    id: `service-${i}`, title: `Service ${i}`, description: '', icon: 'grid', image: null, photos: [], coverPhotoId: null
  }))));
});
test('service albums preserve their photos, captions, cover, order, and remove safely', async () => {
  const { initialContent, validateServices, moveServicePhoto, setServiceCover, removeServicePhoto } = await load();
  const service = initialContent(data).services[0];
  const originalPhoto = structuredClone(service.photos[0]);
  service.photos.push({ id: 'second-photo', url: data.services[1].image, caption: 'Finished paver patio' });
  assert.equal(validateServices([service]), '');
  assert.equal(moveServicePhoto(service, 'second-photo', -1), true);
  assert.equal(service.photos[0].id, 'second-photo');
  assert.equal(setServiceCover(service, 'second-photo'), true);
  assert.equal(service.image, data.services[1].image);
  assert.equal(validateServices([service]), '');
  assert.equal(removeServicePhoto(service, 'second-photo'), true);
  assert.equal(service.coverPhotoId, originalPhoto.id);
  assert.equal(service.image, originalPhoto.url);
  assert.equal(validateServices([service]), '');
  assert.equal(removeServicePhoto(service, 'missing-photo'), false);
  assert.ok(validateServices([{ ...service, coverPhotoId: 'not-in-album' }]));
  assert.ok(validateServices([{ ...service, photos: [{ ...originalPhoto, caption: 'c'.repeat(161) }] }]));
});
test('service albums accept more than 20 photos while enforcing safe URLs and unique IDs', async () => {
  const { initialContent, validateServices } = await load();
  const service = initialContent(data).services[0];
  const original = service.photos[0];
  assert.ok(validateServices([{ ...service, photos: [{ ...original, url: 'https://evil.test/photo.webp' }] }]));
  assert.ok(validateServices([{ ...service, photos: [original, { ...original }] }]));
  const photos = Array.from({ length: 1500 }, (_, index) => ({
    ...original, id: `album-photo-${index}`
  }));
  assert.equal(validateServices([{ ...service, photos, coverPhotoId: photos[0].id }]), '');
});
test('service-area validation rejects blank, oversized, and duplicate entries', async () => {
  const { validateServiceArea } = await load();
  assert.equal(validateServiceArea(data.serviceArea), '');
  assert.equal(validateServiceArea({ region: 'Phoenix', cities: [] }), '');
  assert.ok(validateServiceArea({ region: ' ', cities: [] }));
  assert.ok(validateServiceArea({ region: 'Phoenix', cities: ['Mesa', ' mesa '] }));
  assert.ok(validateServiceArea({ region: 'Phoenix', cities: ['x'.repeat(81)] }));
  assert.ok(validateServiceArea({ region: 'x'.repeat(101), cities: [] }));
});
test('gallery moves preserve identity, order, and boundaries', async () => {
  const { movePhoto, initialContent } = await load();
  const { gallery } = initialContent(data);
  assert.equal(movePhoto(gallery, 'original-1', -1), false);
  assert.equal(movePhoto(gallery, 'original-1', 1), true);
  assert.equal(gallery[1].id, 'original-1');
  assert.equal(movePhoto(gallery, 'unknown', 1), false);
  assert.equal(movePhoto(gallery, 'original-10', 1), false);
});
test('photo deletion clears service albums without removing the service itself', async () => {
  const { initialContent, removePhoto } = await load();
  const content = initialContent(data);
  removePhoto(content, 'gallery', 'original-1');
  removePhoto(content, 'services', content.services[0].id);
  removePhoto(content, 'hero');
  removePhoto(content, 'featured');
  assert.equal(content.gallery.length, 9);
  assert.equal(content.services[0].image, null);
  assert.deepEqual(content.services[0].photos, []);
  assert.equal(content.services[0].coverPhotoId, null);
  assert.equal(content.services.length, 5);
  assert.equal(content.hero, null);
  assert.equal(content.featured, null);
});
test('ROC validation accepts blank settings and preserves leading zeros', async () => {
  const { validateLicense } = await load();
  assert.equal(validateLicense({ businessName: '', number: '', verificationUrl: '' }), '');
  assert.equal(validateLicense({ businessName: 'Test business', number: '001234', verificationUrl: 'https://roc.az.gov/contractor-search' }), '');
  assert.equal(validateLicense({ businessName: 'Test business', number: '001234', verificationUrl: 'https://azroc.my.site.com/AZRoc/s/contractor-search' }), '');
  for (const number of ['1234', 'ROC 123456', '1234567', '<script>', '']) {
    assert.ok(validateLicense({ businessName: 'Test business', number, verificationUrl: '' }));
  }
  assert.ok(validateLicense({ businessName: '', number: '001234', verificationUrl: '' }));
});
test('verification links reject misleading domains, credentials, ports, and scripts', async () => {
  const { isOfficialROCLink } = await load();
  for (const url of ['javascript:alert(1)', 'https://roc.az.gov.evil.test', 'https://evil.test/roc.az.gov', 'https://user@roc.az.gov', 'http://roc.az.gov', 'https://roc.az.gov:444', 'https://other.my.site.com']) {
    assert.equal(isOfficialROCLink(url), false, url);
  }
});
