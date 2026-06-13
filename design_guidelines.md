# Design Guidelines for Mobile Authentication Pages

## Design Approach
**Reference-Based Approach**: Modern mobile authentication UI patterns with a dark theme aesthetic, optimized for 375px viewport width.

## Core Design Elements

### Color Palette
- **Primary Background**: #201E22 (Dark charcoal)
- **Secondary Background**: #111111 (Deeper black)
- **Primary Text**: #FFFFFF (White)
- **Secondary Text**: #BFBFBF (70% opacity gray)
- **Tertiary Text**: #D5D5D5 (80% opacity gray)
- **Border/Divider**: #373539 (Subtle dark gray)

### Typography
- **Font Family**: Pretendard (primary typeface throughout)
- **Page Headers**: 
  - Font-weight: 700 (Bold)
  - Font-size: 95px for splash/hero titles (scale down appropriately for mobile readability to ~32-40px)
  - Line-height: 128%
  - Text-align: Center
- **Body Text**: 
  - Font-weight: 400 (Regular)
  - Font-size: 16px
  - Line-height: 160%
  - Letter-spacing: -0.025em
- **Input Labels**: 14-16px, weight 400-500
- **Button Text**: 16-18px, weight 600-700

### Layout System
- **Mobile Container**: 375px max-width
- **Content Padding**: 20px horizontal padding
- **Vertical Spacing**: 20px gap between major sections
- **Form Element Spacing**: 10px gap between related items
- **Border Radius**: 2.67px for inputs, 100px for pills/buttons

### Component Library

#### Status Bar (Top)
- Height: 44px
- Background: #111111
- Contains time, cellular, wifi, battery indicators
- White icons and text

#### Navigation Header
- Height: 54px
- Background: #111111
- Padding: 10px 20px
- Centered title with optional back button (24px icon, rotated arrow)
- Bottom border: 1px solid #373539

#### Input Fields
- Background: Transparent or #201E22
- Border: 1px solid #373539
- Text color: #FFFFFF
- Placeholder color: #BFBFBF
- Padding: 12-16px
- Border-radius: 8-12px
- Focus state: Border color brightens to #D5D5D5

#### Buttons (Primary)
- Background: Solid color (to be determined in color selection phase)
- Text: #FFFFFF
- Padding: 16px 24px
- Border-radius: 12px
- Font-weight: 700
- Full-width on mobile

#### Buttons (Secondary/Text)
- Background: Transparent
- Text: #BFBFBF or #D5D5D5
- Underline on relevant actions
- Font-weight: 400-500

#### Home Indicator (iPhone X style)
- Height: 34px
- Background: #111111
- Grabber: 134px × 5px, #FFFFFF, centered, 8px from bottom
- Border-radius: 100px

#### Form Containers
- Background: #201E22
- Padding: 20px
- Gap: 20px between form sections
- Bottom border: 1px solid #373539 for separation

### Page-Specific Layouts

#### Login Page
- Centered logo/title at top (reduced from 95px to ~32px for readability)
- Email input field
- Password input field
- "Forgot Password?" link (right-aligned, #BFBFBF)
- Login button (full-width)
- "Sign Up" link at bottom
- Vertical centering with appropriate spacing

#### Sign Up Page
- Page title "회원가입" (centered, bold)
- Email input field
- Password input field
- Password confirmation field
- Terms of Service checkbox/link
- Sign Up button (full-width)
- "Already have an account? Login" link at bottom

#### Password Reset/Change Page
- Page title "비밀번호 찾기/변경"
- Email input field
- Verification code input (if applicable)
- New password input field
- Confirm new password field
- Submit button (full-width)
- Back to login link

### Interaction Patterns
- Smooth transitions between form states
- Input field focus states with subtle border color changes
- Error messages in red accent color (to be defined) below relevant fields
- Success feedback via green accent (to be defined)
- Loading states for buttons during submission
- Keyboard-aware scrolling to keep active input visible

### Spacing & Rhythm
- Use Tailwind spacing units: primarily 4, 5, 6, 8, 10, 12, 16, 20
- Consistent vertical rhythm: py-5 for sections, py-4 for form groups
- Input fields: px-4 py-3
- Buttons: px-6 py-4
- Page margins: px-5 (20px)

### Accessibility
- High contrast ratios (white text on dark backgrounds)
- Minimum touch target size: 44px × 44px
- Clear focus indicators
- Semantic HTML form elements
- Proper label associations
- ARIA labels where needed

### Mobile Optimization
- Single-column layout
- Full-width interactive elements
- Adequate spacing for thumb navigation
- Sticky header for context retention
- Bottom-aligned primary actions for reachability
- Viewport: 375px width, responsive height based on content
- No horizontal scrolling

### Visual Hierarchy
- Page titles: Largest, bold, centered
- Section headers: Medium, semi-bold
- Body text: Regular weight, optimal reading size
- Helper text: Smaller, lower opacity
- Error/success messages: Regular size, distinct colors