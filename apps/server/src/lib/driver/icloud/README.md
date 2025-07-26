# iCloud Mail Manager - Modular Architecture

This directory contains the refactored iCloud mail implementation, broken down into focused, modular components for better maintainability and testability.

## Structure

```
icloud/
├── index.ts              # Main exports and public API
├── manager.ts             # Main ICloudMailManager class
├── types.ts               # TypeScript interfaces and constants
├── connections.ts         # IMAP/SMTP connection management
├── message-parser.ts      # Message parsing and processing utilities
├── attachment-handler.ts  # Attachment extraction and management
├── search-utils.ts        # Search functionality and utilities
├── label-manager.ts       # Label/folder management operations
├── draft-spam-manager.ts  # Draft and spam management
├── email-sender.ts        # Email sending functionality
└── README.md             # This file
```

## Modules Overview

### `manager.ts`
The main `ICloudMailManager` class that implements the `MailManager` interface. This class orchestrates all the modular components and provides the public API.

### `connections.ts`
- `ImapConnection`: Manages IMAP connections to iCloud servers
- `SmtpConnection`: Manages SMTP connections for sending emails

### `message-parser.ts`
- `MessageParser`: Handles parsing of email headers, body processing, and thread ID generation
- Utilities for processing message content and extracting metadata

### `attachment-handler.ts`
- `AttachmentHandler`: Manages attachment extraction, parsing, and retrieval
- MIME structure parsing for attachment detection

### `search-utils.ts`
- `SearchUtils`: Provides search functionality including query parsing, pagination, and thread grouping
- Converts Gmail-style search syntax to IMAP search criteria

### `label-manager.ts`
- `LabelManager`: Manages labels/folders operations
- Maps iCloud folders to labels for consistency with other providers

### `draft-spam-manager.ts`
- `DraftManager`: Handles draft creation, retrieval, listing, and sending
- `SpamManager`: Manages spam deletion operations

### `email-sender.ts`
- `EmailSender`: Handles email composition and sending via SMTP
- MIME message creation with attachments support

### `types.ts`
- Type definitions and interfaces specific to iCloud implementation
- Configuration constants for IMAP/SMTP servers
- Folder mappings and standard folder definitions

## Benefits of Modular Architecture

1. **Separation of Concerns**: Each module has a single responsibility
2. **Testability**: Individual components can be unit tested in isolation
3. **Maintainability**: Changes to one area don't affect unrelated functionality
4. **Reusability**: Components can be reused across different implementations
5. **Readability**: Smaller files are easier to understand and navigate
6. **Debugging**: Issues can be traced to specific modules more easily

## Usage

The modular implementation maintains the same public API as the original monolithic implementation:

```typescript
import { ICloudMailManager } from './icloud';
// or
import { ICloudMailManager } from './icloud/manager';

const manager = new ICloudMailManager(config);
```

## Future Enhancements

With this modular structure, future enhancements can be made more easily:

1. **Real IMAP Implementation**: Replace simulated connections with actual IMAP/SMTP libraries
2. **Caching Layer**: Add caching to connection and message parser modules
3. **Rate Limiting**: Implement rate limiting in connection modules
4. **Logging**: Add structured logging to each module
5. **Configuration**: Make server settings configurable per module
6. **Testing**: Add comprehensive unit tests for each module
7. **Performance Optimization**: Optimize individual components without affecting others

## Migration Notes

- The original `icloud.ts` file now simply re-exports the modular implementation
- All existing imports and usage remain unchanged
- The API surface is identical to the previous implementation
- Internal implementation is now spread across focused modules

This refactoring significantly improves the codebase organization while maintaining backward compatibility.
