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
  await db.close();
});
