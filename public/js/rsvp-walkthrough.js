document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("walkthroughForm");
  var steps = Array.from(document.querySelectorAll(".rsvp-step"));
  var progress = document.getElementById("rsvpProgress");
  var nextBtn = document.getElementById("nextStepBtn");
  var prevBtn = document.getElementById("prevStepBtn");
  var submitBtn = document.getElementById("submitRsvpBtn");
  var guestDetailsList = document.getElementById("guestDetailsList");
  var guestsInput = document.getElementById("guests");
  var attendanceInput = document.getElementById("attendance");
  var alertBox = document.getElementById("rsvpAlert");
  var maxGuests = window.RSVP_MAX_GUESTS || 1;
  var skipGuests = false;
  var redirectTimer;
  var isLocked = false;

  if (!form) return;

  var currentStep = 0;

  function updateProgress() {
    var pct = ((currentStep + 1) / steps.length) * 100;
    if (progress) {
      progress.style.width = pct + "%";
      progress.setAttribute("aria-valuenow", pct.toString());
    }
  }

  function showStep(index) {
    if (isLocked) return;
    steps.forEach(function (step, i) {
      step.classList.toggle("d-none", i !== index);
    });
    currentStep = index;
    prevBtn.disabled = currentStep === 0;
    nextBtn.classList.toggle("d-none", currentStep === steps.length - 1);
    submitBtn.classList.toggle("d-none", currentStep !== steps.length - 1);
    updateProgress();
  }

  function renderGuestDetails() {
    if (isLocked) return;
    if (!guestDetailsList) return;
    guestDetailsList.innerHTML = "";
    var attendanceVal = attendanceInput.value;
    var count = Number(guestsInput.value || 1);
    if (attendanceVal === "no") {
      skipGuests = true;
      count = 0;
      guestsInput.value = 0;
    } else {
      skipGuests = false;
      if (count > maxGuests) {
        count = maxGuests;
        guestsInput.value = maxGuests;
      }
      if (count < 1) {
        count = 1;
        guestsInput.value = 1;
      }
    }

    if (count > 0) {
      // Primary guest (the person filling the form)
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
    }

    for (var i = 2; i <= count; i++) {
      var guestWrapper = document.createElement("div");
      guestWrapper.className = "guest-item p-3 border rounded";
      guestWrapper.dataset.index = i.toString();

      var nameLabel = document.createElement("label");
      nameLabel.className = "form-label";
      nameLabel.textContent = "Guest " + i + " name";
      var nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "form-control guest-name";
      nameInput.placeholder = "Full name";
      nameInput.required = true;

      var allergyLabel = document.createElement("label");
      allergyLabel.className = "form-label mt-2";
      allergyLabel.textContent = "Guest " + i + " allergies or dietary needs (optional)";
      var allergyInput = document.createElement("input");
      allergyInput.type = "text";
      allergyInput.className = "form-control guest-allergies";
      allergyInput.placeholder = "Example: shellfish, peanuts, vegetarian";

      guestWrapper.appendChild(nameLabel);
      guestWrapper.appendChild(nameInput);
      guestWrapper.appendChild(allergyLabel);
      guestWrapper.appendChild(allergyInput);
      guestDetailsList.appendChild(guestWrapper);
    }
  }

  function validateStep(index) {
    if (alertBox) {
      alertBox.style.display = "none";
      alertBox.textContent = "";
    }
    if (index === 0) {
      var name = document.getElementById("name").value.trim();
      var email = document.getElementById("email").value.trim();
      if (!name || !email) {
        showAlert("Please provide your name and email.");
        return false;
      }
    } else if (index === 1) {
      var attendance = attendanceInput.value;
      var guestsVal = Number(guestsInput.value || 1);
      if (!attendance) {
        showAlert("Please select your attendance.");
        return false;
      }
      if (attendance === "no") {
        guestsInput.value = 0;
      } else {
        if (Number.isNaN(guestsVal) || guestsVal < 1) {
          showAlert("Guest count must be at least 1.");
          return false;
        }
        if (guestsVal > maxGuests) {
          guestsInput.value = maxGuests;
          showAlert("Your invitation allows up to " + maxGuests + " guest(s).");
          return false;
        }
      }
    } else if (index === 2) {
      if (skipGuests) return true;
      var guestItems = guestDetailsList
        ? guestDetailsList.querySelectorAll(".guest-item[data-index]")
        : [];
      for (var i = 0; i < guestItems.length; i++) {
        var guestItem = guestItems[i];
        var guestNameInput = guestItem.querySelector(".guest-name");
        if (!guestNameInput || !guestNameInput.value.trim()) {
          showAlert("Please provide the name for guest " + guestItem.dataset.index + ".");
          return false;
        }
      }
    }
    return true;
  }

  function showAlert(message, type) {
    if (!alertBox) return;
    if (redirectTimer) {
      clearTimeout(redirectTimer);
      redirectTimer = null;
    }
    alertBox.className = "alert alert-" + (type || "danger") + " mt-3";
    alertBox.textContent = message;
    alertBox.style.display = "block";
  }

  function lockForm() {
    isLocked = true;
    Array.from(form.elements).forEach(function (el) {
      el.disabled = true;
    });
  }

  nextBtn.addEventListener("click", function () {
    if (isLocked) return;
    if (!validateStep(currentStep)) {
      showStep(currentStep);
      return;
    }
    if (currentStep < steps.length - 1) {
      var target = currentStep + 1;
      if (skipGuests && target === 2) {
        target = 3;
      }
      showStep(target);
    }
  });

  prevBtn.addEventListener("click", function () {
    if (isLocked) return;
    if (currentStep > 0) {
      var target = currentStep - 1;
      if (skipGuests && currentStep === 3 && target === 2) {
        target = 1;
      }
      showStep(target);
    }
  });

  attendanceInput.addEventListener("change", renderGuestDetails);
  guestsInput.addEventListener("input", renderGuestDetails);
  if (guestsInput && maxGuests) {
    guestsInput.max = maxGuests;
    guestsInput.min = 0;
  }
  renderGuestDetails();
  showStep(0);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (isLocked) return;
    if (!validateStep(0)) {
      showStep(0);
      return;
    }
    if (!validateStep(1)) {
      showStep(1);
      return;
    }
    if (!validateStep(2)) {
      showStep(2);
      return;
    }

    var name = document.getElementById("name").value.trim();
    var email = document.getElementById("email").value.trim();
    var guests = Number(guestsInput.value || 0);
    var attendance = attendanceInput.value;
    var song = document.getElementById("song").value.trim();
    var message = document.getElementById("message").value.trim();

    var guestDetails = [];
    if (guests > 0) {
      var primaryAllergiesInput = document.getElementById("primaryAllergies");
      guestDetails.push({
        name: name,
        allergies: primaryAllergiesInput ? primaryAllergiesInput.value.trim() : "",
      });
      var guestItems = guestDetailsList
        ? guestDetailsList.querySelectorAll(".guest-item[data-index]")
        : [];
      guestItems.forEach(function (guestItem) {
        var guestNameInput = guestItem.querySelector(".guest-name");
        var guestAllergyInput = guestItem.querySelector(".guest-allergies");
        guestDetails.push({
          name: guestNameInput ? guestNameInput.value.trim() : "",
          allergies: guestAllergyInput ? guestAllergyInput.value.trim() : "",
        });
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
      showAlert("Thank you! We have your response.", "success");
      form.reset();
      renderGuestDetails();
      showStep(0);
      lockForm();
      redirectTimer = setTimeout(function () {
        window.location.href = "/";
      }, 2500);
    } catch (err) {
      showAlert(err.message);
    }
  });
});
