# Setup Instructions for Client

## Quick Setup (3 Steps)

### 1. Install Node.js
- Download and install **Node.js 20.x or 21.x** from [nodejs.org](https://nodejs.org/)
- **Important**: Use version 20 or 21, NOT version 22 or higher
- Verify installation: Open Command Prompt and run:
  ```
  node --version
  ```
  Should show: `v20.x.x` or `v21.x.x`

### 2. Install Project Dependencies
Open Command Prompt/Terminal in the project folder and run:
```bash
npm install
```

This will:
- Install all required packages
- Set up the project
- Takes 2-5 minutes (first time)

### 3. Run the Application
```bash
npm run desktop:dev
```

This will:
- Build the application
- Start the desktop app
- Open the app window

## What Each Command Does

- `npm install` - Downloads and installs all dependencies (like Python's `pip install -r requirements.txt`)
- `npm run desktop:dev` - Builds and runs the desktop application

## File Structure

- `package.json` - This is like `requirements.txt` for Python. Contains all dependencies.
- `node_modules/` - Installed packages (created after `npm install`, don't edit)
- `dist/` - Build output (created after build, don't edit manually)

## Common Issues

### Issue: "node is not recognized"
**Solution**: Install Node.js from nodejs.org

### Issue: "npm is not recognized"
**Solution**: Node.js includes npm. Reinstall Node.js.

### Issue: Build errors
**Solution**: 
1. Make sure Node.js version is 20 or 21
2. Delete `node_modules` folder
3. Run `npm install` again

### Issue: Port 5000 already in use
**Solution**: Close other applications using port 5000, or change PORT in `.env` file

## Next Steps

1. First time setup: Configure database sync (optional) in Settings
2. Set up biometric device (if needed) - see `BIOMETRIC_SETUP_GUIDE.md`
3. Start using the app!

## Building Installer (.exe)

To create an installer for distribution:
```bash
npm run desktop:build
```

Installer will be in `dist/GymAdminDesktop-1.0.0-Setup.exe`

---

**That's it! The app should work after these steps.**

