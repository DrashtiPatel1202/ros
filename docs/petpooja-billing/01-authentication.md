# Authentication, sessions and step-up security

**Status:** reviewed
**Last verified:** 2026-11-19
**Source:** browser observation (sign-in page before login; profile, modals and redirects after login)

## Entry URLs

| URL | Behaviour (observed) |
| --- | --- |
| `/users/dashboard` | Redirects to sign-in when not authenticated |
| `/` | Sign-in page ("Welcome!" / "Sign In to access Account") |
| `/users/logout` | Ends the session (profile menu › Logout) |

## Sign-in screen

| Control | Notes |
| --- | --- |
| Email address or mobile number | Single identifier field. A country picker (+91 default) appears for phone input |
| Continue | Advances to the credential step. The user completed this step manually, so the password/OTP step was not recorded |
| Contact Us | "New in Petpooja?" sales onboarding (no self sign-up observed) |
| Privacy, Terms & conditions | Legal links (`/users/privacy/`, `/users/terms/`) |

## Account security (Edit Profile — `/users/edit_profile`)

| Feature | Detail | Endpoint |
| --- | --- | --- |
| User info | Outlet name, email, phone | `/users/user_details/` |
| **2FA for login** | Toggle; enables a second factor at sign-in | `/users/update_2fa` |
| Change password | Current, new, confirm | `/users/editprofile/yes` |

## Step-up verification (observed patterns)

| Action | Verification |
| --- | --- |
| Remove order permanently | OTP, valid 10 minutes |
| Delete day-end data | OTP (`/orders/send_dayend_otp/`) |
| Reset all virtual-wallet balances | OTP (`/users/reset_card_customer_balance_otp/`) |
| Generate device sync code | Account password ("Get Code" modal) |
| Unmask customer phone numbers | Account password (Lock/Unlock), session-scoped |
| Connect Attendo organisation | OTP sent to the org owner |
| Large discounts at POS | Hierarchy OTP to approvers by discount range (see [07 › Display](./modules/07-outlet-configuration.md#7-display-billing-screen)) |
| POS manager actions | Default manager password (desktop) |

## POS-side identities (separate from web login)

Staff log in to POS apps using a username/password, a quick **passcode** (PIN), or a **swipe code**. See [09 › Biller App users](./modules/09-users-devices.md#1-biller-app-users--usersdesktop). An idle logout time is configurable in [07 › Billing System](./modules/07-outlet-configuration.md#14-billing-system).

## Cross-app SSO

The billing session reaches sub-apps in two ways:

- **Shared cookie:** `menu.` and `inventory.` use the same session and layout.
- **Redirect endpoints** that mint a token for the target app:
  - `/users/finance_redirect`, `/users/marketing_redirect`, `/users/logs_redirect`
  - `/users/ai_report_redirect` — Dynamic Dashboard still asked for a separate login.
  - `/users/get_token_with_url/` — Dynamic Reports iframe.
  - `/users/community_sso/1/`

## Session (not captured)

The cookie names, lifetime and token format were deliberately not recorded. Implementers should choose their own design.

## Requirements for REA-POS

- Use one identifier field (email or E.164 phone) with password, plus an optional TOTP/SMS 2FA.
- Rate-limit attempts and lock out after repeated failures.
- Provide a reusable step-up service (`password` or `otp(purpose, ttl=10m)`) and audit every use.
- Keep separate credential models for admin (web) and staff (POS), and give staff a PIN fast path.
- Use a central identity provider (OIDC) with per-app audiences instead of ad-hoc redirect tokens.
- Fail closed: every back-office route validates the session on the server.

## Open questions

1. Is the credential step password, OTP, or both? Is there a "forgot password" link? The user completed it manually, so this was not seen.
2. Which second factor is used: SMS OTP, email OTP, or authenticator app?
3. Are multiple admin users per organization supported with roles? Only one admin profile was visible.