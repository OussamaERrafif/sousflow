# Contributing to SoussFlow

Thank you for your interest in contributing to SoussFlow! This document outlines the process for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Be respectful and inclusive in communications
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

1. **Check existing issues** - Search for similar bugs before reporting
2. **Use the bug report template** - Include:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Screenshots if applicable

### Suggesting Features

1. **Search existing proposals** - Avoid duplicate suggestions
2. **Use the feature request template** - Include:
   - Clear description of the feature
   - Use cases and motivation
   - Potential implementation approaches
   - Any relevant research or examples

### Pull Requests

#### Prerequisites

- Node.js 18+ and npm 9+
- Python 3.11+
- A Supabase project for local testing

#### Development Workflow

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/sousflow.git
   cd sousflow
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

4. **Set up development environment**
   ```bash
   # Backend
   cd backend
   cp .env.example .env
   pip install -r requirements.txt

   # Frontend (in another terminal)
   cd frontend
   npm install
   ```

5. **Make your changes**

6. **Test your changes**
   ```bash
   # Backend tests
   cd backend
   pytest

   # Frontend lint
   cd frontend
   npm run lint
   ```

7. **Commit with clear messages**
   ```bash
   git add .
   git commit -m "Add: descriptive commit message"
   ```

8. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

#### Commit Message Convention

Use clear, descriptive commit messages:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code style (formatting)
- `refactor` - Code refactoring
- `test` - Tests
- `chore` - Maintenance

Examples:
```
feat(iot): add soil moisture threshold alerts
fix(auth): resolve JWT token expiration issue
docs(readme): update installation instructions
```

#### Pull Request Guidelines

- **Keep PRs focused** - One feature or fix per PR
- **Update documentation** - If adding features, update relevant docs
- **Add tests** - Include tests for new functionality
- **Follow code style** - Use existing conventions in the codebase
- **Ensure tests pass** - Run local tests before submitting

## Project Structure Notes

### Backend

- Routes go in `app/routes/`
- Business logic in `app/services/`
- Pydantic schemas in `app/schemas/`
- Follow existing patterns for new endpoints

### Frontend

- Components in `src/components/`
- Redux slices in `src/lib/store/slices/`
- Pages in `src/app/[locale]/`
- Follow existing naming conventions

### API Changes

If you modify backend routes or schemas:
1. Run `npm run codegen` in `frontend/`
2. Commit the generated changes separately

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for general questions

Thank you for contributing to SoussFlow!
