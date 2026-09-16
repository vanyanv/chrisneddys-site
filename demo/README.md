# The owner demo

Walks the whole owner path in a real browser against a production build and
screenshots every step: sign in, add a product, give it a run, hit the
publish gate, publish it, see it on the shop, add it to the bag, buy it,
then watch the order land on Today, the run board and Customers.

It runs against its own PGlite database (`.pglite/demo`) — never Neon,
never real Stripe, never real money.

Run `source demo/env.sh` first, then alternate between the browser phases
(`node demo/drive.mjs a|b|c`, server up) and the database phases
(`node demo/prep.mjs init|photo|purchase`, server down). Screenshots land
in `demo/shots/`.

## Why it is split into phases

PGlite is a single-writer, file-locked database. The steps that need the
database to themselves — attaching a photo, completing the purchase — run
with the server stopped, for the same reason `e2e/db-warmup.mjs` runs
before the production build.

## What is real and what is not

Real: every screen, every query, the publish gate, the reservation of a
number, the assignment of an edition number on payment, the run size lock,
and every figure on Today, the run board and Customers.

Not real: Stripe's hosted checkout page. There are no Stripe keys here, so
the purchase phase calls the same two functions the live path calls —
`createPendingOrder`, which the checkout route runs before handing off to
Stripe, and `markPaid`, which the Stripe webhook runs when payment
succeeds. The hop that is skipped is Stripe's own page and its webhook
signature, neither of which is this repository's code.

Photo upload is skipped too: it needs `BLOB_READ_WRITE_TOKEN`, and the
admin correctly refuses without one, so the photo phase attaches the image
the way a repo-seeded photo is attached.
