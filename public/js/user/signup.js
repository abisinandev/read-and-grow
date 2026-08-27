

document.addEventListener('DOMContentLoaded', function () {

    const form = document.getElementById("form")
    const username = document.getElementById("username")
    const email = document.getElementById("email")
    const phoneNumber = document.getElementById("phoneNumber")
    const confirmPassword = document.getElementById("confirmPassword")
    const password = document.getElementById("password")
    const referalCode = document.getElementById('referalCode')
    const signupButton = document.getElementById("signupButton")
    const signupButtonSpinner = document.getElementById("signupButtonSpinner")
    const signupButtonText = document.getElementById("signupButtonText")

    function setLoading(isLoading) {
        if (!signupButton) return
        signupButton.disabled = isLoading
        if (signupButtonSpinner) signupButtonSpinner.classList.toggle('hidden', !isLoading)
        if (signupButtonText) signupButtonText.textContent = isLoading ? 'Signing up...' : 'Sign Up'
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


    function isValidEmail(email) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailPattern.test(email)
    }

    function isStrongPassword(password) {
        return /[a-z]/.test(password) &&
            // /[A-Z]/       .test(password) &&
            /[0-9]/.test(password) &&
            // /[^A-Za-z0-9]/.test(password) &&
            password.length >= 6;
    }

    function isPhoneNumber(value) {
        const pattern = /^\d{10}$/;
        return pattern.test(value)
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
        clearError(email)
        clearError(phoneNumber)
        clearError(password)
        clearError(confirmPassword)


        let isValid = true
        if (!isRequired(username.value)) {
            isValid = false
            showError(username, "Username is required")
        }

        if (username.value.length < 3) {
            isValid = false
            showError(username, 'Username must be at least 3 characters')
        }

        if (!isRequired(email.value)) {
            isValid = false
            showError(email, "Email required")
        } else if (!isValidEmail(email.value)) {
            isValid = false
            showError(email, "Please enter valid email ")
        }

        if (phoneNumber.value === "") {
            isValid = false;
            showError(phoneNumber, "Phone number is required");
        } else if (!isPhoneNumber(phoneNumber.value)) {
            isValid = false;
            showError(phoneNumber, "Please enter a valid 10-digit phone number");
        }


        if (!isRequired(password.value)) {
            isValid = false
            showError(password, "Password is required")
        } else if (!isStrongPassword(password.value)) {
            isValid = false
            showError(password, 'Password must be at least 6 characters and include a letter and a number')
        }

        if (!isRequired(confirmPassword.value)) {
            isValid = false
            showError(confirmPassword, "Please confirm your password")
        } else if (password.value !== confirmPassword.value) {
            isValid = false
            showError(confirmPassword, "Password is not matching")
        }

        if (!isValid) return // if not valid
        
 
        const url = "/signup"
        setLoading(true)

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: username.value,
                    email: email.value,
                    phoneNumber: phoneNumber.value,
                    password: password.value,
                    confirmPassword: confirmPassword.value,
                    referralCode: referalCode.value
                })
            })

            const result = await response.json()

            if (!response.ok) {
                notyf.error(result.message)
                setLoading(false)
                return
            }

            console.log(result, 'result fetch')

            // The redirect used to fire unconditionally even if result.success came back
            // false — harmless today since the backend never returns 200 with success:false,
            // but a page navigating away on a failure response it never actually checked was
            // one bad response shape away from silently sending someone to a broken page.
            if (result.success) {
                localStorage.setItem("otpToken", result?.token)
                notyf.success(result.message)
                setTimeout(() => {
                    window.location.href = result.redirect
                }, 1000);
            } else {
                notyf.error(result.message || "Something went wrong. Please try again.")
                setLoading(false)
            }

        } catch (error) {
            console.log("Signup error : ", error.message)
            notyf.error("Something went wrong. Please check your connection and try again.")
            setLoading(false)
        }

    })
})
