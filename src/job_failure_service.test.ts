import assert from "node:assert/strict";
import { BuildRequest, processOneBuild } from "./job_failure_service.js";

const valid = BuildRequest.safeParse({ courseId: "lesson-7", artifactUrl: "https://cdn.example.edu/lesson.zip" });
assert.equal(valid.success, true);
const invalid = BuildRequest.safeParse({ courseId: "", artifactUrl: "bad" });
assert.equal(invalid.success, false);
console.log("build input decision: valid requests enter the queue; malformed requests are rejected");
void processOneBuild;
