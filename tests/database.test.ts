import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
test("database rejects blocked moves, enforces fees and keeps rejected batches atomic", async () => {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema auth; create schema extensions; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20260906151133_initial_booking.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20260907200703_booking_app_upgrade.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20260907202315_repair_rate_limit_schema.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20260908000000_rebook_reminders.sql",
      "utf8",
    ),
  );
  // Runs cleanly twice: the live database may already have the directory columns.
  for (let i = 0; i < 2; i++)
    await db.exec(
      await readFile(
        "supabase/migrations/20260910120000_clients_and_checkout.sql",
        "utf8",
      ),
    );
  const pricesBefore = (
    await db.query(
      "select barber_id,service_id,price_pence,duration from service_prices order by barber_id,service_id",
    )
  ).rows;
  await db.exec(
    await readFile(
      "supabase/migrations/20260907190113_canonical_service_names.sql",
      "utf8",
    ),
  );
  const renamed = await db.query<{ name: string }>(
    "select name from services where slug='under-13'",
  );
  assert.equal(renamed.rows[0].name, "under thirteens");
  assert.deepEqual(
    (
      await db.query(
        "select barber_id,service_id,price_pence,duration from service_prices order by barber_id,service_id",
      )
    ).rows,
    pricesBefore,
  );
  const limiterKey = "a".repeat(64);
  const attempts = await db.query<{ allowed: boolean }>(
    `select take_rate_limit($1, 2, 600) as allowed
     union all select take_rate_limit($1, 2, 600)
     union all select take_rate_limit($1, 2, 600)`,
    [limiterKey],
  );
  assert.deepEqual(
    attempts.rows.map(({ allowed }) => allowed),
    [true, true, false],
  );

  const { rows: days } = await db.query<{ d: string }>(
    `select ((now() at time zone 'Europe/London')::date+n)::text d from generate_series(1,14) n where extract(isodow from (now() at time zone 'Europe/London')::date+n)=2 limit 1`,
  );
  const day = days[0].d;
  const call = async (token: string, items: unknown[]) =>
    db.query<{ id: string }>(
      `select public.create_booking_group('Test Client','test@example.com','GB','+447700900123',false,$1,$2::jsonb) id`,
      [token.repeat(64), JSON.stringify(items)],
    );
  const first = await call("a", [
    { date: day, time: 600, barber: "sean", service: "cut" },
  ]);
  const group = first.rows[0].id;
  await db.query(
    `update public.booking_groups set policy_snapshot='{"cancellation_hours":168,"late_percent":50,"no_show_percent":100}',policy_accepted_at=now() where id=$1`,
    [group],
  );
  const { rows: bookings } = await db.query<{ id: string; barber_id: string }>(
    `select id,barber_id from public.bookings where group_id=$1`,
    [group],
  );
  const b = bookings[0];
  await db.query(
    `insert into public.diary_blocks(barber_id,local_date,start_minute,duration) values($1,$2,720,60)`,
    [b.barber_id, day],
  );
  await assert.rejects(
    db.query(`update public.bookings set start_minute=720 where id=$1`, [b.id]),
    /diary block/,
  );
  await assert.rejects(
    db.query(
      `insert into public.diary_blocks(barber_id,local_date,start_minute,duration) values($1,$2,600,30)`,
      [b.barber_id, day],
    ),
    /Move existing bookings/,
  );
  const before = (
    await db.query<{ n: number }>(
      "select count(*)::integer n from public.booking_groups",
    )
  ).rows[0].n;
  await assert.rejects(
    call("b", [
      { date: day, time: 900, barber: "sean", service: "cut" },
      { date: day, time: 600, barber: "sean", service: "cut" },
    ]),
  );
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select count(*)::integer n from public.booking_groups",
      )
    ).rows[0].n,
    before,
  );
  // Force a large cancellation window so the same policy boundary can be tested on any weekday.
  await db.query(
    `update public.booking_groups set policy_snapshot=jsonb_set(policy_snapshot,'{cancellation_hours}','1000') where id=$1`,
    [group],
  );
  await assert.rejects(
    db.query(`select public.change_customer_booking($1,$2,'cancel')`, [
      group,
      b.id,
    ]),
    /accept the late cancellation fee/,
  );
  await db.query(
    `select public.change_customer_booking($1,$2,'cancel',null,null,null,null,true)`,
    [group, b.id],
  );
  const { rows: cancelled } = await db.query<{
    status: string;
    fee_pence: number;
    fee_status: string;
  }>(`select status,fee_pence,fee_status from public.bookings where id=$1`, [
    b.id,
  ]);
  assert.equal(cancelled[0].status, "cancelled");
  assert.equal(cancelled[0].fee_pence, 900);
  assert.equal(cancelled[0].fee_status, "review");
  await call("c", [{ date: day, time: 600, barber: "sean", service: "cut" }]);
  assert(
    (
      await db.query<{ n: number }>(
        `select count(*)::integer n from public.notification_jobs`,
      )
    ).rows[0].n > 0,
  );
  const payload = {
    customer: {
      name: "Card Test",
      email: "card@example.com",
      country: "GB",
      phone: "+447700900123",
      marketing: false,
    },
    policy: { cancellation_hours: 6, late_percent: 50, no_show_percent: 100 },
    appointments: [
      {
        date: day,
        time: 900,
        barber: "travis",
        service: "cut",
        price: 17,
        duration: 30,
      },
    ],
  };
  const draft = (
    await db.query<{ id: string }>(
      `insert into public.booking_attempts(id,token_hash,payload) values(gen_random_uuid(),$1,$2::jsonb) returning id`,
      ["d".repeat(64), JSON.stringify(payload)],
    )
  ).rows[0].id;
  const finalize = () =>
    db.query<{ id: string }>(
      `select public.finalize_card_booking($1,'cus_test','pm_test') id`,
      [draft],
    );
  const completed = (await finalize()).rows[0].id;
  assert.equal(
    (await finalize()).rows[0].id,
    completed,
    "duplicate webhook returns the existing group",
  );
  assert.equal(
    (
      await db.query<{ n: number }>(
        `select count(*)::integer n from public.bookings where group_id=$1`,
        [completed],
      )
    ).rows[0].n,
    1,
  );
  const invalid = (
    await db.query<{ id: string }>(
      `insert into public.booking_attempts(id,token_hash,payload) values(gen_random_uuid(),$1,$2::jsonb) returning id`,
      [
        "e".repeat(64),
        JSON.stringify({
          ...payload,
          appointments: [{ ...payload.appointments[0], time: 960, price: 1 }],
        }),
      ],
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(`select public.finalize_card_booking($1,'cus_test','pm_test')`, [
      invalid,
    ]),
    /Price or duration changed/,
  );
  assert.equal(
    (
      await db.query<{ allowed: boolean }>(
        `select has_function_privilege('anon','public.finalize_card_booking(uuid,text,text)','execute') allowed`,
      )
    ).rows[0].allowed,
    false,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20260910180000_staff_passkeys.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile("supabase/migrations/20260910210000_payouts.sql", "utf8"),
  );
  // Staff push choices: a column with a default, safe to run twice.
  for (let i = 0; i < 2; i++)
    await db.exec(
      await readFile(
        "supabase/migrations/20260911120000_staff_notify.sql",
        "utf8",
      ),
    );
  assert.equal(
    (
      await db.query<{ d: string }>(
        `select column_default d from information_schema.columns where table_name='staff_members' and column_name='notify'`,
      )
    ).rows[0].d,
    "'{}'::jsonb",
  );
  // Waitlist runs of days and one-at-a-time offers: columns only, safe to run twice.
  for (let i = 0; i < 2; i++)
    await db.exec(
      await readFile(
        "supabase/migrations/20260911180000_waitlist_range_hold.sql",
        "utf8",
      ),
    );
  assert.deepEqual(
    (
      await db.query<{ c: string }>(
        `select column_name c from information_schema.columns where table_name='waitlist_requests' and column_name in ('until_date','offered_at','offered_slot','offer_count') order by 1`,
      )
    ).rows.map((r) => r.c),
    ["offer_count", "offered_at", "offered_slot", "until_date"],
  );
  // Squeeze-ins: safe to run twice, since it rebuilds the no-overlap rules by name.
  for (let i = 0; i < 2; i++)
    await db.exec(
      await readFile(
        "supabase/migrations/20260911090000_squeeze_in.sql",
        "utf8",
      ),
    );
  // Ticking the reminder box records the wording the customer saw.
  const { rows: laterDays } = await db.query<{ d: string }>(
    `select ((now() at time zone 'Europe/London')::date+n)::text d from generate_series(15,28) n where extract(isodow from (now() at time zone 'Europe/London')::date+n)=2 limit 1`,
  );
  const consented = await db.query<{ id: string }>(
    `select public.create_booking_group('Consent Client','consent@example.com','GB','+447700900124',true,$1,$2::jsonb) id`,
    [
      "z".repeat(64),
      JSON.stringify([
        { date: laterDays[0].d, time: 600, barber: "sean", service: "cut" },
      ]),
    ],
  );
  const { rows: consent } = await db.query<{ copy: string; nudged: null }>(
    `select c.consent_copy as copy, cu.last_nudged_at as nudged from public.email_marketing_consents c join public.customers cu on cu.id=c.customer_id where c.customer_id=(select customer_id from public.booking_groups where id=$1)`,
    [consented.rows[0].id],
  );
  assert.equal(
    consent[0].copy,
    "Remind me when I'm due a trim, plus occasional news from Symmetry.",
  );
  assert.equal(consent[0].nudged, null);
  // The same person booking again is the same client, so history and reminders line up.
  const again = await db.query<{ id: string }>(
    `select public.create_booking_group('Consent Client','consent@example.com','GB','+447700900124',false,$1,$2::jsonb) id`,
    [
      "y".repeat(64),
      JSON.stringify([
        { date: laterDays[0].d, time: 720, barber: "sean", service: "cut" },
      ]),
    ],
  );
  const { rows: owners } = await db.query<{ n: number }>(
    `select count(distinct customer_id)::int n from public.booking_groups where id in ($1,$2)`,
    [consented.rows[0].id, again.rows[0].id],
  );
  assert.equal(owners[0].n, 1);
  // Staff can squeeze a trim in over a taken slot; anything else still cannot overlap.
  const { rows: cutRows } = await db.query<{
    id: string;
    service_id: string;
    duration: number;
    price_pence: number;
  }>(
    `select b.id, sp.service_id, sp.duration, sp.price_pence from public.barbers b join public.service_prices sp on sp.barber_id=b.id join public.services s on s.id=sp.service_id where b.slug='sean' and s.slug='cut'`,
  );
  const cut = cutRows[0];
  const overlapAt600 = (squeezed: boolean) =>
    db.query(
      `insert into public.bookings (group_id,barber_id,service_id,local_date,start_minute,duration,price_pence,source,squeezed) values ($1,$2,$3,$4,600,$5,$6,'walk_in',$7)`,
      [
        again.rows[0].id,
        cut.id,
        cut.service_id,
        laterDays[0].d,
        cut.duration,
        cut.price_pence,
        squeezed,
      ],
    );
  await assert.rejects(overlapAt600(false));
  await overlapAt600(true);
  const { rows: at600 } = await db.query<{ n: number }>(
    `select count(*)::int n from public.bookings where barber_id=$1 and local_date=$2 and start_minute=600 and status='booked'`,
    [cut.id, laterDays[0].d],
  );
  assert.equal(at600[0].n, 2);
  await db.query(
    `update public.bookings set status='done', paid_by='card' where group_id=$1`,
    [again.rows[0].id],
  );
  await assert.rejects(
    db.query(`update public.bookings set paid_by='cheque' where group_id=$1`, [
      again.rows[0].id,
    ]),
  );
  // Checkout edits: changing what was done on a finished trim is not a move, so no customer message is queued.
  for (let i = 0; i < 2; i++)
    await db.exec(
      await readFile(
        "supabase/migrations/20260911150000_checkout_edits.sql",
        "utf8",
      ),
    );
  await db.query(
    `update public.bookings set service_id=(select id from public.services where slug<>'cut' and active limit 1), price_pence=price_pence+500 where group_id=$1`,
    [again.rows[0].id],
  );
  const { rows: movedJobs } = await db.query<{ n: number }>(
    `select count(*)::int n from public.notification_jobs j join public.bookings b on b.id=j.booking_id where b.group_id=$1 and j.kind='moved'`,
    [again.rows[0].id],
  );
  assert.equal(movedJobs[0].n, 0);
  const { rows: updatedEvents } = await db.query<{ n: number }>(
    `select count(*)::int n from public.booking_events e join public.bookings b on b.id=e.booking_id where b.group_id=$1 and e.kind='updated'`,
    [again.rows[0].id],
  );
  assert.ok(updatedEvents[0].n >= 1);
  // Audit fixes: replaces three functions whole, so safe to run twice.
  for (let i = 0; i < 2; i++)
    await db.exec(
      await readFile(
        "supabase/migrations/20261102120000_audit_fixes.sql",
        "utf8",
      ),
    );
  const { rows: farDays } = await db.query<{ d: string }>(
    `select ((now() at time zone 'Europe/London')::date+n)::text d from generate_series(29,42) n where extract(isodow from (now() at time zone 'Europe/London')::date+n)=2 limit 1`,
  );
  const far = farDays[0].d;
  const book = (token: string, name: string, items: unknown[]) =>
    db.query<{ id: string }>(
      `select public.create_booking_group($1,$2,'GB','+447700900125',false,$3,$4::jsonb) id`,
      [
        name,
        name.toLowerCase().replace(/ /g, ".") + "@example.com",
        token.repeat(64),
        JSON.stringify(items),
      ],
    );
  const squeezeIn = (group: string, start: number) =>
    db.query(
      `insert into public.bookings (group_id,barber_id,service_id,local_date,start_minute,duration,price_pence,source,squeezed) values ($1,$2,$3,$4,$5,$6,$7,'walk_in',true)`,
      [
        group,
        cut.id,
        cut.service_id,
        far,
        start,
        cut.duration,
        cut.price_pence,
      ],
    );
  const taken = (e: unknown) => (e as { code?: string }).code === "23P01";
  // A normal trim cannot go over a squeeze-in; a deliberate squeeze-in still can.
  const base = (
    await book("1", "Squeeze Base", [
      { date: far, time: 600, barber: "sean", service: "cut" },
    ])
  ).rows[0].id;
  const { rows: baseRows } = await db.query<{ id: string }>(
    `select id from public.bookings where group_id=$1`,
    [base],
  );
  await squeezeIn(base, 600);
  await squeezeIn(base, 720);
  await assert.rejects(
    book("2", "Over Squeeze", [
      { date: far, time: 720, barber: "sean", service: "cut" },
    ]),
    taken,
  );
  await assert.rejects(
    db.query(`update public.bookings set start_minute=705 where id=$1`, [
      baseRows[0].id,
    ]),
    taken,
    "a normal trim cannot be moved onto a squeeze-in",
  );
  // Moving a trim that already shares its slot with a squeeze-in, without touching another, is fine.
  await db.query(`update public.bookings set start_minute=615 where id=$1`, [
    baseRows[0].id,
  ]);
  await squeezeIn(base, 720);
  // Trims booked together get one confirmation per channel; reminders stay per trim.
  const basket = (
    await book("3", "Basket Client", [
      { date: far, time: 840, barber: "sean", service: "cut" },
      { date: far, time: 900, barber: "sean", service: "cut" },
      { date: addWeek(far), time: 600, barber: "sean", service: "cut" },
    ])
  ).rows[0].id;
  const jobs = async (kind: string) =>
    (
      await db.query<{ channel: string; n: number }>(
        `select channel, count(*)::int n from public.notification_jobs where group_id=$1 and kind=$2 group by channel order by channel`,
        [basket, kind],
      )
    ).rows.map((r) => `${r.channel}:${r.n}`);
  assert.deepEqual(await jobs("confirmed"), ["email:1", "push:1", "sms:1"]);
  assert.deepEqual(await jobs("reminder"), ["email:3", "push:3", "sms:3"]);
  // A later trim added to the same booking does not error or send a second confirmation.
  await db.query(
    `insert into public.bookings (group_id,barber_id,service_id,local_date,start_minute,duration,price_pence,source) values ($1,$2,$3,$4,960,$5,$6,'staff')`,
    [basket, cut.id, cut.service_id, far, cut.duration, cut.price_pence],
  );
  assert.deepEqual(await jobs("confirmed"), ["email:1", "push:1", "sms:1"]);
  // Cancelling one trim still tells the customer about that trim.
  await db.query(
    `update public.bookings set status='cancelled' where group_id=$1 and start_minute=900`,
    [basket],
  );
  assert.deepEqual(await jobs("cancelled"), ["email:1", "push:1", "sms:1"]);
  // A returning card customer who leaves the notes box empty keeps the team's notes.
  await db.query(
    `update public.customers set preferences='Grade 2 sides' where email='card@example.com'`,
  );
  const cardAttempt = async (token: string, time: number, notes?: string) => {
    const id = (
      await db.query<{ id: string }>(
        `insert into public.booking_attempts(id,token_hash,payload) values(gen_random_uuid(),$1,$2::jsonb) returning id`,
        [
          token.repeat(64),
          JSON.stringify({
            ...payload,
            customer: {
              ...payload.customer,
              ...(notes === undefined ? {} : { preferences: notes }),
            },
            appointments: [{ ...payload.appointments[0], date: far, time }],
          }),
        ],
      )
    ).rows[0].id;
    await db.query(
      `select public.finalize_card_booking($1,'cus_test','pm_test')`,
      [id],
    );
    return (
      await db.query<{ p: string }>(
        `select preferences p from public.customers where email='card@example.com'`,
      )
    ).rows.map((r) => r.p);
  };
  assert.deepEqual(await cardAttempt("4", 600, ""), ["Grade 2 sides"]);
  assert.deepEqual(await cardAttempt("5", 630, "  "), ["Grade 2 sides"]);
  assert.deepEqual(await cardAttempt("6", 660), ["Grade 2 sides"]);
  assert.deepEqual(await cardAttempt("7", 690, "Scissors on top"), [
    "Scissors on top",
  ]);
  await db.close();
});
const addWeek = (d: string) => {
  const date = new Date(`${d}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
};
