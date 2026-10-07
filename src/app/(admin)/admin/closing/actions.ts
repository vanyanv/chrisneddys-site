"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { addCrew, listCrew, newCode, setActive } from "@/lib/closing/crew";
import {
  createItem,
  listItems,
  moveItem,
  restoreItem,
  retireItem,
  updateItem,
} from "@/lib/closing/items";
import { CLOSING_STORE, parseItemForm } from "@/lib/closing/ownerText";
import { getOrCreateStore, rotateLink } from "@/lib/closing/store";

const ITEMS = "/admin/closing/items/";
const CREW = "/admin/closing/crew/";

const str = (fd: FormData, name: string) => String(fd.get(name) ?? "");

export type ItemFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** What was typed, so a rejected save keeps it on screen. */
  values?: Record<string, string>;
};

/** The item with this id in this store (live or retired), or null. */
async function ownItem(id: string) {
  const db = await getDb();
  const items = await listItems(db, CLOSING_STORE, { includeRetired: true });
  return { db, item: items.find((i) => i.id === id) ?? null, items };
}

export async function saveItemAction(
  _prev: ItemFormState | undefined,
  formData: FormData,
): Promise<ItemFormState> {
  await requireOwner();
  const id = str(formData, "id");
  const { db, item, items } = await ownItem(id);
  if (id && !item) redirect(`${ITEMS}?done=gone`);

  const parsed = parseItemForm(
    (name) => str(formData, name),
    items.map((i) => i.section),
  );
  if (!parsed.ok) {
    const values = Object.fromEntries(
      ["label", "detail", "labelEs", "detailEs", "section", "newSection", "kind", "maxValue"].map(
        (k) => [k, str(formData, k)],
      ),
    );
    return { error: "Fix the highlighted fields.", fieldErrors: parsed.fieldErrors, values };
  }
  await getOrCreateStore(db, CLOSING_STORE);
  if (item) await updateItem(db, item.id, parsed.input);
  else await createItem(db, CLOSING_STORE, parsed.input);
  redirect(`${ITEMS}?done=${item ? "saved" : "added"}`);
}

export async function moveItemAction(formData: FormData): Promise<void> {
  await requireOwner();
  const { db, item, items } = await ownItem(str(formData, "id"));
  if (!item || item.retiredAt) redirect(`${ITEMS}?done=gone`);
  const dir = str(formData, "dir") === "up" ? "up" : "down";
  const siblings = items.filter((i) => !i.retiredAt && i.section === item.section);
  const at = siblings.findIndex((i) => i.id === item.id);
  const edge = dir === "up" ? at === 0 : at === siblings.length - 1;
  if (!edge) await moveItem(db, item.id, dir);
  redirect(`${ITEMS}?edit=${item.id}&done=${edge ? (dir === "up" ? "first" : "last") : dir}`);
}

export async function retireItemAction(formData: FormData): Promise<void> {
  await requireOwner();
  const { db, item } = await ownItem(str(formData, "id"));
  if (!item) redirect(`${ITEMS}?done=gone`);
  await retireItem(db, item.id);
  redirect(`${ITEMS}?done=retired`);
}

export async function restoreItemAction(formData: FormData): Promise<void> {
  await requireOwner();
  const { db, item } = await ownItem(str(formData, "id"));
  if (!item) redirect(`${ITEMS}?done=gone`);
  await restoreItem(db, item.id);
  redirect(`${ITEMS}?done=restored`);
}

// ------------------------------------------------------------- crew and link

export type AddPersonState = { error?: string; name?: string };

export async function addCrewAction(
  _prev: AddPersonState | undefined,
  formData: FormData,
): Promise<AddPersonState> {
  await requireOwner();
  const name = str(formData, "name").trim();
  if (!name) return { error: "Type the person's name.", name };
  if (name.length > 40) return { error: "Keep the name under 40 characters.", name };
  const db = await getDb();
  await getOrCreateStore(db, CLOSING_STORE);
  const person = await addCrew(db, CLOSING_STORE, name);
  redirect(`${CREW}?done=added&who=${person.id}`);
}

async function ownCrew(id: string) {
  const db = await getDb();
  const person = (await listCrew(db, CLOSING_STORE)).find((c) => c.id === id) ?? null;
  return { db, person };
}

export async function newCodeAction(formData: FormData): Promise<void> {
  await requireOwner();
  const { db, person } = await ownCrew(str(formData, "id"));
  if (!person) redirect(CREW);
  await newCode(db, person.id);
  redirect(`${CREW}?done=newcode&who=${person.id}`);
}

/** `active` is "on" to turn someone on (fresh code), anything else turns them off. */
export async function setActiveAction(formData: FormData): Promise<void> {
  await requireOwner();
  const { db, person } = await ownCrew(str(formData, "id"));
  if (!person) redirect(CREW);
  const on = str(formData, "active") === "on";
  await setActive(db, person.id, on);
  redirect(`${CREW}?done=${on ? "on" : "off"}&who=${person.id}`);
}

export async function rotateLinkAction(): Promise<void> {
  await requireOwner();
  await rotateLink(await getDb(), CLOSING_STORE);
  redirect(`${CREW}?done=link`);
}
