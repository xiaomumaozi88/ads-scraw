import { Router } from 'express';
import * as catalogController from '../controllers/iam/catalogController.js';
import * as sessionController from '../controllers/iam/sessionController.js';

const router = Router();

router.options('/catalog', catalogController.optionsCatalog);
router.get('/catalog', catalogController.getCatalog);
router.get('/me', sessionController.getMe);
router.post('/logout', sessionController.postLogout);

export default router;
