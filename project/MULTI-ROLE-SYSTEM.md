# Multi-Role User System Implementation

## Overview

The Beezio platform now supports a unified multi-role system where users can have multiple roles (buyer, seller, affiliate, fundraiser) and seamlessly switch between them without needing separate accounts.

## Key Features

### 🔄 **Role Switching**
- Users can switch between any role they have access to
- Primary role determines the default dashboard view
- All user data and history is preserved across roles
- Real-time role switching without logout/login

### ➕ **Add New Roles**
- Users can add new roles to their account at any time
- No need to create separate accounts
- Instant access to new role features
- Maintain all existing data and relationships

### 🎯 **Unified Dashboard**
- Single entry point at `/dashboard`
- Role-based navigation with visual role indicators
- Header shows current active role with switching menu
- Each role gets its full feature set when active

### 📝 **Simplified Signup**
- One signup process for all users
- Choose starting role (can add others later)
- Streamlined onboarding experience
- Optional profile fields for faster registration

## Database Schema

### New Tables

```sql
-- user_roles: Track multiple roles per user
CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('buyer', 'seller', 'affiliate', 'fundraiser')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);
```

### Updated Tables

```sql
-- profiles: Added primary_role column
ALTER TABLE profiles ADD COLUMN primary_role TEXT;
-- Note: Keeps existing 'role' column for backwards compatibility
```

## API Functions

### Database Functions

```sql
-- Check if user has specific role
user_has_role(user_uuid, role_name) RETURNS BOOLEAN

-- Add new role to user
add_user_role(user_uuid, role_name) RETURNS BOOLEAN

-- Get all user roles
get_user_roles(user_uuid) RETURNS TEXT[]

-- Switch primary role
switch_primary_role(user_uuid, new_role) RETURNS BOOLEAN
```

### Frontend Context

```typescript
interface AuthContextType {
  // Existing auth fields
  user: User | null;
  profile: any;
  
  // New multi-role fields
  userRoles: string[];           // All roles user has access to
  currentRole: string;           // Currently active role
  
  // New methods
  switchRole: (role: string) => Promise<boolean>;
  addRole: (role: string) => Promise<boolean>;
  hasRole: (role: string) => boolean;
}
```

## Components

### UnifiedDashboard
- **Location**: `/src/components/UnifiedDashboard.tsx`
- **Purpose**: Main dashboard with role switching header
- **Features**: 
  - Role dropdown menu with visual indicators
  - Add new role functionality
  - Seamless dashboard switching
  - User profile management

### SimpleSignupModal
- **Location**: `/src/components/SimpleSignupModal.tsx`
- **Purpose**: Streamlined signup/login experience
- **Features**:
  - Choose starting role with descriptions
  - Simplified form with optional fields
  - Visual role cards with feature lists
  - Toggle between signup/login modes

## Role Configuration

Each role has dedicated configuration:

```typescript
const roleConfig = {
  buyer: {
    name: 'Buyer',
    icon: ShoppingCart,
    color: 'blue',
    gradient: 'from-blue-500 to-blue-600',
    description: 'Shop and purchase products'
  },
  seller: {
    name: 'Seller', 
    icon: Store,
    color: 'orange',
    gradient: 'from-orange-500 to-orange-600',
    description: 'Manage your store and products'
  },
  // ... etc
}
```

## Migration Strategy

### For Existing Users
1. **Automatic Migration**: Existing users' `role` becomes their `primary_role`
2. **Role Creation**: Their current role is added to `user_roles` table
3. **Backwards Compatibility**: Old dashboard routes still work
4. **Gradual Adoption**: Users can opt-in to multi-role features

### For New Users
1. **Unified Signup**: New simplified signup modal
2. **Role Selection**: Choose starting role during registration
3. **Immediate Access**: Full multi-role capabilities from day one

## Routes

### New Routes
- `/dashboard` - Unified multi-role dashboard (NEW DEFAULT)
- `/legacy-dashboard` - Original role-specific routing

### Existing Routes (Maintained)
All existing routes continue to work for backwards compatibility.

## Implementation Details

### Authentication Flow
1. User signs up with initial role
2. Profile created with `primary_role` set
3. Initial role added to `user_roles` table
4. User directed to unified dashboard
5. Can add roles and switch as needed

### Role Switching Flow
1. User clicks role dropdown in header
2. Shows all available roles + "Add New Role" option
3. Switching updates `primary_role` in database
4. Dashboard content updates based on new role
5. All role-specific data remains accessible

### Data Persistence
- **Orders**: Linked to user_id, accessible in buyer role
- **Products**: Linked to user_id, accessible in seller role
- **Affiliate Links**: Linked to user_id, accessible in affiliate role
- **Profile**: Single profile with role-agnostic data

## Benefits

### For Users
- ✅ No need for multiple accounts
- ✅ Easy role switching
- ✅ All data in one place
- ✅ Simplified onboarding
- ✅ Flexibility to explore different roles

### For Business
- ✅ Higher user engagement
- ✅ Lower barrier to entry
- ✅ Better user retention
- ✅ More cross-role activity
- ✅ Simplified user management

## Usage Examples

### Adding a New Role
```typescript
const success = await addRole('affiliate');
if (success) {
  // User now has affiliate capabilities
  await switchRole('affiliate');
}
```

### Checking User Permissions
```typescript
if (hasRole('seller')) {
  // Show seller-specific features
}
```

### Role-based Conditionals
```jsx
{currentRole === 'seller' && <SellerFeatures />}
{currentRole === 'buyer' && <BuyerFeatures />}
{hasRole('affiliate') && <AffiliatePromoButton />}
```

This multi-role system creates a more unified and flexible platform where users can explore different aspects of the Beezio ecosystem without friction, leading to increased engagement and a better user experience.
