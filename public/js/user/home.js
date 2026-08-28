
// NOTE: showToast(), addToCart()/isAddToCart, and addToWishlist()/removeWishlist() are
// intentionally NOT redefined here — they're already declared globally by showMessage.js,
// which this page loads before home.js. Redeclaring `let isAddToCart` a second time in the
// same (non-module) global scope throws a SyntaxError that aborts this entire script, and
// home.js's old copy of addToCart() looked up its button via a duplicate `id="addToCart"`
// shared by every product card, so it only ever re-enabled the first card's button.
function pleaseLogin() {
    Swal.fire({
        title: "Please login",
        text: "You need to login to continue.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, login",
        cancelButtonText: "Cancel",
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = "/login"; // Redirect to login page
        }
    });
}
