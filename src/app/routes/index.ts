import express from 'express';
import { UserRouters } from '../modules/user/user.routes';
import { AuthRouters } from '../modules/auth/auth.routes';
import path from 'path';
import { categoryRoutes } from '../modules/category/category.routes';
import { blogRoutes } from '../modules/blog/blog.routes';
import { challengeRoutes } from '../modules/challenge/challenge.routes';
import { groupRoutes } from '../modules/group/group.routes';
import { goalRoutes } from '../modules/goal/goal.routes';
import { drinkRoutes } from '../modules/drink/drink.routes';
import { drinkUnitsRoutes } from '../modules/drinkUnits/drinkUnits.routes';
import { NotificationRoutes } from '../modules/Notification/Notification.routes';
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
    path: '/categories',
    route: categoryRoutes,
  },
  {
    path: '/blogs',
    route: blogRoutes,
  },
  {
    path: '/challenges',
    route: challengeRoutes,
  },
  {
    path: '/groups',
    route: groupRoutes,
  },
  {
    path: '/goals',
    route: goalRoutes,
  },
  {
    path: '/drinks',
    route: drinkRoutes,
  },
  {
    path: '/drink-units',
    route: drinkUnitsRoutes,
  },
  {
    path: '/notifications',
    route: NotificationRoutes,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
