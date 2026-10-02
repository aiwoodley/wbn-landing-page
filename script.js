// Woodley Solutions — audit request + client onboarding forms (Netlify Forms).
(function () {
  "use strict";

  function validate(form) {
    var firstBad = null;
    var req = form.querySelectorAll("[required]");
    for (var i = 0; i < req.length; i++) {
      var el = req[i];
      var ok = el.type === "checkbox" ? el.checked
        : el.type === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())
        : el.value.trim() !== "";
      el.classList.toggle("invalid", !ok);
      if (!ok && !firstBad) firstBad = el;
    }
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  function wire(form) {
    var status = form.querySelector(".form-status");
    var btn = form.querySelector("button[type=submit]");
    var label = btn.textContent;
    var onboarding = form.id === "onboard-form";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form-status";
      if (!validate(form)) {
        status.className = "form-status err";
        status.textContent = "Please fill in the highlighted fields.";
        return;
      }
      // Fold the "help with" checkboxes into one readable field.
      var goals = form.querySelector("input[type=hidden][name=goals]");
      if (goals) {
        goals.value = Array.prototype.map.call(
          form.querySelectorAll("input[name=goal_opt]:checked"), function (c) { return c.value; }).join(", ");
      }
      var fd = new FormData(form);
      fd.delete("goal_opt");
      var body = new URLSearchParams(fd).toString();

      btn.disabled = true;
      btn.textContent = "Sending…";
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body
      })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          form.querySelectorAll("input,select,textarea,button").forEach(function (el) { el.disabled = true; });
          status.className = "form-status ok";
          status.textContent = onboarding
            ? "Got it. Within one business day we'll email our invite addresses and Business ID, and confirm your kickoff call."
            : "Got it. We'll start on your audit and email your scorecard within 3 business days.";
          status.scrollIntoView({ behavior: "smooth", block: "center" });
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = label;
          status.className = "form-status err";
          status.innerHTML = 'Something went wrong sending the form. Please try again, or email <a href="mailto:info@woodleysolutions.tech">info@woodleysolutions.tech</a>.';
        });
    });
  }

  ["audit-form", "onboard-form"].forEach(function (id) {
    var f = document.getElementById(id);
    if (f) wire(f);
  });

  // "Ask about a network install" preselects that option on the audit form.
  var net = document.querySelector("[data-network-link]");
  if (net) net.addEventListener("click", function () {
    var sel = document.getElementById("a-type");
    if (sel) sel.value = "Home network install";
  });
})();
