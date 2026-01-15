import express from 'express';
import { health, readiness, liveness, metrics } from '../controllers/operational.controller.js';

const router = express.Router();

// Health check endpoints - simplified
router.get('/health', health);        // Basic health check (always returns 200)
router.get('/readiness', readiness);  // Readiness probe (checks DB connectivity)
router.get('/liveness', liveness);    // Liveness probe (basic server check)
router.get('/metrics', metrics);      // System metrics

export default router;
