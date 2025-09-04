# 🌐 GitHub Pages Setup Instructions

## Quick Setup (2 minutes)

### **Step 1: Enable GitHub Pages**
1. Go to https://github.com/kevanbtc/One-piece/settings/pages
2. Under "Source", select **"Deploy from a branch"**
3. Choose **"main"** branch and **"/ (root)"** folder
4. Click **"Save"**

### **Step 2: Verify Setup**
- GitHub will show: "Your site is published at https://kevanbtc.github.io/One-piece/"
- It takes 2-3 minutes to go live
- The demo page will be available at the URL above

## Alternative: Direct File Access

If Pages isn't enabled yet, you can view the demo file directly:
- **Raw HTML**: https://github.com/kevanbtc/One-piece/blob/main/index.html
- **GitHub Preview**: Click "Preview" when viewing index.html in GitHub

## Local Demo Server

For immediate access, run locally:
```bash
# Option 1: Built-in demo server
npm run demo
# Open http://localhost:3333

# Option 2: Simple Python server (if Python installed)
python -m http.server 8080
# Open http://localhost:8080
```

## Troubleshooting

### **404 Error on GitHub Pages**
- Check if GitHub Pages is enabled in repository settings
- Verify the source is set to "main" branch, "/ (root)" folder
- Wait 2-3 minutes after enabling (GitHub needs time to build)

### **Custom Domain (Optional)**
- Add CNAME file with your domain
- Configure DNS A records to GitHub's IPs
- Enable HTTPS in Pages settings

## Verification

Once enabled, the demo should show:
- ✅ Professional landing page with UPoF V2 branding
- ✅ Interactive feature cards with hover effects
- ✅ Problem/solution comparison
- ✅ Integration code examples
- ✅ 90-second demo flow breakdown
- ✅ Direct GitHub repository links

## Need Help?

If GitHub Pages setup doesn't work:
1. **Use local demo**: `npm run demo`
2. **Share repository**: https://github.com/kevanbtc/One-piece
3. **Use file preview**: Click index.html in GitHub and preview
4. **Screen share**: Use local demo for live presentations