import * as puppeteerService from '../services/puppeteerService.js';

export const checkLogin = async (req, res) => {
    try {
        const isLoggedIn = await puppeteerService.checkLoginStatus();
        res.json({ loggedIn: isLoggedIn });
    } catch (error) {
        console.error(error);
        res.status(200).json({ code: 500, data: null, message: '', success: false });
    }
};
