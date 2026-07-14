(function () {
  const dataset = window.AMMA_FLOWERS_DATA || { meta: {}, flowers: [] };
  const meta = dataset.meta || {};
  let flowers = Array.isArray(dataset.flowers) ? dataset.flowers : [];
  const storageKey = "amma-rub-settings";
  const cartKey = "amma-rub-cart";
  const priceRefreshMs = 5 * 60 * 1000;
  const defaultGramPackStems = 10;
  const liveSource = {
    url: "https://pfixjbntcijetvjwlvhe.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaXhqYm50Y2lqZXR2andsdmhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MDk4MjYsImV4cCI6MjA5NjQ4NTgyNn0.VH5zClAUq_RxZ4vngLxaMryUP7J0bNzStMqIuHe7SnQ"
  };
  const flowerSelect = [
    "id", "ru", "cn", "en", "cat_ru", "cat_en", "catalog",
    "price_a", "price_ap", "boxes_per_box", "stems", "pack", "length",
    "order_qty", "flower_weight", "box_size", "in_stock", "updated_at",
    "photo_url", "is_weight"
  ].join(",");

  const state = {
    rate: Number(meta.cny_rub_rate) || 11.2925,
    factor: Number(meta.client_price_factor) || 1.15,
    deliveryRub: Number(meta.delivery_rub) || 150000,
    deliveryBoxes: Number(meta.delivery_boxes) || 33,
    catalog: "cut",
    query: "",
    category: "",
    stockOnly: true,
    pricesRefreshing: false,
    cart: new Map()
  };

  const el = {
    rate: document.getElementById("rateInput"),
    factor: document.getElementById("factorInput"),
    delivery: document.getElementById("deliveryInput"),
    deliveryBoxes: document.getElementById("deliveryBoxesInput"),
    deliveryPerBox: document.getElementById("deliveryPerBox"),
    catalogTabs: document.querySelectorAll("[data-catalog]"),
    cutCount: document.getElementById("cutCount"),
    suppliesCount: document.getElementById("suppliesCount"),
    search: document.getElementById("searchInput"),
    category: document.getElementById("categorySelect"),
    stockOnly: document.getElementById("stockOnlyInput"),
    body: document.getElementById("priceBody"),
    empty: document.getElementById("emptyState"),
    status: document.getElementById("dataStatus"),
    visibleCount: document.getElementById("visibleCount"),
    totalCount: document.getElementById("totalCount"),
    minStemALabel: document.getElementById("minStemALabel"),
    minStemApLabel: document.getElementById("minStemApLabel"),
    minStemA: document.getElementById("minStemA"),
    minStemAp: document.getElementById("minStemAp"),
    unitHeaderA: document.getElementById("unitHeaderA"),
    unitHeaderAp: document.getElementById("unitHeaderAp"),
    refreshRate: document.getElementById("refreshRateBtn"),
    clear: document.getElementById("clearBtn"),
    export: document.getElementById("exportBtn"),
    cartList: document.getElementById("cartList"),
    cartMeta: document.getElementById("cartMeta"),
    cartTotal: document.getElementById("cartTotal"),
    clearCart: document.getElementById("clearCartBtn")
  };

  function fmtRub(value, digits = 0) {
    if (!Number.isFinite(value)) return "-";
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    }).format(value);
  }

  function fmtNum(value, digits = 0) {
    if (!Number.isFinite(value)) return "-";
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    }).format(value);
  }

  function parseNum(value, fallback) {
    const n = Number(String(value).replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }

  function deliveryPerBox() {
    return state.deliveryBoxes > 0 ? state.deliveryRub / state.deliveryBoxes : 0;
  }

  function catalogOf(flower) {
    return flower.catalog || "cut";
  }

  function catalogFlowers(catalog = state.catalog) {
    return flowers.filter((flower) => catalogOf(flower) === catalog);
  }

  function currentCatalogLabel() {
    return state.catalog === "supplies" ? "шт." : "стебель";
  }

  function updateCatalogUi() {
    const cutCount = catalogFlowers("cut").length;
    const suppliesCount = catalogFlowers("supplies").length;
    if (el.cutCount) el.cutCount.textContent = fmtNum(cutCount);
    if (el.suppliesCount) el.suppliesCount.textContent = fmtNum(suppliesCount);
    el.catalogTabs.forEach((button) => {
      button.classList.toggle("active", button.dataset.catalog === state.catalog);
    });
    const unit = currentCatalogLabel();
    if (el.minStemALabel) el.minStemALabel.textContent = `Мин. A за ${unit}`;
    if (el.minStemApLabel) el.minStemApLabel.textContent = `Мин. A+ за ${unit}`;
    if (el.unitHeaderA) el.unitHeaderA.textContent = state.catalog === "supplies" ? "₽/шт A" : "₽/ст A";
    if (el.unitHeaderAp) el.unitHeaderAp.textContent = state.catalog === "supplies" ? "₽/шт A+" : "₽/ст A+";
    el.totalCount.textContent = fmtNum(catalogFlowers().length);
  }

  function gramsPerPack(flower) {
    const pack = String(flower.pack || "");
    const match = pack.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
    return match ? Number(match[1].replace(",", ".")) : null;
  }

  function isSupplyItem(flower) {
    return /supplies/i.test([flower.catalog, flower.cat_en, flower.cat_ru].filter(Boolean).join(" "));
  }

  function gramPackInfo(flower) {
    const grams = gramsPerPack(flower);
    if (!grams || isSupplyItem(flower)) return null;
    const stemsPerBunch = defaultGramPackStems;
    return {
      grams,
      stemsPerBunch,
      stemsPerKg: stemsPerBunch * 1000 / grams
    };
  }

  function isWeightItem(flower) {
    if (gramPackInfo(flower)) return false;
    if (flower.is_weight === true) return true;
    const text = [flower.cat_ru, flower.cat_en, flower.pack, flower.flower_weight].filter(Boolean).join(" ");
    return /кг|килограмм|грамм|гр|克|公斤|kg|g/i.test(text) && /зелень|листья|greenery|foliage|leaves|leaf|叶材/i.test(text);
  }

  function unitLabel(flower) {
    if (isSupplyItem(flower)) return "шт";
    return isWeightItem(flower) ? "г" : "ст";
  }

  function priceFor(flower, grade) {
    const bunchCny = Number(grade === "ap" ? flower.price_ap : flower.price_a) || 0;
    const bunchesPerBox = Number(flower.boxes_per_box) || 0;
    const gramInfo = gramPackInfo(flower);
    const unitsPerBunch = gramInfo ? gramInfo.stemsPerBunch : Number(flower.stems) || 0;
    const unitsPerBox = bunchesPerBox * unitsPerBunch;
    const boxCny = bunchCny * bunchesPerBox * state.factor;
    const boxRubNoDelivery = boxCny * state.rate;
    const boxRub = boxRubNoDelivery + deliveryPerBox();
    const unitRub = unitsPerBox > 0 ? boxRub / unitsPerBox : NaN;
    return { bunchCny, bunchesPerBox, unitsPerBunch, unitsPerBox, boxCny, boxRubNoDelivery, boxRub, unitRub, gramInfo };
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeFlower(row) {
    return {
      id: Number(row.id),
      ru: row.ru || "",
      cn: row.cn || "",
      en: row.en || "",
      cat_ru: row.cat_ru || "",
      cat_en: row.cat_en || "",
      catalog: row.catalog || "cut",
      price_a: row.price_a == null ? null : Number(row.price_a),
      price_ap: row.price_ap == null ? null : Number(row.price_ap),
      boxes_per_box: row.boxes_per_box == null ? null : Number(row.boxes_per_box),
      stems: row.stems == null ? null : Number(row.stems),
      pack: row.pack || "",
      length: row.length || "",
      order_qty: row.order_qty || "",
      flower_weight: row.flower_weight || "",
      box_size: row.box_size || "",
      in_stock: Boolean(row.in_stock),
      updated_at: row.updated_at || null,
      photo_url: /^https?:\/\//i.test(row.photo_url || "") ? row.photo_url : null,
      is_weight: row.is_weight
    };
  }

  function latestUpdated(rows) {
    return rows
      .map((row) => row.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1) || meta.latest_updated || null;
  }

  async function fetchLiveFlowers() {
    const pageSize = 500;
    const result = [];

    for (let offset = 0; offset < 5000; offset += pageSize) {
      const params = new URLSearchParams({
        select: flowerSelect,
        order: "cat_ru.asc,ru.asc",
        offset: String(offset),
        limit: String(pageSize)
      });
      const response = await fetch(`${liveSource.url}/rest/v1/flowers?${params}`, {
        cache: "no-store",
        headers: {
          apikey: liveSource.key,
          Authorization: `Bearer ${liveSource.key}`
        }
      });

      if (!response.ok) {
        throw new Error(`flowers request failed: ${response.status}`);
      }

      const chunk = await response.json();
      if (!Array.isArray(chunk) || chunk.length === 0) break;
      result.push(...chunk.map(normalizeFlower));
      if (chunk.length < pageSize) break;
    }

    return result;
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (saved.rate) state.rate = Number(saved.rate);
      if (saved.factor) state.factor = Number(saved.factor);
      if (saved.deliveryRub) state.deliveryRub = Number(saved.deliveryRub);
      if (saved.deliveryBoxes) state.deliveryBoxes = Number(saved.deliveryBoxes);
      if (["cut", "supplies"].includes(saved.catalog)) state.catalog = saved.catalog;
      if (typeof saved.stockOnly === "boolean") state.stockOnly = saved.stockOnly;
    } catch {
      // Ignore broken local settings.
    }

    try {
      const rows = JSON.parse(localStorage.getItem(cartKey) || "[]");
      state.cart = new Map(rows.map((row) => [row.key, row]));
    } catch {
      state.cart = new Map();
    }
  }

  function saveSettings() {
    localStorage.setItem(storageKey, JSON.stringify({
      rate: state.rate,
      factor: state.factor,
      deliveryRub: state.deliveryRub,
      deliveryBoxes: state.deliveryBoxes,
      catalog: state.catalog,
      stockOnly: state.stockOnly
    }));
  }

  function saveCart() {
    localStorage.setItem(cartKey, JSON.stringify([...state.cart.values()]));
  }

  function syncInputs() {
    el.rate.value = state.rate.toFixed(4);
    el.factor.value = state.factor.toFixed(2);
    el.delivery.value = String(Math.round(state.deliveryRub));
    el.deliveryBoxes.value = String(Math.round(state.deliveryBoxes));
    el.stockOnly.checked = state.stockOnly;
    el.deliveryPerBox.textContent = fmtRub(deliveryPerBox(), 2);
    updateCatalogUi();
  }

  async function refreshLivePrices({ silent = false } = {}) {
    if (state.pricesRefreshing) return;
    state.pricesRefreshing = true;
    if (!silent) setStatus("Обновляю прайс AMMA");

    try {
      const liveFlowers = await fetchLiveFlowers();
      if (!liveFlowers.length) throw new Error("empty flower list");

      flowers = liveFlowers;
      meta.count = liveFlowers.length;
      meta.latest_updated = latestUpdated(liveFlowers);

      fillCategories();
      if (state.category && !catalogFlowers().some((flower) => flower.cat_ru === state.category)) {
        state.category = "";
      }
      el.category.value = state.category;
      updateCatalogUi();
      render();

      const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      setStatus(`Прайс AMMA обновлен в ${time}`);
    } catch (error) {
      console.warn(error);
      const prefix = silent
        ? "Автообновление прайса не удалось"
        : "Прайс AMMA не загрузился, показан локальный снимок";
      setStatus(prefix);
    } finally {
      state.pricesRefreshing = false;
    }
  }

  function fillCategories() {
    const categories = [...new Set(catalogFlowers().map((f) => f.cat_ru).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "ru"));
    el.category.innerHTML = `<option value="">Все категории</option>${categories
      .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
      .join("")}`;
  }

  function filteredFlowers() {
    const q = state.query.toLowerCase();
    return catalogFlowers().filter((f) => {
      if (state.stockOnly && !f.in_stock) return false;
      if (state.category && f.cat_ru !== state.category) return false;
      if (!q) return true;
      return [f.ru, f.cn, f.en, f.cat_ru, f.cat_en, f.pack, f.length]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }

  function photoHtml(flower) {
    if (flower.photo_url) {
      return `<img class="flower-photo" src="${escapeHtml(flower.photo_url)}" alt="${escapeHtml(flower.ru || flower.en || "flower")}" loading="lazy" onerror="this.replaceWith(photoFallback('${escapeHtml((flower.ru || flower.en || "?").slice(0, 1))}'))">`;
    }
    return `<div class="photo-fallback">${escapeHtml((flower.ru || flower.en || "?").slice(0, 1).toUpperCase())}</div>`;
  }

  window.photoFallback = function (letter) {
    const div = document.createElement("div");
    div.className = "photo-fallback";
    div.textContent = letter || "?";
    return div;
  };

  function moneyCell(price, flower) {
    const unit = unitLabel(flower);
    return `
      <span class="money-main">${fmtRub(price.boxRub, 0)}</span>
      <span class="money-sub">${fmtRub(price.boxRubNoDelivery, 0)} + ${fmtRub(deliveryPerBox(), 0)}</span>
      <span class="money-sub">${fmtNum(price.unitsPerBox)} ${unit}/кор</span>
    `;
  }

  function gramPackNote(flower) {
    const info = gramPackInfo(flower);
    if (!info) return "";
    return `<br><span class="money-sub">≈${fmtNum(info.stemsPerKg, 1)} ст/кг · ${fmtNum(info.stemsPerBunch)} ст/вяз</span>`;
  }

  function render() {
    updateCatalogUi();
    const rows = filteredFlowers();
    let html = "";
    let lastCat = "";
    let minA = Infinity;
    let minAp = Infinity;

    for (const flower of rows) {
      const a = priceFor(flower, "a");
      const ap = priceFor(flower, "ap");
      if (!isWeightItem(flower) && Number.isFinite(a.unitRub)) minA = Math.min(minA, a.unitRub);
      if (!isWeightItem(flower) && Number.isFinite(ap.unitRub)) minAp = Math.min(minAp, ap.unitRub);

      if (flower.cat_ru !== lastCat) {
        lastCat = flower.cat_ru || "Без категории";
        html += `<tr class="category-row"><td colspan="10">${escapeHtml(lastCat)}${flower.cat_en ? ` · ${escapeHtml(flower.cat_en)}` : ""}</td></tr>`;
      }

      const unit = unitLabel(flower);
      html += `
        <tr class="${flower.in_stock ? "" : "out-of-stock"}">
          <td>${photoHtml(flower)}</td>
          <td class="name-cell">
            <strong>${escapeHtml(flower.ru || flower.en || "Без названия")}</strong>
            <span>${escapeHtml([flower.cn, flower.en].filter(Boolean).join(" · "))}</span>
            <span>${flower.in_stock ? "В наличии" : "Нет в наличии"} · ID ${flower.id}</span>
          </td>
          <td class="pack-cell">
            ${escapeHtml(flower.pack || "-")}
            ${gramPackNote(flower)}
            <br>${escapeHtml([flower.length, flower.flower_weight, flower.box_size].filter(Boolean).join(" · "))}
          </td>
          <td><span class="money-main">¥${fmtNum(a.boxCny, 0)}</span><span class="money-sub">¥${fmtNum(a.bunchCny * state.factor, 1)}/банч</span></td>
          <td>${moneyCell(a, flower)}</td>
          <td><span class="stem-price">${Number.isFinite(a.unitRub) ? fmtRub(a.unitRub, 2) : "-"}</span><span class="money-sub">за ${unit}</span></td>
          <td><span class="money-main">¥${fmtNum(ap.boxCny, 0)}</span><span class="money-sub">¥${fmtNum(ap.bunchCny * state.factor, 1)}/банч</span></td>
          <td>${moneyCell(ap, flower)}</td>
          <td><span class="stem-price">${Number.isFinite(ap.unitRub) ? fmtRub(ap.unitRub, 2) : "-"}</span><span class="money-sub">за ${unit}</span></td>
          <td>
            <div class="cart-actions">
              <button type="button" data-add="${flower.id}" data-grade="a">A</button>
              <button type="button" data-add="${flower.id}" data-grade="ap">A+</button>
            </div>
          </td>
        </tr>`;
    }

    el.body.innerHTML = html;
    el.empty.style.display = rows.length ? "none" : "block";
    el.visibleCount.textContent = fmtNum(rows.length);
    el.minStemA.textContent = Number.isFinite(minA) ? fmtRub(minA, 2) : "-";
    el.minStemAp.textContent = Number.isFinite(minAp) ? fmtRub(minAp, 2) : "-";
    el.deliveryPerBox.textContent = fmtRub(deliveryPerBox(), 2);
    renderCart();
  }

  function addToCart(id, grade) {
    const flower = flowers.find((f) => String(f.id) === String(id));
    if (!flower) return;
    const key = `${id}:${grade}`;
    const current = state.cart.get(key);
    if (current) current.qty += 1;
    else state.cart.set(key, { key, id: flower.id, grade, qty: 1 });
    saveCart();
    renderCart();
  }

  function updateCartQty(key, qty) {
    const row = state.cart.get(key);
    if (!row) return;
    row.qty = Math.max(0, Number(qty) || 0);
    if (row.qty === 0) state.cart.delete(key);
    saveCart();
    renderCart();
  }

  function renderCart() {
    const rows = [...state.cart.values()];
    if (!rows.length) {
      el.cartList.innerHTML = `<div class="cart-empty">Добавьте позиции из прайса</div>`;
      el.cartMeta.textContent = "0 коробок";
      el.cartTotal.textContent = fmtRub(0);
      return;
    }

    let total = 0;
    let boxes = 0;
    el.cartList.innerHTML = rows.map((row) => {
      const flower = flowers.find((f) => String(f.id) === String(row.id));
      if (!flower) return "";
      const price = priceFor(flower, row.grade);
      const sum = price.boxRub * row.qty;
      total += sum;
      boxes += row.qty;
      return `
        <div class="cart-row">
          <div class="cart-name">
            <strong>${escapeHtml(flower.ru || flower.en || "Позиция")}</strong>
            <span>${row.grade === "ap" ? "A+" : "A"} · ${fmtRub(price.boxRub, 0)}/кор · ${fmtRub(price.unitRub, 2)}/${unitLabel(flower)}</span>
          </div>
          <div class="qty-box">
            <button type="button" data-dec="${escapeHtml(row.key)}">-</button>
            <input type="number" min="0" step="1" value="${row.qty}" data-qty="${escapeHtml(row.key)}">
            <button type="button" data-inc="${escapeHtml(row.key)}">+</button>
          </div>
          <div class="cart-sum">
            <span>${fmtNum(row.qty)} кор</span>
            <strong>${fmtRub(sum, 0)}</strong>
          </div>
        </div>`;
    }).join("");

    el.cartMeta.textContent = `${fmtNum(boxes)} коробок`;
    el.cartTotal.textContent = fmtRub(total, 0);
  }

  function exportCsv() {
    const rows = filteredFlowers();
    const header = [
      "ID", "Название RU", "Название CN", "Категория", "Наличие", "Упаковка",
      "A yuan box", "A rub box with delivery", "A rub stem with delivery",
      "A+ yuan box", "A+ rub box with delivery", "A+ rub stem with delivery",
      "Банчей в коробе", "Грамм в вязке", "Стеблей на кг", "Стеблей в вязке", "Стеблей в коробе", "Размер короба"
    ];

    const lines = [header].concat(rows.map((f) => {
      const a = priceFor(f, "a");
      const ap = priceFor(f, "ap");
      return [
        f.id, f.ru, f.cn, f.cat_ru, f.in_stock ? "yes" : "no", f.pack,
        a.boxCny, a.boxRub, a.unitRub,
        ap.boxCny, ap.boxRub, ap.unitRub,
        f.boxes_per_box, a.gramInfo?.grams || "", a.gramInfo?.stemsPerKg || "", a.unitsPerBunch, a.unitsPerBox, f.box_size
      ];
    })).map((line) => line.map((value) => {
      const text = value == null || Number.isNaN(value) ? "" : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    }).join(";"));

    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ammaflowers-rub.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function refreshRate() {
    el.refreshRate.disabled = true;
    el.refreshRate.textContent = "...";
    try {
      const response = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", { cache: "no-store" });
      if (!response.ok) throw new Error("rate request failed");
      const data = await response.json();
      const rate = Number(data?.Valute?.CNY?.Value);
      if (!Number.isFinite(rate)) throw new Error("CNY rate missing");
      state.rate = rate;
      el.rate.value = rate.toFixed(4);
      saveSettings();
      render();
      setStatus(data.Date ? `Курс CBR от ${new Date(data.Date).toLocaleDateString("ru-RU")}` : "Курс CBR обновлен");
    } catch {
      setStatus("Курс CBR не загрузился, оставлен локальный");
    } finally {
      el.refreshRate.disabled = false;
      el.refreshRate.textContent = "CBR";
    }
  }

  function setStatus(prefix) {
    const latest = meta.latest_updated ? new Date(meta.latest_updated).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : "-";
    el.status.textContent = `${prefix} · ${fmtNum(flowers.length)} поз. · прайс ${latest}`;
  }

  function bindEvents() {
    [el.rate, el.factor, el.delivery, el.deliveryBoxes].forEach((input) => {
      input.addEventListener("input", () => {
        state.rate = parseNum(el.rate.value, state.rate);
        state.factor = parseNum(el.factor.value, state.factor);
        state.deliveryRub = parseNum(el.delivery.value, state.deliveryRub);
        state.deliveryBoxes = parseNum(el.deliveryBoxes.value, state.deliveryBoxes);
        saveSettings();
        render();
      });
    });

    el.search.addEventListener("input", () => {
      state.query = el.search.value.trim();
      render();
    });

    el.category.addEventListener("change", () => {
      state.category = el.category.value;
      render();
    });

    el.catalogTabs.forEach((button) => {
      button.addEventListener("click", () => {
        state.catalog = button.dataset.catalog;
        state.category = "";
        el.category.value = "";
        fillCategories();
        saveSettings();
        render();
      });
    });

    el.stockOnly.addEventListener("change", () => {
      state.stockOnly = el.stockOnly.checked;
      saveSettings();
      render();
    });

    el.clear.addEventListener("click", () => {
      state.query = "";
      state.category = "";
      el.search.value = "";
      el.category.value = "";
      render();
    });

    el.refreshRate.addEventListener("click", refreshRate);
    el.export.addEventListener("click", exportCsv);

    el.body.addEventListener("click", (event) => {
      const button = event.target.closest("[data-add]");
      if (!button) return;
      addToCart(button.dataset.add, button.dataset.grade);
    });

    el.cartList.addEventListener("click", (event) => {
      const inc = event.target.closest("[data-inc]");
      const dec = event.target.closest("[data-dec]");
      if (inc) {
        const row = state.cart.get(inc.dataset.inc);
        if (row) updateCartQty(row.key, row.qty + 1);
      }
      if (dec) {
        const row = state.cart.get(dec.dataset.dec);
        if (row) updateCartQty(row.key, row.qty - 1);
      }
    });

    el.cartList.addEventListener("input", (event) => {
      const input = event.target.closest("[data-qty]");
      if (!input) return;
      updateCartQty(input.dataset.qty, input.value);
    });

    el.clearCart.addEventListener("click", () => {
      state.cart.clear();
      saveCart();
      renderCart();
    });
  }

  loadSettings();
  syncInputs();
  fillCategories();
  bindEvents();
  setStatus("Локальный снимок");
  render();
  refreshRate().finally(() => refreshLivePrices());
  window.setInterval(() => refreshLivePrices({ silent: true }), priceRefreshMs);
})();
