import express from 'express';
import { UserRouters } from '../modules/user/user.routes';
import { AuthRouters } from '../modules/auth/auth.routes';
import { groupRoutes } from '../modules/group/group.routes';
import { NotificationRoutes } from '../modules/notification/Notification.routes';
import { ServiceRoutes } from '../modules/service/service.routes';
import { jobPostRoutes } from '../modules/jobPost/jobPost.routes';
import { jobApplicationsRoutes } from '../modules/jobApplications/jobApplications.routes';
import { accessFunctionRoutes } from '../modules/accessFunction/accessFunction.routes';
import { adminAccessFunctionRoutes } from '../modules/adminAccessFunction/adminAccessFunction.routes';
import { adsRoutes } from '../modules/ads/ads.routes';
import { faqRoutes } from '../modules/faq/faq.routes';
import { termAndConditionRoutes } from '../modules/termAndCondition/termAndCondition.routes';
import { privacyPolicyRoutes } from '../modules/privacyPolicy/privacyPolicy.routes';
import { feedRoutes } from '../modules/feed/feed.routes';
import { favoriteFeedRoutes } from '../modules/favoriteFeed/favoriteFeed.routes';
import { supportRepliesRoutes } from '../modules/supportReplies/supportReplies.routes';
import { subscriptionOfferRoutes } from '../modules/subscriptionOffer/subscriptionOffer.routes';
import path from 'path';
import admin from '../utils/firebase';
import { adminRoutes } from '../modules/admin/admin.routes';
const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRouters,
  },
  {
    path: '/users',
    route: UserRouters,
  },
  {
    path: '/groups',
    route: groupRoutes,
  },
  {
    path: '/notifications',
    route: NotificationRoutes,
  },
  {
    path: '/services',
    route: ServiceRoutes
  },
  {
    path: '/job-posts',
    route: jobPostRoutes,
  },
  {
    path: '/job-applications',
    route: jobApplicationsRoutes
  },
  {
    path: '/access-functions',
    route: accessFunctionRoutes,
  },
  {
    path: '/accesses-provide',
    route: adminAccessFunctionRoutes
  },
  {
    path: '/ads',
    route: adsRoutes,
  },
  {
    path: '/faqs',
    route: faqRoutes,
  },
  {
    path: '/terms-&-conditions',
    route: termAndConditionRoutes,
  },
  {
    path: '/privacy-policy',
    route: privacyPolicyRoutes
  },
  {
    path: '/feeds',
    route: feedRoutes,
  },
  {
    path: '/favorites',
    route: favoriteFeedRoutes,
  },
  {
    path: '/support',
    route: supportRepliesRoutes,
  },
  {
    path: '/subscription-plans',
    route: subscriptionOfferRoutes
  },
  {
    path: '/admin',
    route: adminRoutes,
  }
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
