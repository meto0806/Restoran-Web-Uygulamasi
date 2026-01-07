===================================================================
PROJE ADI: WEB TABANLI RESTORAN YÖNETİM SİSTEMİ
===================================================================

-------------------------------------------------------------------
1. PROJE HAKKINDA
-------------------------------------------------------------------
Bu proje, Node.js ve MSSQL kullanılarak geliştirilmiş Full-Stack bir
restoran yönetim sistemidir. Tüm gerekli kütüphaneler
dosya içerisine dahildir, ekstra kuruluma gerek yoktur.

-------------------------------------------------------------------
2. SİSTEM GEREKSİNİMLERİ (Bilgisayarda yüklü olması gereken programlar)
-------------------------------------------------------------------
1. Node.js 
2. Microsoft SQL Server

-------------------------------------------------------------------
3. KURULUM VE ÇALIŞTIRMA (ÇOK KISA)
-------------------------------------------------------------------
Gerekli paketler yüklü olduğu için internete ihtiyaç yoktur. (internetsiz çalıştırıldığında sayfalarda iconlar yüklenmeyebilir.)
Sadece veritabanı ayarını yapıp başlatmanız yeterlidir.

ADIM 1: VERİTABANI AYARI
   1. SQL Server'da "UserDB" adında boş bir veritabanı oluşturun.
   2. Klasördeki "server.js" dosyasını açın (VS Code ile).
   3. Baş taraftaki "dbConfig" ayarlarını kendi bilgisayarınıza göre düzenleyin:                
                                                                                                
      const config = {                                                                          
          user: 'SİZİN_SQL_KULLANICI_ADINIZ',                                                   
          password: 'SİZİN_SQL_ŞİFRENİZ',                                                       
          server: 'BİLGİSAYAR_ADINIZ\\SQLEXPRESS',                                              
          database: 'UserDB',                                                                   
          ...                                                                                   
      };                                                                                        
                                                                                               
ADIM 2: BAŞLATMA
   1. Proje klasörünün içine girin.
   2. Terminali açın.
   3. Şu komutu yazın:  node server.js

      
   "Sunucu 3000 portunda çalışıyor..." yazısını görünce tarayıcıdan
   http://localhost:3000 adresine gidin.

-------------------------------------------------------------------
4. GİRİŞ BİLGİLERİ
-------------------------------------------------------------------
* Sistem ilk açılışta veritabanı tablolarını otomatik oluşturur.
* Admin paneline girmek için site üzerinden kayıt olup, veritabanından
  (Users tablosu) ilgili kullanıcıya "is_admin = 1" yetkisi verilmelidir.

-------------------------------------------------------------------
KULLANILAN TEKNOLOJİLER
-------------------------------------------------------------------
Backend: Node.js, Express.js
Veri   : MSSQL, Multer (Dosya Yönetimi)
Güvenlik: Bcrypt (Şifreleme), Express-Session
Frontend: HTML5, CSS3, JS
