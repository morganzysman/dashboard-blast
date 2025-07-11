# OlaClick Multi-Account Dashboard

A modern, responsive dashboard for monitoring orders from multiple OlaClick accounts. This dashboard fetches data from different accounts using their respective authentication cookies and displays aggregated order information.

## Features

- 🏢 **Multi-Account Support**: Monitor multiple OlaClick accounts simultaneously
- 📊 **Real-time Data**: Automatic refresh every 5 minutes
- 📈 **Payment Methods Breakdown**: View order distribution by payment method
- 🎯 **Date Range Filtering**: Filter orders by date range and timezone
- ⚙️ **Advanced Account Management**: List, add, edit, and delete accounts through web interface
- 💾 **File-based Credential Storage**: Secure credential storage in JSON file
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔄 **Auto-refresh**: Keeps data up-to-date automatically
- 🔐 **Secure Cookie Management**: Handles HTTP-only secure cookies properly

## Setup

### 1. Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Start the Server

```bash
npm start
```

The dashboard will be available at: `http://localhost:3001`

### 3. Configure Your Accounts

On first startup, the dashboard will create an `accounts.json` file with default account configurations. You can manage accounts in two ways:

#### Option A: Through Web Interface (Recommended)
1. Open the dashboard at `http://localhost:3001`
2. Click "⚙️ Manage Accounts" button
3. View current accounts and add/edit/delete as needed

#### Option B: Direct File Editing
Edit the `accounts.json` file directly (server restart required)

## Account Management Features

### Web Interface
- **View Current Accounts**: See all configured accounts with their settings
- **Add New Account**: Add accounts using company token as the unique identifier
- **Edit Existing Account**: Click "Edit" to modify account settings
- **Delete Account**: Remove accounts with confirmation
- **Real-time Updates**: Changes take effect immediately

### Account Structure

Each account is identified by its `company_token` (no separate account key needed):

```json
{
  "blast-smash-burgers": {
    "company_token": "blast-smash-burgers",
    "name": "Blast Smash Burgers",
    "tokens": [
      {
        "company_token": "blast-smash-burgers",
        "auth_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
      }
    ],
    "additional_cookies": "ajs_user_id=...; ajs_anonymous_id=..."
  }
}
```

### How to Get Your Tokens

1. **Option A: Extract from Browser (Recommended)**
   - Log into your OlaClick account in a web browser
   - Open Developer Tools (F12)
   - Go to the Application/Storage tab
   - Look for cookies and find the `tokens` parameter
   - Copy the decoded JSON value

2. **Option B: From Network Requests**
   - Log into your OlaClick account
   - Open Developer Tools (F12) → Network tab
   - Make a request to the OlaClick API
   - Find the request and copy the `Cookie` header
   - The system will automatically convert legacy cookies to the new format

### Legacy Cookie Support

The dashboard automatically converts legacy cookie strings to the new format:
- Paste your old cookie string in the token field
- The system will extract and convert the tokens parameter
- Additional cookie parameters are preserved separately

### Account Configuration Examples

**New Format (Recommended):**
```json
{
  "blast-smash-burgers": {
    "company_token": "blast-smash-burgers",
    "tokens": [
      {
        "company_token": "blast-smash-burgers",
        "auth_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
      }
    ],
    "additional_cookies": "ajs_user_id=...; ajs_anonymous_id=...",
    "name": "Blast Smash Burgers"
  },
  "blast-smash-burgers-miraflores": {
    "company_token": "blast-smash-burgers-miraflores",
    "tokens": [
      {
        "company_token": "blast-smash-burgers-miraflores",
        "auth_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
      }
    ],
    "additional_cookies": "ajs_user_id=...; ajs_anonymous_id=...",
    "name": "Blast Smash Burgers Miraflores"
  }
}
```

**Legacy Format (Still Supported):**
```json
{
  "blast-smash-burgers": {
    "company_token": "blast-smash-burgers",
    "cookie": "tokens=%5B%7B%22company_token%22%3A%22blast-smash-burgers%22...",
    "name": "Blast Smash Burgers"
  }
}
```

## API Endpoints

The dashboard provides comprehensive API endpoints:

- `GET /api/accounts` - List all accounts
- `GET /api/accounts/:companyToken` - Get full account details for editing
- `POST /api/accounts/:companyToken` - Add or update an account
- `DELETE /api/accounts/:companyToken` - Delete an account
- `GET /api/orders/all` - Get orders from all accounts with aggregation
- `GET /api/orders/:companyToken` - Get orders from a specific account

## Data Structure

The dashboard displays:

- **Combined Summary**: Aggregated data from all accounts
- **Total Orders**: Number of orders across all accounts
- **Total Amount**: Sum of all order totals
- **Payment Methods**: Combined breakdown by payment method
- **Individual Account Data**: Separate stats for each account

## File Structure

```
dashboard/
├── server.js              # Main server file
├── index.html             # Dashboard interface
├── package.json           # Dependencies
├── accounts.json          # Account credentials (auto-generated)
├── .gitignore            # Excludes sensitive files
└── README.md             # This file
```

## Security Features

### Credential Protection
- **File-based Storage**: Credentials stored in local JSON file
- **Git Exclusion**: `accounts.json` excluded from version control
- **Truncated Display**: Cookie values truncated in account list for security
- **Full Cookie Access**: Complete cookies available only when editing

### Best Practices
- Keep `accounts.json` file secure and backed up
- Don't commit credential files to version control
- Use environment variables for production deployments
- Consider additional authentication for production use

## API Response Handling

The dashboard correctly handles the OlaClick API response format:
```json
{
    "data": [
        {
            "name": "card",
            "count": 4,
            "sum": 266,
            "percent": 86.31
        },
        {
            "name": "bitcoin",
            "count": 1,
            "sum": 42.2,
            "percent": 13.69
        }
    ]
}
```

## Troubleshooting

### Common Issues

1. **Server won't start**: Check if port 3001 is available
2. **Accounts not loading**: Check `accounts.json` file permissions
3. **API errors**: Verify cookie values are current and complete
4. **Data not updating**: Check browser console for network errors

### Account Management Issues

1. **Can't edit account**: Ensure account exists and server is running
2. **Changes not saving**: Check server logs for file write permissions
3. **Accounts disappeared**: Check if `accounts.json` file exists and is readable

### Checking Logs

The server provides detailed logging:
- Account file operations
- API request results
- Error messages with details

## Production Deployment

For production use:

1. **Environment Variables**: Store sensitive data in environment variables
2. **HTTPS**: Use HTTPS for secure cookie transmission
3. **Authentication**: Add authentication to protect the dashboard
4. **Process Management**: Use PM2 or similar for process management
5. **Backup**: Regular backup of `accounts.json` file

## License

MIT License - feel free to modify and use for your own projects. 