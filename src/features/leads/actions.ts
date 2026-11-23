"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deleteLead, saveLead, updateLeadStage, type LeadStage } from "./server";

const id = z.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().max(120).nullable(),
  contact: z.string().trim().max(200).nullable(),
  source: z.string().trim().max(100).nullable(),
  stage: z.enum(["new", "contacted", "replied", "qualified", "won", "lost"]),
  qualification: z.enum(["unreviewed", "fit", "not_fit"]),
  potentialCents: z.number().int().min(0).max(100_000_000_000).nullable(),
  nextFollowUp: date,
  nextAction: z.string().trim().max(300).nullable(),
  notes: z.string().trim().max(3000).nullable(),
});

function refresh() {
  revalidatePath("/leads");
}

export async function saveLeadAction(leadId: number | null, input: z.input<typeof leadSchema>): Promise<number> {
  const result = saveLead(id.nullable().parse(leadId), leadSchema.parse(input));
  refresh();
  return result;
}

export async function updateLeadStageAction(leadId: number, stage: LeadStage): Promise<void> {
  updateLeadStage(id.parse(leadId), z.enum(["new", "contacted", "replied", "qualified", "won", "lost"]).parse(stage));
  refresh();
}

export async function deleteLeadAction(leadId: number): Promise<void> {
  deleteLead(id.parse(leadId));
  refresh();
}
