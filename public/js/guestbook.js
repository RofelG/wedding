document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('guestbookForm');
  const alertBox = document.getElementById('guestbookAlert');
  const submitBtn = form.querySelector('button[type="submit"]');

  function showAlert(message, type = 'danger') {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.style.display = 'block';
    
    // Scroll alert into view
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() {
    alertBox.style.display = 'none';
  }

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    hideAlert();

    const name = document.getElementById('guestbookName').value.trim();
    const email = document.getElementById('guestbookEmail').value.trim();
    const message = document.getElementById('guestbookMessage').value.trim();

    // Basic validation
    if (!name || !message) {
      showAlert('Please fill in all required fields.');
      return;
    }

    if (name.length < 2) {
      showAlert('Please enter a valid name.');
      return;
    }

    if (message.length < 5) {
      showAlert('Please write a meaningful message (at least 5 characters).');
      return;
    }

    if (email && !isValidEmail(email)) {
      showAlert('Please enter a valid email address or leave it blank.');
      return;
    }

    // Disable submit button
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const response = await fetch('/rsvp/guestbook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit your message');
      }

      // Success!
      showAlert(
        'Thank you for your message! We truly appreciate your love and support. 💖',
        'success'
      );

      // Clear form
      form.reset();

      // Optional: Redirect after a delay
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);

    } catch (error) {
      console.error('Guestbook submission error:', error);
      showAlert(error.message || 'Something went wrong. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  function isValidEmail(email) {
    // Simple email validation
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
});
