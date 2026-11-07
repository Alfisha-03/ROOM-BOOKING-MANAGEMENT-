
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: 'hotel_booking_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 30 * 60 * 1000
    }
}));

// MySQL 8.0 connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'hotel_booking_db'
});

// Connect to database
db.connect((err) => {
    if (err) {
        console.log('Database connection failed:', err.message);
    } else {
        console.log('MySQL Connected Successfully!');
    }
});

// Frontend folder
app.use(express.static('public'));


// HOME PAGE
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});


// DISPLAY ROOMS API
app.get('/api/rooms', (req, res) => {

    const sql = 'SELECT * FROM rooms';

    db.query(sql, (err, results) => {

        if (err) {
            return res.status(500).json({
                message: 'Unable to fetch rooms'
            });
        }

        res.json(results);

    });

});


// CUSTOMER REGISTRATION API
app.post('/api/register', async (req, res) => {

    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
        return res.status(400).json({
            message: 'Please fill all fields'
        });
    }

    try {

        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO customers (name, email, phone, password)
            VALUES (?, ?, ?, ?)
        `;

        db.query(
            sql,
            [name, email, phone, hashedPassword],
            (err, result) => {

                if (err) {

                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({
                            message: 'Email already registered'
                        });
                    }

                    return res.status(500).json({
                        message: 'Registration failed'
                    });
                }

                res.status(201).json({
                    message: 'Registration successful!'
                });

            }
        );

    } catch (error) {

        res.status(500).json({
            message: 'Something went wrong'
        });

    }

});


// CUSTOMER LOGIN API
app.post('/api/login', (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: 'Please enter email and password'
        });
    }

    const sql = 'SELECT * FROM customers WHERE email = ?';

    db.query(sql, [email], async (err, results) => {

        if (err) {
            return res.status(500).json({
                message: 'Database error'
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                message: 'Customer not found'
            });
        }

        const customer = results[0];

        try {

            const validPassword = await bcrypt.compare(
                password,
                customer.password
            );

            if (!validPassword) {
                return res.status(401).json({
                    message: 'Incorrect password'
                });
            }

            req.session.customerId = customer.customer_id;

            res.json({
                message: 'Login successful!',
                customerName: customer.name
            });

        } catch (error) {

            res.status(500).json({
                message: 'Login failed'
            });

        }

    });

});


// CHECK LOGIN STATUS
app.get('/api/session', (req, res) => {

    if (req.session.customerId) {
        return res.json({
            loggedIn: true,
            customerId: req.session.customerId
        });
    }

    res.json({
        loggedIn: false
    });

});


// CUSTOMER LOGOUT API
app.post('/api/logout', (req, res) => {

    req.session.destroy((err) => {

        if (err) {
            return res.status(500).json({
                message: 'Logout failed'
            });
        }

        res.json({
            message: 'Logout successful!'
        });

    });

});


// CUSTOMER ROOM BOOKING API

app.post('/api/bookings', (req, res) => {

    // Check customer login
    if (!req.session.customerId) {
        return res.status(401).json({
            message: 'Please login before booking a room'
        });
    }

    const { room_id, check_in, check_out } = req.body;

    if (!room_id || !check_in || !check_out) {
        return res.status(400).json({
            message: 'Please fill all booking details'
        });
    }

    // Validate dates
    const startDate = new Date(check_in + 'T00:00:00');
    const endDate = new Date(check_out + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (
        isNaN(startDate.getTime()) ||
        isNaN(endDate.getTime()) ||
        startDate < today ||
        endDate <= startDate
    ) {
        return res.status(400).json({
            message: 'Please select valid check-in and check-out dates'
        });
    }

    // Find selected room
    const roomSql = `
        SELECT price FROM rooms
        WHERE room_id = ? AND status = 'Available'
    `;

    db.query(roomSql, [room_id], (err, rooms) => {

        if (err) {
            return res.status(500).json({
                message: 'Unable to check room details'
            });
        }

        if (rooms.length === 0) {
            return res.status(404).json({
                message: 'Room is not available'
            });
        }

        // Check whether the room is already booked
        const availabilitySql = `
            SELECT booking_id FROM bookings
            WHERE room_id = ?
            AND check_in < ?
            AND check_out > ?
            AND (status IS NULL OR status <> 'Cancelled')
        `;

        db.query(
            availabilitySql,
            [room_id, check_out, check_in],
            (err, existingBookings) => {

                if (err) {
                    return res.status(500).json({
                        message: 'Unable to check booking availability'
                    });
                }

                if (existingBookings.length > 0) {
                    return res.status(409).json({
                        message: 'This room is already booked for these dates'
                    });
                }

                // Calculate total amount on the server
                const millisecondsPerDay = 1000 * 60 * 60 * 24;
                const nights = Math.round(
                    (endDate - startDate) / millisecondsPerDay
                );

                const totalAmount = Number(rooms[0].price) * nights;

                // Save booking in MySQL
                const insertSql = `
                    INSERT INTO bookings
                    (customer_id, room_id, check_in, check_out,
                     total_amount, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;

                db.query(
                    insertSql,
                    [
                        req.session.customerId,
                        room_id,
                        check_in,
                        check_out,
                        totalAmount,
                        'Confirmed'
                    ],
                    (err, result) => {

                        if (err) {
                            return res.status(500).json({
                                message: 'Booking could not be saved'
                            });
                        }

                        res.status(201).json({
                            message: 'Room booked successfully!',
                            bookingId: result.insertId,
                            totalAmount: totalAmount
                        });
                    }
                );
            }
        );
    });
});

 // DISPLAY CUSTOMER BOOKINGS

app.get('/api/mybookings', (req, res) => {

    if (!req.session.customerId) {
        return res.status(401).json({
            message: 'Please login to view your bookings'
        });
    }

    const sql = `
        SELECT
            b.booking_id,
            r.room_number,
            r.room_type,
            b.check_in,
            b.check_out,
            b.total_amount,
            b.status
        FROM bookings b
        JOIN rooms r ON b.room_id = r.room_id
        WHERE b.customer_id = ?
        ORDER BY b.booking_id DESC
    `;

    db.query(sql, [req.session.customerId], (err, results) => {

        if (err) {
            return res.status(500).json({
                message: 'Unable to fetch bookings'
            });
        }

        res.json(results);
    });
});

// START SERVER
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
