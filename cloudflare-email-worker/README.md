# Cloudflare Email Worker → HatexCard inbox
#
# 1) Nan Vercel / .env.local (sit la):
#    INBOUND_EMAIL_WEBHOOK_SECRET=<menm-sekrè-long>
#    SUPPORT_NOTIFY_EMAIL=adminhatexcard@gmail.com   # opsyonèl alèt
#
# 2) Deploy worker:
#    cd cloudflare-email-worker
#    npm install
#    npx wrangler login
#    npx wrangler secret put INBOUND_EMAIL_WEBHOOK_SECRET
#    npx wrangler secret put INGEST_URL
#       → valè: https://hatexcard.com/api/webhooks/inbound-email
#    npx wrangler deploy
#
# 3) Cloudflare Dashboard → Email → Email Routing → Routing rules
#    Pou support@ / business@ / contact@ / notifications@ :
#    Action = "Send to a Worker" → chwazi "hatex-inbound-email"
#    (Ou ka retire "Forward to Gmail" si w vle tout bagay nan app sèlman,
#     oswa kenbe forward + ajoute yon dezyèm règ — Cloudflare pèmèt
#     yon aksyon pa règ; pi senp = Worker sèlman, reponn nan app.)
#
# 4) Brevo: verifye senders support@, business@, contact@
#    pou repons soti nan app la parèt kòm adrès pwofesyonèl.
