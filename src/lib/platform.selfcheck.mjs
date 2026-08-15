// Runnable check for detectMobile() in platform.ts. Plain JS, not TS —
// this repo has no TS loader/test runner, so it mirrors the logic inline
// instead of importing it. Keep in sync with platform.ts by hand.
// Run: node src/lib/platform.selfcheck.mjs
import assert from "node:assert/strict";

function detectMobile(userAgent, platform, maxTouchPoints) {
  if (/android|iphone|ipod|ipad/i.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

assert.equal(detectMobile("Mozilla/5.0 (Linux; Android 14)", "Linux armv8l", 5), true, "Android phone");
assert.equal(detectMobile("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", "iPhone", 5), true, "iPhone");
assert.equal(detectMobile("Mozilla/5.0 (iPad; CPU OS 17_0)", "iPad", 5), true, "iPad (legacy UA)");
assert.equal(detectMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6)", "MacIntel", 5), true, "iPad disguised as Mac (touch)");
assert.equal(detectMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6)", "MacIntel", 0), false, "real Mac (no touch)");
assert.equal(detectMobile("Mozilla/5.0 (X11; Linux x86_64)", "Linux x86_64", 0), false, "desktop Linux");
assert.equal(detectMobile("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32", 0), false, "desktop Windows");

console.log("platform.selfcheck: ok (7 assertions)");
