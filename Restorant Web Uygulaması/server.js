const express = require('express');
const path = require('path');
const sql = require('mssql'); 
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer'); 
const fs = require('fs'); 

const app = express();
const port = 3000;

// ==========================================
// 1. GENEL AYARLAR
// ==========================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Oturum (Session) ayarları
app.use(session({
    secret: 'gizli-anahtar-123', 
    resave: false, saveUninitialized: false,
    cookie: { secure: false, httpOnly: true } 
}));

// ==========================================
// 2. DOSYA YÜKLEME (RESİM) AYARLARI
// ==========================================
const uploadDir = path.join(__dirname, 'fotolar');
if (!fs.existsSync(uploadDir)){ fs.mkdirSync(uploadDir); }

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, 'fotolar/') },
    filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname) }
});
const upload = multer({ storage: storage });

// ==========================================
// 3. STATİK DOSYALAR (CSS, JS, Resimler)
// ==========================================
// Klasörleri dışarıya açıyoruz ki tarayıcı erişebilsin
app.use('/giris-kayit', express.static(path.join(__dirname, 'giris-kayit')));
app.use('/fotolar', express.static(path.join(__dirname, 'fotolar')));
app.use('/homepage', express.static(path.join(__dirname, 'homepage')));
app.use('/sistemler', express.static(path.join(__dirname, 'sistemler')));
app.use('/deneme', express.static(path.join(__dirname, 'deneme')));
app.use('/data', express.static(path.join(__dirname, 'data'))); 

// ==========================================
// 4. SAYFA ROTALARI (HTML Dosyaları)
// ==========================================
// Anasayfa ve Kullanıcı Sayfaları
app.get('/', (req, res) => { res.redirect('/homepage/homepage.html'); });
app.get('/menu.html', (req, res) => { res.sendFile(path.join(__dirname, 'sistemler', 'menu.html')); });
app.get('/style.css', (req, res) => { res.sendFile(path.join(__dirname, 'deneme', 'style.css')); });
app.get('/profil.html', (req, res) => { res.sendFile(path.join(__dirname, 'sistemler', 'profil.html')); });
app.get('/iletisim.html', (req, res) => { res.sendFile(path.join(__dirname, 'sistemler', 'iletisim.html')); });
app.get('/rezervasyon.html', (req, res) => { res.sendFile(path.join(__dirname, 'rezervasyon.html')); });

// --- ADMIN KORUMASI (Middleware) ---
// Admin olmayanları giriş sayfasına atar
const checkAdmin = (req, res, next) => {
    if (!req.session.user || (req.session.user.is_admin !== true && req.session.user.is_admin !== 1)) {
        return res.redirect('/giris-kayit/index.html');
    }
    next();
};

// Admin Sayfaları
app.get('/admin/adminpanel.html', checkAdmin, (req, res) => { res.sendFile(path.join(__dirname, 'admin', 'adminpanel.html')); });
app.get('/admin/admin-products.html', checkAdmin, (req, res) => { res.sendFile(path.join(__dirname, 'admin', 'admin-products.html')); });
app.get('/admin/admin-orders.html', checkAdmin, (req, res) => { res.sendFile(path.join(__dirname, 'admin', 'admin-orders.html')); });
app.get('/admin/admin-customers.html', checkAdmin, (req, res) => { res.sendFile(path.join(__dirname, 'admin', 'admin-customers.html')); });
app.get('/admin/admin-messages.html', checkAdmin, (req, res) => { res.sendFile(path.join(__dirname, 'admin', 'admin-messages.html')); });
app.get('/admin/admin-settings.html', checkAdmin, (req, res) => { res.sendFile(path.join(__dirname, 'admin', 'admin-settings.html')); });
app.get('/admin/admin-reservations.html', checkAdmin, (req, res) => { res.sendFile(path.join(__dirname, 'admin', 'admin-reservations.html')); });

// YENİ EKLENDİ: Log Sayfası Rotası
app.get('/admin/admin-logs.html', checkAdmin, (req, res) => { res.sendFile(path.join(__dirname, 'admin', 'admin-logs.html')); });


// ==========================================
// 5. VERİTABANI BAĞLANTISI VE BAŞLATMA
// ==========================================
const config = {
  server: 'server adınız',
  database: 'veritabanı',
  user: 'kulanıcı adı',
  password: 'şifre!',
  options: { trustedConnection: false, enableArithAbort: true, trustServerCertificate: true }
};

// --- LOGLAMA FONKSİYONU (Yardımcı Fonksiyon) ---
// Bu fonksiyonu her kritik işlemde çağıracağız
async function logAdminAction(req, actionType, description) {
    try {
        if (!req.session.user) return; // Kullanıcı yoksa kaydetme
        const adminId = req.session.user.id;
        // IP adresini al (Güvenlik için)
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        
        const r = new sql.Request();
        r.input('aid', adminId);
        r.input('type', actionType);
        r.input('desc', description);
        r.input('ip', ip);
        
        await r.query("INSERT INTO AdminLogs (admin_id, action_type, description, ip_address) VALUES (@aid, @type, @desc, @ip)");
    } catch (e) {
        console.error("Loglama hatası:", e);
    }
}

async function startApp() {
  try {
    await sql.connect(config);
    console.log('SQL Server Bağlandı.');
    
    // 1. Ürünler Tablosu (home_section sütunu yoksa ekle)
    try { await sql.query(`IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Products' AND COLUMN_NAME = 'home_section') ALTER TABLE Products ADD home_section NVARCHAR(20) DEFAULT 'none'`); } catch(e) {}

    // 2. Rezervasyon Tablosu (Yoksa oluştur)
    try {
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Reservations' AND xtype='U')
            CREATE TABLE Reservations (
                id INT PRIMARY KEY IDENTITY(1,1),
                user_id INT NULL,
                name NVARCHAR(100),
                phone NVARCHAR(20),
                reservation_date DATE,
                reservation_time NVARCHAR(10),
                guests INT,
                notes NVARCHAR(MAX),
                created_at DATETIME DEFAULT GETDATE(),
                status NVARCHAR(50) DEFAULT 'Bekliyor'
            )
        `);
        await sql.query(`IF COL_LENGTH('Reservations', 'user_id') IS NULL ALTER TABLE Reservations ADD user_id INT NULL`);
    } catch(e) {}

    // 3. Site Ayarları (Varsayılan ayarları ekle)
    const checkSet = await sql.query('SELECT COUNT(*) as count FROM SiteSettings');
    if(checkSet.recordset[0].count === 0) { 
        await sql.query(`INSERT INTO SiteSettings (setting_key, setting_value) VALUES ('site_title', 'Meto Restorant'), ('contact_phone', '+90 555 123 45 67'), ('shop_is_open', 'true')`); 
    }

    // 4. Mesajlar Tablosu
    try {
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Messages' AND xtype='U')
            CREATE TABLE Messages (
                id INT PRIMARY KEY IDENTITY(1,1),
                name NVARCHAR(100),
                email NVARCHAR(100),
                phone NVARCHAR(20),
                subject NVARCHAR(150),
                message NVARCHAR(MAX),
                created_at DATETIME DEFAULT GETDATE()
            )
        `);
    } catch(e) { console.error("Tablo hatası:", e); }

    // 5. YENİ EKLENDİ: Admin Log Tablosu
    try {
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AdminLogs' AND xtype='U')
            CREATE TABLE AdminLogs (
                id INT PRIMARY KEY IDENTITY(1,1),
                admin_id INT,
                action_type NVARCHAR(50),
                description NVARCHAR(MAX),
                ip_address NVARCHAR(50),
                created_at DATETIME DEFAULT GETDATE()
            )
        `);
        console.log('Log tablosu hazır.');
    } catch(e) { console.error("Log Tablosu Hatası:", e); }

    app.listen(port, () => { console.log(`Sunucu Başlatıldı: http://localhost:${port}`); });
  } catch (err) { console.error('DB Hatası:', err); }
}


// ==========================================
// 6. KULLANICI API'LERİ
// ==========================================

// Profil Güncelleme
app.post('/api/update-profile', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { name, surname, phone, email } = req.body;
    try {
        const r = new sql.Request();
        r.input('n', name).input('s', surname).input('p', phone).input('e', email).input('id', req.session.user.id);
        await r.query("UPDATE users SET name=@n, surname=@s, phone=@p, email=@e WHERE id=@id");
        req.session.user.name = name; req.session.user.surname = surname; req.session.user.phone = phone; req.session.user.email = email;
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Şifre Değiştirme
app.post('/api/change-password', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { currentPassword, newPassword } = req.body;
    try {
        const r = new sql.Request(); r.input('id', req.session.user.id);
        const userResult = await r.query("SELECT password FROM users WHERE id=@id");
        if (userResult.recordset.length === 0) return res.json({ success: false, message: 'Kullanıcı yok' });
        const match = await bcrypt.compare(currentPassword, userResult.recordset[0].password);
        if (!match) return res.json({ success: false, message: 'Mevcut şifre yanlış!' });
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await new sql.Request().input('p', hashedPassword).input('id', req.session.user.id).query("UPDATE users SET password=@p WHERE id=@id");
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Adres İşlemleri
app.get('/api/get-addresses', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    try {
        const r = new sql.Request(); r.input('u', req.session.user.id);
        const result = await r.query("SELECT * FROM Addresses WHERE user_id = @u AND is_deleted = 0 ORDER BY id DESC");
        res.json({ success: true, addresses: result.recordset });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/add-address', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { title, city, district, address_text } = req.body;
    try {
        const r = new sql.Request();
        r.input('u', req.session.user.id).input('t', title).input('c', city).input('d', district).input('a', address_text);
        await r.query("INSERT INTO Addresses (user_id, title, city, district, address_text, is_deleted, created_at) VALUES (@u, @t, @c, @d, @a, 0, GETDATE())");
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/update-address', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { id, title, city, district, address_text } = req.body;
    try {
        const r = new sql.Request();
        r.input('id', id).input('u', req.session.user.id).input('t', title).input('c', city).input('d', district).input('a', address_text);
        await r.query("UPDATE Addresses SET title=@t, city=@c, district=@d, address_text=@a WHERE id=@id AND user_id=@u");
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/delete-address', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    try {
        const r = new sql.Request(); r.input('id', req.body.id).input('u', req.session.user.id);
        await r.query("UPDATE Addresses SET is_deleted = 1 WHERE id = @id AND user_id = @u");
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// ==========================================
// 7. SİPARİŞ İŞLEMLERİ (KULLANICI)
// ==========================================
app.get('/api/my-orders', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const r = new sql.Request(); r.input('u', req.session.user.id);
    const resDb = await r.query("SELECT * FROM Orders WHERE user_id=@u ORDER BY created_at DESC");
    res.json({ success: true, orders: resDb.recordset });
});

app.post('/api/create-order', async (req, res) => {
    const { address_id, payment_method, cart, total_amount } = req.body;
    const r = new sql.Request();
    r.input('u', req.session.user.id).input('a', address_id).input('t', total_amount).input('p', payment_method);
    const oid = (await r.query("INSERT INTO Orders (user_id, address_id, total_amount, payment_method) VALUES (@u, @a, @t, @p); SELECT SCOPE_IDENTITY() as id")).recordset[0].id;
    for (let i of cart){
        const ir = new sql.Request();
        ir.input('o', oid).input('n', i.ad).input('q', i.adet).input('p', i.fiyat);
        await ir.query("INSERT INTO OrderItems (order_id, product_name, quantity, price) VALUES (@o, @n, @q, @p)");
    }
    res.json({ success: true });
});

// Sipariş Detay
app.post('/api/get-order-details', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    try {
        const r = new sql.Request(); r.input('id', req.body.orderId);
        const result = await r.query("SELECT *, product_name as name FROM OrderItems WHERE order_id = @id");
        res.json({ success: true, items: result.recordset });
    } catch (e) { res.status(500).json({ success: false }); }
});

// ==========================================
// 8. ADMIN API'LERİ (GÜNCELLENMİŞ)
// ==========================================

// --- LOGLARI GETİRME API'Sİ (YENİ) ---
app.get('/api/admin/logs', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    try {
        // Logları, yapan yöneticinin isimiyle beraber çekiyoruz
        const result = await sql.query(`
            SELECT l.*, u.name, u.surname, u.email 
            FROM AdminLogs l 
            LEFT JOIN users u ON l.admin_id = u.id 
            ORDER BY l.created_at DESC
        `);
        res.json({ success: true, logs: result.recordset });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Sipariş Listesi
app.get('/api/admin/orders', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    try {
        const r = await sql.query(`SELECT o.id, o.total_amount, o.status, o.payment_method, o.created_at, o.address_id, u.name, u.surname, u.phone, u.email, a.city, a.district, a.title as address_title, a.address_text as open_address FROM Orders o LEFT JOIN users u ON o.user_id = u.id LEFT JOIN Addresses a ON o.address_id = a.id ORDER BY o.created_at DESC`);
        res.json({ success: true, orders: r.recordset });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/update-order-status', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    try {
        const r = new sql.Request(); r.input('id', req.body.orderId); r.input('s', req.body.status);
        await r.query("UPDATE Orders SET status = @s WHERE id = @id");
        
        // LOGLA (Opsiyonel: Sipariş durum değişimi)
        logAdminAction(req, 'Sipariş Güncelleme', `Sipariş #${req.body.orderId} durumu '${req.body.status}' olarak değiştirildi.`);

        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Müşteri Listesi
app.get('/api/admin/customers', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    try {
        const r = await sql.query(`SELECT u.id, u.name, u.surname, u.email, u.phone, u.is_admin, (SELECT COUNT(*) FROM Orders WHERE user_id = u.id) as order_count FROM users u ORDER BY u.id DESC`);
        res.json({ success: true, customers: r.recordset });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/delete-customer', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    try {
        const r = new sql.Request(); r.input('id', req.body.id);
        await r.query("DELETE FROM users WHERE id = @id");
        
        // LOGLA: Müşteri silindi
        logAdminAction(req, 'Müşteri Silme', `Kullanıcı ID: ${req.body.id} silindi.`);

        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Ürün Yönetimi
app.get('/api/admin/products', async (req, res) => {
    const r = await sql.query("SELECT p.*, c.name as category_name FROM Products p LEFT JOIN Categories c ON p.category_id = c.id ORDER BY p.id DESC");
    res.json({ success: true, products: r.recordset });
});

app.post('/api/admin/add-product', upload.single('image'), async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    const { name, description, price, category_id, home_section } = req.body;
    const img = req.file ? '/fotolar/' + req.file.filename : '/fotolar/default.png';
    try {
        const r = new sql.Request();
        r.input('n', name); r.input('d', description); r.input('p', price); r.input('c', category_id); r.input('i', img); r.input('h', home_section || 'none');
        await r.query("INSERT INTO Products (name, description, price, category_id, image_url, home_section) VALUES (@n, @d, @p, @c, @i, @h)");
        
        // LOGLA: Ürün eklendi
        logAdminAction(req, 'Ürün Ekleme', `Ürün eklendi: ${name}`);

        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/update-product', upload.single('image'), async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    const { id, name, description, price, category_id, existing_image, home_section } = req.body;
    const img = req.file ? '/fotolar/' + req.file.filename : existing_image;
    try {
        const r = new sql.Request();
        r.input('id', id); r.input('n', name); r.input('d', description); r.input('p', price); r.input('c', category_id); r.input('i', img); r.input('h', home_section || 'none');
        await r.query("UPDATE Products SET name=@n, description=@d, price=@p, category_id=@c, image_url=@i, home_section=@h WHERE id=@id");
        
        // LOGLA: Ürün güncellendi
        logAdminAction(req, 'Ürün Güncelleme', `Ürün güncellendi ID: ${id}`);
        
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/delete-product', async (req, res) => {
    await new sql.Request().input('i', req.body.id).query("DELETE FROM Products WHERE id=@i");
    
    // LOGLA: Ürün silindi
    logAdminAction(req, 'Ürün Silme', `Ürün silindi ID: ${req.body.id}`);
    
    res.json({ success: true });
});

app.post('/api/admin/toggle-product-status', async (req, res) => {
    await new sql.Request().input('i', req.body.id).input('a', req.body.is_active).query("UPDATE Products SET is_active=@a WHERE id=@i");
    res.json({ success: true });
});

// --- ADMIN REZERVASYON YÖNETİMİ ---
app.get('/api/admin/reservations', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    try {
        const r = await sql.query("SELECT * FROM Reservations ORDER BY reservation_date DESC, reservation_time DESC");
        res.json({ success: true, reservations: r.recordset });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/update-reservation-status', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    try {
        const r = new sql.Request();
        r.input('id', req.body.id).input('s', req.body.status);
        await r.query("UPDATE Reservations SET status = @s WHERE id = @id");
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/delete-reservation', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    try {
        const r = new sql.Request();
        r.input('id', req.body.id);
        await r.query("DELETE FROM Reservations WHERE id = @id");
        
        // LOGLA
        logAdminAction(req, 'Rezervasyon Silme', `Rezervasyon silindi ID: ${req.body.id}`);

        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Kategori Yönetimi
app.get('/api/categories', async (req, res) => {
    const r = await sql.query('SELECT * FROM Categories ORDER BY sort_order');
    res.json({ success: true, categories: r.recordset });
});
app.post('/api/categories', upload.none(), async (req, res) => {
    await new sql.Request().input('n', req.body.name).input('s', req.body.sort_order).query("INSERT INTO Categories (name, sort_order) VALUES (@n, @s)");
    res.json({ success: true });
});
app.delete('/api/categories/:id', async (req, res) => {
    const c = await new sql.Request().input('i', req.params.id).query("SELECT COUNT(*) as count FROM Products WHERE category_id=@i");
    if(c.recordset[0].count > 0) return res.json({ success: false, message: 'Ürün var' });
    await new sql.Request().input('i', req.params.id).query("DELETE FROM Categories WHERE id=@i");
    res.json({ success: true });
});
app.put('/api/categories/:id', upload.none(), async (req, res) => {
    await new sql.Request().input('i', req.params.id).input('n', req.body.name).input('s', req.body.sort_order).query("UPDATE Categories SET name=@n, sort_order=@s WHERE id=@i");
    res.json({ success: true });
});

// Mesajlar
app.get('/api/admin/messages', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    const r = await sql.query("SELECT * FROM Messages ORDER BY created_at DESC");
    res.json({ success: true, messages: r.recordset });
});
app.post('/api/admin/delete-message', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    await new sql.Request().input('i', sql.Int, req.body.id).query("DELETE FROM Messages WHERE id=@i");
    res.json({ success: true });
});

// --- REZERVASYON İŞLEMLERİ (KULLANICI TARAFI) ---
app.post('/api/make-reservation', async (req, res) => {
    const { name, phone, date, time, guests, notes } = req.body;
    const userId = req.session.user ? req.session.user.id : null;
    try {
        const r = new sql.Request();
        r.input('n', name).input('p', phone).input('d', date).input('t', time).input('g', guests).input('no', notes).input('u', userId);
        await r.query("INSERT INTO Reservations (user_id, name, phone, reservation_date, reservation_time, guests, notes) VALUES (@u, @n, @p, @d, @t, @g, @no)");
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/my-reservations', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    try {
        const r = new sql.Request();
        r.input('u', req.session.user.id);
        const result = await r.query("SELECT * FROM Reservations WHERE user_id = @u ORDER BY reservation_date DESC, reservation_time DESC");
        res.json({ success: true, reservations: result.recordset });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/cancel-reservation', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Giriş yapmalısınız.' });
    const { id } = req.body;
    try {
        const r = new sql.Request();
        r.input('id', id).input('u', req.session.user.id);
        const check = await r.query("SELECT * FROM Reservations WHERE id = @id AND user_id = @u");
        if (check.recordset.length === 0) return res.json({ success: false, message: 'Rezervasyon bulunamadı veya size ait değil.' });
        await r.query("UPDATE Reservations SET status = 'İptal Edildi' WHERE id = @id");
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: 'Sunucu hatası.' }); }
});

// --- ADMIN AYAR GÜNCELLEME (LOGLU) ---
app.post('/api/admin/update-settings', upload.fields([
    { name: 'favicon', maxCount: 1 }, 
    { name: 'about_image', maxCount: 1 },
    { name: 'rev_1_img', maxCount: 1 },
    { name: 'rev_2_img', maxCount: 1 },
    { name: 'rev_3_img', maxCount: 1 }
]), async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    
    const { site_title, contact_phone, contact_email, contact_address, contact_map_url, delete_favicon, shop_is_open, about_title, about_text, rev_1_name, rev_1_text, rev_2_name, rev_2_text, rev_3_name, rev_3_text, social_facebook, social_twitter, social_instagram } = req.body;
    
    try {
        const updates = [
            { key: 'site_title', val: site_title }, 
            { key: 'contact_phone', val: contact_phone }, 
            { key: 'contact_email', val: contact_email }, 
            { key: 'contact_address', val: contact_address },
            { key: 'contact_map_url', val: contact_map_url }, 
            { key: 'shop_is_open', val: shop_is_open }, 
            { key: 'about_title', val: about_title },
            { key: 'about_text', val: about_text },
            { key: 'rev_1_name', val: rev_1_name }, { key: 'rev_1_text', val: rev_1_text },
            { key: 'rev_2_name', val: rev_2_name }, { key: 'rev_2_text', val: rev_2_text },
            { key: 'rev_3_name', val: rev_3_name }, { key: 'rev_3_text', val: rev_3_text },
            { key: 'social_facebook', val: social_facebook },
            { key: 'social_twitter', val: social_twitter },
            { key: 'social_instagram', val: social_instagram }
        ];

        for (const item of updates) {
            if (item.val === undefined) continue; 
            const check = await new sql.Request().input('key', item.key).query(`SELECT COUNT(*) as count FROM SiteSettings WHERE setting_key = @key`);
            const reqUpd = new sql.Request().input('val', sql.NVarChar(sql.MAX), item.val).input('key', item.key);
            if (check.recordset[0].count === 0) await reqUpd.query(`INSERT INTO SiteSettings (setting_key, setting_value) VALUES (@key, @val)`);
            else await reqUpd.query(`UPDATE SiteSettings SET setting_value = @val WHERE setting_key = @key`);
        }

        const imageUpdates = [
            { field: 'favicon', key: 'site_favicon' },
            { field: 'about_image', key: 'about_image' },
            { field: 'rev_1_img', key: 'rev_1_img' },
            { field: 'rev_2_img', key: 'rev_2_img' },
            { field: 'rev_3_img', key: 'rev_3_img' }
        ];

        for (const img of imageUpdates) {
            if (req.files[img.field]) {
                const p = '/fotolar/' + req.files[img.field][0].filename;
                const r = new sql.Request().input('v', p);
                const c = await sql.query(`SELECT COUNT(*) as count FROM SiteSettings WHERE setting_key = '${img.key}'`);
                if (c.recordset[0].count === 0) await r.query(`INSERT INTO SiteSettings (setting_key, setting_value) VALUES ('${img.key}', @v)`);
                else await r.query(`UPDATE SiteSettings SET setting_value = @v WHERE setting_key = '${img.key}'`);
            }
        }

        if (delete_favicon === 'true') await sql.query("UPDATE SiteSettings SET setting_value = '/fotolar/logo.png' WHERE setting_key = 'site_favicon'");
        
        // LOGLA: Ayarlar güncellendi
        logAdminAction(req, 'Ayar Güncelleme', 'Site genel ayarları güncellendi.');

        res.json({ success: true });
    } catch (e) { console.error("Ayarlar Hatası:", e); res.status(500).json({ success: false }); }
});

// Dashboard
app.get('/api/admin/dashboard-stats', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    const range = req.query.range || 'all';
    let dateFilter = "", chartQuerySQL = "";
    switch (range) {
        case 'daily': dateFilter = "AND created_at >= CAST(GETDATE() AS DATE)"; chartQuerySQL = `SELECT FORMAT(created_at, 'HH:00') as day_label, SUM(total_amount) as daily_total FROM Orders WHERE created_at >= CAST(GETDATE() AS DATE) GROUP BY DATEPART(hour, created_at), FORMAT(created_at, 'HH:00') ORDER BY DATEPART(hour, created_at)`; break;
        case 'weekly': dateFilter = "AND created_at >= DATEADD(day, -7, GETDATE())"; chartQuerySQL = `SELECT FORMAT(created_at, 'dd.MM') as day_label, SUM(total_amount) as daily_total FROM Orders WHERE created_at >= DATEADD(day, -7, GETDATE()) GROUP BY FORMAT(created_at, 'dd.MM') ORDER BY MIN(created_at)`; break;
        case 'monthly': dateFilter = "AND created_at >= DATEADD(day, -30, GETDATE())"; chartQuerySQL = `SELECT FORMAT(created_at, 'dd.MM') as day_label, SUM(total_amount) as daily_total FROM Orders WHERE created_at >= DATEADD(day, -30, GETDATE()) GROUP BY FORMAT(created_at, 'dd.MM') ORDER BY MIN(created_at)`; break;
        case 'yearly': dateFilter = "AND created_at >= DATEADD(year, -1, GETDATE())"; chartQuerySQL = `SELECT FORMAT(created_at, 'MM.yyyy') as day_label, SUM(total_amount) as daily_total FROM Orders WHERE created_at >= DATEADD(year, -1, GETDATE()) GROUP BY FORMAT(created_at, 'MM.yyyy'), DATEPART(month, created_at) ORDER BY MIN(created_at)`; break;
        default: dateFilter = ""; chartQuerySQL = `SELECT FORMAT(created_at, 'MM.yyyy') as day_label, SUM(total_amount) as daily_total FROM Orders GROUP BY FORMAT(created_at, 'MM.yyyy'), DATEPART(year, created_at), DATEPART(month, created_at) ORDER BY MIN(created_at)`; break;
    }
    try {
        const statsQuery = await sql.query(`SELECT (SELECT COUNT(*) FROM Orders WHERE 1=1 ${dateFilter}) as total_orders, (SELECT ISNULL(SUM(total_amount),0) FROM Orders WHERE 1=1 ${dateFilter}) as total_revenue, (SELECT COUNT(*) FROM users) as total_users, (SELECT COUNT(*) FROM Orders WHERE status IN ('Hazırlanıyor', 'Onay Bekliyor', 'Yolda')) as active_orders`);
        const recentOrdersQuery = await sql.query(`SELECT TOP 5 o.id, u.name, u.surname, o.total_amount, o.status, o.created_at FROM Orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC`);
        const chartResult = await sql.query(chartQuerySQL);
        res.json({ success: true, stats: statsQuery.recordset[0], recentOrders: recentOrdersQuery.recordset, chartData: chartResult.recordset });
    } catch (e) { res.status(500).json({ success: false }); }
});

// --- Müşteriyi Admin Yap / Adminliği Al (LOGLU) ---
app.post('/api/admin/toggle-admin-role', async (req, res) => {
    if (!req.session.user?.is_admin) return res.status(403).json({ success: false });
    
    const { id, make_admin } = req.body; 
    const newValue = make_admin ? 1 : 0;

    try {
        const r = new sql.Request();
        r.input('id', id);
        r.input('val', newValue);
        await r.query("UPDATE users SET is_admin = @val WHERE id = @id");
        
        // LOGLA: Yetki değişimi
        const islem = make_admin ? "Yönetici Yapıldı" : "Yöneticilik Alındı";
        logAdminAction(req, 'Yetki Değişimi', `Kullanıcı ID: ${id} - ${islem}`);

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Veritabanı hatası' });
    }
});

// Genel Public API'ler
app.get('/api/public/settings', async (req, res) => { try { const r = await sql.query('SELECT * FROM SiteSettings'); const s = {}; r.recordset.forEach(row => { s[row.setting_key] = row.setting_value; }); res.json({ success: true, settings: s }); } catch(e) { res.status(500).json({ success: false }); } });
app.get('/api/shop-status', async (req, res) => { try { const r = await sql.query("SELECT setting_value FROM SiteSettings WHERE setting_key='shop_is_open'"); res.json({ isOpen: r.recordset[0]?.setting_value === 'true' }); } catch(e) { res.json({ isOpen: true }); } });
app.get('/api/menu-products', async (req, res) => { try { const r = await sql.query("SELECT p.*, c.name as category_name FROM Products p LEFT JOIN Categories c ON p.category_id = c.id WHERE p.is_active=1 ORDER BY c.sort_order, p.id DESC"); res.json({ success: true, products: r.recordset }); } catch (e) { res.status(500).json({ success: false }); } });
app.get('/api/admin/export-orders', async (req, res) => { if (!req.session.user?.is_admin) return res.status(403).send("Yetkisiz"); const r = await sql.query("SELECT * FROM Orders"); let c = "ID,Tutar\n"; r.recordset.forEach(x => c += `${x.id},${x.total_amount}\n`); res.attachment('Orders.csv').send(c); });
app.get('/api/admin/settings', async (req, res) => { try { const r = await sql.query('SELECT * FROM SiteSettings'); const s = {}; r.recordset.forEach(row => { s[row.setting_key] = row.setting_value; }); res.json({ success: true, settings: s }); } catch(e) { res.json({ success: false }); } });
app.post('/api/send-message', async (req, res) => { const { name, email, phone, subject, message } = req.body; const r = new sql.Request(); r.input('n', name).input('e', email).input('p', phone).input('s', subject).input('m', message); await r.query("INSERT INTO Messages (name,email,phone,subject,message) VALUES (@n,@e,@p,@s,@m)"); res.json({ success: true }); });

// --- GİRİŞ / ÇIKIŞ ---
app.post('/login', async (req, res) => { const r = new sql.Request().input('i', req.body.identifier); const u = (await r.query("SELECT * FROM users WHERE email=@i OR phone=@i")).recordset[0]; if(u && await bcrypt.compare(req.body.password, u.password)) { req.session.user = { id: u.id, username: u.name, email: u.email, name: u.name, surname: u.surname, phone: u.phone, is_admin: u.is_admin }; res.json({ success: true, redirectUrl: u.is_admin ? '/admin/adminpanel.html' : '/' }); } else { res.status(400).json({ success: false }); } });
app.get('/api/check-auth', (req, res) => { if(req.session.user) res.json({ success: true, user: req.session.user }); else res.json({ success: false }); });
app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

// Uygulamayı Başlat
startApp();