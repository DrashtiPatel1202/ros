# Module: Users, Devices & Apps

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** server HTML parse

## 1. Biller App users — `/users/desktop/`

Breadcrumb: User Management › Biller App. These are **POS-side staff accounts** (separate from the web admin login).

**Edit Billing User** modal:

| Field | Key | Notes |
| --- | --- | --- |
| Name\* | `name` | |
| User Type\* | `user_type` | Billing User, Delivery Boy, Waiter, Captain, Online Acceptance App |
| User Name\* | `user_name` | login |
| User Code\* | `user_code` | |
| Password\* | `password1` | |
| Phone | `phone` | |
| User Passcode\* | `user_passcode` | quick PIN on POS |
| Swipe Code | `swipe_code` | staff card swipe |

Additional: user groups/permissions (`/users/get_user_groups/`), view change history (`/users/view_biller_user_changes/`), activate integration apps (`/users/activate_integrate_app/`), **Sync Code** (password-confirmed "Get Code" modal) to link a POS terminal.
Endpoints: `/users/desklist/`, `/users/desktop_user/`, `/users/desktop_user_detail/`, `/users/get_sync_code`.

## 2. Device Mapping — `/users/desktop_application/`

"Map device with outlet". Lists outlets (filter Outlet Name / Outlet Id) with **Billing Terminals | Action** table, Get Code (password), Petpooja Server, terminal info modal. Legacy instructions: Install Adobe AIR prerequisite. Endpoint `/users/rest_desktop_user/`.

Global header modal "Map Device With {outlet}" accepts a **mapping code** displayed on a device (Feedback App, Scan & QR, Android POS – Bijlipay) → `/configurations/save_mapping_code/`.

## 3. Petpooja Applications — `/users/petpooja_application`

Download centre. Platform tabs: Windows, Linux, Mac, Android, iPhone.

| Desktop | Mobile |
| --- | --- |
| Petpooja POS | Petpooja Merchant |
| Net Framework 2.0 (prerequisite) | Online Order Acceptance |
| Printer Application | Captain Ordering |
| Petpooja POS Local (local server) | Token Management |
| | Inventory |
| | Feedback Management |
| | Kitchen Display System |
| | MFR Scanner (mark food ready) |
| | Reservations Manager |
| | Digital Display Application |

## 4. Edit Profile — `/users/edit_profile`

User Info (outlet name, email, phone), **2FA For Login** toggle (`/users/update_2fa`), Change Password (current, new, confirm). Endpoints `/users/editprofile/yes`, `/users/user_details/`.

## 5. Quick Links — `/users/add_quick_links/`

Available Links (searchable) → My Quick Links (pinned in sidebar). `/users/add_quick_links_ajax/`, `/users/sidebar_quick_link/`.

## Architecture insight

Petpooja is **hybrid**: the web back-office (this portal) configures data, while billing happens in a desktop/Android POS that syncs (batch size, auto-sync interval, pending-order sync — see [Billing System settings](./07-outlet-configuration.md#14-billing-system)). Devices are paired via sync/mapping codes. Your rebuild should design for **offline-first POS + cloud sync**.

## Inferred entities

`AdminUser` (web; email, phone, 2FA), `StaffUser` (POS; type, username, code, passcode, swipe_code, group), `UserGroup`/permissions, `Device`/`Terminal` (outlet, type, mapping_code, last_sync), `QuickLink`.