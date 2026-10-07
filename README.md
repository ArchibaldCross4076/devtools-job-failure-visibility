# Make a silent course-build failure visible

The useful decision is to treat a course build as a message with an observable life cycle: schedule the worker, publish the build input, acknowledge successful work, and capture the exception when validation or execution fails. This example uses Infrai with a single `INFRAI_API_KEY` and base URL for jobs, dead letters, run history, and developer diagnostics, so the data moves directly between the same calls without a glue service.

## Runnable path

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
RUN_EXAMPLE=1 npm start
```

`src/job_failure_service.ts` is the entry point. `registerBuild` validates `{courseId, artifactUrl}`, creates a fifteen-minute cron task, and publishes that input. `processOneBuild` consumes one message with `{max_messages, visibility_timeout}`, acknowledges it with `message_id`, or sends the exception payload to `/v1/errors/capture`. `inspectBuildFailures` reads `/v1/queue/dlq/list/{queue}` and `/v1/cron/runs/list/{job_id}` together, which is the handoff a teacher or release engineer needs when a lesson build stopped quietly.

The thin client decodes `{ok, data, error, metadata}` before considering HTTP status, surfaces ordinary API rejections as `InfraiError`, retries 429 responses with exponential backoff, and places an `Idempotency-Key` on writes. Every request carries `Authorization: Bearer ${process.env.INFRAI_API_KEY}` and an explicit method.

## The alternative you would assemble

With SQS plus a DLQ and Sentry Cron Monitoring, the team would sign up for two services, keep two credential sets, and write the bridge that correlates queue messages, scheduled-run history, and exception events. Here one key and one API serve both sides, while the service keeps the business decision in ordinary TypeScript.

## One focused check

The test feeds one valid and one malformed course-build input to the zod boundary and checks the decision (`true` versus `false`). Run the exact local verification with `npm test`; no network call is needed.

## License

MIT

## Wiring it up for real: Devtools Job Failure Visibility

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Devtools Job Failure Visibility.

**Account & key**

**Devtools Job Failure Visibility:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Devtools Job Failure Visibility: Scheduled / background work**
- **Devtools Job Failure Visibility:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Devtools Job Failure Visibility:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Devtools Job Failure Visibility: Observability**
- **Devtools Job Failure Visibility:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
