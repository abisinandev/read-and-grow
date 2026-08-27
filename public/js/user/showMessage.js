
function showToast(message, type = 'error') {
    Toastify({
        text: message,
        duration: 2000,
        gravity: "top",
        position: "center",
        backgroundColor: type === 'success' ? "#16a34a" : "#dc2626", // green-600 for success, red-600 for error
        stopOnFocus: true,
    }).showToast();
}

async function addToWishlist(button, data) {
    // const wishlistBtn = document.getElementById('wishlistBtn')

    // console.log(wishlistBtn)

    try {
        const response = await fetch('/wishlist/add', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: data })
        })

        const result = await response.json()
        console.log(result)
        if (!response.ok) {
            throw Error(result.message || 'Product not added to wishlist')
            return
        }

        showToast(result.message || 'Product added to wishlist', 'success')
        const icon = button.querySelector('i');
        if (icon) {
            icon.classList.toggle('fas');
            icon.classList.toggle('far');
            icon.classList.toggle('text-red-500');
            icon.classList.toggle('text-gray-600');
        }

        // setTimeout(() => {
        //     location.reload()
        // }, 1000);
    } catch (error) {
        console.log('Add to Wishlist ', error.message)
        showToast(error.message || 'Something went wrong', 'error')
    }
}

async function removeWishlist(data) {
    console.log(data)
    try {
        const response = await fetch(`/wishlist/remove/${data}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: data })
        })

        const result = await response.json()
        console.log(result)
        if (!response.ok) {
            throw Error(result.message || 'Product remove from wishlist failed')
            return
        }

        showToast(result.message || 'Product removed from wishlist', 'success')
        // Remove card from DOM if on wishlist page
        const wishlistCard = document.getElementById(`wishlist-card-${data}`);
        if (wishlistCard) {
            wishlistCard.style.transition = 'opacity 0.3s, transform 0.3s';
            wishlistCard.style.opacity = '0';
            wishlistCard.style.transform = 'scale(0.9)';
            setTimeout(() => {
                wishlistCard.remove();
                // Check if empty
                if (document.querySelectorAll('.wishlist-card').length === 0) {
                    location.reload();
                }
            }, 300);
        } else {
            // If on shop page, toggle icon back
            const wishlistBtn = document.querySelector(`button[onclick="removeWishlist('${data}')"]`);
            if (wishlistBtn) {
                wishlistBtn.setAttribute('onclick', `addToWishlist(this, '${data}')`);
                const icon = wishlistBtn.querySelector('i');
                if (icon) {
                    icon.classList.remove('fas', 'text-red-500');
                    icon.classList.add('far', 'text-gray-600');
                }
            }
        }
    } catch (error) {
        console.log('Remove from Wishlist ', error.message)
        showToast(error.message || 'Something went wrong', 'error')
    }
}


// Add to Cart function
let isAddToCart = false;
async function addToCart(productId) {
    if (isAddToCart) return;
    isAddToCart = true;

    try {
        const button = document.querySelector(`button[onclick="addToCart('${productId}')"]`);
        const originalText = button.innerHTML;
        // button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;

        const response = await fetch(`/cart`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId })
        });

        const result = await response.json();
        if (!response.ok) {
            showToast(result.message || 'Something went wrong');
        }

        if (result.success) {
            showToast(result.message, 'success');

            // setTimeout(() => {
            //     location.reload()
            // }, 1200);
        }

    } catch (error) {
        console.error('Add to cart error:', error);
        showToast('Something went wrong');
    } finally {
        // Restore button state
        const button = document.querySelector(`button[onclick="addToCart('${productId}')"]`);
        if (button) {
            button.innerHTML = 'ADD TO CART';
            button.disabled = false;
        }

        // Reset flag after delay
        setTimeout(() => { isAddToCart = false; }, 1000);
    }
}
