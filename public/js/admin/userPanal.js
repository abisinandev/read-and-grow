function showToast(message, type = 'error') {
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "center",
        backgroundColor: type === 'success' ? "#16a34a" : "#dc2626",
        stopOnFocus: true,
    }).showToast();
}

async function isBlock(url) {
    try {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "Do you want to change this user's status?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        });

        if (result.isConfirmed) {
            const response = await fetch(url, {
                method: 'PUT'
            });

            if (response.redirected) {
                window.location.href = response.url;
            } else {
                showToast('Failed to update user status');
            }
        }
    } catch (error) {
        console.log("User panal : ", error.message)
        showToast('Something went wrong');
    }
}

// NOTE: search used to also be wired up from this file, but it had two problems: the listener
// was attached at the top level of a non-deferred <script> loaded in <head> (so it ran before
// #formData existed in the DOM and threw immediately, before ever attaching), and even if it
// had attached, it called a `/admin/search` endpoint that doesn't exist, expecting a response
// shape the server never returns. users.ejs's own inline script already implements search
// correctly against the real `/admin/users` endpoint, so it's kept there instead of duplicated
// (and broken) here.
