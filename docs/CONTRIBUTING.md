# Contributing Guide

Thank you for your interest in contributing to the User Service! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](../../docs/CODE_OF_CONDUCT.md).

### Our Standards

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Inclusive**: Welcome newcomers and diverse perspectives
- **Be Collaborative**: Work together constructively
- **Be Professional**: Focus on what's best for the project

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 20+
- MongoDB 8+
- Dapr CLI 1.16.2+
- Git
- VS Code (recommended)

### First-Time Setup

1. **Fork the Repository**

   ```bash
   # Visit https://github.com/xshopai/user-service
   # Click "Fork" button
   ```

2. **Clone Your Fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/user-service.git
   cd user-service
   ```

3. **Add Upstream Remote**

   ```bash
   git remote add upstream https://github.com/xshopai/user-service.git
   ```

4. **Install Dependencies**

   ```bash
   npm install
   ```

5. **Set Up Environment**

   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

6. **Verify Setup**

   ```bash
   npm test
   npm run lint
   npm run dev
   ```

### Find Something to Work On

- **Good First Issues**: Look for issues labeled `good-first-issue`
- **Help Wanted**: Check issues labeled `help-wanted`
- **Bug Fixes**: Search for `bug` label
- **Features**: Look for `enhancement` label

Browse issues: https://github.com/xshopai/user-service/issues

## Development Workflow

### 1. Create Feature Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

**Branch Naming Convention**:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes
- `chore/` - Maintenance tasks

### 2. Make Changes

```bash
# Make your changes
# Edit files, add features, fix bugs

# Test your changes
npm test
npm run lint

# Commit your changes
git add .
git commit -m "feat: add amazing feature"
```

### 3. Keep Branch Updated

```bash
# Regularly sync with upstream
git fetch upstream
git rebase upstream/main

# Or merge if preferred
git merge upstream/main
```

### 4. Push Changes

```bash
git push origin feature/your-feature-name
```

### 5. Create Pull Request

1. Go to https://github.com/xshopai/user-service
2. Click "New Pull Request"
3. Select your branch
4. Fill out PR template
5. Submit for review

## Coding Standards

### Style Guide

We use ESLint and Prettier for code formatting.

```bash
# Check code style
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

### Code Conventions

#### JavaScript/Node.js

```javascript
// ✅ GOOD: Use ES modules
import express from 'express';
export default router;

// ❌ BAD: Don't use CommonJS
const express = require('express');
module.exports = router;

// ✅ GOOD: Use async/await
async function getUser(id) {
  const user = await User.findById(id);
  return user;
}

// ❌ BAD: Avoid callbacks
function getUser(id, callback) {
  User.findById(id, callback);
}

// ✅ GOOD: Descriptive names
async function createUserAccount(userData) { ... }

// ❌ BAD: Unclear names
async function create(data) { ... }

// ✅ GOOD: Error handling
try {
  const user = await userService.createUser(userData);
  return res.status(201).json({ success: true, data: user });
} catch (error) {
  logger.error('Failed to create user', { error: error.message });
  return res.status(500).json({ success: false, error: error.message });
}

// ❌ BAD: Unhandled errors
const user = await userService.createUser(userData);
return res.json(user);
```

#### File Structure

```javascript
// Order of imports
import express from 'express';           // 1. Node built-ins & external packages
import mongoose from 'mongoose';

import User from '../models/user.js';    // 2. Local imports (absolute)
import logger from '../utils/logger.js';

import config from './config.js';        // 3. Relative imports

// Order of exports
export const func1 = () => { ... };      // 1. Named exports

export default router;                    // 2. Default export (last)
```

#### Comments

```javascript
// ✅ GOOD: Explain "why", not "what"
// User session expires after 24h to balance security and UX
const JWT_EXPIRY = '24h';

// ❌ BAD: Obvious comments
// Set JWT_EXPIRY to '24h'
const JWT_EXPIRY = '24h';

// ✅ GOOD: Document complex logic
/**
 * Validates password strength using the following criteria:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * 
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with `valid` boolean and `errors` array
 */
export function validatePassword(password) { ... }
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:

```bash
# Good commits
feat(auth): add JWT refresh token support
fix(validation): correct email validation regex
docs(api): update API documentation for user endpoints
test(user): add unit tests for user service
refactor(controller): simplify user creation logic

# With body
feat(auth): add JWT refresh token support

Implements refresh token mechanism to allow users to obtain
new access tokens without re-authentication.

Closes #123
```

## Pull Request Process

### PR Title

Follow commit message format:

```
feat(auth): add JWT refresh token support
fix(validation): correct email validation regex
```

### PR Description

Use the PR template:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests pass locally
- [ ] No new warnings generated
```

### Review Process

1. **Automated Checks**: CI/CD runs tests, linting, coverage
2. **Code Review**: Maintainers review your code
3. **Address Feedback**: Make requested changes
4. **Approval**: Get approval from maintainer
5. **Merge**: Maintainer merges your PR

### Review Guidelines

**For Contributors**:
- Respond to feedback promptly
- Ask questions if unclear
- Be open to suggestions
- Keep PR scope focused

**For Reviewers**:
- Review within 48 hours
- Be constructive and respectful
- Explain reasoning for changes
- Approve when ready

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

## Documentation

### When to Update Docs

Update documentation when:
- Adding new features
- Changing API endpoints
- Modifying configuration
- Adding environment variables
- Changing deployment process

### Documentation Files

- **README.md**: Overview and quick start
- **docs/API.md**: API reference
- **docs/DEVELOPMENT.md**: Development setup
- **docs/CONFIGURATION.md**: Configuration options
- **docs/DEPLOYMENT.md**: Deployment instructions

### Documentation Style

```markdown
# Clear headings

Use descriptive headings that explain what the section covers.

## Code examples

Provide working code examples:

\`\`\`javascript
// Include comments explaining the code
const user = await User.findById(userId);
\`\`\`

## Clear instructions

Break down complex steps:

1. First, do this
2. Then, do that
3. Finally, verify

## Visual aids

Include diagrams, screenshots, or ASCII art when helpful.
```

## Community

### Getting Help

- **Questions**: Open a [Discussion](https://github.com/xshopai/user-service/discussions)
- **Bugs**: Open an [Issue](https://github.com/xshopai/user-service/issues)
- **Chat**: Join our [Slack channel](#) (if available)

### Reporting Bugs

**Before Submitting**:
- Check existing issues
- Verify bug exists in latest version
- Collect relevant information

**Bug Report Template**:

```markdown
## Description
Clear description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: Ubuntu 22.04
- Node.js: 20.10.0
- MongoDB: 8.0.0
- Service Version: 1.2.3

## Additional Context
Logs, screenshots, etc.
```

### Suggesting Features

**Feature Request Template**:

```markdown
## Problem Statement
What problem does this solve?

## Proposed Solution
How should it work?

## Alternatives Considered
Other solutions you've considered

## Additional Context
Any other relevant information
```

## Recognition

Contributors are recognized in:
- **README.md**: Contributors section
- **Release Notes**: Credited in changelog
- **GitHub**: Contributor badge

## Questions?

If you have questions about contributing:

1. Check this guide and other documentation
2. Search existing issues and discussions
3. Open a new discussion
4. Reach out to maintainers

Thank you for contributing to xShop.ai! 🎉

## License

By contributing, you agree that your contributions will be licensed under the same [LICENSE](../LICENSE) as the project.
