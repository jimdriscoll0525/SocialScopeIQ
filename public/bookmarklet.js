/* SocialScopeIQ bookmarklet.
   Runs when the user clicks the bookmark on a third-party page (Facebook, NextDoor,
   Quora, LinkedIn, etc.). Tries to detect the post automatically; falls back to the
   user's text selection, then to a prompt.
   The __SSIQ_TOKEN__ placeholder is replaced with the signed-in user's capture
   token when the /bookmarklet page packs this file, so captures land under the
   right account (session cookies don't ride along on cross-site POSTs).
   NOTE: no line comments in this file — the /bookmarklet page collapses it to one
   line, and a stray "//" (comment or not) would break the packed string. */
(function () {
  var API = "https://www.socialscopeiq.com/api/bookmarklet";
  var TOKEN = "__SSIQ_TOKEN__";

  function detectCommunity() {
    var h = location.hostname.toLowerCase();
    if (h.indexOf("facebook.com") !== -1) return "Facebook";
    if (h.indexOf("nextdoor.com") !== -1) return "NextDoor";
    if (h.indexOf("quora.com") !== -1) return "Quora";
    if (h.indexOf("linkedin.com") !== -1) return "LinkedIn";
    if (h.indexOf("reddit.com") !== -1) return "Reddit";
    if (h.indexOf("biggerpockets.com") !== -1) return "BiggerPockets";
    return "Manual";
  }

  var selection = (window.getSelection() ? String(window.getSelection()) : "").trim();

  function getSelectedOr(selectors) {
    if (selection) return selection;
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.textContent && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
    return "";
  }

  var community = detectCommunity();
  var url = location.href;
  var pageTitle = document.title || "";

  var ogTitleEl = document.querySelector("meta[property='og:title']");
  var detectedTitle = (ogTitleEl && ogTitleEl.getAttribute("content")) || pageTitle;
  var detectedAuthor = "";

  if (community === "LinkedIn") {
    /* LinkedIn's DOM has no stable selectors, but post pages title themselves
       "<Author> on LinkedIn: <text>" — parse that for author + title. On generic
       pages ("Feed | LinkedIn" etc.) fall back to the user's selection. */
    var liMatch = pageTitle.match(/^(.+?) on LinkedIn: ?(.*)$/);
    if (liMatch) {
      detectedAuthor = liMatch[1].replace(/^\(\d+\)\s*/, "").trim();
      if (liMatch[2].trim()) detectedTitle = liMatch[2].trim();
    } else if (/\| LinkedIn$/.test(pageTitle) && selection) {
      detectedTitle = selection;
    }
  }

  /* Facebook group detection: /groups/<id-or-slug>/... in the path. The group
     name comes from the page title minus the "(3) " unread counter and the
     " | Facebook" suffix. Feeds the Group Map (auto-mark joined / candidate). */
  var groupUrl = "";
  var groupName = "";
  if (community === "Facebook") {
    var gm = location.pathname.match(/\/groups\/([^\/?#]+)/);
    if (gm && gm[1] && gm[1] !== "feed" && gm[1] !== "discover" && gm[1] !== "joins") {
      groupUrl = "https://www.facebook.com/groups/" + gm[1] + "/";
      groupName = pageTitle
        .replace(/^\(\d+\)\s*/, "")
        .replace(/\s*\|\s*Facebook\s*$/i, "")
        .trim();
    }
  }

  var detectedBody = getSelectedOr([
    "[role='article']",
    "main article",
    "article",
    "[data-testid='post_message']",
    ".feed-shared-update-v2__description",
    ".question-text"
  ]).slice(0, 4000);

  /* Small confirm dialog so the user can clean it up before POST. */
  var title = prompt("Post title (edit if needed):", detectedTitle.slice(0, 240)) || "";
  if (!title) return;

  var author = prompt("Author (or 'Unknown'):", detectedAuthor) || "Unknown";

  var body = prompt(
    "Post body (a sentence or two is fine — used for tier classification + drafting):",
    detectedBody.slice(0, 800)
  ) || "";

  var sourceGuess =
    community === "Facebook" ? (groupName || pageTitle || "Facebook group") :
    community === "NextDoor" ? "NextDoor" :
    community === "Quora" ? "Quora question" :
    community === "LinkedIn" ? "LinkedIn post" :
    community;

  var source = prompt("Source (group name / topic):", sourceGuess) || sourceGuess;

  var payload = {
    token: TOKEN,
    community: community,
    source: source,
    post_title: title,
    post_url: url,
    author: author,
    body: body,
    group_url: groupUrl,
    group_name: groupName || source
  };

  fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(function (r) { return r.json().then(function (j) { return { status: r.status, json: j }; }); })
    .then(function (res) {
      var j = res.json;
      if (res.status === 401) {
        alert("SocialScopeIQ: this bookmarklet is out of date. Sign in and re-drag it from the Bookmarklet page.");
      } else if (j.status === "inserted") {
        alert("Captured to SocialScopeIQ (tier " + j.tier + "). Open the dashboard to review.");
      } else if (j.status === "exists") {
        alert("Already captured — see the dashboard.");
      } else {
        alert("Error: " + (j.error || "unknown"));
      }
    })
    .catch(function (e) { alert("Network error: " + e.message); });
})();
