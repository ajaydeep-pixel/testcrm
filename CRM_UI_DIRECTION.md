# Operations UI Direction Doc

## Purpose
This document defines a repo-specific UI direction for introducing a dedicated `Operations` workspace in `AICODING`.

It is based on:
- the current codebase structure
- the existing tenant dashboard/settings/billing experience
- the research notes in `deep-research-report.md`

It is **not** a direct implementation of the research document. The research is treated as guidance, while this document narrows the direction to what fits the current product and codebase.

## Current Product Context
The current frontend already has distinct product areas:
- `Dashboard` in `FRONTEND/src/pages/Dashboard.jsx`
- `Settings` in `FRONTEND/src/pages/SettingsPage.jsx`
- `Checkout` in `FRONTEND/src/pages/CheckoutPage.jsx`
- shared tenant header/navigation in `FRONTEND/src/components/TenantCommonHeader.jsx`

The codebase also contains older business-operation screens and CRM-like styling hints:
- `FRONTEND/src/components/BillingScreen.module.css`
- `FRONTEND/src/components/CustomersModal.jsx`
- `FRONTEND/src/components/CustomerForm.jsx`
- `FRONTEND/src/components/InvoicesScreen.jsx`
- `FRONTEND/src/components/InventoryScreen.jsx`
- `FRONTEND/src/components/ProductsScreen.jsx`

This suggests the app is already moving toward a multi-workspace SaaS product, not just a single dashboard.

## Product Direction
### Recommended Navigation Change
Add a top-level `Operations` menu item in the tenant header.

Recommended order:
- `Dashboard`
- `Operations`
- `Settings`
- `Logout`

`Operations` should appear:
- after `Dashboard`

Reason:
- `Dashboard` remains the overall account landing space
- `Operations` becomes the focused workspace for day-to-day execution
- this keeps the distinction clear between overview and management

## Core UX Decision
Clicking `Operations` should open a **completely separate UI shell**, not a tab inside the current dashboard.

That new operations shell should have:
- its own left sidebar
- its own internal content routing
- its own page header/state
- its own workflow-focused layout

This is the key architectural UX choice.

We should **not** mix the full operations navigation into the current dashboard page.

## Why A Separate Operations Shell Is Better
### What it solves
- keeps the main dashboard lightweight
- prevents the tenant header from becoming overloaded
- allows operational navigation patterns without affecting billing/settings flows
- makes future growth possible without redesigning the whole app again

### What it avoids
- giant dashboard pages
- too many top-nav items
- mixing account management with day-to-day workflows
- forcing sales, billing, and inventory into a shell meant for overview and settings

## Recommended Route Strategy
Introduce a new route family:
- `/operations`
- `/operations/sales`
- `/operations/customers`
- `/operations/billing`
- `/operations/inventory`
- `/operations/invoices`
- `/operations/reports`
- `/operations/settings`

For compatibility during transition:
- `/crm` can redirect to `/operations`

Phase 1 can start smaller:
- `/operations`
- `/operations/customers`
- `/operations/billing`
- `/operations/inventory`

## Recommended Operations Sidebar
Start with a minimal sidebar, not the full research menu.

### Phase 1 Sidebar
- `Overview`
- `Sales`
- `Customers`
- `Billing`
- `Inventory`
- `Inventory > Products`
- `Inventory > Categories`
- `Inventory > Brands`
- `Invoices`
- `Reports`
- `Settings`

### Phase 2 Sidebar
Add if/when backend support exists:
- `Deals`
- `Tasks`
- `Activities`
- `Integrations`

This keeps the UI honest to current implementation maturity.

## Repo-Specific Design System Direction
The operations shell should follow the cleaner pattern already introduced in Settings and Subscription Details.

### Design Principles
- fast to scan
- fewer small boxes
- stronger hierarchy
- workspace feeling over marketing feeling
- information grouped by task, not only by data type

### Visual Language
Use these current repo patterns as the base:
- compact summary hero blocks
- structured detail sections with row-based layouts
- restrained color accents
- clear status pills
- bordered white surfaces on soft neutral backgrounds

### Avoid
- too many mini-cards
- duplicated headings inside panels
- mixing dashboard KPI styling into every operations screen
- giant modal-heavy flows for normal tasks

## Operations Layout Pattern
### Shell
- fixed or sticky left sidebar
- content area on the right
- slim workspace header above content

### Header content
- current section title
- search bar
- `Quick Add` action button
- optional filter/sort controls

### Content patterns
- list + details
- table + right drawer
- billing/invoice workflows
- inventory table + adjustment panel
- sales summary + transaction lists

## Quick Actions
Repo-specific recommendation:
- add one `Quick Add` button in the operations shell header
- open a compact action panel for:
  - new customer
  - new sale
  - new invoice
  - add stock item

Do not build universal command palette first.
Start with visible UI first, then add keyboard shortcuts later.

## Relationship To Existing Tenant Header
`TenantCommonHeader.jsx` should remain the global tenant-level header.

Recommended behavior:
- keep top-level navigation there
- add an `Operations` entry there
- when user is inside `/operations`, the header remains global
- the detailed operational navigation moves to the operations sidebar

This creates a two-level navigation model:
- top level: product areas
- second level: operations modules

## Relationship To Current Settings Work
The recent Settings redesign establishes the right direction for the rest of the app:
- clearer section hierarchy
- cleaner summary blocks
- fewer redundant headings
- more structured information layouts

The operations shell should reuse this design philosophy, but not literally reuse the Settings layout.

Settings is account-management UI.
Operations should feel more workflow-oriented and task-driven.

## What We Should Not Do Yet
Do not do these immediately:
- build every module from the research in one pass
- implement a full generic CRM product before confirming backend scope
- bury billing/subscription settings inside operations incorrectly
- over-engineer permissions UI before core workflows exist

## Best Next Step
### Recommended Implementation Sequence
1. Add `Operations` top-level menu item in `TenantCommonHeader.jsx`
2. Create a new operations shell page and route: `/operations`
3. Build the operations sidebar and placeholder internal sections
4. Reuse current styling direction to define operations layout primitives
5. Start with one real module first

### Best first real modules
Recommended order:
1. `Customers`
2. `Billing`
3. `Inventory`

Within `Inventory`, the recommended sub-structure is:
- `Products`
- `Categories`
- `Brands`
- `Stock`

Reason:
- these align directly with the current product scope
- they create a practical foundation for sales and invoicing flows
- they fit the app better than starting with a generic CRM-only model

## Proposed Deliverables
### Phase 1
- Operations nav entry
- operations shell
- operations sidebar
- placeholder routes/sections
- Customers module scaffold

### Phase 2
- Billing workspace
- Inventory workspace
- quick add panel

### Phase 3
- sales reporting
- deals/tasks/activities if backend scope supports them
- shortcuts and deeper integrations

## Decision Summary
The recommended direction for this repo is:
- add `Operations` as a top-level product area
- open a dedicated operations workspace when clicked
- use a left-sidebar operations shell
- keep dashboard/settings/checkout separate
- start lean with modules that match the actual product
- reuse the current refined UI language, but adapt it for operational workflows

This gives the product a scalable structure without forcing a generic CRM implementation too early.
