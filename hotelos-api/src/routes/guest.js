const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guestController');

router.get('/profile', guestController.getProfile);
router.put('/profile', guestController.updatePreferences);
router.get('/requests', guestController.getRequests);
router.post('/requests', guestController.createRequest);
router.get('/offers', guestController.getOffers);
router.post('/offers/:id/accept', guestController.acceptOffer);
router.get('/bill', guestController.getBill);
router.get('/hotel-info', guestController.getHotelInfo);
router.post('/checkout', guestController.checkout);

module.exports = router;
