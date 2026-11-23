import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/shared/db/client";

export type LeadStage = "new" | "contacted" | "replied" | "qualified" | "won" | "lost";
export type LeadQualification = "unreviewed" | "fit" | "not_fit";
export type Lead = {
  id: number;
  name: string;
  company: string | null;
  contact: string | null;
  source: string | null;
  stage: LeadStage;
  qualification: LeadQualification;
  potentialCents: number | null;
  nextFollowUp: string | null;
  nextAction: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
};
export type LeadInput = Omit<Lead, "id" | "createdAt" | "updatedAt">;
export type LeadOutreachDay = { date: string; touches: number; replies: number; tests: number; works: number };

export function getLeadOutreachDays(): LeadOutreachDay[] {
  return getDb().select({
    date: schema.leadOutreachDaily.date,
    touches: schema.leadOutreachDaily.touches,
    replies: schema.leadOutreachDaily.replies,
    tests: schema.leadOutreachDaily.tests,
    works: schema.leadOutreachDaily.works,
  }).from(schema.leadOutreachDaily).orderBy(desc(schema.leadOutreachDaily.date)).all();
}

export function saveLeadOutreachDay(input: LeadOutreachDay): void {
  const table = schema.leadOutreachDaily;
  getDb().insert(table).values({ ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: table.date,
      set: { touches: input.touches, replies: input.replies, tests: input.tests, works: input.works, updatedAt: new Date() },
    }).run();
}

export function getLeads(): Lead[] {
  return getDb().select().from(schema.leads)
    .orderBy(asc(schema.leads.nextFollowUp), desc(schema.leads.updatedAt))
    .all()
    .map((row) => ({
      ...row,
      stage: row.stage as LeadStage,
      qualification: row.qualification as LeadQualification,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    }));
}

export function saveLead(leadId: number | null, input: LeadInput): number {
  const table = schema.leads;
  const values = { ...input, updatedAt: new Date() };
  if (leadId == null) {
    return getDb().insert(table).values(values).returning({ id: table.id }).get().id;
  }
  getDb().update(table).set(values).where(eq(table.id, leadId)).run();
  return leadId;
}

export function updateLeadStage(leadId: number, stage: LeadStage): void {
  getDb().update(schema.leads).set({ stage, updatedAt: new Date() }).where(eq(schema.leads.id, leadId)).run();
}

export function deleteLead(leadId: number): void {
  getDb().delete(schema.leads).where(eq(schema.leads.id, leadId)).run();
}
