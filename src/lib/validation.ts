import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a contact number")
    .max(30)
    .regex(/^[+()\d\s-]+$/, "Please enter a valid phone number"),
  note: z.string().trim().max(600).optional().nullable(),
});

export const createBookingSchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  start: z.string().datetime({ offset: true }),
  addonIds: z.array(z.string().uuid()).max(4).default([]),
  customer: customerSchema,
  marketingConsent: z.boolean().default(false),
  policyAccepted: z.literal(true, { errorMap: () => ({ message: "Please accept the booking policy" }) }),
  idempotencyKey: z.string().min(8).max(120),
});

export type CreateBookingPayload = z.infer<typeof createBookingSchema>;

export const statusUpdateSchema = z.object({
  status: z.enum(["confirmed", "cancelled", "completed", "no_show"]),
  reason: z.string().trim().max(300).optional(),
});

export const rescheduleSchema = z.object({
  start: z.string().datetime({ offset: true }),
  staffId: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export const storefrontSaveSchema = z.object({
  config: z.record(z.unknown()),
});

export const agentRunSchema = z.object({
  task: z.enum(["marketing_campaign", "storefront_copy", "business_question", "schedule_review"]),
  prompt: z.string().trim().min(3).max(1200),
});

export const approvalSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional(),
});

export const mediaUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(8 * 1024 * 1024),
});
