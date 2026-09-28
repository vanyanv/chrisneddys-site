"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { cancelByCustomer, requestChange, type RequestChangeInput } from "@/lib/catering/service";
import type { ServiceResult } from "@/lib/catering/service";

export async function cancelOrderAction(token: string): Promise<ServiceResult> {
  const db = await getDb();
  const result = await cancelByCustomer(db, token);
  if (result.ok) {
    revalidatePath(`/catering/o/${token}/`);
  }
  return result;
}

export async function requestChangeAction(
  token: string,
  input: RequestChangeInput,
): Promise<ServiceResult> {
  const db = await getDb();
  const result = await requestChange(db, token, input);
  if (result.ok) {
    revalidatePath(`/catering/o/${token}/`);
  }
  return result;
}
