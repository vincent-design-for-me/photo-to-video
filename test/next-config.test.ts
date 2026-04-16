import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config";

test("Next dev segment explorer is disabled to avoid RSC devtools manifest crashes", () => {
  assert.equal(nextConfig.experimental?.devtoolSegmentExplorer, false);
});
