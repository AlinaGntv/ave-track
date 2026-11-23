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
