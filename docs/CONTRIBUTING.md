# Contributing to xshop.ai User Service

Thank you for your interest in contributing! This guide covers everything you need to know to get started.

## Quick Start

1. **Fork & Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/user-service.git
   cd user-service
   npm install
   ```

2. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Verify Setup**
   ```bash
   npm test
   npm run dev
   ```

4. **Find an Issue**
   - Good first issues: [Filter by label](https://github.com/xshopai/user-service/labels/good-first-issue)
   - Browse all: [Issues](https://github.com/xshopai/user-service/issues)

## Standards

### Code Style

- **Be Respectful**: Treat everyone with respect
- **Be Collaborative**: Work together constructively
- **Follow conventions**: ESLint, Prettier, and project patterns

```bash
# Auto-format code
npm run lint:fix
```

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes  
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Tests

### Code Patterns

**Use project patterns from [TECHNICAL.md](TECHNICAL.md)**:

```javascript
// Controller-Service-Model pattern
// See src/controllers/, src/services/, src/models/

// Async/await with asyncHandler
export const createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json({ success: true, data: user });
});

// Error handling
throw new ErrorResponse('User not found', 404, 'USER_NOT_FOUND');
```

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat(auth): add JWT refresh token support
fix(validation): correct email regex
docs: update contributing guide
test(user): add integration tests
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Workflow

1. **Create Branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make Changes & Test**
   ```bash
   npm test
   npm run lint
   ```

3. **Commit**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

4. **Push & Create PR**
   ```bash
   git push origin feature/your-feature
   # Open PR on GitHub
   ```

5. **Address Review Feedback**
   - Respond within 48 hours
   - Ask questions if unclear
   - Keep PR scope focused

## Testing Requirements

### Coverage Requirements

- **Overall**: ≥ 80%
- **New Features**: ≥ 90%
- **Bug Fixes**: Must include test case

### Test Types

1. **Unit Tests**: Required for all new functions
2. **Integration Tests**: Required for API endpoints
3. **E2E Tests**: Required for new workflows

### Running Tests

```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Watch mode (during development)
npm run test:watch

# Specific test file
npm test -- tests/unit/user.service.test.js
```

### Writing Tests

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('UserService', () => {
  describe('createUser', () => {
    it('should create user successfully', async () => {
      // Arrange
      const userData = { email: 'test@example.com' };
      
      // Act
      const result = await userService.createUser(userData);
      
      // Assert
      expect(result).toHaveProperty('userId');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw error for duplicate email', async () => {
      // Arrange
      const userData = { email: 'existing@example.com' };
      
      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects
        .toThrow('Email already exists');
    });
  });
});
```

**Required Coverage**: ≥ 80% overall, ≥ 90% for new features

```bash
npm test              # Run all tests
npm run test:coverage # Check coverage
npm run test:watch    # Watch mode
```

**Test Pattern** (Arrange-Act-Assert):
```javascript
describe('createUser', () => {
  it('should create user successfully', async () => {
    // Arrange
    const userData = { email: 'test@example.com' };
    
    // Act
    const result = await userService.createUser(userData);
    
    // Assert
    expect(result).toHaveProperty('userId');
  });
});
```

## Getting Help

- **Questions**: [GitHub Discussions](https://github.com/xshopai/user-service/discussions)
- **Bugs**: [GitHub Issues](https://github.com/xshopai/user-service/issues)
- **Reference**: See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) and [TECHNICAL.md](TECHNICAL.md)

## Recognition

Contributors are credited in README.md and release notes. Thank you! 🎉