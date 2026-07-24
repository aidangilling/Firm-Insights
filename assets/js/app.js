/* Australian Firm Insights — front-end.
   Reads data.json (written by the scheduled runner) and renders:
     - a global overview (headline total + clickable By Firm / By Topic / By
       Year filter cards that apply across every firm table), and
     - one sortable, searchable table per firm (Month | Article Name | Date |
       Topic | Link), with a code-generated monogram badge next to each heading.
   No framework, no build step.

   Filters: same-category selections are OR, across-category are AND, and they
   combine with each firm's own search box. */

(function () {
  "use strict";

  // Flip to true to also render each article's on-page teaser under its title.
  // (Per the current brief, LLM bullet summaries are intentionally OFF; the
  //  data.json still carries `teaser`/`bullets` so this can be switched on.)
  var SHOW_TEASERS = false;

  var MONTHS_FULL = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // ---- formatting helpers ------------------------------------------------
  function fmtFullSydney(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    try {
      return new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Sydney",
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(d);
    } catch (e) {
      return d.toISOString();
    }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function recTopics(r) {
    if (Array.isArray(r.topics) && r.topics.length) return r.topics;
    if (r.topic && r.topic.trim())
      return r.topic.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    return [];
  }

  // ---- global filter state ----------------------------------------------
  var G = { topic: new Set(), date: new Set() };
  var firmControllers = []; // one per firm section, each with a redraw()
  var REF_ISO = null; // reference "today" for date ranges (from generatedAt)

  function anyGlobalActive() {
    return G.topic.size || G.date.size;
  }

  // Date-range values → the earliest ISO date they include (relative to REF_ISO).
  function isoMinusMonths(refISO, n) {
    var d = new Date(refISO + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - n);
    return d.toISOString().slice(0, 10);
  }
  function dateThreshold(value) {
    if (!REF_ISO) return "0000-01-01";
    if (value === "1m") return isoMinusMonths(REF_ISO, 1);
    if (value === "3m") return isoMinusMonths(REF_ISO, 3);
    if (value === "6m") return isoMinusMonths(REF_ISO, 6);
    if (value === "year") return REF_ISO.slice(0, 4) + "-01-01";
    return "0000-01-01";
  }
  var DATE_FILTERS = [
    { value: "1m", label: "Last month" },
    { value: "3m", label: "Last 3 months" },
    { value: "6m", label: "Last 6 months" },
    { value: "year", label: "This year" },
  ];

  function matchesGlobal(r) {
    if (G.topic.size && !recTopics(r).some(function (t) { return G.topic.has(t); }))
      return false;
    if (G.date.size) {
      var val = G.date.values().next().value; // single-select
      if (!r.dateISO || r.dateISO < dateThreshold(val)) return false;
    }
    return true;
  }

  // ---- overview (headline + clickable stat cards) ------------------------
  function facetRow(facet, value, label, count) {
    return (
      '<div class="statrow selectable" role="button" tabindex="0" aria-pressed="false" data-facet="' +
      esc(facet) + '" data-value="' + esc(value) + '"><span class="k">' +
      esc(label) + '</span><span class="v">' + esc(count) + "</span></div>"
    );
  }

  function renderOverview(overviewEl, firms, allRecords, stamp) {
    var total = allRecords.length;

    // By Topic — count each topic across all records, desc then name.
    var topicCounts = {};
    allRecords.forEach(function (r) {
      recTopics(r).forEach(function (t) {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      });
    });
    var topics = Object.keys(topicCounts).sort(function (a, b) {
      var d = topicCounts[b] - topicCounts[a];
      return d !== 0 ? d : a.localeCompare(b);
    });
    var topicRows = topics
      .map(function (t) { return facetRow("topic", t, t, topicCounts[t]); })
      .join("");

    // By Date — count records within each range (relative to REF_ISO).
    var dateRows = DATE_FILTERS.map(function (d) {
      var th = dateThreshold(d.value);
      var n = allRecords.filter(function (r) { return r.dateISO && r.dateISO >= th; }).length;
      return facetRow("date", d.value, d.label, n);
    }).join("");

    overviewEl.innerHTML =
      '<div class="stats">' +
        '<div class="statgroup statgroup--headline">' +
          "<h3>Total Articles</h3>" +
          '<div class="big" id="headline-total">' + total + "</div>" +
          '<div class="sub" id="headline-sub">across ' + firms.length +
          " firms · as at " + esc(stamp) + "</div>" +
        "</div>" +
        '<div class="statgroup statgroup--scroll statgroup--wide"><h3>By Topic</h3>' +
          '<div class="statgroup__scrollbody">' + topicRows + "</div></div>" +
        '<div class="statgroup"><h3>By Date</h3>' + dateRows + "</div>" +
      "</div>" +
      '<div class="global-bar">' +
        '<button type="button" class="clear-filters" id="clear-all" hidden>Clear all filters ✕</button>' +
        '<span class="count" id="global-count"></span>' +
      "</div>";

    // Wire the clickable stat rows.
    overviewEl.querySelectorAll(".statrow.selectable").forEach(function (rowEl) {
      function toggle() {
        var facet = rowEl.dataset.facet;
        var value = rowEl.dataset.value;
        var set = G[facet];
        // Date is single-select: clear the other date rows first.
        if (facet === "date") {
          overviewEl.querySelectorAll('.statrow.selectable[data-facet="date"]').forEach(function (o) {
            if (o !== rowEl) {
              o.classList.remove("active");
              o.setAttribute("aria-pressed", "false");
              G.date.delete(o.dataset.value);
            }
          });
        }
        if (set.has(value)) set.delete(value);
        else set.add(value);
        var on = set.has(value);
        rowEl.classList.toggle("active", on);
        rowEl.setAttribute("aria-pressed", on ? "true" : "false");
        updateAll();
      }
      rowEl.addEventListener("click", toggle);
      rowEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });
    });

    document.getElementById("clear-all").addEventListener("click", function () {
      G.topic.clear(); G.date.clear();
      overviewEl.querySelectorAll(".statrow.selectable.active").forEach(function (el) {
        el.classList.remove("active");
        el.setAttribute("aria-pressed", "false");
      });
      firmControllers.forEach(function (c) { c.clearSearch(); });
      updateAll();
    });
  }

  // ---- one firm section --------------------------------------------------
  function badgeHtml(badge, name) {
    if (badge && badge.logo) {
      var tileBg = badge.tile ? ' style="background:' + esc(badge.tile) + '"' : "";
      return '<span class="firm-badge"' + tileBg + '><img src="' + esc(badge.logo) +
        '" alt="' + esc(name) + ' logo" /></span>';
    }
    var color = (badge && badge.color) || "#333333";
    var initial = (badge && badge.initial) || (name || "?").charAt(0);
    return '<span class="firm-badge firm-badge--mono" style="background:' + esc(color) + '">' +
      esc(initial) + "</span>";
  }

  var COLS = [
    {
      key: "month", label: "Month", cls: "nowrap",
      sortVal: function (r) { return r.dateISO || ""; },
      cell: function (r) { return r.month ? esc(r.month) : '<span class="dash">—</span>'; },
    },
    {
      key: "title", label: "Article Name", cls: "title-cell",
      sortVal: function (r) { return (r.title || "").toLowerCase(); },
      cell: function (r) {
        var tag = r.overridden
          ? ' <span class="tag tag--manual" title="' + esc(r.notes || "Manually added") + '">manual</span>'
          : "";
        var link = r.permalink
          ? '<a href="' + esc(r.permalink) + '" rel="noopener" target="_blank">' +
            esc(r.title || "(untitled)") + "</a>"
          : esc(r.title || "(untitled)");
        var extra = "";
        if (Array.isArray(r.bullets) && r.bullets.length) {
          extra = '<ul class="bullets">' +
            r.bullets.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>";
        } else if (SHOW_TEASERS && r.teaser) {
          extra = '<p class="teaser">' + esc(r.teaser) + "</p>";
        }
        return link + tag + extra;
      },
    },
    {
      key: "dateISO", label: "Date", cls: "nowrap",
      sortVal: function (r) { return r.dateISO || ""; },
      cell: function (r) { return r.dateText ? esc(r.dateText) : '<span class="dash">—</span>'; },
    },
    {
      key: "topic", label: "Topic",
      sortVal: function (r) { return (r.topic || "").toLowerCase(); },
      cell: function (r) {
        var ts = recTopics(r);
        if (!ts.length) return '<span class="dash">—</span>';
        return ts.map(function (t) { return '<span class="topic-pill">' + esc(t) + "</span>"; }).join("");
      },
    },
    {
      key: "link", label: "Link", cls: "nowrap", noSort: true,
      sortVal: function () { return ""; },
      cell: function (r) {
        return r.permalink
          ? '<a class="viewlink" href="' + esc(r.permalink) + '" rel="noopener" target="_blank">View ↗</a>'
          : '<span class="dash">—</span>';
      },
    },
  ];

  function renderFirm(container, firm) {
    var section = document.createElement("section");
    section.className = "firm";
    section.id = "firm-" + firm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    var thead = COLS.map(function (c, i) {
      return '<th data-i="' + i + '"' + (c.noSort ? "" : ' aria-sort="none"') + ">" +
        esc(c.label) + (c.noSort ? "" : ' <span class="arrow">▲▼</span>') + "</th>";
    }).join("");

    section.innerHTML =
      '<div class="firm-head">' +
        badgeHtml(firm.badge, firm.name) +
        "<h2>" + esc(firm.name) + "</h2>" +
        '<a class="firm-source-link" href="' + esc(firm.sourceUrl) +
          '" rel="noopener" target="_blank">Visit insights ↗</a>' +
      "</div>" +
      '<div class="toolbar">' +
        '<div class="search"><input type="search" placeholder="Search ' +
          esc(firm.name) + " insights…\" aria-label=\"Search " + esc(firm.name) + '" /></div>' +
        '<div class="count"></div>' +
      "</div>" +
      '<div class="table-wrap"><table><thead><tr>' + thead +
        "</tr></thead><tbody></tbody></table></div>";

    container.appendChild(section);

    var tbody = section.querySelector("tbody");
    var ths = section.querySelectorAll("thead th");
    var countEl = section.querySelector(".toolbar .count");
    var searchEl = section.querySelector('input[type="search"]');

    var state = { sortKey: "dateISO", dir: -1, query: "" };

    function filteredRows() {
      var rows = firm.records.filter(function (r) {
        if (!matchesGlobal(r)) return false;
        if (state.query) {
          var hay = [r.title, r.topic, r.month, r.dateText, r.teaser]
            .filter(Boolean).join(" ").toLowerCase();
          if (hay.indexOf(state.query) === -1) return false;
        }
        return true;
      });
      var col = COLS.filter(function (c) { return c.key === state.sortKey; })[0] || COLS[0];
      rows.sort(function (a, b) {
        var va = col.sortVal(a), vb = col.sortVal(b);
        if (va < vb) return -1 * state.dir;
        if (va > vb) return 1 * state.dir;
        var da = a.dateISO || "", db = b.dateISO || "";
        if (da !== db) return da < db ? 1 : -1;
        return (a.title || "").localeCompare(b.title || "");
      });
      return rows;
    }

    function redraw() {
      var rows = filteredRows();
      // Hide the whole firm section when a global filter is active and this
      // firm has nothing to show (keeps a filtered view tidy).
      var hide = rows.length === 0 && (anyGlobalActive() || state.query);
      section.classList.toggle("is-hidden", hide);

      countEl.textContent = rows.length + " of " + firm.records.length;

      if (!rows.length) {
        var msg = "No matching items.";
        if (firm.manualOnly && firm.records.length === 0 && !state.query && !anyGlobalActive()) {
          msg = "This firm's site blocks automated access — its items are curated manually and none have been added yet.";
        }
        tbody.innerHTML = '<tr><td class="empty" colspan="' + COLS.length +
          '">' + esc(msg) + "</td></tr>";
      } else {
        tbody.innerHTML = rows.map(function (r) {
          return "<tr>" + COLS.map(function (c) {
            return "<td" + (c.cls ? ' class="' + c.cls + '"' : "") + ">" + c.cell(r) + "</td>";
          }).join("") + "</tr>";
        }).join("");
      }
      ths.forEach(function (th) {
        var c = COLS[Number(th.dataset.i)];
        if (c.noSort) return;
        th.setAttribute("aria-sort",
          c.key === state.sortKey ? (state.dir === 1 ? "ascending" : "descending") : "none");
      });
      return rows.length;
    }

    ths.forEach(function (th) {
      var c = COLS[Number(th.dataset.i)];
      if (c.noSort) return;
      th.addEventListener("click", function () {
        if (state.sortKey === c.key) state.dir *= -1;
        else { state.sortKey = c.key; state.dir = (c.key === "dateISO" || c.key === "month") ? -1 : 1; }
        redraw();
      });
    });

    var ctrl = {
      redraw: redraw,
      clearSearch: function () { state.query = ""; searchEl.value = ""; },
      lastCount: 0,
    };
    firmControllers.push(ctrl);

    var t;
    searchEl.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        state.query = searchEl.value.trim().toLowerCase();
        ctrl.lastCount = redraw();
        recomputeGlobalCount();
      }, 120);
    });
  }

  // ---- cross-firm updates ------------------------------------------------
  function recomputeGlobalCount() {
    var shown = 0, searching = false;
    firmControllers.forEach(function (c) { shown += c.lastCount || 0; });
    var gc = document.getElementById("global-count");
    var headline = document.getElementById("headline-total");
    if (headline) headline.textContent = shown;
    if (gc) gc.textContent = anyGlobalActive() ? shown + " matching insights" : "";
  }

  function updateAll() {
    var totalShown = 0;
    firmControllers.forEach(function (c) { c.lastCount = c.redraw(); totalShown += c.lastCount; });
    var clearBtn = document.getElementById("clear-all");
    if (clearBtn) clearBtn.hidden = !anyGlobalActive();
    var gc = document.getElementById("global-count");
    if (gc) gc.textContent = anyGlobalActive() ? totalShown + " matching insights" : "";
    var sub = document.getElementById("headline-total");
    if (sub) sub.textContent = totalShown;
  }

  // ---- staleness ---------------------------------------------------------
  function checkStaleness(generatedAt) {
    var banner = document.getElementById("staleness");
    var d = new Date(generatedAt);
    if (isNaN(d)) return;
    var ageHours = (Date.now() - d.getTime()) / 3600000;
    if (ageHours > 24) {
      banner.textContent =
        "This digest may be delayed — it refreshes automatically twice daily. " +
        "The figures below are from the last successful update.";
      banner.hidden = false;
    }
  }

  // ---- boot --------------------------------------------------------------
  function fail(msg) {
    var err = document.getElementById("error");
    err.textContent = msg;
    err.hidden = false;
    var loading = document.getElementById("loading");
    if (loading) loading.hidden = true;
  }

  function boot() {
    fetch("data.json?_=" + Date.now(), { cache: "no-store" })
      .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then(function (data) {
        var loading = document.getElementById("loading");
        if (loading) loading.hidden = true;

        var firms = Array.isArray(data.firms) ? data.firms : [];
        var generatedAt = data.generatedAt || new Date().toISOString();
        var stamp = fmtFullSydney(generatedAt);
        REF_ISO = generatedAt.slice(0, 10); // reference "today" for date ranges

        // Attach firm name onto each record for global filtering.
        var allRecords = [];
        firms.forEach(function (f) {
          (f.records || []).forEach(function (r) { r.firm = f.name; allRecords.push(r); });
        });

        renderOverview(document.getElementById("overview"), firms, allRecords, stamp);

        var firmsEl = document.getElementById("firms");
        firms.forEach(function (f) { renderFirm(firmsEl, f); });

        // Footer timestamp line.
        var fa = document.getElementById("footer-asat");
        if (fa) {
          fa.innerHTML = "This website covers all competition and consumer law articles published as at <strong>" +
            esc(stamp) + "</strong> (Australia/Sydney).";
        }

        // Footer source links.
        var srcEl = document.getElementById("source-links");
        if (srcEl) {
          srcEl.innerHTML = firms.map(function (f) {
            return '<a href="' + esc(f.sourceUrl) + '" rel="noopener" target="_blank">' +
              esc(f.name) + "</a>";
          }).join(" · ");
        }

        updateAll();
        checkStaleness(generatedAt);
      })
      .catch(function () {
        fail("Could not load insights data (data.json). If this site was just set up, the update workflow may not have run yet.");
      });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();

/* Table zoom control — 100% = current size (max); zooms out to 50%. */
(function () {
  "use strict";
  var MIN = 0.5, MAX = 1, STEP = 0.1, z = MAX;
  function apply() {
    document.documentElement.style.setProperty("--table-zoom", String(z));
    var lvl = document.getElementById("zoom-level");
    if (lvl) lvl.textContent = Math.round(z * 100) + "%";
    var zin = document.getElementById("zoom-in");
    var zout = document.getElementById("zoom-out");
    if (zin) zin.disabled = z >= MAX - 0.001;
    if (zout) zout.disabled = z <= MIN + 0.001;
  }
  document.addEventListener("DOMContentLoaded", function () {
    var zin = document.getElementById("zoom-in");
    var zout = document.getElementById("zoom-out");
    if (zout) zout.addEventListener("click", function () {
      z = Math.max(MIN, Math.round((z - STEP) * 100) / 100); apply();
    });
    if (zin) zin.addEventListener("click", function () {
      z = Math.min(MAX, Math.round((z + STEP) * 100) / 100); apply();
    });
    apply();
  });
})();
