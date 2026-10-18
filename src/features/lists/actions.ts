"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LIST_ICON_KEYS } from "./icons";
import { deleteList, saveList } from "./server";

const id = z.number().int().positive();
const listSchema = z.object({
  name: z.string().trim().min(1).max(100),
  icon: z.enum(LIST_ICON_KEYS as [string, ...string[]]),
});

export async function saveListAction(
  listId: number | null,
  data: { name: string; icon: string },
): Promise<number> {
  const result = saveList(id.nullable().parse(listId), listSchema.parse(data));
  revalidatePath("/", "layout");
  return result;
}

export async function deleteListAction(listId: number): Promise<void> {
  deleteList(id.parse(listId));
  revalidatePath("/", "layout");
  redirect("/");
}
