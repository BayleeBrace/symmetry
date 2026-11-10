import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { createAdminClient } from "./supabase/admin";
import { addDays, shopMinute, shopToday } from "./booking-data";
import { getPolicy } from "./catalog";
import { fetchAll, forChunks } from "./paging";

/**
 * Pretend clients and trims for trying the app, added and removed from the
 * owner's settings. The same records as handover/TEST-DATA.sql: ten clients,
 * a few past visits each, then four trims a day on every chair for the rest
 * of today and the next ten days.
 *
 * Every test client's notes start "Test record", which is how removal finds
 * them, and nothing else. Emails and mobiles are blank, so no message can
 * ever reach a real person. In practice mode each one also has a test card
 * saved, so no-show fees can be tried end to end.
 */
export const TEST_MARK = "Test record";

const NAMES = [
  "Rhys Davies",
  "Owen Price",
  "Tom Harris",
  "Jack Lewis",
  "Huw Bevan",
  "Gareth Owen",
  "Ioan Rees",
  "Dafydd Morgan",
  "Cai Thomas",
  "Ellis Hughes",
];
const NOTES = [
  "Skin fade, keep the top long.",
  "",
  "Number two on the sides.",
  "",
  "Beard tidy as well when there is time.",
  "",
  "",
  "Prefers early mornings.",
  "",
  "",
];

const tokenHash = () => createHash("sha256").update(randomUUID()).digest("hex");

export async function countTestClients() {
  const { count, error } = await createAdminClient()
    .from("customers")
    .select("id", { count: "exact", head: true })
    .like("preferences", TEST_MARK + "%");
  if (error) throw new Error("Test clients could not be counted");
  return count ?? 0;
}

type Row = Record<string, unknown>;

/** Every row of `table` whose `column` is one of `ids`, however many there are. */
async function rowsWhere(
  table: string,
  select: string,
  column: string,
  ids: string[],
) {
  const db = createAdminClient();
  const { data, error } = await forChunks(ids, (chunk) =>
    fetchAll((start, end) =>
      db
        .from(table)
        .select(select)
        .in(column, chunk)
        .order("id")
        .range(start, end),
    ),
  );
  if (error) throw new Error("Test records could not load");
  return data as unknown as Row[];
}

export async function addTestData(stripe: Stripe | null) {
  const db = createAdminClient();
  if ((await countTestClients()) > 0)
    throw new Error(
      "The test clients are already in. Remove them first to start again.",
    );
  const today = shopToday();
  const nowMinute = shopMinute();
  const [barbers, services, prices, hours, schedules, policy] =
    await Promise.all([
      db
        .from("barbers")
        .select("id,display_order")
        .eq("active", true)
        .order("display_order"),
      db.from("services").select("id,slug").in("slug", ["fade", "cut"]),
      db
        .from("service_prices")
        .select("barber_id,service_id,duration,price_pence")
        .eq("active", true),
      db.from("opening_hours").select("*"),
      db.from("barber_schedules").select("*"),
      getPolicy(),
    ]);
  if (
    barbers.error ||
    services.error ||
    prices.error ||
    hours.error ||
    schedules.error
  )
    throw new Error("The shop's chairs and prices could not load");
  const chairs = barbers.data.map((b) => b.id as string);
  const fade = services.data.find((s) => s.slug === "fade")?.id as
    string | undefined;
  const cut =
    (services.data.find((s) => s.slug === "cut")?.id as string | undefined) ??
    fade;
  if (!chairs.length || !fade || !cut)
    throw new Error("Add the chairs and a Fade first");
  const priceOf = (barber: string, service: string) => {
    const p = prices.data.find(
      (r) => r.barber_id === barber && r.service_id === service,
    );
    return {
      duration: (p?.duration as number) ?? 30,
      price: (p?.price_pence as number) ?? 2200,
    };
  };
  /** A chair's working minutes on a date: the shop's hours, narrowed by the chair's own. */
  const shift = (barber: string, date: string): [number, number] | null => {
    const dow = ((new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7) + 1;
    const shop = hours.data.find((h) => h.iso_weekday === dow);
    let open = shop?.open_minute as number | null;
    let close = shop?.close_minute as number | null;
    const own = schedules.data.find(
      (s) => s.barber_id === barber && s.iso_weekday === dow,
    );
    if (own) {
      if (own.open_minute === null) return null;
      open = Math.max(open ?? 0, own.open_minute);
      close = Math.min(close ?? 1440, own.close_minute);
    }
    return open === null ||
      close === null ||
      open === undefined ||
      close === undefined
      ? null
      : [open, close];
  };

  // The clients.
  const clients = NAMES.map((name, i) => ({
    id: randomUUID(),
    name,
    email: "",
    phone_country: "GB",
    phone: "",
    preferences: `${TEST_MARK}. ${NOTES[i]}`.trim(),
  }));
  const { error: clientError } = await db.from("customers").insert(clients);
  if (clientError) throw new Error("The test clients could not be added");
  await db.from("email_marketing_consents").insert(
    clients
      .filter((_, i) => i % 2 === 1)
      .map((c) => ({
        customer_id: c.id,
        granted: true,
        consent_copy:
          "Remind me when I'm due a trim, plus occasional news from Symmetry.",
        consent_version: "2026-09-08",
      })),
  );
  // Every test booking carries the shop's cancellation policy, so a no-show
  // raises a fee to review, as a real one would. Test cards come separately.
  const snapshot = {
    cancellation_hours: policy.cancellation_hours,
    late_percent: policy.late_percent,
    no_show_percent: policy.no_show_percent,
    version: policy.version,
  };
  const groupFor = (clientId: string): Row => ({
    id: randomUUID(),
    customer_id: clientId,
    manage_token_hash: tokenHash(),
    policy_snapshot: snapshot,
  });

  // Past visits: the latest one to six weeks ago, then every three to five weeks before.
  const past: { group: Row; booking: Row }[] = [];
  clients.forEach((c, index) => {
    const i = index + 1;
    for (let k = 1; k <= 1 + (i % 5); k++) {
      const barber = chairs[(i + k) % chairs.length];
      const service = (i + k) % 3 === 0 ? cut : fade;
      const { duration, price } = priceOf(barber, service);
      const status = k === 1 && i % 4 === 0 ? "no_show" : "done";
      const group = groupFor(c.id);
      past.push({
        group,
        booking: {
          group_id: group.id,
          barber_id: barber,
          service_id: service,
          local_date: addDays(
            today,
            -(7 * ((i % 6) + 1)) - (k - 1) * (21 + (i % 3) * 7),
          ),
          start_minute: 540 + 15 * ((i * 3 + k * 5) % 28),
          duration,
          price_pence: price,
          status,
          source: "import",
          paid_by:
            status === "done" ? ((i + k) % 2 === 0 ? "card" : "cash") : null,
        },
      });
    }
  });

  // Upcoming: four a day on every chair, inside its hours. Earlier today is already done.
  const days: { group: Row; booking: Row }[][] = [];
  let n = 0;
  for (let k = 0; k <= 10; k++) {
    const date = addDays(today, k);
    chairs.forEach((barber, index) => {
      const j = index + 1;
      const hrs = shift(barber, date);
      if (!hrs) return;
      const [open, close] = hrs;
      const day: { group: Row; booking: Row }[] = [];
      for (let q = 0; q <= 3; q++) {
        const minute = open + 30 + q * 90 + 15 * ((j + q) % 2);
        n++;
        const client = clients[n % clients.length];
        const service = n % 3 === 0 ? cut : fade;
        const { duration, price } = priceOf(barber, service);
        if (minute + duration > close) continue;
        const earlier = k === 0 && minute <= nowMinute;
        const group = groupFor(client.id);
        day.push({
          group,
          booking: {
            group_id: group.id,
            barber_id: barber,
            service_id: service,
            local_date: date,
            start_minute: minute,
            duration,
            price_pence: price,
            status: earlier ? "done" : "booked",
            source: "import",
            paid_by: earlier ? (n % 2 === 0 ? "card" : "cash") : null,
          },
        });
      }
      if (day.length) days.push(day);
    });
  }

  const all = [...past, ...days.flat()];
  for (let i = 0; i < all.length; i += 100) {
    const { error } = await db
      .from("booking_groups")
      .insert(all.slice(i, i + 100).map((r) => r.group));
    if (error) throw new Error("The test bookings could not be added");
  }
  // A whole batch is refused if one trim clashes with something already in the
  // diary, so a refused batch goes in one at a time and only the clash is skipped.
  let added = 0;
  const insert = async (rows: Row[]) => {
    const { error } = await db.from("bookings").insert(rows);
    if (!error) return (added += rows.length);
    for (const row of rows) {
      const { error: one } = await db.from("bookings").insert(row);
      if (!one) added++;
    }
  };
  for (let i = 0; i < past.length; i += 100)
    await insert(past.slice(i, i + 100).map((r) => r.booking));
  for (const day of days) await insert(day.map((r) => r.booking));

  // The diary queued a confirmation and reminder for each; these clients have
  // no email or mobile, so clear them now rather than fill the message queue.
  const groupIds = all.map((r) => r.group.id as string);
  await forChunks(groupIds, async (chunk) => {
    const { error } = await db
      .from("notification_jobs")
      .delete()
      .in("group_id", chunk)
      .eq("status", "pending");
    return { data: [], error };
  });
  // Groups whose trim was skipped hold nothing; take them out.
  const used = await rowsWhere("bookings", "group_id", "group_id", groupIds);
  const kept = new Set(used.map((b) => b.group_id as string));
  const empty = groupIds.filter((g) => !kept.has(g));
  if (empty.length)
    await forChunks(empty, async (chunk) => {
      const { error } = await db
        .from("booking_groups")
        .delete()
        .in("id", chunk);
      return { data: [], error };
    });
  const cards = stripe ? await addTestCards(stripe) : 0;
  return { clients: clients.length, trims: added, cards };
}

/**
 * Practice mode: a Stripe test card saved for every test client still without
 * one, so their no-show fees can be charged. Run when test clients go in, and
 * again when the practice card machine is added, in case they went in before
 * Stripe was connected.
 */
export async function addTestCards(stripe: Stripe) {
  const db = createAdminClient();
  const { data: clients, error } = await db
    .from("customers")
    .select("id,name")
    .like("preferences", TEST_MARK + "%");
  if (error) throw new Error("Test clients could not load");
  const accepted = new Date().toISOString();
  let added = 0;
  for (const c of clients ?? []) {
    const groups = await rowsWhere(
      "booking_groups",
      "id,stripe_customer",
      "customer_id",
      [c.id as string],
    );
    const bare = groups
      .filter((g) => !g.stripe_customer)
      .map((g) => g.id as string);
    if (!bare.length) continue;
    const customer = await stripe.customers.create({
      name: c.name as string,
      metadata: { symmetry_test: "1" },
    });
    const card = await stripe.paymentMethods.attach("pm_card_visa", {
      customer: customer.id,
    });
    const { error: save } = await forChunks(bare, async (chunk) => {
      const { error: e } = await db
        .from("booking_groups")
        .update({
          stripe_customer: customer.id,
          stripe_payment_method: card.id,
          policy_accepted_at: accepted,
        })
        .in("id", chunk);
      return { data: [], error: e };
    });
    if (save) throw new Error("Test cards could not be saved");
    added++;
  }
  return added;
}

/** How many test clients have bookings with no test card saved yet. */
export async function testClientsWithoutCards() {
  const db = createAdminClient();
  const { data: clients } = await db
    .from("customers")
    .select("id")
    .like("preferences", TEST_MARK + "%");
  const ids = (clients ?? []).map((c) => c.id as string);
  if (!ids.length) return 0;
  const groups = await rowsWhere(
    "booking_groups",
    "customer_id,stripe_customer",
    "customer_id",
    ids,
  );
  return new Set(
    groups.filter((g) => !g.stripe_customer).map((g) => g.customer_id),
  ).size;
}

/** Takes out every test client and everything hanging off them, and nothing else. */
export async function removeTestData(stripe: Stripe | null) {
  const db = createAdminClient();
  const { data: clients, error } = await db
    .from("customers")
    .select("id")
    .like("preferences", TEST_MARK + "%");
  if (error) throw new Error("Test clients could not load");
  const clientIds = (clients ?? []).map((c) => c.id as string);
  if (!clientIds.length) return { clients: 0, trims: 0 };
  const groups = await rowsWhere(
    "booking_groups",
    "id",
    "customer_id",
    clientIds,
  );
  const groupIds = groups.map((g) => g.id as string);
  const trims = await rowsWhere("bookings", "id", "group_id", groupIds);
  const trimIds = trims.map((t) => t.id as string);
  const wipe = async (table: string, column: string, ids: string[]) => {
    const { error: e } = await forChunks(ids, async (chunk) => {
      const { error: del } = await db.from(table).delete().in(column, chunk);
      return { data: [], error: del };
    });
    if (e) throw new Error(`Test records could not be removed (${table})`);
  };
  await wipe("notification_jobs", "booking_id", trimIds);
  await wipe("notification_jobs", "group_id", groupIds);
  await wipe("booking_events", "booking_id", trimIds);
  await wipe("booking_events", "group_id", groupIds);
  await wipe("push_subscriptions", "group_id", groupIds);
  await wipe("booking_attempts", "group_id", groupIds);
  await wipe("bookings", "id", trimIds);
  await wipe("booking_groups", "id", groupIds);
  await wipe("customers", "id", clientIds);
  // The pretend customers and cards in Stripe's practice mode go too.
  if (stripe)
    for await (const c of stripe.customers.list({ limit: 100 })) {
      if (c.metadata?.symmetry_test === "1")
        await stripe.customers.del(c.id).catch(() => {});
    }
  return { clients: clientIds.length, trims: trimIds.length };
}

/**
 * Switched on from Vercel with SEED_TEST_DATA=true: the every-minute job puts
 * the test clients in once, when there are none, so the team has something
 * to practise on without anyone pressing a button. Never once card payments
 * are live. Switch it off again afterwards, or Remove would be undone.
 */
export async function seedTestDataOnce(
  mode: "test" | "live" | null,
  stripe: Stripe | null,
) {
  if (mode === "live") return { skipped: "Card payments are live" };
  if ((await countTestClients()) > 0) return { skipped: "Already in" };
  const added = await addTestData(stripe);
  console.log("Test clients added", added);
  return added;
}
