import {
  pgTable, serial, text, timestamp, integer, varchar, jsonb, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * support_tickets — kullanıcı bildirimleri.
 *
 *   kind: bug | feature | question | other
 *   status: open | in_progress | resolved | closed
 *   severity: low | normal | high | critical
 *   userId null → anonim (login olmayan kullanıcı; mümkünse yok, ama şema esnek)
 *   metadata: userAgent, url, deviceInfo gibi otomatik toplanan context
 */
export const supportTicketsTable = pgTable(
  "support_tickets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    assignedToId: integer("assigned_to_id").references(() => usersTable.id, { onDelete: "set null" }),

    kind: varchar("kind", { length: 20 }).notNull().default("bug"),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    severity: varchar("severity", { length: 20 }).notNull().default("normal"),

    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),

    /** URL, userAgent, viewport, platform (web|mobile), deviceInfo, screenshot URL vb. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => ({
    userIdx: index("support_tickets_user_idx").on(t.userId),
    statusIdx: index("support_tickets_status_idx").on(t.status),
    kindIdx: index("support_tickets_kind_idx").on(t.kind),
    severityIdx: index("support_tickets_severity_idx").on(t.severity),
    createdIdx: index("support_tickets_created_idx").on(t.createdAt),
  }),
);

/**
 * support_ticket_messages — ticket thread'i.
 *
 * authorId null → sistem mesajı (otomatik status değişikliği notu vb.)
 * isInternal: admin kendi aralarında not — kullanıcıya gösterilmez
 */
export const supportTicketMessagesTable = pgTable(
  "support_ticket_messages",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => supportTicketsTable.id, { onDelete: "cascade" }),
    authorId: integer("author_id").references(() => usersTable.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    /** Admin'in sadece kendi aralarında gördüğü not */
    isInternal: integer("is_internal").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    ticketIdx: index("support_ticket_messages_ticket_idx").on(t.ticketId),
  }),
);
