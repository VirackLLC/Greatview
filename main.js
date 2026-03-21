/**
 * Main Logic for Greatview Hardscape
 * Lead generation focus with 5 Core Services and Portfolio Management
 */

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
        const response = await fetch('data.json');
        const data = await response.json();
        renderServices(data.services);
        renderGallery(data.gallery);
    } catch (error) {

        renderServices(getFallbackServices());
        renderGallery(getFallbackGallery());
    }


    const modalForm = document.getElementById('modal-quote-form');
    modalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = modalForm.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = 'PROCESSING...';
        btn.disabled = true;


        setTimeout(() => {
            document.getElementById('form-container').classList.add('hidden');
            document.getElementById('success-message').classList.remove('hidden');
            modalForm.reset();
            btn.innerText = originalText;
            btn.disabled = false;
            lucide.createIcons();
        }, 1200);
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
    
    services.forEach(s => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-stone-200 group';
        card.innerHTML = `
            <div class="h-64 overflow-hidden">
                <img src="${s.image}" alt="${s.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
            </div>
            <div class="p-8">
                <div class="flex justify-between items-start mb-4">
                    <h4 class="text-2xl font-serif text-charcoal">${s.title}</h4>
                    <i data-lucide="${s.icon}" class="w-6 h-6 text-copper"></i>
                </div>
                <p class="text-stone-500 text-sm leading-relaxed mb-6">${s.description}</p>
                <button onclick="openModal()" class="text-xs font-bold uppercase tracking-widest text-copper border-b-2 border-copper/20 hover:border-copper transition-all pb-1">Inquire Now</button>
            </div>
        `;
        grid.appendChild(card);
    });
    lucide.createIcons();
}

function renderGallery(items) {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;
    grid.innerHTML = '';

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'gallery-item overflow-hidden rounded-lg cursor-pointer bg-stone-800 aspect-square group relative';
        div.innerHTML = `
            <img src="${item.url}" alt="${item.title}" class="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:opacity-60">
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <i data-lucide="maximize" class="text-white w-6 h-6"></i>
            </div>
        `;
        div.onclick = () => openLightbox(item.url);
        grid.appendChild(div);
    });
    lucide.createIcons();
}

window.openLightbox = function(url) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = url;
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    gsap.fromTo(img, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 });
};

window.closeLightbox = function() {
    const lb = document.getElementById('lightbox');
    lb.style.display = 'none';
    document.body.style.overflow = 'auto';
};

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
            description: "Comprehensive 3D blueprints and end-to-end builds. We turn your backyard vision into a custom-crafted luxury living space."
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
