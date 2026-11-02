const { test } = require('node:test');
const assert = require('node:assert/strict');
const data = require('../data.json');
const load = () => import('../shared/content.mjs');

test('migration preserves every existing photo, defaults the service area, and leaves the license empty', async () => {
  const { initialContent, ORIGINAL_HERO, ORIGINAL_FEATURED } = await load();
  const content = initialContent(data);
  assert.equal(content.hero, ORIGINAL_HERO);
  assert.equal(content.featured, ORIGINAL_FEATURED);
  assert.deepEqual(content.services, data.services.map(service => service.image));
  assert.deepEqual(content.gallery.map(photo => photo.url), data.gallery.map(photo => photo.url));
  assert.deepEqual(content.serviceArea, data.serviceArea);
  assert.deepEqual(content.license, { businessName: '', number: '', verificationUrl: '' });
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
test('deletions remove gallery items and clear image slots, not empty URLs', async () => {
  const { initialContent, removePhoto } = await load();
  const content = initialContent(data);
  removePhoto(content, 'gallery', 'original-1');
  removePhoto(content, 'services', 0);
  removePhoto(content, 'hero');
  removePhoto(content, 'featured');
  assert.equal(content.gallery.length, 9);
  assert.equal(content.services[0], null);
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
