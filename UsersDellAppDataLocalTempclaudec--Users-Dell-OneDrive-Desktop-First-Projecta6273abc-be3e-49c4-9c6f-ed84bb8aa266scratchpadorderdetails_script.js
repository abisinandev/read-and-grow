
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

        document.querySelectorAll('.cancel-btn').forEach(button => {
          button.addEventListener('click', async function () {
            const productId = this.getAttribute('data-product-id');
            const orderId = this.getAttribute('data-order-id');

            const { value: reason } = await Swal.fire({
              title: 'Cancel order',
              html: `
            <p>Please provide a reason for returning this order:</p>
            <textarea id="returnReason" class="swal2-textarea w-96 p-2 border rounded" placeholder="Enter your reason here..." rows="4"></textarea>
          `,
              showCancelButton: true,
              confirmButtonText: 'Submit Cancel',
              cancelButtonText: 'Cancel',
              confirmButtonColor: '#000223',
              cancelButtonColor: '#d33',
              preConfirm: () => {
                const reasonText = document.getElementById('returnReason').value.trim();
                if (!reasonText) {
                  Swal.showValidationMessage('Please enter a reason for the return');
                  return false;
                }
                return reasonText;
              }
            });

            if (!reason) return;

            const confirm = await Swal.fire({
              title: 'Are you sure?',
              text: "You won't be able to revert this!",
              icon: 'warning',
              showCancelButton: true,
              confirmButtonColor: '#3085d6',
              cancelButtonColor: '#d33',
              confirmButtonText: 'Yes, cancel it!'
            });

            if (!confirm.isConfirmed) return;

            try {
              const response = await fetch(`/single-cancel-order/${orderId}/${productId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason })
              });

              const result = await response.json();

              if (!response.ok) {
                return Swal.fire({
                  icon: "error",
                  title: "Oops...",
                  text: result.message || "Something went wrong.",
                  footer: '<a href="/shop">Continue shopping</a>'
                });
              }

              //SUCCESS
              Swal.fire({
                title: result.message,
                text: "Your order item has been cancelled.",
                icon: "success"
              }).then(() => {
                location.reload()
              });

            } catch (error) {
              console.error("Cancel error:", error);
              Swal.fire({
                icon: "error",
                title: "Something went wrong",
                text: "Please try again later."
              });
            }
          });
        });



        const retryPaymentBtn = document.getElementById('retryPayment');
        const finalPrice = parseFloat(document.getElementById("x").textContent);
        console.log(finalPrice, 'Final price in paise');

        if (retryPaymentBtn) {
          retryPaymentBtn.addEventListener('click', async function (e) {
            const orderId = this.getAttribute('data-order-id');
            console.log(orderId);

            try {
              const orderData = {
                finalPrice: Number(finalPrice),
                receipt: 'receipt#1',
                notes: {},
                currency: "INR"
              };

              console.log('Submitting order:', orderData);

              const response = await fetch(`/create-order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(orderData)
              });

              const order = await response.json();
              console.log(order, 'orders');
              if (!response.ok) {
                Swal.fire({
                  title: "Warning!",
                  text: order.message,
                  icon: "warning",
                  confirmButtonText: "OK",
                });
                return;
              }

              const options = {
                key: 'rzp_test_ft2g0i6HYiyfqh', // Replace with your Razorpay key_id
                amount: order.amount,
                currency: order.currency,
                name: 'Read-and-grow',
                description: 'Transaction',
                order_id: order.id,
                callback_url: 'readandgrow.space/success',
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
                      // Only mark the order paid once Razorpay's signature actually verified —
                      // this previously called retryPayment() unconditionally regardless of
                      // what /verify-payment returned, so a failed/tampered verification would
                      // still mark the order "paid" and decrement stock.
                      if (data.status === 'Ok') {
                        retryPayment(orderId);
                      } else {
                        console.log(data.message);
                        showToast('Payment verification failed', 'error');
                      }
                    })
                    .catch((error) => {
                      console.error("Error:", error);
                      showToast("Payment verification failed", "error");
                    });
                }
              };

              console.log(options, "options");
              const rzp = new Razorpay(options);
              rzp.on('payment.failed', async function (response) {
                // failedPayment();
                Swal.fire({
                  title: "Payment Failed",
                  text: "You can retry the payment from your orders section.",
                  icon: "error",
                  confirmButtonText: "Go to order",
                }).then(() => {
                  window.location.href = "/orders";
                });
              });

              rzp.open();
            } catch (err) {
              showToast(err.message || 'Failed to process Razorpay payment', 'error');
              console.error('Error processing Razorpay payment:', err);
            } finally {
              isProcessing = false;
            }
          });
        }

        // retry payment function
        async function retryPayment(orderId) {
          try {
            const response = await fetch('/retry-payment', {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId })
            })

            const result = await response.json()
            if (!response.ok) {
              showToast(result.message)
              return
            }

            return location.reload()

          } catch (error) {
            console.log(error.message)

          }
        }


        // querySelectorAll+forEach, not getElementById — an order can have more than one
        // delivered item eligible for return, and each renders its own .return-btn. The old
        // getElementById('returnOrder') only ever wired up the FIRST such button (and threw if
        // there were none at all), so Return silently did nothing for any item after the first.
        document.querySelectorAll('.return-btn').forEach(button => {
        button.addEventListener('click', async function () {
          const orderId = this.getAttribute('data-order-id');
          const productId = this.getAttribute('data-product-id');

          console.log("Returning Order:", { orderId, productId });

          const { value: reason } = await Swal.fire({
            title: 'Return order',
            html: `
              <p>Please provide a reason for returning this order:</p>
              <textarea id="returnReason" class="swal2-textarea w-96 p-2 border rounded" placeholder="Enter your reason here..." rows="4"></textarea>
            `,
            showCancelButton: true,
            confirmButtonText: 'Submit return',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#000223',
            cancelButtonColor: '#d33',
            preConfirm: () => {
              const reasonText = document.getElementById('returnReason').value.trim();
              if (!reasonText) {
                Swal.showValidationMessage('Please enter a reason for the return');
                return false;
              }
              return reasonText;
            }
          });

          if (!reason) return;

          const confirm = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, return it!'
          });

          if (!confirm.isConfirmed) return;

          try {
            const response = await fetch(`/return-order/${orderId}/${productId}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason })
            });

            const result = await response.json();

            if (!response.ok) {
              await Swal.fire({
                icon: "error",
                title: "Oops...",
                text: result.message || "Something went wrong.",
                footer: '<a href="/shop">Continue shopping</a>'
              });
              return;
            }

            await Swal.fire({
              title: result.message,
              text: "Your item has been returned successfully.",
              icon: "success"
            });

            location.reload()
            // window.location.href = "/orders";

          } catch (error) {
            console.error("Return error:", error);
            Swal.fire({
              icon: "error",
              title: "Something went wrong",
              text: "Please try again later."
            });
          }
        });
        });

      })
      // async function failedPayment() {
      //         const data = {
      //             addressId: selectedAddress || "",
      //             paymentMethod: selectedPayment,
      //             subTotal,
      //             shippingCharge,
      //             finalPrice,
      //             discount,
      //             paymentStatus: "failed"
      //         }
      //         try {
      //             const response = await fetch(`/failed-payment`, {
      //                 method: "POST",
      //                 headers: { 'Content-Type': 'application/json' },
      //                 body: JSON.stringify(data)
      //             })

      //             const result = await response.json()
      //             if (!response.ok) {

      //                 return
      //             }

      //             showToast(result.message, 'success')
      //             // window.location.href = '/success'

      //         } catch (error) {
      //             console.log(error.message)
      //             showToast(`Failed payment ${error.message}`)
      //         }
      //     }

      function invoice(orderId) {
        Swal.fire({
          title: 'Generating Invoice...',
          text: 'Please wait while we prepare your invoice.',
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: true,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        setTimeout(() => {
          window.open(`/invoice/${orderId}`);
          Swal.close();
        }, 1500);
      }

    