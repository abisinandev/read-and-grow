import { attachAddressEventListeners, injectAddressCard, refreshAddressContainer } from "./address.js";

let isToastShowing = false;
let isProcessing = false;

function showToast(message, type = 'error') {
    if (isToastShowing) return;

    isToastShowing = true;
    Toastify({
        text: message,
        duration: 2000,
        gravity: "top",
        position: "center",
        backgroundColor: type === 'success' ? "#16a34a" : "#dc2626",
        stopOnFocus: true,
        callback: function () {
            isToastShowing = false;
        }
    }).showToast();
}

document.addEventListener('DOMContentLoaded', function () {
    attachAddressEventListeners();

    // Modal elements
    const addModal = document.getElementById('addAddressModal');
    const editModal = document.getElementById('editAddressModal');
    const addForm = document.getElementById('addAddressForm');
    const editForm = document.getElementById('editAddressForm');
    const addCancelBtn = document.getElementById('cancelAddBtn');
    const editCancelBtn = document.getElementById('cancelEditBtn');
    const saveAddBtn = document.getElementById('saveAddBtn');
    const saveEditBtn = document.getElementById('saveEditBtn');

    // Main checkout form
    const checkoutForm = document.getElementById('checkoutForm');

    // Add address form submission
    if (addForm) {
        addForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (isProcessing) return;

            // Reset previous errors
            document.querySelectorAll('.error').forEach(el => el.remove());

            const formData = new FormData(this);

            const addressData = {
                firstName: formData.get('firstName').trim(),
                lastName: formData.get('lastName').trim(),
                street: formData.get('street').trim(),
                city: formData.get('city').trim(),
                state: formData.get('state').trim(),
                zip: formData.get('zip').trim(),
                phone: formData.get('phone').trim(),
                addressType: formData.get('addressType').trim()
            };

            // Validation functions
            const isValidName = name => /^[A-Za-z]+$/.test(name);
            const isValidZip = zip => /^\d{5,6}$/.test(zip);
            const isValidPhone = phone => /^\d{10}$/.test(phone);
            const isValidAddressType = type => ['Home', 'Work'].includes(type);

            // Check required fields
            let errors = [];

            if (!isValidName(addressData.firstName)) errors.push({ field: 'firstName', message: 'Enter a valid first name' });
            if (!isValidName(addressData.lastName)) errors.push({ field: 'lastName', message: 'Enter a valid last name' });
            if (!addressData.street) errors.push({ field: 'street', message: 'Street is required' });
            if (!addressData.city) errors.push({ field: 'city', message: 'City is required' });
            if (!addressData.state) errors.push({ field: 'state', message: 'State is required' });
            if (!isValidZip(addressData.zip)) errors.push({ field: 'zip', message: 'Enter a valid ZIP code (5-6 digits)' });
            if (!isValidPhone(addressData.phone)) errors.push({ field: 'phone', message: 'Enter a valid 10-digit phone number' });


            // Display validation errors
            if (errors.length > 0) {
                errors.forEach(error => {
                    const inputField = document.querySelector(`[name="${error.field}"]`);
                    if (inputField) {
                        const errorMsg = document.createElement('p');
                        errorMsg.className = 'error text-red-500 text-sm';
                        errorMsg.textContent = error.message;
                        inputField.insertAdjacentElement('afterend', errorMsg);
                    }
                });
                return;
            }

            // If validation passes, proceed with form submission
            isProcessing = true;
            saveAddBtn.disabled = true;
            saveAddBtn.innerHTML = 'Saving...';

            try {
                const response = await fetch('/address', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(addressData)
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to add address');

                showToast('Address added successfully!', 'success');
                addModal.classList.add('hidden');
                addForm.reset();

                if (result.address) {
                    injectAddressCard(result.address);
                    attachAddressEventListeners();
                } else {
                    await refreshAddressContainer();
                }
            } catch (err) {
                showToast(err.message, 'error');
                console.error('Error adding address:', err);
            } finally {
                isProcessing = false;
                saveAddBtn.disabled = false;
                saveAddBtn.innerHTML = 'Save';
            }
        });
    }

    // Edit address form submission
    if (editForm) {
        editForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (isProcessing) return;

            // Reset previous errors
            document.querySelectorAll('.error').forEach(el => el.remove());

            const addressId = this.getAttribute('data-address-id');

            const formData = new FormData(this);

            const addressData = {
                firstName: formData.get('firstName').trim(),
                lastName: formData.get('lastName').trim(),
                street: formData.get('street').trim(),
                city: formData.get('city').trim(),
                state: formData.get('state').trim(),
                zip: formData.get('zip').trim(),
                phone: formData.get('phone').trim(),
                addressType: formData.get('addressType').trim()
            };

            // Validation functions
            const isValidName = name => /^[A-Za-z]+$/.test(name);
            const isValidZip = zip => /^\d{5,6}$/.test(zip);
            const isValidPhone = phone => /^\d{10}$/.test(phone);
            const isValidAddressType = type => ['Home', 'Work'].includes(type);

            // Check required fields
            let errors = [];

            if (!isValidName(addressData.firstName)) errors.push({ field: 'firstName', message: 'Enter a valid first name' });
            if (!isValidName(addressData.lastName)) errors.push({ field: 'lastName', message: 'Enter a valid last name' });
            if (!addressData.street) errors.push({ field: 'street', message: 'Street is required' });
            if (!addressData.city) errors.push({ field: 'city', message: 'City is required' });
            if (!addressData.state) errors.push({ field: 'state', message: 'State is required' });
            if (!isValidZip(addressData.zip)) errors.push({ field: 'zip', message: 'Enter a valid ZIP code (5-6 digits)' });
            if (!isValidPhone(addressData.phone)) errors.push({ field: 'phone', message: 'Enter a valid 10-digit phone number' });


            // Display validation errors
            if (errors.length > 0) {
                errors.forEach(error => {
                    const inputField = document.querySelector(`[name="${error.field}"]`);
                    if (inputField) {
                        const errorMsg = document.createElement('p');
                        errorMsg.className = 'error text-red-500 text-sm';
                        errorMsg.textContent = error.message;
                        inputField.insertAdjacentElement('afterend', errorMsg);
                    }
                });
                return;
            }

            // If validation passes, proceed with form submission
            isProcessing = true;
            saveEditBtn.disabled = true;
            saveEditBtn.innerHTML = 'Saving...';

            try {
                const response = await fetch(`/address/${addressId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(addressData)
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to update address');

                showToast('Address updated successfully!', 'success');
                editModal.classList.add('hidden');
                await refreshAddressContainer();
            } catch (err) {
                showToast(err.message, 'error');
                console.error('Error updating address:', err);
            } finally {
                isProcessing = false;
                saveEditBtn.disabled = false;
                saveEditBtn.innerHTML = 'Save';
            }
        });
    }


    // Address event listeners are now attached via attachAddressEventListeners

    const paymentOptions = document.querySelectorAll('input[name="paymentMethod"]');
    paymentOptions.forEach(option => {
        option.addEventListener('change', function () {
            document.querySelectorAll('.payment-option').forEach(label => {
                label.classList.remove('border-blue-500', 'border-2');
            });

            this.closest('.payment-option').classList.add('border-blue-500', 'border-2');
            console.log(`Selected payment method: ${this.value}`);
        });
    });

    const addAddressBtn = document.getElementById('addAddressBtn');
    if (addAddressBtn) {
        addAddressBtn.addEventListener('click', function () {
            if (addModal) {
                addModal.classList.remove('hidden');
            } else {
                window.location.href = '/add-address?redirect=checkout';
            }
        });
    }

    //===============================CHECKOUT FORM CONFIRM ORDER================================
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (isProcessing) return;

            const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked').value;

            const subTotal = parseFloat(document.getElementById('subTotal')?.dataset.value) || 0;

            const discountElement = document.getElementById('discount');
            let discount = 0;
            if (discountElement) {
                discount = parseFloat(discountElement.dataset.value) || 0;
            }

            const shippingCharge = parseFloat(document.getElementById('shipping')?.dataset.value) || 0;
            const finalPriceElement = document.querySelector('.text-xl.font-bold.text-red-500');
            let finalPrice;
            if (finalPriceElement) {
                finalPrice = parseFloat(finalPriceElement.dataset.price) || 0;
                console.log(finalPrice);
            }

            console.log(selectedPayment, subTotal, discount, shippingCharge, finalPrice);

            if (!selectedPayment) {
                showToast('Please select a payment method', 'error');
                return;
            }

            const addressRadio = document.querySelector('input[name="deliveryAddress"]:checked');
            if (!addressRadio) {
                showToast('Please select a delivery address', 'error');
                return;
            }
            const selectedAddress = addressRadio.dataset.addressId;

            if (selectedPayment === 'COD') {
                if (finalPrice > 1000) {
                    showToast("COD you can't allowed over 1000/-")
                    return
                }
                placeOrder('pending')
            }

            if (selectedPayment === 'Wallet') {
                try {
                    const response = await fetch('/wallet', {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ finalPrice })
                    })

                    const result = await response.json()

                    if (!response.ok) {
                        Swal.fire({
                            icon: "error",
                            title: "Oops...",
                            text: result.message,
                            footer: '<a href="#">Why do I have this issue?</a>'
                        });
                        return
                    }

                    Swal.fire({
                        title: result.message,
                        icon: "success",

                    })

                    placeOrder('paid')
                } catch (error) {
                    console.log(error.message)
                    showToast('Wallet is not working', 'error')
                }
            }

            if (selectedPayment === 'Razorpay') {
                isProcessing = true;
                try {
                    const orderData = {
                        // addressId: selectedAddress,
                        // paymentMethod: selectedPayment,
                        // shippingCharge,
                        subTotal,
                        finalPrice,
                        receipt: 'receipt#1',
                        notes: {},
                        currency: "INR"
                    };

                    console.log('Submitting order:', orderData);

                    const response = await fetch('/create-order', {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(orderData)
                    });

                    const order = await response.json();
                    console.log(order, 'orders')
                    if (!response.ok) {
                        Swal.fire({
                            title: "Warning!",
                            text: order.message,
                            icon: "warning",
                            confirmButtonText: "OK",
                        })
                    }
                    const options = {
                        key: 'rzp_test_ft2g0i6HYiyfqh', // Replace with your Razorpay key_id
                        amount: order.amount, // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
                        currency: order.currency,
                        name: 'Read-and-grow',
                        description: 'Transaction',
                        order_id: order.id, // This is the order_id created in the backend
                        callback_url: '/success', // Your success URL
                        prefill: {
                            name: 'Abisinan',
                            email: 'abisinanabisinan9@gmail.com',
                            contact: '8086001138'
                        },
                        theme: {
                            color: '#F37254'
                        },

                        handler: function (response) {

                            fetch('/verify-payment', {
                                method: "POST",
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    razorpay_order_id: response.razorpay_order_id,
                                    razorpay_payment_id: response.razorpay_payment_id,
                                    razorpay_signature: response.razorpay_signature
                                })
                            }).then(res => res.json())
                                .then(data => {
                                    if (data.status === 'Ok') {
                                        placeOrder('paid')
                                        // window.location.href = '/success';
                                    } else {
                                        console.log(data.message);
                                        showToast('Payment verification failed', 'error');
                                        failedPayment()
                                    }
                                })
                                .catch((error) => {
                                    console.error("Error:", error);
                                    showToast("Payment verification failed", "error");
                                });
                        }
                    };

                    console.log(options, "options")
                    // Initialize Razorpay payment
                    const rzp = new Razorpay(options);
                    rzp.on('payment.failed', async function (response) {
                        failedPayment()
                        Swal.fire({
                            title: "Payment Failed",
                            text: "Your order is saved. You can retry the payment from your orders section.",
                            icon: "error",
                            confirmButtonText: "Go to order",
                        }).then(() => {
                            window.location.href = "/orders";
                        });

                    });

                    rzp.open();
                    return;

                } catch (err) {
                    showToast(err.message || 'Failed to process Razorpay payment', 'error');
                    console.error('Error processing Razorpay payment:', err);
                } finally {
                    isProcessing = false;
                }
            }



            async function failedPayment() {
                const data = {
                    addressId: selectedAddress,
                    paymentMethod: selectedPayment,
                    subTotal,
                    shippingCharge,
                    finalPrice,
                    discount,
                    paymentStatus: "failed"
                }
                try {
                    const response = await fetch(`/failed-payment`, {
                        method: "POST",
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    })

                    const result = await response.json()
                    if (!response.ok) {

                        return
                    }

                    showToast(result.message, 'success')
                    window.location.href = '/success'

                } catch (error) {
                    console.log(error.message)
                    showToast(`Failed payment ${error.message}`)
                }
            }

            async function placeOrder(paymentStatus) {
                console.log("razopaya")
                const orderData = {
                    addressId: selectedAddress || "",
                    paymentMethod: selectedPayment,
                    paymentStatus,
                    subTotal,
                    shippingCharge,
                    finalPrice,
                    discount,
                };

                console.log("orderData", orderData)

                try {
                    const response = await fetch("/confirm-order", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(orderData),
                    });

                    const result = await response.json();

                    console.log('result', result)
                    if (!result.success) {
                        const confirmOrderBtn = document.getElementById('confirmOrderBtn');
                        confirmOrderBtn.style.background = 'red';
                        confirmOrderBtn.disabled = true;

                        Swal.fire({
                            icon: "error",
                            title: "Oops...",
                            text: result.message || "Failed to place order",
                            footer: '<a href="/shop">Continue shopping</a>',
                            confirmButtonText: "OK",
                        }).then((result) => {
                            if (result.isConfirmed) {
                                window.location.href = "/shop"; // Redirect to shop after error
                            }
                        });
                        return;
                    }

                    // Success case
                    Swal.fire({
                        title: 'Order Placed!',
                        text: 'Your order is being processed.',
                        icon: 'success',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        didOpen: () => {
                            setTimeout(() => {
                                window.location.href = '/success';
                            }, 1000);
                        },
                    });

                } catch (error) {
                    console.error("Error placing order:", error);
                    console.log("error message is: ", error.message)
                    Swal.fire({
                        icon: "error",
                        title: "Network Error",
                        text: "Unable to connect to the server. Please try again later.",
                        confirmButtonText: "OK",
                    });
                }
            }

        });
    }

    const couponForm = document.getElementById('applyCoupon');
    const couponCodeInput = document.getElementById('couponCode');
    const totalAmountInput = document.getElementById('totalAmount');
    const couponActionSlot = document.getElementById('couponActionSlot');
    const couponLine = document.getElementById('couponLine');
    const couponAmountEl = document.getElementById('coupon');
    const finalTotalEl = document.getElementById('finalTotal');

    // Clicking a suggested coupon fills the code input instead of the user having to retype it.
    document.querySelectorAll('.coupon-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
            if (couponCodeInput.readOnly) return; // a coupon is already applied — remove it first
            couponCodeInput.value = btn.dataset.couponCode;
            couponCodeInput.focus();
        });
    });

    function renderCouponActionSlot(appliedCouponId) {
        couponForm.dataset.appliedCouponId = appliedCouponId || '';

        if (appliedCouponId) {
            couponActionSlot.innerHTML = `
                <button type="button" id="removeCouponBtn"
                    class="bg-red-700 text-white px-4 py-2 text-sm hover:bg-black rounded-r-md h-full">
                    Remove
                </button>`;
            document.getElementById('removeCouponBtn').addEventListener('click', handleRemoveCoupon);
        } else {
            couponActionSlot.innerHTML = `
                <button type="submit"
                    class="bg-gray-700 text-white px-4 py-2 text-sm hover:bg-black rounded-r-md h-full">
                    Apply
                </button>`;
        }
    }

    // Updates the order summary total/coupon line in place — no page reload needed.
    function updateOrderSummary({ finalPrice, discountAmount }) {
        if (finalTotalEl && typeof finalPrice === 'number') {
            finalTotalEl.dataset.price = finalPrice;
            finalTotalEl.textContent = `Rs. ${finalPrice.toFixed(2)}`;
        }
        if (couponLine && couponAmountEl) {
            if (typeof discountAmount === 'number') {
                couponAmountEl.dataset.value = discountAmount;
                couponAmountEl.textContent = `-Rs. ${discountAmount.toFixed(2)}`;
                couponLine.classList.remove('hidden');
            } else {
                couponAmountEl.dataset.value = 0;
                couponLine.classList.add('hidden');
            }
        }
    }

    async function handleRemoveCoupon() {
        const appliedCouponId = couponForm.dataset.appliedCouponId;
        if (!appliedCouponId) return; // nothing applied — nothing to remove

        if (!window.confirm('Remove the applied coupon?')) return;

        const removeBtn = document.getElementById('removeCouponBtn');
        if (removeBtn) removeBtn.disabled = true;

        try {
            const response = await fetch('/remove-coupon', {
                method: "PUT",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ couponId: appliedCouponId })
            });
            const result = await response.json();

            if (!response.ok) {
                showToast(result.message);
                return;
            }

            showToast(result.message, 'success');

            if (typeof result.finalPrice === 'number' && totalAmountInput) {
                totalAmountInput.value = result.finalPrice;
            }
            updateOrderSummary({ finalPrice: result.finalPrice, discountAmount: null });

            couponCodeInput.value = '';
            couponCodeInput.readOnly = false;
            couponCodeInput.classList.remove('bg-gray-100', 'text-gray-500');
            renderCouponActionSlot(null);
        } catch (error) {
            console.log(error.message);
            showToast('Something went wrong');
        } finally {
            if (removeBtn) removeBtn.disabled = false;
        }
    }

    renderCouponActionSlot(couponForm.dataset.appliedCouponId);

    couponForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const couponCode = couponCodeInput.value.trim();
        const totalAmount = parseFloat(totalAmountInput.value) || 0;

        if (!couponCode) {
            showToast('Please enter a coupon code', 'error');
            return;
        }

        const applyBtn = couponActionSlot.querySelector('button');
        if (applyBtn) applyBtn.disabled = true;

        try {
            const response = await fetch('/apply-coupon', {
                method: "POST",
                headers: { 'Content-Type': "application/json" },
                body: JSON.stringify({ couponCode, totalAmount })
            });

            const result = await response.json();

            if (!response.ok) {
                showToast(result.message);
                return;
            }

            showToast(result.message, 'success');

            updateOrderSummary({ finalPrice: result.totalAmountWithCoupon, discountAmount: result.discountAmount });
            couponCodeInput.value = result.couponCode || couponCode;
            couponCodeInput.readOnly = true;
            couponCodeInput.classList.add('bg-gray-100', 'text-gray-500');
            renderCouponActionSlot(result.couponId);
        } catch (error) {
            console.error('Coupon error:', error);
            showToast('Failed to apply coupon');
        } finally {
            if (applyBtn) applyBtn.disabled = false;
        }
    });



    // Handle cancel buttons for modals if they exist
    if (addCancelBtn) {
        addCancelBtn.addEventListener('click', function () {
            addModal.classList.add('hidden');
        });
    }

    if (editCancelBtn) {
        editCancelBtn.addEventListener('click', function () {
            editModal.classList.add('hidden');
        });
    }
});
