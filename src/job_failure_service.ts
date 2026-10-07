import { z } from "zod";
import { infrai } from "./infrai.js";

export const BuildRequest = z.object({ courseId: z.string().min(1), artifactUrl: z.string().url() });
export type BuildRequest = z.infer<typeof BuildRequest>;

export async function registerBuild(request: BuildRequest, taskUrl: string) {
  const input = BuildRequest.parse(request);
  const job = await infrai.cron.create({ cron_expr: "*/15 * * * *", task: taskUrl }, `build-${input.courseId}`);
  const message = await infrai.queue.publish({ queue: "course-builds", payload: input }, `publish-${input.courseId}`);
  return { jobId: job.job_id, messageId: message.message_id };
}

export async function inspectBuildFailures(queueName: string, jobId: string) {
  const [deadLetters, runs] = await Promise.all([infrai.queue.dlq.list(queueName), infrai.cron.runs.list(jobId)]);
  const failedRuns = (runs.items ?? []).filter(run => run.status === "failed");
  return { deadLetterCount: deadLetters.messages?.length ?? 0, failedRuns };
}

export async function processOneBuild(queueName: string) {
  const result = await infrai.queue.consume({ queue: queueName, max_messages: 1, visibility_timeout: 60 });
  const message = result.messages?.[0];
  if (!message) return { state: "idle" as const };
  try {
    BuildRequest.parse(message.payload);
    await infrai.queue.ack({ queue: queueName, message_id: message.message_id }, `ack-${message.message_id}`);
    return { state: "completed" as const, messageId: message.message_id };
  } catch (exception) {
    await infrai.errors.capture({
      title: "Course build request validation failed",
      message: exception instanceof Error ? exception.message : String(exception),
      exception,
      context: { queue: queueName, messageId: message.message_id }
    }, `error-${message.message_id}`);
    return { state: "diagnostic-captured" as const, messageId: message.message_id };
  }
}

if (process.env.RUN_EXAMPLE === "1") {
  const request = BuildRequest.parse({ courseId: "algebra-101", artifactUrl: "https://cdn.example.edu/algebra.zip" });
  registerBuild(request, process.env.BUILD_TASK_URL ?? "https://example.edu/hooks/course-build").then(console.log);
}
