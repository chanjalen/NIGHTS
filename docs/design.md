# RateMyBar - Design Structure Documentation

## Overview
This is a multi-page nightlife discovery web application built with React Router that allows users to search for cities, browse bars, view detailed bar information, and add new bars to the database.

## Application Architecture

### Page Structure
The application uses a browser-based routing system with 4 main pages:
1. **Home Page** (`/`) - Landing page with search
2. **Popular Cities Page** (`/popular-cities`) - Grid of popular cities
3. **City Page** (`/city/:cityName`) - List of bars in a specific city
4. **Bar Detail Page** (`/city/:cityName/bar/:barId`) - Detailed bar information with reviews

---

## Layout Patterns

### Header Component Pattern
Used across all pages with consistent structure:
- **Logo section** - Large clickable brand name (left side)
- **Navigation section** - Horizontal navigation links with top border separator (right side)
  - Links: "Popular Cities", "About", "Contact"
  - Active state indicated by accent color
- **Decorative border** - Visual separator below header

### Responsive Container
- Maximum width: 1400px
- Centered with auto margins
- Horizontal padding: 30px on most pages, 40px on homepage

---

## Page Layouts

### 1. Home Page

**Structure:**
- **Header** - Standard header with logo and navigation
- **Hero Section** - Full-height colored background with overlay
  - Two-column flexible layout
  - **Left column**: Large tagline text (takes ~50% width)
  - **Right column**: Search input with decorative border effect (takes ~50% width)
  - Minimum height: calc(100vh - 200px)

**Interaction:**
- Search form submits to navigate to city page
- Logo clickable to return home

---

### 2. Popular Cities Page

**Structure:**
- **Header** - Standard header
- **Main Content Area**:
  - **Large heading** - Split across two lines with massive text
  - **Cities grid** - Responsive grid layout
    - 1 column on mobile
    - 2 columns on tablet (md breakpoint)
    - 3 columns on desktop (lg breakpoint)
    - Gap: 20px between cards

**City Card Component:**
- Semi-transparent background with subtle border
- Padding: 30px
- Contains:
  - City name (large text)
  - Bar count
  - Average rating with star icon
- Hover states: background brightens, border accent appears
- Full card is clickable button

---

### 3. City Page

**Structure:**
- **Header Section**:
  - Two-column layout with 70px gap
  - **Left column**: Back navigation button with arrow icon
  - **Right column**: 
    - City name heading
    - "Add Bar" button with icon and decorative border effect

- **Stats Section** (80px vertical padding):
  - Three-column grid (responsive: 1 col mobile, 3 cols desktop)
  - Stat cards with:
    - Label text (muted)
    - Large numeric value
    - Semi-transparent background and border
    - 30px padding

- **Bars List Section**:
  - Section heading
  - Responsive grid of bar cards
    - 1 column on mobile
    - 2 columns on tablet
    - 3 columns on desktop
    - 20px gap

**Bar Card Component:**
- Semi-transparent background with border
- 30px padding
- Layout (top to bottom):
  - Bar name
  - Category label
  - Rating and review count row
  - Price level indicator ($ symbols)
  - Address
- Full card clickable
- Hover states

**Add Bar Modal:**
- Fixed overlay covering full viewport
- Dark semi-transparent backdrop with blur
- Centered modal container
- Maximum width: 600px
- Contains:
  - Header with title and close button
  - Form with vertical layout (25px gap between fields):
    - Text input: Bar name
    - Dropdown select: Category
    - Text input: Address
    - Custom button group: Price level selector (4 options, horizontal layout)
    - Action buttons: Cancel and Submit (horizontal layout, equal width)

---

### 4. Bar Detail Page

**Structure:**
- **Header** - Minimal header with just back navigation
- **Main Content**:

  **Bar Overview Section:**
  - Two-column layout (60px gap)
  - **Left column** (fixed width):
    - Square bar image container (500x500px)
    - Object-fit cover
  - **Right column** (flexible):
    - Bar name (very large heading)
    - Metadata row: rating, review count, neighborhood (separated by dots)
    - Action buttons row (circular buttons):
      - Primary action (accent background)
      - Secondary actions (transparent with borders)
      - Icons: Star, Heart, Bookmark, Share
    - Category tags (horizontal wrap layout)
    - Description paragraph
    - Two-column grid of info cards:
      - Hours
      - Price level

  **Decorative separator**

  **Reviews Section:**
  - Section heading
  - Vertical list of review cards (30px gap)
  - Each review card contains:
    - Horizontal layout with profile image and content
    - **Left**: Circular profile image (60x60px)
    - **Right**:
      - User name
      - Rating and date (inline with separator)
      - Review comment text

---

## Component Patterns

### Decorative Border Component
- Height: 20px
- Contains 80 small squares (10x10px each)
- Randomly distributed with 30% visibility probability
- Used as visual separator between sections

### Button Patterns

**Primary Button with Border Effect:**
- Dual-layer approach:
  - Outer layer: Accent color border (1px outside)
  - Inner layer: Dark background with matching border
- Padding: 26px horizontal, 7.8px vertical
- Includes icon + text combination
- Hover state changes background opacity

**Circular Action Buttons:**
- Fixed size: 50x50px
- Border radius: Full (circular)
- Centered icon (24x24px)
- Primary version: Solid accent background
- Secondary version: Transparent with border

**Card Buttons:**
- Full card acts as button
- Semi-transparent backgrounds
- Subtle borders
- Hover states change background and border colors
- Text-left alignment

### Input Fields
- Full width
- Padding: 20px horizontal, 12px vertical
- Semi-transparent backgrounds (white/5)
- Subtle borders that highlight on focus
- Accent border color on focus state

### Grid Layouts
All grids use consistent breakpoints:
- Mobile: 1 column
- Tablet (md): 2 columns
- Desktop (lg): 3 columns
- Gap: 20px

### Spacing System
Common spacing values:
- Small gap: 5px, 8px, 10px
- Medium gap: 15px, 20px, 25px, 30px
- Large gap: 40px, 50px, 60px
- Section padding: 80px, 100px

---

## Interactive Elements

### Navigation
- Logo is clickable on all pages → navigates to home
- Nav links have hover states
- Back buttons with arrow icons
- Full-card clickable components

### Forms
- Search form on homepage
- Add Bar modal form with:
  - Text inputs
  - Dropdown select
  - Custom button-group selector (price level)
  - Submit and cancel actions

### Action Buttons
- Primary actions: Review a bar (circular star button)
- Secondary actions: Like, bookmark, share (circular icon buttons)
- Modal triggers: Add Bar button

### Overlays
- Modal with backdrop blur and dark overlay
- Close via X button or cancel action
- Form submission adds to list and closes modal

---

## Data Flow Patterns

### State Management
- City Page: Manages local array of bars
- Add Bar Modal: Form state for new bar creation
- Bar additions prepend to list (newest first)

### URL Parameters
- `:cityName` - Used in City Page and Bar Detail Page
- `:barId` - Used in Bar Detail Page
- City names converted to URL-safe format (lowercase, hyphenated)

### Navigation Flow
```
Home → Search → City Page → Click Bar Card → Bar Detail Page
              ↓
              Popular Cities Page → Click City Card → City Page
```

---

## Accessibility & UX Patterns

### Semantic HTML
- Proper heading hierarchy (h1, h2, h3)
- Button elements for interactive components
- Form elements with labels
- Alt text on images

### Visual Hierarchy
- Extremely large headings for page titles
- Clear visual separation between sections
- Consistent card patterns
- Icon + text combinations for clarity

### Feedback & States
- Hover states on all interactive elements
- Focus states on form inputs
- Transition animations for smooth interactions
- Loading states assumed (not implemented in current code)

### Content Patterns
- Star ratings displayed consistently
- Price levels shown as repeated $ symbols
- Review counts in parentheses
- Date timestamps for reviews (relative: "2 weeks ago")

---

## Responsive Behavior

### Breakpoints
- Mobile-first approach
- Medium (md): Typically 768px
- Large (lg): Typically 1024px

### Layout Adaptations
- Header: Maintains side-by-side layout (may need adjustment on very small screens)
- Hero: Two-column layout on desktop, stacks on mobile (implied)
- Grids: 1 → 2 → 3 columns as screen grows
- Bar detail: Image + info side-by-side on desktop, stacks on mobile (implied)

---

## Special Design Elements

### Border Effects
- Dual-layer border technique for depth
- Decorative pixel border component
- Consistent border opacity patterns (10%, 20%, 50%)

### Image Handling
- Square aspect ratio for bar images (500x500)
- Circular crops for user profile images (60x60)
- Object-fit cover for maintaining aspect ratios

### Icon System
- Uses Lucide React icon library
- Icons: ArrowLeft, Plus, Star, Heart, Bookmark, Share2, MapPin, X
- Consistent sizing: 20px, 24px

### Text Transforms
- Uppercase used extensively
- City name URL formatting (lowercase, hyphenated)
- Display name formatting (capitalized words)

---

## Component Reusability

### Shared Components
1. **DecorativeBorder** - Used across all pages as section separator
2. **BarCard** - Reusable card for displaying bar in grid
3. **AddBarModal** - Modal overlay for adding new bars

### Pattern Repetition
- Header structure repeated on every page
- Card pattern used for: cities, bars, reviews, info boxes
- Icon + text button pattern
- Semi-transparent backgrounds throughout

---

## Form Patterns

### Add Bar Form Fields
1. **Text Input** - Bar name, address
2. **Select Dropdown** - Category selection with predefined options
3. **Button Group Selector** - Price level (1-4 $'s)
4. **Action Buttons** - Cancel (secondary) and Submit (primary)

### Validation
- Required fields enforced
- Empty string checking before submission
- Form prevents submission if invalid

---

## Data Models

### Bar Object
```
{
  id: string
  name: string
  rating: number (0-5)
  reviewCount: number
  category: string
  address: string
  priceLevel: number (1-4)
  [optional fields for detail page]:
    - image: string (URL)
    - neighborhood: string
    - year: string
    - hours: string
    - visitors: string
    - phone: string
    - categories: string[]
    - description: string
}
```

### Review Object
```
{
  id: string
  userName: string
  userImage: string (URL)
  rating: number (0-5)
  comment: string
  date: string (relative format)
}
```

### City Object
```
{
  name: string
  state: string
  bars: number
  rating: number
}
```

---

## Layout Measurements

### Container Widths
- Max content width: 1400px
- Modal max width: 600px
- Bar image: 500x500px

### Common Padding
- Card padding: 30px
- Modal padding: 40px
- Page padding: 30-40px horizontal
- Section padding: 60-100px vertical

### Common Gaps
- Between elements: 5px, 8px, 10px, 15px, 20px
- Between sections: 30px, 40px, 50px, 60px
- Between columns: 50px, 60px, 70px
- Grid gaps: 20px

---

## Summary

This design system creates a cohesive nightlife discovery platform through:
- Consistent header and navigation patterns
- Reusable card-based components
- Responsive grid layouts
- Clear visual hierarchy with large typography
- Interactive elements with proper hover/focus states
- Modal overlays for forms
- Decorative elements for visual interest
- Structured data display patterns
