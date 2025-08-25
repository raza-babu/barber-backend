"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_routes_1 = require("../modules/user/user.routes");
const auth_routes_1 = require("../modules/auth/auth.routes");
const group_routes_1 = require("../modules/group/group.routes");
const Notification_routes_1 = require("../modules/notification/Notification.routes");
const service_routes_1 = require("../modules/service/service.routes");
const jobPost_routes_1 = require("../modules/jobPost/jobPost.routes");
const jobApplications_routes_1 = require("../modules/jobApplications/jobApplications.routes");
const accessFunction_routes_1 = require("../modules/accessFunction/accessFunction.routes");
const adminAccessFunction_routes_1 = require("../modules/adminAccessFunction/adminAccessFunction.routes");
const ads_routes_1 = require("../modules/ads/ads.routes");
const faq_routes_1 = require("../modules/faq/faq.routes");
const termAndCondition_routes_1 = require("../modules/termAndCondition/termAndCondition.routes");
const privacyPolicy_routes_1 = require("../modules/privacyPolicy/privacyPolicy.routes");
const feed_routes_1 = require("../modules/feed/feed.routes");
const favoriteFeed_routes_1 = require("../modules/favoriteFeed/favoriteFeed.routes");
const supportReplies_routes_1 = require("../modules/supportReplies/supportReplies.routes");
const subscriptionOffer_routes_1 = require("../modules/subscriptionOffer/subscriptionOffer.routes");
const admin_routes_1 = require("../modules/admin/admin.routes");
const customer_routes_1 = require("../modules/customer/customer.routes");
const saloonSchedule_routes_1 = require("../modules/saloonSchedule/saloonSchedule.routes");
const saloonHoliday_routes_1 = require("../modules/saloonHoliday/saloonHoliday.routes");
const barberSchedule_routes_1 = require("../modules/barberSchedule/barberSchedule.routes");
const barberHoliday_routes_1 = require("../modules/barberHoliday/barberHoliday.routes");
const queueCapacity_routes_1 = require("../modules/queueCapacity/queueCapacity.routes");
const booking_routes_1 = require("../modules/booking/booking.routes");
const barberLunch_routes_1 = require("../modules/barberLunch/barberLunch.routes");
const lunch_routes_1 = require("../modules/lunch/lunch.routes");
const saloon_routes_1 = require("../modules/saloon/saloon.routes");
const review_routes_1 = require("../modules/review/review.routes");
const qrCode_routes_1 = require("../modules/qrCode/qrCode.routes");
const follow_routes_1 = require("../modules/follow/follow.routes");
const userSubscription_routes_1 = require("../modules/userSubscription/userSubscription.routes");
const router = express_1.default.Router();
const moduleRoutes = [
    {
        path: '/auth',
        route: auth_routes_1.AuthRouters,
    },
    {
        path: '/users',
        route: user_routes_1.UserRouters,
    },
    {
        path: '/customers',
        route: customer_routes_1.customerRoutes,
    },
    {
        path: '/groups',
        route: group_routes_1.groupRoutes,
    },
    {
        path: '/notifications',
        route: Notification_routes_1.NotificationRoutes,
    },
    {
        path: '/services',
        route: service_routes_1.ServiceRoutes,
    },
    {
        path: '/job-posts',
        route: jobPost_routes_1.jobPostRoutes,
    },
    {
        path: '/job-applications',
        route: jobApplications_routes_1.jobApplicationsRoutes,
    },
    {
        path: '/access-functions',
        route: accessFunction_routes_1.accessFunctionRoutes,
    },
    {
        path: '/accesses-provide',
        route: adminAccessFunction_routes_1.adminAccessFunctionRoutes,
    },
    {
        path: '/ads',
        route: ads_routes_1.adsRoutes,
    },
    {
        path: '/faqs',
        route: faq_routes_1.faqRoutes,
    },
    {
        path: '/terms-&-conditions',
        route: termAndCondition_routes_1.termAndConditionRoutes,
    },
    {
        path: '/privacy-policy',
        route: privacyPolicy_routes_1.privacyPolicyRoutes,
    },
    {
        path: '/feeds',
        route: feed_routes_1.feedRoutes,
    },
    {
        path: '/favorites',
        route: favoriteFeed_routes_1.favoriteFeedRoutes,
    },
    {
        path: '/support',
        route: supportReplies_routes_1.supportRepliesRoutes,
    },
    {
        path: '/subscription-plans',
        route: subscriptionOffer_routes_1.subscriptionOfferRoutes,
    },
    {
        path: '/admin',
        route: admin_routes_1.adminRoutes,
    },
    {
        path: '/saloons',
        route: saloon_routes_1.saloonRoutes,
    },
    {
        path: '/saloon-schedules',
        route: saloonSchedule_routes_1.saloonScheduleRoutes,
    },
    {
        path: '/saloon-holidays',
        route: saloonHoliday_routes_1.saloonHolidayRoutes,
    },
    {
        path: '/barber-schedules',
        route: barberSchedule_routes_1.barberScheduleRoutes,
    },
    {
        path: '/barber-holidays',
        route: barberHoliday_routes_1.barberHolidayRoutes,
    },
    {
        path: '/queue-capacities',
        route: queueCapacity_routes_1.queueCapacityRoutes,
    },
    {
        path: '/bookings',
        route: booking_routes_1.bookingRoutes,
    },
    {
        path: '/break-times',
        route: barberLunch_routes_1.barberLunchRoutes,
    },
    {
        path: '/lunch-times',
        route: lunch_routes_1.lunchRoutes,
    },
    {
        path: '/reviews',
        route: review_routes_1.reviewRoutes,
    },
    {
        path: '/ads',
        route: ads_routes_1.adsRoutes,
    },
    {
        path: '/qr-codes',
        route: qrCode_routes_1.qrCodeRoutes,
    },
    {
        path: '/follows',
        route: follow_routes_1.followRoutes,
    },
    {
        path: '/subscription-order',
        route: userSubscription_routes_1.userSubscriptionRoutes,
    },
];
moduleRoutes.forEach(route => router.use(route.path, route.route));
exports.default = router;
