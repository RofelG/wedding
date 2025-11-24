// Smooth scroll helper
function scrollToSection(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Countdown timer
(function initCountdown() {
  // Set your wedding date/time here Philippine time
  var weddingDate = new Date("2026-05-18T14:00:00+08:00"); // adjust time if needed

  function updateCountdown() {
    var now = new Date().getTime();
    var distance = weddingDate.getTime() - now;

    var daysEl = document.getElementById("days");
    var hoursEl = document.getElementById("hours");
    var minutesEl = document.getElementById("minutes");
    var secondsEl = document.getElementById("seconds");

    if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

    if (distance <= 0) {
      daysEl.textContent = "0";
      hoursEl.textContent = "0";
      minutesEl.textContent = "0";
      secondsEl.textContent = "0";
      return;
    }

    var days = Math.floor(distance / (1000 * 60 * 60 * 24));
    var hours = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((distance % (1000 * 60)) / 1000);

    daysEl.textContent = days;
    hoursEl.textContent = hours.toString().padStart(2, "0");
    minutesEl.textContent = minutes.toString().padStart(2, "0");
    secondsEl.textContent = seconds.toString().padStart(2, "0");
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
})();

// Simple fade-in on scroll using IntersectionObserver
(function initFadeIn() {
  var sections = document.querySelectorAll(".fade-section");
  if (!("IntersectionObserver" in window) || sections.length === 0) {
    // Fallback: just show all
    sections.forEach(function (sec) {
      sec.classList.add("is-visible");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  sections.forEach(function (sec) {
    observer.observe(sec);
  });
})();

// RSVP form handler (calls backend API)
(function initRSVPForm() {
  var form = document.getElementById("rsvpForm");
  var alertBox = document.getElementById("rsvpAlert");
  if (!form || !alertBox) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    alertBox.style.display = "none";

    var name = document.getElementById("name").value.trim();
    var email = document.getElementById("email").value.trim();
    var guests = Number(document.getElementById("guests").value || 1);
    var attendance = document.getElementById("attendance").value;
    var song = document.getElementById("song").value.trim();
    var message = document.getElementById("message").value.trim();

    try {
      var res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          guests,
          attendance,
          song,
          message,
        }),
      });

      var data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sorry, something went wrong.");
      }

      var successMsg = "Thank you! We have your response.";
      if (attendance === "yes") {
        successMsg = "Yay! Thanks, " + name + ". We will save you a spot.";
      } else if (attendance === "maybe") {
        successMsg = "Thanks, " + name + ". Let us know when you can confirm.";
      } else if (attendance === "no") {
        successMsg = "Thanks for letting us know, " + name + ". We'll miss you.";
      }

      alertBox.className = "alert alert-success";
      alertBox.textContent = successMsg;
      alertBox.style.display = "block";
      form.reset();
    } catch (err) {
      alertBox.className = "alert alert-danger";
      alertBox.textContent = err.message;
      alertBox.style.display = "block";
    }
  });
})();
