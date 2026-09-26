import { test } from "node:test";
import assert from "node:assert/strict";
import { spliceSection, taskCounts } from "./update-profile.mjs";

test("spliceSection replaces only what sits between the markers", () => {
  const readme = "top\n<!-- recently-shipped:start -->\nold\n<!-- recently-shipped:end -->\nbottom\n";
  assert.equal(
    spliceSection(readme, "- new"),
    "top\n<!-- recently-shipped:start -->\n- new\n<!-- recently-shipped:end -->\nbottom\n",
  );
});

test("spliceSection refuses a README without markers", () => {
  assert.throws(() => spliceSection("no markers here", "x"), /markers/);
});

test("taskCounts reads spec-kit checklists", () => {
  const md = "# Tasks\n- [x] T001 done\n- [X] T002 done\n  - [ ] T003 nested, open\n* [ ] T004 open\nnot - [x] a task\n";
  assert.deepEqual(taskCounts(md), { done: 2, total: 4 });
});
