-- schema.sql — بلدية شطايبي
-- Run ALTER TABLE statements on existing DB to add new columns

-- جدول الأخبار (إضافة album_urls)
CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'official',
    content TEXT NOT NULL,
    image_url TEXT DEFAULT '',
    album_urls TEXT DEFAULT '[]',
    date TEXT NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    custom_label TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- جدول الخدمات
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL,
    required_docs TEXT DEFAULT '',
    pdf_link TEXT DEFAULT '',
    color TEXT DEFAULT 'blue',
    icon TEXT DEFAULT 'file-text'
);

-- جدول الأرشيف
CREATE TABLE IF NOT EXISTS archives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_old_url TEXT DEFAULT '',
    image_new_url TEXT DEFAULT ''
);

-- جدول السياحة (إضافة album_urls و details)
CREATE TABLE IF NOT EXISTS tourism (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    album_urls TEXT DEFAULT '[]',
    rating TEXT DEFAULT '4.5',
    distance_info TEXT DEFAULT '',
    badge_text TEXT DEFAULT '',
    badge_color TEXT DEFAULT 'emerald'
);

-- جدول الشواطئ (إضافة album_urls)
CREATE TABLE IF NOT EXISTS beaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    album_urls TEXT DEFAULT '[]',
    is_supervised INTEGER DEFAULT 1,
    season TEXT DEFAULT 'صيف'
);

-- جدول الرؤساء
CREATE TABLE IF NOT EXISTS mayors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    period TEXT NOT NULL,
    image_url TEXT DEFAULT ''
);

-- ======== ALTER TABLE للقواعد الموجودة ========
-- تشغّل هذه فقط إذا كانت القاعدة موجودة مسبقاً
-- ALTER TABLE news ADD COLUMN album_urls TEXT DEFAULT '[]';
-- ALTER TABLE tourism ADD COLUMN album_urls TEXT DEFAULT '[]';
-- ALTER TABLE beaches ADD COLUMN album_urls TEXT DEFAULT '[]';
