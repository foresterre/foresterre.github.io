(function () {
  "use strict";

  const MAX_RESULTS = 20;
  const SNIPPET_BEFORE = 60;
  const SNIPPET_AFTER = 150;
  const WORD_CHAR = /[\p{L}\p{N}]/u;

  /**
   * @param {string} text
   * @returns {string}
   */
  function fold(text) {
    return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  }

  /**
   * @param {string} text
   * @returns {{ text: string, map: number[] }}
   */
  function foldWithMap(text) {
    let out = "";
    const map = [];
    let offset = 0;
    for (const ch of text) {
      const folded = fold(ch);
      for (let k = 0; k < folded.length; k += 1) {
        map.push(offset);
      }
      out += folded;
      offset += ch.length;
    }
    map.push(offset);
    return { text: out, map: map };
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @param {string} query
   * @returns {string[]}
   */
  function queryTerms(query) {
    const terms = fold(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return Array.from(new Set(terms));
  }

  /**
   * @param {string} haystack
   * @param {number} position
   * @returns {boolean}
   */
  function isWordStart(haystack, position) {
    return position === 0 || !WORD_CHAR.test(haystack[position - 1]);
  }

  /**
   * @param {string} source
   * @param {string[]} terms
   * @param {number} [from]
   * @param {number} [to]
   * @returns {string}
   */
  function highlight(source, terms, from, to) {
    const folded = foldWithMap(source);
    const start = Math.max(0, from === undefined ? 0 : from);
    const end = Math.min(folded.text.length, to === undefined ? folded.text.length : to);

    /** @type {Array<[number, number]>} */
    const ranges = [];
    for (const term of terms) {
      let at = folded.text.indexOf(term, start);
      while (at !== -1 && at < end) {
        ranges.push([at, Math.min(at + term.length, end)]);
        at = folded.text.indexOf(term, at + term.length);
      }
    }
    ranges.sort(function (a, b) { return a[0] - b[0]; });

    let html = "";
    let cursor = start;
    for (const range of ranges) {
      if (range[1] <= cursor) {
        continue;
      }
      const markStart = Math.max(range[0], cursor);
      html += escapeHtml(source.slice(folded.map[cursor], folded.map[markStart]));
      html += "<mark>" + escapeHtml(source.slice(folded.map[markStart], folded.map[range[1]])) + "</mark>";
      cursor = range[1];
    }
    html += escapeHtml(source.slice(folded.map[cursor], folded.map[end]));
    return html;
  }

  /**
   * @param {SearchDoc} doc
   * @param {string[]} terms
   * @returns {string}
   */
  function snippet(doc, terms) {
    let first = -1;
    for (const term of terms) {
      const at = doc.foldedBody.indexOf(term);
      if (at !== -1 && (first === -1 || at < first)) {
        first = at;
      }
    }
    if (first === -1) {
      const fallback = doc.description || doc.body;
      return escapeHtml(fallback.slice(0, SNIPPET_BEFORE + SNIPPET_AFTER).trim()) + (fallback.length > SNIPPET_BEFORE + SNIPPET_AFTER ? "..." : "");
    }

    // Folded and source offsets differ, but only by a few characters, so word boundaries are searched in the folded text.
    let from = Math.max(0, first - SNIPPET_BEFORE);
    let to = Math.min(doc.foldedBody.length, first + SNIPPET_AFTER);
    if (from > 0) {
      const space = doc.foldedBody.indexOf(" ", from);
      from = space !== -1 && space < first ? space + 1 : from;
    }
    if (to < doc.foldedBody.length) {
      const space = doc.foldedBody.lastIndexOf(" ", to);
      to = space > first ? space : to;
    }
    return (from > 0 ? "..." : "") + highlight(doc.body, terms, from, to) + (to < doc.foldedBody.length ? "..." : "");
  }

  /**
   * @typedef {{
   *   url: string, title: string, body: string, description: string, date: string,
   *   foldedTitle: string, foldedBody: string, foldedDescription: string
   * }} SearchDoc
   */

  /**
   * @param {unknown} raw
   * @returns {SearchDoc[]}
   */
  function prepareIndex(raw) {
    if (!Array.isArray(raw)) {
      throw new Error('The search index is not a JSON array. Set index_format = "fuse_json" under [search] in zola.toml.');
    }
    /** @type {SearchDoc[]} */
    const docs = [];
    for (const entry of raw) {
      if (!entry || typeof entry.url !== "string" || typeof entry.title !== "string" || entry.title.trim() === "") {
        continue;
      }
      const body = typeof entry.body === "string" ? entry.body.replace(/\s+/g, " ").trim() : "";
      const description = typeof entry.description === "string" ? entry.description : "";
      docs.push({
        url: entry.url,
        title: entry.title,
        body: body,
        description: description,
        date: typeof entry.date === "string" ? entry.date : "",
        foldedTitle: fold(entry.title),
        foldedBody: fold(body),
        foldedDescription: fold(description),
      });
    }
    return docs;
  }

  /**
   * @param {SearchDoc} doc
   * @param {string[]} terms
   * @returns {number}
   */
  function score(doc, terms) {
    let total = 0;
    for (const term of terms) {
      const inTitle = doc.foldedTitle.indexOf(term);
      const inDescription = doc.foldedDescription.indexOf(term);
      const inBody = doc.foldedBody.indexOf(term);
      if (inTitle === -1 && inDescription === -1 && inBody === -1) {
        return 0;
      }
      if (inTitle !== -1) {
        total += isWordStart(doc.foldedTitle, inTitle) ? 12 : 5;
      }
      if (inDescription !== -1) {
        total += 4;
      }
      if (inBody !== -1) {
        total += isWordStart(doc.foldedBody, inBody) ? 3 : 1;
      }
    }
    return total;
  }

  /**
   * @param {string} value
   * @param {string} locale
   * @returns {string}
   */
  function formatDate(value, locale) {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    try {
      return new Intl.DateTimeFormat(locale || undefined, { dateStyle: "long", timeZone: "UTC" }).format(date);
    } catch (_error) {
      return date.toISOString().slice(0, 10);
    }
  }

  /**
   * @param {HTMLElement} target
   * @returns {boolean}
   */
  function isEditable(target) {
    return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
  }

  function initSearch() {
    const dialog = /** @type {HTMLDialogElement | null} */ (document.querySelector("[data-search]"));
    if (!dialog || typeof dialog.showModal !== "function") {
      return;
    }
    const input = /** @type {HTMLInputElement} */ (dialog.querySelector("[data-search-input]"));
    const status = /** @type {HTMLElement} */ (dialog.querySelector("[data-search-status]"));
    const list = /** @type {HTMLOListElement} */ (dialog.querySelector("[data-search-results]"));
    const indexUrl = dialog.getAttribute("data-index") || "";
    const locale = document.documentElement.lang;

    /** @type {Promise<SearchDoc[]> | null} */
    let indexPromise = null;
    let generation = 0;
    let debounce = 0;

    /** @returns {Promise<SearchDoc[]>} */
    function loadIndex() {
      if (indexPromise === null) {
        indexPromise = fetch(indexUrl, { credentials: "same-origin" })
          .then(function (response) {
            if (!response.ok) {
              throw new Error("The search index at " + indexUrl + " returned HTTP " + response.status + ". Check that build_search_index is true in zola.toml.");
            }
            return response.json();
          })
          .then(prepareIndex)
          .catch(function (error) {
            // A failed load can be retried the next time someone types.
            indexPromise = null;
            throw error;
          });
      }
      return indexPromise;
    }

    /** @param {string} text */
    function setStatus(text) {
      status.textContent = text;
    }

    /**
     * @param {SearchDoc[]} docs
     * @param {string[]} terms
     */
    function render(docs, terms) {
      const fragment = document.createDocumentFragment();
      for (const doc of docs) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = doc.url;

        const title = document.createElement("span");
        title.className = "r-title";
        title.innerHTML = highlight(doc.title, terms);
        link.appendChild(title);

        const dateText = formatDate(doc.date, locale);
        if (dateText) {
          const meta = document.createElement("span");
          meta.className = "r-meta";
          meta.textContent = dateText;
          link.appendChild(meta);
        }

        const excerpt = document.createElement("span");
        excerpt.className = "r-snippet";
        excerpt.innerHTML = snippet(doc, terms);
        link.appendChild(excerpt);

        item.appendChild(link);
        fragment.appendChild(item);
      }
      list.replaceChildren(fragment);
    }

    function runSearch() {
      const query = input.value;
      const terms = queryTerms(query);
      generation += 1;
      const current = generation;

      if (terms.length === 0) {
        list.replaceChildren();
        setStatus("");
        return;
      }

      if (indexPromise === null) {
        setStatus("Loading the search index...");
      }

      loadIndex().then(
        (docs) => {
          // A newer query started while the index was loading, so this result is stale.
          if (current !== generation) {
            return;
          }
          const hits = [];
          for (const doc of docs) {
            const value = score(doc, terms);
            if (value > 0) {
              hits.push({ doc: doc, value: value });
            }
          }
          hits.sort(function (a, b) {
            return b.value - a.value || b.doc.date.localeCompare(a.doc.date);
          });
          const shown = hits.slice(0, MAX_RESULTS).map(function (hit) { return hit.doc; });
          render(shown, terms);

          if (hits.length === 0) {
            setStatus('No articles match "' + query.trim() + '".');
          } else if (hits.length > MAX_RESULTS) {
            setStatus("Showing the first " + MAX_RESULTS + " of " + hits.length + " articles. Add a word to narrow the search.");
          } else {
            setStatus(hits.length === 1 ? "1 article found." : hits.length + " articles found.");
          }
        },
        (error) => {
          if (current !== generation) {
            return;
          }
          console.error(`[waystation] ${fmtError(error)}`);
          list.replaceChildren();
          setStatus("Search is not available right now. Try again later.");
        }
      );
    }

    function open() {
      if (!dialog.open) {
        dialog.showModal();
      }
      input.focus();
      input.select();
      // Start loading early, so the first keystroke does not wait for the network.
      loadIndex().catch(function () { /* Reported when a search runs. */ });
    }

    function close() {
      if (dialog.open) {
        dialog.close();
      }
    }

    /** @returns {HTMLAnchorElement[]} */
    function resultLinks() {
      return Array.from(list.querySelectorAll("a"));
    }

    document.addEventListener("click", function (event) {
      const target = /** @type {Element} */ (event.target);
      if (target instanceof Element && target.closest("[data-search-open]")) {
        event.preventDefault();
        open();
      }
    });

    document.addEventListener("keydown", function (event) {
      const target = /** @type {HTMLElement} */ (event.target);
      const slash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditable(target);
      const shortcut = (event.key === "k" || event.key === "K") && (event.ctrlKey || event.metaKey) && !event.altKey;
      if (slash || shortcut) {
        event.preventDefault();
        open();
      }
    });

    dialog.querySelector("[data-search-close]")?.addEventListener("click", close);

    // A click on the backdrop has the dialog itself as target, because the content fills the whole box.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        close();
      }
    });

    input.addEventListener("input", function () {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(runSearch, 70);
    });

    input.addEventListener("keydown", function (event) {
      const links = resultLinks();
      if (event.key === "ArrowDown" && links.length > 0) {
        event.preventDefault();
        links[0].focus();
      } else if (event.key === "Enter" && links.length > 0) {
        event.preventDefault();
        links[0].click();
      }
    });

    list.addEventListener("keydown", function (event) {
      const links = resultLinks();
      const index = links.indexOf(/** @type {HTMLAnchorElement} */ (document.activeElement));
      if (index === -1) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        links[Math.min(index + 1, links.length - 1)].focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (index === 0) {
          input.focus();
        } else {
          links[index - 1].focus();
        }
      }
    });
  }

  function initTagFilter() {
    const nav = document.querySelector("[data-tag-filter]");
    const target = document.querySelector("[data-filter-target]");
    if (!nav || !target) {
      return;
    }
    const chips = /** @type {HTMLAnchorElement[]} */ (Array.from(nav.querySelectorAll("[data-slug]")));
    const stations = /** @type {HTMLElement[]} */ (Array.from(target.querySelectorAll("[data-tags]")));
    const years = /** @type {HTMLElement[]} */ (Array.from(target.querySelectorAll("[data-year]")));
    const status = nav.querySelector("[data-filter-status]");

    /** @type {Map<HTMLElement, string[]>} */
    const stationTags = new Map();
    for (const station of stations) {
      let tags = [];
      try {
        const parsed = JSON.parse(station.getAttribute("data-tags") || "[]");
        tags = Array.isArray(parsed) ? parsed.map(String) : [];
      } catch (_error) {
        tags = [];
      }
      stationTags.set(station, tags);
    }

    /** @param {string} slug */
    function chipForSlug(slug) {
      return chips.find(function (chip) { return chip.getAttribute("data-slug") === slug; });
    }

    /**
     * @param {string} slug
     * @param {boolean} announce
     */
    function apply(slug, announce) {
      let chip = chipForSlug(slug);
      const unknown = chip === undefined;
      if (chip === undefined) {
        chip = chipForSlug("");
      }
      const tag = chip ? chip.getAttribute("data-tag") || "" : "";

      for (const other of chips) {
        if (other === chip) {
          other.setAttribute("aria-current", "true");
        } else {
          other.removeAttribute("aria-current");
        }
      }

      let visible = 0;
      for (const station of stations) {
        const show = tag === "" || (stationTags.get(station) || []).includes(tag);
        station.hidden = !show;
        if (show) {
          visible += 1;
        }
      }
      for (const year of years) {
        year.hidden = year.querySelector("[data-tags]:not([hidden])") === null;
      }

      if (!status) {
        return;
      }
      if (unknown && slug !== "") {
        status.textContent = 'There is no tag "' + slug + '". Showing all articles.';
      } else if (tag !== "") {
        status.textContent = "Showing " + visible + (visible === 1 ? " article" : " articles") + " tagged " + tag + ".";
      } else if (announce) {
        status.textContent = "Showing all " + visible + " articles.";
      } else {
        status.textContent = "";
      }
    }

    function slugFromUrl() {
      return new URL(window.location.href).searchParams.get("tag") || "";
    }

    nav.addEventListener("click", function (event) {
      const mouse = /** @type {MouseEvent} */ (event);
      const target = /** @type {Element} */ (event.target);
      const chip = target instanceof Element ? target.closest("[data-slug]") : null;
      // Modified clicks keep their normal meaning, like opening the tag page in a new tab.
      if (!chip || mouse.button !== 0 || mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) {
        return;
      }
      event.preventDefault();
      const slug = chip.getAttribute("data-slug") || "";
      const url = new URL(window.location.href);
      if (slug) {
        url.searchParams.set("tag", slug);
      } else {
        url.searchParams.delete("tag");
      }
      window.history.pushState({ tag: slug }, "", url);
      apply(slug, true);
    });

    window.addEventListener("popstate", function () {
      apply(slugFromUrl(), true);
    });

    apply(slugFromUrl(), false);
  }

  const SCHEME_KEY = "waystation-scheme";

  /**
   * @returns {"light" | "dark" | null}
   */
  function storedScheme() {
    try {
      const value = localStorage.getItem(SCHEME_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {"light" | "dark" | null} value
   */
  function storeScheme(value) {
    try {
      if (value) {
        localStorage.setItem(SCHEME_KEY, value);
      } else {
        localStorage.removeItem(SCHEME_KEY);
      }
    } catch (e) {
      console.warn(`[waystation] localstorage isn't working... ${fmtError(e)}`)
    }
  }

  function initSchemeToggle() {
    const button = document.querySelector("[data-scheme-toggle]");
    const item = document.querySelector("[data-scheme-item]");
    if (!button || !item) return;

    const root = document.documentElement;
    /** @type {Record<"auto" | "light" | "dark", {next: "auto" | "light" | "dark", name: string}>} */
    const cycle = {
      auto: { next: "light", name: "system" },
      light: { next: "dark", name: "light" },
      dark: { next: "auto", name: "dark" },
    };

    /** @returns {"auto" | "light" | "dark"} */
    function currentChoice() {
      const value = root.dataset.scheme;
      return value === "light" || value === "dark" ? value : "auto";
    }

    function sync() {
      const choice = currentChoice();
      const next = cycle[choice].next;
      button.dataset.state = choice;
      button.setAttribute("aria-label", "Colour scheme: " + cycle[choice].name + ". Switch to " + cycle[next].name + ".");
      button.title = "Colour scheme: " + cycle[choice].name;
    }

    button.addEventListener("click", function () {
      const next = cycle[currentChoice()].next;
      root.dataset.scheme = next;
      storeScheme(next === "auto" ? null : next);
      sync();
    });

    // Keeps other open tabs of the site in step.
    window.addEventListener("storage", function (event) {
      if (event.key !== SCHEME_KEY && event.key !== null) return;
      root.dataset.scheme = storedScheme() || "auto";
      sync();
    });

    sync();
    item.hidden = false;
  }

  /**
   * @param {any} error
   */
  function fmtError(error) {
    return error instanceof Error ? error.message : JSON.stringify(error);
  }

  function init() {
    initSearch();
    initTagFilter();
    initSchemeToggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
