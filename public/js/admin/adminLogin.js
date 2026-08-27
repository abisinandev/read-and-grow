
    
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
            return value.trim() != "" && /[a-zA-Z]/.test(value)
        }
    
        function isPassword(value) {
            return /[a-z]/.test(value) &&
                // /[A-Z]/       .test(value) &&
                /[0-9]/.test(value) &&
                // /[^A-Za-z0-9]/.test(value) &&
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
                showError(username, "Please enter a valid username")
            }
    
            if (!isRequired(password.value)) {
                isValid = false
                showError(password, "Please enter a valid password")
            } else if (!isPassword(password.value)) {
                isValid = false
                showError(password, 'Password includes 6 charecters with strong value')
            }
    
            if (!isValid) {
                return
            }
    
    
            const url = "/admin/login"
            setLoading(true)
            try {

                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: username.value.trim(),
                        password: password.value
                    })
                })

                const result = await response.json()
                console.log(result)

                if (!response.ok) {
                    notyf.error(result.message)
                    setLoading(false)
                    return
                }
                console.log(response, 'fetch responese');

                if (result.success) {
                    notyf.success(result.message)
                    // Left disabled/spinning through the redirect on purpose — the page is
                    // about to navigate away, so there's nothing to re-enable it for.
                    setTimeout(() => {
                        window.location.href = result.redirect || "/admin/dashboard"
                    }, 1000);
                } else {
                    setLoading(false)
                }


            } catch (error) {

                // A network failure previously failed silently — the admin just saw the button
                // do nothing, with no indication anything went wrong.
                notyf.error("Something went wrong. Please check your connection and try again.")
                setLoading(false)
                console.log("Login error : ", error.message)
            }
    
        })
    })
     