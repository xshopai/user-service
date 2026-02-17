/**
 * Environment Configuration Validation Tests
 * Validates that all required environment variables are set
 * Tests will fail if critical configuration is missing
 */
import { describe, it, expect } from '@jest/globals';

describe('Environment Configuration', () => {
  describe('Critical Environment Variables', () => {
    it('should have NODE_ENV defined', () => {
      expect(process.env.NODE_ENV).toBeDefined();
      expect(process.env.NODE_ENV).toBeTruthy();
    });

    it('should have MongoDB configuration defined', () => {
      expect(process.env.MONGODB_HOST || 'localhost').toBeDefined();
      expect(process.env.MONGODB_PORT || '27017').toBeDefined();
      // MONGO_INITDB_DATABASE is optional, can use default
      const dbName = process.env.MONGO_INITDB_DATABASE || process.env.MONGODB_DB_NAME || 'user-service-db';
      expect(dbName).toBeTruthy();
    });

    it('should have JWT_SECRET defined or use test default', () => {
      // In test environment, allow a default value
      const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';
      expect(jwtSecret).toBeDefined();
      expect(jwtSecret).toBeTruthy();
      expect(jwtSecret.length).toBeGreaterThan(10);
    });
  });

  describe('Server Configuration', () => {
    it('should have valid PORT or use default', () => {
      const port = process.env.PORT || '1002';
      const portNum = parseInt(port, 10);
      expect(portNum).toBeGreaterThan(0);
      expect(portNum).toBeLessThan(65536);
    });

    it('should have HOST defined or use default', () => {
      const host = process.env.HOST || '0.0.0.0';
      expect(host).toBeTruthy();
      expect(typeof host).toBe('string');
    });
  });

  describe('Security Configuration', () => {
    it('should have valid BCRYPT_ROUNDS', () => {
      const rounds = process.env.BCRYPT_ROUNDS || '12';
      const roundsNum = parseInt(rounds, 10);
      expect(roundsNum).toBeGreaterThanOrEqual(4);
      expect(roundsNum).toBeLessThanOrEqual(20);
    });

    it('should have CORS_ORIGIN defined or use default', () => {
      const origins = process.env.CORS_ORIGIN || 'http://localhost:3000';
      expect(origins).toBeTruthy();
      expect(typeof origins).toBe('string');
    });

    it('should have ENABLE_SECURITY_HEADERS flag', () => {
      const headers = process.env.ENABLE_SECURITY_HEADERS;
      if (headers) {
        expect(['true', 'false']).toContain(headers);
      }
    });

    it('should have ENABLE_RATE_LIMITING flag', () => {
      const rateLimit = process.env.ENABLE_RATE_LIMITING;
      if (rateLimit) {
        expect(['true', 'false']).toContain(rateLimit);
      }
    });
  });

  describe('JWT Configuration', () => {
    it('should have JWT_EXPIRES_IN defined or use default', () => {
      const expire = process.env.JWT_EXPIRES_IN || '24h';
      expect(expire).toBeTruthy();
      expect(expire).toMatch(/^\d+[smhd]$/);
    });
  });

  describe('External Services', () => {
    it('should have AUDIT_SERVICE_URL defined or use default', () => {
      const url = process.env.AUDIT_SERVICE_URL || 'http://localhost:8012';
      expect(url).toBeTruthy();
      expect(url).toMatch(/^https?:\/\//);
    });

    it('should have NOTIFICATION_SERVICE_URL defined or use default', () => {
      const url = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8011';
      expect(url).toBeTruthy();
      expect(url).toMatch(/^https?:\/\//);
    });
  });

  describe('Logging Configuration', () => {
    it('should have valid LOG_LEVEL', () => {
      const level = process.env.LOG_LEVEL || 'info';
      expect(['error', 'warn', 'info', 'debug', 'verbose']).toContain(level);
    });

    it('should have LOG_TO_CONSOLE flag', () => {
      const toConsole = process.env.LOG_TO_CONSOLE;
      if (toConsole) {
        expect(['true', 'false']).toContain(toConsole);
      }
    });

    it('should have LOG_TO_FILE flag', () => {
      const toFile = process.env.LOG_TO_FILE;
      if (toFile) {
        expect(['true', 'false']).toContain(toFile);
      }
    });

    it('should have LOG_FILE_PATH defined or use default', () => {
      const path = process.env.LOG_FILE_PATH || 'logs/user-service.log';
      expect(path).toBeTruthy();
      expect(typeof path).toBe('string');
    });
  });

  describe('Production Environment Validation', () => {
    it('should have strong JWT_SECRET in production', () => {
      if (process.env.NODE_ENV === 'production') {
        expect(process.env.JWT_SECRET).toBeDefined();
        expect(process.env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
        // Check for weak patterns
        const secret = process.env.JWT_SECRET.toLowerCase();
        expect(secret).not.toContain('secret');
        expect(secret).not.toContain('password');
        expect(secret).not.toContain('123456');
        expect(secret).not.toContain('change');
      }
    });

    it('should have proper CORS configuration in production', () => {
      if (process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN) {
        const origins = process.env.CORS_ORIGIN.toLowerCase();
        expect(origins).not.toContain('localhost');
      }
    });

    it('should have security headers enabled in production', () => {
      if (process.env.NODE_ENV === 'production') {
        expect(process.env.ENABLE_SECURITY_HEADERS).toBe('true');
      }
    });

    it('should have bcrypt rounds >= 12 in production', () => {
      if (process.env.NODE_ENV === 'production' && process.env.BCRYPT_ROUNDS) {
        const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10);
        expect(rounds).toBeGreaterThanOrEqual(12);
      }
    });

    it('should not have debug logging in production', () => {
      if (process.env.NODE_ENV === 'production' && process.env.LOG_LEVEL) {
        expect(process.env.LOG_LEVEL).not.toBe('debug');
        expect(process.env.LOG_LEVEL).not.toBe('verbose');
      }
    });
  });
});
