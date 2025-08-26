# FENNEC Extension Popup Improvements

## Overview
The FENNEC extension popup has been completely redesigned with a modern, feature-rich interface that provides better control over the extension's functionality.

## New Features

### 1. Modern UI Design
- **Gradient Header**: Beautiful gradient background with FENNEC branding
- **Card-based Layout**: Clean, organized sections with proper spacing
- **Modern Toggle Switches**: Smooth animated toggle switches instead of basic checkboxes
- **Responsive Design**: Optimized for different popup sizes (25% more compact)
- **Rounded Borders**: All elements feature rounded corners for modern appearance

### 2. Mode Toggle (CLASSIC/REVIEW)
- **Toggle Button**: Easy switching between CLASSIC and REVIEW modes
- **Visual Feedback**: Active mode is highlighted with background color and shadow
- **Persistent State**: Mode selection is saved and synced across devices
- **Real-time Updates**: Changes are immediately applied to all open tabs

### 3. Environment Selection
- **Grid Layout**: All environments displayed in a clean 2-column grid
- **Individual Control**: Enable/disable specific environments independently
- **Mode-based Visibility**: 
  - **CLASSIC Mode**: Shows only Gmail, Database, and USPS
  - **REVIEW Mode**: Shows all environments (Gmail, Database, USPS, Adyen, Kount)
- **Supported Environments**:
  - Gmail
  - Database (Incfile)
  - USPS
  - Adyen
  - Kount
- **Smart Detection**: Extension automatically detects current environment
- **Selective Loading**: Only loads features for enabled environments

### 4. Auto Upload Feature
- **Drag & Drop Upload**: Enable automatic file upload via drag and drop
- **INT STORAGE Integration**: Seamlessly integrates with existing INT STORAGE functionality
- **Order Detection**: Automatically detects current order ID for file uploads
- **Background Processing**: Files are queued and processed in the background
- **Visual Feedback**: Upload status and progress indicators

## Technical Implementation

### New Files Created
1. **`core/environment_manager.js`**: Manages environment detection and settings
2. **`test_popup.html`**: Test page for verifying popup functionality

### Updated Files
1. **`popup.html`**: Complete redesign with new UI components
2. **`popup.js`**: Rewritten with class-based architecture and new features
3. **`manifest.json`**: Updated to include environment manager in all content scripts
4. **`core/background_email_search.js`**: Added auto-upload message handling

### Architecture Changes

#### Environment Manager
The new `EnvironmentManager` class provides:
- Automatic environment detection based on URL patterns
- Centralized settings management
- Message handling for popup communication
- Auto-upload functionality setup
- Environment-specific initialization

#### Enhanced State Management
- **Local Storage**: Extension settings stored in `chrome.storage.local`
- **Sync Storage**: Review mode synced across devices via `chrome.storage.sync`
- **Real-time Updates**: Changes immediately propagate to all tabs
- **Persistent State**: Settings survive browser restarts

#### Message Passing
- **Enhanced Communication**: Rich message objects with multiple settings
- **Background Integration**: Auto-upload files processed in background
- **Tab Management**: Automatic tab reloading when settings change
- **Error Handling**: Graceful fallbacks for failed operations

## Usage Instructions

### Basic Operation
1. **Click the FENNEC extension icon** to open the popup
2. **Toggle the main switch** to enable/disable the extension
3. **Select mode** by clicking CLASSIC or REVIEW
4. **Configure environments** by checking/unchecking desired environments
5. **Enable auto-upload** if you want drag & drop file uploads

### Environment Management
- **Enable/Disable**: Check/uncheck environments to control where FENNEC is active
- **Automatic Detection**: The extension automatically detects your current environment
- **Selective Loading**: Only enabled environments will load their features

### Auto Upload
- **Enable**: Toggle the "Drag & Drop Upload" switch
- **Use**: Drag files onto any database page to automatically upload them
- **Order Detection**: The system automatically detects the current order ID
- **Background Processing**: Files are processed in the background

## Configuration Options

### Storage Keys
- `extensionEnabled`: Main extension toggle state
- `fennecReviewMode`: Review mode state (synced)
- `environments`: Object containing environment enable/disable states
- `autoUpload`: Auto-upload feature state

### Default Values
```javascript
{
  extensionEnabled: true,
  fennecReviewMode: false,
  environments: {
    gmail: true,
    db: true,
    usps: true,
    adyen: true,
    kount: true
  },
  autoUpload: false
}
```

## Testing

### Test Page
Use `test_popup.html` to verify:
- Storage operations
- Environment detection
- Message passing
- Current storage state

### Manual Testing
1. **Load the extension** in Chrome
2. **Open the popup** and test all toggles
3. **Navigate to different sites** to test environment detection
4. **Test auto-upload** by dragging files onto database pages
5. **Verify persistence** by restarting the browser

## Browser Compatibility
- **Chrome**: Full support (primary target)
- **Edge**: Full support (Chromium-based)
- **Firefox**: Limited support (may require manifest adjustments)
- **Safari**: Not supported (different extension API)

## Future Enhancements
- **Keyboard Shortcuts**: Quick access to common actions
- **Custom Themes**: User-selectable color schemes
- **Advanced Settings**: More granular control options
- **Usage Analytics**: Track feature usage patterns
- **Export/Import**: Settings backup and restore functionality

## Troubleshooting

### Common Issues
1. **Popup not opening**: Check if extension is properly loaded
2. **Settings not saving**: Verify storage permissions
3. **Auto-upload not working**: Ensure you're on a database page with order ID
4. **Environment not detected**: Check URL patterns in environment manager

### Debug Mode
Enable debug logging by checking browser console for `[FENNEC]` messages.

## Contributing
When making changes to the popup:
1. **Test thoroughly** with the provided test page
2. **Update documentation** for any new features
3. **Maintain backward compatibility** with existing settings
4. **Follow the established patterns** for state management and message passing
