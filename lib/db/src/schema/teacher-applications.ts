import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Pazarlama sitesindeki "Eğitmen Ol" formundan gelen başvurular.
 *
 * Form alanları formun ekran görüntüsündeki LWS-benzeri yapıyı izler:
 * isim, telefon, email, doğum tarihi, milliyet, lokasyon, tecrübe, eğitim,
 * İngilizce seviyesi, sertifikalar (çoklu seçim), referans, CV (PDF).
 *
 * Admin /admin/teacher-applications sayfasından inceler, status değiştirir,
 * CV'yi indirir, notunu ekler.
 */
export const teacherApplicationsTable = pgTable(
  "teacher_applications",
  {
    id: serial("id").primaryKey(),

    // ── Kişisel bilgiler ──
    fullName: varchar("full_name", { length: 200 }).notNull(),
    email: varchar("email", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    // YYYY-MM-DD formatında — text olarak tut (timezone karışıklığı yaşanmasın)
    birthDate: varchar("birth_date", { length: 12 }).notNull(),
    nationality: varchar("nationality", { length: 100 }).notNull(),
    location: varchar("location", { length: 200 }).notNull(),

    // ── Profesyonel bilgiler (enum benzeri free-text — admin esnek olsun) ──
    experience: varchar("experience", { length: 50 }).notNull(),    // "0", "1-2", "3-4", "5+"
    education: varchar("education", { length: 50 }).notNull(),      // "univ", "ms", "phd", "student"
    englishLevel: varchar("english_level", { length: 30 }).notNull(),// "beginner", "elementary", "intermediate", "advanced"
    certifications: text("certifications"),                          // JSON array string: ["IELTS","CELTA"]

    // PostgreSQL'de "references" reserved keyword (foreign key syntax). Kolon
    // adını references_text yapıyoruz; CREATE/INSERT/SELECT'de syntax hatası olmasın.
    referencesText: text("references_text"),

    // ── CV (bytea — max 5MB validation backend'de) ──
    // cvContent kolonu DB seviyesinde BYTEA — drizzle ORM ile select/insert
    // YAPMIYORUZ (raw SQL kullanıyoruz `db.execute(sql\`...\`)`), bu yüzden
    // schema tarafında tip tanımına ihtiyaç yok. customType'tan kaçınarak
    // sürüm uyumluluğu artırılır.
    cvFilename: varchar("cv_filename", { length: 300 }),
    cvMimeType: varchar("cv_mime_type", { length: 100 }),
    cvSizeBytes: integer("cv_size_bytes"),

    // ── Admin tarafı ──
    // pending | reviewing | accepted | rejected | archived
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    adminNotes: text("admin_notes"),
    reviewedBy: integer("reviewed_by"),    // admin user id
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    // KVKK onayı (zorunlu, form gönderirken kabul edilmiş olmalı)
    kvkkAcceptedAt: timestamp("kvkk_accepted_at", { withTimezone: true }).notNull().defaultNow(),

    // Form meta
    submitterIp: varchar("submitter_ip", { length: 64 }),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("teacher_apps_status_idx").on(t.status, t.createdAt),
    emailIdx: index("teacher_apps_email_idx").on(t.email),
  }),
);

export type TeacherApplication = typeof teacherApplicationsTable.$inferSelect;
export type NewTeacherApplication = typeof teacherApplicationsTable.$inferInsert;
