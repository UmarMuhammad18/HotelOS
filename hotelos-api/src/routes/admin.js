const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/dashboard/metrics', adminController.getMetrics);
router.get('/reviews', adminController.getReviews);
router.post('/reviews/:id/respond', adminController.respondToReview);
router.get('/departments', adminController.getDepartments);
router.get('/system/usage', adminController.getSystemUsage);
router.get('/revenue/breakdown', adminController.getRevenueBreakdown);
router.get('/issues/resolved', adminController.getResolvedIssues);

module.exports = router;
