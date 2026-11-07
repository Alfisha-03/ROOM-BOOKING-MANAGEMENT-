
function loadRooms() {

    fetch('/api/rooms')
    .then(response => response.json())
    .then(rooms => {

        const roomList = document.getElementById('roomList');

        if (!roomList) return;

        roomList.innerHTML = '';

        rooms.forEach(room => {

            roomList.innerHTML += `
                <div class="room-card">

                    <h3>${room.room_type}</h3>

                    <p>Room Number: ${room.room_number}</p>

                    <p>Price: ₹${room.price} per night</p>

                    <p>Capacity: ${room.capacity} persons</p>

                    <p>Status: ${room.status}</p>

                    <a href="booking.html" class="btn">
                        Book This Room
                    </a>

                </div>
            `;
        });

    })
    .catch(error => {
        console.log("Error loading rooms:", error);
    });
}

loadRooms();

// Customer Registration

const registerForm = document.getElementById('registerForm');

if (registerForm) {

    registerForm.addEventListener('submit', async function(event) {

        event.preventDefault();

        const customer = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            password: document.getElementById('password').value
        };

        try {

            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(customer)
            });

            const result = await response.json();

            alert(result.message);

            if (response.ok) {
                registerForm.reset();
                window.location.href = 'login.html';
            }

        } catch (error) {
            alert('Unable to connect to server');
        }

    });

}

// LOAD AVAILABLE ROOMS IN BOOKING PAGE

const roomSelect = document.getElementById('roomId');

if (roomSelect) {
    fetch('/api/rooms')
        .then(response => response.json())
        .then(rooms => {
            rooms.forEach(room => {
                if (room.status === 'Available') {
                    const option = document.createElement('option');

                    option.value = room.room_id;
                    option.textContent =
                        room.room_type + ' - Room ' +
                        room.room_number + ' - ₹' + room.price;

                    option.dataset.price = room.price;

                    roomSelect.appendChild(option);
                }
            });
        })
        .catch(error => console.log('Room loading error:', error));
}


// AUTOMATIC PRICE CALCULATION

const checkIn = document.getElementById('checkIn');
const checkOut = document.getElementById('checkOut');
const totalAmount = document.getElementById('totalAmount');

if (checkIn && checkOut && totalAmount) {

    const today = new Date();
    const todayString = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');

    checkIn.min = todayString;
    checkOut.min = todayString;

    function calculateAmount() {
        const selectedOption =
            roomSelect.options[roomSelect.selectedIndex];

        const price = Number(selectedOption.dataset.price);
        const startDate = new Date(checkIn.value + 'T00:00:00');
        const endDate = new Date(checkOut.value + 'T00:00:00');

        const nights = (endDate - startDate) / (1000 * 60 * 60 * 24);

        if (price > 0 && nights > 0) {
            totalAmount.value = '₹' + (price * nights).toFixed(2);
        } else {
            totalAmount.value = '';
        }
    }

    roomSelect.addEventListener('change', calculateAmount);

    checkIn.addEventListener('change', function () {
        if (checkIn.value) {
            const nextDay = new Date(checkIn.value + 'T00:00:00');
            nextDay.setDate(nextDay.getDate() + 1);

            checkOut.min = nextDay.getFullYear() + '-' +
                String(nextDay.getMonth() + 1).padStart(2, '0') + '-' +
                String(nextDay.getDate()).padStart(2, '0');

            if (checkOut.value && checkOut.value <= checkIn.value) {
                checkOut.value = '';
            }
        }

        calculateAmount();
    });

    checkOut.addEventListener('change', calculateAmount);
}

 // CUSTOMER LOGIN

const loginForm = document.getElementById('loginForm');

if (loginForm) {

    loginForm.addEventListener('submit', async function(event) {

        event.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {

            const response = await fetch('/api/login', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const result = await response.json();

            document.getElementById('loginMessage').textContent =
                result.message;

            if (response.ok) {
                window.location.href = 'rooms.html';
            }

        } catch (error) {

            document.getElementById('loginMessage').textContent =
                'Unable to connect to server';

        }

    });

}

// CONFIRM ROOM BOOKING

const bookingForm = document.getElementById('bookingForm');

if (bookingForm) {

    bookingForm.addEventListener('submit', async function(event) {

        event.preventDefault();

        const room_id = document.getElementById('roomId').value;
        const check_in = document.getElementById('checkIn').value;
        const check_out = document.getElementById('checkOut').value;

        const message = document.getElementById('bookingMessage');

        try {

            const response = await fetch('/api/bookings', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_id,
                    check_in,
                    check_out
                })
            });

            const result = await response.json();

            message.textContent = result.message;

            if (response.ok) {

                alert('Booking ID: ' + result.bookingId);

                bookingForm.reset();

                document.getElementById('totalAmount').value = '';

            }

        } catch (error) {

            message.textContent = 'Unable to connect to server';

            console.log(error);

        }

    });

}

// LOAD MY BOOKINGS

async function loadMyBookings() {

    const bookingList = document.getElementById('myBookingsList');

    if (!bookingList) return;

    try {

        const response = await fetch('/api/mybookings', {
            credentials: 'same-origin'
        });

        const bookings = await response.json();

        if (!response.ok) {
            bookingList.innerHTML = `<p>${bookings.message}</p>`;
            return;
        }

        if (bookings.length === 0) {
            bookingList.innerHTML = '<p>You have no bookings yet.</p>';
            return;
        }

        bookingList.innerHTML = '';

        bookings.forEach(booking => {

            bookingList.innerHTML += `
                <div class="room-card">

                    <h3>Booking #${booking.booking_id}</h3>

                    <p>Room: ${booking.room_number}</p>

                    <p>Room Type: ${booking.room_type}</p>

                    <p>Check-in: ${booking.check_in}</p>

                    <p>Check-out: ${booking.check_out}</p>

                    <p>Total Amount: ₹${booking.total_amount}</p>

                    <p>Status: ${booking.status}</p>

                </div>
            `;

        });

    } catch (error) {

        bookingList.innerHTML =
            '<p>Unable to load bookings. Please try again.</p>';

        console.log(error);
    }
}

loadMyBookings();
