# 🎨 Beezio Custom Store System - Complete Guide

## Overview
Every seller, affiliate, and fundraiser on Beezio gets a fully customizable online store with professional templates, custom domains, HTML/CSS editing, and integrated contact forms.

## 🚀 Quick Start

### 1. Access Your Store Settings
- Go to **Dashboard → Store Customization**
- Or visit `/store-customization` when logged in

### 2. Set Your Domain (Two Options)

#### Option A: Beezio Subdomain (Free & Instant)
- Format: `beezio.co/store/yourname`
- Set your subdomain in the **Domain** tab
- Available immediately - no DNS setup needed
- Example: `beezio.co/store/wild-honey-co`

#### Option B: Custom Domain (Your Own Domain)
- Use your own domain like `shop.yourbrand.com`
- Enter domain in the **Domain** tab
- Follow DNS setup instructions (CNAME record)
- Verification takes 24-48 hours
- Example: `shop.wildhoney.com`

### 3. Choose Your Templates
Navigate to the **Templates** tab and select:

#### Storefront Templates (12+ options)
1. **Modern Grid** - Clean hero banner with 4-column product grid
2. **Boutique Storyteller** - Large imagery with narrative sections
3. **Catalog Browser** - Sidebar navigation with list/grid toggle
4. **Launch One-Pager** - Single-page store with hero and inline checkout
5. **Marketplace Hub** - Multi-category with promoted products
6. **Subscription Store** - Optimized for recurring products

#### Product Page Templates
1. **Detailed Product View** - Full gallery, reviews, recommendations
2. **Minimal Product** - Clean, distraction-free focus
3. **Immersive Showcase** - Full-screen imagery (perfect for art/photography)
4. **Product Comparison** - Side-by-side variants and specs

#### Landing Page Templates
1. **Product Launch** - High-converting with countdown timer
2. **Fundraiser Campaign** - Progress bar and impact stories

## 🎨 Customization Features

### General Settings
- Store name and description
- Logo upload
- Banner image
- Business hours
- Shipping policy
- Return policy

### Appearance
- Theme selection (Modern, Elegant, Vibrant, Minimalist, Dark, Classic)
- Color customization
- Typography options
- Layout configuration:
  - Header style (Banner, Minimal, Full-width, Split)
  - Product grid (2-col, 3-col, 4-col, Masonry, Carousel)
  - Sidebar (On/Off)
  - Footer style (Compact, Detailed, Minimal)

### Custom Pages (HTML Editor)
Create custom pages for:
- About Us
- FAQ
- Size Guides
- Shipping Information
- Terms & Conditions
- Team / Mission (Fundraisers)
- Portfolio (Affiliates)

**Features:**
- HTML/CSS editor with syntax highlighting
- Page slug (URL) customization
- Display order control
- Active/Inactive toggle
- Preview mode
- Sanitized HTML (security protected)

### Advanced HTML/CSS
For complete control:
- **Custom CSS** - Add your own styles
- **Custom HTML Header** - Inject code in `<head>` (analytics, fonts, etc.)
- **Custom HTML Footer** - Add scripts before `</body>`

### Product Management
- **Product Order** - Drag-and-drop reordering
- **Featured Products** - Highlight bestsellers
- **Product Library** - Import from multiple platforms:
  - Printify
  - CJ Dropshipping
  - Shopify
  - Etsy
  - Custom CSV import

### Contact Forms
Each store gets an internal contact form:
- Themed to match your store
- Spam protection
- Email notifications
- Message inbox at `/messages`
- Customizable contact email

## 🛠️ Technical Details

### Database Tables
```sql
-- Store settings for sellers
store_settings (
  seller_id, 
  template_id, 
  product_page_template,
  layout_config,
  custom_css,
  custom_html_header,
  custom_html_footer,
  contact_page_enabled,
  contact_email,
  ...
)

-- Store settings for affiliates
affiliate_store_settings (
  affiliate_id,
  template_id,
  product_page_template,
  layout_config,
  custom_css,
  custom_html_header,
  custom_html_footer,
  contact_page_enabled,
  contact_email,
  ...
)

-- Store messages (contact form submissions)
store_messages (
  id,
  store_owner_id,
  store_type,
  sender_name,
  sender_email,
  subject,
  message,
  status (unread/read/replied/archived)
)

-- Custom pages
custom_pages (
  id,
  owner_id,
  owner_type,
  page_slug,
  page_title,
  page_content (HTML),
  is_active,
  display_order
)
```

### URL Routing

#### Subdomain Stores
- `beezio.co/store/harbor-coffee` → SellerStorePage
- `beezio.co/store/luma-labs` → SellerStorePage
- `beezio.co/store/cause-collective` → SellerStorePage

#### Custom Domain Stores
- `shop.yourbrand.com` → Routes to your store
- Requires CNAME: `shop.yourbrand.com` → `beezio.co`

#### Custom Pages
- `beezio.co/store/yourname/about` → Custom "About" page
- `beezio.co/store/yourname/faq` → Custom "FAQ" page
- `beezio.co/store/yourname/contact` → Contact form

## 📝 Step-by-Step Setup Example

### For Sellers (Physical Products)
1. **Choose Template**: "Boutique Storyteller"
2. **Set Domain**: `beezio.co/store/wild-honey-co`
3. **Upload Branding**:
   - Logo: Your brand logo
   - Banner: Beekeeper in field photo
4. **Create Pages**:
   - About: Story of your honey farm
   - FAQ: Shipping, storage, varieties
5. **Add Products**: Import or manually add honey products
6. **Reorder Products**: Drag bestsellers to top
7. **Enable Contact Form**: Set email to your business email
8. **Preview & Launch**: Share your store URL!

### For Affiliates (Curated Marketplace)
1. **Choose Template**: "Marketplace Hub"
2. **Set Domain**: `beezio.co/store/maya-chen-studio`
3. **Upload Branding**:
   - Logo: Your name/brand
   - Banner: Curated product collage
4. **Create Pages**:
   - About: Your curation philosophy
   - Collections: Featured product categories
5. **Add Products**: Browse marketplace and add to your store
6. **Set Commission**: Configure your rates
7. **Enable Contact Form**: For collaboration inquiries
8. **Preview & Launch**: Share your affiliate link!

### For Fundraisers (Mission-Driven)
1. **Choose Template**: "Fundraiser Campaign"
2. **Set Domain**: `beezio.co/store/river-city-robotics`
3. **Upload Branding**:
   - Logo: Team logo
   - Banner: Team photo or robot photo
4. **Create Pages**:
   - Mission: Your team's story and goals
   - Impact: How funds are used
   - Team: Roster and bios
5. **Add Products**: Merch and fundraising items
6. **Set Progress Bar**: Show funding goal
7. **Enable Contact Form**: For sponsorship inquiries
8. **Preview & Launch**: Share with supporters!

## 🎯 Best Practices

### Performance
- Optimize images (max 2MB, WebP preferred)
- Use lazy loading for large galleries
- Minimize custom CSS (under 10KB)
- Limit custom scripts

### SEO
- Use descriptive store names
- Fill out meta descriptions
- Use keyword-rich product titles
- Create content-rich About page
- Use custom domain for brand authority

### Security
- Custom HTML is sanitized
- No external checkout links allowed
- All payments go through Beezio
- Contact forms have spam protection
- Store messages are private

### User Experience
- Mobile-first design (all templates responsive)
- Clear navigation
- Fast-loading images
- Prominent call-to-actions
- Easy contact options

## 🔧 Troubleshooting

### Store Not Loading
- Check subdomain is set correctly
- Verify store_settings record exists
- Try logging out and back in

### Custom Domain Not Working
- Verify DNS CNAME record
- Wait 24-48 hours for propagation
- Check for typos in domain entry
- Ensure HTTPS certificate is issued

### Contact Form Not Sending
- Check contact_email is set
- Verify email notifications are enabled
- Check spam folder
- Verify store_messages table access

### Custom CSS Not Applying
- Check CSS syntax is valid
- Clear browser cache
- Ensure selectors are specific enough
- Check for typos in class names

## 📞 Support

Need help setting up your custom store?
- Email: support@beezio.co
- Documentation: /docs
- Community: /community
- Live Chat: Dashboard

## 🚀 Next Steps

1. Run the SQL migration: `setup-custom-store-system.sql`
2. Enable store customization in your dashboard
3. Choose your template and set your domain
4. Create custom pages for your brand story
5. Import or add products
6. Preview and test your store
7. Launch and share with the world!

---

**Built with ❤️ by Beezio**
*Empowering sellers, affiliates, and fundraisers with beautiful, customizable stores*
