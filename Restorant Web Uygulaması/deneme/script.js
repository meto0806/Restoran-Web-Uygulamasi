/* =========================================================
   GLOBAL SCRIPTS (TÜM SAYFALAR İÇİN ORTAK AYARLAR)
   ========================================================= */

console.log("Script dosyası devrede.");

document.addEventListener('DOMContentLoaded', () => {
    loadGlobalSettings();   // Favicon ve Site Ayarlarını Yükle
    updateAdminProfile();   // Admin Panelindeyse Profil Bilgilerini Yükle
});

// --- 1. SİTE AYARLARI (FAVICON & SOSYAL MEDYA) ---
async function loadGlobalSettings() {
    try {
        const response = await fetch('/api/admin/settings');
        const data = await response.json();

        if (data.success && data.settings) {
            const s = data.settings;

            // A) FAVICON AYARLA (?v=tarih ekleyerek önbelleği kırar)
            if (s.site_favicon) {
                let link = document.querySelector("link[rel~='icon']");
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.head.appendChild(link);
                }
                link.href = s.site_favicon + '?v=' + new Date().getTime();
            }

            // B) SOSYAL MEDYA LİNKLERİ (Footer için)
            if (s.social_instagram) {
                const instaBtn = document.querySelector('a i.fa-instagram');
                if(instaBtn && instaBtn.parentElement) {
                    instaBtn.parentElement.href = s.social_instagram;
                    instaBtn.parentElement.target = "_blank";
                }
            }
            if (s.social_facebook) {
                const faceBtn = document.querySelector('a i.fa-facebook');
                if(faceBtn && faceBtn.parentElement) {
                    faceBtn.parentElement.href = s.social_facebook;
                    faceBtn.parentElement.target = "_blank";
                }
            }
        }
    } catch (error) {
        console.error("Ayarlar yüklenemedi:", error);
    }
}

// --- 2. ADMIN PROFİL BİLGİLERİ ---
async function updateAdminProfile() {
    const imgEl = document.getElementById('admin-avatar');
    const nameEl = document.getElementById('admin-name');
    const roleEl = document.getElementById('admin-role');

    if (!imgEl || !nameEl) return;

    try {
        const res = await fetch('/api/check-auth');
        const data = await res.json();

        if (data.success && data.user) {
            const u = data.user;
            const fullName = (u.name && u.surname) ? `${u.name} ${u.surname}` : u.username;
            
            nameEl.innerText = fullName;
            if(roleEl) roleEl.innerText = u.email;

            // Otomatik Profil Resmi
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff&bold=true&size=128`;
            imgEl.src = avatarUrl;
        }
    } catch (err) {
        console.error("Profil yüklenemedi:", err);
    }
}