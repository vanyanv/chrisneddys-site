"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { MenuItem } from "@/data/menu";
import { itemById } from "@/data/menu";
import { track } from "@/lib/track";
import { quote } from "@/lib/catering/pricing";
import type { CartLine } from "@/lib/catering/types";
import {
  useDraft,
  loadReturningContact,
  saveReturningContact,
  addOrMergeLine,
  updateLineAt,
  removeLineAt,
} from "./draft";
import { STEPS, isStep, type Step } from "./steps";
import type { PublicCateringConfig } from "@/lib/catering/public";
import { StepHeader } from "./StepHeader";
import { SummaryStrip } from "./SummaryStrip";
import { OrderBar } from "./OrderBar";
import { LeaveModal } from "./LeaveModal";
import { Landing } from "./Landing";
import { StepWhere, whereComplete } from "./StepWhere";
import { StepWhen, whenComplete } from "./StepWhen";
import { StepFood } from "./StepFood";
import { StepDetails, detailsComplete, validateDetails } from "./StepDetails";
import { StepReview } from "./StepReview";
import { ItemSheet } from "./ItemSheet";
import { OrderSheet } from "./OrderSheet";
import { FeedCrewSheet } from "./FeedCrewSheet";

type CheckoutErrorCode =
  | "too-soon"
  | "closed"
  | "out-of-range"
  | "price-changed"
  | "card-declined"
  | "off";

/** The whole `/catering/order/` wizard: landing (C1) then the five numbered
 * steps (C2-C9), with the item/order/crew sheets (C5-C7) and the leave modal
 * (C11) layered on top. Step lives in `?step=`, the draft in `localStorage`. */
export function OrderBuilder({ config }: { config: PublicCateringConfig }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const step: Step | null = isStep(stepParam) ? stepParam : null;

  useEffect(() => {
    if (step) track("catering_order_step_view", { step, surface: "catering-order" });
  }, [step]);

  const { draft, setDraft, ready } = useDraft();
  const [rangeBlocked, setRangeBlocked] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [crewSheetOpen, setCrewSheetOpen] = useState(false);
  const [detailsErrors, setDetailsErrors] = useState<ReturnType<typeof validateDetails>>({});
  const [checkoutError, setCheckoutError] = useState<CheckoutErrorCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [returning, setReturning] = useState(false);

  const goToStep = useCallback(
    (next: Step) => {
      router.push(`${pathname}?step=${next}`, { scroll: true });
    },
    [router, pathname],
  );

  const start = useCallback(() => {
    track("catering_order_start", { surface: "catering-order-landing" });
    const info = loadReturningContact();
    if (info) {
      setReturning(true);
      setDraft((d) => ({
        ...d,
        contact: info.contact,
        company: info.company,
        address: info.address ?? d.address,
      }));
    }
    goToStep("where");
  }, [goToStep, setDraft]);

  const currentQuote = useMemo(
    () =>
      quote(draft.lines, {
        fulfilment: draft.fulfilment ?? "pickup",
        deliveryFeeCents: config.deliveryFeeCents,
        tip: draft.tip,
        freebies: { plates: draft.plateSets, napkins: draft.plateSets, utensils: draft.plateSets },
      }),
    [draft.lines, draft.fulfilment, draft.tip, draft.plateSets, config.deliveryFeeCents],
  );

  function handleLeave() {
    setLeaveOpen(false);
    router.push("/catering/order/");
  }

  function addLine(line: CartLine) {
    setDraft((d) => ({
      ...d,
      lines:
        editingIndex != null
          ? updateLineAt(d.lines, editingIndex, line)
          : addOrMergeLine(d.lines, line),
    }));
    setEditingIndex(null);
  }

  async function submitCheckout() {
    const errors = validateDetails(draft.contact);
    setDetailsErrors(errors);
    if (Object.keys(errors).length > 0) {
      goToStep("details");
      return;
    }
    setSubmitting(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/catering/checkout/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: draft.store,
          fulfilment: draft.fulfilment,
          date: draft.date,
          time: draft.time,
          headcount: draft.headcount,
          lines: draft.lines,
          tip:
            "tipPercent" in draft.tip
              ? { percent: draft.tip.tipPercent }
              : { cents: draft.tip.tipCents },
          plateSets: draft.plateSets,
          contact: draft.contact,
          company: draft.company || undefined,
          poNumber: draft.poNumber || undefined,
          onsite: draft.onsite ?? undefined,
          address: draft.fulfilment === "delivery" ? draft.address : undefined,
          customerNote: draft.customerNote || undefined,
        }),
      });
      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        saveReturningContact({
          contact: draft.contact,
          company: draft.company,
          address: draft.address,
        });
        window.location.assign(url);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setCheckoutError((body.error as CheckoutErrorCode) ?? "closed");
    } catch {
      setCheckoutError("closed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return null;

  if (!config.orderingOn) {
    return (
      <div className="cor-off">
        <p>Online catering ordering is coming soon.</p>
        <a className="cor-btn is-primary" href="/contact/" data-catering="">
          Ask about catering &rarr;
        </a>
      </div>
    );
  }

  if (!step) {
    return <Landing onStart={start} />;
  }

  const store = draft.store ?? config.stores[0]?.id ?? "hollywood";
  const summary = (onEdit: Step) => (
    <SummaryStrip
      store={draft.store}
      fulfilment={draft.fulfilment}
      date={draft.date}
      time={draft.time}
      headcount={draft.headcount}
      onEdit={() => goToStep(onEdit)}
    />
  );

  return (
    <div className="cor-builder" data-catering-order-step={step}>
      <StepHeader step={step} onLeave={() => setLeaveOpen(true)} />

      {step !== "where" && summary("where")}

      {step === "where" && (
        <StepWhere
          fulfilment={draft.fulfilment}
          store={draft.store}
          address={draft.address}
          stores={config.stores}
          deliveryFeeCents={config.deliveryFeeCents}
          rangeMiles={draft.rangeMiles}
          onChange={(patch) => setDraft(patch)}
          onRangeMiles={(miles, blocked) => {
            setDraft({ rangeMiles: miles });
            setRangeBlocked(blocked);
          }}
        />
      )}

      {step === "when" && (
        <StepWhen
          store={store}
          fulfilment={draft.fulfilment ?? "pickup"}
          hours={config.hours}
          daysOff={config.daysOff}
          bigHeadcount={config.bigHeadcount}
          bigLeadHours={config.bigLeadHours}
          headcount={draft.headcount}
          onHeadcount={(n) => setDraft({ headcount: n })}
          date={draft.date}
          time={draft.time}
          onDate={(d) => setDraft({ date: d, time: null })}
          onTime={(t) => setDraft({ time: t })}
          nowMs={Date.now()}
        />
      )}

      {step === "food" && (
        <StepFood
          lines={draft.lines}
          foodCents={currentQuote.foodCents}
          onOpenItem={(item) => {
            setEditingIndex(null);
            setOpenItem(item);
          }}
          onOpenOrder={() => setOrderSheetOpen(true)}
          onOpenFeedCrew={() => setCrewSheetOpen(true)}
        />
      )}

      {step === "details" && (
        <StepDetails
          contact={draft.contact}
          company={draft.company}
          poNumber={draft.poNumber}
          onsite={draft.onsite}
          customerNote={draft.customerNote}
          fulfilment={draft.fulfilment}
          address={draft.address}
          returning={returning}
          onNotReturning={() => {
            setReturning(false);
            setDraft((d) => ({
              ...d,
              contact: { name: "", email: "", phone: "" },
              company: "",
            }));
          }}
          errors={detailsErrors}
          onChange={(patch) => {
            const nextContact = patch.contact ? { ...draft.contact, ...patch.contact } : null;
            // `detailsErrors` is only ever *set* by a failed submit attempt
            // (`submitCheckout`), so without this, fixing a field after
            // that failed attempt never clears its error — "Enter your
            // name." stays on screen under a now-valid name until the next
            // submit. Once a submit attempt has shown errors, keep them
            // live against every keystroke instead; before that first
            // attempt, `detailsErrors` is still `{}` and this is a no-op,
            // so nothing shows prematurely while the customer is still
            // filling the form in for the first time.
            if (nextContact && Object.keys(detailsErrors).length > 0) {
              setDetailsErrors(validateDetails(nextContact));
            }
            setDraft((d) => ({
              ...d,
              ...(patch.company !== undefined ? { company: patch.company } : {}),
              ...(patch.poNumber !== undefined ? { poNumber: patch.poNumber } : {}),
              ...(patch.customerNote !== undefined ? { customerNote: patch.customerNote } : {}),
              ...(patch.contact ? { contact: { ...d.contact, ...patch.contact } } : {}),
              ...(patch.onsite !== undefined ? { onsite: patch.onsite } : {}),
            }));
          }}
        />
      )}

      {step === "review" && (
        <StepReview
          lines={draft.lines}
          quote={currentQuote}
          tip={draft.tip}
          onTipChange={(tip) => setDraft({ tip })}
          plateSets={draft.plateSets}
          onPlateSets={(n) => setDraft({ plateSets: n })}
          checkoutError={checkoutError}
        />
      )}

      <OrderBar
        totalCents={step === "review" ? currentQuote.totalCents : currentQuote.foodCents}
        caption={step === "review" ? "Held, not charged" : undefined}
        actionLabel={
          step === "review"
            ? submitting
              ? "Sending…"
              : "Request catering"
            : STEPS[STEPS.indexOf(step) + 1]
              ? "Continue"
              : "Continue"
        }
        disabled={
          submitting ||
          (step === "where" &&
            !whereComplete(draft.fulfilment, draft.store, draft.address, rangeBlocked)) ||
          (step === "when" && !whenComplete(draft.date, draft.time)) ||
          (step === "food" && draft.lines.length === 0) ||
          (step === "details" && !detailsComplete(draft.contact))
        }
        onAction={() => {
          if (step === "review") {
            void submitCheckout();
            return;
          }
          const nextIndex = STEPS.indexOf(step) + 1;
          const next = STEPS[nextIndex];
          if (next) goToStep(next);
        }}
      />

      <ItemSheet
        item={openItem}
        open={openItem != null}
        existingLines={draft.lines}
        initial={editingIndex != null ? (draft.lines[editingIndex] ?? null) : null}
        onClose={() => {
          setOpenItem(null);
          setEditingIndex(null);
        }}
        onAdd={addLine}
      />

      <OrderSheet
        open={orderSheetOpen}
        lines={draft.lines}
        foodCents={currentQuote.foodCents}
        onClose={() => setOrderSheetOpen(false)}
        onEdit={(index) => {
          const line = draft.lines[index];
          if (!line) return;
          const item = itemById(line.itemId);
          if (!item) return;
          // Close the order sheet first, same as `onAddForOnePerson` below:
          // otherwise both sheets stay stacked `is-open` at once, and the
          // order sheet's own buttons (still on top in the DOM) intercept
          // clicks meant for the item sheet's Save/Add button underneath.
          setOrderSheetOpen(false);
          setEditingIndex(index);
          setOpenItem(item);
        }}
        onRemove={(index) => setDraft((d) => ({ ...d, lines: removeLineAt(d.lines, index) }))}
        onAddForOnePerson={() => {
          setOrderSheetOpen(false);
          setEditingIndex(null);
          setOpenItem(itemById("2-sliders-and-fries") ?? null);
        }}
      />

      <FeedCrewSheet
        open={crewSheetOpen}
        headcount={draft.headcount}
        onClose={() => setCrewSheetOpen(false)}
        onFill={(lines) => setDraft({ lines })}
      />

      <LeaveModal
        open={leaveOpen}
        onKeepOrdering={() => setLeaveOpen(false)}
        onLeave={handleLeave}
      />
    </div>
  );
}
