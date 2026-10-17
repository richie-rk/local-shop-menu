// Logic tests for app.js (CSV parser, quantities, opening hours). No dependencies.
// Run from the repo root:  node tests/logic.test.js
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const path = require("path");
const root = path.join(__dirname, "..");
const appPath = path.join(root, "app.js");
const cfgPath = path.join(root, "config.js");
const sandbox = {
  console, Intl, URL, Math, Date, JSON, setTimeout, clearTimeout, setInterval,
  document: { readyState: "loading", addEventListener() {}, querySelector() { return null; } },
  localStorage: { getItem() { return null; }, setItem() {} },
  location: { href: "http://localhost/" },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(cfgPath, "utf8"), sandbox);
vm.runInContext(fs.readFileSync(appPath, "utf8"), sandbox);
const M = sandbox.__shopMenu;

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok  " + name); }
const plain = (x) => JSON.parse(JSON.stringify(x));

// ---------- CSV ----------
test("quoted field with comma", () => {
  const rows = M.parseCSV('name,price\n"Whole, skinless",260\n');
  assert.deepStrictEqual(plain(rows), [["name", "price"], ["Whole, skinless", "260"]]);
});
test("escaped quotes, CRLF, BOM, newline inside quotes", () => {
  const rows = M.parseCSV('﻿name,description\r\n"A ""big"" bird","line1\nline2"\r\n');
  assert.deepStrictEqual(plain(rows), [["name", "description"], ['A "big" bird', "line1\nline2"]]);
});
test("whitespace before quote is tolerated", () => {
  const rows = M.parseCSV('a,b\n  "x, y" ,z');
  assert.strictEqual(rows[1][0].trim(), "x, y");
});
test("no trailing newline, empty fields", () => {
  assert.deepStrictEqual(plain(M.parseCSV("a,b,c\n1,,3")), [["a", "b", "c"], ["1", "", "3"]]);
});

const csv = [
  " Name , Category,Price,Unit,Available,Description,Image URL",
  "",
  "Chicken Curry Cut,Cuts,280,kg,Yes,Bone-in,https://example.com/a.jpg",
  ",,,,,,",
  '  Eggs  ,Eggs,"₹1,084.50",Dozen, no ,,javascript:alert(1)',
  "Bad Price,Cuts,abc,kg,Yes,,",
  "No Unit,Others,10,,,,https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing",
  "Chicken Curry Cut,Cuts,300,kg,Yes,dup,",
  "Wings,Cuts,240,KGS,Y,,",
].join("\n");

test("rows to items: headers, blanks, trimming, price, availability", () => {
  const items = plain(M.rowsToItems(M.parseCSV(csv)));
  assert.strictEqual(items.length, 5, "bad price row and blank rows skipped");
  const [curry, eggs, noUnit, dup, wings] = items;
  assert.strictEqual(curry.name, "Chicken Curry Cut");
  assert.strictEqual(curry.price, 280);
  assert.strictEqual(curry.unit, "kg");
  assert.strictEqual(curry.imageUrl, "https://example.com/a.jpg");
  assert.strictEqual(eggs.name, "Eggs");
  assert.strictEqual(eggs.price, 1084.5);
  assert.strictEqual(eggs.unit, "dozen");
  assert.strictEqual(eggs.available, false);
  assert.strictEqual(eggs.imageUrl, "", "non-http image rejected");
  assert.strictEqual(noUnit.available, true, "blank available = Yes");
  assert.strictEqual(noUnit.imageUrl, "https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOp&sz=w600");
  assert.notStrictEqual(dup.id, curry.id, "duplicate names get unique ids");
  assert.strictEqual(wings.unit, "kg", "unit alias normalised");
});
test("missing required columns throws", () => {
  assert.throws(() => M.rowsToItems(M.parseCSV("title,cost\nA,1")));
});
test("empty CSV gives no items", () => {
  assert.strictEqual(M.rowsToItems(M.parseCSV("\n\n")).length, 0);
});

// ---------- Sample menu file ----------
test("data/sample-menu.csv parses to 10 items", () => {
  const p = require("path").join(require("path").dirname(appPath), "data", "sample-menu.csv");
  const items = plain(M.rowsToItems(M.parseCSV(fs.readFileSync(p, "utf8"))));
  assert.strictEqual(items.length, 10);
  const skinless = items.find((i) => i.name === "Whole Chicken (skinless)");
  assert.strictEqual(skinless.description, "Fresh whole bird, skin removed");
  assert.strictEqual(skinless.price, 260);
  assert.ok(items.every((i) => i.imageUrl.startsWith("https://")), "every sample row has an image");
});

// ---------- Quantities ----------
test("kg uses 0.5 steps, others whole numbers", () => {
  assert.strictEqual(M.normaliseQty(1.26, "kg"), 1.5);
  assert.strictEqual(M.normaliseQty(1.24, "kg"), 1);
  assert.strictEqual(M.normaliseQty(0.5, "kg"), 0.5);
  assert.strictEqual(M.normaliseQty(1.5, "dozen"), 2);
  assert.strictEqual(M.normaliseQty(0.4, "piece"), 0);
  assert.strictEqual(M.normaliseQty(-3, "kg"), 0);
  assert.strictEqual(M.normaliseQty("abc", "kg"), 0);
  assert.strictEqual(M.normaliseQty(5000, "tray"), 999);
});

// ---------- Hours ----------
// Fixed fixture so tests do not depend on whatever hours a fork puts in config.js.
const SPLIT_SHIFT = { timezone: "Asia/Kolkata", schedule: [{ days: "Mon-Sun", slots: ["09:30-14:30", "18:00-22:00"] }] };
test("day parsing", () => {
  assert.deepStrictEqual(plain(M.parseDays("Mon-Sun")).sort(), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepStrictEqual(plain(M.parseDays("Fri-Mon")).sort(), [0, 1, 5, 6]);
  assert.deepStrictEqual(plain(M.parseDays("Mon, Wed & Fri")).sort(), [1, 3, 5]);
  assert.deepStrictEqual(plain(M.parseDays("daily")).length, 7);
  assert.deepStrictEqual(plain(M.parseDays("Sunday")), [0]);
});
test("slot parsing", () => {
  assert.deepStrictEqual(plain(M.parseSlot("09:30-14:30")), [570, 870]);
  assert.deepStrictEqual(plain(M.parseSlot("9:30 am - 2:30 pm")), [570, 870]);
  assert.deepStrictEqual(plain(M.parseSlot(["18:00", "22:00"])), [1080, 1320]);
  assert.strictEqual(M.parseSlot("nonsense"), null);
});
test("hours rows group identical days", () => {
  const hrs = M.buildHours(SPLIT_SHIFT);
  const rows = plain(M.hoursRows(hrs));
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].label, "Every day");
  assert.strictEqual(rows[0].value, "9:30 AM – 2:30 PM, 6:00 PM – 10:00 PM");
  const hrs2 = M.buildHours({ schedule: [{ days: "Mon-Sun", slots: ["08:00-20:00"] }, { days: "Tue", closed: true }] });
  const r2 = plain(M.hoursRows(hrs2)).map((r) => r.label + "=" + r.value);
  assert.deepStrictEqual(r2, ["Mon=8:00 AM – 8:00 PM", "Tue=Closed", "Wed–Sun=8:00 AM – 8:00 PM"]);
});

// openStatus at fixed times: freeze Date inside the sandbox.
function statusAt(iso, hoursConf) {
  const RealDate = Date;
  const fixed = new RealDate(iso);
  sandbox.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed.getTime()])); } static now() { return fixed.getTime(); } };
  vm.runInContext("Date = this.Date", sandbox);
  try { return plain(M.openStatus(M.buildHours(hoursConf))); }
  finally { sandbox.Date = RealDate; vm.runInContext("Date = this.Date", sandbox); }
}
const HRS = SPLIT_SHIFT;
test("open status (IST)", () => {
  // 2026-10-17 is a Saturday. IST = UTC+5:30.
  assert.deepStrictEqual(statusAt("2026-10-17T05:00:00Z", HRS), { open: true, soon: false, label: "Open now · until 2:30 PM" }); // 10:30
  assert.strictEqual(statusAt("2026-10-17T08:45:00Z", HRS).label, "Closing soon · 2:30 PM");                           // 14:15
  assert.strictEqual(statusAt("2026-10-17T10:00:00Z", HRS).label, "Closed · opens 6:00 PM");                          // 15:30
  assert.strictEqual(statusAt("2026-10-17T17:00:00Z", HRS).label, "Closed · opens tomorrow 9:30 AM");                 // 22:30
  assert.strictEqual(statusAt("2026-10-17T03:00:00Z", HRS).label, "Closed · opens 9:30 AM");                          // 08:30
  const sundayOnly = { timezone: "Asia/Kolkata", schedule: [{ days: "Sun", slots: ["10:00-12:00"] }] };
  assert.strictEqual(statusAt("2026-10-19T05:00:00Z", sundayOnly).label, "Closed · opens Sun 10:00 AM");              // Mon
  const overnight = { timezone: "Asia/Kolkata", schedule: [{ days: "Sat", slots: ["20:00-02:00"] }] };
  assert.strictEqual(statusAt("2026-10-17T19:30:00Z", overnight).open, true);                                         // Sun 01:00
});

console.log("\n" + passed + " tests passed");
