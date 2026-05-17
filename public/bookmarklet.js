// SocialScopeIQ bookmarklet
// Runs when the user clicks the bookmark on a third-party page (Facebook, NextDoor, Quora, LinkedIn, etc.).
// Tries to detect the post automatically. If detection fails, prompts the user.
(function () {
  var API = "https://socialscopeiq.com/api/bookmarklet";

  // Best-effort detection. Each site has different DOM. We fall back to selection / prompt.
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

  function getSelectedOr(selectors) {
    var sel = (window.getSelection() || "").toString().trim();
    if (sel) return sel;
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

  // Try to pull a sensible title and body from common patterns.
  var detectedTitle =
    document.querySelector("meta[property='og:title']")?.getAttribute("content") ||
    document.title ||
    "";
  var detectedBody = getSelectedOr([
    "[role='article']",
    "main article",
    "article",
    "[data-testid='post_message']",
    ".feed-shared-update-v2__description",
    ".question-text"
  ]).slice(0, 4000);

  // Show a small confirm dialog so the user can clean it up before POST.
  var title = prompt("Post title (edit if needed):", detectedTitle.slice(0, 240)) || "";
  if (!title) return;

  var author = prompt("Author (or 'Unknown'):", "") || "Unknown";

  var body = prompt(
    "Post body (a sentence or two is fine — used for tier classification + drafting):",
    detectedBody.slice(0, 800)
  ) || "";

  var sourceGuess =
    community === "Facebook" ? (document.title || "Facebook group") :
    community === "NextDoor" ? "NextDoor" :
    community === "Quora" ? "Quora question" :
    community === "LinkedIn" ? "LinkedIn post" :
    community;

  var source = prompt("Source (group name / topic):", sourceGuess) || sourceGuess;

  var payload = {
    community: community,
    source: source,
    post_title: title,
    post_url: url,
    author: author,
    body: body
  };

  fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (j.status === "inserted") {
        alert("Captured to SocialScopeIQ (tier " + j.tier + "). Open the dashboard to review.");
      } else if (j.status === "exists") {
        alert("Already captured — see the dashboard.");
      } else {
        alert("Error: " + (j.error || "unknown"));
      }
    })
    .catch(function (e) { alert("Network error: " + e.message); });
})();
