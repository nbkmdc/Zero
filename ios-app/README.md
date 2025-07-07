# Zero Mail iOS App

A native iOS mobile application for Zero Mail built with SwiftUI.

## Features

- **Authentication**: Login with Zero email credentials
- **Email Management**: View, search, and navigate email threads
- **Folder Navigation**: Access Inbox, Sent, Drafts, Spam, Trash, and Archive folders
- **Thread Display**: Read email conversations with full message threading
- **Dark/Light Mode**: Automatic theme switching based on system preferences
- **Modern UI**: Clean, responsive design matching the Zero Mail web interface

## Architecture

### Core Components

- **ZeroMailApp.swift**: Main app entry point with environment setup
- **ContentView.swift**: Root view handling authentication state
- **LoginView.swift**: Authentication interface matching web app design
- **MailListView.swift**: Email thread listing with search and folder navigation
- **ThreadDisplayView.swift**: Individual email thread display with message expansion

### Services

- **AuthService**: Handles user authentication and session management
- **MailService**: Manages email data fetching and operations
- **ThemeManager**: Controls app theming and color schemes

### Models

- **User**: User account information
- **EmailMessage**: Individual email message data
- **EmailThread**: Email conversation threading
- **EmailFolder**: Folder structure and metadata

## Design System

The app follows Zero Mail's design language with:

- **Colors**: Consistent with web app color palette
  - Light mode: White backgrounds with subtle grays
  - Dark mode: Dark backgrounds (#141414) with offset panels (#0A0A0A)
- **Typography**: System fonts with appropriate weights and sizes
- **Icons**: SF Symbols for consistent iOS experience
- **Spacing**: 8px grid system for consistent layouts

## API Integration

The app connects to the Zero Mail backend at `http://localhost:8787` with endpoints:

- `POST /api/auth/login` - User authentication
- `GET /api/mail/threads` - Email thread listing
- `GET /api/mail/thread/{id}` - Individual thread details
- `POST /api/mail/thread/{id}/read` - Mark as read
- `POST /api/mail/thread/{id}/star` - Toggle star status

## Requirements

- iOS 17.0+
- Xcode 15.0+
- Swift 5.9+

## Building

1. Open `ZeroMail.xcodeproj` in Xcode
2. Select your target device or simulator
3. Build and run (⌘+R)

## Configuration

Update the `baseURL` in `AuthService.swift` and `MailService.swift` to point to your Zero Mail backend instance.

## Features Implemented

✅ User authentication with email/password
✅ Email thread listing with search
✅ Folder navigation (Inbox, Sent, Drafts, etc.)
✅ Thread display with message expansion
✅ Dark/light mode support
✅ Responsive design for iPhone and iPad
✅ Pull-to-refresh functionality
✅ Star/unstar email threads
✅ Mark emails as read
✅ Attachment display

## Future Enhancements

- [ ] Email composition and sending
- [ ] Push notifications
- [ ] Offline support
- [ ] Advanced search filters
- [ ] Label management
- [ ] Swipe gestures for quick actions
- [ ] Rich text email rendering
- [ ] Attachment downloads
