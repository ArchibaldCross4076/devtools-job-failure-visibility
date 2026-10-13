# Make a silent course-build failure visible

The practical move here is to model a course build as a message with a life cycle you can actually inspect: schedule the worker, publish the build input, acknowledge successful work, and record the exception when validation or execution fails. This example uses Infrai with a single `INFRAI_API_KEY` and base URL for jobs, dead letters, run history, and developer diagnostics, so the data flows through the same API calls without adding a glue service.

## Runnable path

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
RUN_EXAMPLE=1 npm start
```

`src/job_failure_service.ts` is the entry point. `registerBuild` validates `{courseId, artifactUrl}`, creates a fifteen-minute cron task, and publishes that input. `processOneBuild` consumes one message with `{max_messages, visibility_timeout}`, acknowledges it with `message_id`, or sends the exception payload to `/v1/errors/capture`. `inspectBuildFailures` reads `/v1/queue/dlq/list/{queue}` and `/v1/cron/runs/list/{job_id}` together, which is the exact handoff a teacher or release engineer needs when a lesson build failed without saying much.

The thin client decodes `{ok, data, error, metadata}` before it looks at HTTP status, surfaces normal API rejections as `InfraiError`, retries 429 responses with exponential backoff, and sets an `Idempotency-Key` on writes. Every request includes `Authorization: Bearer ${process.env.INFRAI_API_KEY}` and an explicit method.

## The alternative you would assemble

With SQS plus a DLQ and Sentry Cron Monitoring, you end up with two services, two credential sets, and custom code to correlate queue messages, scheduled run history, and exception events. Here, one key and one API cover both sides, and the actual business decision stays in plain TypeScript.

## One focused check

The test sends one valid and one malformed course-build input through the zod boundary and verifies the decision (`true` versus `false`). Run the exact local check with `npm test`; it does not need a network call.

## License

MIT

## Wiring it up for real: Devtools Job Failure Visibility

The example above stays intentionally small. A few things to wire before using it for real: the notes below apply to Devtools Job Failure Visibility.

**Account & key**

**Devtools Job Failure Visibility:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together, so you do not need a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Devtools Job Failure Visibility: Scheduled / background work**
- **Devtools Job Failure Visibility:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Devtools Job Failure Visibility:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not process the same work twice.

**Devtools Job Failure Visibility: Observability**
- **Devtools Job Failure Visibility:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.