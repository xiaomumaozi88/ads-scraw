// src/controllers/authController.js
import * as puppeteerService from '../services/puppeteerService.js';

export const checkLogin = async (req, res) => {
    try {
        const isLoggedIn = await puppeteerService.checkLoginStatus();
        res.json({ loggedIn: isLoggedIn });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to check login status' });
    }
};
