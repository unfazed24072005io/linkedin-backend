const express = require('express');
const router = express.Router();
const linkedinService = require('../services/linkedin-service');

// Open browser for manual login
router.post('/open-browser', async (req, res) => {
  try {
    const result = await linkedinService.openBrowserForLogin();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start scraping after manual login
router.post('/scrape', async (req, res) => {
  try {
    const { jobTitle, location, maxLeads } = req.body;
    
    const leads = await linkedinService.startScrapingAfterLogin({
      jobTitle,
      location, 
      maxLeads: parseInt(maxLeads)
    });
    
    res.json({ success: true, leads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop scraping
router.post('/stop', async (req, res) => {
  try {
    await linkedinService.stopScraping();
    res.json({ success: true, message: 'Scraping stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check login status
router.get('/login-status', async (req, res) => {
  try {
    const isLoggedIn = await linkedinService.checkLoginStatus();
    res.json({ isLoggedIn });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;