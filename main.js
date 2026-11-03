/**
 * Main Logic for Greatview Hardscape
 * Lead generation focus with 5 Core Services and Portfolio Management
 */
import { loadSiteContent } from './site-content.js';
import { SERVICE_ICONS, normalizeServices } from './shared/content.mjs';

let lightboxItems = [];
let lightboxIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    gsap.registerPlugin(ScrollTrigger);


    gsap.to('.hero-reveal', {
        opacity: 1,
        y: 0,
        duration: 1.2,
        ease: 'power3.out',
        delay: 0.1
    });


    const stickyCta = document.getElementById('sticky-cta');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            stickyCta.classList.remove('translate-y-24', 'opacity-0');
            stickyCta.classList.add('translate-y-0', 'opacity-100');
        } else {
            stickyCta.classList.add('translate-y-24', 'opacity-0');
        }
    });


    try {
        const response = await fetch('data.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Website data could not be loaded');
        const data = await loadSiteContent(await response.json());
        renderServices(data.services);
        renderServiceOptions(data.services);
        renderGallery(data.gallery);
    } catch (error) {

        const services = normalizeServices(getFallbackServices(), getFallbackServices());
        renderServices(services);
        renderServiceOptions(services);
        renderGallery(getFallbackGallery());
    }


const modalForm = document.getElementById('modal-quote-form');

modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = modalForm.querySelector('button');
    const originalText = btn.innerText;

    btn.innerText = 'PROCESSING...';
    btn.disabled = true;

    const formData = {
        name: modalForm.querySelector('input[placeholder="Your Name"]').value,
        phone: modalForm.querySelector('input[placeholder="Phone Number"]').value,
        email: modalForm.querySelector('input[placeholder="Email Address"]').value,
        service: modalForm.querySelector('select').value,
        message: modalForm.querySelector('textarea').value
    };

    try {
        const res = await fetch('/api/quote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('form-container').classList.add('hidden');
            document.getElementById('success-message').classList.remove('hidden');
            modalForm.reset();
        } else {
            alert(data.error || 'Something went wrong.');
        }

    } catch (err) {
        alert('Network error.');
    }

    btn.innerText = originalText;
    btn.disabled = false;
});


    gsap.utils.toArray('.reveal-left, .reveal-right, .section-header').forEach(el => {
        gsap.to(el, {
            scrollTrigger: {
                trigger: el,
                start: 'top 85%',
            },
            opacity: 1,
            x: 0,
            y: 0,
            duration: 1,
            ease: 'power2.out'
        });
    });
});

function renderServices(services) {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const section = document.getElementById('services');
    if (section) section.hidden = services.length === 0;
    document.querySelectorAll('a[href="#services"]').forEach(link => { link.hidden = services.length === 0; });

    services.forEach(s => {
        const card = document.createElement('article');
        card.className = 'service-public-card bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-stone-200 group';
        const photos = servicePhotos(s);
        const openAlbum = () => openServiceGallery(s);
        const imageButton = document.createElement('button');
        imageButton.type = 'button';
        imageButton.className = 'service-public-image-button';
        imageButton.setAttribute('aria-label', `Explore ${s.title} project photos`);
        imageButton.addEventListener('click', openAlbum);
        if (s.image) {
            const image = new Image();
            image.src = s.image; image.alt = `${s.title} project`; image.loading = 'lazy';
            image.className = 'service-public-image';
            imageButton.append(image);
        } else {
            const placeholder = document.createElement('span');
            placeholder.className = 'service-public-image-empty';
            placeholder.textContent = 'Project photos';
            imageButton.append(placeholder);
        }
        const details = document.createElement('div');
        details.className = 'service-public-details p-8';
        const heading = document.createElement('div');
        heading.className = 'flex justify-between items-start mb-4';
        const title = document.createElement('h4');
        const titleButton = document.createElement('button');
        titleButton.type = 'button';
        titleButton.className = 'service-public-title text-2xl font-serif text-charcoal';
        titleButton.textContent = s.title;
        titleButton.setAttribute('aria-label', `Explore ${s.title} project photos`);
        titleButton.addEventListener('click', openAlbum);
        title.append(titleButton);
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', SERVICE_ICONS.includes(s.icon) ? s.icon : 'grid');
        icon.className = 'w-6 h-6 text-copper';
        heading.append(title, icon);
        const description = document.createElement('p');
        description.className = 'text-stone-500 text-sm leading-relaxed mb-6';
        description.textContent = s.description;
        const actions = document.createElement('div');
        actions.className = 'service-public-actions';
        const gallery = document.createElement('button');
        gallery.type = 'button';
        gallery.className = 'service-public-gallery-link';
        gallery.textContent = photos.length
            ? `View ${photos.length} project ${photos.length === 1 ? 'photo' : 'photos'}`
            : 'Explore this service';
        gallery.addEventListener('click', openAlbum);
        const inquire = document.createElement('button');
        inquire.type = 'button';
        inquire.className = 'text-xs font-bold uppercase tracking-widest text-copper border-b-2 border-copper/20 hover:border-copper transition-all pb-1';
        inquire.textContent = 'Inquire Now';
        inquire.addEventListener('click', () => window.openModal());
        actions.append(gallery, inquire);
        details.append(heading, description, actions);
        card.append(imageButton, details);
        grid.appendChild(card);
    });
    lucide.createIcons();
}

function servicePhotos(service) {
    if (Array.isArray(service.photos)) return service.photos;
    return service.image ? [{ id: 'cover-photo', url: service.image, caption: '' }] : [];
}

function openServiceGallery(service) {
    const dialog = document.getElementById('service-gallery-dialog');
    const grid = document.getElementById('service-gallery-grid');
    const photos = servicePhotos(service);
    document.getElementById('service-gallery-title').textContent = `${service.title} Projects`;
    document.getElementById('service-gallery-description').textContent = service.description;
    grid.replaceChildren();
    if (!photos.length) {
        const empty = document.createElement('p');
        empty.className = 'service-gallery-empty';
        empty.textContent = 'Project photos are coming soon. Contact us to talk about this service.';
        grid.append(empty);
    } else {
        photos.forEach((photo, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'service-gallery-photo';
            const image = new Image();
            image.src = photo.url;
            image.alt = photo.caption || `${service.title} project ${index + 1}`;
            image.loading = 'lazy';
            const caption = document.createElement('span');
            caption.textContent = photo.caption || `Project ${index + 1}`;
            button.append(image, caption);
            button.addEventListener('click', () => openLightbox(photos, index));
            grid.append(button);
        });
    }
    if (!dialog.open) dialog.showModal();
}

function renderServiceOptions(services) {
    const select = document.querySelector('#modal-quote-form select');
    if (!select) return;
    select.replaceChildren();
    if (!services.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No services available yet';
        option.disabled = true;
        option.selected = true;
        select.append(option);
        select.disabled = true;
        return;
    }
    select.disabled = false;
    for (const service of services) {
        const option = document.createElement('option');
        option.value = service.title;
        option.textContent = service.title;
        select.append(option);
    }
}

function renderGallery(items) {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;
    grid.innerHTML = '';

    items.forEach((item, index) => {
        const div = document.createElement('button');
        div.type = 'button';
        div.className = 'gallery-item overflow-hidden rounded-lg cursor-pointer bg-stone-800 aspect-square group relative';
        div.setAttribute('aria-label', `View ${item.title || `project photo ${index + 1}`} full size`);
        const image = new Image();
        image.src = item.url; image.alt = item.title; image.loading = 'lazy';
        image.className = 'w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:opacity-60';
        const zoom = document.createElement('span');
        zoom.className = 'gallery-zoom-icon';
        zoom.setAttribute('aria-hidden', 'true');
        zoom.innerHTML = '<i data-lucide="maximize" class="text-white w-6 h-6"></i>';
        div.append(image, zoom);
        div.addEventListener('click', () => openLightbox(items, index));
        grid.appendChild(div);
    });
    lucide.createIcons();
}

function updateLightbox() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = item.url;
    img.alt = item.caption || item.title || `Project photo ${lightboxIndex + 1}`;
    document.getElementById('lightbox-caption').textContent = item.caption || item.title || '';
    document.getElementById('lightbox-count').textContent = lightboxItems.length > 1
        ? `${lightboxIndex + 1} of ${lightboxItems.length}`
        : '';
    document.getElementById('lightbox-prev').hidden = lightboxItems.length < 2;
    document.getElementById('lightbox-next').hidden = lightboxItems.length < 2;
    if (lb.open) {
        gsap.fromTo(img, { scale: 0.97, opacity: 0.7 }, { scale: 1, opacity: 1, duration: 0.2 });
    }
}

window.openLightbox = function(items, index = 0) {
    const lb = document.getElementById('lightbox');
    lightboxItems = Array.isArray(items) ? items : [{ url: items, title: 'Project photo', caption: '' }];
    lightboxIndex = Math.max(0, Math.min(index, lightboxItems.length - 1));
    updateLightbox();
    if (!lb.open) lb.showModal();
};

window.closeLightbox = function() {
    const lb = document.getElementById('lightbox');
    if (lb.open) lb.close();
};

document.getElementById('close-service-gallery').addEventListener('click', () => {
    document.getElementById('service-gallery-dialog').close();
});
for (const [id, direction] of [['lightbox-prev', -1], ['lightbox-next', 1]]) {
    document.getElementById(id).addEventListener('click', () => {
        if (lightboxItems.length < 2) return;
        lightboxIndex = (lightboxIndex + direction + lightboxItems.length) % lightboxItems.length;
        updateLightbox();
    });
}
document.getElementById('lightbox-close').addEventListener('click', window.closeLightbox);
document.getElementById('lightbox').addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' && lightboxItems.length > 1) {
        event.preventDefault();
        lightboxIndex = (lightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
        updateLightbox();
    } else if (event.key === 'ArrowRight' && lightboxItems.length > 1) {
        event.preventDefault();
        lightboxIndex = (lightboxIndex + 1) % lightboxItems.length;
        updateLightbox();
    }
});
document.getElementById('service-gallery-dialog').addEventListener('click', event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
});
document.getElementById('lightbox').addEventListener('click', event => {
    if (event.target === event.currentTarget) window.closeLightbox();
});

function getFallbackServices() {
    return [
        {
            title: "Pavers",
            icon: "grid",
            image: "https://r2-bucket.flowith.net/f/a278782335dffd8f/586458427_122113877895012245_2767165309102723694_n.jpg",
            description: "Precision-laid stone and brick pavers for driveways, walkways, and patios. Designed to withstand Phoenix heat while adding timeless value."
        },
        {
            title: "Artificial Turf",
            icon: "sprout",
            image: "https://r2-bucket.flowith.net/f/a017fddb66dbc203/559247616_122107584597012245_8187667375546942289_n.jpg",
            description: "High-grade synthetic grass that stays lush and green year-round without the maintenance or water costs. Perfect for families and pets."
        },
        {
            title: "Gravel",
            icon: "mountain",
            image: "https://r2-bucket.flowith.net/f/5a498135cbe6bcc4/586638354_122113878093012245_3861257617622704747_n.jpg",
            description: "Professional desert-scaping using premium Arizona river rock and decorative gravel. Clean, modern, and efficient xeriscaping."
        },
        {
            title: "Irrigation",
            icon: "droplets",
            image: "https://r2-bucket.flowith.net/f/5e5c0e6271c2e18d/image0.jpeg",
            description: "State-of-the-art drip systems and smart timers. We ensure your desert plants thrive while minimizing water waste."
        },
        {
            title: "Custom Designs",
            icon: "pen-tool",
            image: "https://r2-bucket.flowith.net/f/9f8fc9e0aef57e75/d6a5be2ce50ee4074fc4febcb4a067cb.jpg",
            description: "Custom outdoor living spaces built from start to finish. We create functional, clean backyard environments designed for everyday living."
        }
    ];
}

function getFallbackGallery() {
    return [
        { url: "https://r2-bucket.flowith.net/f/f8be9ee56cd17ed1/ac23cded8570c19a68cc3b88d13b6245.jpg", title: "Project Alpha" },
        { url: "https://r2-bucket.flowith.net/f/9f8fc9e0aef57e75/d6a5be2ce50ee4074fc4febcb4a067cb.jpg", title: "Project Beta" },
        { url: "https://r2-bucket.flowith.net/f/75cd91d416b39239/2d6e3b1dbb5674adc751738d03d98414.jpg", title: "Project Gamma" },
        { url: "https://r2-bucket.flowith.net/f/5e5c0e6271c2e18d/image0.jpeg", title: "Project Delta" },
        { url: "https://r2-bucket.flowith.net/f/5a498135cbe6bcc4/586638354_122113878093012245_3861257617622704747_n.jpg", title: "Project Epsilon" }
    ];
}
