# Biyahe Project Documentation

**Date of Update:** May 4, 2026, 00:00:14 (PHT)

---

## Recent Additions: Admin Panel & Security Enhancements

### 1. Neural Core Admin Panel (`/admin`)
- **File Created:** `src/app/admin/page.tsx`
- **Description:** Added a secure administrative dashboard for managing the transit routes submitted by contributors.
- **Key Features:**
  - **Strict Access Control:** The application verifies the user's session against the designated root administrator email (`princedalelimosnero@gmail.com`). Unauthorized users attempting to access the route are immediately redirected to the main application interface.
  - **Real-Time Data Fetching:** Retrieves and displays all documents from the `transport_info` Firestore collection, ordered by creation date.
  - **Route Management:** Displays detailed information for each route (Transport Type, Route Designation, Nodes/Waypoints, Contributor Email, and Verification Status).
  - **Route Purging (Deletion):** Allows the administrator to permanently delete any submitted route from the database.
  - **Thematic Consistency:** The UI meticulously follows the project's "Tactical/Neural" design language, employing dark slates, glowing indigos, and teals for an advanced, premium feel.

### 2. Action Confirmation Barriers
- **Files Modified:** `src/app/contribute/page.tsx`, `src/app/admin/page.tsx`
- **Description:** Implemented `window.confirm` dialogs across crucial application interaction points to prevent accidental data loss and verify user intent.
- **Protected Actions:**
  - **Route Submission:** Confirms the user's intent to transmit intelligence (submit a route) to the neural grid before the database upload begins.
  - **Waypoint Purging:** Confirms the contributor's intent to "Purge All" waypoints on the map, preventing accidental resets of complex drawn routes.
  - **Route Deletion (Admin):** Enforces a severe warning confirmation prior to an administrator permanently deleting a route record.
  - **Session Termination:** Requires confirmation before a user signs out of their tactical session.
