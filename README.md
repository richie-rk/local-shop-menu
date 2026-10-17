# Local Shop Menu: Google Sheet menu + WhatsApp ordering

A free, open-source, mobile-first website template for small local shops that sell from a menu: chicken and meat shops, egg sellers, bakeries, tiffin services, kirana stores.

- **The menu lives in a Google Sheet.** Change a price or mark an item out of stock in the sheet, and the website updates by itself. No redeploy, no coding.
- **Customers order on WhatsApp.** They add items to a cart (0.5 kg steps for items sold by weight), choose pickup or home delivery, and tap one button. WhatsApp opens with the full order typed out for them.
- **Plain HTML, CSS and JavaScript.** No framework, no build step, no dependencies. Fast on low-end Android phones. Free hosting on Cloudflare Pages.

The first real deployment is **A1 Bharat Chicken Shop** (Vashi, Navi Mumbai). Its details are what you'll find in `config.js`.

---

## Contents

- [Features](#features)
- [Files](#files)
- [Try it on your computer](#try-it-on-your-computer)
- [1. Set up the Google Sheet](#1-set-up-the-google-sheet)
- [2. Google caches the published CSV (≈5 minutes)](#2-google-caches-the-published-csv-5-minutes)
- [3. Let more people edit the menu](#3-let-more-people-edit-the-menu)
- [4. Fill in `config.js`](#4-fill-in-configjs)
- [5. Create your own copy (fork or template) and get updates](#5-create-your-own-copy-fork-or-template-and-get-updates)
- [6. Deploy to Cloudflare Pages](#6-deploy-to-cloudflare-pages)
- [Menu sheet reference](#menu-sheet-reference)
- [Troubleshooting](#troubleshooting)
- [Image credits](#image-credits)
- [Licence](#licence)

---

## Features

| | |
|---|---|
| Live menu | Fetched from your published Google Sheet (CSV) on every page load, grouped by category in the order of the sheet |
| Robust parsing | Handles quoted fields, commas inside text, blank rows, stray spaces, extra columns, columns in any order, `₹`/commas in prices |
| Images | Optional per item. Missing or broken images show a neat letter placeholder. Google Drive share links are converted automatically |
| Out of stock | `available = No` greys the item out or hides it (your choice) |
| Cart | Add / − / + per item (0.5 steps for `kg`, whole numbers otherwise), sticky cart bar with count and total, saved on the phone between visits |
| Stale items | If an item is removed from the sheet or marked unavailable, it's dropped from saved carts with a short notice |
| Checkout | Name, pickup or home delivery, address (only for delivery), optional notes, delivery fee or **FREE delivery**, minimum order |
| WhatsApp | One tap opens `wa.me` with a pre-filled order: items, quantities, line totals, total, name, delivery details |
| Shop info | Open now / Closed badge from your opening hours (split shifts supported), address, embedded map, **Get directions**, call button, Google review link, floating WhatsApp chat button |
| Accessible | Proper labels, ≥44px tap targets, keyboard and screen-reader friendly, good colour contrast, respects reduced-motion |

## Files

```
index.html            Page structure (generic: no shop details)
styles.css            Styles (colours come from config.js)
app.js                All the logic
config.js             ← THE ONLY FILE A SHOP EDITS
config.example.js     Blank, commented copy of config.js
data/sample-menu.csv  Demo menu used when no sheet is configured
data/sample-menu.xlsx Same demo menu, ready to import into Google Sheets
_headers              Cloudflare Pages cache/security headers
favicon.svg           Generic icon (replaced by your logo if you set logoUrl)
tests/logic.test.js   Parser / quantity / opening-hours tests: `node tests/logic.test.js`
```

> **Rule for this repository:** it is the general template. Nothing shop-specific may live outside `config.js`. Shops make their own copy and change only `config.js` (and the Google Sheet it points to).

## Try it on your computer

The page loads the menu with `fetch()`, which browsers block for files opened straight from disk (`file://`). Serve the folder instead:

```bash
# any one of these, run inside the project folder
python -m http.server 8000
npx serve .
```

Then open <http://localhost:8000>.

---

## 1. Set up the Google Sheet

### a) Create the sheet from the sample

1. Download [`data/sample-menu.xlsx`](data/sample-menu.xlsx) from this repo.
2. Open <https://sheets.new> (a new, blank Google Sheet) while signed in to the shop's Google account.
3. **File → Import → Upload** → choose `sample-menu.xlsx`.
4. Pick **Replace spreadsheet** → **Import data**.
5. Rename the spreadsheet (e.g. "Shop menu") and check that the tab at the bottom is called **Menu**.

The imported sheet already has a dropdown for `available` (Yes/No), a hint for `unit`, and a check that `price` is a number.

> Uploading the .xlsx to Drive and opening it also works, but then use **File → Save as Google Sheets** first. "Publish to web" only works on real Google Sheets, not on .xlsx files.

### b) Column structure

Row 1 must be the header row. Column order doesn't matter, and header names aren't case-sensitive.

| Column | Required | Example | Notes |
|---|---|---|---|
| `name` | ✅ | Chicken Curry Cut | Shown as the item title. Rows without a name are ignored |
| `category` | | Cuts | Items are grouped by this, in the order categories first appear. Blank = "Other" |
| `price` | ✅ | 280 | Number only (₹ and commas are tolerated). Rows with no valid price are skipped |
| `unit` | | kg | `kg`, `piece`, `dozen`, `tray`, `plate` (others are shown as typed). **`kg` allows 0.5 steps**; all others whole numbers |
| `available` | | Yes | `No` = out of stock. Blank counts as Yes |
| `description` | | Bone-in pieces ready for curry | Optional short line |
| `imageUrl` | | https://… | Optional. Must start with `https://`. See [images](#item-images) |

Adding a row adds an item on the site; deleting a row removes it. No redeploy is needed.

### c) Publish to web as CSV

1. In the sheet: **File → Share → Publish to web**.
2. Under **Link**, change "Entire document" to the **Menu** sheet, and "Web page" to **Comma-separated values (.csv)**.
3. Click **Publish** → **OK**.
4. Copy the link. It looks like:
   `https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=0&single=true&output=csv`
5. Paste it into `config.js` as `sheetCsvUrl` (see [step 4](#4-fill-in-configjs)).

Keep **"Automatically republish when changes are made"** ticked (under *Published content & settings*); it is on by default.

> Publishing makes **only the published tab** readable by anyone with the link (read-only). Don't put private information (costs, supplier numbers) on that tab. Use a separate tab for it.

## 2. Google caches the published CSV (≈5 minutes)

Google serves the published CSV from a cache. After you edit the sheet, the website can take **up to about 5 minutes** to show the change. This is normal, so wait a few minutes and reload. The site already asks for a fresh copy on every load (cache-busting), but it can't bypass Google's own publishing delay.

For an urgent change, such as an item suddenly sold out, update the sheet and tell customers who message on WhatsApp in the meantime.

## 3. Let more people edit the menu

1. Open the sheet → **Share** (top right).
2. Add each person's Google email address and choose **Editor**.
3. Untick "Notify people" if you don't want an email sent, then **Share**.

Tips:

- **Anyone with edit access can change prices on the live website.** Only add people you trust. Never set general access to "Anyone with the link → Editor".
- Protect the header row so nobody renames a column by accident: select row 1 → **Data → Protect sheets and ranges** → *Set permissions* → only you.
- **File → Version history** shows who changed what, and lets you restore an older version.
- Editors can use the Google Sheets app on their phone. Changes go live the same way (within ≈5 min).

## 4. Fill in `config.js`

`config.js` is the only file a shop changes. Open it in any text editor (or edit it directly on GitHub: open the file → ✏️ pencil icon → *Commit changes*). Keep the quotes and commas as they are. Leave optional text as `""` to hide it.

`config.example.js` is a blank, fully commented copy to start from.

| Setting | What it does |
|---|---|
| `shopName`, `tagline`, `businessType` | Shown in the header and browser tab |
| `logoUrl` | Square logo image (`https://…`). Empty = initials badge |
| `phone` | Shown as typed; adds **Call** buttons |
| `whatsappNumber` | **Required for ordering.** Country code + number, digits only: `918097984544` (not `+91 80979 84544`, not `08097984544`) |
| `googleReviewUrl` | Optional "Rate us on Google" link. Find it in Google Business Profile → *Ask for reviews*, or use `https://search.google.com/local/writereview?placeid=<your place id>` |
| `highlights` | Short chips under the tagline, e.g. `["Fresh cut daily", "Wholesale rates"]` |
| `delivery.enabled` | `false` = pickup only (the choice is hidden) |
| `delivery.free` | `true` shows a **FREE home delivery** banner and FREE in the cart |
| `delivery.charge`, `delivery.freeAbove` | Delivery fee when not free, and an optional order total above which delivery becomes free |
| `delivery.minOrder` | Minimum order total for delivery (`0` = none) |
| `delivery.note` | Short note such as `"Vashi & nearby sectors"` |
| `openingHours` | Days + time slots in 24h format. Drives the Open now / Closed badge (see below) |
| `location.*` | Address lines, optional landmark, `latitude`/`longitude` (for the map and directions), `googleMapsUrl`, `showMap` |
| `currencySymbol`, `locale` | `"₹"` and `"en-IN"` by default |
| `sheetCsvUrl` | Your published CSV link. Empty = the demo menu in `data/sample-menu.csv` |
| `showOutOfStock` | `"greyed"` (shown with an "Out of stock" label) or `"hide"` |
| `orderMessageTemplate` | First line of the WhatsApp order; `{shopName}` is filled in |
| `theme.*` | Colours and optional Google Font. Keep `primary` dark enough for white text |
| `footerCredit` | Footer credit link; `enabled: false` hides it |

**Opening hours examples**

```js
// Two shifts every day (A1 Bharat)
openingHours: { timezone: "Asia/Kolkata", schedule: [
  { days: "Mon-Sun", slots: ["09:30-14:30", "18:00-22:00"] }
]}

// Different Sunday hours and a weekly holiday (later lines override earlier ones)
openingHours: { timezone: "Asia/Kolkata", schedule: [
  { days: "Mon-Sun", slots: ["08:00-21:00"] },
  { days: "Sun",     slots: ["08:00-13:00"] },
  { days: "Tue",     closed: true }
], note: "Closed on public holidays" }

// Just text (no Open/Closed badge)
openingHours: "9 am – 9 pm, all days"
```

**Getting latitude and longitude:** open Google Maps, right-click (on a phone, long-press) exactly on your shop. The first item in the menu is the coordinates, e.g. `19.07925, 72.99768`. Tap it to copy, then put the first number in `latitude` and the second in `longitude`.

**`googleMapsUrl`:** in Google Maps, open your shop → **Share** → **Copy link**.

## 5. Create your own copy (fork or template) and get updates

Each shop gets its own repository that differs from this template **only in `config.js`**. That keeps pulling in future improvements painless.

### Option A: Fork (your copy is public)

1. On this repository's GitHub page click **Fork** → **Create fork**.
2. In your fork, edit `config.js` (GitHub web editor is fine) and commit.
3. Deploy it ([step 6](#6-deploy-to-cloudflare-pages)).

**Getting updates:** on your fork's page, click **Sync fork → Update branch**. Because you only changed `config.js`, there are normally no conflicts.

### Option B: "Use this template" (your copy can be private)

1. On this repository's page click **Use this template → Create a new repository**, choose *Private* if you like.
   *(Repository owners: enable this under Settings → General → ✅ Template repository.)*
2. Edit `config.js`, commit, and deploy.

**Getting updates:** template copies don't share history with the original, so add it as a remote once:

```bash
git clone https://github.com/<you>/<your-shop-repo>.git
cd <your-shop-repo>
git remote add upstream https://github.com/<template-owner>/<template-repo>.git
git fetch upstream

# first time only: histories are unrelated
git merge upstream/main --allow-unrelated-histories
# keep YOUR config.js if git reports a conflict there:
git checkout --ours config.js && git add config.js && git commit

git push
```

Later updates are just:

```bash
git fetch upstream
git merge upstream/main
git push
```

> After updating, compare your `config.js` with the new `config.example.js`. New features may add optional settings. Missing settings fall back to sensible defaults, so nothing breaks if you skip this.

## 6. Deploy to Cloudflare Pages

It's free and gives you a `https://<project>.pages.dev` address.

1. Push your repository to GitHub (forks/template copies already are).
2. Log in to <https://dash.cloudflare.com> (free account) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** (*Import an existing Git repository*).
3. Authorise GitHub and select your shop's repository.
4. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/` (the repository root)
5. **Save and Deploy**. After a minute your site is live at `https://<project-name>.pages.dev`.

Every push to the main branch redeploys automatically. **Menu changes in the Google Sheet never need a redeploy.**

*No GitHub?* Choose **Upload assets** (Direct Upload) instead of Connect to Git and drag in the project folder. You'll need to upload again after editing `config.js`.

### Optional: custom domain

Pages project → **Custom domains** → **Set up a custom domain** → enter e.g. `a1bharatchicken.in` (bought from any registrar) and follow the DNS instructions. If the domain's DNS is on Cloudflare, it's set up for you. HTTPS is automatic.

The included `_headers` file tells browsers to check for a fresh copy of every file on each visit (cheap, thanks to ETags), so config edits show up straight after a deploy.

---

## Menu sheet reference

### Item images

- Use a direct image link that starts with `https://` and opens just the picture in the browser.
- **Google Drive:** upload the photo, then *Share → General access → Anyone with the link (Viewer)*, copy the link, and paste it in `imageUrl`. The site converts Drive links to a displayable thumbnail automatically.
- Keep images reasonably small (≈600px wide is plenty). They're shown as small square thumbnails and lazy-loaded.
- Broken links fall back to a letter placeholder, so a bad link never breaks the page.
- Best of all: your own photos of your own products.

### Quantities

| unit | Steps | Example in the order |
|---|---|---|
| `kg` | 0.5, 1, 1.5, 2… | `1.5 kg × ₹280/kg = ₹420` |
| `piece`, `dozen`, `tray`, `plate`, others | 1, 2, 3… | `2 dozen × ₹84/dozen = ₹168` |

### Example WhatsApp order

```
Hi A1 Bharat Chicken Shop! I'd like to place an order:

1. Chicken Curry Cut: 1.5 kg × ₹280/kg = ₹420
2. Eggs: 2 dozen × ₹84/dozen = ₹168

Subtotal: ₹588
Delivery: FREE
*Total: ₹588*

Name: Rahul
Order type: Home delivery
Address: Flat 12, Sai Darshan, Sector 17, Vashi
Notes: Small pieces please
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "We couldn't load the menu right now" | Open your `sheetCsvUrl` in a browser. It should download/show plain comma-separated text. If it shows a web page or a sign-in screen, re-do [Publish to web](#c-publish-to-web-as-csv) choosing **CSV** and the **Menu** sheet |
| Menu works online but not on my computer | Don't double-click `index.html`; [serve the folder](#try-it-on-your-computer) |
| Sheet changes don't appear | Wait ≈5 minutes ([why](#2-google-caches-the-published-csv-5-minutes)) and reload. Check "Automatically republish" is on |
| An item is missing | Its `name` is empty or `price` isn't a number. The browser console (F12) lists skipped rows |
| WhatsApp opens the wrong chat / "invalid number" | `whatsappNumber` must be digits only with country code: `91` + 10-digit number |
| Map shows the wrong place | Re-copy `latitude`/`longitude` from Google Maps (right-click on the shop) |
| Open/Closed badge is wrong | Check `openingHours` slot format (`"HH:MM-HH:MM"`, 24h) and `timezone` |

## Image credits

Demo images in `data/sample-menu.csv`. Shops should replace them with their own photos.

| Item | Photo | Licence |
|---|---|---|
| Whole Chicken (with skin) | [JK Sloan on Unsplash](https://unsplash.com/photos/raw-chicken-meat-on-brown-wooden-chopping-board-9zLa37VNL38) | [Unsplash Licence](https://unsplash.com/license) |
| Whole Chicken (skinless) | [Hayley Ryczek on Unsplash](https://unsplash.com/photos/a-raw-chicken-on-a-cutting-board-with-herbs-and-seasonings-oqZ7gu3ytDg) | [Unsplash Licence](https://unsplash.com/license) |
| Chicken Boneless | [Zehra Yılmaz on Pexels](https://www.pexels.com/photo/raw-meat-on-a-frying-pan-23359724/) | [Pexels Licence](https://www.pexels.com/license/) |
| Chicken Drumsticks | [Julia Filirovska on Pexels](https://www.pexels.com/photo/fresh-chicken-legs-with-spices-covered-with-grill-grate-7140306/) | [Pexels Licence](https://www.pexels.com/license/) |
| Chicken Wings | [Ragil Tagiyev on Pexels](https://www.pexels.com/photo/raw-chicken-on-a-tray-6281484/) | [Pexels Licence](https://www.pexels.com/license/) |
| Chicken Liver & Gizzard | [Ragil Tagiyev on Pexels](https://www.pexels.com/photo/raw-meat-on-the-wooden-chopping-board-6281495/) | [Pexels Licence](https://www.pexels.com/license/) |

Unsplash and Pexels photos are free to use, and attribution is appreciated but not required. The Chicken Curry Cut, Chicken Breast and Eggs image links came with the original project brief and are hosted by third parties (wlimg.com, freepik.com, foodrepublic.com). They are **not** covered by a free licence, so a live shop should replace them with its own photos.

## Licence

[MIT](LICENSE). Free to use, change and share, including for commercial shops.
