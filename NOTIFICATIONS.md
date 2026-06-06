# Notifications Reference

All notifications are sent via **Firebase Cloud Messaging (FCM)** push and stored in the `notification` table. Every notification requires the recipient to have a valid `fcmToken`.

---

## Delivery
- **Push:** Firebase Admin SDK (`admin.messaging().send()`)
- **In-app:** Saved to DB via Prisma `notification` table
- **Badge:** Unread count included in APNS and webpush data

---

## Notification List

### Booking

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 1 | Booking created | Customer | Booking Confirmation | "You have been added to the queue..." / "Your appointment booking has been confirmed..." |
| 2 | Booking rescheduled | Customer | Booking Rescheduled | "Your booking has been rescheduled to {startDateTime}" |
| 3 | Booking status changed | Customer | CONFIRMED / COMPLETED / ARRIVED | Status-based dynamic message |
| 4 | Booking cancelled | Customer | Booking Cancelled | "Your booking has been cancelled successfully." |

**File:** `src/app/modules/booking/booking.service.ts`

---

### Payment

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 5 | Stripe account created | Barber/Owner | Account Created | "Your Stripe account has been created successfully!" |
| 6 | Payment authorized | Customer | Payment Authorized | "Payment has been authorized. Please confirm to complete the transaction." |
| 7 | Payment captured | Customer | Payment Captured | "Your payment has been captured successfully!" |
| 8 | Payment request cancelled | Customer | Payment Cancelled | "Your payment request has been cancelled." |
| 9 | Refund processed | Customer | Refund Processed | "Your refund has been processed successfully!" |
| 10 | Payment successful | Customer | Payment Successful | "Your payment has been processed successfully! Your booking is confirmed." |
| 11 | New booking confirmed (barber) | Barber | New Booking Confirmed | "A new booking has been confirmed for {appointmentAt}." |
| 12 | New booking confirmed (owner) | Salon Owner | New Booking Confirmed | "A new booking has been confirmed for {appointmentAt}." |
| 13 | Payment failed | Customer | Payment Failed | "Your payment has failed. Please try again with another payment method." |
| 14 | Charge failed | Customer | Charge Failed | "Your charge has failed. Please try again with another payment method." |
| 15 | Tip received | Barber | Tip Received | "A customer sent you a tip of ${tipAmount}!" |
| 16 | Payout processed | Barber | Payout Processed | "A payout of ${amount} has been transferred to your account!" |
| 17 | Payout settled | Barber | Payout Settled | "Your payout of ${amount} has been settled and transferred to your account!" |
| 18 | Payout rejected | Barber | Payout Rejected | "Your payout request of ${amount} has been rejected. Reason: {notes}" |

**File:** `src/app/modules/payment/payment.service.ts`

---

### User / Auth

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 19 | User registered | User | Verify Your Email | "Welcome to Barbers Time, {fullName}! Please verify your email with the OTP sent." |
| 20 | Email verified | User | Email Verified | "Welcome {fullName}! Your email has been verified successfully." |
| 21 | Social login | User | Login Successful | "Welcome back to Barbers Time, {fullName}!" |
| 22 | Password changed | User | Password Updated | "Your password has been successfully updated." |
| 23 | Account deleted | User | Account Deleted | "Your account has been successfully deleted. If this was a mistake, please contact support." |
| 24 | Account deactivated | User | Account Deactivated | "Your account has been deactivated. You can reactivate it anytime by logging in." |

**File:** `src/app/modules/user/user.service.ts`

---

### Review

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 25 | Review left on barber | Barber | New Review | "{customer} left you a {rating}-star review!" |
| 26 | Review left on salon | Salon Owner | New Salon Review | "{customer} left your salon a {rating}-star review!" |
| 27 | Review updated (barber) | Barber | Review Updated | "{customer} updated their review to {rating} stars!" |
| 28 | Review updated (salon) | Salon Owner | Salon Review Updated | "{customer} updated their salon review to {rating} stars!" |
| 29 | Review deleted (barber) | Barber | Review Deleted | "{customer} deleted their review." |
| 30 | Review deleted (salon) | Salon Owner | Salon Review Deleted | "{customer} deleted their salon review." |

**File:** `src/app/modules/review/review.service.ts`

---

### Follow

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 31 | User followed | Followee | New Follower | "{follower} started following you!" |
| 32 | User unfollowed | Followee | Unfollowed | "{unfollower} unfollowed you!" |

**File:** `src/app/modules/follow/follow.service.ts`

---

### Job Post

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 33 | New job posted | All followers | New Job Opening | "{owner} posted a new job opening!" |
| 34 | Job updated | All applicants | Job Update | "Job details have been updated by {owner}!" |
| 35 | Job status changed | All applicants | Job Status Changed | "The job posting has been {status} by {owner}." |
| 36 | Job deleted | All applicants | Job Deleted | "The job posting has been deleted by {owner}." |

**File:** `src/app/modules/jobPost/jobPost.service.ts`

---

### Job Applications

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 37 | New application received | Job Owner | New Job Application | "{barber} applied for your job opening!" |
| 38 | Application status updated | Applicant | Job Application Update | Dynamic — SHORTLISTED / REJECTED / HIRED message |

**File:** `src/app/modules/jobApplications/jobApplications.service.ts`

---

### Barber Schedule

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 39 | Schedule created | Barber | Schedule Created | "Your schedule has been created for: {daysList}" |
| 40 | Schedule updated | Barber | Schedule Updated | "Your {day} schedule has been updated ({status})" |
| 41 | Schedule deleted | Barber | Schedule Deleted | "Your schedule has been deleted" |

**File:** `src/app/modules/barberSchedule/barberSchedule.service.ts`

---

### Salon Schedule

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 42 | Salon schedule updated | Salon Owner | Salon Schedule Updated | Message with updated days |
| 43 | Salon schedule cleared | Salon Owner | Salon Schedule Cleared | Message with cleared schedule |

**File:** `src/app/modules/saloonSchedule/saloonSchedule.service.ts`

---

### Salon Holiday

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 44 | Holiday set | Followers | Salon Holiday | "Your salon is closed from {startDate} to {endDate}" |
| 45 | Holiday updated | Followers | Salon Holiday Updated | Updated holiday message |
| 46 | Holiday cleared | Followers | Salon Holiday Cleared | Cleared holiday message |

**File:** `src/app/modules/saloonHoliday/saloonHoliday.service.ts`

---

### Salon

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 47 | Barber employment terminated | Barber | Employment Terminated | "Your employment has been terminated effective {date}. Reason: {reason}" |

**File:** `src/app/modules/saloon/saloon.service.ts`

---

### Customer

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 48 | Salon added to favorites | Salon Owner | New Favorite | "A customer has added your salon to their favorites!" |
| 49 | Customer checked in (barber) | Barber | Customer Checked In | "A customer has checked in for their appointment." |
| 50 | Customer checked in (owner) | Salon Owner | Customer Checked In | "A customer has checked in for their appointment." |

**File:** `src/app/modules/customer/customer.service.ts`

---

### Subscription (Manual / Admin)

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 51 | Subscription activated | User | Subscription Activated | "{name}, your {plan} subscription is now active! Enjoy all premium features." |
| 52 | Subscription renewed | User | Subscription Renewed | "{name}, your {plan} subscription has been renewed successfully!" |
| 53 | Auto-renewal disabled | User | Automatic Renewal Cancelled | "{name}, automatic renewal is now disabled. Your subscription will expire on {date}." |
| 54 | Subscription cancelled by admin | User | Subscription Cancelled | "{name}, your subscription has been cancelled by an administrator." |
| 55 | Subscription self-cancelled | User | Subscription Cancelled | "{name}, your subscription has been cancelled. You will lose access to premium features." |

**File:** `src/app/modules/userSubscription/userSubscription.service.ts`

---

### Google Play Webhook

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 56 | Google subscription activated | User | Subscription Activated | "{name}, welcome to {plan}! Your subscription is now active." |
| 57 | Google subscription renewed | User | Subscription Renewed | "{name}, your {plan} subscription renewed! Valid until {expiryDate}." |
| 58 | Google subscription cancelled | User | Subscription Cancelled | "{name}, your subscription has been cancelled. {reason}" |
| 59 | Google subscription expired | User | Subscription Expired | "{name}, your subscription has expired. Renew now to continue enjoying premium features!" |
| 60 | Google payment failed (grace) | User | Payment Failed - Grace Period Active | "{name}, your payment failed. You still have access until {gracePeriodExpiry}." |
| 61 | Google account on hold | User | Account Hold - Action Required | "{name}, your account is on hold due to a billing issue. Please verify your payment method." |
| 62 | Google subscription restored | User | Subscription Restored | "{name}, welcome back! Your {plan} subscription has been restored." |
| 63 | Google subscription paused | User | Subscription Paused | "{name}, your subscription has been paused. You can resume it anytime." |

**File:** `src/app/modules/userSubscription/googleWebhook.service.ts`

---

### Apple App Store Webhook

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 64 | Apple subscription activated | User | Subscription Activated | "{name}, your {plan} subscription has been activated successfully!" |
| 65 | Apple subscription renewed | User | Subscription Renewed | "{name}, your {plan} subscription has been renewed automatically!" |
| 66 | Apple subscription cancelled | User | Subscription Cancelled | "{name}, your subscription has been cancelled. You will no longer have access to premium features." |
| 67 | Apple subscription expired | User | Subscription Expired | "{name}, your subscription has expired. Renew now to continue enjoying premium features!" |
| 68 | Apple renewal failed | User | Renewal Failed - Action Required | "{name}, your subscription renewal failed. Please update your payment method." |
| 69 | Apple refund processed | User | Refund Processed | "{name}, a refund of {price} has been processed for your subscription." |

**File:** `src/app/modules/userSubscription/appleWebhook.service.ts`

---

### Feed

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 70 | New feed/post published | All followers | New Feed Posted | "{creator} posted new content!" |

**File:** `src/app/modules/feed/feed.service.ts`

---

### Favorite Feed

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 71 | Feed liked by customer | Feed creator | Feed Liked | "{customer} liked your feed!" |

**File:** `src/app/modules/favoriteFeed/favoriteFeed.service.ts`

---

### Loyalty Program

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 72 | New loyalty program created | Followers | New Loyalty Program | "{owner} launched a new loyalty program for {service}!" |
| 73 | Loyalty program updated | Followers | Loyalty Program Updated | "{owner} updated the loyalty program for {service}!" |
| 74 | Loyalty program deleted | Followers | Loyalty Program Deleted | "The loyalty program for {service} by {owner} has been deleted." |

**File:** `src/app/modules/loyaltyProgram/loyaltyProgram.service.ts`

---

### Loyalty Scheme

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 75 | New loyalty scheme created | Followers | New Loyalty Scheme | "{owner} introduced a new loyalty scheme with {percentage}% discount!" |
| 76 | Loyalty scheme updated | Followers | Loyalty Scheme Updated | "{owner} updated the loyalty scheme to {percentage}% discount!" |
| 77 | Loyalty scheme deleted | Followers | Loyalty Scheme Deleted | "The loyalty scheme by {owner} has been deleted." |

**File:** `src/app/modules/loyaltyScheme/loyaltyScheme.service.ts`

---

### Support

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 78 | Support ticket created | User | Support Ticket Created | "Your support ticket has been received: {message preview}..." |
| 79 | Support reply received | User | Support Reply Received | "Your support ticket has been updated: {message preview}..." |
| 80 | Support ticket status updated | User | Support Status Updated | "Your support issue has been updated: {message preview}..." |
| 81 | Support ticket deleted | User | Support Ticket Deleted | "Your support ticket has been deleted." |

**File:** `src/app/modules/supportReplies/supportReplies.service.ts`

---

### Admin Actions

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 82 | Admin changes salon status | Salon Owner | Saloon Status Updated | "Your salon has been {status} by the admin." |
| 83 | Admin changes barber account status | Barber | Account Status Updated | "Your account has been {status} by the admin." |
| 84 | Admin changes customer account status | Customer | Account Status Updated | "Your account has been {status} by the admin." |
| 85 | Admin updates salon verification | Salon Owner | Salon Verification Status Updated | "Congratulations! Your salon has been verified and is now active." / "Your salon verification has been updated." |

**File:** `src/app/modules/admin/admin.service.ts`

---

### Chat (Socket.IO)

| # | Trigger | Recipient | Title | Body |
|---|---------|-----------|-------|------|
| 86 | New chat message sent | Message recipient | New Message | "New message from {sender}: {messagePreview}..." |

**File:** `src/app/utils/socketio.ts`

---

## Summary

| Module | Count |
|--------|-------|
| Payment | 14 |
| Google Webhook | 8 |
| Apple Webhook | 6 |
| User / Auth | 6 |
| Subscription (Manual) | 5 |
| Review | 6 |
| Admin Actions | 4 |
| Support | 4 |
| Job Post | 4 |
| Booking | 4 |
| Loyalty Program | 3 |
| Loyalty Scheme | 3 |
| Customer | 3 |
| Barber Schedule | 3 |
| Salon Holiday | 3 |
| Follow | 2 |
| Salon Schedule | 2 |
| Job Applications | 2 |
| Feed | 1 |
| Favorite Feed | 1 |
| Salon | 1 |
| Chat | 1 |
| **Total** | **86** |
