// Smooth scroll helper WITH offset for fixed nav
function scrollToSection(id) {
  var el = document.getElementById(id);
  if (!el) return;

  // Get fixed navbar height (adjust selector if needed)
  var nav = document.querySelector(".navbar");
  var navHeight = nav ? nav.offsetHeight : 0;

  // Extra breathing room under the nav (optional)
  var extraOffset = 16; // px

  // Element position relative to the document
  var y =
    el.getBoundingClientRect().top +
    window.pageYOffset -
    navHeight -
    extraOffset;

  window.scrollTo({
    top: y,
    behavior: "smooth",
  });
}

document.addEventListener("click", function (e) {
  var link = e.target.closest('a[href^="#"]');
  if (!link) return;

  var id = link.getAttribute("href").substring(1);
  if (!id) return;

  var target = document.getElementById(id);
  if (!target) return;

  e.preventDefault();
  scrollToSection(id);
});

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
  var guestsInput = document.getElementById("guests");
  var guestDetailsGroup = document.getElementById("guestDetailsGroup");
  var guestDetailsList = document.getElementById("guestDetailsList");
  var primaryNameInput = document.getElementById("name");
  if (!form || !alertBox) return;

  // Build per-guest name/allergy inputs based on guest count
  function renderGuestDetails() {
    var count = Number(guestsInput.value || 1);
    if (!guestDetailsList) return;
    guestDetailsList.innerHTML = "";

    // Primary guest allergy field
    var primaryWrapper = document.createElement("div");
    primaryWrapper.className = "guest-item";
    var primaryLabel = document.createElement("label");
    primaryLabel.className = "form-label";
    primaryLabel.textContent = "Your food allergies or dietary needs (optional)";
    var primaryInput = document.createElement("input");
    primaryInput.type = "text";
    primaryInput.className = "form-control guest-allergies";
    primaryInput.id = "primaryAllergies";
    primaryWrapper.appendChild(primaryLabel);
    primaryWrapper.appendChild(primaryInput);
    guestDetailsList.appendChild(primaryWrapper);

    // Additional guest entries
    for (var i = 2; i <= count; i++) {
      var guestWrapper = document.createElement("div");
      guestWrapper.className = "guest-item";
      guestWrapper.dataset.index = i.toString();

      var nameLabel = document.createElement("label");
      nameLabel.className = "form-label";
      nameLabel.textContent = "Guest " + i + " name";
      var nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "form-control guest-name";
      nameInput.required = true;

      var allergyLabel = document.createElement("label");
      allergyLabel.className = "form-label mt-2";
      allergyLabel.textContent = "Guest " + i + " allergies or dietary needs (optional)";
      var allergyInput = document.createElement("input");
      allergyInput.type = "text";
      allergyInput.className = "form-control guest-allergies";

      guestWrapper.appendChild(nameLabel);
      guestWrapper.appendChild(nameInput);
      guestWrapper.appendChild(allergyLabel);
      guestWrapper.appendChild(allergyInput);
      guestDetailsList.appendChild(guestWrapper);
    }

    if (guestDetailsGroup) {
      guestDetailsGroup.style.display = count >= 1 ? "block" : "none";
    }
  }
  guestsInput.addEventListener("input", renderGuestDetails);
  renderGuestDetails();

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    alertBox.style.display = "none";

    var name = document.getElementById("name").value.trim();
    var email = document.getElementById("email").value.trim();
    var guests = Number(document.getElementById("guests").value || 1);
    var attendance = document.getElementById("attendance").value;
    var song = document.getElementById("song").value.trim();
    var message = document.getElementById("message").value.trim();

    var guestDetails = [];
    var primaryAllergiesInput = document.getElementById("primaryAllergies");
    guestDetails.push({
      name: name,
      allergies: primaryAllergiesInput ? primaryAllergiesInput.value.trim() : "",
    });

    var additionalGuests = guestDetailsList
      ? guestDetailsList.querySelectorAll(".guest-item[data-index]")
      : [];
    for (var i = 0; i < additionalGuests.length; i++) {
      var guestItem = additionalGuests[i];
      var guestNameInput = guestItem.querySelector(".guest-name");
      var guestAllergyInput = guestItem.querySelector(".guest-allergies");
      var guestName = guestNameInput ? guestNameInput.value.trim() : "";
      var guestAllergy = guestAllergyInput ? guestAllergyInput.value.trim() : "";

      if (!guestName) {
        alertBox.className = "alert alert-danger mt-3";
        alertBox.textContent = "Please provide the name for guest " + guestItem.dataset.index + ".";
        alertBox.style.display = "block";
        return;
      }

      guestDetails.push({
        name: guestName,
        allergies: guestAllergy,
      });
    }

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
          guestDetails,
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

      alertBox.className = "alert alert-success mt-3";
      alertBox.textContent = successMsg;
      alertBox.style.display = "block";
      form.reset();
    } catch (err) {
      alertBox.className = "alert alert-danger mt-3";
      alertBox.textContent = err.message;
      alertBox.style.display = "block";
    }
  });
})();
