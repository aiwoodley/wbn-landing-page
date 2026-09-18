// Woodley Brothers Networks — engagement tracking + personalization + form capture
(function () {
  "use strict";

  var API_BASE = window.WBN_API_BASE || ""; // same-origin by default
  var STORE_KEY = "wbn_engagement_v1";

  // ---------- persisted engagement model ----------
  function loadState() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : { visits: 0, sections: {}, ctas: {}, lastVisit: null, leadCaptured: false };
    } catch (e) {
      return { visits: 0, sections: {}, ctas: {}, lastVisit: null, leadCaptured: false };
    }
  }
  function saveState(state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  var state = loadState();
  var priorState = JSON.parse(JSON.stringify(state)); // snapshot BEFORE this visit's tracking, used to personalize
  state.visits += 1;
  state.lastVisit = new Date().toISOString();
  saveState(state);

  // ---------- personalization ----------
  // Decide the single dominant prior interest from last visit's section dwell + cta clicks.
  function dominantInterest(snapshot) {
    var scores = { starlink: 0, security: 0, monitoring: 0, pdf: 0, newsletter: 0, contact: 0 };
    Object.keys(snapshot.sections || {}).forEach(function (k) {
      if (scores.hasOwnProperty(k)) scores[k] += snapshot.sections[k];
    });
    Object.keys(snapshot.ctas || {}).forEach(function (k) {
      if (scores.hasOwnProperty(k)) scores[k] += snapshot.ctas[k] * 3; // clicks weigh more than views
    });
    var best = null, bestScore = 0;
    Object.keys(scores).forEach(function (k) {
      if (scores[k] > bestScore) { bestScore = scores[k]; best = k; }
    });
    return bestScore > 0 ? best : null;
  }

  var PERSONALIZATION = {
    starlink: {
      headline: "Still Fighting Bad Signal on the Road?",
      subhead: "You looked at connectivity last time. Let's get your Starlink or cell booster installed right and never think about signal again.",
      ctaPrimary: "Book My Connectivity Install",
      ctaTarget: "starlink"
    },
    security: {
      headline: "Ready to Lock Down That Home Network?",
      subhead: "Last visit you were checking out the security build. Here's the fastest path: book the audit, or grab the free guide first.",
      ctaPrimary: "Book a Security Audit",
      ctaTarget: "security"
    },
    monitoring: {
      headline: "Let Us Watch Your Network So You Don't Have To",
      subhead: "You were looking at managed monitoring. One dedicated Pi, watched around the clock, with a heads-up before something breaks.",
      ctaPrimary: "Start Managed Monitoring",
      ctaTarget: "monitoring"
    },
    pdf: {
      headline: "Grab the Guide You Were Reading About",
      subhead: "You checked out the Starter Stack guide last time — here's the fast way back to it, plus the premium edition if you're ready to go further.",
      ctaPrimary: "Get the Free Starter Guide",
      ctaTarget: "guide"
    },
    newsletter: {
      headline: "Welcome Back — More Builds, No Fluff",
      subhead: "You're already reading Home Network Intel. Here's what's new since your last visit.",
      ctaPrimary: "Read the Latest Build",
      ctaTarget: "newsletter"
    }
  };

  function applyPersonalization() {
    var interest = dominantInterest(priorState);
    if (!interest || !PERSONALIZATION[interest]) return;
    var p = PERSONALIZATION[interest];

    var headlineEl = document.querySelector('[data-personalize="headline"]');
    var subEl = document.querySelector('[data-personalize="subhead"]');
    var ctaEl = document.querySelector('[data-personalize="cta-primary"]');
    if (headlineEl) headlineEl.textContent = p.headline;
    if (subEl) subEl.textContent = p.subhead;
    if (ctaEl) {
      ctaEl.textContent = p.ctaPrimary;
      ctaEl.setAttribute("href", p.ctaTarget === "guide" ? "#guide" : "#" + p.ctaTarget);
      if (p.ctaTarget !== "guide") {
        // route the returning, security/monitoring/starlink-interested visitor straight to
        // the booking form pre-selected to their prior interest
        ctaEl.setAttribute("href", "#contact");
        ctaEl.addEventListener("click", function () {
          var sel = document.getElementById("contact-interest");
          if (sel) sel.value = p.ctaTarget;
        });
      }
    }

    // Premium upsell block gets warmer if they already saw the guide before
    if (priorState.sections && priorState.sections.pdf) {
      var upsell = document.getElementById("premium-upsell");
      if (upsell) upsell.classList.add("is-warm");
    }

    document.body.setAttribute("data-personalized-for", interest);
  }

  // ---------- engagement tracking (THIS visit, for the NEXT visit's personalization) ----------
  function trackSections() {
    var targets = document.querySelectorAll("[data-track-section]");
    if (!("IntersectionObserver" in window) || !targets.length) return;
    var seen = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
          var key = entry.target.getAttribute("data-track-section");
          seen[key] = (seen[key] || 0) + 1;
          state.sections[key] = (state.sections[key] || 0) + 1;
          saveState(state);
        }
      });
    }, { threshold: [0.35] });
    targets.forEach(function (t) { observer.observe(t); });
  }

  function trackCtaClicks() {
    document.querySelectorAll("[data-cta-target], [data-engagement]").forEach(function (el) {
      el.addEventListener("click", function () {
        var key = el.getAttribute("data-cta-target") || el.getAttribute("data-engagement");
        if (!key) return;
        state.ctas[key] = (state.ctas[key] || 0) + 1;
        saveState(state);
      });
    });
  }

  // ---------- form capture ----------
  function wireForm(formId, endpoint, successId, onSuccess) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      if (btn) { btn.disabled = true; btn.textContent = "Sending..."; }

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      data.engagement_snapshot = state;
      data.submitted_at = new Date().toISOString();

      fetch(API_BASE + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("bad response");
          return res.json();
        })
        .then(function (json) {
          form.hidden = true;
          var success = document.getElementById(successId);
          if (success) success.hidden = false;
          if (endpoint === "/api/lead") {
            state.leadCaptured = true;
            state.sections.pdf = (state.sections.pdf || 0) + 3;
            saveState(state);
            if (json && json.download_url) {
              window.location.href = json.download_url;
            }
          }
          if (typeof onSuccess === "function") onSuccess();
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originalText || "Try Again"; }
          alert("Something went wrong sending that — please try again in a moment.");
        });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyPersonalization();
    trackSections();
    trackCtaClicks();
    wireForm("lead-form", "/api/lead", "lead-success");
    wireForm("newsletter-form", "/api/newsletter", "newsletter-success");
    wireForm("contact-form", "/api/booking", "contact-success");
    wirePremiumCheckout();
  });

  function wirePremiumCheckout() {
    var btn = document.getElementById("premium-buy-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var emailInput = document.getElementById("premium-email");
      var email = emailInput ? emailInput.value.trim() : "";
      if (!email || email.indexOf("@") === -1) {
        emailInput && emailInput.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = "Redirecting...";
      fetch(API_BASE + "/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, product: "premium_guide" }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("checkout_failed");
          return res.json();
        })
        .then(function (data) {
          var success = document.getElementById("premium-success");
          if (success) success.hidden = false;
          if (data && data.checkout_url) {
            window.location.href = data.checkout_url;
          }
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = "Buy the Premium Guide";
          alert("Checkout couldn't start — please try again in a moment.");
        });
    });
  }
})();
