/**
 * GET /api/opening
 *
 * Vercel Cron (`vercel.json`) calls this at the start of Glendale's opening
 * day and at its 6 PM doors, so every storefront page, `llms.txt` and the
 * sitemap re-render with Glendale's hours and open status within a minute,
 * with no deploy. Outside those moments it does nothing (`dueOpeningMoment`).
 *
 * When `CRON_SECRET` is set on the project, Vercel signs its cron requests
 * with `Authorization: Bearer $CRON_SECRET` and anything else gets a 401.
 * Without it the time window is the only guard, which is enough for a call
 * whose worst case is re-rendering pages a few times in one hour.
 *
 * The owner's fallback, if this ever fails: Admin → Settings → Save
 * re-renders every storefront page the same way (`saveStoreSettings`).
 */
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { dueOpeningMoment } from "@/lib/openingRefresh";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const moment = dueOpeningMoment();
  if (!moment) return NextResponse.json({ revalidated: false });

  revalidatePath("/", "layout");
  revalidatePath("/llms.txt");
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ revalidated: true, moment });
}
