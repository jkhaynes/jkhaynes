import { test } from "node:test";
import assert from "node:assert/strict";
import { pickShipped, spliceSection, taskCounts } from "./update-profile.mjs";

const change = (repo, date, kind = "pr") => ({ kind, repo: `jkhaynes/${repo}`, date, title: repo, url: "" });

test("pickShipped keeps only the newest change from each repo", () => {
  const picked = pickShipped([
    change("pricewatch", "2026-09-30T00:00:00.000Z"),
    change("pricewatch", "2026-09-29T00:00:00.000Z"),
    change("PokeJudge", "2026-09-27T00:00:00.000Z"),
    change("ten-or-not", "2026-10-02T00:00:00.000Z", "commit"),
  ]);
  assert.deepEqual(
    picked.map((c) => [c.repo, c.date]),
    [
      ["jkhaynes/ten-or-not", "2026-10-02T00:00:00.000Z"],
      ["jkhaynes/pricewatch", "2026-09-30T00:00:00.000Z"],
      ["jkhaynes/PokeJudge", "2026-09-27T00:00:00.000Z"],
    ],
  );
});

test("pickShipped prefers the PR when a commit from the same repo ties it", () => {
  const at = "2026-10-01T00:00:00.000Z";
  const [picked] = pickShipped([change("loot", at, "commit"), change("loot", at, "pr")]);
  assert.equal(picked.kind, "pr");
});

test("pickShipped skips the profile repo and stops at the count", () => {
  const changes = ["a", "b", "c", "jkhaynes"].map((r, i) => change(r, `2026-10-0${i + 1}T00:00:00.000Z`));
  assert.deepEqual(
    pickShipped(changes, 2).map((c) => c.repo),
    ["jkhaynes/c", "jkhaynes/b"],
  );
});

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
