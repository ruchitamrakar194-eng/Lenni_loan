const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const loanController = require('../controllers/loanController');
const authenticateToken = require('../middleware/auth');
const { uploadDocument } = require('../middleware/upload');

router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.get('/companies/config/:name', authController.getCompanyConfig);
router.post('/send-otp', authController.sendOtp);
router.post('/complete-registration', authController.completeRegistration);
router.get('/verify-employee', authController.verifyEmployee);

router.post('/apply-guest', uploadDocument.fields([
  { name: 'idDocument', maxCount: 1 },
  { name: 'latestPayslip', maxCount: 1 },
  { name: 'bankStatement', maxCount: 1 },
  { name: 'otherDocument', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
  { name: 'applicationForm', maxCount: 1 }
]), loanController.applyGuest);

module.exports = router;
