/*!
 * Local Shop Menu: app.js
 * Live Google Sheet menu + cart-to-WhatsApp ordering.
 * Vanilla JS, no dependencies, no build step. MIT licence.
 *
 * Everything shop-specific comes from window.SHOP_CONFIG (config.js).
 * Do not hardcode shop details here; forks should only edit config.js.
 */
(function () {
  "use strict";

  /* ======================================================================
   * Config
   * ==================================================================== */

  var DEFAULTS = {
    shopName: "Our Shop",
    tagline: "",
    logoUrl: "",
    businessType: "",
    phone: "",
    whatsappNumber: "",
    googleReviewUrl: "",
    highlights: [],
    openingHours: { timezone: "Asia/Kolkata", schedule: [], note: "" },
    delivery: { enabled: true, free: false, charge: 0, freeAbove: 0, minOrder: 0, note: "" },
    location: {
      addressLine: "", area: "", city: "", state: "", pincode: "", landmark: "",
      latitude: null, longitude: null, googleMapsUrl: "", showMap: true
    },
    currencySymbol: "₹",
    locale: "en-IN",
    sheetCsvUrl: "",
    fallbackCsvUrl: "data/sample-menu.csv",
    theme: {},
    footerCredit: { enabled: false, text: "", url: "" },
    orderMessageTemplate: "Hi {shopName}! I'd like to place an order:",
    showOutOfStock: "greyed"
  };

  function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }
  function deepMerge(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (!isPlainObject(extra)) return out;
    Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      if (v === undefined) return;
      out[k] = isPlainObject(v) && isPlainObject(base[k]) ? deepMerge(base[k], v) : v;
    });
    return out;
  }

  var cfg = deepMerge(DEFAULTS, window.SHOP_CONFIG || {});
  if (!window.SHOP_CONFIG) console.warn("[menu] config.js not found or empty; using defaults.");

  /* ======================================================================
   * Small helpers
   * ==================================================================== */

  function $(id) { return document.getElementById(id); }
  function str(v) { return v == null ? "" : String(v).trim(); }
  function hasValue(v) { return str(v) !== ""; }

  function slug(s) {
    return str(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
  }

  /** Tiny element builder. Text is always set via textNodes (never innerHTML). */
  function h(tag, props, children) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else el.setAttribute(k, v === true ? "" : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }

  function safeUrl(u) {
    u = str(u);
    return /^https?:\/\//i.test(u) ? u : "";
  }

  function digitsOnly(s) { return str(s).replace(/\D/g, ""); }

  var numberFmt;
  try { numberFmt = new Intl.NumberFormat(cfg.locale, { maximumFractionDigits: 2 }); }
  catch (e) { numberFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }); }

  function round2(n) { return Math.round(n * 100) / 100; }
  function money(n) { return cfg.currencySymbol + numberFmt.format(round2(n)); }

  var UNIT_ALIASES = {
    kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
    pc: "piece", pcs: "piece", pieces: "piece", nos: "piece", no: "piece",
    doz: "dozen", dozens: "dozen",
    trays: "tray", plates: "plate"
  };
  var UNIT_PLURALS = { piece: "pieces", tray: "trays", plate: "plates", packet: "packets", box: "boxes", litre: "litres", bottle: "bottles" };

  function normaliseUnit(u) {
    u = str(u).toLowerCase().replace(/\.$/, "");
    return UNIT_ALIASES[u] || u;
  }
  function unitLabel(unit, qty) {
    if (!unit) return "";
    return qty !== 1 && UNIT_PLURALS[unit] ? UNIT_PLURALS[unit] : unit;
  }
  /** 0.5 steps for kg; whole numbers for everything else. */
  function stepFor(unit) { return unit === "kg" ? 0.5 : 1; }
  var MAX_QTY = 999;
  function normaliseQty(q, unit) {
    var s = stepFor(unit);
    q = Math.round(Number(q) / s) * s;
    if (!isFinite(q) || q <= 0) return 0;
    return Math.min(round2(q), MAX_QTY);
  }
  function fmtQty(q, unit) {
    var label = unitLabel(unit, q);
    return numberFmt.format(q) + (label ? " " + label : "");
  }

  /* ======================================================================
   * CSV parsing (RFC 4180 + leniency for hand-edited sheets)
   * ==================================================================== */

  function parseCSV(text) {
    var rows = [], row = [], field = "", inQuotes = false, i = 0, c;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
    var n = text.length;
    while (i < n) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field.trim() === "") { inQuotes = true; field = ""; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\r" || c === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
        if (c === "\r" && text[i + 1] === "\n") i++;
        i++; continue;
      }
      field += c; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  var HEADER_ALIASES = {
    name: "name", item: "name", itemname: "name", product: "name",
    category: "category", section: "category",
    price: "price", rate: "price", mrp: "price",
    unit: "unit", per: "unit", uom: "unit",
    available: "available", availability: "available", instock: "available", stock: "available",
    description: "description", desc: "description", details: "description",
    imageurl: "imageUrl", image: "imageUrl", imagelink: "imageUrl", photo: "imageUrl", img: "imageUrl"
  };

  var UNAVAILABLE_RE = /^(no|n|false|0|out|out of stock|sold out|unavailable|na|n\/a)$/i;

  /** Converts Google Drive share links into an embeddable thumbnail URL. */
  function normaliseImageUrl(u) {
    u = safeUrl(u);
    if (!u) return "";
    var m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/);
    if (m) return "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w600";
    return u;
  }

  function rowsToItems(rows) {
    var nonBlank = rows.filter(function (r) {
      return r.some(function (cell) { return str(cell) !== ""; });
    });
    if (!nonBlank.length) return [];

    var header = nonBlank[0].map(function (h) {
      return HEADER_ALIASES[str(h).toLowerCase().replace(/[^a-z]/g, "")] || null;
    });
    if (header.indexOf("name") < 0 || header.indexOf("price") < 0) {
      throw new MenuError("format", "Menu sheet must have at least 'name' and 'price' columns. Found: " + nonBlank[0].join(", "));
    }

    var items = [], seen = {};
    nonBlank.slice(1).forEach(function (cells) {
      var rec = {};
      header.forEach(function (key, col) { if (key && rec[key] === undefined) rec[key] = str(cells[col]); });

      var name = rec.name;
      var price = parseFloat(String(rec.price || "").replace(/[^0-9.\-]/g, ""));
      if (!name) return;
      if (!isFinite(price) || price < 0) {
        console.warn("[menu] Skipping \"" + name + "\": invalid price \"" + rec.price + "\"");
        return;
      }
      var unit = normaliseUnit(rec.unit);
      var id = slug(name) + "--" + slug(unit || "each");
      if (seen[id]) { seen[id]++; id += "-" + seen[id]; } else { seen[id] = 1; }

      items.push({
        id: id,
        name: name,
        category: rec.category || "Other",
        price: round2(price),
        unit: unit,
        available: !UNAVAILABLE_RE.test(rec.available || ""),
        description: rec.description || "",
        imageUrl: normaliseImageUrl(rec.imageUrl)
      });
    });
    return items;
  }

  function MenuError(kind, message) { this.kind = kind; this.message = message; }
  MenuError.prototype = Object.create(Error.prototype);

  /* ======================================================================
   * Opening hours
   * ==================================================================== */

  var DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var WEEK = 7 * 1440;

  function dayIndex(t) { return DAY_KEYS.indexOf(str(t).toLowerCase().slice(0, 3)); }

  function parseDays(spec) {
    if (Array.isArray(spec)) spec = spec.join(",");
    var s = str(spec).toLowerCase();
    var out = [];
    if (!s || /^(daily|every ?day|all|all days)$/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
    s.split(/\s*(?:,|&|\/|\band\b)\s*/).forEach(function (part) {
      if (!part) return;
      var ends = part.split(/\s*(?:-|–|—|\bto\b)\s*/);
      var a = dayIndex(ends[0]), b = ends.length > 1 ? dayIndex(ends[ends.length - 1]) : a;
      if (a < 0 || b < 0) return;
      for (var d = a; ; d = (d + 1) % 7) {
        if (out.indexOf(d) < 0) out.push(d);
        if (d === b) break;
      }
    });
    return out;
  }

  function parseTime(t) {
    var m = str(t).toLowerCase().replace(/\./g, ":").match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!m) return NaN;
    var hh = +m[1], mm = +(m[2] || 0);
    if (m[3] === "pm" && hh < 12) hh += 12;
    if (m[3] === "am" && hh === 12) hh = 0;
    if (hh > 24 || mm > 59) return NaN;
    return hh * 60 + mm;
  }

  function parseSlot(slot) {
    var a, b;
    if (Array.isArray(slot)) { a = slot[0]; b = slot[1]; }
    else if (isPlainObject(slot)) { a = slot.open; b = slot.close; }
    else {
      var p = str(slot).split(/\s*(?:–|—|\bto\b|-)\s*/);
      a = p[0]; b = p[1];
    }
    var s = parseTime(a), e = parseTime(b);
    return isNaN(s) || isNaN(e) ? null : [s, e];
  }

  /** Returns { week: [slots for Sun..Sat], timezone, note, text } or null. */
  function buildHours(raw) {
    if (typeof raw === "string") return hasValue(raw) ? { text: raw.trim() } : null;
    var conf = Array.isArray(raw) ? { schedule: raw } : (raw || {});
    var schedule = conf.schedule || [];
    if (!schedule.length) return hasValue(conf.note) ? { text: conf.note } : null;

    var week = [[], [], [], [], [], [], []];
    var defined = [false, false, false, false, false, false, false];
    schedule.forEach(function (entry) {
      var days = parseDays(entry.days);
      var slots = entry.closed ? [] : (entry.slots || []).map(parseSlot).filter(Boolean);
      days.forEach(function (d) { week[d] = slots; defined[d] = true; }); // later entries override
    });
    return {
      week: week,
      defined: defined,
      timezone: conf.timezone || "Asia/Kolkata",
      note: str(conf.note)
    };
  }

  function nowInZone(tz) {
    var d = new Date();
    try {
      var parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, weekday: "short", hour: "numeric", minute: "numeric", hour12: false
      }).formatToParts(d);
      var get = function (t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ""; };
      var day = DAY_LABELS.indexOf(get("weekday"));
      var hh = (+get("hour")) % 24, mm = +get("minute");
      if (day >= 0) return { day: day, mins: hh * 60 + mm };
    } catch (e) { /* fall through to device time */ }
    return { day: d.getDay(), mins: d.getHours() * 60 + d.getMinutes() };
  }

  function fmtTime(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    var hh = Math.floor(mins / 60), mm = mins % 60;
    var ap = hh >= 12 ? "PM" : "AM";
    hh = hh % 12 || 12;
    return hh + ":" + (mm < 10 ? "0" : "") + mm + " " + ap;
  }

  function weekIntervals(hours) {
    var list = [];
    hours.week.forEach(function (slots, d) {
      slots.forEach(function (s) {
        var start = d * 1440 + s[0];
        var end = d * 1440 + (s[1] > s[0] ? s[1] : s[1] + 1440); // overnight / 24h
        list.push([start, end]);
      });
    });
    return list;
  }

  /** { open: bool, soon: bool, label: string } */
  function openStatus(hours) {
    if (!hours || !hours.week) return null;
    var now = nowInZone(hours.timezone);
    var t = now.day * 1440 + now.mins;
    var iv = weekIntervals(hours);
    if (!iv.length) return { open: false, label: "Closed" };

    for (var i = 0; i < iv.length; i++) {
      for (var k = -1; k <= 0; k++) {
        var s = iv[i][0] + k * WEEK, e = iv[i][1] + k * WEEK;
        if (t >= s && t < e) {
          var left = e - t;
          return { open: true, soon: left <= 30, label: (left <= 30 ? "Closing soon · " : "Open now · until ") + fmtTime(e) };
        }
      }
    }
    var next = Infinity;
    iv.forEach(function (x) {
      [x[0], x[0] + WEEK].forEach(function (s) { if (s > t && s < next) next = s; });
    });
    var dayDiff = Math.floor(next / 1440) - now.day;
    var when = dayDiff === 0 ? "" : dayDiff === 1 ? "tomorrow " : DAY_LABELS[Math.floor(next / 1440) % 7] + " ";
    return { open: false, label: "Closed · opens " + when + fmtTime(next) };
  }

  /** Groups consecutive days with identical slots, Monday first. */
  function hoursRows(hours) {
    var order = [1, 2, 3, 4, 5, 6, 0];
    var key = function (d) {
      return hours.defined[d] ? hours.week[d].map(function (s) { return s.join("-"); }).join(",") : "?";
    };
    var rows = [];
    order.forEach(function (d) {
      var last = rows[rows.length - 1];
      if (last && last.key === key(d)) last.days.push(d);
      else rows.push({ key: key(d), days: [d] });
    });
    return rows.filter(function (r) { return r.key !== "?"; }).map(function (r) {
      var first = r.days[0], lastD = r.days[r.days.length - 1];
      var label = r.days.length === 7 ? "Every day" :
        r.days.length === 1 ? DAY_LABELS[first] : DAY_LABELS[first] + "–" + DAY_LABELS[lastD];
      var slots = hours.week[first];
      var lines = slots.length ? slots.map(function (s) { return fmtTime(s[0]) + " – " + fmtTime(s[1]); }) : ["Closed"];
      return { label: label, value: lines.join(", "), lines: lines, days: r.days };
    });
  }

  /* ======================================================================
   * State + persistence
   * ==================================================================== */

  var STORE_KEY = "shopmenu:" + slug(cfg.shopName) + ":v1";
  var state = {
    menu: [],          // items from the sheet
    byId: {},          // id -> item
    cart: {},          // id -> qty
    cartNames: {},     // id -> item name, to name items that later vanish from the sheet
    customer: { name: "", orderType: "", address: "" },
    hours: buildHours(cfg.openingHours),
    status: null
  };

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (isPlainObject(data.cart)) state.cart = data.cart;
      if (isPlainObject(data.cartNames)) state.cartNames = data.cartNames;
      if (isPlainObject(data.customer)) state.customer = deepMerge(state.customer, data.customer);
    } catch (e) { /* storage blocked or corrupt; start fresh */ }
  }
  function saveStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ cart: state.cart, cartNames: state.cartNames, customer: state.customer }));
    } catch (e) { /* ignore */ }
  }

  /** Remove cart entries that no longer exist (or are unavailable) in the live sheet. */
  function reconcileCart() {
    var removed = [];
    Object.keys(state.cart).forEach(function (id) {
      var item = state.byId[id];
      var qty = item ? normaliseQty(state.cart[id], item.unit) : 0;
      if (!item || !item.available || !qty) {
        removed.push(item ? item.name : state.cartNames[id] || "");
        delete state.cart[id];
        delete state.cartNames[id];
      } else {
        state.cart[id] = qty;
        state.cartNames[id] = item.name;
      }
    });
    saveStore();
    return removed;
  }

  function cartLines() {
    return state.menu.filter(function (it) { return state.cart[it.id] > 0; }).map(function (it) {
      var qty = state.cart[it.id];
      return { item: it, qty: qty, total: round2(it.price * qty) };
    });
  }

  function deliveryEnabled() { return cfg.delivery && cfg.delivery.enabled !== false; }

  function totals() {
    var lines = cartLines();
    var subtotal = round2(lines.reduce(function (s, l) { return s + l.total; }, 0));
    var isDelivery = deliveryEnabled() && state.customer.orderType === "delivery";
    var fee = 0;
    if (isDelivery && !cfg.delivery.free) {
      var freeAbove = Number(cfg.delivery.freeAbove) || 0;
      fee = freeAbove && subtotal >= freeAbove ? 0 : Number(cfg.delivery.charge) || 0;
    }
    return { lines: lines, subtotal: subtotal, isDelivery: isDelivery, fee: fee, total: round2(subtotal + fee) };
  }

  /* ======================================================================
   * Static shop info rendering
   * ==================================================================== */

  function applyTheme() {
    var t = cfg.theme || {};
    var map = {
      primary: "--c-primary", primaryDark: "--c-primary-dark", onPrimary: "--c-on-primary",
      accent: "--c-accent", onAccent: "--c-on-accent",
      background: "--c-bg", surface: "--c-surface", text: "--c-text", muted: "--c-muted",
      border: "--c-border", whatsapp: "--c-wa", whatsappDark: "--c-wa-dark"
    };
    var root = document.documentElement.style;
    Object.keys(map).forEach(function (k) { if (hasValue(t[k])) root.setProperty(map[k], t[k]); });
    if (hasValue(t.fontFamily)) root.setProperty("--font", t.fontFamily);
    if (safeUrl(t.googleFontUrl)) {
      document.head.appendChild(h("link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }));
      document.head.appendChild(h("link", { rel: "stylesheet", href: t.googleFontUrl }));
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && hasValue(t.primary)) meta.setAttribute("content", t.primary);
  }

  function setText(id, value) {
    var el = $(id);
    el.textContent = str(value);
    el.hidden = !hasValue(value);
    return el;
  }

  function initials(name) {
    var words = str(name).split(/\s+/).filter(function (w) { return /[A-Za-z0-9]/.test(w); });
    return (words.slice(0, 2).map(function (w) { return w[0]; }).join("") || "•").toUpperCase();
  }

  function waLink(text) {
    var num = digitsOnly(cfg.whatsappNumber);
    if (!num) return "";
    return "https://wa.me/" + num + (text ? "?text=" + encodeURIComponent(text) : "");
  }
  function telLink() {
    var p = str(cfg.phone).replace(/[^\d+]/g, "");
    return p ? "tel:" + p : "";
  }

  function fullAddress() {
    var L = cfg.location || {};
    var cityLine = [L.city, L.state].filter(hasValue).join(", ");
    if (hasValue(L.pincode)) cityLine = (cityLine ? cityLine + " " : "") + str(L.pincode);
    return [L.addressLine, L.area, cityLine].filter(hasValue).map(str);
  }

  function hasCoords() {
    var L = cfg.location || {};
    var lat = parseFloat(L.latitude), lng = parseFloat(L.longitude);
    return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  }

  function renderShopInfo() {
    document.title = cfg.shopName + (hasValue(cfg.tagline) ? " | " + cfg.tagline : " | Menu");
    var desc = document.querySelector('meta[name="description"]');
    if (desc && hasValue(cfg.tagline)) desc.setAttribute("content", cfg.shopName + ": " + cfg.tagline + ". See the menu and order on WhatsApp.");

    // Header
    $("shop-name").textContent = cfg.shopName;
    setText("business-type", cfg.businessType);
    var logo = $("logo");
    var logoUrl = safeUrl(cfg.logoUrl);
    if (logoUrl) {
      var img = h("img", { src: logoUrl, alt: "", width: "48", height: "48" });
      img.addEventListener("error", function () { logo.textContent = initials(cfg.shopName); }, { once: true });
      logo.appendChild(img);
      var icon = document.querySelector('link[rel="icon"]');
      if (icon) { icon.href = logoUrl; icon.removeAttribute("type"); }
    } else {
      logo.textContent = initials(cfg.shopName);
    }

    // Hero
    setText("tagline", cfg.tagline);
    var d = cfg.delivery || {};
    if (deliveryEnabled() && (d.free || hasValue(d.note))) {
      var bannerText = d.free ? "FREE home delivery" : "Home delivery available";
      if (hasValue(d.note)) bannerText += " · " + str(d.note);
      $("delivery-banner-text").textContent = bannerText;
      $("delivery-banner").hidden = false;
    }
    var hl = (cfg.highlights || []).filter(hasValue);
    if (hl.length) {
      var ul = $("highlights");
      hl.forEach(function (t) { ul.appendChild(h("li", { text: str(t) })); });
      ul.hidden = false;
    }
    var tel = telLink(), wa = waLink("");
    if (tel) { $("hero-call").href = tel; $("hero-call").hidden = false; }
    if (wa) {
      var hello = waLink("Hi " + cfg.shopName + "! I have a question.");
      $("hero-wa").href = hello;
      $("hero-wa").hidden = false;
      $("wa-fab").href = hello;
      $("wa-fab").hidden = false;
    }

    renderLocation();
    renderHours();
    renderContact();
    $("visit").hidden = $("location-card").hidden && $("hours-card").hidden && $("contact-card").hidden;

    // Footer
    $("footer-copy").textContent = "© " + new Date().getFullYear() + " " + cfg.shopName;
    var fc = cfg.footerCredit || {};
    if (fc.enabled && hasValue(fc.text)) {
      var el = $("footer-credit");
      var url = safeUrl(fc.url);
      el.appendChild(url ? h("a", { href: url, target: "_blank", rel: "noopener", text: str(fc.text) }) : document.createTextNode(str(fc.text)));
      el.hidden = false;
    }
  }

  function renderLocation() {
    var L = cfg.location || {};
    var lines = fullAddress();
    var card = $("location-card");
    var addr = $("address");
    lines.forEach(function (line, i) {
      if (i) addr.appendChild(h("br"));
      addr.appendChild(document.createTextNode(line));
    });
    if (hasValue(L.landmark)) setText("landmark", "Landmark: " + str(L.landmark));

    var coords = hasCoords();
    var lat = parseFloat(L.latitude), lng = parseFloat(L.longitude);
    if (coords && L.showMap !== false) {
      var wrap = $("map-wrap");
      wrap.appendChild(h("iframe", {
        title: "Map showing " + cfg.shopName,
        src: "https://maps.google.com/maps?q=" + lat + "," + lng + "&z=17&output=embed",
        loading: "lazy",
        referrerpolicy: "no-referrer-when-downgrade",
        allowfullscreen: true
      }));
      wrap.hidden = false;
    }
    var dest = coords ? lat + "," + lng : lines.join(", ");
    if (hasValue(dest)) {
      $("directions-btn").href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(dest);
      $("directions-btn").hidden = false;
    }
    var mapsUrl = safeUrl(L.googleMapsUrl);
    if (mapsUrl) { $("maps-link").href = mapsUrl; $("maps-link").hidden = false; }

    card.hidden = !lines.length && !hasValue(L.landmark) && !coords && !mapsUrl;
  }

  function renderHours() {
    var hours = state.hours;
    if (!hours) return;
    var list = $("hours-list");
    if (hours.text) {
      list.appendChild(h("div", { class: "hours-row" }, [h("dd", { text: hours.text })]));
    } else {
      var today = nowInZone(hours.timezone).day;
      hoursRows(hours).forEach(function (r) {
        var isToday = r.days.indexOf(today) >= 0 && r.days.length < 7;
        list.appendChild(h("div", { class: "hours-row" + (isToday ? " is-today" : "") }, [
          h("dt", { text: r.label }),
          h("dd", null, r.lines.map(function (line) { return h("span", { text: line }); }))
        ]));
      });
      if (hours.note) setText("hours-note", hours.note);
    }
    $("hours-card").hidden = false;
  }

  function renderContact() {
    var list = $("contact-list");
    var add = function (href, label, ext) {
      var a = h("a", { href: href, target: ext ? "_blank" : null, rel: ext ? "noopener" : null }, [h("span", { text: label })]);
      list.appendChild(h("li", null, [a]));
    };
    if (telLink()) add(telLink(), "Call " + str(cfg.phone), false);
    if (waLink("")) add(waLink("Hi " + cfg.shopName + "! I have a question."), "Chat on WhatsApp", true);
    if (safeUrl(cfg.googleReviewUrl)) add(safeUrl(cfg.googleReviewUrl), "★ Rate us on Google", true);
    $("contact-card").hidden = !list.children.length;
  }

  function updateOpenStatus() {
    var st = openStatus(state.hours);
    state.status = st;
    var el = $("open-status");
    if (!st) { el.hidden = true; return; }
    el.textContent = st.label;
    el.className = "status" + (st.open ? (st.soon ? " is-soon" : " is-open") : "");
    el.hidden = false;
  }

  /* ======================================================================
   * Menu loading + rendering
   * ==================================================================== */

  function withCacheBuster(url) {
    try {
      var u = new URL(url, location.href);
      u.searchParams.set("_t", Date.now());
      return u.toString();
    } catch (e) { return url; }
  }

  function fetchWithTimeout(url, ms) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    return fetch(url, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined, credentials: "omit" })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  function loadMenu() {
    var src = hasValue(cfg.sheetCsvUrl) ? str(cfg.sheetCsvUrl) : cfg.fallbackCsvUrl;
    showLoading();
    return fetchWithTimeout(withCacheBuster(src), 15000)
      .then(function (res) {
        if (!res.ok) throw new MenuError("http", "HTTP " + res.status + " while fetching " + src);
        return res.text();
      })
      .then(function (text) {
        if (/^\s*</.test(text)) {
          throw new MenuError("format", "Got HTML instead of CSV. Is the sheet published to the web as CSV (File → Share → Publish to web → .csv)?");
        }
        var items = rowsToItems(parseCSV(text));
        state.menu = items;
        state.byId = {};
        items.forEach(function (it) { state.byId[it.id] = it; });
        var removed = reconcileCart();
        renderMenu();
        updateCartUI();
        if (removed.length) {
          toast(removed.length === 1 && removed[0]
            ? "\"" + removed[0] + "\" is no longer available and was removed from your cart."
            : (removed.length === 1 ? "1 item is no longer available and was" : removed.length + " items are no longer available and were") + " removed from your cart.");
        }
      })
      .catch(function (err) {
        console.error("[menu] Could not load menu:", err && err.message ? err.message : err);
        showError(err);
      });
  }

  function showLoading() {
    var status = $("menu-status");
    status.textContent = "";
    $("menu-list").textContent = "";
    var sk = h("div", { class: "skeleton", "aria-hidden": "true" });
    for (var i = 0; i < 4; i++) sk.appendChild(h("div", { class: "skel-card" }));
    status.appendChild(h("span", { class: "visually-hidden", text: "Loading menu…" }));
    status.appendChild(sk);
  }

  function showError(err) {
    var status = $("menu-status");
    status.textContent = "";
    var offline = typeof navigator !== "undefined" && navigator.onLine === false;
    var retry = h("button", { type: "button", class: "btn btn-primary", text: "Try again" });
    retry.addEventListener("click", loadMenu);
    var actions = [retry];
    if (telLink()) actions.push(h("a", { class: "btn btn-outline", href: telLink(), text: "Call us" }));
    if (waLink("")) actions.push(h("a", { class: "btn btn-wa", href: waLink("Hi " + cfg.shopName + "! What's on the menu today?"), target: "_blank", rel: "noopener", text: "Ask on WhatsApp" }));
    status.appendChild(h("div", { class: "state-box" }, [
      h("h3", { text: "We couldn't load the menu right now" }),
      h("p", { class: "muted", text: offline
        ? "You seem to be offline. Check your internet connection and try again."
        : "Please try again in a moment, or contact us directly." }),
      h("div", { class: "btn-row" }, actions)
    ]));
    $("cat-nav").hidden = true;
  }

  function categories() {
    var order = [], groups = {};
    state.menu.forEach(function (it) {
      if (!it.available && cfg.showOutOfStock === "hide") return;
      if (!groups[it.category]) { groups[it.category] = []; order.push(it.category); }
      groups[it.category].push(it);
    });
    return order.map(function (name) { return { name: name, id: "cat-" + slug(name), items: groups[name] }; });
  }

  function placeholder(name) {
    return h("div", { class: "thumb-ph", "aria-hidden": "true", text: (str(name)[0] || "•").toUpperCase() });
  }

  function thumb(item) {
    var wrap = h("div", { class: "thumb" });
    if (item.imageUrl) {
      var img = h("img", {
        src: item.imageUrl, alt: "", width: "96", height: "96",
        loading: "lazy", decoding: "async", referrerpolicy: "no-referrer"
      });
      img.addEventListener("error", function () { img.replaceWith(placeholder(item.name)); }, { once: true });
      wrap.appendChild(img);
    } else {
      wrap.appendChild(placeholder(item.name));
    }
    return wrap;
  }

  function priceEl(item) {
    return h("p", { class: "price" }, [
      h("strong", { text: money(item.price) }),
      item.unit ? h("span", { text: " / " + item.unit }) : null
    ]);
  }

  function stepper(item, qty, context) {
    return h("div", { class: "stepper", role: "group", "aria-label": item.name + " quantity" }, [
      h("button", { type: "button", "data-action": "dec", "data-id": item.id, "data-ctx": context,
        "aria-label": (qty <= stepFor(item.unit) ? "Remove " : "Decrease ") + item.name, text: "−" }),
      h("output", { "aria-live": "off", text: fmtQty(qty, item.unit) }),
      h("button", { type: "button", "data-action": "inc", "data-id": item.id, "data-ctx": context,
        "aria-label": "Increase " + item.name, text: "+", disabled: qty >= MAX_QTY })
    ]);
  }

  function controlFor(item) {
    if (!item.available) return h("span", { class: "badge-out", text: "Out of stock" });
    var qty = state.cart[item.id] || 0;
    if (!qty) {
      return h("button", { type: "button", class: "add-btn", "data-action": "add", "data-id": item.id,
        "aria-label": "Add " + item.name + " to cart", text: "Add" });
    }
    return stepper(item, qty, "menu");
  }

  var controlSlots = {}; // id -> element that wraps the add/stepper control

  function renderMenu() {
    var list = $("menu-list");
    var nav = $("cat-list");
    list.textContent = "";
    nav.textContent = "";
    $("menu-status").textContent = "";
    controlSlots = {};

    var cats = categories();
    if (!cats.length) {
      $("menu-status").appendChild(h("div", { class: "state-box" }, [
        h("h3", { text: "The menu is being updated" }),
        h("p", { class: "muted", text: "Please check back soon, or contact us to order." })
      ]));
      $("cat-nav").hidden = true;
      return;
    }

    var frag = document.createDocumentFragment();
    cats.forEach(function (cat) {
      var itemsEl = h("div", { class: "items" });
      cat.items.forEach(function (item) {
        var slot = h("div", { class: "qty-slot" }, [controlFor(item)]);
        controlSlots[item.id] = slot;
        itemsEl.appendChild(h("article", {
          class: "item" + (item.available ? "" : " is-out"),
          "aria-label": item.name + (item.available ? "" : " (out of stock)")
        }, [
          thumb(item),
          h("div", { class: "item-body" }, [
            h("h4", { class: "item-name", text: item.name }),
            item.description ? h("p", { class: "item-desc", text: item.description }) : null,
            h("div", { class: "item-foot" }, [priceEl(item), slot])
          ])
        ]));
      });
      frag.appendChild(h("section", { class: "category", id: cat.id, "aria-labelledby": cat.id + "-t" }, [
        h("h3", { class: "category-title", id: cat.id + "-t" }, [
          cat.name, h("span", { class: "category-count", text: String(cat.items.length) })
        ]),
        itemsEl
      ]));
      nav.appendChild(h("li", null, [h("a", { href: "#" + cat.id, "data-cat": cat.id, text: cat.name })]));
    });
    list.appendChild(frag);
    $("cat-nav").hidden = cats.length < 2;
    observeCategories();
  }

  var catObserver;
  function observeCategories() {
    if (catObserver) catObserver.disconnect();
    if (!("IntersectionObserver" in window) || $("cat-nav").hidden) return;
    var links = {};
    Array.prototype.forEach.call(document.querySelectorAll("#cat-list a"), function (a) { links[a.getAttribute("data-cat")] = a; });
    catObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].removeAttribute("aria-current"); });
        var a = links[en.target.id];
        if (!a) return;
        a.setAttribute("aria-current", "true");
        var navList = $("cat-list");
        var target = a.offsetLeft - (navList.clientWidth - a.offsetWidth) / 2;
        navList.scrollTo ? navList.scrollTo({ left: target, behavior: "smooth" }) : (navList.scrollLeft = target);
      });
    }, { rootMargin: "-30% 0px -65% 0px" });
    Array.prototype.forEach.call(document.querySelectorAll(".category"), function (s) { catObserver.observe(s); });
  }

  /* ======================================================================
   * Cart actions
   * ==================================================================== */

  function setQty(id, qty, announce) {
    var item = state.byId[id];
    if (!item || !item.available) return;
    qty = normaliseQty(qty, item.unit);
    if (qty > 0) { state.cart[id] = qty; state.cartNames[id] = item.name; }
    else { delete state.cart[id]; delete state.cartNames[id]; }
    saveStore();
    refreshControl(id);
    updateCartUI();
    if (announce) {
      $("sr-live").textContent = qty > 0 ? item.name + ": " + fmtQty(qty, item.unit) + " in cart" : item.name + " removed from cart";
    }
  }

  function refreshControl(id) {
    var slot = controlSlots[id];
    if (!slot) return;
    var active = document.activeElement;
    var hadFocus = slot.contains(active);
    var focusAction = hadFocus && active.getAttribute("data-action");
    slot.textContent = "";
    slot.appendChild(controlFor(state.byId[id]));
    if (hadFocus) {
      var target = slot.querySelector('[data-action="' + (focusAction === "add" ? "inc" : focusAction) + '"]') ||
                   slot.querySelector("button");
      if (target) target.focus();
    }
  }

  function handleQtyClick(e) {
    var btn = e.target.closest("[data-action]");
    if (!btn || btn.disabled) return;
    var id = btn.getAttribute("data-id");
    var item = state.byId[id];
    if (!item) return;
    var cur = state.cart[id] || 0;
    var step = stepFor(item.unit);
    var action = btn.getAttribute("data-action");
    if (action === "add") setQty(id, 1, true);
    else if (action === "inc") setQty(id, cur + step, true);
    else if (action === "dec") setQty(id, cur - step, true);
    else if (action === "remove") setQty(id, 0, true);
  }

  /* ======================================================================
   * Cart UI
   * ==================================================================== */

  function updateCartUI() {
    var t = totals();
    var count = t.lines.length;

    // Sticky bar
    var bar = $("cart-bar");
    bar.hidden = count === 0;
    document.body.classList.toggle("has-cart", count > 0);
    $("cart-bar-count").textContent = count + (count === 1 ? " item" : " items");
    $("cart-bar-total").textContent = money(t.subtotal);
    $("cart-bar-btn").setAttribute("aria-label", "View cart: " + count + (count === 1 ? " item" : " items") + ", " + money(t.subtotal));

    if ($("cart-dialog").open) renderCartDialog();
  }

  function renderCartDialog() {
    var t = totals();
    var list = $("cart-items");
    var active = document.activeElement;
    var refocus = list.contains(active) ? { id: active.getAttribute("data-id"), action: active.getAttribute("data-action") } : null;

    list.textContent = "";
    t.lines.forEach(function (l) {
      list.appendChild(h("li", { class: "cart-line" }, [
        h("div", null, [
          h("p", { class: "cart-line-name", text: l.item.name }),
          h("p", { class: "cart-line-price", text: money(l.item.price) + (l.item.unit ? " / " + l.item.unit : "") })
        ]),
        h("p", { class: "cart-line-total", text: money(l.total) }),
        stepper(l.item, l.qty, "cart")
      ]));
    });
    if (refocus) {
      var again = list.querySelector('[data-id="' + refocus.id + '"][data-action="' + refocus.action + '"]');
      if (again) again.focus(); else $("cart-close").focus();
    }

    var empty = !t.lines.length;
    $("cart-empty").hidden = !empty;
    $("checkout-fields").hidden = empty;
    $("send-order").disabled = empty || !waLink("");
    $("send-hint").hidden = empty;
    if (!waLink("")) $("send-hint").textContent = "Online ordering isn't set up yet. Please call us to order.";

    // Totals
    var showDeliveryRow = t.isDelivery;
    $("subtotal-row").hidden = !showDeliveryRow;
    $("delivery-row").hidden = !showDeliveryRow;
    $("subtotal").textContent = money(t.subtotal);
    var feeEl = $("delivery-fee");
    feeEl.textContent = t.fee ? money(t.fee) : "FREE";
    feeEl.className = t.fee ? "" : "free";
    $("grand-total").textContent = money(t.total);

    // Minimum order for delivery
    var minOrder = Number(cfg.delivery.minOrder) || 0;
    var warn = $("min-order-warning");
    if (t.isDelivery && minOrder && t.subtotal < minOrder) {
      warn.textContent = "Minimum order for home delivery is " + money(minOrder) + ". Add " + money(minOrder - t.subtotal) + " more, or choose pickup.";
      warn.hidden = false;
    } else {
      warn.hidden = true;
    }

    // Closed notice
    var st = state.status;
    var note = $("cart-closed-note");
    if (st && !st.open && !empty) {
      note.textContent = "We're closed right now (" + st.label.replace(/^Closed · /, "") + "). You can still send your order and we'll confirm it when we open.";
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }

  function initOrderForm() {
    var form = $("order-form");
    var d = cfg.delivery || {};

    if (!deliveryEnabled()) {
      $("order-type-fieldset").hidden = true;
      state.customer.orderType = "pickup";
    } else {
      if (d.free) { $("delivery-tag").textContent = "FREE"; $("delivery-tag").hidden = false; }
      else if (Number(d.charge) > 0) {
        $("delivery-tag").textContent = "+" + money(d.charge);
        $("delivery-tag").hidden = false;
      }
      var optNote = hasValue(d.note) ? str(d.note) :
        Number(d.freeAbove) > 0 && !d.free ? "Free above " + money(d.freeAbove) : "We bring it to you";
      $("delivery-option-note").textContent = optNote;
    }

    // Restore saved customer details
    $("cust-name").value = state.customer.name || "";
    $("cust-address").value = state.customer.address || "";
    if (state.customer.orderType) {
      var r = form.querySelector('input[name="orderType"][value="' + state.customer.orderType + '"]');
      if (r) r.checked = true;
    }
    syncOrderType();

    form.addEventListener("input", function (e) {
      if (e.target.id === "cust-name") { state.customer.name = e.target.value; clearError("cust-name"); }
      if (e.target.id === "cust-address") { state.customer.address = e.target.value; clearError("cust-address"); }
      saveStore();
    });
    form.addEventListener("change", function (e) {
      if (e.target.name === "orderType") {
        state.customer.orderType = e.target.value;
        clearError("order-type");
        saveStore();
        syncOrderType();
        renderCartDialog();
      }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      sendOrder();
    });
    $("cart-items").addEventListener("click", handleQtyClick);
    $("new-order-btn").addEventListener("click", function () {
      state.cart = {};
      state.cartNames = {};
      $("cust-notes").value = "";
      saveStore();
      Object.keys(controlSlots).forEach(refreshControl);
      updateCartUI();
      closeCart();
      toast("Thanks! Your cart has been cleared.");
    });
  }

  function syncOrderType() {
    var isDelivery = deliveryEnabled() && state.customer.orderType === "delivery";
    $("address-field").hidden = !isDelivery;
    $("cust-address").required = isDelivery;
  }

  function setError(base, msg, input) {
    var err = $(base + "-err");
    err.textContent = msg;
    err.hidden = false;
    if (input) input.setAttribute("aria-invalid", "true");
  }
  function clearError(base) {
    var err = $(base + "-err");
    if (err) { err.hidden = true; err.textContent = ""; }
    var input = $(base);
    if (input) input.removeAttribute("aria-invalid");
  }

  function validate() {
    var firstBad = null;
    var name = str($("cust-name").value);
    if (!name) { setError("cust-name", "Please enter your name.", $("cust-name")); firstBad = firstBad || $("cust-name"); }
    if (deliveryEnabled()) {
      if (!state.customer.orderType) {
        setError("order-type", "Please choose pickup or home delivery.");
        firstBad = firstBad || document.querySelector('input[name="orderType"]');
      } else if (state.customer.orderType === "delivery" && !str($("cust-address").value)) {
        setError("cust-address", "Please enter your delivery address.", $("cust-address"));
        firstBad = firstBad || $("cust-address");
      }
    }
    var t = totals();
    var minOrder = Number(cfg.delivery.minOrder) || 0;
    if (t.isDelivery && minOrder && t.subtotal < minOrder) firstBad = firstBad || $("min-order-warning");
    if (firstBad) {
      if (firstBad.focus) firstBad.focus();
      if (firstBad.scrollIntoView) firstBad.scrollIntoView({ block: "center" });
    }
    return !firstBad;
  }

  function buildOrderMessage() {
    var t = totals();
    var c = state.customer;
    var intro = str(cfg.orderMessageTemplate || DEFAULTS.orderMessageTemplate).replace(/\{shopName\}/g, cfg.shopName);
    var lines = [intro, ""];
    t.lines.forEach(function (l, i) {
      lines.push((i + 1) + ". " + l.item.name + ": " + fmtQty(l.qty, l.item.unit) +
        " × " + money(l.item.price) + (l.item.unit ? "/" + l.item.unit : "") + " = " + money(l.total));
    });
    lines.push("");
    if (t.isDelivery) {
      lines.push("Subtotal: " + money(t.subtotal));
      lines.push("Delivery: " + (t.fee ? money(t.fee) : "FREE"));
    }
    lines.push("*Total: " + money(t.total) + "*");
    lines.push("");
    lines.push("Name: " + str($("cust-name").value));
    if (deliveryEnabled() || c.orderType) {
      lines.push("Order type: " + (t.isDelivery ? "Home delivery" : "Pickup from shop"));
    }
    if (t.isDelivery) lines.push("Address: " + str($("cust-address").value).replace(/\s*\n\s*/g, ", "));
    var notes = str($("cust-notes").value);
    if (notes) lines.push("Notes: " + notes.replace(/\s*\n\s*/g, "; "));
    return lines.join("\n");
  }

  function sendOrder() {
    if (!cartLines().length || !waLink("")) return;
    if (!validate()) return;
    var url = waLink(buildOrderMessage());
    var win = window.open(url, "_blank");
    if (!win) window.location.href = url; // popup blocked: navigate instead
    $("sent-note").hidden = false;
    $("send-hint").hidden = true;
  }

  /* ---------- Dialog open/close (+ Android back button support) ---------- */

  var pushedHistory = false;
  function openCart() {
    var dlg = $("cart-dialog");
    if (dlg.open) return;
    $("sent-note").hidden = true;
    renderCartDialog();
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    document.body.classList.add("no-scroll");
    try { history.pushState({ cartOpen: true }, ""); pushedHistory = true; } catch (e) { /* ignore */ }
  }
  function closeCart() {
    var dlg = $("cart-dialog");
    if (!dlg.open) return;
    if (typeof dlg.close === "function") dlg.close(); else { dlg.removeAttribute("open"); onDialogClosed(); }
  }
  function onDialogClosed() {
    document.body.classList.remove("no-scroll");
    if (pushedHistory) { pushedHistory = false; history.back(); }
    var bar = $("cart-bar-btn");
    if (!$("cart-bar").hidden) bar.focus();
  }

  function initCartDialog() {
    var dlg = $("cart-dialog");
    $("cart-bar-btn").addEventListener("click", openCart);
    $("cart-close").addEventListener("click", closeCart);
    dlg.addEventListener("close", onDialogClosed);
    dlg.addEventListener("click", function (e) { if (e.target === dlg) closeCart(); }); // backdrop tap
    window.addEventListener("popstate", function () {
      if (dlg.open) { pushedHistory = false; closeCart(); }
    });
  }

  /* ---------- Toast ---------- */

  var toastTimer;
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 4500);
  }

  /* ======================================================================
   * Boot
   * ==================================================================== */

  function init() {
    applyTheme();
    loadStore();
    renderShopInfo();
    updateOpenStatus();
    setInterval(updateOpenStatus, 60 * 1000);
    initCartDialog();
    initOrderForm();
    $("menu-list").addEventListener("click", handleQtyClick);
    loadMenu();
  }

  // Exposed for tests / debugging only.
  window.__shopMenu = {
    parseCSV: parseCSV, rowsToItems: rowsToItems, parseDays: parseDays, parseSlot: parseSlot,
    buildHours: buildHours, openStatus: openStatus, hoursRows: hoursRows, normaliseQty: normaliseQty,
    buildOrderMessage: buildOrderMessage, state: state, config: cfg
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
