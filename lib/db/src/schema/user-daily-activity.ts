import { pgTable, serial, integer, varchar, timestamp, date, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Kullanıcının günlük modül bazlı aktif kullanım süresi.
 *
 * Heartbeat sistemi her 60 saniyede bir bu tabloya 1 dakika ekler. Modül,
 * kullanıcının o an bulunduğu sayfadan parse edilir (örn. /student/pronunciation-coach
 * → 'pronunciation'). Aynı user_id × date × module kombinasyonu için UPSERT yapılır.
 *
 * İdeal kullanım: admin analytics dashboard'da günlük/haftalık trend grafikleri,
 * modül bazlı dağılım pie chart, en aktif kullanıcı listesi.
 */
export const userDailyActivityTable = pgTable(
  "user_daily_activity",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    date: date("date").notNull(), // YYYY-MM-DD format
    module: varchar("module", { length: 50 }).notNull().default("general"),
    minutes: integer("minutes").notNull().default(0),
    lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  },
  (t) => ({
    // Bir kullanıcının bir günde bir modüldeki süresi tek satır
    uniq: uniqueIndex("user_daily_activity_unique").on(t.userId, t.date, t.module),
    // Hızlı tarih sorgusu için
    dateIdx: index("user_daily_activity_date_idx").on(t.date),
    // Kullanıcı bazlı sorgu için
    userIdx: index("user_daily_activity_user_idx").on(t.userId, t.date),
  }),
);

export type UserDailyActivity = typeof userDailyActivityTable.$inferSelect;
export type InsertUserDailyActivity = typeof userDailyActivityTable.$inferInsert;
