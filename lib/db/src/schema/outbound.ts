import {
  pgTable, serial, text, timestamp, integer, boolean, jsonb, index, uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * B2B Outbound sistemi — R7
 *
 * Kampanya + sequence + e-posta gönderim + tracking + Calendly meeting.
 * outreach_leads tablosuyla entegre (lead_id referansı).
 */

// ─── E-POSTA ŞABLONLARI ─────────────────────────────────────────────────
export const outboundTemplatesTable = pgTable(
  "outbound_templates",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(), // "Cold Intro - B2B HR"
    subject: text("subject").notNull(), // "{{firstName}}, İngilizce eğitiminizi 2 katına..."
    bodyHtml: text("body_html").notNull(),
    bodyText: text("body_text").notNull(), // plain-text fallback
    segment: text("segment"), // b2b_hr, b2b_sme, b2c_pro, partner — null=all
    variables: jsonb("variables"), // {firstName, company, ...} available list
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by"), // admin user_id
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({ segmentIdx: index("outbound_templates_segment_idx").on(t.segment) }),
);

// ─── KAMPANYALAR ────────────────────────────────────────────────────────
export const outboundCampaignsTable = pgTable(
  "outbound_campaigns",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(), // "Q4 B2B HR Push"
    description: text("description"),
    segment: text("segment", { enum: ["b2b_hr", "b2b_sme", "b2c_pro", "partner"] }).notNull(),

    // Hedefleme
    targetCriteria: jsonb("target_criteria"), // { seniority: ["c-level","senior"], industry: [...], hasVerifiedEmail: true }

    // Sequence — steps ile ilişkili
    // Kampanya çalıştığında lead'in stepInProgress'i takip edilir

    // Durum
    status: text("status", { enum: ["draft", "active", "paused", "completed"] })
      .notNull().default("draft"),

    // Gönderim ayarları
    fromName: text("from_name").notNull(), // "Hakan - Sphere English"
    fromEmail: text("from_email").notNull(), // "hakan@sphereenglish.com"
    replyToEmail: text("reply_to_email"),
    dailySendLimit: integer("daily_send_limit").notNull().default(50),
    sendOnlyBusinessHours: boolean("send_only_business_hours").notNull().default(true),
    timezone: text("timezone").notNull().default("Europe/Istanbul"),

    // Sayaçlar
    totalRecipients: integer("total_recipients").notNull().default(0),
    emailsSent: integer("emails_sent").notNull().default(0),
    emailsOpened: integer("emails_opened").notNull().default(0),
    emailsClicked: integer("emails_clicked").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    bookings: integer("bookings").notNull().default(0),
    bounces: integer("bounces").notNull().default(0),
    unsubscribes: integer("unsubscribes").notNull().default(0),

    createdBy: integer("created_by"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("outbound_campaigns_status_idx").on(t.status),
    segmentIdx: index("outbound_campaigns_segment_idx").on(t.segment),
  }),
);

// ─── SEQUENCE STEPS ─────────────────────────────────────────────────────
export const outboundSequenceStepsTable = pgTable(
  "outbound_sequence_steps",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").notNull(), // FK outbound_campaigns.id
    stepOrder: integer("step_order").notNull(), // 1, 2, 3...
    templateId: integer("template_id").notNull(), // FK outbound_templates.id
    delayDays: integer("delay_days").notNull().default(0), // önceki step'ten kaç gün sonra
    condition: text("condition"), // "no_reply" | "no_open" | "always"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    campaignIdx: index("outbound_seq_steps_campaign_idx").on(t.campaignId),
  }),
);

// ─── KAMPANYA-LEAD İLİŞKİSİ (Bireysel gönderim durumu) ────────────────
export const outboundCampaignLeadsTable = pgTable(
  "outbound_campaign_leads",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").notNull(),
    leadId: integer("lead_id").notNull(), // FK outreach_leads.id
    currentStep: integer("current_step").notNull().default(0), // hangi step'te (0 = başlamadı)
    status: text("status", {
      enum: ["pending", "in_progress", "replied", "bounced", "unsubscribed", "completed", "blocked"],
    }).notNull().default("pending"),
    nextSendAt: timestamp("next_send_at"), // sonraki step ne zaman gönderilecek
    lastEventAt: timestamp("last_event_at"),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (t) => ({
    campaignLeadUnique: uniqueIndex("outbound_camp_lead_unique").on(t.campaignId, t.leadId),
    statusIdx: index("outbound_camp_lead_status_idx").on(t.status),
    nextSendIdx: index("outbound_camp_lead_next_send_idx").on(t.nextSendAt),
  }),
);

// ─── E-POSTA OLAYLARI (send/open/click/reply/bounce/unsub) ─────────────
export const outboundEmailEventsTable = pgTable(
  "outbound_email_events",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").notNull(),
    leadId: integer("lead_id").notNull(),
    stepId: integer("step_id"), // FK outbound_sequence_steps.id — hangi step'e ait
    templateId: integer("template_id"),

    eventType: text("event_type", {
      enum: ["sent", "delivered", "opened", "clicked", "replied", "bounced", "unsubscribed", "spam"],
    }).notNull(),

    // Provider metadata
    providerMessageId: text("provider_message_id"), // SendGrid/Postmark message_id
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    clickUrl: text("click_url"), // clicked event için
    bounceReason: text("bounce_reason"),

    rawData: jsonb("raw_data"),
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  },
  (t) => ({
    campaignLeadIdx: index("outbound_events_camp_lead_idx").on(t.campaignId, t.leadId),
    typeIdx: index("outbound_events_type_idx").on(t.eventType),
    occurredIdx: index("outbound_events_occurred_idx").on(t.occurredAt),
  }),
);

// ─── CALENDLY MEETINGS ──────────────────────────────────────────────────
export const outboundMeetingsTable = pgTable(
  "outbound_meetings",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id"), // FK outreach_leads.id — nullable (manuel meeting olabilir)
    campaignId: integer("campaign_id"), // hangi kampanyadan geldi

    // Calendly detayları
    calendlyEventUri: text("calendly_event_uri").notNull(), // unique event URI
    calendlyInviteeUri: text("calendly_invitee_uri"),
    calendlyEventType: text("calendly_event_type"), // "demo", "discovery"

    // Toplantı bilgisi
    inviteeName: text("invitee_name"),
    inviteeEmail: text("invitee_email").notNull(),
    inviteeCompany: text("invitee_company"),
    inviteePhone: text("invitee_phone"),

    scheduledAt: timestamp("scheduled_at").notNull(),
    durationMinutes: integer("duration_minutes"),
    meetingUrl: text("meeting_url"), // Google Meet / Zoom link
    location: text("location"),

    // Anketten gelen custom sorular
    questionsAnswers: jsonb("questions_answers"),

    // Sonuç
    status: text("status", { enum: ["scheduled", "completed", "no_show", "cancelled"] })
      .notNull().default("scheduled"),
    outcome: text("outcome"), // "qualified", "not_fit", "customer", "follow_up"
    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    calendlyUnique: uniqueIndex("outbound_meetings_calendly_unique").on(t.calendlyEventUri),
    leadIdx: index("outbound_meetings_lead_idx").on(t.leadId),
    scheduledIdx: index("outbound_meetings_scheduled_idx").on(t.scheduledAt),
  }),
);

// ─── TYPES ──────────────────────────────────────────────────────────────
export type OutboundTemplate = typeof outboundTemplatesTable.$inferSelect;
export type InsertOutboundTemplate = typeof outboundTemplatesTable.$inferInsert;
export type OutboundCampaign = typeof outboundCampaignsTable.$inferSelect;
export type InsertOutboundCampaign = typeof outboundCampaignsTable.$inferInsert;
export type OutboundSequenceStep = typeof outboundSequenceStepsTable.$inferSelect;
export type OutboundCampaignLead = typeof outboundCampaignLeadsTable.$inferSelect;
export type OutboundEmailEvent = typeof outboundEmailEventsTable.$inferSelect;
export type OutboundMeeting = typeof outboundMeetingsTable.$inferSelect;

export const CAMPAIGN_STATUS_LABELS = {
  draft: "Taslak",
  active: "Aktif",
  paused: "Duraklatıldı",
  completed: "Tamamlandı",
} as const;

export const CAMPAIGN_LEAD_STATUS_LABELS = {
  pending: "Bekliyor",
  in_progress: "Gönderiliyor",
  replied: "Cevap Verdi",
  bounced: "Bounce",
  unsubscribed: "Çıktı",
  completed: "Tamamlandı",
  blocked: "Bloklandı",
} as const;
