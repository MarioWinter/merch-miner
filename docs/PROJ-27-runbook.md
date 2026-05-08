# PROJ-27 — AI Upscaler Runbook

> Operations doc for the Replicate-based AI Upscaler feature. Covers env-var
> setup, token rotation, webhook secret rotation, quota tuning, and incident
> playbooks. Spec lives at `features/PROJ-27-ai-upscaler.md`.

---

## 1. First-Time Production Setup

### 1.1 Pin SDK + model versions

Before first deploy, pin both:

- `replicate` Python SDK in `django-app/requirements.txt` — set the latest
  stable version verified against PyPI.
- `nightmareai/real-esrgan` model version hash — find on
  `replicate.com/nightmareai/real-esrgan/versions` and store in the
  `UpscalerSettings.replicate_model_version` field via Django Admin (or via
  a migration if you prefer hard-pinning).

Hash drift on either is the most likely cause of "it worked yesterday" bugs.

### 1.2 Replicate account + token

1. Create / use the team Replicate account (`replicate.com`).
2. Generate an API token: account → API tokens → New token. Label it
   `merch-miner-prod` so it's identifiable.
3. Set `REPLICATE_API_TOKEN` in the production env (Caddy / Docker
   compose `.env` on the server). Never commit.

### 1.3 Webhook signing secret (one-time fetch)

Replicate signs each webhook with HMAC-SHA256. The signing secret is
account-wide and must be fetched once via the API:

```bash
curl -s -H "Authorization: Token $REPLICATE_API_TOKEN" \
     https://api.replicate.com/v1/webhooks/default/secret
# → {"key":"whsec_..."}
```

Store the FULL string (incl. `whsec_` prefix) in the env var
`REPLICATE_WEBHOOK_SECRET`. The SDK's `replicate.webhooks.validate()`
strips the prefix internally — do not strip it yourself.

### 1.4 Webhook URL reachability

Replicate's POST callback must reach your Django at
`https://<your-domain>/api/upscale/callback/`. Verify:

- Caddy / reverse proxy passes `/api/upscale/callback/` through to the
  `web` container without auth.
- Set `REPLICATE_WEBHOOK_URL` env var explicitly (overrides the
  ALLOWED_HOSTS auto-detection in `tasks._build_webhook_url`).

For staging / local dev: webhooks **cannot** reach localhost. Either
use ngrok, or use the `simulate_upscale` management command for local
validation:

```bash
docker compose exec web python manage.py simulate_upscale <design_id>
```

### 1.5 Default UpscalerSettings row

Trigger the singleton via Django shell after first migration:

```bash
docker compose exec web python manage.py shell -c \
  "from design_app.models import UpscalerSettings; UpscalerSettings.load()"
```

Then visit `/admin/design_app/upscalersettings/` to confirm the defaults
(model slug, version hash, target dims, quota, concurrency).

### 1.6 rq scheduler — reconciler entry

The 60s stuck-job reconciler runs through django-rq scheduler. Register
it once after a fresh deploy:

```bash
docker compose exec web python manage.py schedule_upscale_reconciler
```

This is idempotent — running again just re-registers the same entry.

---

## 2. Token / Secret Rotation

### 2.1 Rotate `REPLICATE_API_TOKEN`

Standard env-var rotation:

1. Generate a new token in the Replicate dashboard (don't delete old one yet).
2. Update `.env` on the server with the new value.
3. `docker compose restart web worker-design`.
4. Verify a fresh upscale runs successfully (admin Django shell or trigger
   via UI).
5. **Then** delete the old token in the Replicate dashboard.

In-flight predictions started with the old token continue to work — the
token authenticates the call to Replicate, not the prediction itself.

### 2.2 Rotate `REPLICATE_WEBHOOK_SECRET`

The webhook secret is account-wide and tied to the signing of every
inbound webhook. Replicate rotates it via:

```bash
curl -X POST -H "Authorization: Token $REPLICATE_API_TOKEN" \
     https://api.replicate.com/v1/webhooks/default/secret
# → {"key":"whsec_<new>"}
```

In-flight predictions fired BEFORE the rotation will arrive signed with
the OLD secret. To avoid losing those callbacks:

1. Set the new secret as `REPLICATE_WEBHOOK_SECRET` in env.
2. Set the OLD secret as `REPLICATE_WEBHOOK_SECRET_PREVIOUS` in env.
3. Restart `web`.
4. Wait for the longest possible in-flight prediction TTL (Replicate
   completes most in <30s, but webhooks can retry up to 24h). Conservative:
   keep PREVIOUS for 1 hour, then remove.
5. After grace period: unset `REPLICATE_WEBHOOK_SECRET_PREVIOUS`, restart
   `web`.

Code path: `replicate_client.verify_webhook_signature()` validates against
PRIMARY first; on `InvalidSignatureError`, retries against PREVIOUS if set.

---

## 3. Quota Tuning

Default: 100 upscales/month per non-staff user. Tune in Django Admin →
`UpscalerSettings`:

- `monthly_quota_per_user` — bump or shrink as cost-budget allows.
- `staff_unlimited` — turn off only if you want to also gate staff (e.g.
  shared abuse incident).

Per-user usage rows live in `UpscaleQuotaUsage`. Read-only in admin for
support; never edit by hand — quota refunds happen automatically on job
failure via the rq callback path.

If you need to manually credit a user (e.g. apologize for an outage):

```bash
docker compose exec web python manage.py shell
>>> from design_app.models import UpscaleQuotaUsage
>>> from datetime import date
>>> row = UpscaleQuotaUsage.objects.get(user__email='user@x.com',
...                                    month=date.today().replace(day=1))
>>> row.count -= 5  # credit back 5
>>> row.save()
```

---

## 4. Incident Playbooks

### 4.1 "Upscales never finish"

Symptoms: jobs stuck in `running` for >5 min, drawer never updates.

Likely causes:
- Webhook URL not reachable from Replicate (Caddy misconfig, firewall,
  DNS issue) → check `replicate.com/predictions/<id>` for the prediction
  status; if `succeeded` there but our DB says `running`, the webhook is
  the issue.
- Reconciler not scheduled → run `schedule_upscale_reconciler` again.
- Webhook signature rejection → check Django logs for `InvalidSignatureError`;
  if present, secret is stale (re-fetch + restart).

Recovery: the 60s reconciler will recover in-flight jobs by polling
Replicate directly. Force a manual reconcile:

```bash
docker compose exec web python manage.py shell -c \
  "from design_app.tasks import reconcile_stuck_jobs; reconcile_stuck_jobs()"
```

### 4.2 "Quota error 402 but user shouldn't be over"

Check `UpscaleQuotaUsage` row for that user's current month. If `count`
is wildly inflated (e.g. >> what the user actually triggered), there may
have been a refund-failure bug. Manually adjust the row's `count` and
ask the user to retry.

### 4.3 "Replicate API is down"

`enqueue_replicate_upscale` retries with 2s/4s/8s backoff (3 attempts).
After permanent failure the job is marked `failed` with
`error_message="replicate_unavailable"` and quota is refunded. User
sees the failure in the drawer and can retry later via the per-row
button.

If the outage is prolonged, set the `REPLICATE_API_TOKEN` env var to an
empty string and restart — this short-circuits new triggers with a clean
error message instead of letting users burn quota on retries.

### 4.4 "Cost spike alert"

The 100/month cap stops runaway usage by individual users. If the
overall account spend spikes:

1. Check Replicate dashboard for which model + which user produced the
   load.
2. If a single user: look at their `UpscaleQuotaUsage` row — if it's
   maxed out, the cap is working but the cost-per-call is the issue.
3. If staff/superuser: they bypass quota — consider tightening
   `staff_unlimited` to false temporarily.
4. Confirm `default_scale=4` and `bulk_concurrency=10` haven't been
   bumped in admin.

---

## 5. Local Dev Workflow

Replicate webhooks can't reach `localhost` without a tunnel. Two options:

**Option A — `simulate_upscale` management command (no Replicate calls):**

```bash
# Upscale a single design (Pillow-scale or copy)
docker compose exec web python manage.py simulate_upscale <design_id>

# Upscale all designs in a workspace (skip ones already upscaled)
docker compose exec web python manage.py simulate_upscale --workspace <ws_id>

# Verbatim copy (fast, no visible diff in Compare modal)
docker compose exec web python manage.py simulate_upscale <design_id> --copy
```

The command writes a `DesignProcessingJob` in `completed` status, fills
`Design.upscaled_file`, and bumps `UpscaleQuotaUsage` so all UI features
(drawer, pill, Compare modal, quota indicator) work end-to-end.

**Option B — ngrok tunnel (real Replicate calls):**

```bash
ngrok http 8000
# copy https URL → set REPLICATE_WEBHOOK_URL=https://<id>.ngrok.io/api/upscale/callback/ in .env
# restart web container
```

Costs ~$0.002 per real upscale on the team account. Use sparingly.

---

## 6. Cost Reference

- `nightmareai/real-esrgan` at `scale=4`: ~$0.0014/image (verify at
  `replicate.com/pricing` before launch).
- 100 images = ~$0.14 — at default 100/user/month cap, worst case
  100 paying users = ~$14/mo of upscale cost.
- Bulk concurrency of 10 doesn't multiply cost — Replicate bills per
  prediction, not per concurrent slot.

---

## 7. Removing Legacy PROJ-9 Pica fields

After PROJ-27 is fully deployed and stable for one release cycle:

1. Confirm no callers reference `ProcessingSettings.upscale_provider`,
   `upscale_api_key`, `upscale_auto_threshold` — `git grep` should show
   zero non-deprecation references.
2. Generate the removal migration:

   ```bash
   docker compose exec web python manage.py makemigrations design_app \
       --name proj27_drop_legacy_pica_fields
   ```

3. Edit the migration to also drop env vars (`UPSCALE_PROVIDER`,
   `UPSCALE_API_KEY`, `UPSCALE_AUTO_THRESHOLD`) from `.env.template`.
4. Deploy + monitor.

---

## 8. Open Items (track here)

- [ ] Pin exact `replicate` SDK version in `requirements.txt`
- [ ] Pin exact `nightmareai/real-esrgan` model version hash in
      `UpscalerSettings.replicate_model_version`
- [ ] Run `replicate.webhooks.default.secret()` in prod and store the
      result in `REPLICATE_WEBHOOK_SECRET`
- [ ] Wire `enqueue_cloud_upload` to publish_app upload primitives
      (currently a shim; cloud-destination payloads work end-to-end on
      the frontend but the actual cloud upload after upscale is not yet
      executed)
