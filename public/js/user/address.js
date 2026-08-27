export function attachAddressEventListeners() {
    // Edit Address
    document.querySelectorAll('.editAddressBtn').forEach(button => {
        button.addEventListener('click', function () {
            if (isProcessing) return;

            const addressId = this.getAttribute('data-address-id');
            const card = document.getElementById(`addr-card-${addressId}`);
            if (!card) return;

            const nameEl = card.querySelector('.font-semibold.text-gray-800');
            const nameParts = (nameEl?.textContent?.trim() || '').split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Address type badge text (lowercase)
            const typeBadge = card.querySelector('span.capitalize');
            const addressType = typeBadge?.textContent?.trim().toLowerCase() || 'home';

            // Address line: "street, city, state — pincode"
            const addrLine = card.querySelector('.text-gray-600.text-sm');
            const addrText = addrLine?.textContent?.trim() || '';
            const [streetCity, pinPart] = addrText.split('—');
            const [street, city, state] = (streetCity || '').split(',').map(s => s.trim());
            const zip = (pinPart || '').trim();

            // Phone: "📞 phoneNumber"
            const phoneEl = card.querySelector('.text-gray-500.text-xs');
            const phone = (phoneEl?.textContent || '').replace('📞', '').trim();

            const editForm = document.getElementById('editAddressForm');
            const editModal = document.getElementById('editAddressModal');

            editForm.querySelector('input[name="firstName"]').value = firstName;
            editForm.querySelector('input[name="lastName"]').value = lastName;
            editForm.querySelector('input[name="street"]').value = street || '';
            editForm.querySelector('input[name="city"]').value = city || '';
            editForm.querySelector('input[name="state"]').value = state || '';
            editForm.querySelector('input[name="zip"]').value = zip;
            editForm.querySelector('input[name="phone"]').value = phone;
            editForm.querySelector('select[name="addressType"]').value = addressType;
            editForm.setAttribute('data-address-id', addressId);

            editModal.classList.remove('hidden');
        });
    });

    // Set as Default
    document.querySelectorAll('.setDefaultCheckbox').forEach(btn => {
        btn.addEventListener('click', async function () {
            if (isProcessing) return;

            isProcessing = true;
            const addressId = this.getAttribute('data-address-id');

            try {
                const response = await fetch(`/address/${addressId}/set-default`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isDefault: true })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to set default');
                showToast('Address set as default!', 'success');
                await refreshAddressContainer();
            } catch (err) {
                showToast(err.message, 'error');
                console.error('Error setting default:', err);
            } finally {
                isProcessing = false;
            }
        });
    });

    // Select Address — radio button change
    document.querySelectorAll('.selectAddress').forEach(radio => {
        radio.addEventListener('change', async function () {
            if (isProcessing) return;
            if (!this.checked) return;

            isProcessing = true;
            const addressId = this.getAttribute('data-address-id');
            if (!addressId) {
                console.error("Address ID not found for selected radio.");
                isProcessing = false;
                return;
            }

            document.querySelectorAll('[id^="addr-card-"]').forEach(card => {
                card.classList.remove('border-black', 'bg-gray-50', 'shadow-sm');
                card.classList.add('border-gray-200', 'bg-white');
            });
            const selectedCard = document.getElementById(`addr-card-${addressId}`);
            if (selectedCard) {
                selectedCard.classList.add('border-black', 'bg-gray-50', 'shadow-sm');
                selectedCard.classList.remove('border-gray-200', 'bg-white');
            }

            try {
                const response = await fetch(`/address/${addressId}/select-address`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isSelected: true })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Failed to select address');

                showToast('Delivery address selected', 'success');
                localStorage.setItem('addressId', addressId);
            } catch (err) {
                showToast(err.message, 'error');
                console.error('Error selecting address:', err);
            } finally {
                isProcessing = false;
            }
        });
    });

    // Delete Address
    document.querySelectorAll('.deleteAddressBtn').forEach(button => {
        button.addEventListener('click', function () {
            if (isProcessing) return;
            const addressId = this.getAttribute('data-address-id');

            Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    isProcessing = true;
                    try {
                        const response = await fetch(`/address/${addressId}`, {
                            method: 'DELETE'
                        });
                        const resResult = await response.json();
                        if (!response.ok) throw new Error(resResult.message || 'Something went wrong');

                        const cardEl = document.getElementById(`addr-card-${addressId}`);
                        if (cardEl) {
                            cardEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                            cardEl.style.opacity = '0';
                            cardEl.style.transform = 'scale(0.95)';
                            setTimeout(() => cardEl.remove(), 200);
                        }

                        showToast('Address deleted successfully', 'success');

                        setTimeout(async () => {
                            const remaining = document.querySelectorAll('[id^="addr-card-"]').length;
                            if (remaining === 0) {
                                document.getElementById('addressContainer').innerHTML =
                                    '<div class="text-center py-6 text-gray-500 font-medium">No saved addresses. Add one below.</div>';
                            }
                            await refreshAddressContainer();
                        }, 250);
                    } catch (error) {
                        console.error("Delete address error:", error);
                        showToast('Failed to delete address', 'error');
                    } finally {
                        isProcessing = false;
                    }
                }
            });
        });
    });
}


export async function refreshAddressContainer() {
    try {
        const response = await fetch(window.location.pathname);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        const newContainer = doc.getElementById('addressContainer');
        if (newContainer) {
            document.getElementById('addressContainer').innerHTML = newContainer.innerHTML;
            attachAddressEventListeners();
        }
    } catch (error) {
        console.error('Error refreshing addresses:', error);
    }
}


export // Update new address on screen
    function injectAddressCard(addr) {
    const container = document.getElementById('addressContainer');
    if (!container) return;

    const emptyEl = container.querySelector('.text-gray-500.font-medium');
    if (emptyEl) emptyEl.remove();

    const typeBg = addr.addressType === 'home' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
    const id = addr._id;

    const card = document.createElement('div');
    card.id = `addr-card-${id}`;
    card.className = 'relative w-full p-4 rounded-xl border-2 transition-all mb-3 cursor-pointer border-gray-200 bg-white hover:border-gray-400';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.97)';
    card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';

    card.innerHTML = `
        <div class="flex items-start gap-3">
            <input type="radio"
                name="deliveryAddress"
                class="selectAddress mt-1 h-4 w-4 accent-black shrink-0"
                data-address-id="${id}">
            <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-1">
                    <p class="font-semibold text-gray-800 text-sm">${addr.firstName} ${addr.lastName}</p>
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium capitalize ${typeBg}">${addr.addressType}</span>
                </div>
                <p class="text-gray-600 text-sm leading-5">
                    ${addr.street}, ${addr.city}, ${addr.state} — ${addr.pincode}
                </p>
                <p class="text-gray-500 text-xs mt-1">📞 ${addr.phoneNumber}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" class="editAddressBtn p-1.5 rounded-lg hover:bg-gray-100 transition"
                    data-address-id="${id}" title="Edit address">
                    <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="#555">
                        <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h357l-80 80H200v560h560v-278l80-80v358q0 33-23.5 56.5T760-120H200Zm280-360ZM360-360v-170l367-367q12-12 27-18t30-6q16 0 30.5 6t26.5 18l56 57q11 12 17 26.5t6 29.5q0 15-5.5 29.5T897-728L530-360H360Z"/>
                    </svg>
                </button>
                <button type="button" class="deleteAddressBtn p-1.5 rounded-lg hover:bg-red-50 transition"
                    data-address-id="${id}" title="Delete address">
                    <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="#e53e3e">
                        <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="mt-2 pl-7">
            <button type="button"
                class="setDefaultCheckbox text-xs text-gray-400 hover:text-black transition underline underline-offset-2"
                data-address-id="${id}" data-is-default="false">
                Set as default
            </button>
        </div>
    `;

    container.appendChild(card);

    // Animate in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
        });
    });
}



