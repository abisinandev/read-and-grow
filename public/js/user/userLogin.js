document.addEventListener('DOMContentLoaded', function () {

    const username = document.getElementById("username")
    const password = document.getElementById("password")
    const form = document.getElementById("form")
    const loginButton = document.getElementById("loginButton")
    const loginButtonSpinner = document.getElementById("loginButtonSpinner")
    const loginButtonText = document.getElementById("loginButtonText")

    function setLoading(isLoading) {
        if (!loginButton) return
        loginButton.disabled = isLoading
        if (loginButtonSpinner) loginButtonSpinner.classList.toggle('hidden', !isLoading)
        if (loginButtonText) loginButtonText.textContent = isLoading ? 'Signing in...' : 'Login'
    }

    const notyf = new Notyf({
        duration: 3000,
        position: {
            x: 'center',
            y: 'top',
        }
    })

    function isRequired(value) {
        const trimmed = value.trim();
      
        const isUsername = /[a-zA-Z]/.test(trimmed);
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
      
        return trimmed !== "" && (isUsername || isEmail);
      }
      

    function isPassword(value) {
        return /[a-z]/.test(value) &&
            /[0-9]/.test(value) &&
            value.length > 4;
    }

    function showError(field, message) {
        clearError(field)
        const errorDiv = document.createElement("div")
        errorDiv.className = 'error'
        errorDiv.style.color = 'red'
        errorDiv.style.fontSize = "13px"
        errorDiv.innerHTML = message
        field.parentNode.insertBefore(errorDiv, field.nextSibling)
    }

    function clearError(field) {
        const errorDiv = field.parentNode.querySelector(".error")
        if (errorDiv) {
            errorDiv.remove()
        }
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault()

        clearError(username)
        clearError(password)

        let isValid = true
        if (!isRequired(username.value)) {
            isValid = false
            showError(username, "Please enter a valid username or email")
        }

        if (username.value.length < 3) {
            isValid = false
            showError(username, 'Username must be at least 3 characters')
        }

        if (!isRequired(password.value)) {
            isValid = false
            showError(password, "Please enter a valid password")
        } else if (!isPassword(password.value)) {
            isValid = false
            showError(password, "Password must be at least 6 characters long and will be securely protected.")
        }

        if (!isValid) {
            return
        }

        const url = "/login"
        setLoading(true)
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: username.value.trim(),
                    password: password.value
                })
            });

            // Check if response is valid JSON
            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.message || "Something went wrong");
            }

            if (result.success) {
                notyf.success(result.message || "Login successful");
                // Left disabled/spinning through the redirect on purpose — the page is about
                // to navigate away, so there's nothing to re-enable it for.
                setTimeout(() => {
                    window.location.href = result.redirect || "/";
                }, 1000);
            } else {
                setLoading(false)
            }

        } catch (error) {
            console.error("Login error:", error);
            notyf.error(error.message);
            setLoading(false)
        }
    });
});
