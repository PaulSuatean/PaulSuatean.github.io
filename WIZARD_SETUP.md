# Family Tree Setup Wizard

## Overview
The Family Tree application now includes an interactive 3-step wizard to help users create and set up their family trees.

## Wizard Steps

### Step 1: Basic Information
- **Tree Name** (Required) - The name of your family tree
- **Description** (Optional) - A brief description of the tree
- **Privacy Setting** - Choose between Private (only you) or Public (anyone with link)

### Step 2: Family Structure
Users are asked about their family structure to determine the base template:
- **Does your ancestor have a spouse?** - Yes/No
- **How many generations?** - 2 to 6+ generations
  - 2 generations: Grandparent → Parent
  - 3 generations: Grandparent → Parent → Me (default)
  - 4 generations: Great-grandparent → Grandparent → Parent → Me
  - 5-6+ generations: Extended family line
- **How many children did your ancestor have?** - 0-10 (default: 3)
- **How many uncles/aunts did your parent have?** - 0-10 (default: 2)
- **How many children do you have?** - 0-20 (default: 0)

### Step 3: Additional Details
- **How many grandchildren do you have or expect?** - 0-20 (default: 0)
- **Do you have siblings?** - 0-20 (default: 0)
- **Use Template?** - Yes (with placeholder names) or No (start empty)

## Template Generation

When "Yes" is selected for the template option, the system automatically generates:
- Realistic family structure based on answers
- Placeholder names for all family members
- Proper family relationships (spouses, siblings, children)
- Empty fields for birth dates and images that users can fill in later

### Generated Structure
- **Root Person** - The current user
- **Parents** - Based on ancestor children count
- **Grandparents** - The ancestor
- **Siblings** - Siblings of root and parents
- **Children** - Children of root person
- **Spouse** - Optional spouse if selected

## User Experience

1. User clicks "New Tree" button
2. Wizard modal opens with progress indicator (steps 1, 2, 3)
3. User fills out Step 1 basic information
4. Clicks "Next" to proceed to Step 2
5. Fills out family structure questions
6. Clicks "Next" to proceed to Step 3
7. Selects additional details and template preference
8. Clicks "Create Tree" to generate the family tree
9. Automatically redirected to the editor with the generated template

## Back Navigation

Users can go back to previous steps at any time:
- Step 2: "Back" button returns to Step 1
- Step 3: "Back" button returns to Step 2
- Step 1: "Cancel" closes the wizard

## Features

✅ Multi-step wizard interface
✅ Visual progress indicator
✅ Input validation
✅ Template generation based on user preferences
✅ Placeholder names for template members
✅ Customizable family structure
✅ Option to start with empty tree
✅ Automatic redirect to editor after creation

## Technical Implementation

### Files Modified
- `pages/dashboard.html` - Added 3-step wizard modal
- `styles/dashboard.css` - Added wizard styling
- `scripts/dashboard.js` - Added wizard logic and template generation

### Key Functions
- `showCreateModal()` - Opens the wizard
- `hideCreateModal()` - Closes the wizard
- `goToStep(step)` - Navigates between steps
- `resetWizard()` - Resets all inputs
- `createTreeFromWizard()` - Creates the tree from wizard data
- `generateFamilyTemplate()` - Generates family structure based on answers

## Future Enhancements

Potential improvements:
- Add visualization of family structure before creation
- Save draft wizards
- Import templates from existing trees
- More detailed relationship options
- Age calculation suggestions
- Photo batch upload during setup
