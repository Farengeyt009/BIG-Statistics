# WeChat Integration Setup

## 🔧 Configuration

### Environment Variables

Add the following variables to your `.env` file:

```env
# WeChat Configuration
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret
WECHAT_REDIRECT_URI=https://yourdomain.com/api/wechat/callback
WECHAT_QR_TIMEOUT=300
```

### WeChat App Setup

1. **Create WeChat App:**
   - Go to [WeChat Open Platform](https://open.weixin.qq.com/)
   - Create a new app
   - Get your `APP_ID` and `APP_SECRET`

2. **Configure Redirect URI:**
   - Set the redirect URI in your WeChat app settings
   - Use: `https://yourdomain.com/api/wechat/callback`

3. **Set up Webhook:**
   - Configure webhook URL for receiving WeChat callbacks
   - URL: `https://yourdomain.com/api/wechat/webhook`

## 📋 API Endpoints

- `POST /api/wechat/generate-qr` - Generate QR code for binding
- `GET /api/wechat/status/<session_id>` - Check QR session status
- `POST /api/wechat/bind` - Bind WeChat account
- `DELETE /api/wechat/unbind` - Unbind WeChat account
- `GET /api/wechat/binding` - Get WeChat binding info

## 🔒 Security

- All endpoints require JWT authentication
- QR sessions expire after configured timeout
- WeChat data is encrypted in database
- Rate limiting on all endpoints

## 🗄️ Database

The integration uses the `wechat` schema with two tables:
- `wechat.bindings` - User-WeChat account bindings
- `wechat.qr_sessions` - QR code sessions for binding process
