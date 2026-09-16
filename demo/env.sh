export DATABASE_URL=""
export PGLITE_DATA_DIR=".pglite/demo"
export AUTH_SECRET="demo-auth-secret-32-characters-minimum-length"
export SITE_ORIGIN="http://127.0.0.1:3222"
export OWNER_EMAILS="owner@example.com"
export OWNER_PASSWORD_HASH="unused-demo-owner-password-hash-placeholder"
# Present so `hasPaymentKeys()` is true and the shop opens. Nothing ever
# calls Stripe in this demo: the purchase is completed through the same
# functions the checkout route and the webhook call, not over the network.
export STRIPE_SECRET_KEY="sk_test_demo_placeholder_not_a_real_key"
export STRIPE_WEBHOOK_SECRET="whsec_demo_placeholder_not_a_real_key"
export BLOB_READ_WRITE_TOKEN=""
export RESEND_API_KEY=""
export EMAIL_FROM=""
