# SMART COPY Implementation

## Overview
SMART COPY is an intelligent address copying system that automatically parses addresses into their components and enables smart pasting via context menu in the FENNEC (MVP) application.

## Features

### 1. Intelligent Address Parsing
- **Location**: `core/utils.js` - `parseAddressForSmartCopy()` function
- **Functionality**:
  - Parses full addresses into components: line1, line2, city, state, zip
  - Handles various address formats and edge cases
  - Detects apartment/suite numbers and separates them into line2
  - Removes country codes and labels (Physical:, Mailing:, etc.)

### 2. Smart Copy Trigger
- **Location**: `core/utils.js` - `smartCopyAddress()` function
- **Triggers**:
  - Clicking on address links (`.copilot-address`)
  - Clicking on copy icons (`.copilot-copy-icon`) for address text
- **Actions**:
  - Stores parsed components in chrome.storage.local
  - Adds address to history (up to 5 most recent)
  - Copies full address to clipboard
  - Shows notification with parsed components

### 3. Context Menu Smart Paste
- **Location**: `core/utils.js` - `setupContextMenu()` and related functions
- **Functionality**:
  - Right-click on any address field to show context menu
  - Displays up to 5 most recent addresses in history
  - Completely replaces all address fields on the page
  - Clears empty fields (e.g., line2) if no data available
  - Shows success notification with filled field count

## Address Parsing Logic

### Supported Formats
```javascript
// Standard format
"123 Main St, Apt 4B, New York, NY 10001"

// With labels
"Physical: 456 Oak Ave, Suite 100, Los Angeles, CA 90210"

// Simple format
"789 Pine Rd, Chicago, IL 60601"
```

### Parsing Rules
1. **Line 1**: Main street address (before first comma)
2. **Line 2**: Apartment/Suite information (if present)
3. **City**: City name (before state)
4. **State**: Two-letter state code
5. **ZIP**: 5 or 9-digit ZIP code

### Field Detection
The system detects form fields by looking for keywords in:
- `name` attribute
- `id` attribute  
- `placeholder` attribute

**Supported Keywords**:
- **Street/Address**: `street`, `address`, `line1`
- **Line 2**: `line2`, `suite`, `apt`
- **City**: `city`
- **State**: `state`
- **ZIP**: `zip`, `postal`

## User Workflow

### 1. Copy Address
1. **Navigate** to sidebar with addresses
2. **Click** on address link or copy icon
3. **See notification** showing parsed components
4. **Address copied** to clipboard and added to history

### 2. Smart Paste Address
1. **Navigate** to form (e.g., "Update Company Info")
2. **Right-click** on any address field (Street 1, City, State, etc.)
3. **Select address** from context menu history
4. **All fields auto-fill** completely, replacing existing content
5. **See success notification** with field count

## Technical Implementation

### Storage Structure
```javascript
{
  smartCopyAddress: {
    fullAddress: "123 Main St, Apt 4B, New York, NY 10001",
    components: {
      line1: "123 Main St",
      line2: "Apt 4B", 
      city: "New York",
      state: "NY",
      zip: "10001"
    },
    timestamp: 1703000000000
  },
  addressHistory: [
    // Array of up to 5 most recent addresses
    // Each with same structure as smartCopyAddress
  ]
}
```

### Context Menu System
- **Trigger**: Right-click on address fields
- **Position**: Appears at cursor location
- **Content**: Shows address history with preview
- **Selection**: Click to paste selected address
- **Styling**: Professional appearance with hover effects

### Smart Paste Behavior
- **Complete Replacement**: All address fields are replaced
- **Empty Field Handling**: Fields with no data are cleared
- **Event Triggering**: Input and change events are dispatched
- **Field Detection**: Automatically finds all address-related fields

## Examples

### Example 1: Simple Address
**Input**: `"18693 Oak Knot Cir, Brainerd, MN 56401"`
**Parsed**:
- Line 1: `"18693 Oak Knot Cir"`
- Line 2: `""`
- City: `"Brainerd"`
- State: `"MN"`
- ZIP: `"56401"`

### Example 2: Complex Address
**Input**: `"Physical: 123 Main St, Apt 4B, New York, NY 10001"`
**Parsed**:
- Line 1: `"123 Main St"`
- Line 2: `"Apt 4B"`
- City: `"New York"`
- State: `"NY"`
- ZIP: `"10001"`

## Integration Points

### 1. Sidebar Integration
- Works with all address displays in sidebar
- Compatible with Gmail, DB, and Adyen environments
- Preserves existing Google search functionality

### 2. Form Integration
- Works with any HTML form
- Compatible with dynamic forms
- Supports various field naming conventions
- Right-click context menu integration

### 3. Storage Integration
- Uses chrome.storage.local for persistence
- Maintains address history across sessions
- Survives page refreshes
- Automatic history management (max 5 addresses)

## Context Menu Features

### Visual Design
- Clean, professional appearance
- Hover effects for menu items
- Clear address previews
- Responsive positioning

### User Experience
- Intuitive right-click interaction
- Clear visual feedback
- Address history management
- Success notifications

### Technical Features
- Prevents default context menu
- Handles edge cases (no history, etc.)
- Proper event handling
- Memory management

## Debug Information

The system provides detailed console logging:
- Address parsing steps
- Component extraction
- Storage operations
- Context menu interactions
- Smart paste operations
- Field detection and filling

---
*Implementation completed: December 19, 2024*
*Updated: December 19, 2024 - Added context menu smart paste system*
